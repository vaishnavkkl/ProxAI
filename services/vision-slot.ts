import { useUiStore } from '@/store/ui-store';

type UnloadFn = () => Promise<void>;

let unloadFn: UnloadFn = async () => undefined;
let loaded = false;

export function registerVisionUnload(fn: UnloadFn) {
  unloadFn = fn;
}

export function markVisionLoaded(value: boolean) {
  loaded = value;
  useUiStore.getState().setImageInRam(value);
}

export function isVisionLoaded() {
  return loaded;
}

export async function unloadVisionFromMemory() {
  await unloadFn();
  loaded = false;
  useUiStore.getState().setImageInRam(false);
}
