import { cacheNameFromUrl as cacheFileNameFromUrl } from '@/services/model-storage';

export type TtiVariantId = 'xnnpack' | 'coreml';

export type TtiSources = {
  modelPath: string;
  tokenizerPath: string;
};

export type TtiVariant = {
  id: TtiVariantId;
  label: string;
  modelName: string;
  imageSize: number;
  tag: string;
  hint: string;
  backend: string;
  platform: 'android' | 'ios' | 'all';
  downloadBytes: number;
  ramHint: string;
  warn?: boolean;
};

const HF = 'https://huggingface.co/software-mansion/react-native-executorch';
const TAG = 'resolve/v0.10.0';
const TOKENIZER = `${HF}-sdxs-512-dreamshaper/${TAG}/tokenizer.json`;

export const TTI_MODEL_NAME = 'SDXS 512 DreamShaper';

export const TTI_VARIANTS: TtiVariant[] = [
  {
    id: 'xnnpack',
    label: 'XNNPACK FP32',
    modelName: TTI_MODEL_NAME,
    imageSize: 512,
    tag: 'CPU',
    hint: 'Single-step 512×512 on CPU. Chat stays available while downloading; image generation uses the model slot.',
    backend: 'XNNPACK',
    platform: 'all',
    downloadBytes: 1_764_217_317,
    ramHint: 'Chat unloads first. CPU inference.',
    warn: true,
  },
  {
    id: 'coreml',
    label: 'Core ML FP16',
    modelName: TTI_MODEL_NAME,
    imageSize: 512,
    tag: 'iOS',
    hint: 'Apple Neural Engine export. Not used on Android builds.',
    backend: 'Core ML',
    platform: 'ios',
    downloadBytes: 884_329_352,
    ramHint: 'iOS Neural Engine. Chat unloads first.',
  },
];

export const DEFAULT_TTI_VARIANT: TtiVariantId = 'xnnpack';

export const TTI_PROMPTS = [
  'A watercolor Kerala backwater at dusk',
  'A simple flat icon of a rupee coin',
  'A photorealistic cup of chai on a wooden table',
];

export function isTtiVariantId(value: string | null | undefined): value is TtiVariantId {
  return value === 'xnnpack' || value === 'coreml';
}

export function getTtiVariant(id: TtiVariantId) {
  return TTI_VARIANTS.find((item) => item.id === id) ?? TTI_VARIANTS[0];
}

export function ttiVariantSupported(id: TtiVariantId) {
  const item = getTtiVariant(id);
  const os = process.env.EXPO_OS;
  if (item.platform === 'ios') {
    return os === 'ios';
  }
  if (item.platform === 'android') {
    return os === 'android';
  }
  return true;
}

export function ttiSourcesFor(id: TtiVariantId): TtiSources {
  const tokenizerPath = TOKENIZER;
  if (id === 'coreml') {
    return {
      modelPath: `${HF}-sdxs-512-dreamshaper/${TAG}/coreml/sdxs_512_dreamshaper_coreml_fp16.pte`,
      tokenizerPath,
    };
  }
  return {
    modelPath: `${HF}-sdxs-512-dreamshaper/${TAG}/xnnpack/sdxs_512_dreamshaper_xnnpack_fp32.pte`,
    tokenizerPath,
  };
}

export { cacheFileNameFromUrl };

export function ttiCacheNames(sources: TtiSources) {
  return [cacheFileNameFromUrl(sources.modelPath), cacheFileNameFromUrl(sources.tokenizerPath)];
}

export function isCachedTti(sources: TtiSources, files: Map<string, number>) {
  return ttiCacheNames(sources).every((name) => (files.get(name) ?? 0) > 0);
}
