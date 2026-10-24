import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, fonts} from '../theme';
import {Caption} from '../components/Caption';

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoScale = interpolate(frame, [0, 0.7 * fps], [0.2, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    output: 'perceptual-scale',
  });
  const logoY = interpolate(frame, [0.3 * fps, 1.1 * fps], [0, -40], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

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
          width: 210,
          height: 210,
          borderRadius: 52,
          scale: String(logoScale),
          translate: `0px ${logoY}px`,
          boxShadow: '0 30px 70px rgba(0,0,0,0.4)',
        }}
      />
      <div style={{marginTop: 30, fontFamily: fonts.label, fontWeight: 700, color: colors.primaryFixed, fontSize: 26, letterSpacing: 6, textTransform: 'uppercase', opacity: interpolate(frame, [10, 24], [0, 1], {extrapolateRight: 'clamp'})}}>
        Creel · Chihuahua
      </div>
      <div style={{marginTop: 26}}>
        <Caption title="Perros callejeros en Creel." sub="Hay que verlos para poder actuar." align="center" tone="light" size={84} maxWidth={1500} />
      </div>
    </AbsoluteFill>
  );
};
