/**
 * @module components/ui/PhotoViewer
 * Full-screen view of a photo over everything else, closed by tapping anywhere. It is an in-screen overlay
 * (absolute fill), so it can sit inside a `SheetHost` above stacked sheets.
 */
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../../theme/index.js';
import Icon from './Icon.js';

export default function PhotoViewer({ uri, label, closeLabel, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={styles.viewer}>
      <Image accessibilityRole="image" accessibilityLabel={label} source={{ uri }} style={styles.image} resizeMode="contain" />
      <View style={[styles.close, { top: insets.top + 12 }]}><Icon name="close" size={22} color={colors.onPrimary} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  viewer: { ...StyleSheet.absoluteFill, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  close: { position: 'absolute', left: layout.margin, width: layout.minTouch, height: layout.minTouch, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
