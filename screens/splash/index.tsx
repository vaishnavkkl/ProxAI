import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, View, type ViewProps } from 'react-native';

import { LogoLoader } from '@/components/logo-loader';
import { BRAND_BACKGROUND } from '@/styles/brand';

export function Splash({ onLayout }: Pick<ViewProps, 'onLayout'>) {
  return (
    <View onLayout={onLayout} style={styles.root}>
      <StatusBar style="light" />
      <LogoLoader size={264} />
      <Image accessibilityLabel="ProxAI" accessibilityRole="image"
        source={require('@/assets/images/splash-wordmark.png')} resizeMode="contain" style={styles.wordmark} />
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { width: 232, height: 56 },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_BACKGROUND,
  },
});
