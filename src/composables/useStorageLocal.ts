import type { MaybeRef, Ref, WatchOptions } from 'vue'
import { getCurrentScope, isProxy, onScopeDispose, ref, shallowRef, toRaw, toValue, watch } from 'vue'
import browser from 'webextension-polyfill'

type Awaitable<T> = T | Promise<T>
type SerializerType = 'any' | 'boolean' | 'date' | 'map' | 'number' | 'object' | 'set' | 'string'
type StorageFlush = NonNullable<WatchOptions['flush']>

export type StorageEventFilter = (invoke: () => void | Promise<void>) => void | Promise<void>

export interface StorageSerializer<T> {
  read: (raw: string) => Awaitable<T>
  write: (value: T) => Awaitable<string>
}

export interface UseStorageLocalOptions<T> {
  deep?: boolean
  eventFilter?: StorageEventFilter
  flush?: StorageFlush
  listenToStorageChanges?: boolean
  mergeDefaults?: boolean | ((storedValue: T, defaults: T) => T)
  onError?: (error: unknown) => void
  onReady?: (value: T) => void
  serializer?: StorageSerializer<T>
  shallow?: boolean
  writeDefaults?: boolean
}

export type StorageRef<T> = Omit<Ref<T>, 'value'> & {
  get value(): T
  set value(value: T | null | undefined)
}

export interface StorageRefExtra<T> extends StorageRef<T> {
  readyPromise: Promise<void>
  setAndPersist: (value: T) => Promise<void>
}

export function normalizeStorageError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/QUOTA_BYTES|quota exceeded|exceeded storage quota|storage quota/i.test(message)) {
    const e = new Error(error instanceof Error ? error.message : message)
    ;(e as any).code = 'ERR_STORAGE_QUOTA'
    return e
  }
  return error instanceof Error ? error : new Error(message)
}

const storageSerializers: Record<SerializerType, StorageSerializer<any>> = {
  boolean: {
    read: raw => raw === 'true',
    write: value => String(value),
  },
  object: {
    read: raw => JSON.parse(raw),
    write: value => JSON.stringify(value),
  },
  number: {
    read: raw => Number.parseFloat(raw),
    write: value => String(value),
  },
  any: {
    read: raw => raw,
    write: value => String(value),
  },
  string: {
    read: raw => raw,
    write: value => String(value),
  },
  map: {
    read: raw => new Map(JSON.parse(raw)),
    write: value => JSON.stringify(Array.from(value.entries())),
  },
  set: {
    read: raw => new Set(JSON.parse(raw)),
    write: value => JSON.stringify(Array.from(value)),
  },
  date: {
    read: raw => new Date(raw),
    write: value => value.toISOString(),
  },
}

function guessSerializerType(value: unknown): SerializerType {
  if (value == null)
    return 'any'

  if (value instanceof Set)
    return 'set'

  if (value instanceof Map)
    return 'map'

  if (value instanceof Date)
    return 'date'

  if (typeof value === 'boolean')
    return 'boolean'

  if (typeof value === 'string')
    return 'string'

  if (typeof value === 'object')
    return 'object'

  if (!Number.isNaN(value))
    return 'number'

  return 'any'
}

function tryOnScopeDispose(fn: () => void) {
  if (getCurrentScope())
    onScopeDispose(fn)
}

function cloneValue<T>(value: T): T {
  if (typeof value !== 'object' || value == null)
    return value

  const normalizedValue = isProxy(value) ? toRaw(value) : value

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(normalizedValue)
    }
    catch {
      // Fall through to JSON cloning for reactive proxies and other non-cloneable values.
    }
  }

  try {
    return JSON.parse(JSON.stringify(normalizedValue)) as T
  }
  catch {
    return normalizedValue
  }
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function createInitialValue<T>(value: MaybeRef<T>): T {
  return cloneValue(toValue(value))
}

async function deserializeStoredValue<T>(rawValue: unknown, serializer: StorageSerializer<T>): Promise<T> {
  if (typeof rawValue === 'string')
    return await serializer.read(rawValue)

  return rawValue as T
}

function mergeStoredValue<T>(storedValue: T, defaults: T, mergeDefaults: UseStorageLocalOptions<T>['mergeDefaults']): T {
  if (!mergeDefaults)
    return storedValue

  if (typeof mergeDefaults === 'function')
    return mergeDefaults(storedValue, defaults)

  if (isObjectLike(storedValue) && isObjectLike(defaults))
    return { ...defaults, ...storedValue } as T

  return storedValue
}

function createStorageRef<T>(value: T, useShallow: boolean): StorageRef<T> {
  return (useShallow ? shallowRef(value) : ref(value)) as StorageRef<T>
}

function runWithFilter(eventFilter: StorageEventFilter | undefined, invoke: () => void | Promise<void>) {
  if (eventFilter) {
    void eventFilter(invoke)
    return
  }

  void invoke()
}

/**
 * Serial write queue to prevent concurrent storage.local.set calls.
 * Writes are executed one at a time in FIFO order.
 */
class WriteQueue {
  private queue: Array<() => Promise<void>> = []
  private running = false

  enqueue(task: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await task()
          resolve()
        }
        catch (e) {
          reject(e)
        }
      })
      this.flush()
    })
  }

  private async flush() {
    if (this.running)
      return
    this.running = true
    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      await task()
    }
    this.running = false
  }
}

const globalWriteQueue = new WriteQueue()

export function useStorageLocal<T>(key: string, initialValue: MaybeRef<T>, options?: UseStorageLocalOptions<T>): StorageRefExtra<T> {
  const {
    flush = 'pre',
    deep = true,
    listenToStorageChanges = true,
    writeDefaults = true,
    mergeDefaults = false,
    shallow = false,
    eventFilter,
    onError = (error) => {
      console.error(error)
    },
    onReady,
    serializer: customSerializer,
  } = options ?? {}

  const initial = createInitialValue(initialValue)
  const serializer = (customSerializer ?? storageSerializers[guessSerializerType(initial)]) as StorageSerializer<T>
  const data = createStorageRef(createInitialValue(initialValue), shallow)

  let ready = false
  let dirtyBeforeReady = false
  let hasStoredValue = false
  let syncStarted = false
  let activeWatcher: ReturnType<typeof watch> | null = null
  let scopeDisposed = false
  const pendingOwnStorageChanges: unknown[] = []

  const normalizePendingStorageValue = (value: unknown) => value ?? null

  const enqueuePendingOwnStorageChange = (value: unknown) => {
    pendingOwnStorageChanges.push(normalizePendingStorageValue(value))
    if (pendingOwnStorageChanges.length > 20)
      pendingOwnStorageChanges.shift()
  }

  const consumePendingOwnStorageChange = (value: unknown) => {
    const normalizedValue = normalizePendingStorageValue(value)
    const index = pendingOwnStorageChanges.findIndex(pendingValue => Object.is(pendingValue, normalizedValue))
    if (index === -1)
      return false

    pendingOwnStorageChanges.splice(index, 1)
    return true
  }

  const stopDirtyWatch = watch(
    data,
    () => {
      if (!ready)
        dirtyBeforeReady = true
    },
    { deep, flush: 'sync' },
  )

  /**
   * Write to storage.local via the serial queue.
   * Creates a stable snapshot of the value before enqueuing.
   * Only updates memory ref on success.
   */
  const persistValue = async (valueToPersist: T | null | undefined, updateMemory: boolean): Promise<void> => {
    const serializedValue = valueToPersist == null
      ? null
      : await serializer.write(valueToPersist)

    enqueuePendingOwnStorageChange(serializedValue ?? null)

    await globalWriteQueue.enqueue(async () => {
      try {
        if (valueToPersist == null) {
          await browser.storage.local.remove(key)
        }
        else {
          await browser.storage.local.set({ [key]: serializedValue })
        }
      }
      catch (error) {
        consumePendingOwnStorageChange(serializedValue ?? null)
        throw normalizeStorageError(error)
      }
    })

    // Only update memory ref after successful write
    if (updateMemory)
      updateMemoryWithoutPersisting(valueToPersist as T)
  }

  function createSyncWatcher() {
    return watch(
      data,
      () => {
        if (!ready)
          return

        const snapshot = cloneValue(data.value)
        runWithFilter(eventFilter, async () => {
          try {
            await persistValue(snapshot, false)
          }
          catch (error) {
            onError(error)
          }
        })
      },
      { flush, deep },
    )
  }

  function updateMemoryWithoutPersisting(value: T) {
    const shouldRestartWatcher = syncStarted && activeWatcher != null && !scopeDisposed
    activeWatcher?.()
    activeWatcher = null
    data.value = value
    if (shouldRestartWatcher)
      activeWatcher = createSyncWatcher()
  }

  const startSync = () => {
    if (syncStarted)
      return

    syncStarted = true
    activeWatcher = createSyncWatcher()
    tryOnScopeDispose(() => {
      scopeDisposed = true
      activeWatcher?.()
      activeWatcher = null
    })

    if (listenToStorageChanges) {
      const onChanged = async (changes: Record<string, browser.Storage.StorageChange>, areaName: string) => {
        if (areaName !== 'local' || !(key in changes))
          return

        const change = changes[key]

        try {
          if (consumePendingOwnStorageChange(change.newValue))
            return

          if (change.newValue == null) {
            updateMemoryWithoutPersisting(createInitialValue(initialValue) as T)
          }
          else {
            const storedValue = await deserializeStoredValue(change.newValue, serializer)
            updateMemoryWithoutPersisting(cloneValue(mergeStoredValue(storedValue, createInitialValue(initialValue), mergeDefaults)))
          }
        }
        catch (error) {
          onError(error)
        }
      }

      browser.storage.onChanged.addListener(onChanged)
      tryOnScopeDispose(() => browser.storage.onChanged.removeListener(onChanged))
    }
  }

  let readyResolver!: () => void
  const readyPromise = new Promise<void>((resolve) => {
    readyResolver = () => resolve()
  })

  void (async () => {
    try {
      const result = await browser.storage.local.get(key)
      const rawStoredValue = result[key]
      hasStoredValue = rawStoredValue != null

      if (rawStoredValue == null) {
        if (!dirtyBeforeReady)
          data.value = createInitialValue(initialValue) as T
      }
      else {
        const storedValue = await deserializeStoredValue(rawStoredValue, serializer)
        data.value = cloneValue(mergeStoredValue(storedValue, createInitialValue(initialValue), mergeDefaults))
      }
    }
    catch (error) {
      onError(error)
    }
    finally {
      ready = true
      stopDirtyWatch()
    }

    try {
      if (!hasStoredValue && (dirtyBeforeReady || writeDefaults) && data.value != null)
        await persistValue(data.value, false)
    }
    catch (error) {
      onError(error)
    }

    onReady?.(data.value)
    startSync()
    readyResolver()
  })()

  async function setAndPersist(value: T): Promise<void> {
    if (!ready)
      await readyPromise

    // Create a stable snapshot before enqueuing
    const snapshot = cloneValue(value)
    await persistValue(snapshot, true)
  }

  const result = data as StorageRefExtra<T>
  result.readyPromise = readyPromise
  result.setAndPersist = setAndPersist
  return result
}
