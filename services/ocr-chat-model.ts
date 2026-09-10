import {
  DEFAULT_MALAYALAM_MODEL_ID,
  chatCatalogForOcr,
  getCatalogModel,
  isMalayalamChatModel,
  malayalamChatModels,
  resolveModelSources,
  type ModelId,
} from '@/services/model-catalog';
import { hasCachedSources } from '@/services/model-storage';
import type { OcrLanguage } from '@/services/screenshot-ocr';
import { useSettingsStore } from '@/store/settings-store';

export function chatModelsForOcr(language: OcrLanguage) {
  return chatCatalogForOcr(language);
}

export function preferredMalayalamChatModel(): ModelId {
  const settings = useSettingsStore.getState();
  if (isMalayalamChatModel(settings.modelId)) {
    return settings.modelId;
  }
  const downloaded = malayalamChatModels().find((item) =>
    hasCachedSources(
      resolveModelSources({
        modelId: item.id,
        customModelUrl: settings.customModelUrl,
        customTokenizerUrl: settings.customTokenizerUrl,
        customTokenizerConfigUrl: settings.customTokenizerConfigUrl,
      }),
    ),
  );
  return (
    downloaded?.id ??
    malayalamChatModels().find((item) => item.defaultReplyLanguage === 'ml')?.id ??
    DEFAULT_MALAYALAM_MODEL_ID
  );
}

/** When Malayalam OCR is on, chat must use a Malayalam model, not an English-only one. */
export function ensureChatModelForOcr() {
  const settings = useSettingsStore.getState();
  if (settings.ocrLanguage !== 'ml') {
    return settings.modelId;
  }
  const next = preferredMalayalamChatModel();
  if (next !== settings.modelId) {
    settings.setModelId(next);
  }
  return next;
}

export function chatModelLabelForOcr(language: OcrLanguage) {
  if (language !== 'ml') {
    return getCatalogModel(useSettingsStore.getState().modelId).label;
  }
  return getCatalogModel(preferredMalayalamChatModel()).label;
}
