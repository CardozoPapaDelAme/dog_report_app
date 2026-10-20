import React from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import {Phone, SCREEN_H, SCREEN_W} from './Phone';
import {darkAt} from './Backdrop';

const BEZEL = 13;
const easeIO = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * Camera keyframe: phone-screen point (fx, fy) is placed at video point (tx, ty) at zoom `s`.
 * `e` is the easing of the segment that ENDS at this key (default ease in/out).
 */
export type CamKey = {f: number; s: number; fx: number; fy: number; tx: number; ty: number; r?: number; e?: (t: number) => number};

type Cam = {s: number; fx: number; fy: number; tx: number; ty: number; r: number};

export const sampleCam = (frame: number, keys: CamKey[]): Cam => {
  if (frame <= keys[0].f) return {...keys[0], r: keys[0].r ?? 0};
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const raw = (frame - a.f) / Math.max(1, b.f - a.f);
      const p = (b.e ?? easeIO)(Math.min(1, Math.max(0, raw)));
      const l = (x: number, y: number) => x + (y - x) * p;
      return {s: l(a.s, b.s), fx: l(a.fx, b.fx), fy: l(a.fy, b.fy), tx: l(a.tx, b.tx), ty: l(a.ty, b.ty), r: l(a.r ?? 0, b.r ?? 0)};
    }
  }
  const last = keys[keys.length - 1];
  return {...last, r: last.r ?? 0};
};

const place = (c: Cam) => ({x: c.tx - (c.fx + BEZEL) * c.s, y: c.ty - (c.fy + BEZEL) * c.s});

/** Flat 2D camera over a phone: zoom, pan and directional motion blur. No 3D. */
export const Stage: React.FC<{keys: CamKey[]; children: React.ReactNode}> = ({keys, children}) => {
  const frame = useCurrentFrame();
  const cam = sampleCam(frame, keys);
  const p = place(cam);
  const q = place(sampleCam(frame - 1, keys));
  const bx = Math.min(26, Math.abs(p.x - q.x) * 0.2);
  const by = Math.min(26, Math.abs(p.y - q.y) * 0.2);
  const blurred = bx + by > 0.6;
  const dark = darkAt(frame);

  return (
    <>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id="stage-mb" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={`${bx / Math.max(0.5, cam.s)} ${by / Math.max(0.5, cam.s)}`} />
        </filter>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SCREEN_W + BEZEL * 2,
          height: SCREEN_H + BEZEL * 2,
          transformOrigin: '0px 0px',
          translate: `${cam.tx}px ${cam.ty}px`,
          rotate: `${cam.r}deg`,
          scale: String(cam.s),
          transform: `translate(${-(cam.fx + BEZEL)}px, ${-(cam.fy + BEZEL)}px)`,
          filter: blurred ? 'url(#stage-mb)' : undefined,
        }}
      >
        <Phone rim={dark > 0.5}>{children}</Phone>
      </div>
    </>
  );
};
