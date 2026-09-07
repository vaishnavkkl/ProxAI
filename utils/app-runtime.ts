import Constants, { ExecutionEnvironment } from 'expo-constants';

export function isExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  );
}

export function canUseNativeLlm(): boolean {
  if (process.env.EXPO_OS === 'web') {
    return false;
  }
  return !isExpoGo();
}
