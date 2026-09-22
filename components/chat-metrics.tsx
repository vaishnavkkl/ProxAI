import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useLlmMetricsStore } from '@/services/llm-metrics';
import { useCoachStore } from '@/store/coach-store';
import { useUiStore } from '@/store/ui-store';
import { colors, spacing } from '@/styles';

const SEGMENTS = 24;

export function ChatContextUsage() {
  const context = useLlmMetricsStore((state) => state.context);
  const loaded = useUiStore((state) => state.modelInRam);
  const hasMessages = useCoachStore((state) => state.messages.length > 0);
  const available = loaded && context != null;
  const used = available && hasMessages ? context.used : 0;
  const percent = available ? Math.min(100, Math.round(used * 100 / context.capacity)) : null;
  const estimated = available && hasMessages && context.estimated;
  const tint = percent != null && percent >= 95 ? colors.semantic.danger
    : percent != null && percent >= 80 ? colors.semantic.warning : colors.primary[500];
  const count = available ? `${estimated ? '~' : ''}${used.toLocaleString()} / ${context.capacity.toLocaleString()} tokens` : 'Available when model is loaded';

  return (
    <View style={styles.context}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`Context usage. ${count}`}
        accessibilityValue={percent == null ? { text: 'Unavailable' } : { min: 0, max: 100, now: percent }} style={styles.ring}>
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <View key={index} style={[styles.segment, { transform: [{ rotate: `${index * 360 / SEGMENTS}deg` }] }]}>
            <View style={[styles.tick, { backgroundColor: percent != null && index < Math.round(percent * SEGMENTS / 100) ? tint : colors.neutral[200] }]} />
          </View>
        ))}
        <AppText style={styles.percent}>{percent == null ? '—' : `${percent}%`}</AppText>
      </View>
      <View style={styles.contextCopy}>
        <AppText variant="caption" style={styles.label}>Context</AppText>
        <AppText variant="caption" style={styles.count}>{count}</AppText>
      </View>
    </View>
  );
}

export function ChatTokenSpeed() {
  const live = useLlmMetricsStore((state) => state.liveTokensPerSecond);
  const generating = useLlmMetricsStore((state) => state.generating);
  const last = useLlmMetricsStore((state) => state.lastReply?.decodeTokensPerSecond ?? null);
  const loaded = useUiStore((state) => state.modelInRam);
  const hasMessages = useCoachStore((state) => state.messages.length > 0);
  const speed = loaded && hasMessages ? generating ? live : last : null;
  return (
    <View accessibilityLabel={`Generation speed: ${speed == null ? 'not available yet' : `${speed.toFixed(1)} tokens per second`}`} style={styles.speed}>
      <AppText variant="caption" style={styles.label}>{generating ? 'Generating' : 'Last reply'}</AppText>
      <AppText variant="labelSmall" style={styles.speedValue}>{speed == null ? '—' : `${generating ? '~' : ''}${speed.toFixed(1)}`} tok/s</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  context: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  contextCopy: { flex: 1 },
  ring: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  segment: { position: 'absolute', width: 34, height: 34, alignItems: 'center' },
  tick: { width: 2.5, height: 4, borderRadius: 2 },
  percent: { fontSize: 9, lineHeight: 12, color: colors.neutral[700] },
  label: { color: colors.neutral[600], fontSize: 10, lineHeight: 14 },
  count: { color: colors.neutral[600], fontSize: 10, lineHeight: 14, fontVariant: ['tabular-nums'] },
  speed: { alignItems: 'flex-end', gap: 2 },
  speedValue: { color: colors.primary[600], fontVariant: ['tabular-nums'] },
});
