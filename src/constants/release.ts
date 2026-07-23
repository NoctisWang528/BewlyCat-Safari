import { safariRevision, version } from '../../package.json'

export const SAFARI_REPOSITORY_URL = 'https://github.com/NoctisWang528/BewlyCat-Safari'
export const SAFARI_RELEASES_URL = `${SAFARI_REPOSITORY_URL}/releases`
export const SAFARI_LATEST_RELEASE_API_URL = 'https://api.github.com/repos/NoctisWang528/BewlyCat-Safari/releases/latest'
export const UPSTREAM_REPOSITORY_URL = 'https://github.com/keleus/BewlyCat'
export const SAFARI_VERSION = `${version}-safari.${safariRevision}`
export const SAFARI_TAG = `v${SAFARI_VERSION}`
