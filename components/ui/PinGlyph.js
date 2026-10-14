/**
 * @module components/ui/PinGlyph
 * The app's report marker: one teardrop silhouette (color = severity) with a continuous white outline, an offset
 * shadow of the same shape, a paw inside and an amber badge when the community flagged the report. Used on the
 * map and in the moderation queue so both read as the same thing. Sized by `scale` (1 = 48 x 62).
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme/index.js';
import Icon from './Icon.js';

/** Teardrop outline (a single closed shape, so the white outline runs around the whole silhouette). */
const PIN_PATH = 'M24 3 C12.5 3 4 11.6 4 22.6 C4 37 24 57 24 57 C24 57 44 37 44 22.6 C44 11.6 35.5 3 24 3 Z';

export default function PinGlyph({ color, flagged = false, scale = 1, style }) {
  return (
    <View style={[{ width: 48 * scale, height: 62 * scale }, style]} pointerEvents="none">
      <Svg width={48 * scale} height={62 * scale} viewBox="0 0 48 62" accessible={false} aria-hidden>
        <Path d={PIN_PATH} fill="rgba(0,0,0,0.28)" transform="translate(0 3)" />
        <Path d={PIN_PATH} fill={color} stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" />
        {flagged ? <Circle cx={40} cy={9} r={7} fill="#ffa000" stroke="#ffffff" strokeWidth={2.5} /> : null}
      </Svg>
      <View style={[styles.paw, { left: 12 * scale, top: 11 * scale }]}>
        <Icon name="dog" size={24 * scale} color={colors.onPrimary} strokeWidth={2.2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ paw: { position: 'absolute' } });
