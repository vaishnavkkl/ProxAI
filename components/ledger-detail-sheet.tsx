import { KeyboardScreen } from '@/components/keyboard-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ItemActions } from '@/components/item-actions';
import { borderRadius, colors, layout, spacing } from '@/styles';
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
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={item != null}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardScreen>
        <View style={styles.bar}>
          <AppText variant="h3">
            {item?.type === 'transaction' ? 'Transaction details' : 'Your details'}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close item details"
            onPress={onClose}
            style={styles.iconBtn}>
            <Ionicons color={colors.neutral[900]} name="close" size={22} />
          </Pressable>
        </View>
        {item ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <AppText variant="overline">{item.type === 'transaction' ? item.category === 'income' ? 'MONEY CREDITED' : 'MONEY DEBITED' : item.type}</AppText>
            <AppText variant="h2">{item.merchant ?? item.category}</AppText>
            {item.amount != null ? <AppText variant="h1">{formatInr(item.amount)}</AppText> : null}
            <View style={styles.card}>
              <AppText variant="labelRegular">When</AppText>
              <AppText variant="bodyRegular">{formatLedgerWhen(item.date)}</AppText>
            </View>
            {item.type === 'transaction' ? <View style={styles.card}><AppText variant="labelRegular">Account</AppText><AppText>{accountOf(item).label}</AppText><AppText variant="caption">{item.category === 'income' ? 'Money received into this account' : 'Money paid from this account'}</AppText></View> : null}
            {item.type === 'security' ? <View style={styles.card}><AppText variant="labelRegular">Why it needs attention</AppText><AppText>{item.review}</AppText></View> : null}
            {reference ? <View style={styles.card}><AppText variant="labelRegular">{item.type === 'transaction' ? 'Transaction reference' : 'Booking / tracking reference'}</AppText><AppText>{reference}</AppText></View> : null}
            {item.location ? <View style={styles.card}><AppText variant="labelRegular">Location / route</AppText><AppText>{item.location}</AppText></View> : null}
            {item.sourceBody ? <View style={styles.card}><Pressable accessibilityRole="button" accessibilityState={{ expanded: sourceId === item.id }} style={styles.disclosure} onPress={() => setSourceId(sourceId === item.id ? null : item.id)}><Ionicons name={item.sourceKind === 'screenshot' ? 'image-outline' : 'chatbubble-outline'} size={20} color={colors.primary[600]} /><AppText variant="labelRegular" style={styles.flex}>Source · {item.sender ?? 'SMS'}</AppText><Ionicons name={sourceId === item.id ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary[600]} /></Pressable>{sourceId === item.id ? <>{item.sourceKind === 'screenshot' && item.sourceUri ? <Image source={{ uri: item.sourceUri }} contentFit="contain" style={styles.screenshot} /> : null}<AppText variant="bodySmall">{item.sourceBody}</AppText></> : null}</View> : null}
            {item.type !== 'transaction' ? <><Pressable accessibilityRole="button" accessibilityState={{ expanded: editingId === item.id }} style={[styles.card, styles.disclosure]} onPress={() => setEditingId(editingId === item.id ? null : item.id)}><Ionicons name="create-outline" size={21} color={colors.primary[600]} /><AppText style={styles.flex} variant="labelRegular">Manage this item</AppText><Ionicons name={editingId === item.id ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary[600]} /></Pressable>{editingId === item.id ? <ItemActions key={item.id} item={item} /> : null}</> : null}
          </ScrollView>
        ) : null}
      </KeyboardScreen>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, disclosure: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  screenshot: { height: 240, width: '100%', borderRadius: borderRadius.lg, backgroundColor: colors.neutral[100] },
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
    paddingBottom: spacing['3xl'],
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
