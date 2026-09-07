import { StyleSheet, View } from 'react-native';

import { colors, gradients } from '@/styles';

export function TabBarOverlay() {
  return <View style={styles.overlay} />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: gradients.tabBar,
  },
});
