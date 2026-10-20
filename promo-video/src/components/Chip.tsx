import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {colors, fonts} from '../theme';

const overshoot = Easing.bezier(0.34, 1.56, 0.64, 1);
const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Tone = 'ok' | 'alert' | 'warn' | 'white' | 'signal' | 'forest';

const tones: Record<Tone, {bg: string; fg: string; border: string}> = {
  ok: {bg: '#2e7d32', fg: '#ffffff', border: 'rgba(255,255,255,0.35)'},
  alert: {bg: '#b71c1c', fg: '#ffffff', border: 'rgba(255,255,255,0.35)'},
  warn: {bg: '#a64b00', fg: '#ffffff', border: 'rgba(255,255,255,0.35)'},
  white: {bg: '#ffffff', fg: colors.ink, border: colors.primarySoft},
  signal: {bg: colors.signal, fg: colors.forestDeep, border: 'rgba(6,48,11,0.2)'},
  forest: {bg: colors.forestField, fg: '#ffffff', border: colors.forestLine},
};

/**
 * Floating label that pops in at global frame `at` and leaves after `dur` frames.
 * `value` turns the label into a count-up number placed before `label`.
 */
export const FloatChip: React.FC<{
  at: number;
  dur?: number;
  x: number;
  y: number;
  label: string;
  value?: number;
  icon?: React.ReactNode;
  tone?: Tone;
  size?: number;
  anchor?: 'left' | 'right' | 'center';
}> = ({at, dur = 70, x, y, label, value, icon, tone = 'white', size = 1, anchor = 'center'}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur + 12) return null;
  const t = tones[tone];
  const inP = interpolate(frame, [at, at + 14], [0, 1], {...clamp, easing: overshoot});
  const op = interpolate(frame, [at, at + 6], [0, 1], clamp) * (1 - interpolate(frame, [at + dur, at + dur + 10], [0, 1], {...clamp, easing: easeIn}));
  const out = interpolate(frame, [at + dur, at + dur + 10], [0, 1], {...clamp, easing: easeIn});
  const bob = Math.sin((frame - at) / 11) * 5;
  const shown = value === undefined ? null : Math.round(interpolate(frame, [at + 4, at + 30], [0, value], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)}));
  const shiftX = anchor === 'right' ? '-100%' : anchor === 'center' ? '-50%' : '0%';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        translate: `${shiftX} -50%`,
        opacity: op,
        zIndex: 30,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14 * size,
          padding: `${14 * size}px ${26 * size}px`,
          borderRadius: 60,
          background: t.bg,
          color: t.fg,
          border: `2px solid ${t.border}`,
          fontFamily: fonts.body,
          fontWeight: 700,
          fontSize: 34 * size,
          whiteSpace: 'nowrap',
          boxShadow: '0 22px 50px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.18)',
          scale: String(inP * (1 - out * 0.15)),
          translate: `0px ${bob - out * 18}px`,
        }}
      >
        {icon}
        {shown !== null ? <span style={{fontFamily: fonts.label, fontWeight: 700, fontSize: 44 * size}}>{shown}</span> : null}
        <span>{label}</span>
      </div>
    </div>
  );
};

/** Pulsing ring in phone-screen coordinates (place inside the phone children). */
export const PulseRing: React.FC<{at: number; x: number; y: number; size?: number; color?: string; dur?: number}> = ({at, x, y, size = 90, color = colors.signal, dur = 46}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur) return null;
  return (
    <>
      {[0, 14].map((d) => {
        const p = interpolate(frame, [at + d, at + d + 30], [0, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
        if (frame < at + d) return null;
        return (
          <div
            key={d}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              border: `4px solid ${color}`,
              opacity: (1 - p) * 0.95,
              scale: String(0.5 + p * 1.1),
              zIndex: 45,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};
