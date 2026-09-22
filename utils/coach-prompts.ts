import type { SpendPlan } from '@/utils/spend-coach';

export type CoachTopic =
  | 'start'
  | 'today'
  | 'tasks'
  | 'travel'
  | 'delivery'
  | 'security'
  | 'compare'
  | 'spend'
  | 'daily'
  | 'save'
  | 'cut'
  | 'income'
  | 'bills'
  | 'afford';

export function detectCoachTopic(text: string): CoachTopic {
  const question = text.toLowerCase();
  // Match Malayalam topics before clipping the snapshot, so long finance rows
  // cannot hide the user's tasks or travel when they ask in Malayalam.
  if (/ഇന്നത്തെ (പരിപാടി|പദ്ധതി|കാര്യ)|ഇന്ന് എന്തൊക്കെ|അജണ്ട/.test(question)) return 'today';
  if (/ചെയ്യേണ്ട|ചെയ്യാനുള്ള|ടാസ്ക്/.test(question)) return 'tasks';
  if (/യാത്ര|ട്രെയിൻ|വിമാനം|ടിക്കറ്റ്|ഹോട്ടൽ/.test(question)) return 'travel';
  if (/പാർസൽ|ഡെലിവറി|കൊറിയർ/.test(question)) return 'delivery';
  if (/തട്ടിപ്പ്|സുരക്ഷ|ഫിഷിംഗ്/.test(question)) return 'security';
  if (/ബില്ല്|ബിൽ|വാടക|സബ്സ്ക്രിപ്ഷൻ/.test(question)) return 'bills';
  if (/\b(agenda|what('s| is) on|my day|today('s)? (plan|task|event|list))\b/.test(question)) {
    return 'today';
  }
  if (/\b(task|to-?do|still need me|overdue)\b/.test(question)) {
    return 'tasks';
  }
  if (/\b(travel|flight|hotel|pnr|train|ticket)\b/.test(question)) {
    return 'travel';
  }
  if (/\b(deliver|package|shipment|courier)\b/.test(question)) {
    return 'delivery';
  }
  if (/\b(scam|phish|otp|security|suspicious)\b/.test(question)) {
    return 'security';
  }
  if (/\b(compare|income vs|versus|left after|paycheck vs)\b/.test(question)) {
    return 'compare';
  }
  if (/\b(save|saving|set aside|target)\b/.test(question)) {
    return 'save';
  }
  if (/\b(each day|daily|per day|safe cap|spend today)\b/.test(question)) {
    return 'daily';
  }
  if (/\b(overspend|cut|why is|so high|where am i|dining|grocery)\b/.test(question)) {
    return 'cut';
  }
  if (/\b(afford|trip|buy|weekend|emi early)\b/.test(question)) {
    return 'afford';
  }
  if (/\b(income|paycheck|salary|credited)\b/.test(question)) {
    return 'income';
  }
  if (/\b(bill|rent|emi|fixed|subscription)\b/.test(question)) {
    return 'bills';
  }
  if (/\b(financ\w*|money|spen[dt]\w*|expenses?|transactions?|debits?|credits?|balance|budget|bank|accounts?|leftover|paid|payments?|how much)\b/.test(question) || /പണം|ചെലവ്|വരുമാനം|ശമ്പളം|ബാങ്ക്/.test(question)) {
    return 'spend';
  }
  return 'start';
}

const LIFE_TOPICS = new Set<CoachTopic>(['today', 'tasks', 'travel', 'delivery', 'security', 'bills']);
const FINANCE_TOPICS = new Set<CoachTopic>(['compare', 'spend', 'daily', 'save', 'cut', 'income', 'afford']);

/** Attach saved facts for questions about the user's plans or finances. */
export function questionNeedsUserData(text: string): boolean {
  if (LIFE_TOPICS.has(detectCoachTopic(text)) || FINANCE_TOPICS.has(detectCoachTopic(text))) {
    return true;
  }
  const question = text.toLowerCase();
  return /\b(my (day|tasks?|plans?|agenda)|what do i have coming)\b/.test(question);
}

function uniquePrompts(prompts: string[], hide: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const prompt of prompts) {
    if (!prompt || prompt === hide || seen.has(prompt)) {
      continue;
    }
    seen.add(prompt);
    out.push(prompt);
    if (out.length === 4) {
      break;
    }
  }
  return out;
}

export function nextCoachPrompts(lastUser: string | null, _plan: SpendPlan): string[] {
  const start = [
    'What is on my agenda today?',
    'What tasks still need me?',
    'Any travel or deliveries coming up?',
    'Which bills are due soon?',
  ];

  if (!lastUser) {
    return start;
  }

  const topic = detectCoachTopic(lastUser);
  const follow: Record<CoachTopic, string[]> = {
    start,
    today: [
      'What tasks still need me?',
      'Any travel or deliveries coming up?',
      'Which bills are due soon?',
      'Remind me about upcoming events',
    ],
    tasks: [
      'What is overdue?',
      'What is on my agenda today?',
      'Remind me about upcoming events',
      'Which bills are due soon?',
    ],
    travel: [
      'What is on my agenda today?',
      'Any packages on the way?',
      'What tasks still need me?',
      'Which bills are due soon?',
    ],
    delivery: [
      'What is on my agenda today?',
      'Any travel coming up?',
      'What tasks still need me?',
      'Which bills are due soon?',
    ],
    security: [
      'What should I do about a suspicious message?',
      'What is on my agenda today?',
      'Which bills are due soon?',
      'What tasks still need me?',
    ],
    compare: start,
    spend: start,
    daily: start,
    save: start,
    cut: start,
    income: start,
    bills: [
      'Which bills are due soon?',
      'What is on my agenda today?',
      'What tasks still need me?',
      'Any travel or deliveries coming up?',
    ],
    afford: start,
  };

  return uniquePrompts([...follow[topic], ...start], lastUser);
}

export function clipCoachSnapshot(text: string, max = 1400) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trim()}\n[truncated]`;
}

/** Keep task/travel facts from being crowded out by long transaction lists. */
export function selectCoachSnapshot(text: string, question: string, max = 1400): string {
  if (!questionNeedsUserData(question)) {
    return '';
  }
  const topic = detectCoachTopic(question);
  const sectionPatterns: Partial<Record<CoachTopic, RegExp>> = {
    today: /^(Upcoming events|Tasks|Travel|Deliveries|Due bills|Other plans):/i,
    tasks: /^(Tasks|Other plans):/i,
    travel: /^(Travel|Upcoming events):/i,
    delivery: /^Deliveries:/i,
    security: /^Security to review:/i,
    bills: /^(Due bills|Fixed expenses|Renewals):/i,
  };
  const pattern = FINANCE_TOPICS.has(topic)
    ? /^(Finance|Budget|Categories|Transactions|Accounts|Fixed expenses|Renewals):/i
    : sectionPatterns[topic];
  if (!pattern) return clipCoachSnapshot(text, max);
  const lines = text.split('\n');
  const relevant = lines.filter((line) => pattern.test(line));
  const context = lines.filter((line) => /^(Month|Today):/i.test(line));
  if (relevant.length === 0) {
    return [...context, 'No saved details for this topic in the current snapshot.'].join('\n');
  }
  // Share the budget between relevant sections so one long line cannot hide
  // every other type of plan. Leave room for labels and truncation indicators.
  const available = Math.max(0, max - context.join('\n').length - context.length);
  const perLine = Math.max(1, Math.floor(available / relevant.length) - 1);
  return [...context, ...relevant.map((line) => line.length <= perLine
    ? line : clipCoachSnapshot(line, Math.max(0, perLine - 13)))].join('\n');
}

/** Conservative input byte allowance plus the 256-token reply and framing. */
export function coachContextReserve(input: string): number {
  let bytes = 0;
  for (const char of input) {
    const code = char.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return Math.max(512, bytes + 320);
}
