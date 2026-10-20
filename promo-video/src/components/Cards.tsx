import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {colors, fonts} from '../theme';
import {CheckIcon} from './icons';

const overshoot = Easing.bezier(0.34, 1.56, 0.64, 1);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Accent = 'ok' | 'alert' | 'warn' | 'forest';
const accents: Record<Accent, string> = {ok: '#2e7d32', alert: '#b71c1c', warn: '#a64b00', forest: colors.primary};

/**
 * Notification-style card (icon + 2 lines) that slides in from the right edge and leaves after `dur`.
 * `value` replaces `{n}` in the title with a count-up number. Global frame `at`.
 */
export const NotifCard: React.FC<{
  at: number;
  dur?: number;
  x: number;
  y: number;
  icon: React.ReactNode;
  title: string;
  sub: string;
  value?: number;
  accent?: Accent;
}> = ({at, dur = 70, x, y, icon, title, sub, value, accent = 'forest'}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur + 12) return null;
  const inP = interpolate(frame, [at, at + 16], [0, 1], {...clamp, easing: overshoot});
  const slide = interpolate(frame, [at, at + 16], [90, 0], {...clamp, easing: easeOut});
  const outP = interpolate(frame, [at + dur, at + dur + 11], [0, 1], {...clamp, easing: easeIn});
  const op = interpolate(frame, [at, at + 7], [0, 1], clamp) * (1 - outP);
  const bob = Math.sin((frame - at) / 13) * 4;
  const n = value === undefined ? null : Math.round(interpolate(frame, [at + 4, at + 34], [0, value], {...clamp, easing: easeOut}));
  const text = n === null ? title : title.replace('{n}', String(n));

  return (
    <div style={{position: 'absolute', left: x, top: y, translate: '-100% -50%', opacity: op, zIndex: 30}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '20px 34px 20px 22px',
          borderRadius: 30,
          background: '#ffffff',
          boxShadow: '0 26px 60px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.16)',
          border: `2px solid ${colors.primarySoft}`,
          translate: `${slide + outP * 50}px ${bob}px`,
          scale: String(0.9 + 0.1 * inP),
        }}
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 22,
            background: accents[accent],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          {icon}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
          <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 34, color: colors.ink, whiteSpace: 'nowrap'}}>{text}</div>
          <div style={{fontFamily: fonts.body, fontWeight: 600, fontSize: 26, color: colors.inkSubtle, whiteSpace: 'nowrap'}}>{sub}</div>
        </div>
      </div>
    </div>
  );
};

/** Checklist whose rows appear one by one, each with a popping check. Local frame `start`. */
export const Checklist: React.FC<{title: string; items: string[]; start: number; tone: 'light' | 'dark'}> = ({title, items, start, tone}) => {
  const frame = useCurrentFrame();
  const ink = tone === 'dark' ? colors.ink : '#ffffff';
  const muted = tone === 'dark' ? colors.inkMuted : colors.onForest;
  return (
    <div style={{marginTop: 34}}>
      <div style={{fontFamily: fonts.body, fontWeight: 600, fontSize: 38, color: muted, opacity: interpolate(frame, [start - 8, start], [0, 1], clamp)}}>{title}</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18}}>
        {items.map((it, i) => {
          const f0 = start + i * 14;
          const rowP = interpolate(frame, [f0, f0 + 14], [0, 1], {...clamp, easing: easeOut});
          const chk = interpolate(frame, [f0 + 6, f0 + 20], [0, 1], {...clamp, easing: overshoot});
          return (
            <div key={it} style={{display: 'flex', alignItems: 'center', gap: 20, opacity: rowP, translate: `${(1 - rowP) * -40}px 0px`}}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  background: '#2e7d32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  scale: String(chk),
                }}
              >
                <CheckIcon size={32} color="#ffffff" />
              </div>
              <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 46, color: ink}}>{it}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
