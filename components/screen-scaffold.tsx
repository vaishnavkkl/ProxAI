import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/styles';
import { KeyboardScreen } from '@/components/keyboard-screen';

type ScreenScaffoldProps = {
  children: ReactNode;
  scroll?: boolean;
};

export function ScreenScaffold({ children, scroll = true }: ScreenScaffoldProps) {
  const body = <View style={[styles.content, scroll ? undefined : styles.contentFill]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardScreen>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={styles.static}>{body}</View>
      )}
      </KeyboardScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  static: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 0,
  },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  contentFill: {
    flex: 1,
  },
});
