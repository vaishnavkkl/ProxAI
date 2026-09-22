export type OcrBlock = {
  id: string;
  text: string;
  kind: 'text' | 'break';
};

// Unidentified OCR junk and layout glyphs only. Keep everyday marks such as @ { [ ] # * ` ~ ^ < > in the sentence.
const SPECIAL_RUN =
  /[\uFFFD\uFFFC\u2500-\u259F\u25A0-\u25FF\uE000-\uF8FF|¦¤§◆□■○●★◇▶►◄▼▲]{1,}/g;

function pushText(blocks: OcrBlock[], value: string) {
  const paragraphs = value.replace(/\r\n/g, '\n').split(/\n{2,}/);
  for (const paragraph of paragraphs) {
    const text = paragraph.replace(/[ \t]+\n/g, '\n').trim();
    if (!text) {
      continue;
    }
    blocks.push({ id: `ocr-${blocks.length}`, text, kind: 'text' });
  }
}

export function splitOcrBlocks(text: string): OcrBlock[] {
  const source = text.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
  if (!source.trim()) {
    return [];
  }
  const blocks: OcrBlock[] = [];
  let last = 0;
  SPECIAL_RUN.lastIndex = 0;
  let match = SPECIAL_RUN.exec(source);
  while (match) {
    pushText(blocks, source.slice(last, match.index));
    blocks.push({ id: `ocr-${blocks.length}`, text: match[0], kind: 'break' });
    last = match.index + match[0].length;
    match = SPECIAL_RUN.exec(source);
  }
  pushText(blocks, source.slice(last));
  return blocks;
}

export function ocrTextBlocks(text: string): OcrBlock[] {
  return splitOcrBlocks(text).filter((block) => block.kind === 'text');
}

export function selectedOcrText(blocks: OcrBlock[], selected: Record<string, boolean>): string {
  const picked = blocks.filter((block) => block.kind === 'text' && selected[block.id]);
  const source = picked.length > 0 ? picked : blocks.filter((block) => block.kind === 'text');
  return source
    .map((block) => block.text)
    .join('\n\n')
    .trim();
}

export function ocrCoachQuestion(instruction: string, excerpt: string, language: 'en' | 'ml' = 'en'): string {
  const task = instruction.trim();
  const body = excerpt.replace(/\s+/g, ' ').trim().slice(0, 900);
  const locale = language === 'ml' ? ' Reply in Malayalam script.' : '';
  const lead = task
    ? `${task}. Work only from this OCR text; there is no image.`
    : 'Work only from this OCR text; there is no image.';
  return `${lead}${locale}\n\n${body}`;
}

export function isScreenshotAlbum(name: string): boolean {
  return /screenshot/i.test(name);
}

export function defaultImageFolders(albums: { name: string }[]): string[] {
  const shots = albums.filter((album) => isScreenshotAlbum(album.name)).map((album) => album.name);
  return shots.length > 0 ? shots : ['Screenshots'];
}
