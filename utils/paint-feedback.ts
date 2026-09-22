/** Give React a paint before file lookups and native model setup begin. */
export function paintFeedback(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => { setTimeout(resolve, 0); }));
}
