import React from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, fonts} from '../theme';

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Two-line masked headline: line 1 solid, line 2 gradient accent. Slides up in, slides up out. */
export const Headline: React.FC<{
  eyebrow: string;
  lines: [string, string];
  sub?: string;
  tone: 'light' | 'dark';
  size?: number;
  maxWidth?: number;
  align?: 'left' | 'center';
  extra?: React.ReactNode;
}> = ({eyebrow, lines, sub, tone, size = 100, maxWidth = 900, align = 'left', extra}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - 11, durationInFrames - 1], [0, 1], {...clamp, easing: easeIn});

  const solid = tone === 'dark' ? colors.primary : '#ffffff';
  const marker = tone === 'dark' ? 'rgba(233,230,0,0.62)' : 'rgba(233,230,0,0.34)';
  const subInk = tone === 'dark' ? colors.inkMuted : colors.onForest;
  const eyebrowInk = tone === 'dark' ? colors.primaryContainer : colors.primaryFixed;

  const lineStyle = (start: number, accent: boolean): React.CSSProperties => {
    const p = interpolate(frame, [start, start + 18], [0, 1], {...clamp, easing: easeOut});
    const hl = interpolate(frame, [start + 16, start + 34], [0, 100], {...clamp, easing: easeOut});
    return {
      fontFamily: fonts.display,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1.08,
      translate: `0px ${(1 - p) * 112 - out * 112}%`,
      color: solid,
      width: 'fit-content',
      marginLeft: align === 'center' ? 'auto' : undefined,
      marginRight: align === 'center' ? 'auto' : undefined,
      ...(accent
        ? {
            backgroundImage: `linear-gradient(${marker}, ${marker})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${hl}% 0.34em`,
            backgroundPosition: '0 92%',
          }
        : {}),
    };
  };

  const barW = interpolate(frame, [0, 14], [0, 56], {...clamp, easing: easeOut});

  return (
    <div style={{maxWidth, textAlign: align}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: 16, marginBottom: 22, opacity: 1 - out}}>
        <div style={{width: barW, height: 4, borderRadius: 2, background: eyebrowInk}} />
        <div style={{fontFamily: fonts.label, fontWeight: 700, fontSize: 27, letterSpacing: 5, textTransform: 'uppercase', color: eyebrowInk}}>
          {eyebrow}
        </div>
      </div>
      <div style={{overflow: 'hidden', paddingBottom: 6}}>
        <div style={lineStyle(3, false)}>{lines[0]}</div>
      </div>
      <div style={{overflow: 'hidden', paddingBottom: 14}}>
        <div style={lineStyle(10, true)}>{lines[1]}</div>
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 38,
            lineHeight: 1.3,
            color: subInk,
            marginTop: 14,
            opacity: interpolate(frame, [24, 38], [0, 1], clamp) * (1 - out),
            translate: `0px ${interpolate(frame, [24, 40], [18, 0], {...clamp, easing: easeOut})}px`,
          }}
        >
          {sub}
        </div>
      ) : null}
      {extra}
    </div>
  );
};
