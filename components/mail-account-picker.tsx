import { StyleSheet } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type MailAccountPickerProps = {
  accounts: string[];
  onPick: (account: string) => void;
  onSkip: () => void;
};

export function MailAccountPicker({ accounts, onPick, onSkip }: MailAccountPickerProps) {
  return (
    <AppBottomSheet accessibilityLabel="Skip calendar this time" onClose={onSkip} title="Which calendar account?" visible>
      <AppText variant="bodyRegular">
        Choose the calendar to import. This does not connect your email inbox. SMS is still scanned either way.
      </AppText>
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
      <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip}>
        <AppText style={styles.skipLabel} variant="labelRegular">
          Skip calendar this time
        </AppText>
      </Pressable>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
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
