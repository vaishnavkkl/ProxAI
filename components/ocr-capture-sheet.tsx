import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppText } from '@/components/app-text';
import { OcrTextBlocks } from '@/components/ocr-text-blocks';
import { borderRadius, colors } from '@/styles';

type OcrCaptureSheetProps = {
  visible: boolean;
  uri: string | null;
  text: string;
  onClose: () => void;
  onAsk: (question: string) => void;
};

export function OcrCaptureSheet({ visible, uri, text, onClose, onAsk }: OcrCaptureSheetProps) {
  const [asking, setAsking] = useState(false);

  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) {
      setAsking(false);
    }
  }

  return (
    <AppBottomSheet
      accessibilityLabel={asking ? 'Back to image text' : 'Close image text'}
      onClose={() => {
        if (asking) {
          setAsking(false);
          return;
        }
        onClose();
      }}
      title={asking ? 'Ask assistant' : 'Text from this image'}
      visible={visible}>
      {visible && !asking && uri ? <Image cachePolicy="none" contentFit="contain" source={{ uri }} style={styles.preview} /> : null}
      {!asking ? <AppText variant="h4">Text from this photo</AppText> : null}
      <OcrTextBlocks key={text} asking={asking} onAsk={onAsk} onAskingChange={setAsking} text={text} />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    height: 220,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
  },
});
