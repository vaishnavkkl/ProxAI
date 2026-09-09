import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppText } from '@/components/app-text';
import { OcrCaptureSheet } from '@/components/ocr-capture-sheet';
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
import { colors, spacing, borderRadius } from '@/styles';
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
  const busy = useUiStore((s) => s.isProcessing);
  const progress = useUiStore((s) => s.llmProgress);
  const label = useUiStore((s) => s.llmLabel);
  const selectedScreenshotId = useUiStore((s) => s.selectedScreenshotId);
  const openScan = rows.find((row) => row.id === selectedScreenshotId) ?? null;
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  useEffect(() => {
    let active = true;
    void listScreenshotScans(month)
      .then((items) => {
        if (active) {
          setRows(uniqueScreenshotScans(items));
        }
      })
      .catch(() => undefined);
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
  }

  async function saveFolders() {
    await setImageScanFolders(chosenFolders);
    setShowFolders(false);
    useUiStore.getState().setToast({
      kind: 'success',
      message: chosenFolders.length
        ? `Next scan uses ${chosenFolders.length} folders.`
        : 'Next scan uses the Screenshots folder.',
    });
  }

  async function ocrFrom(source: 'gallery' | 'camera') {
    if (useUiStore.getState().isProcessing) {
      return;
    }
    useUiStore.getState().setWorkKind('scan');
    useUiStore.getState().setProcessing(true);
    useUiStore.getState().setProgress(0.08, source === 'camera' ? 'Opening camera…' : 'Opening gallery…');
    try {
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
    } finally {
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
        useUiStore.getState().setProgress(0.04, 'Opening images…');
    const runtime = getLlmRuntime();
    runtime.beginScan?.();
    try {
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
    } finally {
      await runtime.endScan?.();
      useUiStore.getState().setProcessing(false);
      useUiStore.getState().setProgress(0, '');
    }
  }

  return (
    <ScreenScaffold scroll={false} stack>
      <FlatList
        ListEmptyComponent={
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
            <ScreenBack accessibilityLabel="Go back" />
            <SectionHero icon="scan-outline" title="Image intelligence" subtitle="OCR on this phone · copy or ask the assistant" />
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <AppText variant="labelRegular">Include in Refresh</AppText>
                  <AppText variant="bodySmall">Checks new images in the folders you picked</AppText>
                </View>
                <Switch
                  accessibilityLabel="Include images in Refresh"
                  disabled={busy}
                  onValueChange={(value) => {
                    void enable(value);
                  }}
                  trackColor={{ true: colors.primary[500], false: colors.neutral[400] }}
                  value={enabled}
                />
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
            <View style={styles.card}>
              <AppText variant="labelRegular">Read one photo</AppText>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  void ocrFrom('gallery');
                }}
                style={styles.actionRow}>
                <View style={styles.actionIcon}>
                  <Ionicons color={colors.primary[600]} name="images-outline" size={21} />
                </View>
                <View style={styles.copy}>
                  <AppText variant="labelRegular">From gallery</AppText>
                  <AppText variant="bodySmall">Choose a photo already on this phone</AppText>
                </View>
                <Ionicons color={colors.primary[500]} name="chevron-forward" size={20} />
              </Pressable>
              <View style={styles.hairline} />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  void ocrFrom('camera');
                }}
                style={styles.actionRow}>
                <View style={styles.actionIcon}>
                  <Ionicons color={colors.primary[600]} name="camera-outline" size={21} />
                </View>
                <View style={styles.copy}>
                  <AppText variant="labelRegular">From camera</AppText>
                  <AppText variant="bodySmall">Take a photo and read the text here</AppText>
                </View>
                <Ionicons color={colors.primary[500]} name="chevron-forward" size={20} />
              </Pressable>
            </View>
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
              <Ionicons color="white" name="scan-outline" size={22} />
              <AppText style={styles.white} variant="labelRegular">
                {busy ? 'Scanning…' : 'Scan this month'}
              </AppText>
            </Pressable>
            {busy ? (
              <ProgressMeter progress={progress} label={label || status} />
            ) : (
              <AppText accessibilityLiveRegion="polite" variant="bodySmall">
                {status}
              </AppText>
            )}
          </View>
        }
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
      />
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
        <Pressable accessibilityRole="button" onPress={() => void saveFolders()} style={styles.primary}>
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
  actionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  hairline: {
    height: 1,
    backgroundColor: colors.neutral[100],
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
