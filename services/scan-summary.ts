import { getScanMeta, setScanMeta } from '@/services/database';
import { useScanSummaryStore, type ScanSummary } from '@/store/scan-summary-store';

const KEY = 'last_scan_summary';

function asSummary(value: unknown): ScanSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as ScanSummary;
  if (!Number.isFinite(row.at) || typeof row.modelLabel !== 'string') {
    return null;
  }
  return {
    at: row.at,
    modelLabel: row.modelLabel,
    usedModel: Boolean(row.usedModel),
    transactions: Number(row.transactions) || 0,
    events: Number(row.events) || 0,
    subscriptions: Number(row.subscriptions) || 0,
    life: Number(row.life) || 0,
    regex: Number(row.regex) || 0,
    model: Number(row.model) || 0,
    dropped: Number(row.dropped) || 0,
  };
}

export async function loadScanSummary(): Promise<ScanSummary | null> {
  const raw = await getScanMeta(KEY);
  if (!raw) {
    return null;
  }
  try {
    return asSummary(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveScanSummary(summary: ScanSummary) {
  await setScanMeta(KEY, JSON.stringify(summary));
  useScanSummaryStore.getState().replace(summary);
}
