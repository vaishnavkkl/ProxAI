import '@/utils/keep-awake-guard';

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
import { setupReminderChannels, subscribeReminderActions, syncPlanReminders } from '@/services/reminders';
import { colors } from '@/styles';

setupExecutorch();

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
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
    if (!hydrated) {
      return;
    }
    const sub = subscribeReminderActions();
    return () => sub.remove();
  }, [hydrated]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void hydrateApp()
      .catch(() => undefined)
      .then(async () => {
        try {
          await setupReminderChannels();
          await syncPlanReminders();
        } catch {
          // Notification native module can be missing during a reload.
        }
      })
      .finally(() => {
        setHydrated(true);
        void SplashScreen.hideAsync().catch(() => undefined);
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
            sheetAllowedDetents: [1],
            sheetCornerRadius: 16,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="coach"
          dangerouslySingular
          options={{
            presentation: 'card',
            animation: 'slide_from_bottom',
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="imagine"
          options={{
            presentation: 'card',
            animation: 'slide_from_bottom',
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="screenshots"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
            headerShown: false,
            gestureEnabled: true,
          }}
        />
      </Stack>
      <LedgerDetailHost />
      <NotificationToast />
    </ThemeProvider>
  );
}
