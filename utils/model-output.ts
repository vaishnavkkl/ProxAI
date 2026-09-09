const markers = ['<|im_start|>', '<|im_end|>', '<|endoftext|>'];

/** Hide ChatML framing, including headers split across streaming callbacks. */
export function cleanCoachOutput(text: string): string {
  let clean = '';
  let offset = 0;
  while (offset < text.length) {
    const start = text.indexOf('<|', offset);
    if (start < 0) {
      clean += text.slice(offset);
      break;
    }
    clean += text.slice(offset, start);
    const rest = text.slice(start);
    const marker = markers.find((value) => rest.startsWith(value));
    if (!marker) {
      if (markers.some((value) => value.startsWith(rest))) break;
      clean += '<|';
      offset = start + 2;
      continue;
    }
    offset = start + marker.length;
    if (marker === '<|im_start|>') {
      const header = text.slice(offset);
      // Do not display a model-invented next user/system turn.
      if (/^(user|system)\b/.test(header)) break;
      if ('assistant'.startsWith(header)) break;
      const role = /^assistant\b\s*/.exec(header);
      if (role) offset += role[0].length;
    }
  }
  // A token boundary can fall before the pipe in a control marker.
  return clean.endsWith('<') ? clean.slice(0, -1) : clean;
}
