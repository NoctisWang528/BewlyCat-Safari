import { vi } from 'vitest'

// Mock webextension-polyfill for tests that import modules depending on it
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
      },
      getURL: vi.fn((path: string) => `moz-extension://test/${path}`),
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn().mockResolvedValue(true),
      onAlarm: { addListener: vi.fn() },
    },
    declarativeNetRequest: {},
    tabs: {
      create: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
    },
  },
}))
