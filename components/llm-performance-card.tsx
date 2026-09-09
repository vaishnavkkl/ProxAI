import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useLlmMetricsStore } from '@/services/llm-metrics';
import { borderRadius, colors, spacing } from '@/styles';

function duration(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function LlmPerformanceCard() {
  const metrics = useLlmMetricsStore((state) => state.lastReply);
  if (!metrics) return null;

  return (
    <View style={styles.card}>
      <AppText variant="overline">Last chat reply</AppText>
      <AppText variant="labelLarge">{metrics.modelLabel}</AppText>
      <View style={styles.row}>
        <View style={styles.metric}>
          <AppText variant="caption">First text</AppText>
          <AppText variant="h3">{metrics.firstTextMs == null ? 'Unavailable' : duration(metrics.firstTextMs)}</AppText>
        </View>
        <View style={styles.metric}>
          <AppText variant="caption">Generation</AppText>
          <AppText variant="h3">
            {metrics.decodeTokensPerSecond == null ? 'Unavailable' : `${metrics.decodeTokensPerSecond.toFixed(1)} tok/s`}
          </AppText>
        </View>
      </View>
      {metrics.contextCapacityTokens != null ? (
        <AppText variant="caption">
          Context {metrics.contextUsedTokens} / {metrics.contextCapacityTokens} tokens
        </AppText>
      ) : null}
      <AppText variant="caption">
        First text includes model loading and waiting. Generation measures token speed after the first token.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  metric: {
    flexGrow: 1,
    gap: spacing.xs,
  },
});
