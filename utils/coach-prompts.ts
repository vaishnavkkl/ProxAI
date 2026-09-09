import type { SpendPlan } from '@/utils/spend-coach';
import { formatInr } from '@/utils/format-inr';

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
  if (/\b(spend this month|how should i spend|leftover)\b/.test(question)) {
    return 'spend';
  }
  return 'start';
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

export function nextCoachPrompts(lastUser: string | null, plan: SpendPlan): string[] {
  const top = plan.topCategory;
  const start = [
    'What is on my agenda today?',
    'What tasks still need me?',
    'Any travel or deliveries coming up?',
    'How does my income compare to spending?',
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
      'How much can I spend each day?',
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
      `I have ${formatInr(plan.remaining)} left — can I afford a weekend trip?`,
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
      'How does my income compare to spending?',
    ],
    compare: [
      `How do I keep ${formatInr(plan.remaining)} leftover?`,
      `How do I reach ${formatInr(plan.saveMonthly)} saved?`,
      top ? `Should I cut ${top} first?` : 'Where should I cut first?',
      'What is left after my bills?',
    ],
    spend: [
      `Can I still spend ${formatInr(plan.daily)} a day?`,
      top ? `How do I cut ${top}?` : 'Where should I cut first?',
      `How do I reach ${formatInr(plan.saveMonthly)} saved?`,
      'What is left after my bills?',
    ],
    daily: [
      "Am I over today's safe cap already?",
      'What if I spend nothing for 3 days?',
      top ? `Does ${top} blow the daily cap?` : 'Which category blows the daily cap?',
      `How much is left of ${formatInr(plan.remaining)}?`,
    ],
    save: [
      'What one spend should I skip this week?',
      top ? `If I halve ${top}, how much do I save?` : 'Which category funds the save target?',
      'Should I pay an EMI early or save first?',
      `Is ${formatInr(plan.saveMonthly)} realistic this month?`,
    ],
    cut: [
      'Which merchant should I pause?',
      `How much daily spend stays after the cut?`,
      'Can I still hit the save target?',
      'Compare grocery vs dining this month',
    ],
    income: [
      'How much of my paycheck is already spent?',
      'What is left after bills and EMI?',
      `How much can I spend each day?`,
      'How much should I save from this paycheck?',
    ],
    bills: [
      'Which bill is eating the paycheck?',
      'Are my subscriptions worth keeping?',
      'What leftover remains after fixed bills?',
      'Should I pause a subscription this month?',
    ],
    afford: [
      `I have ${formatInr(plan.remaining)} left — can I afford a weekend trip?`,
      'What should I cut to free ₹2,000?',
      'Will a big purchase break the daily cap?',
      'How does that change my save target?',
    ],
  };

  return uniquePrompts([...follow[topic], ...start], lastUser);
}

export function clipCoachSnapshot(text: string, max = 1400) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trim()}\n[truncated]`;
}
