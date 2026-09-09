export type BuiltinModelId =
  | 'smollm2_135m_bf16'
  | 'smollm2_135m'
  | 'qwen2_5_0_5b'
  | 'hammer2_1_0_5b'
  | 'qwen3_0_6b'
  | 'smollm2_360m'
  | 'lfm2_5_350m'
  | 'lfm2_5_vl_450m'
  | 'qwen3_5_0_8b'
  | 'llama3_2_1b'
  | 'qwen2_5_1_5b'
  | 'qwen3_1_7b'
  | 'lfm2_5_1_2b'
  | 'gemma4_e2b'
  | 'qwen3_5_2b'
  | 'phi4_mini_4b';

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
  license?: string;
  modelBytes?: number;
  recommended?: boolean;
  warn?: boolean;
  compact?: boolean;
  sources?: ModelSources;
};

const HF = 'https://huggingface.co/software-mansion';
const TAG = 'resolve/v0.10.0';

export const MODEL_SOURCE_ORG = `${HF}`;
export const MODEL_SOURCE_DOCS =
  'https://software-mansion-react-native-executorch.mintlify.app/core-concepts/resource-fetching';
export const MODEL_EXPORT_DOCS = 'https://docs.pytorch.org/executorch/1.1/llm/export-llm.html';

export const DEFAULT_MODEL_ID: BuiltinModelId = 'qwen2_5_0_5b';

export const CATALOG: CatalogModel[] = [
  {
    id: 'smollm2_135m_bf16',
    label: 'SmolLM2 135M 8da8w',
    sizeHint: '~0.55 GB model + tokenizer',
    modelBytes: 560000000,
    ramHint: 'Small parameter count; runtime export is larger than Qwen2.5 0.5B',
    license: 'Apache 2.0',
    compact: true,
    note: 'Legacy settings id kept for compatibility. Same 0.10 export as SmolLM2 135M 8da8w below.',
    sources: {
      model: `${HF}/react-native-executorch-smolLm-2/${TAG}/135m/xnnpack/smollm2_135m_xnnpack_8da8w.pte`,
      tokenizer: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'smollm2_135m',
    label: 'SmolLM2 135M 8da8w',
    sizeHint: '~0.55 GB model + tokenizer',
    modelBytes: 560000000,
    ramHint: 'RAM varies by device and context',
    license: 'Apache 2.0',
    compact: true,
    note: 'Small parameter count, but this 0.10 export is larger than Qwen2.5 0.5B.',
    sources: {
      model: `${HF}/react-native-executorch-smolLm-2/${TAG}/135m/xnnpack/smollm2_135m_xnnpack_8da8w.pte`,
      tokenizer: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen2_5_0_5b',
    label: 'Qwen2.5 0.5B 8da4w',
    sizeHint: '417 MB model + tokenizer',
    modelBytes: 417495168,
    ramHint: 'RAM varies by device and context',
    license: 'Apache 2.0',
    compact: true,
    note: 'Existing default. Smallest verified download in this catalog; rules handle clear notices first.',
    recommended: true,
    sources: {
      model: `${HF}/react-native-executorch-qwen-2.5/${TAG}/0_5b/xnnpack/qwen_2_5_0_5b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'hammer2_1_0_5b',
    label: 'Hammer 2.1 0.5B 8da4w',
    sizeHint: '~0.4 GB model + tokenizer',
    modelBytes: 417000000,
    ramHint: 'Close to the 0.5B default; measure on your phone',
    license: 'MIT',
    compact: true,
    note: 'Newer 0.5B assistant model. Fits older phones; optional next to Qwen2.5 0.5B.',
    sources: {
      model: `${HF}/react-native-executorch-hammer-2.1/${TAG}/0_5b/xnnpack/hammer_2_1_0_5b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-hammer-2.1/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-hammer-2.1/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen3_0_6b',
    label: 'Qwen3 0.6B 8da4w',
    sizeHint: '~0.6 GB model + tokenizer',
    modelBytes: 650000000,
    ramHint: 'Close to the 0.5B default; measure on your phone',
    license: 'Apache 2.0',
    compact: true,
    note: 'Newer Qwen generation. Good next step if 0.5B misses unstructured SMS.',
    sources: {
      model: `${HF}/react-native-executorch-qwen-3/${TAG}/0_6b/xnnpack/qwen_3_0_6b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-3/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-3/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'lfm2_5_350m',
    label: 'LFM2.5 350M 8da4w',
    sizeHint: '454 MB model + tokenizer',
    modelBytes: 453885568,
    ramHint: 'Publisher reports under 1 GB; runtime varies',
    license: 'LFM Open License 1.0',
    compact: true,
    note: 'Research pick for structured extraction. Quality on your notices still needs evaluation; Malayalam is not a listed language.',
    sources: {
      model: `${HF}/react-native-executorch-lfm-2.5/${TAG}/350m/xnnpack/lfm_2_5_350m_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-lfm-2.5/${TAG}/350m/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-lfm-2.5/${TAG}/350m/tokenizer_config.json`,
    },
  },
  {
    id: 'lfm2_5_vl_450m',
    label: 'LFM2.5 VL 450M 8da4w',
    sizeHint: '~0.6 GB vision-language export',
    modelBytes: 600000000,
    ramHint: 'Vision weights; text scan quality is experimental',
    license: 'LFM Open License 1.0',
    note: 'Multimodal export. SMS Refresh still sends text only. Prefer a text model unless you are experimenting.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-lfm-2.5/${TAG}/vl_450m/xnnpack/lfm_2_5_vl_450m_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-lfm-2.5/${TAG}/vl_450m/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-lfm-2.5/${TAG}/vl_450m/tokenizer_config.json`,
    },
  },
  {
    id: 'smollm2_360m',
    label: 'SmolLM2 360M 8da8w',
    sizeHint: '1.36 GB model + tokenizer',
    modelBytes: 1363730688,
    ramHint: 'High memory use; measure on your phone',
    license: 'Apache 2.0',
    note: 'This specific ExecuTorch export is much larger than its parameter count suggests.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-smolLm-2/${TAG}/360m/xnnpack/smollm2_360m_xnnpack_8da8w.pte`,
      tokenizer: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-smolLm-2/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen3_5_0_8b',
    label: 'Qwen3.5 0.8B 8da4w',
    sizeHint: '1.41 GB model + tokenizer',
    modelBytes: 1412986112,
    ramHint: 'Advanced option; high memory use',
    license: 'Apache 2.0',
    note: 'Newer multilingual candidate. Text extraction only here. Not benchmarked on your phone; download is optional.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-qwen-3.5/${TAG}/0_8b/xnnpack/qwen_3_5_0_8b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-3.5/${TAG}/0_8b/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-3.5/${TAG}/0_8b/tokenizer_config.json`,
    },
  },
  {
    id: 'llama3_2_1b',
    label: 'Llama 3.2 1B SpinQuant',
    sizeHint: '~1.1 GB model + tokenizer',
    modelBytes: 1100000000,
    ramHint: 'High memory use; measure on your phone',
    license: 'Llama 3.2 Community License',
    note: 'Meta Llama 3.2 1B SpinQuant. Review the license before downloading. Not the default for SMS JSON.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-llama-3.2/${TAG}/1b/xnnpack/llama_3_2_1b_xnnpack_spinquant.pte`,
      tokenizer: `${HF}/react-native-executorch-llama-3.2/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-llama-3.2/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen2_5_1_5b',
    label: 'Qwen2.5 1.5B 8da4w',
    sizeHint: '1.14 GB model + tokenizer',
    modelBytes: 1136177792,
    ramHint: 'High memory use; measure on your phone',
    license: 'Apache 2.0',
    note: 'Higher quality. Needs more storage and RAM.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-qwen-2.5/${TAG}/1_5b/xnnpack/qwen_2_5_1_5b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-2.5/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen3_1_7b',
    label: 'Qwen3 1.7B 8da4w',
    sizeHint: '~1.3 GB model + tokenizer',
    modelBytes: 1300000000,
    ramHint: 'High memory use; measure on your phone',
    license: 'Apache 2.0',
    note: 'Larger Qwen3 text model. Download only with enough free RAM.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-qwen-3/${TAG}/1_7b/xnnpack/qwen_3_1_7b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-3/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-3/${TAG}/tokenizer_config.json`,
    },
  },
  {
    id: 'lfm2_5_1_2b',
    label: 'LFM2.5 1.2B Instruct 8da4w',
    sizeHint: '~1.2 GB model + tokenizer',
    modelBytes: 1200000000,
    ramHint: 'High memory use; measure on your phone',
    license: 'LFM Open License 1.0',
    note: 'Instruct-tuned Liquid model. Larger than 350M; optional on 6 GB phones.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-lfm-2.5/${TAG}/1_2b/xnnpack/lfm_2_5_1_2b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-lfm-2.5/${TAG}/1_2b/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-lfm-2.5/${TAG}/1_2b/tokenizer_config.json`,
    },
  },
  {
    id: 'gemma4_e2b',
    label: 'Gemma 4 E2B 8da4w',
    sizeHint: '~1.9 GB XNNPACK export',
    modelBytes: 1900000000,
    ramHint: 'High memory use; Android uses XNNPACK, not Vulkan',
    license: 'Gemma Terms of Use',
    note: 'Catalog pins the XNNPACK file so this phone does not download the Vulkan Android default.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-gemma-4/${TAG}/e2b/xnnpack/gemma_4_e2b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-gemma-4/${TAG}/e2b/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-gemma-4/${TAG}/e2b/tokenizer_config.json`,
    },
  },
  {
    id: 'qwen3_5_2b',
    label: 'Qwen3.5 2B 8da4w',
    sizeHint: '~2 GB model + tokenizer',
    modelBytes: 2000000000,
    ramHint: 'Very high memory use',
    license: 'Apache 2.0',
    note: 'Largest Qwen3.5 option in this list. Loading is blocked when the OS has too little free RAM.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-qwen-3.5/${TAG}/2b/xnnpack/qwen_3_5_2b_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-qwen-3.5/${TAG}/2b/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-qwen-3.5/${TAG}/2b/tokenizer_config.json`,
    },
  },
  {
    id: 'phi4_mini_4b',
    label: 'Phi-4 Mini 4B 8da4w',
    sizeHint: '~2.8 GB model + tokenizer',
    modelBytes: 2800000000,
    ramHint: 'Likely too large for 6 GB phones while other apps are open',
    license: 'MIT',
    note: 'Biggest catalog option. Settings will refuse to load it if free RAM is too low. Your saved items stay.',
    warn: true,
    sources: {
      model: `${HF}/react-native-executorch-phi-4-mini/${TAG}/xnnpack/phi_4_mini_xnnpack_8da4w.pte`,
      tokenizer: `${HF}/react-native-executorch-phi-4-mini/${TAG}/tokenizer.json`,
      tokenizerConfig: `${HF}/react-native-executorch-phi-4-mini/${TAG}/tokenizer_config.json`,
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
  'Open a model repo, then Files and versions → v0.10.0. Tap a file and copy the resolve URL.',
  '',
  'Example .pte:',
  `${HF}/react-native-executorch-qwen-2.5/${TAG}/0_5b/xnnpack/qwen_2_5_0_5b_xnnpack_8da4w.pte`,
  '',
  'Export your own:',
  MODEL_EXPORT_DOCS,
].join('\n');

export function getCatalogModel(id: ModelId): CatalogModel {
  return CATALOG.find((item) => item.id === id) ?? CATALOG.find((item) => item.id === DEFAULT_MODEL_ID) ?? CATALOG[0];
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
