import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EventRow } from '@/components/event-row';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { importDeviceCalendar } from '@/services/device-calendar';
import { useEventStore } from '@/store/event-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';

function keyExtractor(item: LedgerItem) {
  return item.id;
}

function renderEvent({ item }: { item: LedgerItem }) {
  return <EventRow item={item} />;
}

function EmptyEvents() {
  return (
    <View style={styles.empty}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.semantic.warning} name="calendar-outline" size={28} />
      </View>
      <AppText variant="h4">No upcoming events</AppText>
      <AppText style={styles.copy} variant="bodyRegular">
        Refresh reads SMS plus the next 90 days from Google Calendar on this
        phone. Import here does the same calendar pass again.
      </AppText>
    </View>
  );
}

export function Events() {
  const items = useEventStore((s) => s.items);
  const setToast = useUiStore((s) => s.setToast);
  const [importing, setImporting] = useState(false);

  return (
    <ScreenScaffold scroll={false}>
      <AppText variant="overline">Events</AppText>
      <AppText variant="h2">Reminders</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Import device calendar"
        disabled={importing}
        onPress={() => {
          if (importing) {
            return;
          }
          setImporting(true);
          void importDeviceCalendar()
            .then((count) => {
              setToast({
                kind: 'success',
                message:
                  count > 0
                    ? `Imported ${count} calendar event${count === 1 ? '' : 's'}.`
                    : 'No new events in the next 90 days.',
              });
            })
            .catch((error: unknown) => {
              setToast({
                kind: 'error',
                message: error instanceof Error ? error.message : 'Calendar import failed',
              });
            })
            .finally(() => {
              setImporting(false);
            });
        }}
        style={[styles.importBtn, importing ? styles.importBtnDisabled : null]}>
        <Ionicons
          color={importing ? colors.neutral[400] : colors.primary[500]}
          name="download-outline"
          size={18}
        />
        <AppText style={importing ? styles.importLabelDisabled : styles.importLabel} variant="labelRegular">
          {importing ? 'Importing…' : 'Import calendar'}
        </AppText>
      </Pressable>
      <FlatList
        contentContainerStyle={styles.list}
        style={styles.listFill}
        data={items}
        keyExtractor={keyExtractor}
        ListEmptyComponent={EmptyEvents}
        renderItem={renderEvent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[100],
    gap: spacing.sm,
  },
  importBtnDisabled: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
  },
  importLabel: {
    color: colors.neutral[900],
  },
  importLabelDisabled: {
    color: colors.neutral[400],
  },
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
    backgroundColor: colors.semantic.warningLight,
    marginBottom: spacing.xs,
  },
  copy: {
    textAlign: 'center',
  },
});
