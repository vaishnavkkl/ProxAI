import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { LedgerRow } from '@/components/ledger-row';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useSubscriptionStore } from '@/store/subscription-store';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { isUtilitySubId } from '@/utils/subscription-apps';

function keyExtractor(item: LedgerItem) {
  return item.id;
}

function renderSubscription({ item }: { item: LedgerItem }) {
  return <LedgerRow item={item} />;
}

function EmptySubscriptions() {
  return (
    <View style={styles.empty}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.secondary[500]} name="card-outline" size={28} />
      </View>
      <AppText variant="h4">No subscriptions yet</AppText>
      <AppText style={styles.copy} variant="bodyRegular">
        Tap Refresh on Home. It lists subscription apps installed on this
        phone and renewals found in SMS.
      </AppText>
    </View>
  );
}

export function Subscriptions() {
  const items = useSubscriptionStore((s) => s.items).filter((item) => !isUtilitySubId(item.id));
  const apps = items.filter((item) => item.note === 'app' || item.id.startsWith('app-')).length;

  return (
    <ScreenScaffold scroll={false}>
      <AppText variant="overline">Subscriptions</AppText>
      <AppText variant="h2">Recurring</AppText>
      {apps > 0 ? (
        <AppText variant="bodySmall">
          {apps} subscription app{apps === 1 ? '' : 's'} installed on this phone
        </AppText>
      ) : null}
      <FlatList
        contentContainerStyle={styles.list}
        style={styles.listFill}
        data={items}
        extraData={apps}
        keyExtractor={keyExtractor}
        ListEmptyComponent={EmptySubscriptions}
        renderItem={renderSubscription}
        showsVerticalScrollIndicator={false}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  listFill: {
    flex: 1,
  },
  list: {
    gap: spacing.md,
    flexGrow: 1,
    paddingBottom: 0,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    boxShadow: '0px 1px 3px rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.secondary[50],
    marginBottom: spacing.xs,
  },
  copy: {
    textAlign: 'center',
  },
});
