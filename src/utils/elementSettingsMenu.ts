import type { ContextMenuOption } from '~/components/ContextMenu.vue'
import type { SettingsNavigationTarget } from '~/composables/useAppProvider'
import { settings } from '~/logic'
import type { Settings } from '~/logic/storage'
import type { DockItem } from '~/stores/mainStore'
import { getBadgeType, getComponentConfig, isComponentVisible } from '~/utils/topBarBadge'

interface SettingsAction extends ContextMenuOption {
  run: () => void
}

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]
type ToggleDefinition = [key: BooleanSetting, title: string, icon?: string]

const toggles: ToggleDefinition[] = [
  ['showBewlyOrBiliPageSwitcher', 'settings.show_bewly_or_bili_page_switcher', 'i-mingcute:refresh-2-line'],
  ['showBewlyOrBiliPageSwitcherOnMorePages', 'settings.show_bewly_or_bili_page_switcher_on_more_pages', 'i-mingcute:refresh-2-line'],
  ['showHotSearchInTopBar', 'settings.show_hot_search_in_top_bar'],
  ['showSearchRecommendation', 'settings.show_search_recommendation'],
  ['autoHideTopBar', 'settings.auto_hide_top_bar'],
  ['enableGridLayoutSwitcher', 'settings.enable_grid_layout_switcher'],
  ['momentsSidebarShowUserCard', 'settings.moments_show_user_card'],
  ['momentsSidebarShowPublish', 'settings.moments_show_publish'],
  ['momentsSidebarShowLive', 'settings.moments_show_live'],
  ['momentsSidebarShowHotSearch', 'settings.moments_show_hot_search'],
  ['momentsShowUpList', 'settings.moments_show_up_list'],
  ['disableLightDarkModeSwitcherOnDock', 'settings.disable_light_dark_mode_switcher'],
  ['backToTopAndRefreshButtonsAreSeparated', 'settings.back_to_top_and_refresh_buttons_are_separated'],
  ['autoHideDock', 'settings.auto_hide_dock'],
  ['halfHideDock', 'settings.half_hide_dock'],
  ['disableDockGlowingEffect', 'settings.disable_dock_glowing_effect'],
  ['alwaysShowDockActionsWhenAutoHide', 'settings.always_show_dock_actions_when_auto_hide'],
  ['autoHideSidebar', 'settings.auto_hide_sidebar'],
  ['hideTopBarUserPanelLv6LastLoginLocation', 'settings.hide_lv6_last_login_location_in_top_bar_user_pop'],
]

const components = [
  ['moments', 'topbar.moments', 'i-tabler:windmill'],
  ['favorites', 'topbar.favorites', 'i-mingcute:star-line'],
  ['history', 'topbar.history', 'i-mingcute:time-line'],
  ['watchLater', 'topbar.watch_later', 'i-mingcute:carplay-line'],
  ['creatorCenter', 'topbar.creative_center', 'i-mingcute:bulb-line'],
  ['upload', 'topbar.upload', 'i-mingcute:upload-line'],
  ['notifications', 'topbar.notifications', 'i-tabler:bell'],
  ['topBarSwitcher', 'topbar.top_bar_switcher', 'i-mingcute:refresh-2-line'],
] as const

export function getElementSettingsActions(
  target: SettingsNavigationTarget,
  translate: (key: string) => string,
  elementKey?: string,
  dockItems: DockItem[] = [],
): SettingsAction[] {
  const actions: SettingsAction[] = []
  const title = target.targetTitleKey
  const topBar = target.secondaryPage === 'topbar'
  const dockContainer = target.secondaryPage === 'dock' && title === 'settings.group_dock'
  const topBarContainer = topBar && ['settings.topbar_visibility', 'settings.topbar_actions'].includes(title ?? '')

  for (const [key, label, icon] of toggles) {
    const inGroup = (topBarContainer && ['showBewlyOrBiliPageSwitcher', 'autoHideTopBar'].includes(key))
      || (topBar && title === 'settings.show_hot_search_in_top_bar' && key === 'showSearchRecommendation')
      || (dockContainer && ['autoHideDock', 'halfHideDock', 'disableLightDarkModeSwitcherOnDock', 'disableDockGlowingEffect', 'alwaysShowDockActionsWhenAutoHide'].includes(key))
      || (title === 'settings.group_sidebar' && key === 'autoHideSidebar')
      || (topBar && title === 'settings.topbar_user_menu' && key === 'hideTopBarUserPanelLv6LastLoginLocation')
    if (title !== label && !inGroup)
      continue

    actions.push({
      value: key,
      label: translate(label),
      icon: icon ?? 'i-mingcute:settings-3-line',
      checked: settings.value[key],
      run: () => { settings.value[key] = !settings.value[key] },
    })
  }

  if (target.secondaryPage === 'dock') {
    if (dockContainer || title === 'settings.group_sidebar') {
      const positionKey = dockContainer ? 'dockPosition' : 'sidebarPosition'
      const positions = dockContainer ? ['left', 'right', 'bottom'] as const : ['left', 'right'] as const
      for (const position of positions) {
        actions.push({
          value: `position:${position}`,
          type: 'radio',
          label: `${translate(dockContainer ? 'settings.dock_position' : 'settings.sidebar_position')} · ${translate(`common.position.${position}`)}`,
          icon: 'i-mingcute:layout-line',
          checked: settings.value[positionKey] === position,
          run: () => {
            if (dockContainer)
              settings.value.dockPosition = position
            else if (position !== 'bottom')
              settings.value.sidebarPosition = position
          },
        })
      }
    }

    for (const item of dockItems) {
      const isItemTarget = elementKey === `dock-navigation-${item.page}`
      if (!dockContainer && !isItemTarget)
        continue

      const ensureConfig = () => {
        if (!settings.value.dockItemsConfig.some(config => config.page === item.page)) {
          settings.value.dockItemsConfig = [...settings.value.dockItemsConfig, {
            page: item.page,
            visible: true,
            openInNewTab: false,
            useOriginalBiliPage: item.useOriginalBiliPage,
          }]
        }
        return settings.value.dockItemsConfig.find(config => config.page === item.page)!
      }
      const config = settings.value.dockItemsConfig.find(config => config.page === item.page)
      const fields = isItemTarget
        ? ['visible', 'openInNewTab', ...(item.hasBewlyPage ? ['useOriginalBiliPage'] as const : [])] as const
        : ['visible'] as const
      const labels = {
        visible: dockContainer ? item.i18nKey : 'settings.visibility',
        openInNewTab: 'settings.dock_item_open_in_new_tab',
        useOriginalBiliPage: 'settings.dock_item_use_original_bili_web_page',
      }
      for (const field of fields) {
        actions.push({
          value: `dock:${item.page}:${field}`,
          label: translate(labels[field]),
          icon: item.icon,
          checked: config?.[field] ?? (field === 'visible' || (field === 'useOriginalBiliPage' && item.useOriginalBiliPage)),
          run: () => {
            const config = ensureConfig()
            config[field] = !config[field]
          },
        })
      }
    }
  }

  if (!topBar)
    return actions

  for (const [key, label, icon] of components) {
    if (title !== label && !topBarContainer)
      continue

    const ensureConfig = () => {
      let config = getComponentConfig(key)
      if (!config) {
        config = { key, visible: true, badgeType: getBadgeType(key) }
        settings.value.topBarComponentsConfig = [...(settings.value.topBarComponentsConfig ?? []), config]
      }
      // Read through the settings proxy so first-time changes are persisted too.
      return getComponentConfig(key)!
    }
    actions.push({
      value: `visible:${key}`,
      label: topBarContainer ? translate(label) : translate('settings.visibility'),
      icon,
      checked: isComponentVisible(key),
      run: () => { ensureConfig().visible = !isComponentVisible(key) },
    })
    if (title === label && ['moments', 'watchLater', 'notifications'].includes(key)) {
      const badgeTypes = key === 'notifications'
        ? ['number', 'numberWithLikes', 'dot', 'none'] as const
        : ['number', 'dot', 'none'] as const
      const currentBadge = key === 'notifications' && getBadgeType(key) === 'number' && settings.value.showLikeNotificationReminder
        ? 'numberWithLikes'
        : getBadgeType(key)
      for (const badgeType of badgeTypes) {
        actions.push({
          value: `badge:${badgeType}`,
          type: 'radio',
          label: `${translate('settings.badge_type')} · ${translate(`settings.top_bar_icon_badges_opt.${badgeType === 'numberWithLikes' ? 'number_with_likes' : badgeType}`)}`,
          icon: 'i-mingcute:notification-line',
          checked: currentBadge === badgeType,
          run: () => {
            ensureConfig().badgeType = badgeType === 'numberWithLikes' ? 'number' : badgeType
            if (key === 'notifications')
              settings.value.showLikeNotificationReminder = badgeType === 'numberWithLikes'
          },
        })
      }
    }
  }
  return actions
}
