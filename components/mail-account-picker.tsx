import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type MailAccountPickerProps = {
  accounts: string[];
  onPick: (account: string) => void;
  onSkip: () => void;
};

export function MailAccountPicker({ accounts, onPick, onSkip }: MailAccountPickerProps) {
  return (
    <Modal animationType="slide" transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <AppText variant="h3">Which calendar account?</AppText>
          <AppText variant="bodyRegular">
            Choose the calendar to import. This does not connect your email inbox.
            SMS is still scanned either way.
          </AppText>
          <ScrollView contentContainerStyle={styles.list} style={styles.listFill}>
            {accounts.map((account) => (
              <Pressable
                accessibilityRole="button"
                key={account}
                onPress={() => {
                  onPick(account);
                }}
                style={styles.row}>
                <AppText variant="labelRegular">{account}</AppText>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip}>
            <AppText style={styles.skipLabel} variant="labelRegular">
              Skip calendar this time
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing['2xl'],
    gap: spacing.lg,
    maxHeight: '80%',
  },
  listFill: {
    maxHeight: 280,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.neutral[50],
  },
  skip: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    color: colors.primary[500],
  },
});
