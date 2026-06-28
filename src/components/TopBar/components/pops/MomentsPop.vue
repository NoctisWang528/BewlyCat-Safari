<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

import Empty from '~/components/Empty.vue'
import Loading from '~/components/Loading.vue'
import Tooltip from '~/components/Tooltip.vue'
import { useOptimizedScroll } from '~/composables/useOptimizedScroll'
import { settings } from '~/logic'
import { useTopBarStore } from '~/stores/topBarStore'
import api from '~/utils/api'
import { getCSRF, scrollToTop } from '~/utils/main'
import type { TopBarMomentItem } from '~/utils/momentVideoIdentifier'

type MomentType = 'video' | 'live' | 'article'
interface MomentTab { type: MomentType, name: any }

const topBarStore = useTopBarStore()

const { t } = useI18n()
const pendingWatchLaterKeys = reactive(new Set<string>())

const momentTabs = computed((): MomentTab[] => {
  return [
    {
      type: 'video',
      // 如果开启了过滤专栏，显示"视频"，否则显示"全部"
      name: settings.value.filterArticlesInMoments
        ? t('topbar.moments_dropdown.tabs.videos')
        : t('topbar.moments_dropdown.tabs.all'),
    },
    {
      type: 'live',
      name: t('topbar.moments_dropdown.tabs.live'),
    },
  ]
},
)
const selectedMomentTab = ref<MomentTab>(momentTabs.value[0])

const momentsWrap = ref<HTMLElement>()

watch(() => selectedMomentTab.value.type, (newVal, oldVal) => {
  if (newVal === oldVal)
    return

  if (momentsWrap.value)
    scrollToTop(momentsWrap.value)

  initData()
})

// 使用 useOptimizedScroll 处理滚动加载
function handleReachBottom() {
  if (topBarStore.isLoadingMoments || topBarStore.moments.length === 0)
    return

  getData()
}

useOptimizedScroll(
  momentsWrap,
  { onReachBottom: handleReachBottom },
  { bottomThreshold: 400, throttleDelay: 100 },
)

function onClickTab(tab: MomentTab) {
  // Prevent changing tab when loading, cuz it will cause a bug
  if (topBarStore.isLoadingMoments || tab.type === selectedMomentTab.value.type)
    return

  selectedMomentTab.value = tab
  // 移除这里的 initData() 调用，因为 watch 已经会处理
}

function initData() {
  topBarStore.initMomentsData(selectedMomentTab.value.type)
}

function getData() {
  topBarStore.getMomentsData(selectedMomentTab.value.type)
}

function getMomentWatchLaterTarget(moment: TopBarMomentItem) {
  const aid = Number.isSafeInteger(moment.aid) && Number(moment.aid) > 0
    ? Number(moment.aid)
    : undefined

  const bvid = typeof moment.bvid === 'string' && moment.bvid.trim()
    ? moment.bvid.trim()
    : undefined

  return { aid, bvid }
}

function getMomentWatchLaterKey(moment: TopBarMomentItem): string {
  const { aid, bvid } = getMomentWatchLaterTarget(moment)

  if (bvid)
    return `bvid:${bvid}`

  if (aid)
    return `aid:${aid}`

  return ''
}

function isMomentInWatchLater(moment: TopBarMomentItem): boolean {
  const { aid, bvid } = getMomentWatchLaterTarget(moment)

  return Boolean(
    (aid && topBarStore.addedWatchLaterList.includes(aid))
    || (bvid && topBarStore.addedWatchLaterBvids.has(bvid)),
  )
}

async function toggleWatchLater(moment: TopBarMomentItem) {
  if (!moment.isVideo)
    return

  const { aid, bvid } = getMomentWatchLaterTarget(moment)

  if (!aid && !bvid)
    return

  const key = getMomentWatchLaterKey(moment)
  if (!key || pendingWatchLaterKeys.has(key))
    return

  const csrf = getCSRF()
  if (!csrf)
    return

  const isInList = isMomentInWatchLater(moment)
  pendingWatchLaterKeys.add(key)

  try {
    if (!isInList) {
      const params: {
        aid?: number
        bvid?: string
        csrf: string
      } = { csrf }

      if (aid)
        params.aid = aid

      if (bvid)
        params.bvid = bvid

      const res = await api.watchlater.saveToWatchLater(params)

      if (res?.code === 0) {
        if (aid && !topBarStore.addedWatchLaterList.includes(aid))
          topBarStore.addedWatchLaterList.push(aid)

        if (!aid && bvid)
          topBarStore.addedWatchLaterBvids.add(bvid)
      }
    }
    else {
      let resolvedAid: number | undefined = aid

      // bvid-only: need to resolve aid from getVideoInfo for removal
      if (!resolvedAid && bvid) {
        const info = await api.video.getVideoInfo({ bvid })
        const infoAid = Number(info?.data?.aid)
        if (Number.isSafeInteger(infoAid) && infoAid > 0) {
          resolvedAid = infoAid
          moment.aid = resolvedAid
          moment.rid = resolvedAid
        }
        else {
          return
        }
      }

      if (!resolvedAid)
        return

      const res = await api.watchlater.removeFromWatchLater({
        aid: resolvedAid,
        csrf,
      })

      if (res?.code === 0) {
        const index = topBarStore.addedWatchLaterList.indexOf(resolvedAid)
        if (index >= 0)
          topBarStore.addedWatchLaterList.splice(index, 1)

        if (bvid)
          topBarStore.addedWatchLaterBvids.delete(bvid)
      }
    }
  }
  catch (error) {
    console.error('[BewlyCat] toggle moment watch later failed:', error)
  }
  finally {
    pendingWatchLaterKeys.delete(key)
  }
}

defineExpose({
  initData,
})
</script>

<template>
  <div
    style="backdrop-filter: var(--bew-filter-glass-1);" h="[calc(100vh-100px)]" max-h-500px
    important-overflow-y-overlay
    bg="$bew-elevated"
    w="380px"
    rounded="$bew-radius"
    pos="relative"
    shadow="[var(--bew-shadow-edge-glow-1),var(--bew-shadow-3)]"
    border="1 $bew-border-color"
    class="moments-pop bew-popover"
    data-key="moments"
    flex="~ col"
  >
    <!-- top bar -->
    <header
      flex="~ items-center justify-between"
      p="x-6"
      pos="sticky top-0 left-0"
      w="full"
      h-50px
      z="2"
    >
      <div flex="~">
        <div
          v-for="tab in momentTabs"
          :key="tab.type"
          m="r-4"
          transition="all duration-300"
          class="tab"
          :class="tab.type === selectedMomentTab.type ? 'tab-selected' : ''"
          cursor="pointer"
          @click="onClickTab(tab)"
        >
          {{ tab.name }}
        </div>
      </div>
      <ALink
        href="https://t.bilibili.com/"
        type="topBar"
        flex="~ items-center"
      >
        <span text="sm">{{ $t('common.view_all') }}</span>
      </ALink>
    </header>

    <!-- moments wrapper -->
    <main
      ref="momentsWrap"
      rounded="$bew-radius"
      overflow-y-auto
      p="x-4"
      flex-1
      min-h-0
    >
      <!-- loading -->
      <Loading
        v-if="topBarStore.isLoadingMoments && topBarStore.moments.length === 0"
        h="full"
        flex="~"
        items="center"
      />

      <!-- empty -->
      <Empty
        v-else-if="!topBarStore.isLoadingMoments && topBarStore.moments.length === 0"
        pos="absolute top-0 left-0"
        bg="$bew-content"
        z="0" w="full" h="full"
        flex="~ items-center"
        rounded="$bew-radius-half"
      />

      <!-- moments -->
      <TransitionGroup name="list">
        <ALink
          v-for="(moment, index) in topBarStore.moments"
          :key="index"
          :href="moment.link"
          type="topBar"
          flex="~ justify-between"
          m="b-2" p="2"
          rounded="$bew-radius"
          hover:bg="$bew-fill-2"
          duration-300
          pos="relative"
        >
          <!-- new moment dot -->
          <div
            v-if="topBarStore.isNewMoment(index) && selectedMomentTab.type === 'video'"
            rounded="full"
            w="8px"
            h="8px"
            m="-2"
            bg="$bew-theme-color"
            pos="absolute -top-12px -left-12px"
            style="box-shadow: 0 0 4px var(--bew-theme-color)"
          />
          <ALink
            :href="moment.authorJumpUrl"
            type="topBar"
            :stop-propagation="true"
            rounded="1/2"
            w="40px" h="40px" m="r-4"
            bg="$bew-skeleton"
            shrink-0
          >
            <img
              :src="`${moment.authorFace}@50w_50h_1c`"
              rounded="1/2"
              w="40px" h="40px"
            >
          </ALink>

          <div flex="~" justify="between" w="full">
            <div>
              <!-- <span v-if="selectedTab !== 1">{{ `${moment.name} ${t('topbar.moments_dropdown.uploaded')}` }}</span> -->
              <!-- <span v-else>{{ `${moment.name} ${t('topbar.moments_dropdown.now_streaming')}` }}</span> -->

              <!-- 联合投稿显示多个作者 -->
              <div v-if="moment.isCollaborative && moment.authors" flex="~ wrap" items="center" gap="1">
                <template v-for="(author, idx) in moment.authors" :key="author.jump_url">
                  <ALink
                    :href="author.jump_url"
                    type="topBar"
                    :stop-propagation="true"
                    font-bold
                  >
                    {{ author.name }}
                  </ALink>
                  <span v-if="idx < moment.authors.length - 1" text="$bew-text-2">/</span>
                </template>
              </div>
              <!-- 单个作者 -->
              <ALink
                v-else
                :href="moment.authorJumpUrl"
                type="topBar"
                :stop-propagation="true"
                font-bold
              >
                {{ moment.author }}
              </ALink>
              <div overflow-hidden text-ellipsis break-anywhere>
                {{ moment.title }}
              </div>
              <div
                text="$bew-text-2 sm"
                m="y-2"
              >
                <!-- publish time -->
                <div v-if="selectedMomentTab.type !== 'live'">
                  {{ moment.pubTime }}
                </div>

                <!-- Live -->
                <div
                  v-else
                  text="$bew-theme-color"
                  font="bold"
                  flex="~"
                  items="center"
                >
                  <div i-fluent:live-24-filled m="r-2" />
                  {{ $t('topbar.moments_dropdown.live_status') }}
                </div>
              </div>
            </div>
            <div
              class="group"
              flex="~ items-center justify-center" w="82px"
              h="46px" m="l-4" shrink-0
              rounded="$bew-radius-half"
              bg="$bew-skeleton"
            >
              <img
                :src="`${moment.cover}@128w_72h_1c`"
                w="82px" h="46px"
                rounded="$bew-radius-half"
              >
              <!-- 稍后再看悬浮按钮 -->
              <div
                v-if="moment.isVideo && getMomentWatchLaterKey(moment)"
                class="moment-watch-later-toggle"
                opacity-0 group-hover:opacity-100
                pos="absolute" duration-300 bg="black opacity-60"
                rounded="$bew-radius-half" p-1
                z-1 color-white
                @click.prevent.stop="toggleWatchLater(moment)"
              >
                <Icon v-if="pendingWatchLaterKeys.has(getMomentWatchLaterKey(moment))" icon="line-md:loading-twotone-loop" />
                <Tooltip v-else-if="!isMomentInWatchLater(moment)" :content="$t('common.save_to_watch_later')" placement="bottom" type="dark">
                  <div i-mingcute:carplay-line />
                </Tooltip>
                <Tooltip v-else :content="$t('common.added')" placement="bottom" type="dark">
                  <Icon icon="line-md:confirm" />
                </Tooltip>
              </div>
            </div>
          </div>
        </ALink>
      </TransitionGroup>

      <!-- loading -->
      <Transition name="fade">
        <Loading v-if="topBarStore.isLoadingMoments && topBarStore.moments.length !== 0" m="b-4" />
      </Transition>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  --uno: "relative text-$bew-text-2";

  &::after {
    --uno: "absolute bottom-0 left-0 w-full h-12px bg-$bew-theme-color opacity-0 transform scale-x-0 -z-1";
    --uno: "transition-all duration-300";
    content: "";
  }
}

.tab-selected {
  --uno: "font-bold text-$bew-text-1";

  &::after {
    --uno: "scale-x-80 opacity-40";
  }
}
</style>
