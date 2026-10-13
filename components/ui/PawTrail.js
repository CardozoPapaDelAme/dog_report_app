/**
 * @module components/ui/PawTrail
 * A trail of paw prints walking across the empty space below the form (decorative, hidden from accessibility). Prints alternate
 * left and right like a real stride and fade out toward the end of the trail.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { PawPrint } from 'lucide-react-native';

// Positions are percentages of the container: a stride heading up and to the right with toes up, growing clearer.
const steps = [
  { top: '58%', left: '8%', rotate: '-12deg', size: 38, opacity: 0.09 },
  { top: '72%', left: '21%', rotate: '10deg', size: 38, opacity: 0.12 },
  { top: '44%', left: '34%', rotate: '-14deg', size: 40, opacity: 0.16 },
  { top: '58%', left: '47%', rotate: '8deg', size: 40, opacity: 0.2 },
  { top: '30%', left: '61%', rotate: '-12deg', size: 42, opacity: 0.26 },
  { top: '42%', left: '75%', rotate: '10deg', size: 42, opacity: 0.32 },
];

function PawTrail({ color = '#ffffff', style }) {
  return (
    <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={[StyleSheet.absoluteFill, style]}>
      {steps.map((step, i) => (
        <View key={i} style={{ position: 'absolute', top: step.top, left: step.left, opacity: step.opacity, transform: [{ rotate: step.rotate }] }}>
          <PawPrint size={step.size} color={color} strokeWidth={1.75} fill={color} />
        </View>
      ))}
    </View>
  );
}

export default memo(PawTrail);
