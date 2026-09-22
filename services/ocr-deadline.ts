import { MODEL_TIMEOUT_MESSAGE } from '@/services/model-deadline';
import { useUiStore } from '@/store/ui-store';

let pending = false;
/** Native OCR cannot be disposed mid-call. Keep its slot until it settles. */
export async function runOcrTask(work: () => Promise<string>): Promise<string> {
  if (pending) throw new Error('The previous image is still being released. Please try again shortly.');
  pending = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const operation = Promise.resolve().then(work).finally(() => { pending = false; });
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      useUiStore.getState().setToast({ kind: 'error', message: MODEL_TIMEOUT_MESSAGE });
      reject(new Error(MODEL_TIMEOUT_MESSAGE));
    }, 60_001);
  });
  try { return await Promise.race([operation, timeout]); }
  finally { clearTimeout(timer); }
}
