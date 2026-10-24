import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {OffthreadVideo} from 'remotion';
import {colors, fonts} from '../theme';
import {CheckIcon, PencilIcon, PinIcon, ShieldIcon} from '../components/icons';
import {SCREEN_H, SCREEN_W, StatusBar} from '../components/Phone';

/**
 * Camera screen, mirrors app/screens/CameraScreen.js.
 * source="recreated": animated viewfinder over a still photo.
 * source="real": the screen recording supplied by the team (public/camara-real.mp4).
 */
export type CameraTiming = {
  panStart: number;
  panEnd: number;
  focus: number;
  shutter: number;
  accepted: number;
  end: number;
};

export const defaultCameraTiming: CameraTiming = {
  panStart: 20,
  panEnd: 88,
  focus: 80,
  shutter: 124,
  accepted: 182,
  end: 225,
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const CameraScreen: React.FC<{
  source: 'recreated' | 'real';
  timing?: CameraTiming;
  realSrc?: string;
  realTrimBefore?: number;
  realPlaybackRate?: number;
}> = ({source, timing = defaultCameraTiming, realSrc = 'camara-real.mp4', realTrimBefore = 0, realPlaybackRate = 1}) => {
  if (source === 'real') {
    return (
      <AbsoluteFill style={{background: '#000'}}>
        <OffthreadVideo
          src={staticFile(realSrc)}
          trimBefore={realTrimBefore}
          playbackRate={realPlaybackRate}
          muted
          style={{width: SCREEN_W, height: SCREEN_H, objectFit: 'cover'}}
        />
        <StatusBar light />
      </AbsoluteFill>
    );
  }
  return <CameraRecreated timing={timing} />;
};

const CameraRecreated: React.FC<{timing: CameraTiming}> = ({timing}) => {
  const frame = useCurrentFrame();
  const t = timing;
  const pan = interpolate(frame, [t.panStart, t.panEnd], [0, 1], {...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1)});
  // The source photo is wider than the viewport: slide the "window" onto the dog.
  const photoH = SCREEN_H;
  const photoW = 1206 * (photoH / 808);
  const startX = 0.02 * photoW;
  const endX = 0.37 * photoW;
  const offsetX = -(startX + (endX - startX) * pan);
  const zoom = interpolate(frame, [t.panStart, t.shutter], [1.0, 1.08], clamp);
  const jitter = frame < t.shutter ? Math.sin(frame / 5) * 2.2 * (1 - pan * 0.8) : 0;

  const focusIn = interpolate(frame, [t.focus, t.focus + 10], [0, 1], {...clamp, easing: ease});
  const focusScale = interpolate(frame, [t.focus, t.focus + 12], [1.5, 1], {...clamp, easing: ease, output: 'perceptual-scale'});
  const shutterPress = interpolate(frame, [t.shutter - 3, t.shutter, t.shutter + 6], [1, 0.84, 1], clamp);
  const flash = interpolate(frame, [t.shutter, t.shutter + 2, t.shutter + 9], [0, 0.85, 0], clamp);
  const frozen = frame >= t.shutter;
  const validating = frame >= t.shutter + 6 && frame < t.accepted;
  const accepted = frame >= t.accepted;
  const prog = interpolate(frame, [t.shutter + 6, t.accepted - 4], [0, 1], clamp);
  const hint = interpolate(frame, [4, 16], [0, 1], clamp) * (1 - interpolate(frame, [t.shutter - 2, t.shutter + 4], [0, 1], clamp));

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        <Img
          src={staticFile('img/dog-placeholder.jpg')}
          style={{
            position: 'absolute',
            height: photoH,
            width: photoW,
            left: offsetX + jitter,
            top: 0,
            scale: String(zoom),
            transformOrigin: `${(-offsetX + SCREEN_W / 2) / photoW * 100}% 50%`,
            filter: frozen ? 'brightness(0.62)' : 'none',
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.78) 100%)',
          }}
        />
      </div>

      {/* top bar */}
      <div style={{position: 'absolute', top: 66, left: 0, right: 0, padding: '0 18px', display: 'flex', justifyContent: 'space-between', opacity: 1 - interpolate(frame, [t.shutter, t.shutter + 6], [0, 0.6], clamp)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: fonts.label, fontWeight: 600, fontSize: 17, color: '#fff'}}>
          <PinIcon size={20} /> View map
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: fonts.label, fontWeight: 600, fontSize: 17, color: '#fff'}}>
          <ShieldIcon size={20} /> Staff login
        </div>
      </div>

      {/* focus brackets */}
      {frame >= t.focus && !frozen ? (
        <div
          style={{
            position: 'absolute',
            left: 58,
            top: 120,
            width: 262,
            height: 330,
            opacity: focusIn,
            scale: String(focusScale),
          }}
        >
          {[
            {l: 0, tp: 0, bw: '4px 0 0 4px', br: '14px 0 0 0'},
            {r: 0, tp: 0, bw: '4px 4px 0 0', br: '0 14px 0 0'},
            {l: 0, b: 0, bw: '0 0 4px 4px', br: '0 0 0 14px'},
            {r: 0, b: 0, bw: '0 4px 4px 0', br: '0 0 14px 0'},
          ].map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 44,
                height: 44,
                left: c.l,
                right: c.r,
                top: c.tp,
                bottom: c.b,
                borderStyle: 'solid',
                borderColor: colors.signal,
                borderWidth: c.bw,
                borderRadius: c.br,
              }}
            />
          ))}
        </div>
      ) : null}

      {/* validation overlay */}
      {validating ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{rotate: `${frame * 14}deg`}}>
            <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.25)" strokeWidth="6" fill="none" />
            <circle cx="32" cy="32" r="26" stroke={colors.signal} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${40 + prog * 60} 200`} />
          </svg>
          <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 19, color: '#fff'}}>Validating photo…</div>
        </div>
      ) : null}
      {accepted ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 392,
            display: 'flex',
            justifyContent: 'center',
            opacity: interpolate(frame, [t.accepted, t.accepted + 8], [0, 1], clamp),
            scale: String(interpolate(frame, [t.accepted, t.accepted + 12], [0.7, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1), output: 'perceptual-scale'})),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 10, background: colors.severity.low, borderRadius: 40, padding: '12px 22px', fontFamily: fonts.body, fontWeight: 700, fontSize: 19, color: '#fff'}}>
            <CheckIcon size={22} /> Photo accepted
          </div>
        </div>
      ) : null}

      {/* bottom controls */}
      <div style={{position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
        <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 18, color: '#fff', opacity: hint}}>Take a clear photo of the dog</div>
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 40,
            border: '5px solid #fff',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            scale: String(shutterPress),
          }}
        >
          <div style={{width: 58, height: 58, borderRadius: 30, background: validating || accepted ? colors.signal : '#fff', opacity: validating || accepted ? 0.9 : 0}} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, fontFamily: fonts.label, fontWeight: 600, fontSize: 18, color: '#fff'}}>
          <PencilIcon size={22} /> Report without photo
        </div>
      </div>

      <AbsoluteFill style={{background: '#fff', opacity: flash}} />
      <StatusBar light />
    </AbsoluteFill>
  );
};
