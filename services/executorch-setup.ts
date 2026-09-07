import { canUseNativeLlm } from '@/utils/app-runtime';

export function setupExecutorch() {
  if (!canUseNativeLlm()) {
    return;
  }

  try {
    const { initExecutorch } = require('react-native-executorch') as typeof import('react-native-executorch');
    const { ExpoResourceFetcher } =
      require('react-native-executorch-expo-resource-fetcher') as typeof import('react-native-executorch-expo-resource-fetcher');
    initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  } catch {
    // Development build without the native binary still boots.
  }
}
