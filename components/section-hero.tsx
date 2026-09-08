import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { borderRadius, colors, gradients, spacing } from '@/styles';

export function SectionHero({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return <View style={styles.hero}>
    <View style={styles.icon}><Ionicons name={icon} size={25} color={colors.neutral[0]} /></View>
    <View style={styles.copy}><AppText variant="h3" style={styles.title}>{title}</AppText><AppText variant="bodySmall" style={styles.subtitle}>{subtitle}</AppText></View>
  </View>;
}
const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: borderRadius.xl, backgroundColor: colors.primary[800], experimental_backgroundImage: gradients.hero, boxShadow: '0px 6px 16px rgba(30,58,138,0.14)' },
  icon: { width: 48, height: 48, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  copy: { flex: 1, gap: spacing.xs }, title: { color: colors.neutral[0] }, subtitle: { color: colors.primary[100] },
});
