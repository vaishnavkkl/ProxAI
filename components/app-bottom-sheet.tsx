import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { KeyboardScreen } from '@/components/keyboard-screen';
import { borderRadius, colors, layout, spacing } from '@/styles';
import { bottomSafeInset } from '@/utils/safe-area';

type AppBottomSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  headerRight?: ReactNode;
};

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 900;

export function AppBottomSheet({ visible, title, onClose, children, accessibilityLabel, headerRight }: AppBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.set(0);
    }
  }, [visible, translateY]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((event) => {
      translateY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
        return;
      }
      translateY.set(withTiming(0, { duration: 200 }));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
          onPress={onClose}
          style={styles.backdrop}
        />
        <Animated.View style={[styles.sheet, sheetStyle, { paddingTop: insets.top }]}>
          <KeyboardScreen>
            <GestureDetector gesture={pan}>
              <View>
                <View style={styles.handle} />
                <View style={styles.bar}>
                  <AppText style={styles.title} variant="h3">
                    {title}
                  </AppText>
                  {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel ?? `Close ${title}`}
                    onPress={onClose}
                    style={styles.iconBtn}>
                    <Ionicons color={colors.neutral[900]} name="close" size={22} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
            <ScrollView
              contentContainerStyle={[styles.body, { paddingBottom: spacing['3xl'] + bottomSafeInset(insets.bottom) }]}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.scroll}>
              {children}
            </ScrollView>
          </KeyboardScreen>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
    boxShadow: '0px 20px 25px rgba(0,0,0,0.15)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[400],
    marginTop: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    flex: 1,
  },
  headerRight: {
    flexShrink: 0,
  },
  iconBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
  scroll: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
});
