import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppText } from '@/components/app-text';
import { ItemActions } from '@/components/item-actions';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { formatInr } from '@/utils/format-inr';
import { formatLedgerWhen } from '@/utils/format-when';
import { accountOf } from '@/utils/bank-account';
import { transactionReference } from '@/utils/information';

type LedgerDetailSheetProps = {
  item: LedgerItem | null;
  onClose: () => void;
};

export function LedgerDetailSheet({ item, onClose }: LedgerDetailSheetProps) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const reference = item ? transactionReference(item) : null;
  const title = item?.type === 'transaction' ? 'Transaction details' : 'Your details';

  return (
    <AppBottomSheet accessibilityLabel="Close item details" onClose={onClose} title={title} visible={item != null}>
      {item ? (
        <>
          <AppText variant="overline">
            {item.type === 'transaction' ? (item.category === 'income' ? 'MONEY CREDITED' : 'MONEY DEBITED') : item.type}
          </AppText>
          <AppText variant="h2">{item.merchant ?? item.category}</AppText>
          {item.amount != null ? <AppText variant="h1">{formatInr(item.amount)}</AppText> : null}
          <View style={styles.card}>
            <AppText variant="labelRegular">When</AppText>
            <AppText variant="bodyRegular">{formatLedgerWhen(item.date)}</AppText>
          </View>
          {item.type === 'transaction' ? (
            <View style={styles.card}>
              <AppText variant="labelRegular">Account</AppText>
              <AppText>{accountOf(item).label}</AppText>
              <AppText variant="caption">{item.category === 'income' ? 'Money received into this account' : 'Money paid from this account'}</AppText>
            </View>
          ) : null}
          {item.type === 'security' ? (
            <View style={styles.card}>
              <AppText variant="labelRegular">Why it needs attention</AppText>
              <AppText>{item.review}</AppText>
            </View>
          ) : null}
          {reference ? (
            <View style={styles.card}>
              <AppText variant="labelRegular">{item.type === 'transaction' ? 'Transaction reference' : 'Booking / tracking reference'}</AppText>
              <AppText>{reference}</AppText>
            </View>
          ) : null}
          {item.location ? (
            <View style={styles.card}>
              <AppText variant="labelRegular">Location / route</AppText>
              <AppText>{item.location}</AppText>
            </View>
          ) : null}
          {item.sourceBody ? (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: sourceId === item.id }}
                onPress={() => {
                  setSourceId(sourceId === item.id ? null : item.id);
                }}
                style={styles.disclosure}>
                <Ionicons color={colors.primary[600]} name={item.sourceKind === 'screenshot' ? 'image-outline' : 'chatbubble-outline'} size={20} />
                <AppText style={styles.flex} variant="labelRegular">
                  Source · {item.sender ?? 'SMS'}
                </AppText>
                <Ionicons color={colors.primary[600]} name={sourceId === item.id ? 'chevron-up' : 'chevron-down'} size={20} />
              </Pressable>
              {sourceId === item.id ? (
                <>
                  {item.sourceKind === 'screenshot' && item.sourceUri ? (
                    <Image contentFit="contain" source={{ uri: item.sourceUri }} style={styles.screenshot} />
                  ) : null}
                  <AppText variant="bodySmall">{item.sourceBody}</AppText>
                </>
              ) : null}
            </View>
          ) : null}
          {item.type !== 'transaction' ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: editingId === item.id }}
                onPress={() => {
                  setEditingId(editingId === item.id ? null : item.id);
                }}
                style={[styles.card, styles.disclosure]}>
                <Ionicons color={colors.primary[600]} name="create-outline" size={21} />
                <AppText style={styles.flex} variant="labelRegular">
                  Manage this item
                </AppText>
                <Ionicons color={colors.primary[600]} name={editingId === item.id ? 'chevron-up' : 'chevron-down'} size={20} />
              </Pressable>
              {editingId === item.id ? <ItemActions item={item} key={item.id} /> : null}
            </>
          ) : null}
        </>
      ) : null}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  screenshot: { height: 240, width: '100%', borderRadius: borderRadius.lg, backgroundColor: colors.neutral[100] },
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
