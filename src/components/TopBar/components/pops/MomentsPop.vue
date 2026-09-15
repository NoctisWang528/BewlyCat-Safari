<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Empty from '~/components/Empty.vue'
import Icon from '~/components/Icon.vue'
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

function isVideoMoment(moment: TopBarMomentItem) {
  return moment.isVideo
}

function getWatchLaterTarget(moment: TopBarMomentItem) {
  const aid = Number.isSafeInteger(moment.aid) && Number(moment.aid) > 0 ? Number(moment.aid) : undefined
  const bvid = typeof moment.bvid === 'string' && moment.bvid.trim() ? moment.bvid.trim() : undefined
  return { aid, bvid }
}

function getWatchLaterKey(moment: TopBarMomentItem) {
  const { aid, bvid } = getWatchLaterTarget(moment)
  return bvid ? `bvid:${bvid}` : aid ? `aid:${aid}` : ''
}

function isInWatchLater(moment: TopBarMomentItem) {
  const { aid, bvid } = getWatchLaterTarget(moment)
  return Boolean((aid && topBarStore.addedWatchLaterList.includes(aid)) || (bvid && topBarStore.addedWatchLaterBvids.has(bvid)))
}

async function toggleWatchLater(moment: TopBarMomentItem) {
  if (!isVideoMoment(moment))
    return
  const { aid, bvid } = getWatchLaterTarget(moment)
  const key = getWatchLaterKey(moment)
  const csrf = getCSRF()
  if ((!aid && !bvid) || !key || !csrf || pendingWatchLaterKeys.has(key))
    return
  pendingWatchLaterKeys.add(key)
  try {
    if (!isInWatchLater(moment)) {
      const res = await api.watchlater.saveToWatchLater({ csrf, ...(aid ? { aid } : {}), ...(bvid ? { bvid } : {}) })
      if (res?.code === 0) {
        if (aid && !topBarStore.addedWatchLaterList.includes(aid))
          topBarStore.addedWatchLaterList.push(aid)
        if (bvid)
          topBarStore.addedWatchLaterBvids.add(bvid)
      }
    }
    else {
      let resolvedAid = aid
      if (!resolvedAid && bvid) {
        resolvedAid = Number((await api.video.getVideoInfo({ bvid }))?.data?.aid) || undefined
        if (resolvedAid)
          moment.aid = resolvedAid
      }
      if (!resolvedAid)
        return
      const res = await api.watchlater.removeFromWatchLater({ aid: resolvedAid, csrf })
      if (res?.code === 0) {
        const index = topBarStore.addedWatchLaterList.indexOf(resolvedAid)
        if (index >= 0)
          topBarStore.addedWatchLaterList.splice(index, 1)
        if (bvid)
          topBarStore.addedWatchLaterBvids.delete(bvid)
      }
    }
    void topBarStore.syncWatchLaterState()
  }
  catch (error) {
    console.error('[BewlyCat] 切换动态稍后再看失败:', error)
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
    h="[calc(100vh-100px)]" max-h-500px
    important-overflow-y-overlay
    bg="$bew-elevated"
    w="380px"
    pos="relative"
    shadow="$bew-shadow-3"
    border="1 $bew-popover-border-color"
    class="moments-pop bew-popover"
    data-key="moments"
    flex="~ col"
  >
    <!-- top bar -->
    <header
      flex="~ items-center justify-between"
      p="x-6 y-5"
      pos="sticky top-0 left-0"
      w="full"
      z="2"
    >
      <div flex="~">
        <div
          v-for="tab in momentTabs"
          :key="tab.type"
          m="r-4"
          transition="background-color duration-200, color duration-200, opacity duration-200"
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
      overflow-x-hidden
      overflow-y-auto
      p="x-3"
      flex="~ col gap-2"
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
        z="0" w="full" h="full"
        flex="~ items-center"
      />

      <!-- moments -->
      <TransitionGroup name="list">
        <ALink
          v-for="(moment, index) in topBarStore.moments"
          :key="moment.id_str"
          :href="moment.link"
          type="topBar"
          class="group bew-content-card"
          m="last:b-4" p="2"
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
          <section flex="~ row-reverse gap-4 items-stretch">
            <div class="bew-top-bar-media-copy moments-pop__copy">
              <h3
                :title="moment.title"
                class="bew-top-bar-media-title moments-pop__title"
              >
                {{ moment.title }}
              </h3>

              <div class="moments-pop__byline" flex="~ items-center gap-1" min-w-0>
                <ALink
                  :href="moment.authorJumpUrl"
                  type="topBar"
                  :stop-propagation="true"
                  rounded="1/2"
                  w="24px" h="24px"
                  bg="$bew-skeleton"
                  flex="~ items-center justify-center"
                  shrink-0
                >
                  <img
                    :src="`${moment.authorFace}@48w_48h_1c`"
                    rounded="1/2"
                    w="20px" h="20px"
                  >
                </ALink>

                <div
                  class="bew-top-bar-media-author--compact moments-pop__author"
                  min-w-0
                  flex-1
                >
                  <!-- 联合投稿显示多个作者 -->
                  <template v-if="moment.isCollaborative && moment.authors">
                    <template v-for="(author, idx) in moment.authors" :key="author.jump_url">
                      <ALink
                        :href="author.jump_url"
                        type="topBar"
                        :stop-propagation="true"
                        class="bew-top-bar-media-author"
                      >
                        {{ author.name }}
                      </ALink>
                      <span v-if="Number(idx) < moment.authors.length - 1" text="$bew-text-2">/</span>
                    </template>
                  </template>
                  <!-- 单个作者 -->
                  <ALink
                    v-else
                    :href="moment.authorJumpUrl"
                    type="topBar"
                    :stop-propagation="true"
                    class="bew-top-bar-media-author"
                  >
                    {{ moment.author }}
                  </ALink>
                </div>

                <div
                  class="bew-top-bar-media-meta"
                  shrink-0
                  whitespace-nowrap
                >
                  <!-- publish time -->
                  <span v-if="selectedMomentTab.type !== 'live'" text="$bew-text-2">
                    {{ moment.pubTime }}
                  </span>

                  <!-- Live -->
                  <span
                    v-else
                    text="$bew-theme-color"
                    font="semibold"
                    flex="~ items-center"
                  >
                    <span i-fluent:live-24-filled m="r-1" />
                    {{ $t('topbar.moments_dropdown.live_status') }}
                  </span>
                </div>
              </div>
            </div>

            <div
              class="bew-top-bar-media-column bew-top-bar-media-column--narrow moments-pop__cover"
              bg="$bew-skeleton"
              pos="relative"
            >
              <div
                class="bew-top-bar-media-frame"
                flex="~ items-center justify-center"
              >
                <img
                  :src="`${moment.cover}@240w_135h_1c`"
                  :alt="moment.title"
                >
              </div>
              <div
                v-if="isVideoMoment(moment) && getWatchLaterKey(moment)"
                class="moments-pop__watch-later"
                opacity-0 group-hover:opacity-100
                pos="absolute top-0 right-0"
                m="1"
                z-2
                duration-300
              >
                <Tooltip
                  :content="isInWatchLater(moment)
                    ? $t('common.added')
                    : $t('common.save_to_watch_later')"
                  placement="left"
                  type="dark"
                >
                  <div
                    w="24px" h="24px"
                    class="moment-watch-later-toggle"
                    grid="~ place-items-center"
                    bg="black opacity-60"
                    rounded="$bew-radius-half"
                    color-white
                    @click.stop.prevent="toggleWatchLater(moment)"
                  >
                    <Icon
                      v-if="pendingWatchLaterKeys.has(getWatchLaterKey(moment))"
                      icon="line-md:loading-twotone-loop"
                    />
                    <Icon
                      v-else-if="isInWatchLater(moment)"
                      icon="line-md:confirm"
                    />
                    <div v-else i-mingcute:carplay-line />
                  </div>
                </Tooltip>
              </div>
            </div>
          </section>
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
  font-weight: var(--bew-font-weight-semibold);

  &::after {
    --uno: "absolute bottom-0 left-0 w-full h-12px bg-$bew-theme-color opacity-0 transform scale-x-0 -z-1";
    --uno: "transition-colors duration-200";
    content: "";
  }
}

.tab-selected {
  --uno: "text-$bew-text-1";

  &::after {
    --uno: "scale-x-80 opacity-40";
  }
}

.moments-pop__cover {
  overflow: visible;
}

.moments-pop__copy {
  display: flex;
  flex-direction: column;
}

.moments-pop__byline {
  margin-top: auto;
  padding-top: var(--bew-space-1);
}

// 标题字号/行高沿用全局 --bew-top-bar-media-title-*（14/20，与收藏、历史、
// 稍后再看 Pop 共用），此处仅解除两行截断以完整展示。
.moments-pop .moments-pop__title {
  display: block;
  overflow: visible;
  text-overflow: unset;
  -webkit-line-clamp: unset;
  line-clamp: unset;
}

.moments-pop__author {
  display: block;
  overflow: hidden;
  font-weight: var(--bew-font-weight-regular);
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-line-clamp: unset;
  line-clamp: unset;
}

.moments-pop__watch-later :deep(.b-tooltip--placement-left) {
  top: 50%;
  transform: translateY(-50%);
}
</style>
