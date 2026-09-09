import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

export type DialogAction = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
};

type AppDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  actions: DialogAction[];
  onClose: () => void;
};

export function AppDialog({ visible, title, message, actions, onClose }: AppDialogProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <GestureHandlerRootView style={styles.root}>
        <Pressable accessibilityLabel="Dismiss dialog" accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
        <View style={styles.card}>
          <AppText variant="h3">{title}</AppText>
          <AppText variant="bodyRegular">{message}</AppText>
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                accessibilityRole="button"
                key={action.label}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                style={[
                  styles.button,
                  action.tone === 'danger' ? styles.danger : action.tone === 'primary' ? styles.primary : styles.secondary,
                ]}>
                <AppText
                  style={action.tone === 'secondary' || !action.tone ? styles.secondaryLabel : styles.primaryLabel}
                  variant="labelLarge">
                  {action.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    gap: spacing.md,
    zIndex: 1,
    boxShadow: '0px 20px 25px rgba(0,0,0,0.15)',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary[500],
  },
  secondary: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[400],
  },
  danger: {
    backgroundColor: colors.semantic.danger,
  },
  primaryLabel: {
    color: colors.neutral[0],
  },
  secondaryLabel: {
    color: colors.neutral[900],
  },
});
