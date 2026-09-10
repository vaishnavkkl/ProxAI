export function formatRamMb(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) {
    return '0 MB';
  }
  if (mb < 1024) {
    return `${Math.round(mb)} MB`;
  }
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function transferLabel(name: string, received: number, total: number, ratio: number): string {
  const percent = Math.max(
    0,
    Math.min(100, Math.round((total > 0 ? received / total : ratio) * 100)),
  );
  if (total > 0) {
    return `${name} · ${formatBytes(received)} / ${formatBytes(total)} · ${percent}%`;
  }
  return `${name} · ${percent}%`;
}
