import { LedgerDetailSheet } from '@/components/ledger-detail-sheet';
import { useEventStore } from '@/store/event-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';

export function LedgerDetailHost() {
  const selectedLedgerId = useUiStore((s) => s.selectedLedgerId);
  const setSelectedLedgerId = useUiStore((s) => s.setSelectedLedgerId);
  const transactions = useTransactionStore((s) => s.items);
  const events = useEventStore((s) => s.items);
  const subscriptions = useSubscriptionStore((s) => s.items);
  const item =
    transactions.find((row) => row.id === selectedLedgerId) ??
    events.find((row) => row.id === selectedLedgerId) ??
    subscriptions.find((row) => row.id === selectedLedgerId) ??
    null;

  return (
    <LedgerDetailSheet
      item={item}
      onClose={() => {
        setSelectedLedgerId(null);
      }}
    />
  );
}
