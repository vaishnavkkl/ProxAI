import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, layout, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { formatInr } from '@/utils/format-inr';
import { formatLedgerWhen } from '@/utils/format-when';

type LedgerDetailSheetProps = {
  item: LedgerItem | null;
  onClose: () => void;
};

export function LedgerDetailSheet({ item, onClose }: LedgerDetailSheetProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={item != null}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.bar}>
          <AppText variant="h3">
            {item?.type === 'event' ? 'Event details' : item?.type === 'subscription' ? 'Subscription' : 'Spend details'}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close spend details"
            onPress={onClose}
            style={styles.iconBtn}>
            <Ionicons color={colors.neutral[900]} name="close" size={22} />
          </Pressable>
        </View>
        {item ? (
          <View style={styles.body}>
            <AppText variant="overline">{item.category}</AppText>
            <AppText variant="h2">{item.merchant ?? item.category}</AppText>
            <AppText variant="h1">
              {item.amount == null ? 'No amount' : formatInr(item.amount)}
            </AppText>
            <View style={styles.card}>
              <AppText variant="labelRegular">When</AppText>
              <AppText variant="bodyRegular">{formatLedgerWhen(item.date)}</AppText>
            </View>
            <View style={styles.card}>
              <AppText variant="labelRegular">What this is</AppText>
              <AppText variant="bodyRegular">{item.review?.trim() || item.note || item.type}</AppText>
            </View>
            <View style={styles.card}>
              <AppText variant="labelRegular">Type</AppText>
              <AppText variant="bodyRegular">{item.type}</AppText>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
