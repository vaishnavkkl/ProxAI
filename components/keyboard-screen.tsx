import type { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function KeyboardScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={styles.fill} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>{children}</KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
