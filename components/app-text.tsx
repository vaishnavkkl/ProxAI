import { Text, type TextProps } from 'react-native';

import { typography } from '@/styles';

type Variant = keyof typeof typography;

type AppTextProps = TextProps & {
  variant?: Variant;
};

export function AppText({ variant = 'bodyRegular', style, ...props }: AppTextProps) {
  return <Text style={[typography[variant], style]} {...props} />;
}
