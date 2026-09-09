import * as ImagePicker from 'expo-image-picker';

import { recognizeImageText } from '@/services/screenshot-ocr';

export async function pickImageUri(source: 'gallery' | 'camera'): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission was not granted.');
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) {
      return null;
    }
    return result.assets[0]?.uri ?? null;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access was not granted.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled) {
    return null;
  }
  return result.assets[0]?.uri ?? null;
}

export async function recognizePickedImage(uri: string): Promise<string> {
  return recognizeImageText(uri);
}
