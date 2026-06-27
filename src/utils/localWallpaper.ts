/**
 * 本地壁纸管理工具
 * 将图片base64存储在本地storage的单独项中，设置里只保存引用
 */

import type { StorageRefExtra } from '~/composables/useStorageLocal'
import { useStorageLocal } from '~/composables/useStorageLocal'

const MAX_WALLPAPER_BYTES = 1_500_000
const MAX_WALLPAPER_COUNT = 8
let wallpaperMutationQueue: Promise<void> = Promise.resolve()

export class WallpaperTooLargeError extends Error {
  code = 'ERR_WALLPAPER_TOO_LARGE'
  constructor(message: string = '图片过大，不建议直接保存到 storage.local') {
    super(message)
    this.name = 'WallpaperTooLargeError'
  }
}

export class WallpaperQuotaRiskError extends Error {
  code = 'ERR_WALLPAPER_QUOTA_RISK'
  constructor(message: string = '本地壁纸数量超出上限，请先删除旧壁纸') {
    super(message)
    this.name = 'WallpaperQuotaRiskError'
  }
}

function estimateBase64Bytes(base64: string): number {
  return Math.ceil(base64.length * 0.75)
}

// 本地壁纸数据接口
export interface LocalWallpaperData {
  id: string
  name: string
  base64: string
  size: number
  type: string
  lastModified: number
  timestamp: number
}

// 本地壁纸引用接口
export interface LocalWallpaperRef {
  id: string
  name: string
  isLocal: true
}

// 本地壁纸存储
const localWallpapers: StorageRefExtra<Record<string, LocalWallpaperData>> = useStorageLocal<Record<string, LocalWallpaperData>>('localWallpapers', {})

function enqueueWallpaperMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = wallpaperMutationQueue.then(operation, operation)
  wallpaperMutationQueue = result.then(() => undefined, () => undefined)
  return result
}

/**
 * 生成本地壁纸的唯一标识符
 */
export function generateWallpaperId(fileName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = fileName.split('.').pop() || ''
  return `wallpaper_${timestamp}_${random}.${extension}`
}

/**
 * 原子替换壁纸：删除旧壁纸并保存新壁纸为单次持久化操作。
 * storage.set 成功后才更新内存状态。失败时旧数据保持不变。
 */
export async function replaceLocalWallpaper(
  oldId: string | null | undefined,
  file: File,
  base64: string,
): Promise<LocalWallpaperRef> {
  return enqueueWallpaperMutation(async () => {
    await localWallpapers.readyPromise

    const current = localWallpapers.value || {}
    const nextMap: Record<string, LocalWallpaperData> = {}

    for (const key of Object.keys(current)) {
      if (key !== oldId)
        nextMap[key] = current[key]
    }

    if (Object.keys(nextMap).length >= MAX_WALLPAPER_COUNT)
      throw new WallpaperQuotaRiskError()

    if (estimateBase64Bytes(base64) > MAX_WALLPAPER_BYTES)
      throw new WallpaperTooLargeError()

    const id = generateWallpaperId(file.name)
    nextMap[id] = {
      id,
      name: file.name,
      base64,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      timestamp: Date.now(),
    }

    await localWallpapers.setAndPersist(nextMap)
    return { id, name: file.name, isLocal: true }
  })
}

/**
 * 存储本地壁纸（新增，不删除旧壁纸）
 */
export async function storeLocalWallpaper(file: File, base64: string): Promise<LocalWallpaperRef> {
  return enqueueWallpaperMutation(async () => {
    await localWallpapers.readyPromise

    const current = localWallpapers.value || {}

    if (Object.keys(current).length >= MAX_WALLPAPER_COUNT)
      throw new WallpaperQuotaRiskError()

    if (estimateBase64Bytes(base64) > MAX_WALLPAPER_BYTES)
      throw new WallpaperTooLargeError()

    const id = generateWallpaperId(file.name)
    const nextMap: Record<string, LocalWallpaperData> = { ...current }
    nextMap[id] = {
      id,
      name: file.name,
      base64,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      timestamp: Date.now(),
    }

    await localWallpapers.setAndPersist(nextMap)
    return { id, name: file.name, isLocal: true }
  })
}

/**
 * 获取本地壁纸的base64数据
 */
export function getLocalWallpaper(id: string): string | null {
  const wallpapers = localWallpapers.value || {}
  const wallpaper = wallpapers[id]
  return wallpaper?.base64 ?? null
}

/**
 * 删除本地壁纸（可等待持久化）
 */
export async function removeLocalWallpaper(id: string): Promise<void> {
  await enqueueWallpaperMutation(async () => {
    await localWallpapers.readyPromise

    const current = localWallpapers.value || {}
    if (!current[id])
      return

    const nextMap: Record<string, LocalWallpaperData> = {}
    for (const key of Object.keys(current)) {
      if (key !== id)
        nextMap[key] = current[key]
    }

    await localWallpapers.setAndPersist(nextMap)
  })
}

/**
 * 检查本地壁纸是否存在
 */
export function hasLocalWallpaper(id: string): boolean {
  const wallpapers = localWallpapers.value || {}
  return !!wallpapers[id]
}

/**
 * 获取所有本地壁纸的信息
 */
export function getAllLocalWallpapers(): LocalWallpaperData[] {
  const wallpapers = localWallpapers.value || {}
  return Object.values(wallpapers)
}

/**
 * 清理所有本地壁纸
 */
export async function clearAllLocalWallpapers(): Promise<void> {
  await enqueueWallpaperMutation(async () => {
    await localWallpapers.setAndPersist({})
  })
}

/**
 * 检查并清理过期的本地壁纸
 */
export async function cleanupExpiredWallpapers(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
  await enqueueWallpaperMutation(async () => {
    await localWallpapers.readyPromise

    const current = localWallpapers.value || {}
    const now = Date.now()
    const nextMap: Record<string, LocalWallpaperData> = {}

    for (const key of Object.keys(current)) {
      if (now - current[key].timestamp <= maxAge)
        nextMap[key] = current[key]
    }

    if (Object.keys(nextMap).length !== Object.keys(current).length)
      await localWallpapers.setAndPersist(nextMap)
  })
}

/**
 * 解析本地壁纸URL，获取实际的base64数据
 */
export function resolveWallpaperUrl(url: string): string | null {
  if (!url)
    return null

  if (url.startsWith('local-wallpaper:')) {
    const id = url.replace('local-wallpaper:', '')
    return getLocalWallpaper(id)
  }

  return url
}

/**
 * 检查是否为本地壁纸URL
 */
export function isLocalWallpaperUrl(url: string): boolean {
  return url.startsWith('local-wallpaper:')
}

/**
 * 从本地壁纸URL中提取ID
 */
export function extractWallpaperId(url: string): string | null {
  if (isLocalWallpaperUrl(url)) {
    return url.replace('local-wallpaper:', '')
  }
  return null
}
