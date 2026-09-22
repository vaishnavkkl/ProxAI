type SuggestionMessage = { role: 'user' | 'assistant'; text: string; pending?: boolean };

export const GENERIC_CHAT_SUGGESTIONS = ['Rephrase this', 'Summarize this', 'Create an email from this'];

/** Only the latest exchange participates; streaming text must not shuffle chips. */
export function latestSuggestionContext(messages: SuggestionMessage[]): string {
  const latestUser = messages.findLastIndex((message) => message.role === 'user');
  if (latestUser < 0) return '';
  return messages.slice(latestUser)
    .filter((message) => message.role === 'user' || !message.pending)
    .map((message) => message.text)
    .join('\n\n');
}

const CONTEXT_SUGGESTIONS: [RegExp, string[]][] = [
  [/\b(email|dear|regards|subject|reply|letter)\b/i, ['Draft a reply', 'Make the tone more professional', 'Suggest a subject line']],
  [/\b(invoice|receipt|bill|amount|payment|paid|total|due)\b|₹/i, ['Extract dates and amounts', 'List payment deadlines', 'Explain the charges']],
  [/\b(flight|train|travel|booking|ticket|pnr|hotel)\b/i, ['List booking details', 'Create a travel checklist', 'Extract departure and arrival times']],
  [/\b(task|meeting|agenda|deadline|appointment|schedule)\b/i, ['Extract action items', 'List dates and deadlines', 'Turn this into a checklist']],
  [/\b(delivery|package|shipment|courier|tracking)\b/i, ['Extract tracking details', 'Find the expected delivery date']],
  [/\b(scam|phishing|otp|suspicious|security)\b/i, ['Identify warning signs', 'What should I do next?']],
  [/\b(code|error|function|exception|bug)\b/i, ['Explain the error', 'Suggest a fix', 'Show an example']],
  [/\b(recipe|ingredients|cooking)\b/i, ['List the ingredients', 'Turn this into cooking steps']],
  [/\b(translate|translation|malayalam)\b|[\u0D00-\u0D7F]/i, ['Translate this into English', 'Explain unfamiliar words']],
  [/\b(summarize|summary|key points)\b/i, ['Expand the key points', 'Turn this into bullet points']],
  [/\b(rephrase|rewrite|wording)\b/i, ['Make this more concise', 'Make the tone more professional']],
];

/** Local suggestions avoid a second inference or model load after every reply. */
export function chatSuggestions(context: string, currentText = ''): string[] {
  const candidates: string[] = [];
  // A new scan can repeat the previous custom OCR task verbatim.
  const previousTask = currentText.trim()
    ? context.match(/^(.+?)\. Work only from this OCR text; there is no image\./)?.[1]?.trim()
    : undefined;
  if (previousTask && previousTask.length <= 120) candidates.push(previousTask);
  // Recent conversation takes priority, with the newly selected OCR text as context.
  for (const source of [context, currentText]) {
    // Ignore OCR framing so its language instruction does not dominate topics.
    const content = source.replace(/Work only from this OCR text; there is no image\.(?: Reply in Malayalam script\.)?/g, '');
    const matches = CONTEXT_SUGGESTIONS.filter(([pattern]) => pattern.test(content));
    // Take one from each matching topic before adding more from the same topic.
    for (let index = 0; index < 3; index += 1) {
      for (const [, suggestions] of matches) {
        if (suggestions[index]) candidates.push(suggestions[index]);
      }
    }
  }
  if (context.trim() || currentText.trim()) {
    candidates.push('Explain this in simple terms', 'What should I do next?', 'Give an example');
  } else {
    candidates.push('What is on my agenda today?', 'What tasks still need me?', 'Any travel or deliveries coming up?');
  }
  const dynamic = [...new Set(candidates)].filter((prompt) =>
    !GENERIC_CHAT_SUGGESTIONS.includes(prompt) &&
    (prompt === previousTask || !context.toLowerCase().includes(prompt.toLowerCase())),
  ).slice(0, 3);
  return [...GENERIC_CHAT_SUGGESTIONS, ...dynamic];
}
