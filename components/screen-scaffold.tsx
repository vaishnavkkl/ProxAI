import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardScreen } from '@/components/keyboard-screen';
import { colors, layout, spacing } from '@/styles';
import { bottomSafeInset } from '@/utils/safe-area';

type ScreenScaffoldProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Extra bottom inset for stack screens. Tab screens already clear the nav bar via the tab bar. */
  stack?: boolean;
  embedded?: boolean;
};

export function ScreenScaffold({ children, scroll = true, stack = false, embedded = false }: ScreenScaffoldProps) {
  const insets = useSafeAreaInsets();
  const bottom = spacing['2xl'] + (stack ? bottomSafeInset(insets.bottom) : 0);
  const body = <View style={[styles.content, scroll ? undefined : styles.contentFill]}>{children}</View>;

  return (
    <SafeAreaView edges={embedded ? [] : ['top']} style={styles.safe}>
      <KeyboardScreen>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom }]}
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.static, stack ? { paddingBottom: bottomSafeInset(insets.bottom) } : undefined]}>
            {body}
          </View>
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
