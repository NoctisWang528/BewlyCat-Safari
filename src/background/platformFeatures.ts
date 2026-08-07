interface OptionalBackgroundFeatureSetups {
  setupLoginStateWatcher: () => void
  setupSettingsCloudSync: () => void
}

/** Safari 不支持跨设备 storage.sync 与 cookies.onChanged，因此只在其他平台初始化。 */
export function setupOptionalBackgroundFeatures(
  isSafariBuild: boolean,
  setups: OptionalBackgroundFeatureSetups,
) {
  if (isSafariBuild)
    return

  setups.setupSettingsCloudSync()
  setups.setupLoginStateWatcher()
}
