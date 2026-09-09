import { requireOptionalNativeModule } from 'expo-modules-core';

type KeepAwakeNative = {
  activate?: (tag: string) => Promise<void>;
};

/**
 * Expo's withDevTools hook calls keep-awake without .catch(). On Android that
 * rejects when the Activity is gone (Metro reload after a redbox, lock screen).
 */
function silenceKeepAwakeActivate() {
  const native = requireOptionalNativeModule<KeepAwakeNative>('ExpoKeepAwake');
  const activate = native?.activate;
  if (!native || typeof activate !== 'function') {
    return;
  }
  native.activate = async (tag: string) => {
    try {
      await activate.call(native, tag);
    } catch {
      // Current activity missing — screen can still sleep; app continues.
    }
  };
}

if (__DEV__ && process.env.EXPO_OS !== 'web') {
  silenceKeepAwakeActivate();
}
