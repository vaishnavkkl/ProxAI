import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import * as Clipboard from 'expo-clipboard';

import { AppText } from '@/components/app-text';
import { ensureChatModelForOcr } from '@/services/ocr-chat-model';
import { useCoachStore } from '@/store/coach-store';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, spacing } from '@/styles';
import { ocrCoachQuestion, ocrTextBlocks, selectedOcrText, splitOcrBlocks } from '@/utils/ocr-blocks';
import { chatSuggestions, latestSuggestionContext } from '@/utils/chat-suggestions';

type OcrTextBlocksProps = {
  text: string;
  onAsk: (question: string) => void;
  asking?: boolean;
  onAskingChange?: (asking: boolean) => void;
};

export function OcrTextBlocks({ text, onAsk, asking: askingProp, onAskingChange }: OcrTextBlocksProps) {
  const blocks = splitOcrBlocks(text);
  const readable = ocrTextBlocks(text);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [internalAsking, setInternalAsking] = useState(false);
  const [instruction, setInstruction] = useState('');
  const setToast = useUiStore((s) => s.setToast);
  const ocrLanguage = useSettingsStore((s) => s.ocrLanguage);
  const excerpt = selectedOcrText(blocks, selected);
  const chatContext = useCoachStore((s) => latestSuggestionContext(s.messages));
  const suggestions = chatSuggestions(chatContext, excerpt);
  const picked = readable.filter((block) => selected[block.id]).length;
  const asking = askingProp ?? internalAsking;

  function setAsking(value: boolean) {
    if (askingProp === undefined) {
      setInternalAsking(value);
    }
    onAskingChange?.(value);
  }

  if (!text.trim()) {
    return <AppText variant="bodySmall">No text could be read from this image.</AppText>;
  }

  async function copySelected() {
    if (!excerpt) {
      return;
    }
    await Clipboard.setStringAsync(excerpt);
    setToast({ kind: 'success', message: picked ? `Copied ${picked} ${picked === 1 ? 'paragraph' : 'paragraphs'}.` : 'Copied all text.' });
  }

  const actions = (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={() => void copySelected()} style={styles.secondary}>
        <Ionicons color={colors.neutral[900]} name="copy-outline" size={18} />
        <AppText variant="labelRegular">Copy</AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setInstruction('');
          setAsking(true);
        }}
        style={styles.primary}>
        <Ionicons color={colors.neutral[0]} name="chatbubbles" size={18} />
        <AppText style={styles.primaryLabel} variant="labelRegular">
          Ask assistant
        </AppText>
      </Pressable>
    </View>
  );

  if (asking) {
    return (
      <View style={styles.wrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to selected text"
          onPress={() => {
            setAsking(false);
          }}
          style={styles.back}>
          <Ionicons color={colors.primary[600]} name="chevron-back" size={20} />
          <AppText style={styles.backLabel} variant="labelRegular">
            Back to text
          </AppText>
        </Pressable>
        <AppText variant="bodyRegular">
          {picked
            ? `${picked} ${picked === 1 ? 'paragraph' : 'paragraphs'} will be sent. The model never sees the photo.`
            : 'All readable text will be sent. The model never sees the photo.'}
        </AppText>
        <AppText variant="labelRegular">What should it do?</AppText>
        <View style={styles.chips}>
          {suggestions.map((chip) => (
            <Pressable
              accessibilityRole="button"
              key={chip}
              onPress={() => {
                setInstruction(chip);
              }}
              style={[styles.chip, instruction === chip ? styles.chipOn : undefined]}>
              <AppText style={instruction === chip ? styles.chipOnLabel : styles.chipLabel} variant="labelSmall">
                {chip}
              </AppText>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel="Custom instruction for the assistant"
          onChangeText={setInstruction}
          placeholder="Rephrase, create an email, translate…"
          placeholderTextColor={colors.neutral[500]}
          style={styles.input}
          value={instruction}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            ensureChatModelForOcr();
            const question = ocrCoachQuestion(instruction, excerpt, ocrLanguage);
            setAsking(false);
            onAsk(question);
          }}
          style={styles.primary}>
          <Ionicons color={colors.neutral[0]} name="send" size={18} />
          <AppText style={styles.primaryLabel} variant="labelRegular">
            Pass text to assistant
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText variant="bodySmall">
        Tap a paragraph to select it. Copy and Ask stay at the top and bottom, so you do not hunt for them.
      </AppText>
      <AppText variant="caption">
        {picked ? `${picked} ${picked === 1 ? 'paragraph' : 'paragraphs'} selected` : 'Nothing selected — Copy and Ask use all text'}
      </AppText>
      {actions}
      {blocks.map((block) => {
        if (block.kind === 'break') {
          return <View key={block.id} style={styles.break} />;
        }
        const index = readable.findIndex((item) => item.id === block.id) + 1;
        const on = !!selected[block.id];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            key={block.id}
            onPress={() => {
              setSelected((current) => ({ ...current, [block.id]: !current[block.id] }));
            }}
            style={[styles.block, on ? styles.blockOn : undefined]}>
            <View style={[styles.index, on ? styles.indexOn : undefined]}>
              <AppText style={on ? styles.indexOnLabel : styles.indexLabel} variant="labelSmall">
                {index}
              </AppText>
            </View>
            <AppText style={styles.blockCopy} variant="bodyRegular">
              {block.text}
            </AppText>
            <Ionicons
              color={on ? colors.primary[500] : colors.neutral[400]}
              name={on ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
            />
          </Pressable>
        );
      })}
      {readable.length > 1 ? actions : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  back: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backLabel: {
    color: colors.primary[600],
  },
  block: {
    minHeight: 48,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  blockOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  blockCopy: {
    flex: 1,
    color: colors.neutral[700],
  },
  index: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexOn: {
    backgroundColor: colors.primary[500],
  },
  indexLabel: {
    color: colors.neutral[600],
  },
  indexOnLabel: {
    color: colors.neutral[0],
  },
  break: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginHorizontal: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    experimental_backgroundImage: gradients.action,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryLabel: {
    color: colors.neutral[0],
  },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[50],
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[500],
  },
  chipLabel: {
    color: colors.neutral[700],
  },
  chipOnLabel: {
    color: colors.primary[500],
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    color: colors.neutral[900],
    fontSize: 14,
  },
});
