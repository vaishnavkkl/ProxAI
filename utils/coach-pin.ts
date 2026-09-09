export const MAX_COACH_PINS = 4;
export const COACH_PIN_MAX_CHARS = 110;

export type CoachPin = {
  id: string;
  messageId: string;
  summary: string;
  at: number;
};

export function formatCoachTime(at: number): string {
  if (!Number.isFinite(at) || at <= 0) {
    return '';
  }
  return new Date(at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function summarizeCoachPin(text: string): string {
  let source = text.replace(/\s+/g, ' ').trim();
  const ocrSplit = source.split(/Work only from this OCR text[^.\n]*\./i);
  if (ocrSplit.length > 1) {
    source = ocrSplit[0].replace(/\.\s*$/, '').trim();
  }
  source = source.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  if (!source) {
    return 'Pinned from assistant';
  }
  const sentences = source.split(/(?<=[.!?])\s+/).filter(Boolean);
  let summary = (sentences[0] ? sentences.slice(0, 2).join(' ') : source).trim();
  if (summary.length > COACH_PIN_MAX_CHARS) {
    summary = `${summary.slice(0, COACH_PIN_MAX_CHARS - 1).replace(/\s+\S*$/, '').trim()}…`;
  }
  return summary || 'Pinned from assistant';
}
