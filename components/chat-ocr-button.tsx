import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';
import { LogoLoader as ActivityIndicator } from '@/components/logo-loader';


import { AppDialog } from '@/components/app-dialog';
import { AppText } from '@/components/app-text';
import { OcrCaptureSheet } from '@/components/ocr-capture-sheet';
import { captureChatText } from '@/services/chat-ocr';
import { paintFeedback } from '@/utils/paint-feedback';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, layout, spacing } from '@/styles';

/** OCR lives over chat so the mounted chat retains its model and conversation. */
export function ChatOcrButton({ disabled, onAsk }: { disabled: boolean; onAsk: (question: string) => void }) {
  const mounted = useRef(true);
  const scanning = useRef(false);
  const [reading, setReading] = useState(false);
  const [choosingSource, setChoosingSource] = useState(false);
  const [capture, setCapture] = useState<{ text: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function scan(source: 'camera' | 'gallery') {
    if (disabled || scanning.current || useUiStore.getState().isProcessing) return;
    scanning.current = true;
    setReading(true);
    const ui = useUiStore.getState();
    ui.setWorkKind('scan');
    ui.setProcessing(true);
    try {
      await paintFeedback();
      const text = await captureChatText(source, () => mounted.current);
      if (text !== null && mounted.current) setCapture({ text });
    } catch (error) {
      if (mounted.current) ui.setToast({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not read that image.',
      });
    } finally {
      scanning.current = false;
      ui.setProcessing(false);
      if (mounted.current) setReading(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={reading ? 'Reading image text' : 'Scan image text with OCR'}
        accessibilityState={{ disabled: disabled || reading, busy: reading }}
        disabled={disabled || reading}
        onPress={() => {
          Keyboard.dismiss();
          setChoosingSource(true);
        }}
        style={[styles.button, disabled && styles.disabled]}>
        {reading ? <ActivityIndicator color={colors.primary[600]} size="small" /> :
          <Ionicons name="scan-outline" color={colors.primary[600]} size={20} />}
        <AppText variant="caption" style={styles.label}>OCR</AppText>
      </Pressable>
      <AppDialog
        visible={choosingSource}
        title="Read image text"
        message="Choose an image to add to this chat."
        onClose={() => setChoosingSource(false)}
        actions={[
          { label: 'Camera', icon: 'camera-outline', tone: 'primary', onPress: () => void scan('camera') },
          { label: 'Gallery', icon: 'images-outline', tone: 'primary', onPress: () => void scan('gallery') },
          { label: 'Cancel', tone: 'secondary', onPress: () => undefined },
        ]}
      />
      {capture ? <OcrCaptureSheet
        visible
        uri={null}
        text={capture.text}
        onClose={() => setCapture(null)}
        onAsk={(question) => {
          setCapture(null);
          onAsk(question);
        }}
      /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xs,
  },
  disabled: { opacity: 0.45 },
  label: { color: colors.primary[600] },
});
