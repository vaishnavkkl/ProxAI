/** Detect repeated suffixes without changing ordinary repeated words or lists. */
export function trimModelLoop(text: string): string | null {
  const offset = Math.max(0, text.length - 3000);
  const words = [...text.slice(offset).matchAll(/\S+/g)];
  const normalized = words.map((word) => word[0].toLowerCase().replace(/[.,!?;:]+$/g, ''));
  for (let size = 1; size <= Math.min(32, Math.floor(words.length / 3)); size += 1) {
    const repeats = size < 3 ? 6 : 3;
    const start = words.length - size * repeats;
    if (start < 0) continue;
    const phrase = normalized.slice(start, start + size);
    if (size >= 3 && (new Set(phrase).size < 3 || phrase.join(' ').length < 16)) continue;
    if (!phrase.some((word) => /\p{L}/u.test(word))) continue;
    if (normalized.slice(start).every((word, index) => word === phrase[index % size])) {
      return text.slice(0, offset + words[start + size].index).trimEnd();
    }
  }
  return null;
}
