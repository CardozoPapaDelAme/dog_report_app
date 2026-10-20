import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {colors, fonts} from '../theme';

/** Word-by-word headline with a smaller supporting line. Local frame driven. */
export const Caption: React.FC<{
  title: string;
  sub?: string;
  eyebrow?: string;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  size?: number;
  maxWidth?: number;
}> = ({title, sub, eyebrow, align = 'left', tone = 'dark', size = 92, maxWidth = 760}) => {
  const frame = useCurrentFrame();
  const words = title.split(' ');
  const ink = tone === 'dark' ? colors.primary : '#ffffff';
  const subInk = tone === 'dark' ? colors.inkMuted : colors.onForest;
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  return (
    <div style={{maxWidth, textAlign: align}}>
      {eyebrow ? (
        <div
          style={{
            fontFamily: fonts.label,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: tone === 'dark' ? colors.primaryContainer : colors.primaryFixed,
            marginBottom: 18,
            opacity: interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.04,
          color: ink,
        }}
      >
        {words.map((w, i) => {
          const start = 4 + i * 3;
          const o = interpolate(frame, [start, start + 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: ease,
          });
          const y = interpolate(frame, [start, start + 14], [34, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: ease,
          });
          return (
            <span
              key={i}
              style={{display: 'inline-block', opacity: o, translate: `0px ${y}px`, marginRight: '0.26em'}}
            >
              {w}
            </span>
          );
        })}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 40,
            lineHeight: 1.3,
            color: subInk,
            marginTop: 26,
            opacity: interpolate(frame, [4 + words.length * 3 + 6, 4 + words.length * 3 + 22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
