import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { FlatList, Linking, StyleSheet, Switch, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppText } from '@/components/app-text';
import { LogoLoader } from '@/components/logo-loader';
import { paintFeedback } from '@/utils/paint-feedback';
import { OcrCaptureSheet } from '@/components/ocr-capture-sheet';
import { OcrLanguagePicker } from '@/components/ocr-language-picker';
import { ProgressMeter } from '@/components/progress-meter';
import { ScreenBack } from '@/components/screen-back';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ScreenshotDetailSheet } from '@/components/screenshot-detail-sheet';
import { ScreenshotRow } from '@/components/screenshot-row';
import { SectionHero } from '@/components/section-hero';
import { pickImageUri, recognizePickedImage } from '@/services/image-ocr';
import { getModelAvailability, getLlmRuntime } from '@/services/llm-service';
import { notifyScanResult } from '@/services/reminders';
import {
  getImageScanFolders,
  listImageFolders,
  listScreenshotScans,
  scanScreenshots,
  screenshotAccess,
  screenshotsEnabled,
  setImageScanFolders,
  setScreenshotsEnabled,
  type ImageFolder,
  type ScreenshotScan,
  type ScreenshotAccess,
} from '@/services/screenshot-scanner';
import { useCoachStore } from '@/store/coach-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, spacing } from '@/styles';
import { defaultImageFolders } from '@/utils/ocr-blocks';
import { openCoach } from '@/utils/open-coach';

function uniqueScreenshotScans(rows: ScreenshotScan[]) {
  const seen = new Set<string>();
  const unique: ScreenshotScan[] = [];
  for (const row of rows) {
    const key = row.hash || row.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function renderItem({ item }: { item: ScreenshotScan }) {
  return <ScreenshotRow item={item} />;
}

function keyExtractor(item: ScreenshotScan) {
  return item.id;
}

export function Screenshots() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [rows, setRows] = useState<ScreenshotScan[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [access, setAccess] = useState<ScreenshotAccess>('denied');
  const [status, setStatus] = useState('Scan images to find plans, or read one photo with OCR.');
  const [folders, setFolders] = useState<ImageFolder[]>([]);
  const [chosenFolders, setChosenFolders] = useState<string[]>([]);
  const [showFolders, setShowFolders] = useState(false);
  const [ocrUri, setOcrUri] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [showOcr, setShowOcr] = useState(false);
  const [activeAction, setActiveAction] = useState<'gallery' | 'camera' | 'month' | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [savingFolders, setSavingFolders] = useState(false);
  const [toggling, setToggling] = useState(false);
  const busy = useUiStore((s) => s.isProcessing);
  const progress = useUiStore((s) => s.llmProgress);
  const label = useUiStore((s) => s.llmLabel);
  const selectedScreenshotId = useUiStore((s) => s.selectedScreenshotId);
  const openScan = rows.find((row) => row.id === selectedScreenshotId) ?? null;
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  useEffect(() => {
    let active = true;
    setLoadingRows(true);
    void listScreenshotScans(month)
      .then((items) => {
        if (active) {
          setRows(uniqueScreenshotScans(items));
        }
      })
      .catch(() => { if (active) setStatus('Could not load saved scans. Try another month or scan again.'); })
      .finally(() => { if (active) setLoadingRows(false); });
    return () => {
      active = false;
    };
  }, [month]);

  useEffect(() => {
    void screenshotsEnabled().then(setEnabled);
    void screenshotAccess().then(setAccess);
    void Promise.all([listImageFolders(), getImageScanFolders()]).then(([albums, saved]) => {
      setFolders(albums);
      setChosenFolders(saved.length ? saved : defaultImageFolders(albums));
    }).catch(() => undefined);
  }, []);

  async function enable(value: boolean) {
    if (toggling) return;
    setToggling(true);
    try {
    await paintFeedback();
    const permission = value ? await screenshotAccess(true) : await screenshotAccess();
    setAccess(permission);
    const next = value && (permission === 'full' || permission === 'limited');
    await setScreenshotsEnabled(next);
    setEnabled(next);
    if (value && !next) {
      setStatus(
        permission === 'unavailable'
          ? 'Available in the updated Android build.'
          : 'Photo access was not granted. You can allow it in phone settings.',
      );
    }
    } catch {
      useUiStore.getState().setToast({ kind: 'error', message: 'Could not update photo access. Please try again.' });
    } finally { setToggling(false); }
  }

  async function saveFolders() {
    if (savingFolders) return;
    setSavingFolders(true);
    try {
    await paintFeedback();
    await setImageScanFolders(chosenFolders);
    setShowFolders(false);
    useUiStore.getState().setToast({
      kind: 'success',
      message: chosenFolders.length
        ? `Next scan uses ${chosenFolders.length} folders.`
        : 'Next scan uses the Screenshots folder.',
    });
    } catch {
      useUiStore.getState().setToast({ kind: 'error', message: 'Could not save folders. Please try again.' });
    } finally { setSavingFolders(false); }
  }

  async function ocrFrom(source: 'gallery' | 'camera') {
    if (useUiStore.getState().isProcessing) {
      return;
    }
    useUiStore.getState().setWorkKind('scan');
    useUiStore.getState().setProcessing(true);
    setActiveAction(source);
    useUiStore.getState().setProgress(0.08, source === 'camera' ? 'Opening camera…' : 'Opening gallery…');
    try {
      await paintFeedback();
      const uri = await pickImageUri(source);
      if (!uri) {
        return;
      }
      setStatus('Reading text on this phone…');
      useUiStore.getState().setProgress(0.4, 'Reading text on this phone…');
      const text = await recognizePickedImage(uri);
      setOcrUri(uri);
      setOcrText(text);
      setShowOcr(true);
      setStatus(text.trim() ? 'Text is ready to copy or send to the assistant.' : 'No text could be read from that image.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not read that image.');
      useUiStore.getState().setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not read that image.' });
    } finally {
      setActiveAction(null);
      useUiStore.getState().setProcessing(false);
      useUiStore.getState().setProgress(0, '');
    }
  }

  const folderLabel = chosenFolders.length ? chosenFolders.join(', ') : 'Screenshots folder';

  async function scan() {
    if (useUiStore.getState().isProcessing) {
      return;
    }
    useUiStore.getState().setWorkKind('scan');
    useUiStore.getState().setProcessing(true);
    setActiveAction('month');
        useUiStore.getState().setProgress(0.04, 'Opening images…');
    const runtime = getLlmRuntime();
    runtime.beginScan?.();
    try {
      await paintFeedback();
      const permission = await screenshotAccess(true);
      setAccess(permission);
      const availability = await getModelAvailability().catch(() => ({ status: 'unavailable' as const, reason: '' }));
      const result = await scanScreenshots(
        month,
        (statusLabel) => {
          setStatus(statusLabel);
          const current = useUiStore.getState().llmProgress;
          useUiStore.getState().setProgress(Math.min(0.72, Math.max(current, 0.1) + 0.03), statusLabel);
        },
        availability.status === 'available'
          ? (messages) =>
              runtime.inferUnmatched(messages, (value: number, llmLabel: string) =>
                useUiStore.getState().setProgress(value, llmLabel),
              )
          : undefined,
      );
      const extra = result.model
        ? ` · ${result.model} categorized on this phone`
        : availability.status === 'available'
          ? ''
          : ' · download a model in Settings to categorize unmatched images';
      setStatus(
        `${result.read} checked · ${result.added} new items · ${result.cached} already read${result.errors ? ` · ${result.errors} could not be read; scan again to retry` : ''}${extra}`,
      );
      setRows(uniqueScreenshotScans(await listScreenshotScans(month)));
      await notifyScanResult({ events: 0, life: result.added, bills: 0 });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not scan. Try again.');
      useUiStore.getState().setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not scan. Try again.' });
    } finally {
      setActiveAction(null);
      useUiStore.getState().setProcessing(false);
      useUiStore.getState().setProgress(0, '');
      void runtime.endScan?.().catch(() => undefined);
    }
  }

  return (
    <ScreenScaffold scroll={false} stack>
      <FlatList
        ListEmptyComponent={
          loadingRows ? <View style={styles.empty}><LogoLoader /><AppText>Loading saved scans…</AppText></View> :
          <View style={styles.empty}>
            <Ionicons color={colors.primary[500]} name="images-outline" size={36} />
            <AppText variant="h4">Scanned images appear here</AppText>
            <AppText variant="bodySmall">
              Scan a month to OCR the folders you picked, or read one photo from the gallery or camera. Tap a result to
              copy paragraphs or send them to the assistant.
            </AppText>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHero
              icon="scan-outline"
              start={<ScreenBack accessibilityLabel="Go back" tone="inverse" />}
              subtitle="OCR on this phone · copy or ask the assistant"
              title="Image intelligence"
            />
            <View style={styles.card}>
              <AppText variant="h4">Read text from an image</AppText>
              <AppText variant="bodySmall">Choose a photo, then copy its text or send it to chat.</AppText>
              <View style={styles.sourceOptions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    void ocrFrom('gallery');
                  }}
                  style={[styles.sourceOption, busy ? styles.sourceDisabled : undefined]}>
                  <View style={styles.sourceIcon}>
                    {activeAction === 'gallery' ? <LogoLoader /> : <Ionicons color={colors.primary[600]} name="images-outline" size={30} />}
                  </View>
                  <View style={styles.sourceCopy}>
                    <AppText variant="labelLarge">From gallery</AppText>
                    <AppText style={styles.sourceCaption} variant="caption">
                      Photo on this phone
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    void ocrFrom('camera');
                  }}
                  style={[styles.sourceOption, busy ? styles.sourceDisabled : undefined]}>
                  <View style={styles.sourceIcon}>
                    {activeAction === 'camera' ? <LogoLoader /> : <Ionicons color={colors.primary[600]} name="camera-outline" size={30} />}
                  </View>
                  <View style={styles.sourceCopy}>
                    <AppText variant="labelLarge">From camera</AppText>
                    <AppText style={styles.sourceCaption} variant="caption">
                      Take a photo
                    </AppText>
                  </View>
                </Pressable>
              </View>
              <OcrLanguagePicker />
            </View>
            <AppText variant="h4">Scan saved images</AppText>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <AppText variant="labelRegular">Include in Refresh</AppText>
                  <AppText variant="bodySmall">Checks new images in the folders you picked</AppText>
                </View>
                <Switch
                  accessibilityLabel="Include images in Refresh"
                  disabled={busy || toggling}
                  onValueChange={(value) => {
                    void enable(value);
                  }}
                  trackColor={{ true: colors.primary[500], false: colors.neutral[400] }}
                  value={enabled}
                />
                {toggling ? <LogoLoader /> : null}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setShowFolders(true);
              }}
              style={styles.outline}>
              <View style={styles.copy}>
                <AppText variant="labelRegular">Folders to scan</AppText>
                <AppText variant="bodySmall">{folderLabel}</AppText>
              </View>
              <Ionicons color={colors.primary[600]} name="folder-open-outline" size={22} />
            </Pressable>
            <AppText variant="bodySmall">
              Default is the Screenshots folder. You can add Camera or other albums. OCR stays on this phone. The
              assistant never looks at the photo — only the text you pass it.
            </AppText>
            {access === 'limited' ? (
              <AppText variant="bodySmall">
                Only selected photos are accessible. Allow all photos to scan every image in the folders you picked.
              </AppText>
            ) : null}
            {access === 'denied' ? (
              <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.outline}>
                <AppText>Photo access settings</AppText>
              </Pressable>
            ) : null}
            <View style={styles.row}>
              <Pressable
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
                }}
                style={styles.arrow}>
                <Ionicons color={colors.primary[600]} name="chevron-back" size={22} />
              </Pressable>
              <AppText style={styles.copy} variant="h4">
                {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </AppText>
              <Pressable
                accessibilityLabel="Next month"
                accessibilityRole="button"
                disabled={busy || month.getTime() >= currentMonth}
                onPress={() => {
                  setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
                }}
                style={styles.arrow}>
                <Ionicons
                  color={month.getTime() >= currentMonth ? colors.neutral[400] : colors.primary[600]}
                  name="chevron-forward"
                  size={22}
                />
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void scan()} style={styles.primary}>
              {activeAction === 'month' ? <LogoLoader /> : <Ionicons color="white" name="scan-outline" size={22} />}
              <AppText style={styles.white} variant="labelRegular">
                {activeAction === 'month' ? 'Scanning…' : 'Scan this month'}
              </AppText>
            </Pressable>
            {busy ? null : (
              <AppText accessibilityLiveRegion="polite" variant="bodySmall">
                {status}
              </AppText>
            )}
          </View>
        }
        contentContainerStyle={[styles.list, busy ? styles.listBusy : undefined]}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
      />
      {busy ? (
        <View style={[styles.progressDock, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <ProgressMeter progress={progress} label={label || status} />
        </View>
      ) : null}
      <ScreenshotDetailSheet
        onClose={() => {
          useUiStore.getState().setSelectedScreenshotId(null);
        }}
        scan={openScan}
      />
      <OcrCaptureSheet
        onAsk={(question) => {
          useCoachStore.getState().startFreshAsk(question);
          setShowOcr(false);
          openCoach();
        }}
        onClose={() => {
          setShowOcr(false);
        }}
        text={ocrText}
        uri={ocrUri}
        visible={showOcr}
      />
      <AppBottomSheet
        accessibilityLabel="Close folder picker"
        onClose={() => {
          setShowFolders(false);
        }}
        title="Folders to scan"
        visible={showFolders}>
        <AppText variant="bodySmall">
          Screenshots is the default. Add Camera or other albums if bills and bookings live there.
        </AppText>
        {folders.map((folder) => {
          const on = chosenFolders.includes(folder.name);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              key={folder.name}
              onPress={() => {
                setChosenFolders((current) =>
                  current.includes(folder.name)
                    ? current.filter((name) => name !== folder.name)
                    : [...current, folder.name],
                );
              }}
              style={[styles.folderRow, on ? styles.folderOn : undefined]}>
              <View style={styles.copy}>
                <AppText variant="labelRegular">{folder.name}</AppText>
                <AppText variant="caption">{folder.count} images</AppText>
              </View>
              <Ionicons color={colors.primary[600]} name={on ? 'checkbox' : 'square-outline'} size={22} />
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" disabled={savingFolders} onPress={() => void saveFolders()} style={styles.primary}>
          {savingFolders ? <LogoLoader /> : null}
          <AppText style={styles.white} variant="labelRegular">
            Save folders
          </AppText>
        </Pressable>
      </AppBottomSheet>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing['2xl'] },
  listBusy: { paddingBottom: 108 },
  progressDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderColor: colors.neutral[200],
    boxShadow: '0px -4px 16px rgba(11,18,32,0.08)',
  },
  header: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  card: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  outline: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sourceOptions: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  sourceOption: {
    minHeight: 80,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary[500],
    experimental_backgroundImage: gradients.languageCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceDisabled: {
    opacity: 0.5,
  },
  sourceIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    transform: [{ rotate: '-5deg' }],
  },
  sourceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sourceCaption: {
    color: colors.neutral[600],
  },
  folderRow: {
    minHeight: 48,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  folderOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  primary: {
    minHeight: 48,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  white: { color: 'white' },
  empty: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
});
