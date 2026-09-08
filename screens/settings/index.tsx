import Constants from 'expo-constants';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ModelPicker } from '@/components/model-picker';
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
import { MODEL_SOURCE_ORG, getCatalogModel, resolveModelSources } from '@/services/model-catalog';
import {
  clearDownloadedModels,
  countPteFiles,
  getModelStorageInfo,
  hasCachedSources,
} from '@/services/model-storage';
import { resetLocalData } from '@/services/reset-local-data';
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
  const offlineMode = useSettingsStore((s) => s.offlineMode);
  const privacyOn = useSettingsStore((s) => s.privacyOn);
  const modelId = useSettingsStore((s) => s.modelId);
  const customModelUrl = useSettingsStore((s) => s.customModelUrl);
  const customTokenizerUrl = useSettingsStore((s) => s.customTokenizerUrl);
  const customTokenizerConfigUrl = useSettingsStore((s) => s.customTokenizerConfigUrl);
  const windows = useSettingsStore((s) => s.windows);
  const scanLookbackMonths = useSettingsStore((s) => s.scanLookbackMonths);
  const googleAccount = useSettingsStore((s) => s.googleAccount);
  const setGoogleAccount = useSettingsStore((s) => s.setGoogleAccount);
  const setOfflineMode = useSettingsStore((s) => s.setOfflineMode);
  const setPrivacyOn = useSettingsStore((s) => s.setPrivacyOn);
  const setScanLookbackMonths = useSettingsStore((s) => s.setScanLookbackMonths);
  const setToast = useUiStore((s) => s.setToast);
  const modelInRam = useUiStore((s) => s.modelInRam);

  const [modelStatus, setModelStatus] = useState('Checking on-device model…');
  const [modelPath, setModelPath] = useState('Checking download folder…');
  const [modelDisk, setModelDisk] = useState('Not downloaded yet');
  const [deviceLine, setDeviceLine] = useState('Reading device…');
  const [chipLine, setChipLine] = useState('—');
  const [ramLine, setRamLine] = useState('—');
  const [smsLine, setSmsLine] = useState('Checking SMS access…');
  const [showModels, setShowModels] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const catalog = getCatalogModel(modelId);
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
      }
    });

    const storage = getModelStorageInfo();
    setModelPath(storage.path);
    setModelDisk(storageLine());

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
  }, [modelId, offlineMode, customModelUrl, customTokenizerUrl, customTokenizerConfigUrl]);

  function confirmClearDatabase() {
    if (useUiStore.getState().isProcessing) { setToast({ kind: 'info', message: 'Wait for the current scan before clearing data.' }); return; }
    Alert.alert(
      'Clear local database?',
      'For testing. Scanned messages can be read again on Refresh. Model files and Settings stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Messages & ledger',
          onPress: () => {
            void resetLocalData(false).then(() => {
              setToast({ kind: 'success', message: 'Ledger cleared. Refresh can scan again.' });
            });
          },
        },
        {
          text: 'Also paycheck & bills',
          style: 'destructive',
          onPress: () => {
            void resetLocalData(true).then(() => {
              setToast({ kind: 'success', message: 'Database cleared. Paycheck and bills reset.' });
            });
          },
        },
      ],
    );
  }

  function confirmClearDownloads() {
    if (useUiStore.getState().isProcessing) { setToast({ kind: 'info', message: 'Wait for the current scan before clearing models.' }); return; }
    Alert.alert('Remove downloaded models', 'Deletes cached .pte and tokenizer files on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const removed = clearDownloadedModels();
          refreshStatus();
          setToast({
            kind: removed > 0 ? 'success' : 'info',
            message: removed > 0 ? `Removed ${removed} files` : 'Download folder is already empty',
          });
        },
      },
    ]);
  }

  return (
    <ScreenScaffold>
      <SectionHero title="Make it yours" subtitle="Your preferences, privacy and connected sources" icon="options-outline" />

      <View style={styles.list}>
        <SettingsRow icon="earth-outline" title="Event region" value="Kerala & India. Regional holidays are filtered; your personal bookings and appointments stay visible." />
        <SettingsRow
          icon="cloud-offline-outline" title="Offline mode"
          value={
            offlineMode
              ? 'On — SMS and amounts never leave this phone. Refresh only uses a model already on disk.'
              : 'Off — SMS still stays here. You can tap Download model once. Refresh still does not call a server.'
          }
          accessory={
            <Switch
              accessibilityLabel="Offline mode"
              onValueChange={(value) => {
                setOfflineMode(value);
                setToast({
                  kind: 'info',
                  message: value
                    ? 'Refresh stays on this phone. Download is blocked until you turn this off.'
                    : 'You can download a model once. SMS is still never uploaded.',
                });
              }}
              thumbColor={colors.neutral[0]}
              trackColor={{ false: colors.neutral[400], true: colors.primary[500] }}
              value={offlineMode}
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
                  Alert.alert('Change Gmail account?', 'The next Refresh will ask which account to scan.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Ask next time',
                      onPress: () => {
                        setGoogleAccount('');
                        setToast({ kind: 'info', message: 'Pick a Gmail account the next time you tap Refresh.' });
                      },
                    },
                  ]);
                }
              : undefined
          }
        />

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
          action={showModels ? 'Hide' : 'Change'}
          expanded={showModels}
          icon="sparkles-outline" title="On-device engine"
          value={`${FINLIFE_LLM.engine} · ${catalog.label}${cached ? ' · cached' : ''}`}
          onPress={() => {
            setShowModels((open) => !open);
          }}
        />
        {showModels ? <View style={styles.expandedPanel}><ModelPicker /></View> : null}

        <SettingsRow
          action="Recheck"
          icon="pulse-outline" title="Model status"
          value={modelStatus}
          onPress={() => {
            refreshStatus();
            setToast({ kind: 'info', message: 'Rechecked model and download folder' });
          }}
        />
        <SettingsRow
          icon="hardware-chip-outline" title="Model in RAM"
          value={
            modelInRam
              ? 'Loaded — only one copy. Tap Unload to free memory now.'
              : 'Unloaded. Refresh loads one copy, then frees it.'
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
            Unload model from memory
          </AppText>
        </Pressable>
        {!cached ? (
          <Pressable
            accessibilityRole="button"
            disabled={isDownloading || offlineMode}
            onPress={() => {
              if (offlineMode) {
                setToast({
                  kind: 'error',
                  message: 'Turn Offline mode off to download once, then turn it back on.',
                });
                return;
              }
              setIsDownloading(true);
              setToast({ kind: 'info', message: 'Downloading model to this phone…' });
              void downloadSelectedModel((_progress, label) => {
                setToast({ kind: 'info', message: label });
              })
                .then(() => {
                  refreshStatus();
                  setToast({
                    kind: 'success',
                    message: 'Model is on this phone. Refresh will not use the internet.',
                  });
                })
                .catch(() => {
                  setToast({
                    kind: 'error',
                    message: 'Download failed. Check internet and try again.',
                  });
                })
                .finally(() => {
                  setIsDownloading(false);
                });
            }}
            style={[styles.primary, offlineMode || isDownloading ? styles.primaryOff : undefined]}>
            <AppText
              style={offlineMode || isDownloading ? styles.primaryLabelOff : styles.primaryLabel}
              variant="labelLarge">
              {isDownloading
                ? 'Downloading…'
                : offlineMode
                  ? 'Turn offline off to download'
                  : 'Download model to this phone'}
            </AppText>
          </Pressable>
        ) : null}

        <SettingsRow
          icon="folder-open-outline" title="Download folder"
          value={modelPath}
        />

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
            <Pressable accessibilityRole="button" onPress={confirmClearDownloads} style={styles.ghost}>
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
          action={showSchedule ? 'Hide' : 'Change'}
          expanded={showSchedule}
          icon="alarm-outline" title="LLM schedule"
          value={formatWindows(windows)}
          onPress={() => {
            setShowSchedule((open) => !open);
          }}
        />
        {showSchedule ? <View style={styles.expandedPanel}><ScheduleEditor /></View> : null}

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
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  expandedPanel: { padding: spacing.lg, marginTop: -spacing.sm, borderWidth: 1, borderTopWidth: 0, borderColor: colors.primary[100], backgroundColor: colors.neutral[0], borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl },
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
});
