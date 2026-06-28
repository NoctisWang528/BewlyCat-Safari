export interface TopBarMomentItem {
  type: string
  title: string
  author: string
  authorFace: string
  authorJumpUrl?: string
  pubTime?: string
  cover?: string
  link?: string
  aid?: number
  bvid?: string
  isVideo: boolean
  isCollaborative?: boolean
  authors?: any[]
  /** @deprecated 保留作为兼容字段，新代码请使用 aid / bvid */
  rid?: number
}

export interface MomentVideoIdentifier {
  aid?: number
  bvid?: string
}

function normalizeAid(value: unknown): number | undefined {
  const aid = Number(value)
  return Number.isSafeInteger(aid) && aid > 0 ? aid : undefined
}

function normalizeBvid(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined

  const bvid = value.trim()
  return /^BV[0-9A-Za-z]{6,}$/.test(bvid) ? bvid : undefined
}

function extractBvidFromUrl(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined

  return normalizeBvid(value.match(/\/(BV[0-9A-Za-z]+)/)?.[1])
}

export function extractMomentVideoIdentifier(item: any): MomentVideoIdentifier {
  const archive = item?.modules?.module_dynamic?.major?.archive

  const aid = [
    archive?.aid,
    item?.aid,
    item?.rid,
    item?.basic?.rid_str,
  ]
    .map(normalizeAid)
    .find((value): value is number => value !== undefined)

  const bvid = [
    normalizeBvid(archive?.bvid),
    normalizeBvid(item?.bvid),
    extractBvidFromUrl(item?.jump_url),
    extractBvidFromUrl(archive?.jump_url),
  ].find((value): value is string => value !== undefined)

  return { aid, bvid }
}
