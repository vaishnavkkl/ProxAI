// @refresh reset
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/styles';

const CHART_H = 112;
const COLS = 48;

type ResourceAreaChartProps = {
  samples: number[];
  maxValue: number;
  label: string;
};

function sampleAt(samples: number[], index: number, columns: number): number {
  if (samples.length === 0) {
    return 0;
  }
  if (samples.length === 1) {
    return samples[0];
  }
  const t = index / Math.max(1, columns - 1);
  const pos = t * (samples.length - 1);
  const left = Math.floor(pos);
  const right = Math.min(samples.length - 1, left + 1);
  const mix = pos - left;
  return samples[left] * (1 - mix) + samples[right] * mix;
}

export function ResourceAreaChart({ samples, maxValue, label }: ResourceAreaChartProps) {
  const [width, setWidth] = useState(0);
  const ceiling = Math.max(maxValue, ...samples, 1);
  const columns = Math.min(COLS, Math.max(samples.length, 8));

  return (
    <View
      accessibilityLabel={label}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      style={styles.frame}>
      <View style={[styles.grid, styles.grid25]} />
      <View style={[styles.grid, styles.grid50]} />
      <View style={[styles.grid, styles.grid75]} />

      {columns > 0 && samples.length > 0 ? (
        <View style={styles.area}>
          {Array.from({ length: columns }, (_, index) => {
            const value = sampleAt(samples, index, columns);
            const height = Math.max(2, (value / ceiling) * CHART_H);
            return <View key={index} style={[styles.column, { height }]} />;
          })}
        </View>
      ) : (
        <View style={styles.idle} />
      )}

      {samples.length === 1 ? (
        <View style={[styles.stroke, { left: 0, right: 0, top: Math.min(CHART_H - 2, CHART_H * (1 - samples[0] / ceiling)) }]} />
      ) : null}
      {width > 0 && samples.length > 1
        ? samples.slice(1).map((value, index) => {
            const prev = samples[index];
            const x1 = (index / (samples.length - 1)) * width;
            const x2 = ((index + 1) / (samples.length - 1)) * width;
            const y1 = CHART_H - (prev / ceiling) * CHART_H;
            const y2 = CHART_H - (value / ceiling) * CHART_H;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.stroke,
                  {
                    width: length,
                    left: x1,
                    top: y1,
                    transform: [{ rotate: `${angle}rad` }],
                  },
                ]}
              />
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: CHART_H,
    backgroundColor: '#0B1220',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  grid: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  grid25: {
    top: CHART_H * 0.25,
  },
  grid50: {
    top: CHART_H * 0.5,
  },
  grid75: {
    top: CHART_H * 0.75,
  },
  area: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  column: {
    flex: 1,
    backgroundColor: 'rgba(37,99,235,0.38)',
  },
  idle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.primary[500],
  },
  stroke: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#60A5FA',
    transformOrigin: 'left center',
  },
});
