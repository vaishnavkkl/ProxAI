import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent } from 'react-native';

function coveredByKeyboard(event: KeyboardEvent) {
  const height = event.endCoordinates.height;
  const screenH = Dimensions.get('screen').height;
  const fromScreen = screenH - event.endCoordinates.screenY;
  const next = process.env.EXPO_OS === 'android' && fromScreen > 0 ? fromScreen : height;
  return Math.max(0, Math.min(next, screenH * 0.72));
}

export function useKeyboardInset() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const apply = (event: KeyboardEvent) => {
      setHeight(coveredByKeyboard(event));
    };
    const show = Keyboard.addListener(
      process.env.EXPO_OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      apply,
    );
    const frame =
      process.env.EXPO_OS === 'android'
        ? Keyboard.addListener('keyboardDidChangeFrame', apply)
        : null;
    const hide = Keyboard.addListener(
      process.env.EXPO_OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setHeight(0);
      },
    );
    return () => {
      show.remove();
      frame?.remove();
      hide.remove();
    };
  }, []);

  return height;
}
