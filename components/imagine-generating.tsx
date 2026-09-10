import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, gradients, spacing } from '@/styles';

type ImagineGeneratingProps = {
  progress: number;
  label?: string;
  compact?: boolean;
};

export const IMAGINE_SHEET = 512;
const COLS = 16;
const ROWS = 16;
const CELL_COUNT = COLS * ROWS;
const PIXELS = Array.from({ length: CELL_COUNT }, (_, index) => index);

function clampProgress(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function PixelCell({ on }: { on: boolean }) {
  return <View style={on ? styles.cellOn : styles.cell} />;
}

export function ImagineGenerating({ progress, label, compact = false }: ImagineGeneratingProps) {
  const amount = clampProgress(progress);
  const lit = Math.round(amount * CELL_COUNT);
  const percent = Math.round(amount * 100);
  const caption = label?.trim() || 'Creating image…';

  return (
    <View
      accessibilityLabel={`Progress ${percent} percent`}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: Math.max(0, Math.min(100, percent)) }}
      style={styles.frame}>
      <View style={styles.sheet}>
        <View style={styles.studio} />
        <View style={styles.grid}>
          {PIXELS.map((index) => (
            <PixelCell key={index} on={index < lit} />
          ))}
        </View>
        {compact ? null : (
          <View style={styles.copy}>
            <AppText style={styles.title} variant="labelRegular">
              Creating image
            </AppText>
            <AppText numberOfLines={1} style={styles.subtitle} variant="caption">
              {percent}% · {caption}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[950],
  },
  sheet: {
    width: '100%',
    maxWidth: IMAGINE_SHEET,
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: colors.primary[950],
  },
  studio: {
    ...StyleSheet.absoluteFillObject,
    experimental_backgroundImage: gradients.imagineStudio,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / COLS}%`,
    height: `${100 / ROWS}%`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[950],
    backgroundColor: 'rgba(191, 219, 254, 0.08)',
  },
  cellOn: {
    width: `${100 / COLS}%`,
    height: `${100 / ROWS}%`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[950],
    backgroundColor: 'rgba(191, 219, 254, 0.92)',
  },
  copy: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: 2,
    zIndex: 3,
  },
  title: {
    color: colors.neutral[0],
    textAlign: 'center',
  },
  subtitle: {
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
