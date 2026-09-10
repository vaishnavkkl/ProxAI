import { getFinlifeNative } from '@/services/finlife-native';

export async function saveImagineImage(uri: string) {
  const native = getFinlifeNative();
  if (!native?.saveGeneratedImage) {
    throw new Error('Saving to Photos needs the updated Android build. Run npx expo run:android once.');
  }
  return native.saveGeneratedImage(uri);
}
