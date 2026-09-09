import { getScanMeta, setScanMeta } from '@/services/database';
import { DEFAULT_MODEL_ID, isModelId, type ModelId } from '@/services/model-catalog';
import { DEFAULT_WINDOWS, parseWindows, type ScheduleWindow } from '@/services/llm-schedule';
import { DEFAULT_TTI_VARIANT, isTtiVariantId, type TtiVariantId } from '@/services/text-to-image-catalog';

export type ScanLookbackMonths = 1 | 2 | 3 | 6;

export type AppSettings = {
  offlineMode: boolean;
  privacyOn: boolean;
  modelId: ModelId;
  customModelUrl: string;
  customTokenizerUrl: string;
  customTokenizerConfigUrl: string;
  windows: ScheduleWindow[];
  scanLookbackMonths: ScanLookbackMonths;
  googleAccount: string;
  remindersOn: boolean;
  ttiVariantId: TtiVariantId;
};

const KEYS = {
  offline: 'offline_mode',
  privacy: 'privacy_on',
  modelId: 'model_id',
  customModel: 'custom_model_url',
  customTokenizer: 'custom_tokenizer_url',
  customTokenizerConfig: 'custom_tokenizer_config_url',
  schedule: 'llm_schedule',
  lookback: 'scan_lookback_months',
  googleAccount: 'google_account',
  reminders: 'reminders_on',
  ttiVariant: 'tti_variant_id',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  offlineMode: true,
  privacyOn: true,
  modelId: DEFAULT_MODEL_ID,
  customModelUrl: '',
  customTokenizerUrl: '',
  customTokenizerConfigUrl: '',
  windows: DEFAULT_WINDOWS,
  scanLookbackMonths: 1,
  googleAccount: '',
  remindersOn: true,
  ttiVariantId: DEFAULT_TTI_VARIANT,
};

function asFlag(value: string | null, fallback: boolean): boolean {
  if (value == null) {
    return fallback;
  }
  return value === '1';
}

export async function loadAppSettings(): Promise<AppSettings> {
  const [
    offline,
    privacy,
    modelId,
    customModel,
    customTokenizer,
    customTokenizerConfig,
    schedule,
    lookback,
    googleAccount,
    reminders,
    ttiVariant,
  ] = await Promise.all([
    getScanMeta(KEYS.offline),
    getScanMeta(KEYS.privacy),
    getScanMeta(KEYS.modelId),
    getScanMeta(KEYS.customModel),
    getScanMeta(KEYS.customTokenizer),
    getScanMeta(KEYS.customTokenizerConfig),
    getScanMeta(KEYS.schedule),
    getScanMeta(KEYS.lookback),
    getScanMeta(KEYS.googleAccount),
    getScanMeta(KEYS.reminders),
    getScanMeta(KEYS.ttiVariant),
  ]);

  const lookbackMonths = Number(lookback);
  const scanLookbackMonths: ScanLookbackMonths =
    lookbackMonths === 2 || lookbackMonths === 3 || lookbackMonths === 6 ? lookbackMonths : 1;

  return {
    offlineMode: asFlag(offline, true),
    privacyOn: asFlag(privacy, true),
    modelId: modelId && isModelId(modelId) ? modelId : DEFAULT_MODEL_ID,
    customModelUrl: customModel ?? '',
    customTokenizerUrl: customTokenizer ?? '',
    customTokenizerConfigUrl: customTokenizerConfig ?? '',
    windows: parseWindows(schedule),
    scanLookbackMonths,
    googleAccount: googleAccount ?? '',
    remindersOn: asFlag(reminders, true),
    ttiVariantId: ttiVariant && isTtiVariantId(ttiVariant) ? ttiVariant : DEFAULT_TTI_VARIANT,
  };
}

export async function persistSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  switch (key) {
    case 'offlineMode':
      await setScanMeta(KEYS.offline, value ? '1' : '0');
      return;
    case 'privacyOn':
      await setScanMeta(KEYS.privacy, value ? '1' : '0');
      return;
    case 'modelId':
      await setScanMeta(KEYS.modelId, String(value));
      return;
    case 'customModelUrl':
      await setScanMeta(KEYS.customModel, String(value));
      return;
    case 'customTokenizerUrl':
      await setScanMeta(KEYS.customTokenizer, String(value));
      return;
    case 'customTokenizerConfigUrl':
      await setScanMeta(KEYS.customTokenizerConfig, String(value));
      return;
    case 'windows':
      await setScanMeta(KEYS.schedule, JSON.stringify(value));
      return;
    case 'scanLookbackMonths':
      await setScanMeta(KEYS.lookback, String(value));
      return;
    case 'googleAccount':
      await setScanMeta(KEYS.googleAccount, String(value));
      return;
    case 'remindersOn':
      await setScanMeta(KEYS.reminders, value ? '1' : '0');
      return;
    case 'ttiVariantId':
      await setScanMeta(KEYS.ttiVariant, String(value));
      return;
    default:
      return;
  }
}
