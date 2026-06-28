import { beforeEach, describe, expect, it, vi } from 'vitest'
import browser from 'webextension-polyfill'

import { deserializeError, ERROR_WHITELIST, onMessage, sendMessage, serializeError } from '~/utils/messaging'

describe('messaging error serialization', () => {
  beforeEach(() => {
    vi.mocked(browser.runtime.sendMessage).mockReset()
    vi.mocked(browser.runtime.onMessage.addListener).mockClear()
  })

  it('preserves name and message for plain Error', () => {
    const err = new Error('test message')
    err.name = 'TestError'
    const serialized = serializeError(err)
    expect(serialized.name).toBe('TestError')
    expect(serialized.message).toBe('test message')
    expect(serialized.code).toBeUndefined()
    expect(serialized.isRiskControl).toBeUndefined()
  })

  it('round-trips code=-412 and isRiskControl=true', () => {
    const err = new Error('检测到风控页面') as any
    err.name = 'ApiRiskControlError'
    err.code = -412
    err.isRiskControl = true

    const serialized = serializeError(err)
    expect(serialized.code).toBe(-412)
    expect(serialized.isRiskControl).toBe(true)

    const restored = deserializeError(serialized)
    expect((restored as any).code).toBe(-412)
    expect((restored as any).isRiskControl).toBe(true)
    expect(restored.message).toBe('检测到风控页面')
  })

  it('round-trips code=ERR_STORAGE_QUOTA', () => {
    const err = new Error('storage.local quota exceeded') as any
    err.code = 'ERR_STORAGE_QUOTA'

    const serialized = serializeError(err)
    expect(serialized.code).toBe('ERR_STORAGE_QUOTA')

    const restored = deserializeError(serialized)
    expect((restored as any).code).toBe('ERR_STORAGE_QUOTA')
  })

  it('round-trips originalError string', () => {
    const err = new Error('请求失败') as any
    err.originalError = 'TypeError: Failed to fetch'

    const serialized = serializeError(err)
    expect(serialized.originalError).toBe('TypeError: Failed to fetch')

    const restored = deserializeError(serialized)
    expect((restored as any).originalError).toBe('TypeError: Failed to fetch')
  })

  it('safely serializes non-Error rejection', () => {
    const serialized = serializeError('string error')
    expect(serialized.name).toBe('Error')
    expect(serialized.message).toBe('string error')
  })

  it('safely serializes null rejection', () => {
    const serialized = serializeError(null)
    expect(serialized.name).toBe('Error')
    expect(serialized.message).toBe('null')
  })

  it('does not copy stack or unrelated properties', () => {
    const err = new Error('test') as any
    err.stack = 'long stack trace...'
    err.secret = 'should not be copied'

    const serialized = serializeError(err)
    expect((serialized as any).stack).toBeUndefined()
    expect((serialized as any).secret).toBeUndefined()
  })

  it('ignores non-string/number code values', () => {
    const err = new Error('test') as any
    err.code = { nested: 'object' }

    const serialized = serializeError(err)
    expect(serialized.code).toBeUndefined()
  })

  it('eRROR_WHITELIST contains expected fields', () => {
    expect(ERROR_WHITELIST).toEqual(['name', 'message', 'code', 'isRiskControl', 'originalError'])
  })

  it('onMessage returns false for a type mismatch', () => {
    onMessage('foo', vi.fn())
    const listener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
    expect(listener({ type: 'bar' }, {}, vi.fn())).toBe(false)
  })

  it('onMessage keeps the channel open and responds once for async success', async () => {
    const handler = vi.fn(async () => 'done')
    const sendResponse = vi.fn()
    onMessage('foo', handler)
    const listener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any

    expect(listener({ type: 'foo', data: 42 }, {}, sendResponse)).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledOnce())
    expect(handler).toHaveBeenCalledWith(42, {})
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: 'done' })
  })

  it('onMessage serializes structured handler failures', async () => {
    const error = Object.assign(new Error('quota'), { code: 'ERR_STORAGE_QUOTA' })
    const sendResponse = vi.fn()
    onMessage('foo', async () => {
      throw error
    })
    const listener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any

    expect(listener({ type: 'foo' }, {}, sendResponse)).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledOnce())
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: {
        name: 'Error',
        message: 'quota',
        code: 'ERR_STORAGE_QUOTA',
      },
    })
  })

  it('sendMessage reports malformed error responses explicitly', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ ok: false } as any)
    await expect(sendMessage('foo')).rejects.toThrow('Malformed messaging error response')
  })

  it('sendMessage throws ERR_EXTENSION_NO_RESPONSE when background returns undefined', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce(undefined as any)
    const promise = sendMessage('getData')
    await expect(promise).rejects.toThrow('No response from background for message: getData')
    await expect(promise).rejects.toMatchObject({ code: 'ERR_EXTENSION_NO_RESPONSE' })
  })

  it('sendMessage throws ERR_EXTENSION_MALFORMED_RESPONSE for non-object responses', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce('string-response' as any)
    const promise = sendMessage('foo')
    await expect(promise).rejects.toThrow('Malformed background response for message: foo')
    await expect(promise).rejects.toMatchObject({ code: 'ERR_EXTENSION_MALFORMED_RESPONSE' })
  })

  it('sendMessage throws ERR_EXTENSION_MALFORMED_RESPONSE for object without ok', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ data: 123 } as any)
    await expect(sendMessage('foo')).rejects.toThrow('Malformed background response for message: foo')
  })
})
