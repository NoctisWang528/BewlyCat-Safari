import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BEWLY_PAGE_WORLD_FAILED,
  BEWLY_PAGE_WORLD_FALLBACK_ATTR,
  BEWLY_PAGE_WORLD_PING,
  BEWLY_PAGE_WORLD_READY,
  BEWLY_PAGE_WORLD_SOURCE,
} from '~/constants/pageWorld'
import { ensureMainWorldInjected } from '~/contentScripts/pageWorldInjection'
import type { BewlyPageWorldState } from '~/inject/pageWorldLifecycle'
import {
  installPageWorldPingListener,
  notifyExistingPageWorldState,
} from '~/inject/pageWorldLifecycle'

function createTargetWindow() {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  return {
    iframe,
    target: iframe.contentWindow!,
  }
}

describe('page-world lifecycle', () => {
  it('only reports already-loaded for a ready state', () => {
    const { iframe, target } = createTargetWindow()
    const postMessage = vi.spyOn(target, 'postMessage').mockImplementation(() => {})
    const state: BewlyPageWorldState = {
      status: 'ready',
      version: 'test-version',
      injectedAt: Date.now(),
      pingListenerInstalled: false,
    }

    notifyExistingPageWorldState(state, target)

    expect(postMessage).toHaveBeenCalledWith({
      type: BEWLY_PAGE_WORLD_READY,
      source: BEWLY_PAGE_WORLD_SOURCE,
      version: 'test-version',
      reason: 'already-loaded',
    }, '*')
    iframe.remove()
  })

  it('does not report an initializing state as ready', () => {
    const { iframe, target } = createTargetWindow()
    const postMessage = vi.spyOn(target, 'postMessage').mockImplementation(() => {})
    const state: BewlyPageWorldState = {
      status: 'initializing',
      version: 'test-version',
      injectedAt: Date.now(),
      pingListenerInstalled: false,
    }

    notifyExistingPageWorldState(state, target)
    expect(postMessage).not.toHaveBeenCalled()
    iframe.remove()
  })

  it('reports a failed state without claiming readiness', () => {
    const { iframe, target } = createTargetWindow()
    const postMessage = vi.spyOn(target, 'postMessage').mockImplementation(() => {})
    const state: BewlyPageWorldState = {
      status: 'failed',
      version: 'test-version',
      injectedAt: Date.now(),
      pingListenerInstalled: false,
    }

    notifyExistingPageWorldState(state, target)
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: BEWLY_PAGE_WORLD_FAILED,
      source: BEWLY_PAGE_WORLD_SOURCE,
    }), '*')
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: BEWLY_PAGE_WORLD_READY,
    }), '*')
    iframe.remove()
  })

  it('answers only trusted PING messages while ready', () => {
    const { iframe, target } = createTargetWindow()
    const postMessage = vi.spyOn(target, 'postMessage').mockImplementation(() => {})
    const state: BewlyPageWorldState = {
      status: 'ready',
      version: 'test-version',
      injectedAt: Date.now(),
      pingListenerInstalled: false,
    }
    installPageWorldPingListener(state, target)

    target.dispatchEvent(new MessageEvent('message', {
      source: target,
      data: { type: BEWLY_PAGE_WORLD_PING, source: 'untrusted' },
    }))
    expect(postMessage).not.toHaveBeenCalled()

    target.dispatchEvent(new MessageEvent('message', {
      source: target,
      data: { type: BEWLY_PAGE_WORLD_PING, source: BEWLY_PAGE_WORLD_SOURCE },
    }))
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: BEWLY_PAGE_WORLD_READY,
      reason: 'ping',
    }), '*')
    iframe.remove()
  })
})

describe('safari page-world injection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.documentElement.removeAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)
    document.querySelectorAll('script[data-bewly-page-world]').forEach(node => node.remove())
    vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('marks the injection loaded only after a trusted READY message', () => {
    ensureMainWorldInjected(10)
    expect(document.documentElement.getAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)).toBe('pending')

    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: BEWLY_PAGE_WORLD_READY,
        source: BEWLY_PAGE_WORLD_SOURCE,
      },
    }))

    expect(document.documentElement.getAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)).toBe('loaded')
    vi.advanceTimersByTime(10)
    expect(document.querySelectorAll('script[data-bewly-page-world]')).toHaveLength(0)
  })

  it('does not treat script.onload as successful initialization', () => {
    ensureMainWorldInjected(10)
    vi.advanceTimersByTime(10)
    const script = document.querySelector('script[data-bewly-page-world]') as HTMLScriptElement
    expect(script).toBeTruthy()

    script.onload?.(new Event('load') as any)
    expect(document.documentElement.getAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)).toBe('pending')
    vi.advanceTimersByTime(500)
    expect(document.documentElement.getAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)).toBe('failed')
  })

  it('handles an explicit initialization failure and prevents duplicate insertion', () => {
    ensureMainWorldInjected(10)
    ensureMainWorldInjected(10)
    vi.advanceTimersByTime(10)
    expect(document.querySelectorAll('script[data-bewly-page-world]')).toHaveLength(1)

    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: BEWLY_PAGE_WORLD_FAILED,
        source: BEWLY_PAGE_WORLD_SOURCE,
        error: 'boom',
      },
    }))
    expect(document.documentElement.getAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)).toBe('failed')
  })
})
