import { exclusiveInference } from '@/services/inference-slot';
import { useUiStore } from '@/store/ui-store';

export const MODEL_TIMEOUT_MESSAGE = 'Process terminated because model loading or processing took longer than one minute. Please try again.';
export const MODEL_DRAINING_MESSAGE = 'The previous model process is still stopping. You can leave this screen and try again shortly.';
let draining = false;
export function isModelTaskDraining() { return draining; }
export function isModelTimeout(error: unknown) {
  return error instanceof Error && (error.message === MODEL_TIMEOUT_MESSAGE || error.message === MODEL_DRAINING_MESSAGE);
}

/** Release the UI at the deadline, but keep native work serialized until it actually stops. */
export async function runModelTask<T>(work: (signal: AbortSignal) => Promise<T>, stop: () => void, cleanup: () => Promise<unknown>): Promise<T> {
  if (draining) throw new Error(MODEL_DRAINING_MESSAGE);
  const controller = new AbortController();
  let expired = false;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const nativeWork = exclusiveInference(async () => {
    if (controller.signal.aborted) throw new Error(MODEL_TIMEOUT_MESSAGE);
    started = true;
    try { return await work(controller.signal); }
    finally {
      if (expired) {
        try { await cleanup(); } finally { draining = false; }
      }
    }
  });
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      expired = true;
      if (started) draining = true;
      controller.abort();
      reject(new Error(MODEL_TIMEOUT_MESSAGE));
      useUiStore.getState().setToast({ kind: 'error', message: MODEL_TIMEOUT_MESSAGE });
      // Do not interrupt a different operation if this task was only queued.
      if (started) { try { stop(); } catch { /* Already stopped. */ } }
    }, 60_001);
  });
  try { return await Promise.race([nativeWork, deadline]); }
  finally { clearTimeout(timer); }
}
