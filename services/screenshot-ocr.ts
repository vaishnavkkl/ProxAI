import { getFinlifeNative } from '@/services/finlife-native';
import { useSettingsStore } from '@/store/settings-store';

export type OcrLanguage = 'en' | 'ml';

export function ocrVersion(language: OcrLanguage): string {
  return language === 'ml' ? 'tesseract-4.9.0-mal-eng-fast-87416418-v2' : 'mlkit-latin-16.0.1-4096-v1';
}

/** Both gallery/camera and folder scans use the same explicit offline language. */
export async function recognizeImageText(
  uri: string,
  language: OcrLanguage = useSettingsStore.getState().ocrLanguage,
): Promise<string> {
  const native = getFinlifeNative();
  if (language === 'ml') {
    if (!native?.recognizeMalayalamScreenshot) {
      throw new Error('Malayalam OCR needs the updated Android build. Run npx expo run:android once.');
    }
    return native.recognizeMalayalamScreenshot(uri);
  }
  if (!native?.recognizeScreenshot) {
    throw new Error('Image OCR needs the updated Android development build.');
  }
  return native.recognizeScreenshot(uri);
}
