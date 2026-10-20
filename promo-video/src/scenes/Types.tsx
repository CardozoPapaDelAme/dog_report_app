import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {colors, fonts} from '../theme';
import {Headline} from '../components/Headline';

const overshoot = Easing.bezier(0.34, 1.56, 0.64, 1);
const easeIO = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Severity colours from the app (green = low, orange = medium, red = high).
const TAGS = [
  {label: 'Sighting', sev: colors.severity.low, x: 330, y: 250, at: 3, ph: 0.0},
  {label: 'Pet attack', sev: colors.severity.medium, x: 1560, y: 230, at: 8, ph: 1.4},
  {label: 'Injured dog', sev: colors.severity.medium, x: 960, y: 120, at: 13, ph: 2.7},
  {label: 'Livestock attack', sev: colors.severity.medium, x: 300, y: 830, at: 18, ph: 4.0},
  {label: 'Human attack', sev: colors.severity.high, x: 1560, y: 820, at: 23, ph: 5.1},
  {label: 'Other', sev: colors.severity.low, x: 960, y: 965, at: 28, ph: 6.2},
] as const;

const CURSOR_FROM = {x: 1780, y: 1030};
const PICK = 4; // index of "Human attack"
const CLICK_AT = 78;

const Cursor: React.FC<{x: number; y: number}> = ({x, y}) => (
  <svg width="64" height="64" viewBox="0 0 24 24" style={{position: 'absolute', left: x - 8, top: y - 6, filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.45))', zIndex: 20}}>
    <path d="M4 3v16.5l4.6-4.1 3 6.6 2.6-1.2-3-6.5H18L4 3Z" fill="#ffffff" stroke="#06300b" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

/** Incident-type scene: floating tags, a cursor picks "Human attack". Local frames 0-120 (dark backdrop). */
export const Types: React.FC = () => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [108, 122], [0, 1], {...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0)});
  const pick = TAGS[PICK];

  const cp = interpolate(frame, [14, 74], [0, 1], {...clamp, easing: easeIO});
  const cx = CURSOR_FROM.x + (pick.x + 30 - CURSOR_FROM.x) * cp;
  const cy = CURSOR_FROM.y + (pick.y + 14 - CURSOR_FROM.y) * cp - Math.sin(cp * Math.PI) * 50;
  const cursorOp = interpolate(frame, [10, 20], [0, 1], clamp) * (1 - exit);

  return (
    <AbsoluteFill>
      {TAGS.map((t, i) => {
        const selected = i === PICK;
        const appear = interpolate(frame, [t.at, t.at + 14], [0, 1], {...clamp, easing: overshoot});
        const dx = Math.sin(frame / 31 + t.ph) * 16;
        const dy = Math.cos(frame / 27 + t.ph) * 12;
        const chosen = selected && frame >= CLICK_AT;
        const chosenP = interpolate(frame, [CLICK_AT, CLICK_AT + 12], [0, 1], {...clamp, easing: overshoot});
        const dim = !selected && frame >= CLICK_AT + 4 ? interpolate(frame, [CLICK_AT + 4, CLICK_AT + 16], [1, 0.3], clamp) : 1;
        return (
          <div
            key={t.label}
            style={{
              position: 'absolute',
              left: t.x + dx,
              top: t.y + dy,
              translate: '-50% -50%',
              scale: String(appear * (chosen ? 1 + 0.2 * chosenP : 1) * (1 - exit * 0.3)),
              opacity: appear * dim * (1 - exit),
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '20px 40px',
              borderRadius: 70,
              background: chosen ? colors.signal : colors.forestField,
              border: `2.5px solid ${chosen ? '#ffffff' : colors.forestLine}`,
              boxShadow: chosen ? '0 0 0 12px rgba(233,230,0,0.25), 0 26px 60px rgba(0,0,0,0.4)' : '0 18px 40px rgba(0,0,0,0.3)',
              fontFamily: fonts.body,
              fontWeight: 700,
              fontSize: 46,
              color: chosen ? colors.forestDeep : colors.onForest,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{width: 22, height: 22, borderRadius: 11, background: t.sev, boxShadow: `0 0 0 5px ${chosen ? 'rgba(6,48,11,0.15)' : 'rgba(255,255,255,0.1)'}`}} />
            {t.label}
          </div>
        );
      })}

      {frame >= CLICK_AT && frame < CLICK_AT + 22 ? (
        <div
          style={{
            position: 'absolute',
            left: pick.x + 30 - 70,
            top: pick.y + 14 - 70,
            width: 140,
            height: 140,
            borderRadius: 70,
            border: '5px solid #ffffff',
            opacity: 1 - (frame - CLICK_AT) / 22,
            scale: String(0.4 + ((frame - CLICK_AT) / 22) * 1.3),
          }}
        />
      ) : null}
      <div style={{opacity: cursorOp}}>
        <Cursor x={cx} y={cy} />
      </div>

      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Sequence durationInFrames={122} layout="none">
          <Headline
            eyebrow="Tipo de incidente"
            lines={['Elige el tipo', 'de incidente.']}
            sub="Seis categorías, con su gravedad."
            tone="light"
            align="center"
            size={112}
            maxWidth={1300}
          />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
