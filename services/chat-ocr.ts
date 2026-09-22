import { Image } from 'expo-image';

import { getFinlifeNative } from '@/services/finlife-native';
import { pickImageUri } from '@/services/image-ocr';
import { useSettingsStore } from '@/store/settings-store';
import { runOcrTask } from '@/services/ocr-deadline';

let scanning = false;

/** Keep the chat session resident, but release image resources between scans. */
export async function captureChatText(source: 'camera' | 'gallery', isActive: () => boolean): Promise<string | null> {
  if (scanning) return null;
  const native = getFinlifeNative();
  if (!native?.beginChatOcr || !native.endChatOcr || !native.recognizeChatImage) {
    throw new Error('Chat OCR needs the updated Android build. Rebuild and install the app first.');
  }
  scanning = true;
  const malayalam = useSettingsStore.getState().ocrLanguage === 'ml';
  try {
    // Wait for foreground protection before the picker backgrounds the activity.
    await native.beginChatOcr();
    await Image.clearMemoryCache().catch(() => false);
    if (!isActive()) return null;
    const uri = await pickImageUri(source);
    if (!uri || !isActive()) return null;
    return await runOcrTask(() => native.recognizeChatImage!(uri, malayalam));
  } finally {
    // Never unload the LLM or retain a decoded photo in the chat sheet.
    try { await native.endChatOcr(); } finally { scanning = false; }
  }
}
