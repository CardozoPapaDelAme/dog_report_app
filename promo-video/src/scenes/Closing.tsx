import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, fonts} from '../theme';

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const settle = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const fade = (from: number) => interpolate(frame, [from, from + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, ${colors.primaryContainer} 0%, ${colors.forestField} 55%, ${colors.forestDeep} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <Img
        src={staticFile('img/logo.png')}
        style={{
          width: 190,
          height: 190,
          borderRadius: 48,
          scale: String(0.85 + 0.15 * settle),
          opacity: settle,
          boxShadow: '0 30px 70px rgba(0,0,0,0.4)',
        }}
      />
      <div style={{marginTop: 36, fontFamily: fonts.display, fontWeight: 600, fontSize: 76, color: '#fff', opacity: fade(8)}}>
        Creel, más seguro.
      </div>
      <div style={{marginTop: 18, fontFamily: fonts.body, fontWeight: 700, fontSize: 38, color: colors.onForest, opacity: fade(16)}}>
        Creel Stray-Dog Reporting
      </div>
      <div style={{marginTop: 10, fontFamily: fonts.label, fontWeight: 600, fontSize: 28, letterSpacing: 3, textTransform: 'uppercase', color: colors.primaryFixed, opacity: fade(22)}}>
        Asociación de Hoteles de Chihuahua
      </div>
    </AbsoluteFill>
  );
};
