import { AppBottomSheet } from '@/components/app-bottom-sheet';
import Constants from 'expo-constants';
import { type Href, useRouter } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppDialog, type DialogAction } from '@/components/app-dialog';
import { AppText } from '@/components/app-text';
import { ImageModelPicker } from '@/components/image-model-picker';
import { ModelPicker } from '@/components/model-picker';
import { OcrLanguagePicker } from '@/components/ocr-language-picker';
import { ModelDownloadCard } from '@/components/model-download-card';
import { useModelDownloadStore } from '@/store/model-download-store';
import { stopAllModelDownloads } from '@/services/model-download';
import { ScheduleEditor } from '@/components/schedule-editor';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ScanLookback } from '@/components/scan-lookback';
import { SettingsRow } from '@/components/settings-row';
import { SectionHero } from '@/components/section-hero';
import { getDeviceSpecs, type DeviceSpecs } from '@/services/device-specs';
import { FINLIFE_LLM } from '@/services/llm-config';
import { formatWindows } from '@/services/llm-schedule';
import {
  downloadSelectedModel,
  getModelAvailability,
  getModelRamState,
  unloadModelFromMemory,
} from '@/services/llm-service';
import { MODEL_SOURCE_ORG, getCatalogModel, resolveModelSources, type ModelId } from '@/services/model-catalog';
import {
  cacheNameFromUrl,
  countPteFiles,
  getModelStorageInfo,
  hasCachedSources,
  listRemovableLanguageModels,
  removeCachedModelSources,
} from '@/services/model-storage';
import { resetLocalData } from '@/services/reset-local-data';
import {
  downloadTextToImage,
  hasCachedTextToImage,
  isTextToImageAvailable,
  removeCachedTextToImage,
} from '@/services/text-to-image';
import { TTI_MODEL_NAME, TTI_VARIANTS, getTtiVariant, type TtiVariantId } from '@/services/text-to-image-catalog';
import { requestReminderPermission, syncPlanReminders, clearPlanReminders } from '@/services/reminders';
import { describeSmsAccess, requestSmsPermission } from '@/services/sms-inbox';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import { formatBytes } from '@/utils/format-bytes';

function storageLine() {
  const storage = getModelStorageInfo();
  if (storage.totalBytes <= 0) {
    return 'Not downloaded yet';
  }
  return `${formatBytes(storage.totalBytes)} · ${storage.files.length} files`;
}

export function Settings() {
  const router = useRouter();
  const privacyOn = useSettingsStore((s) => s.privacyOn);
  const remindersOn = useSettingsStore((s) => s.remindersOn);
  const modelId = useSettingsStore((s) => s.modelId);
  const ttiVariantId = useSettingsStore((s) => s.ttiVariantId);
  const customModelUrl = useSettingsStore((s) => s.customModelUrl);
  const customTokenizerUrl = useSettingsStore((s) => s.customTokenizerUrl);
  const customTokenizerConfigUrl = useSettingsStore((s) => s.customTokenizerConfigUrl);
  const windows = useSettingsStore((s) => s.windows);
  const scanLookbackMonths = useSettingsStore((s) => s.scanLookbackMonths);
  const googleAccount = useSettingsStore((s) => s.googleAccount);
  const setGoogleAccount = useSettingsStore((s) => s.setGoogleAccount);
  const setPrivacyOn = useSettingsStore((s) => s.setPrivacyOn);
  const setRemindersOn = useSettingsStore((s) => s.setRemindersOn);
  const setScanLookbackMonths = useSettingsStore((s) => s.setScanLookbackMonths);
  const setToast = useUiStore((s) => s.setToast);
  const modelInRam = useUiStore((s) => s.modelInRam);
  const imageInRam = useUiStore((s) => s.imageInRam);
  const downloading = useModelDownloadStore((s) => s.kind != null);
  const processing = useUiStore((s) => s.isProcessing);

  const [modelStatus, setModelStatus] = useState('Checking on-device model…');
  const [modelPath, setModelPath] = useState('Checking download folder…');
  const [modelDisk, setModelDisk] = useState('Not downloaded yet');
  const [deviceLine, setDeviceLine] = useState('Reading device…');
  const [chipLine, setChipLine] = useState('—');
  const [ramLine, setRamLine] = useState('—');
  const [smsLine, setSmsLine] = useState('Checking SMS access…');
  const [showModels, setShowModels] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showRemoveModels, setShowRemoveModels] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; message: string; actions: DialogAction[] } | null>(null);

  const catalog = getCatalogModel(modelId);
  const ttiVariant = getTtiVariant(ttiVariantId);
  const ttiCached = hasCachedTextToImage(ttiVariantId);
  const cached = hasCachedSources(
    resolveModelSources({
      modelId,
      customModelUrl,
      customTokenizerUrl,
      customTokenizerConfigUrl,
    }),
  );
  const version = Constants.expoConfig?.version ?? '1.0.0';

  function refreshStorage() {
    const storage = getModelStorageInfo();
    setModelPath(storage.path);
    setModelDisk(storageLine());
  }

  function refreshStatus() {
    void getModelAvailability().then((availability) => {
      setModelStatus(availability.reason);
    });
    refreshStorage();
  }

  useEffect(() => {
    let active = true;

    void getModelAvailability().then((availability) => {
      if (active) {
        setModelStatus(availability.reason);
        const storage = getModelStorageInfo();
        setModelPath(storage.path);
        setModelDisk(storageLine());
      }
    });

    void getDeviceSpecs().then((specs: DeviceSpecs) => {
      if (!active) {
        return;
      }
      setDeviceLine(`${specs.manufacturer} ${specs.model} · ${specs.os}`);
      setChipLine(`${specs.abi} · year class ${specs.yearClass}`);
      setRamLine(
        specs.appMaxRam
          ? `${formatBytes(specs.totalRam)} device · app max ${formatBytes(specs.appMaxRam)}`
          : formatBytes(specs.totalRam),
      );
    });

    useUiStore.getState().setModelInRam(getModelRamState().loaded);

    void describeSmsAccess().then((line) => {
      if (active) {
        setSmsLine(line);
      }
    });

    return () => {
      active = false;
    };
  }, [modelId, customModelUrl, customTokenizerUrl, customTokenizerConfigUrl]);

  function confirmClearDatabase() {
    if (useUiStore.getState().isProcessing || useModelDownloadStore.getState().kind) { setToast({ kind: 'info', message: 'Wait for the scan or download before clearing data.' }); return; }
    setDialog({
      title: 'Clear local database?',
      message: 'For testing. Scanned messages can be read again on Refresh. Model files and Settings stay.',
      actions: [
        { label: 'Cancel', tone: 'secondary', onPress: () => undefined },
        {
          label: 'Messages & ledger',
          tone: 'primary',
          onPress: () => {
            void resetLocalData(false).then(() => {
              setToast({ kind: 'success', message: 'Ledger cleared. Refresh can scan again.' });
            });
          },
        },
        {
          label: 'Also paycheck & bills',
          tone: 'danger',
          onPress: () => {
            void resetLocalData(true).then(() => {
              setToast({ kind: 'success', message: 'Database cleared. Paycheck and bills reset.' });
            });
          },
        },
      ],
    });
  }

  function openRemoveModels() {
    if (useUiStore.getState().isProcessing || useModelDownloadStore.getState().kind) {
      setToast({ kind: 'info', message: 'Wait for the scan or download before removing a model.' });
      return;
    }
    setShowRemoveModels(true);
  }

  const removableLanguage = listRemovableLanguageModels({
    customModelUrl,
    customTokenizerUrl,
    customTokenizerConfigUrl,
  });
  const removableImages = TTI_VARIANTS.filter((item) => hasCachedTextToImage(item.id));

  async function removeLanguageDownload(id: ModelId) {
    const sources = resolveModelSources({
      modelId: id,
      customModelUrl,
      customTokenizerUrl,
      customTokenizerConfigUrl,
    });
    const selected = resolveModelSources({
      modelId,
      customModelUrl,
      customTokenizerUrl,
      customTokenizerConfigUrl,
    });
    if (sources && selected && cacheNameFromUrl(sources.model) === cacheNameFromUrl(selected.model)) {
      try {
        await unloadModelFromMemory();
      } catch {
        // Still delete files if unload failed.
      }
    }
    const removed = removeCachedModelSources(sources);
    refreshStatus();
    setToast({
      kind: removed > 0 ? 'success' : 'info',
      message: removed > 0 ? `Removed ${getCatalogModel(id).label}` : 'That language model is not on disk',
    });
  }

  async function removeImageDownload(id: TtiVariantId) {
    const removed = await removeCachedTextToImage(id);
    refreshStatus();
    setToast({
      kind: removed > 0 ? 'success' : 'info',
      message: removed > 0 ? `Removed ${TTI_MODEL_NAME} ${getTtiVariant(id).label}` : 'That image model is not on disk',
    });
  }

  function startDownload() {
    if (useUiStore.getState().isProcessing) {
      setToast({ kind: 'info', message: 'Wait for the current scan to finish.' });
      return;
    }
    void downloadSelectedModel(() => undefined)
      .then(() => {
        refreshStatus();
        setToast({
          kind: 'success',
          message: 'Model is on this phone. Refresh will not use the internet.',
        });
      })
      .catch((error) => {
        setToast({
          kind: error instanceof Error && error.message === 'stopped' ? 'info' : 'error',
          message: error instanceof Error && error.message === 'stopped'
            ? 'Model download stopped.' : 'Download failed. Check internet and try again.',
        });
      });
  }

  function startImageDownload() {
    if (useUiStore.getState().isProcessing) {
      setToast({ kind: 'info', message: 'Wait for the current scan to finish.' });
      return;
    }
    if (!isTextToImageAvailable()) {
      setToast({ kind: 'error', message: 'Needs the Android development build. Expo Go cannot download this model.' });
      return;
    }
    void downloadTextToImage(ttiVariantId, () => undefined)
      .then(() => {
        refreshStatus();
        setToast({
          kind: 'success',
          message: `${TTI_MODEL_NAME} is on this phone. Imagine will not use the internet.`,
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Download failed. Check internet and try again.';
        setToast({
          kind: message === 'stopped' ? 'info' : 'error',
          message: message === 'stopped' ? 'Image model download stopped.' : message === 'unavailable' ? 'Needs the Android development build.' : 'Download failed. Check internet and try again.',
        });
      });
  }

  return (
    <ScreenScaffold>
      <SectionHero title="Make it yours" subtitle="Your preferences, privacy and connected sources" icon="options-outline" />
      {!showModels && !showImages ? <ModelDownloadCard /> : null}

      <View style={styles.list}>
        <SettingsRow icon="earth-outline" title="Event region" value="Kerala & India. Regional holidays are filtered; your personal bookings and appointments stay visible." />
        <SettingsRow
          icon="cloud-offline-outline" title="On this phone"
          value="SMS, amounts, and inference stay on this device. Download in the engine sheet fetches model files once over HTTPS."
        />

        <SettingsRow
          icon="notifications-outline" title="Plan reminders"
          value={
            remindersOn
              ? 'On — upcoming events and bills notify with View, Snooze 1h, and Mark done.'
              : 'Off — no lock-screen reminders. In-app toasts still work.'
          }
          accessory={
            <Switch
              accessibilityLabel="Plan reminders"
              onValueChange={(value) => {
                setRemindersOn(value);
                if (!value) {
                  void clearPlanReminders();
                  setToast({ kind: 'info', message: 'Plan reminders are off.' });
                  return;
                }
                void requestReminderPermission().then((allowed) => {
                  if (!allowed) {
                    setRemindersOn(false);
                    setToast({ kind: 'error', message: 'Notification permission was not granted.' });
                    return;
                  }
                  void syncPlanReminders();
                  setToast({ kind: 'success', message: 'Reminders use View, Snooze 1h, and Mark done.' });
                });
              }}
              thumbColor={colors.neutral[0]}
              trackColor={{ false: colors.neutral[400], true: colors.primary[500] }}
              value={remindersOn}
            />
          }
        />

        <SettingsRow
          icon="calendar-number-outline" title="Calendar account"
          value={
            googleAccount
              ? `${googleAccount}. Reads calendar entries, not your email inbox. Tap to choose again.`
              : 'Choose a calendar account during Refresh. Saved email screenshots can be read from the dashboard.'
          }
          onPress={
            googleAccount
              ? () => {
                  setDialog({
                    title: 'Change Gmail account?',
                    message: 'The next Refresh will ask which account to scan.',
                    actions: [
                      { label: 'Cancel', tone: 'secondary', onPress: () => undefined },
                      {
                        label: 'Ask next time',
                        tone: 'primary',
                        onPress: () => {
                          setGoogleAccount('');
                          setToast({ kind: 'info', message: 'Pick a Gmail account the next time you tap Refresh.' });
                        },
                      },
                    ],
                  });
                }
              : undefined
          }
        />

        <OcrLanguagePicker />

        <ScanLookback
          onChange={(months) => {
            const wider = months > scanLookbackMonths;
            setScanLookbackMonths(months);
            void describeSmsAccess().then(setSmsLine);
            setToast({
              kind: 'info',
              message: wider
                ? 'Next Refresh will include older messages. Already scanned ones are skipped.'
                : months === 1
                  ? 'Next Refresh reads this month only.'
                  : `Next Refresh reads the last ${months} months.`,
            });
          }}
          value={scanLookbackMonths}
        />

        <SettingsRow
          action="Edit"
          icon="sparkles-outline"
          tag="LLM"
          title="Language models"
          value={`${FINLIFE_LLM.engine} · ${catalog.label}${cached ? ' · cached' : ''} · language model for chat and scans`}
          onPress={() => {
            setShowModels(true);
          }}
        />
        <AppBottomSheet
          accessibilityLabel="Close language model picker"
          headerRight={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cached ? 'Model is on this phone' : 'Download selected model'}
              disabled={downloading || processing || cached}
              onPress={() => {
                startDownload();
              }}
              style={[styles.headerDownload, downloading || processing || cached ? styles.headerDownloadOff : undefined]}>
              <AppText
                style={downloading || processing || cached ? styles.headerDownloadLabelOff : styles.headerDownloadLabel}
                variant="labelSmall">
                {downloading ? 'Downloading…' : cached ? 'On device' : 'Download'}
              </AppText>
            </Pressable>
          }
          onClose={() => {
            setShowModels(false);
          }}
          title="Language models"
          visible={showModels}>
          <ModelDownloadCard />
          <ModelPicker />
        </AppBottomSheet>

        <SettingsRow
          action="Edit"
          icon="color-palette-outline"
          tag="Image"
          tagTone="image"
          title="Image generation"
          value={
            !isTextToImageAvailable()
              ? `${TTI_MODEL_NAME} needs the Android development build. It is not an LLM.`
              : `${TTI_MODEL_NAME} · ${ttiVariant.label} · ${formatBytes(ttiVariant.downloadBytes)} · ${ttiCached ? 'on disk' : 'not downloaded'}${imageInRam ? ' · in RAM now' : ''}`
          }
          onPress={() => {
            setShowImages(true);
          }}
        />
        <AppBottomSheet
          accessibilityLabel="Close image model picker"
          headerRight={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ttiCached ? 'Image model is on this phone' : 'Download selected image model'}
              disabled={downloading || processing || ttiCached || !isTextToImageAvailable()}
              onPress={() => {
                startImageDownload();
              }}
              style={[styles.headerDownload, downloading || processing || ttiCached || !isTextToImageAvailable() ? styles.headerDownloadOff : undefined]}>
              <AppText
                style={downloading || processing || ttiCached ? styles.headerDownloadLabelOff : styles.headerDownloadLabel}
                variant="labelSmall">
                {downloading ? 'Downloading…' : ttiCached ? 'On device' : 'Download'}
              </AppText>
            </Pressable>
          }
          onClose={() => {
            setShowImages(false);
          }}
          title="Image models"
          visible={showImages}>
          <ImageModelPicker onDiskChange={refreshStorage} />
        </AppBottomSheet>
        <SettingsRow
          action="Open"
          icon="pulse-outline"
          title="App resources"
          value="Heap, device RAM, and Free app memory live in the Activity sheet. This app never stops other apps."
          onPress={() => {
            router.push('/processing' as Href);
          }}
        />
        <SettingsRow
          action="Recheck"
          icon="pulse-outline"
          tag="LLM"
          title="Language model status"
          value={modelStatus}
          onPress={() => {
            refreshStatus();
            setToast({ kind: 'info', message: 'Rechecked language model and download folder' });
          }}
        />
        <SettingsRow
          icon="hardware-chip-outline"
          tag="LLM"
          title="Language model in RAM"
          value={
            modelInRam
              ? 'LLM loaded — only one native model at a time. Unload here, or open Activity to free this app’s RAM. Other apps are not stopped.'
              : 'LLM unloaded. Refresh loads one copy, then frees it. Image generation is a separate model above.'
          }
        />
        <Pressable
          accessibilityRole="button"
          disabled={!modelInRam}
          onPress={() => {
            void unloadModelFromMemory().then((wasLoaded) => {
              refreshStatus();
              setToast({
                kind: wasLoaded ? 'success' : 'info',
                message: wasLoaded ? 'Model unloaded from memory' : 'Nothing was in RAM',
              });
            });
          }}
          style={[styles.primary, !modelInRam ? styles.primaryOff : undefined]}>
          <AppText style={modelInRam ? styles.primaryLabel : styles.primaryLabelOff} variant="labelLarge">
            Unload language model from memory
          </AppText>
        </Pressable>
        <SettingsRow
          icon="folder-open-outline" title="Download folder"
          value={modelPath}
        />

        <SettingsRow
          action="Stop"
          icon="stop-circle-outline"
          title="Stop all model downloads"
          value="Stops active and leftover Android model transfers. Completed models stay on this phone."
          onPress={() => {
            void stopAllModelDownloads().then((count) => {
              setToast({ kind: 'info', message: count ? `Stopped ${count} background model transfer(s).` : 'No background model transfers remain.' });
            }).catch((error) => {
              setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not stop background downloads.' });
            });
          }}
        />

        <SettingsRow
          action="Choose"
          icon="trash-bin-outline"
          title="Choose a model to remove"
          value="Pick one language or image model on this phone. Other downloads stay. Chat and Imagine can save it again later."
          onPress={openRemoveModels}
        />
        <AppBottomSheet
          accessibilityLabel="Close model removal"
          onClose={() => {
            setShowRemoveModels(false);
          }}
          title="Choose a model to remove"
          visible={showRemoveModels}>
          <AppText variant="bodySmall">
            Only the model you tap is deleted. Shared files used by another download stay if that other model is still on disk.
          </AppText>
          {removableLanguage.length || removableImages.length ? null : (
            <AppText variant="bodyRegular">No downloaded models are on this phone.</AppText>
          )}
          {removableLanguage.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.label}`}
              key={`llm-${item.id}`}
              onPress={() => {
                void removeLanguageDownload(item.id);
              }}
              style={styles.removeRow}>
              <View style={styles.copy}>
                <AppText variant="labelRegular">{item.label}</AppText>
                <AppText variant="caption">Language model</AppText>
              </View>
              <AppText style={styles.danger} variant="labelSmall">
                Remove
              </AppText>
            </Pressable>
          ))}
          {removableImages.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.label}`}
              key={`tti-${item.id}`}
              onPress={() => {
                void removeImageDownload(item.id);
              }}
              style={styles.removeRow}>
              <View style={styles.copy}>
                <AppText variant="labelRegular">
                  {TTI_MODEL_NAME} · {item.label}
                </AppText>
                <AppText variant="caption">Image model</AppText>
              </View>
              <AppText style={styles.danger} variant="labelSmall">
                Remove
              </AppText>
            </Pressable>
          ))}
        </AppBottomSheet>
        <SettingsRow
          action="Recheck"
          icon="download-outline" title="Downloaded size"
          value={modelDisk}
          onPress={() => {
            refreshStorage();
            setToast({
              kind: 'info',
              message:
                countPteFiles() > 0
                  ? `${countPteFiles()} .pte files in the default folder`
                  : 'No .pte files yet',
            });
          }}
          accessory={
            <Pressable accessibilityRole="button" onPress={openRemoveModels} style={styles.ghost}>
              <AppText style={styles.danger} variant="labelSmall">
                Remove
              </AppText>
            </Pressable>
          }
        />

        <SettingsRow
          icon="phone-portrait-outline" title="This device"
          value={deviceLine}
        />
        <SettingsRow
          icon="speedometer-outline" title="CPU / ABI"
          value={chipLine}
        />
        <SettingsRow
          icon="server-outline" title="RAM"
          value={ramLine}
        />

        <SettingsRow
          action="Allow"
          icon="chatbox-ellipses-outline" title="SMS access"
          value={smsLine}
          onPress={() => {
            void requestSmsPermission().then((allowed) => {
              void describeSmsAccess().then(setSmsLine);
              setToast({
                kind: allowed ? 'success' : 'error',
                message: allowed
                  ? 'READ_SMS allowed. Refresh uses the range you picked above.'
                  : 'SMS permission denied',
              });
            });
          }}
        />

        <SettingsRow
          action="Edit"
          icon="alarm-outline" title="LLM schedule"
          value={formatWindows(windows)}
          onPress={() => {
            setShowSchedule(true);
          }}
        />
        <AppBottomSheet
          accessibilityLabel="Close LLM schedule"
          onClose={() => {
            setShowSchedule(false);
          }}
          title="LLM schedule"
          visible={showSchedule}>
          <ScheduleEditor />
        </AppBottomSheet>

        <SettingsRow
          icon="shield-checkmark-outline" title="Privacy"
          value={
            privacyOn
              ? 'On — SMS and amounts stay on this phone. Play Store may restrict READ_SMS.'
              : 'Off — ProxAI still has no cloud backend. Nothing is uploaded.'
          }
          accessory={
            <Switch
              accessibilityLabel="Privacy"
              onValueChange={(value) => {
                setPrivacyOn(value);
                setToast({
                  kind: 'info',
                  message: value
                    ? 'SMS is never sent to a server.'
                    : 'Cloud sync is not shipped. Data still stays on this device.',
                });
              }}
              thumbColor={colors.neutral[0]}
              trackColor={{ false: colors.neutral[400], true: colors.primary[500] }}
              value={privacyOn}
            />
          }
        />

        <SettingsRow
          action="Clear"
          icon="trash-outline" title="Clear database"
          value="Testing only. Wipes scanned messages and the ledger so Refresh can run again."
          onPress={confirmClearDatabase}
        />

        <SettingsRow
          action="Open"
          icon="information-circle-outline" title="About"
          value={`ProxAI ${version} · ${FINLIFE_LLM.downloadHint}`}
          onPress={() => {
            void openBrowserAsync(MODEL_SOURCE_ORG, {
              presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
            });
          }}
        />
      </View>
      <AppDialog
        visible={dialog != null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        actions={dialog?.actions ?? []}
        onClose={() => {
          setDialog(null);
        }}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  primary: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: {
    backgroundColor: colors.neutral[100],
  },
  primaryLabel: {
    color: colors.neutral[0],
  },
  primaryLabelOff: {
    color: colors.neutral[600],
  },
  ghost: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  danger: {
    color: colors.semantic.danger,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  removeRow: {
    minHeight: 48,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerDownload: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDownloadOff: {
    backgroundColor: colors.neutral[100],
  },
  headerDownloadLabel: {
    color: colors.neutral[0],
  },
  headerDownloadLabelOff: {
    color: colors.neutral[600],
  },
});
