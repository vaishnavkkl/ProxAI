import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, layout, spacing } from '@/styles';
import { formatLedgerWhen } from '@/utils/format-when';
import { localDay, parseLocalDate } from '@/utils/message-date';

export type DateTimeMode = 'date' | 'time' | 'datetime';

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: DateTimeMode;
  optional?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function clockParts(value: string) {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return { hour: 9, minute: 0 };
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function wrapHour(hour: number) {
  return ((hour % 24) + 24) % 24;
}

function wrapMinute(minute: number) {
  return ((minute % 60) + 60) % 60;
}

function stepMinute(minute: number, delta: number) {
  return wrapMinute(minute + delta * 5);
}

function monthCells(year: number, month: number) {
  const jsDay = new Date(year, month, 1).getDay();
  const lead = (jsDay + 6) % 7;
  const last = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let index = 0; index < lead; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= last; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7) {
    cells.push(null);
  }
  return cells;
}

function splitValue(value: string) {
  if (!value) {
    return { date: '', time: '' };
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return { date: value.slice(0, 10), time: value.slice(11, 16) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: value, time: '' };
  }
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
    return { date: '', time: value };
  }
  const parsed = parseLocalDate(value);
  if (!Number.isFinite(parsed.getTime())) {
    return { date: '', time: '' };
  }
  return { date: localDay(parsed), time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}` };
}

function joinValue(mode: DateTimeMode, date: string, time: string) {
  if (mode === 'time') {
    return time;
  }
  if (!date) {
    return '';
  }
  if (mode === 'date' || !time) {
    return date;
  }
  return `${date}T${time}`;
}

function displayValue(mode: DateTimeMode, value: string) {
  if (!value) {
    return mode === 'time' ? 'Pick a time' : 'Pick a date';
  }
  if (mode === 'time') {
    return value;
  }
  return formatLedgerWhen(value);
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  optional = true,
  disabled = false,
  accessibilityLabel,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const parts = splitValue(value);
  const seed = parts.date ? parseLocalDate(parts.date) : new Date();
  const [cursor, setCursor] = useState(() => ({ year: seed.getFullYear(), month: seed.getMonth() }));
  const cells = monthCells(cursor.year, cursor.month);
  const heading = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const time = parts.time || (mode === 'time' ? '09:00' : '');
  const clock = clockParts(time || '09:00');
  const includeTime = mode === 'time' || (mode === 'datetime' && Boolean(parts.time));

  function commit(nextDate: string, nextTime: string) {
    onChange(joinValue(mode, nextDate, nextTime));
  }

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  function setClock(hour: number, minute: number) {
    const next = `${pad2(wrapHour(hour))}:${pad2(wrapMinute(minute))}`;
    if (mode === 'time') {
      onChange(next);
      return;
    }
    commit(parts.date || localDay(new Date()), next);
  }

  return (
    <View style={styles.block}>
      <AppText variant="labelRegular">{label}</AppText>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          if (disabled) {
            return;
          }
          if (!open) {
            const current = parts.date ? parseLocalDate(parts.date) : new Date();
            if (Number.isFinite(current.getTime())) {
              setCursor({ year: current.getFullYear(), month: current.getMonth() });
            }
          }
          setOpen(!open);
        }}
        style={[styles.field, open ? styles.fieldOn : undefined]}>
        <Ionicons color={colors.primary[600]} name={mode === 'time' ? 'time-outline' : 'calendar-outline'} size={20} />
        <AppText style={styles.flex} variant="bodyRegular">
          {displayValue(mode, value)}
        </AppText>
        <Ionicons color={colors.primary[600]} name={open ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {mode !== 'time' ? (
            <>
              <View style={styles.monthBar}>
                <Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => shiftMonth(-1)} style={styles.iconBtn}>
                  <Ionicons color={colors.primary[600]} name="chevron-back" size={22} />
                </Pressable>
                <AppText variant="h4">{heading}</AppText>
                <Pressable accessibilityLabel="Next month" accessibilityRole="button" onPress={() => shiftMonth(1)} style={styles.iconBtn}>
                  <Ionicons color={colors.primary[600]} name="chevron-forward" size={22} />
                </Pressable>
              </View>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((day, index) => (
                  <AppText key={`${day}-${index}`} style={styles.weekLabel} variant="caption">
                    {day}
                  </AppText>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((day, index) => {
                  const selected = day != null && parts.date === `${cursor.year}-${pad2(cursor.month + 1)}-${pad2(day)}`;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={day == null}
                      key={`d-${index}`}
                      onPress={() => {
                        if (day == null) {
                          return;
                        }
                        commit(`${cursor.year}-${pad2(cursor.month + 1)}-${pad2(day)}`, includeTime ? time || '09:00' : '');
                      }}
                      style={[styles.day, selected ? styles.dayOn : undefined]}>
                      <AppText style={selected ? styles.dayOnLabel : undefined} variant="labelSmall">
                        {day ?? ''}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {mode === 'datetime' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                commit(parts.date || localDay(new Date()), includeTime ? '' : '09:00');
              }}
              style={styles.toggle}>
              <AppText variant="labelSmall">{includeTime ? 'Date only' : 'Add a time'}</AppText>
            </Pressable>
          ) : null}

          {mode === 'time' || includeTime ? (
            <View style={styles.clock}>
              <View style={styles.step}>
                <Pressable accessibilityLabel="Hour down" accessibilityRole="button" onPress={() => setClock(clock.hour - 1, clock.minute)} style={styles.iconBtn}>
                  <Ionicons color={colors.primary[600]} name="remove" size={22} />
                </Pressable>
                <AppText variant="h3">{pad2(clock.hour)}</AppText>
                <Pressable accessibilityLabel="Hour up" accessibilityRole="button" onPress={() => setClock(clock.hour + 1, clock.minute)} style={styles.iconBtn}>
                  <Ionicons color={colors.primary[600]} name="add" size={22} />
                </Pressable>
              </View>
              <AppText variant="h3">:</AppText>
              <View style={styles.step}>
                <Pressable accessibilityLabel="Minute down" accessibilityRole="button" onPress={() => setClock(clock.hour, stepMinute(clock.minute, -1))} style={styles.iconBtn}>
                  <Ionicons color={colors.primary[600]} name="remove" size={22} />
                </Pressable>
                <AppText variant="h3">{pad2(clock.minute)}</AppText>
                <Pressable accessibilityLabel="Minute up" accessibilityRole="button" onPress={() => setClock(clock.hour, stepMinute(clock.minute, 1))} style={styles.iconBtn}>
                  <Ionicons color={colors.primary[600]} name="add" size={22} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {optional ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onChange('');
                setOpen(false);
              }}
              style={styles.clear}>
              <AppText style={styles.clearLabel} variant="labelSmall">
                Clear
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldOn: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  flex: {
    flex: 1,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    gap: spacing.sm,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.neutral[600],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  day: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  dayOn: {
    backgroundColor: colors.primary[500],
  },
  dayOnLabel: {
    color: colors.neutral[0],
  },
  toggle: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clear: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearLabel: {
    color: colors.primary[500],
  },
});
