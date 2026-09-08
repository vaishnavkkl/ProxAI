import { LedgerDetailSheet } from '@/components/ledger-detail-sheet';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { effectiveItem } from '@/utils/life-agenda';
import { confirmedRenewals } from '@/utils/renewals';
import { normalizeEvent } from '@/utils/relevant-events';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { regionalHolidays } from '@/utils/regional-holidays';

export function LedgerDetailHost() {
  const selectedLedgerId = useUiStore((s) => s.selectedLedgerId);
  const setSelectedLedgerId = useUiStore((s) => s.setSelectedLedgerId);
  const transactions = useTransactionStore((s) => s.items);
  const events = useEventStore((s) => s.items);
  const subscriptions = useSubscriptionStore((s) => s.items);
  const life = useLifeStore((s) => s.items);
  const states = useLifeStore((s) => s.states);
  const item =
    transactions.find((row) => row.id === selectedLedgerId) ??
    events.find((row) => row.id === selectedLedgerId) ??
    subscriptions.find((row) => row.id === selectedLedgerId) ??
    life.find((row) => row.id === selectedLedgerId) ??
    (selectedLedgerId?.startsWith('holiday-') ? regionalHolidays().find((row) => row.id === selectedLedgerId) : null) ??
    null;

  return (
    <LedgerDetailSheet
      item={item ? effectiveItem(item.type === 'subscription' ? confirmedRenewals([item], states)[0] ?? item : item.type === 'event' ? normalizeEvent(item) : item, states) : null}
      onClose={() => {
        setSelectedLedgerId(null);
      }}
    />
  );
}
