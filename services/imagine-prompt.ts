import { getScanMeta, setScanMeta } from '@/services/database';
import { TTI_PROMPTS } from '@/services/text-to-image-catalog';

const LAST_PROMPT_KEY = 'imagine_last_prompt';
const ROTATE_KEY = 'imagine_prompt_rotate';

let cachedLastPrompt = '';
let cachedRotate = 0;
let promptReady = false;
let promptHydrate: Promise<void> | null = null;

export const IMAGINE_SEED_MAX = 2_147_483_647;

export const IMAGINE_LOOKS = [
  { id: 'natural', label: 'Natural', icon: 'leaf-outline', tokens: ['natural lighting'] },
  { id: 'photo', label: 'Photo', icon: 'camera-outline', tokens: ['photorealistic', '8k'] },
  { id: 'cinema', label: 'Cinema', icon: 'film-outline', tokens: ['cinematic lighting'] },
  { id: 'illustration', label: 'Illustration', icon: 'brush-outline', tokens: ['digital illustration'] },
  { id: 'watercolor', label: 'Watercolor', icon: 'color-palette-outline', tokens: ['watercolor'] },
  { id: 'icon', label: 'Icon', icon: 'apps-outline', tokens: ['simple flat icon'] },
] as const;

export const IMAGINE_DETAILS = [
  { id: 'soft', label: 'Soft', icon: 'cloudy-outline', tokens: ['soft lighting'] },
  { id: 'balanced', label: 'Balanced', icon: 'options-outline', tokens: ['balanced composition'] },
  { id: 'extra', label: 'Extra', icon: 'sparkles-outline', tokens: ['highly detailed', 'sharp focus'] },
] as const;

export const DEFAULT_IMAGINE_LOOK = 'photo';
export const DEFAULT_IMAGINE_DETAIL = 'balanced';

export type ImagineLookId = (typeof IMAGINE_LOOKS)[number]['id'];
export type ImagineDetailId = (typeof IMAGINE_DETAILS)[number]['id'];

export const IMAGINE_SCENE_CHIPS = TTI_PROMPTS;

export type ImagineSuggestion = {
  id: string;
  label: string;
  prompt: string;
  icon: 'water-outline' | 'cafe-outline' | 'cash-outline' | 'scan-outline' | 'moon-outline' | 'rainy-outline' | 'expand-outline';
};

const STARTER_SUGGESTIONS: ImagineSuggestion[] = [
  { id: 'backwater', label: 'Backwater', prompt: TTI_PROMPTS[0], icon: 'water-outline' },
  { id: 'rupee', label: 'Rupee', prompt: TTI_PROMPTS[1], icon: 'cash-outline' },
  { id: 'chai', label: 'Chai', prompt: TTI_PROMPTS[2], icon: 'cafe-outline' },
  { id: 'forest', label: 'Forest', prompt: 'A winding path through a misty forest at sunrise', icon: 'rainy-outline' },
  { id: 'city', label: 'City lights', prompt: 'A quiet city street with glowing lights reflected on wet pavement', icon: 'moon-outline' },
  { id: 'space', label: 'Moon garden', prompt: 'A tiny glass garden on the moon with Earth on the horizon', icon: 'expand-outline' },
];

const STYLE_TAIL =
  /(?:,\s*)?(photorealistic|8k|cinematic lighting|digital illustration|watercolor|simple flat icon|soft lighting|highly detailed|sharp focus|natural lighting|balanced composition)(?:,\s*)?/gi;

export function parseImagineSeed(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > IMAGINE_SEED_MAX) {
    return undefined;
  }
  return parsed;
}

export function randomImagineSeed() {
  return Math.floor(Math.random() * (IMAGINE_SEED_MAX + 1));
}

function tokensForLook(id: string) {
  return IMAGINE_LOOKS.find((item) => item.id === id)?.tokens ?? [];
}

function tokensForDetail(id: string) {
  return IMAGINE_DETAILS.find((item) => item.id === id)?.tokens ?? [];
}

const LOOK_BOOST: Record<string, { lead: string; tail: string }> = {
  photo: { lead: 'A photorealistic photograph', tail: 'natural colors, sharp details, realistic lighting' },
  cinema: { lead: 'A cinematic film still', tail: 'dramatic lighting, shallow depth of field' },
  illustration: { lead: 'A digital illustration', tail: 'clean composition, vivid color' },
  watercolor: { lead: 'A watercolor painting', tail: 'paper texture, soft pigment' },
  icon: { lead: 'A simple flat icon', tail: 'centered, clean shapes, plain background' },
  natural: { lead: 'A natural photograph', tail: 'true-to-life colors, clear subject' },
};

const DETAIL_BOOST: Record<string, string> = {
  soft: 'soft lighting',
  balanced: 'centered subject',
  extra: 'highly detailed, sharp focus',
};

export function enhanceImaginePrompt(prompt: string, lookId: string, detailId: string) {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();
  const extra = [...tokensForLook(lookId), ...tokensForDetail(detailId)].filter(
    (token) => !lower.includes(token.toLowerCase()),
  );
  return [trimmed, ...extra].filter(Boolean).join(', ');
}

/** Stronger prompt sent to SDXS so the subject matches what the user typed. */
export function boostImaginePrompt(prompt: string, lookId: string, detailId: string) {
  const scene = stripImagineStyle(prompt);
  if (!scene) {
    return '';
  }
  const look = LOOK_BOOST[lookId] ?? LOOK_BOOST.photo;
  const detail = DETAIL_BOOST[detailId] ?? '';
  const subject = scene.replace(/^(a|an|the)\s+/i, '');
  const headed = `${look.lead} of ${subject}`;
  const bits = [headed];
  const lower = headed.toLowerCase();
  for (const extra of [look.tail, detail]) {
    if (!extra) {
      continue;
    }
    const first = extra.split(',')[0]?.trim().toLowerCase() ?? '';
    if (first && lower.includes(first)) {
      continue;
    }
    bits.push(extra);
  }
  return bits.join(', ');
}

export function stripImagineStyle(prompt: string) {
  return prompt
    .replace(STYLE_TAIL, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyImagineStyle(prompt: string, lookId: string, detailId: string) {
  return enhanceImaginePrompt(stripImagineStyle(prompt), lookId, detailId);
}

export function imagineSceneBase(prompt: string) {
  return prompt
    .replace(/^(a close-up of|a wide view of)\s+/i, '')
    .replace(/,\s*(at night, warm lights|light rain, wet surfaces|at sunrise, golden light|in a miniature diorama|with a bold monochrome palette|from a low angle, dramatic perspective)\s*/gi, '')
    .replace(STYLE_TAIL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function imagineSuggestions(lastPrompt: string, page = 0): ImagineSuggestion[] {
  const base = imagineSceneBase(lastPrompt);
  if (!base) {
    const offset = (page * 3) % STARTER_SUGGESTIONS.length;
    return [...STARTER_SUGGESTIONS.slice(offset), ...STARTER_SUGGESTIONS.slice(0, offset)].slice(0, 3);
  }
  const ideas: ImagineSuggestion[] = [
    { id: 'closer', label: 'Closer', prompt: `A close-up of ${base}`, icon: 'scan-outline' },
    { id: 'night', label: 'Night', prompt: `${base}, at night, warm lights`, icon: 'moon-outline' },
    { id: 'rain', label: 'Rain', prompt: `${base}, light rain, wet surfaces`, icon: 'rainy-outline' },
    { id: 'wide', label: 'Wider', prompt: `A wide view of ${base}`, icon: 'expand-outline' },
    { id: 'sunrise', label: 'Sunrise', prompt: `${base}, at sunrise, golden light`, icon: 'water-outline' },
    { id: 'miniature', label: 'Miniature', prompt: `${base}, in a miniature diorama`, icon: 'scan-outline' },
    { id: 'monochrome', label: 'Monochrome', prompt: `${base}, with a bold monochrome palette`, icon: 'moon-outline' },
    { id: 'low-angle', label: 'Low angle', prompt: `${base}, from a low angle, dramatic perspective`, icon: 'expand-outline' },
  ];
  // The subject chooses the initial set; More ideas cycles through alternatives.
  const subjectHash = [...base].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 0);
  const offset = (subjectHash + page * 4) % ideas.length;
  return [...ideas.slice(offset), ...ideas.slice(0, offset)].slice(0, 4);
}

export function lastImaginePrompt() {
  return cachedLastPrompt;
}

export function nextImaginePrompt(lastPrompt: string, rotate = 0) {
  const ideas = imagineSuggestions(lastPrompt);
  if (!ideas.length) {
    return '';
  }
  const index = ((rotate % ideas.length) + ideas.length) % ideas.length;
  return ideas[index]?.prompt ?? '';
}

export function rememberImaginePrompt(prompt: string) {
  cachedLastPrompt = prompt.trim();
  promptReady = true;
  void setScanMeta(LAST_PROMPT_KEY, cachedLastPrompt);
}

export async function hydrateImaginePrompt() {
  if (promptReady) {
    return;
  }
  if (!promptHydrate) {
    promptHydrate = (async () => {
      const [last, rotate] = await Promise.all([getScanMeta(LAST_PROMPT_KEY), getScanMeta(ROTATE_KEY)]);
      if (promptReady) {
        return;
      }
      cachedLastPrompt = last ?? '';
      const parsed = Number.parseInt(rotate ?? '0', 10);
      cachedRotate = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      promptReady = true;
    })().finally(() => {
      promptHydrate = null;
    });
  }
  return promptHydrate;
}

export function takeNextImaginePrompt() {
  const prompt = nextImaginePrompt(cachedLastPrompt, cachedRotate);
  const count = imagineSuggestions(cachedLastPrompt).length;
  cachedRotate = count ? (cachedRotate + 1) % count : 0;
  void setScanMeta(ROTATE_KEY, String(cachedRotate));
  return prompt;
}
