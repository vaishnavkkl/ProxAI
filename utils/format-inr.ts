export function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '—';
  }

  return `₹${Math.round(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function signedInr(amount: number): string {
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${formatInr(Math.abs(amount))}`;
}

export function toInrText(text: string): string {
  return text
    .replace(/\bU\.?S\.?\s*dollars?\b/gi, 'rupees')
    .replace(/\bUSD\b/gi, 'INR')
    .replace(/\bUS\$/g, '₹')
    .replace(/\$(\s*)(\d)/g, '₹$1$2')
    .replace(/\$/g, '₹');
}
