import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppPressable } from '@/components/app-pressable';
import { AppText } from '@/components/app-text';
import { Events } from '@/screens/events';
import { Finance } from '@/screens/finance';
import { Subscriptions } from '@/screens/subscriptions';
import { colors, layout, spacing } from '@/styles';

const sections = [
  { key: 'finance', title: 'Finance', description: 'Money & accounts', icon: 'wallet-outline', color: '#1E40AF', tint: '#EFF6FF', Screen: memo(Finance) },
  { key: 'events', title: 'Events', description: 'Calendar & plans', icon: 'calendar-outline', color: '#6D28D9', tint: '#F5F3FF', Screen: memo(Events) },
  { key: 'renewals', title: 'Renewals', description: 'Subscriptions & bills', icon: 'repeat-outline', color: '#B45309', tint: '#FFFBEB', Screen: memo(Subscriptions) },
] as const;
type SectionKey = (typeof sections)[number]['key'];

export default function OrganizerTab() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const selected: SectionKey = section === 'events' || section === 'renewals' ? section : 'finance';
  const [visited, setVisited] = useState<SectionKey[]>([selected]);
  // Retain list state even when another screen deep-links into a new section.
  if (!visited.includes(selected)) setVisited([...visited, selected]);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText variant="h3">Your organizer</AppText>
          <AppText variant="caption" style={styles.subtitle}>Money, plans and subscriptions in one place</AppText>
        </View>
        <View accessibilityRole="tablist" style={styles.sections}>
          {sections.map(({ key, title, description, icon, color, tint }) => {
            const active = selected === key;
            return (
              <AppPressable key={key} accessibilityRole="tab"
                accessibilityLabel={`${title}. ${description}`}
                accessibilityState={{ selected: active }}
                onPress={() => { if (!active) router.setParams({ section: key }); }}
                style={[styles.section, active && { borderColor: color, backgroundColor: tint }]}>
                <View style={[styles.icon, { backgroundColor: active ? color : tint }]}>
                  <Ionicons name={icon} size={23} color={active ? colors.neutral[0] : color} />
                </View>
                {active && <Ionicons name="checkmark-circle" size={16} color={color} style={styles.check} />}
                <AppText variant="labelRegular" style={[styles.title, active && { color }]}>{title}</AppText>
                <AppText variant="caption" style={styles.description}>{description}</AppText>
                <View style={[styles.underline, { backgroundColor: active ? color : 'transparent' }]} />
              </AppPressable>
            );
          })}
        </View>
      </View>
      {sections.map(({ key, Screen }) => visited.includes(key) ? (
        <View key={key} style={selected === key ? styles.panel : styles.hidden}
          pointerEvents={selected === key ? 'auto' : 'none'}
          accessibilityElementsHidden={selected !== key}
          importantForAccessibility={selected === key ? 'auto' : 'no-hide-descendants'}>
          <Screen embedded />
        </View>
      ) : null)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  header: { width: '100%', maxWidth: layout.maxContentWidth + spacing.lg * 2, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  heading: { gap: spacing.xs },
  subtitle: { color: colors.neutral[600] },
  sections: { flexDirection: 'row', gap: spacing.sm },
  section: { flex: 1, minHeight: 128, paddingTop: spacing.md, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm, alignItems: 'center', gap: 5, borderRadius: 18, borderWidth: 1.5, borderColor: colors.neutral[200], backgroundColor: colors.neutral[0] },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: 8, right: 7 },
  title: { fontSize: 13, lineHeight: 18, color: colors.neutral[900], textAlign: 'center' },
  description: { fontSize: 10, lineHeight: 14, minHeight: 28, textAlign: 'center', color: colors.neutral[600] },
  underline: { width: 24, height: 3, borderRadius: 2 },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
