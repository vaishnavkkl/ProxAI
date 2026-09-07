import { StatusBar } from 'expo-status-bar';

import { Splash } from '@/screens/splash';

export default function SplashRoute() {
  return (
    <>
      <StatusBar style="light" />
      <Splash />
    </>
  );
}
