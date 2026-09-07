import { Share } from 'react-native';

export async function shareText(message: string, title = 'ProxAI'): Promise<boolean> {
  try {
    await Share.share({ message, title });
    return true;
  } catch {
    return false;
  }
}
