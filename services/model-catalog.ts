export type BuiltinModelId =
  | 'smollm2_135m'
  | 'qwen2_5_0_5b'
  | 'smollm2_360m'
  | 'lfm2_5_350m'
  | 'qwen2_5_1_5b';

export type ModelId = BuiltinModelId | 'custom';

export type ModelSources = {
  model: string;
  tokenizer: string;
  tokenizerConfig: string;
};

export type CatalogModel = {
  id: ModelId;
  label: string;
  sizeHint: string;
  ramHint: string;
  note: string;
  recommended?: boolean;
  warn?: boolean;
  sources?: ModelSources;
};

const HF = 'https://huggingface.co/software-mansion';
const TAG = 'resolve/v0.9.0';

export const MODEL_SOURCE_ORG = `${HF}`;
export const MODEL_SOURCE_DOCS =
  'https://software-mansion-react-native-executorch.mintlify.app/core-concepts/resource-fetching';
export const MODEL_EXPORT_DOCS = 'https://docs.pytorch.org/executorch/1.1/llm/export-llm.html';

export const DEFAULT_MODEL_ID: BuiltinModelId = 'qwen2_5_0_5b';

export const CATALOG: CatalogModel[] = [
  {
    id: 'smollm2_135m',
    label: 'SmolLM2 135M 8da4w',
    sizeHint: '~80 MB',
    ramHint: '~150 MB RAM',
    note: 'Fastest. Lowest RAM. Good for older phones.',
    sources: {
      model: `${HF}/react-native-executorch-smolLm-2/${TAG}/135m/xnnpack/smollm2_135m_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen2_5_0_5b',
    label: 'Qwen2.5 0.5B 8da4w',
    sizeHint: '~200 MB',
    ramHint: '~300 MB RAM',
    note: 'Recommended default. Best quality for mid-range Android.',
    recommended: true,
    sources: {
      model: `${HF}/react-native-executorch-qwen-2.5/${TAG}/0_5b/xnnpack/qwen_2_5_0_5b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'smollm2_360m',
    label: 'SmolLM2 360M 8da4w',
    sizeHint: '~180 MB',
    ramHint: '~280 MB RAM',
    note: 'Balanced size and quality. Stays near the 300 MB budget.',
    sources: {
      model: `${HF}/react-native-executorch-smolLm-2/${TAG}/360m/xnnpack/smollm2_360m_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'lfm2_5_350m',
    label: 'LFM2.5 350M 8da4w',
    sizeHint: '~180 MB',
    ramHint: '~280 MB RAM',
    note: 'Small instruct model. Strong JSON-style answers.',
    sources: {
      model: `${HF}/react-native-executorch-lfm-2.5/${TAG}/350m/xnnpack/lfm_2_5_350m_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-lfm-2.5/${TAG}/350m/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-lfm-2.5/${TAG}/350m/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen2_5_1_5b',
    label: 'Qwen2.5 1.5B 8da4w',
    sizeHint: '~700 MB',
    ramHint: '~1.2 GB RAM',
    note: 'Higher quality. Needs more storage and RAM.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-qwen-2.5/${TAG}/1_5b/xnnpack/qwen_2_5_1_5b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'custom',
    label: 'Custom ExecuTorch URL',
    sizeHint: 'You choose',
    ramHint: 'Depends on the .pte',
    note: 'Paste three HTTPS links from Hugging Face or your own export.',
  },
];

export const CUSTOM_URL_HELP = [
  'You need three HTTPS files, not one:',
  '1. Model .pte — pick an xnnpack *8da4w.pte (quantized, Android).',
  '2. tokenizer.json',
  '3. tokenizer_config.json',
  '',
  'Official source (Software Mansion):',
  MODEL_SOURCE_ORG,
  '',
  'Open a model repo, then Files and versions → v0.9.0. Tap a file and copy the resolve URL.',
  '',
  'Example .pte:',
  `${HF}/react-native-executorch-qwen-2.5/${TAG}/0_5b/xnnpack/qwen_2_5_0_5b_xnnpack_8da4w.pte`,
  '',
  'Export your own:',
  MODEL_EXPORT_DOCS,
].join('\n');

export function getCatalogModel(id: ModelId): CatalogModel {
  return CATALOG.find((item) => item.id === id) ?? CATALOG[1];
}

export function isModelId(value: string): value is ModelId {
  return CATALOG.some((item) => item.id === value);
}

export function isHttpsUrl(value: string): boolean {
  return /^https:\/\/\S+$/i.test(value.trim());
}

export function resolveModelSources(input: {
  modelId: ModelId;
  customModelUrl: string;
  customTokenizerUrl: string;
  customTokenizerConfigUrl: string;
}): ModelSources | null {
  if (input.modelId === 'custom') {
    const model = input.customModelUrl.trim();
    const tokenizer = input.customTokenizerUrl.trim();
    const tokenizerConfig = input.customTokenizerConfigUrl.trim();
    if (!isHttpsUrl(model) || !isHttpsUrl(tokenizer) || !isHttpsUrl(tokenizerConfig)) {
      return null;
    }
    return { model, tokenizer, tokenizerConfig };
  }

  return getCatalogModel(input.modelId).sources ?? null;
}
