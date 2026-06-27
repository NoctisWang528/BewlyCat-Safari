import {
  BEWLY_PAGE_WORLD_FAILED,
  BEWLY_PAGE_WORLD_PING,
  BEWLY_PAGE_WORLD_READY,
  BEWLY_PAGE_WORLD_SOURCE,
} from '~/constants/pageWorld'

export interface BewlyPageWorldState {
  status: 'initializing' | 'ready' | 'failed'
  version: string
  injectedAt: number
  pingListenerInstalled: boolean
}

export function sendPageWorldReady(
  reason: 'initial' | 'ping' | 'already-loaded',
  version: string,
  target: Window = window,
) {
  target.postMessage({
    type: BEWLY_PAGE_WORLD_READY,
    source: BEWLY_PAGE_WORLD_SOURCE,
    version,
    reason,
  }, '*')
}

export function sendPageWorldFailed(error: unknown, version: string, target: Window = window) {
  target.postMessage({
    type: BEWLY_PAGE_WORLD_FAILED,
    source: BEWLY_PAGE_WORLD_SOURCE,
    version,
    error: error instanceof Error ? error.message : String(error),
  }, '*')
}

export function installPageWorldPingListener(state: BewlyPageWorldState, target: Window = window) {
  if (state.pingListenerInstalled)
    return

  state.pingListenerInstalled = true
  target.addEventListener('message', (event) => {
    if (event.source !== target)
      return
    if (event.data?.type !== BEWLY_PAGE_WORLD_PING)
      return
    if (event.data?.source !== BEWLY_PAGE_WORLD_SOURCE)
      return
    if (state.status === 'ready')
      sendPageWorldReady('ping', state.version, target)
  })
}

export function notifyExistingPageWorldState(state: BewlyPageWorldState, target: Window = window) {
  installPageWorldPingListener(state, target)
  if (state.status === 'ready')
    sendPageWorldReady('already-loaded', state.version, target)
  else if (state.status === 'failed')
    sendPageWorldFailed('Page-world initialization previously failed', state.version, target)
}
