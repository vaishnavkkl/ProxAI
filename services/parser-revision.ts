import { clearProcessedHashes, getScanMeta, setScanMeta } from '@/services/database';
import { markLookbackExpanded } from '@/services/scan-window';
import { useProcessedStore } from '@/store/processed-store';
import { useSettingsStore } from '@/store/settings-store';

export const PARSER_VERSION = '15';

export async function ensureParserRevision(): Promise<boolean> {
  const current = await getScanMeta('parser_version');
  if (current === PARSER_VERSION) {
    return false;
  }

  // Re-scan for new modules without deleting the user's existing ledger or completed tasks.
  await clearProcessedHashes();
  useProcessedStore.getState().replaceAll([]);
  await markLookbackExpanded(useSettingsStore.getState().scanLookbackMonths);
  await setScanMeta('parser_version', PARSER_VERSION);
  return true;
}
