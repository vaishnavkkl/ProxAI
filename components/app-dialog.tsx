import { Modal, StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

export type DialogAction = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  icon?: ComponentProps<typeof Ionicons>['name'];
};

type AppDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  actions: DialogAction[];
  onClose: () => void;
};

export function AppDialog({ visible, title, message, actions, onClose }: AppDialogProps) {
  const useRowActions = actions.length === 2;

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <GestureHandlerRootView style={styles.root}>
        <Pressable accessibilityLabel="Dismiss dialog" accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
        <View style={styles.card}>
          <View style={styles.copy}>
            <AppText variant="h4">{title}</AppText>
            <AppText style={styles.message} variant="bodyRegular">
              {message}
            </AppText>
          </View>
          <View style={[styles.actions, useRowActions ? styles.actionsRow : null]}>
            {actions.map((action, index) => (
              <Pressable
                accessibilityRole="button"
                key={action.label}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                style={[
                  styles.button,
                  action.icon ? styles.iconButton : null,
                  useRowActions ? styles.buttonRow : null,
                  index > 0 && useRowActions ? styles.buttonRowDivider : null,
                  action.tone === 'danger'
                    ? styles.danger
                    : action.tone === 'primary'
                      ? styles.primary
                      : styles.secondary,
                ]}>
                {action.icon ? <Ionicons name={action.icon} size={24}
                  color={action.tone === 'danger' ? colors.semantic.danger : colors.primary[600]} /> : null}
                <AppText
                  style={[
                    action.tone === 'secondary' || !action.tone ? styles.secondaryLabel : styles.primaryLabel,
                    action.tone === 'danger' ? styles.dangerLabel : null,
                    action.tone === 'primary' ? styles.primaryTextLabel : null,
                  ]}
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
    paddingHorizontal: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
    zIndex: 1,
    boxShadow: '0px 12px 32px rgba(15,23,42,0.14)',
  },
  copy: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  message: {
    color: colors.neutral[600],
  },
  actions: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  actionsRow: {
    flexDirection: 'row',
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonRow: {
    flex: 1,
  },
  iconButton: { flexDirection: 'row', gap: spacing.md },
  buttonRowDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.neutral[200],
  },
  primary: {
    backgroundColor: colors.neutral[0],
  },
  secondary: {
    backgroundColor: colors.neutral[0],
  },
  danger: {
    backgroundColor: colors.neutral[0],
  },
  primaryLabel: {
    color: colors.neutral[900],
  },
  primaryTextLabel: {
    color: colors.primary[600],
  },
  secondaryLabel: {
    color: colors.neutral[600],
  },
  dangerLabel: {
    color: colors.semantic.danger,
  },
});
