import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { borderRadius, colors, layout } from '@/styles';

export function ScreenBack({ accessibilityLabel = 'Go back' }: { accessibilityLabel?: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => {
        router.back();
      }}
      style={styles.btn}>
      <Ionicons color={colors.neutral[900]} name="chevron-back" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
});
