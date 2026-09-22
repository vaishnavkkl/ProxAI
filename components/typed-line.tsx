import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, typography } from '@/styles';
import type { typography as Typography } from '@/styles';

type Variant = keyof typeof Typography;

type TypedLineProps = {
  text: string;
  replayToken?: number;
  variant?: Variant;
  style?: object;
  numberOfLines?: number;
};

let typedKey = '';
let typedShown = '';

function nextDelay(character: string) {
  if (character === '.' || character === '!' || character === '?') {
    return 88;
  }
  if (character === ',' || character === '—' || character === '-') {
    return 52;
  }
  if (character === ' ') {
    return 36;
  }
  return 24;
}

export function TypedLine({
  text,
  replayToken = 0,
  variant = 'bodyLarge',
  style,
  numberOfLines = 3,
}: TypedLineProps) {
  const key = `${replayToken}:${text}`;
  const [shown, setShown] = useState(() => (typedKey === key ? typedShown : text ? text.slice(0, 1) : ''));
  const [caret, setCaret] = useState(true);
  const writing = Boolean(text) && shown.length < text.length;
  const lineHeight = typography[variant].lineHeight ?? 24;

  useEffect(() => {
    setCaret(true);
    if (!text) {
      typedKey = key;
      typedShown = '';
      setShown('');
      return;
    }
    if (typedKey === key && typedShown === text) {
      setShown(text);
      return;
    }
    if (typedKey !== key) {
      typedKey = key;
      typedShown = text.slice(0, 1);
      setShown(typedShown);
    }
    let index = Math.max(typedShown.length, 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      index += 1;
      typedShown = text.slice(0, index);
      setShown(typedShown);
      if (index >= text.length) {
        return;
      }
      timer = setTimeout(tick, nextDelay(text[index - 1] ?? ''));
    };
    if (index >= text.length) {
      typedShown = text;
      setShown(text);
      return;
    }
    timer = setTimeout(tick, nextDelay(text[index - 1] ?? ''));
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [key, text]);

  useEffect(() => {
    if (!text) {
      return;
    }
    if (writing) {
      const blink = setInterval(() => {
        setCaret((on) => !on);
      }, 460);
      return () => {
        clearInterval(blink);
      };
    }
    setCaret(true);
    const hide = setTimeout(() => {
      setCaret(false);
    }, 720);
    return () => {
      clearTimeout(hide);
    };
  }, [text, writing, replayToken]);

  return (
    <View collapsable={false} style={[styles.slot, { minHeight: lineHeight * numberOfLines }]}>
      <AppText
        accessibilityLabel={text}
        accessibilityLiveRegion="polite"
        numberOfLines={numberOfLines}
        style={style}
        variant={variant}>
        {shown || text}
        {caret ? (
          <AppText style={writing ? styles.caret : styles.caretIdle} variant={variant}>
            ▍
          </AppText>
        ) : null}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    justifyContent: 'flex-start',
  },
  caret: {
    color: colors.primary[500],
  },
  caretIdle: {
    color: colors.neutral[400],
  },
});
