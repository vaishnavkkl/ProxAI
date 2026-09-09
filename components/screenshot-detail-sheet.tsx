import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppText } from '@/components/app-text';
import { OcrTextBlocks } from '@/components/ocr-text-blocks';
import type { ScreenshotScan } from '@/services/screenshot-scanner';
import { useCoachStore } from '@/store/coach-store';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import { formatInr } from '@/utils/format-inr';
import { formatLedgerWhen } from '@/utils/format-when';
import { informationTitle } from '@/utils/information';
import { openCoach } from '@/utils/open-coach';

type ScreenshotDetailSheetProps = {
  scan: ScreenshotScan | null;
  onClose: () => void;
};

export function ScreenshotDetailSheet({ scan, onClose }: ScreenshotDetailSheetProps) {
  const [asking, setAsking] = useState(false);
  const life = useLifeStore((s) => s.items);
  const transactions = useTransactionStore((s) => s.financeItems);
  const events = useEventStore((s) => s.items);
  const renewals = useSubscriptionStore((s) => s.items);
  const extracted = scan
    ? [...life, ...transactions, ...events, ...renewals].filter((item) => scan.itemIds.includes(item.id))
    : [];
  const captured = scan
    ? new Date(scan.capturedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';

  useEffect(() => {
    if (!scan) {
      setAsking(false);
    }
  }, [scan]);

  function close() {
    setAsking(false);
    onClose();
  }

  return (
    <AppBottomSheet
      accessibilityLabel={asking ? 'Back to screenshot details' : 'Close screenshot details'}
      onClose={() => {
        if (asking) {
          setAsking(false);
          return;
        }
        close();
      }}
      title={asking ? 'Ask assistant' : scan?.name || 'Image'}
      visible={scan != null}>
      {scan ? (
        <>
          {asking ? null : (
            <>
              <Image contentFit="contain" recyclingKey={scan.id} source={{ uri: scan.uri }} style={styles.preview} />
              <View style={styles.card}>
                <AppText variant="labelRegular">Captured</AppText>
                <AppText variant="bodyRegular">{captured}</AppText>
              </View>
            </>
          )}
          <View style={asking ? undefined : styles.card}>
            {asking ? null : <AppText variant="h4">Text from this photo</AppText>}
            <OcrTextBlocks
              asking={asking}
              onAsk={(question) => {
                useCoachStore.getState().startFreshAsk(question);
                close();
                openCoach();
              }}
              onAskingChange={setAsking}
              text={scan.text}
            />
          </View>
          {asking ? null : (
            <View style={styles.card}>
              <AppText variant="labelRegular">Organizer</AppText>
              {extracted.length ? (
                extracted.map((entry) => (
                  <Pressable
                    accessibilityRole="button"
                    key={entry.id}
                    onPress={() => {
                      close();
                      useUiStore.getState().setSelectedLedgerId(entry.id);
                    }}
                    style={styles.item}>
                    <View style={styles.copy}>
                      <AppText variant="labelSmall">{informationTitle(entry)}</AppText>
                      <AppText variant="caption">
                        {formatLedgerWhen(entry.date)}
                        {entry.amount != null ? ` · ${formatInr(entry.amount)}` : ''}
                      </AppText>
                    </View>
                    <Ionicons color={colors.primary[600]} name="arrow-forward" size={18} />
                  </Pressable>
                ))
              ) : (
                <AppText variant="bodySmall">
                  Nothing from this screenshot was added as an upcoming plan. The OCR text is kept here.
                </AppText>
              )}
            </View>
          )}
        </>
      ) : null}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  item: {
    minHeight: 48,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
});
