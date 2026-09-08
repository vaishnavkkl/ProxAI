import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { LedgerDetailHost } from '@/components/ledger-detail-host';
import { NotificationToast } from '@/components/notification-toast';
import { setupExecutorch } from '@/services/executorch-setup';
import { hydrateApp } from '@/services/hydrate';
import { colors } from '@/styles';

setupExecutorch();

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

const finLifeTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary[500],
    background: colors.neutral[0],
    card: colors.neutral[0],
    text: colors.neutral[900],
    border: colors.neutral[400],
    notification: colors.primary[500],
  },
};

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [hydrated, setHydrated] = useState(false);

  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (!ready) {
      return;
    }
    void hydrateApp()
      .catch(() => undefined)
      .finally(() => {
        setHydrated(true);
        void SplashScreen.hideAsync();
      });
  }, [ready]);

  if (!ready || !hydrated) {
    return null;
  }

  return (
    <ThemeProvider value={finLifeTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="processing"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.45, 0.7],
          }}
        />
        <Stack.Screen
          name="coach"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
      <LedgerDetailHost />
      <NotificationToast />
    </ThemeProvider>
  );
}
