import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {colors, fonts} from '../theme';
import {CheckIcon, CloseIcon, PawIcon} from '../components/icons';
import {SCREEN_H, SCREEN_W, StatusBar} from '../components/Phone';
import {Tap} from '../components/Tap';

/** Time stretch: the form timeline (authored for 120 frames) now runs over 120*K frames. */
export const K = 2.2;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const TYPES = ['Sighting', 'Pet attack', 'Livestock attack', 'Human attack', 'Injured dog', 'Other'];
const COLORS = ['#222623', '#f4f2ee', '#6b4423', '#8c928a', '#d9a441', 'split'];

const Label: React.FC<{children: React.ReactNode; top: number}> = ({children, top}) => (
  <div style={{position: 'absolute', left: 20, top, fontFamily: fonts.label, fontWeight: 700, fontSize: 14, color: colors.inkMuted}}>{children}</div>
);

const Seg: React.FC<{top: number; options: React.ReactNode[]; selected: number; pulseAt?: number}> = ({top, options, selected, pulseAt}) => {
  const frame = useCurrentFrame() / K;
  return (
    <div style={{position: 'absolute', left: 20, right: 20, top, height: 51, display: 'flex', borderRadius: 14, border: `1.5px solid ${colors.outline}`, overflow: 'hidden', background: '#fff'}}>
      {options.map((o, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 16,
            background: i === selected ? colors.primary : '#fff',
            color: i === selected ? '#fff' : colors.ink,
            borderLeft: i > 0 ? `1.5px solid ${colors.outline}` : 'none',
            scale: i === selected && pulseAt !== undefined ? String(interpolate(frame, [pulseAt, pulseAt + 5, pulseAt + 12], [1, 0.94, 1], clamp)) : '1',
          }}
        >
          {o}
        </div>
      ))}
    </div>
  );
};

/** Report form, mirrors app/screens/ReportFormScreen.js. Local timeline = 120 frames. */
export const FormScreen: React.FC = () => {
  const frame = useCurrentFrame() / K;

  const slide = interpolate(frame, [0, 16], [1, 0], {...clamp, easing: ease});
  const sheetIn = interpolate(frame, [16, 28], [0, 1], {...clamp, easing: ease}) - interpolate(frame, [44, 54], [0, 1], {...clamp, easing: ease});
  const typeChosen = frame >= 42;
  const biteShift = interpolate(frame, [48, 60], [0, 100], {...clamp, easing: ease});
  const bite = frame >= 66 ? 0 : -1; // tap "Yes" at 66
  const pack = frame >= 78 ? 1 : 0;
  const size = frame >= 88 ? 2 : -1;
  const colorSel = frame >= 98 ? 2 : -1;
  const submitting = frame >= 108;

  const shift = (y: number) => y + biteShift;

  return (
    <AbsoluteFill style={{background: colors.background, translate: `${slide * 140}px 0px`, opacity: interpolate(frame, [0, 8], [0, 1], clamp)}}>
      <StatusBar light={false} />
      <div style={{position: 'absolute', left: 20, top: 84}}>
        <CloseIcon size={26} />
      </div>
      <div style={{position: 'absolute', left: 20, top: 150, fontFamily: fonts.display, fontWeight: 600, fontSize: 38, color: colors.primary}}>New Report</div>
      <div style={{position: 'absolute', right: 20, top: 118, width: 91, height: 92, borderRadius: 16, overflow: 'hidden', border: `2px solid ${colors.primaryFixed}`}}>
        <Img src={staticFile('img/dog-placeholder.jpg')} style={{width: 140, height: 94, objectFit: 'cover', marginLeft: -48}} />
      </div>

      <Label top={238}>Incident type</Label>
      <div style={{position: 'absolute', left: 20, right: 20, top: 258, height: 51, borderRadius: 14, border: `1.5px solid ${colors.outline}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', fontFamily: fonts.body, fontSize: 17, color: colors.ink}}>
        {typeChosen ? 'Human attack' : 'Sighting'}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
      </div>

      <div style={{opacity: interpolate(frame, [52, 62], [0, 1], clamp)}}>
        <Label top={338}>Was there a bite?</Label>
        <Seg top={358} options={['Yes', 'No']} selected={bite} pulseAt={66} />
      </div>

      <Label top={shift(338)}>Solitary dog or pack</Label>
      <Seg top={shift(358)} options={['Solitary', 'Pack']} selected={pack} pulseAt={78} />

      <Label top={shift(440)}>Approximate size</Label>
      <Seg
        top={shift(460)}
        options={[
          <><PawIcon size={14} color="currentColor" />Small</>,
          <><PawIcon size={18} color="currentColor" />Medium</>,
          <><PawIcon size={22} color="currentColor" />Large</>,
        ]}
        selected={size}
        pulseAt={88}
      />

      <Label top={shift(542)}>Approximate colour</Label>
      <div style={{position: 'absolute', left: 20, right: 20, top: shift(566), display: 'flex', justifyContent: 'space-between'}}>
        {COLORS.map((c, i) => (
          <div
            key={i}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              background: c === 'split' ? `linear-gradient(90deg, #222623 50%, #f4f2ee 50%)` : c,
              border: `2px solid ${i === colorSel ? colors.signal : colors.outlineSoft}`,
              boxShadow: i === colorSel ? `0 0 0 3px ${colors.primary}` : 'none',
              scale: i === colorSel ? String(interpolate(frame, [98, 104, 110], [1, 0.88, 1.08], clamp)) : '1',
            }}
          />
        ))}
      </div>

      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, background: colors.primary, padding: '12px 14px 0'}}>
        <div style={{height: 52, borderRadius: 16, background: colors.signal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.display, fontWeight: 600, fontSize: 21, color: colors.forestDeep, scale: String(interpolate(frame, [104, 109, 114], [1, 0.96, 1], clamp))}}>
          {submitting ? (
            <svg width="26" height="26" viewBox="0 0 26 26" style={{rotate: `${frame * 16}deg`}}>
              <circle cx="13" cy="13" r="10" stroke="rgba(6,48,11,0.25)" strokeWidth="4" fill="none" />
              <circle cx="13" cy="13" r="10" stroke={colors.forestDeep} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="22 80" />
            </svg>
          ) : (
            'Submit report'
          )}
        </div>
      </div>

      {/* incident type sheet */}
      {sheetIn > 0.001 ? (
        <>
          <AbsoluteFill style={{background: colors.forestDeep, opacity: 0.5 * sheetIn}} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 380, background: '#fff', borderRadius: '28px 28px 0 0', translate: `0px ${(1 - sheetIn) * 380}px`, overflow: 'hidden'}}>
            <div style={{fontFamily: fonts.display, fontWeight: 600, fontSize: 24, color: colors.ink, padding: '24px 20px 14px'}}>Incident type</div>
            {TYPES.map((t, i) => {
              const sel = i === (typeChosen ? 3 : 0);
              return (
                <div key={t} style={{height: 51, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', fontFamily: fonts.body, fontWeight: sel ? 700 : 400, fontSize: 18, color: sel ? colors.primary : colors.ink, background: sel ? colors.primarySoft : '#fff', borderTop: `1px solid ${colors.border}`}}>
                  {t}
                  {sel ? <CheckIcon size={22} color={colors.primary} /> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      <Tap x={190} y={283} at={14 * K} />
      <Tap x={90} y={SCREEN_H - 380 + 24 + 14 + 51 * 3 + 25} at={38 * K} />
      <Tap x={105} y={384} at={64 * K} />
      <Tap x={290} y={shift(358) + 25} at={76 * K} />
      <Tap x={325} y={shift(460) + 25} at={86 * K} />
      <Tap x={160} y={shift(566) + 21} at={96 * K} />
      <Tap x={190} y={SCREEN_H - 40} at={102 * K} />
    </AbsoluteFill>
  );
};
