import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppText } from '@/components/app-text';
import { borderRadius, colors, layout, spacing } from '@/styles';

export function ScreenBack({
  accessibilityLabel = 'Go back',
  tone = 'light',
}: {
  accessibilityLabel?: string;
  tone?: 'light' | 'inverse';
}) {
  const router = useRouter();
  const inverse = tone === 'inverse';
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => {
        router.back();
      }}
      style={[styles.btn, inverse ? styles.btnInverse : undefined]}>
      <Ionicons color={inverse ? colors.primary[700] : colors.neutral[900]} name="chevron-back" size={22} />
      {inverse ? (
        <AppText style={styles.inverseLabel} variant="labelRegular">
          Back
        </AppText>
      ) : null}
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
    flexShrink: 0,
  },
  btnInverse: {
    width: undefined,
    minWidth: layout.touchTarget,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
  },
  inverseLabel: {
    color: colors.primary[700],
  },
});
