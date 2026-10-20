import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {colors, scenes, sec} from '../theme';

type Mode = 'light' | 'dark';

/** Background changes: a big circle grows from the phone and repaints the screen (global frames @30fps). */
const at = (scene: keyof typeof scenes) => sec(scenes[scene].from);
export const transitions: {f0: number; f1: number; to: Mode}[] = [
  {f0: 76, f1: 98, to: 'light'},
  {f0: at('types') - 14, f1: at('types') + 12, to: 'dark'},
  {f0: at('form') - 16, f1: at('form') + 10, to: 'light'},
  {f0: at('map') - 10, f1: at('map') + 12, to: 'dark'},
  {f0: at('association') - 14, f1: at('association') + 10, to: 'light'},
  {f0: at('admin') - 15, f1: at('admin') + 9, to: 'dark'},
];

const CX = 1390;
const CY = 540;

/** 1 when the screen is dark, 0 when light (steps at the middle of each circle wipe). */
export const darkAt = (frame: number) => {
  let m: Mode = 'dark';
  for (const t of transitions) {
    if (frame >= (t.f0 + t.f1) / 2) m = t.to;
  }
  return m === 'dark' ? 1 : 0;
};

type Blob = {x: number; y: number; r: number; ax: number; ay: number; sp: number; ph: number; light: string; dark: string};

const blobs: Blob[] = [
  {x: 330, y: 240, r: 620, ax: 140, ay: 90, sp: 0.011, ph: 0.0, light: 'rgba(165,214,167,0.65)', dark: 'rgba(46,125,50,0.55)'},
  {x: 1500, y: 880, r: 700, ax: 120, ay: 110, sp: 0.009, ph: 1.7, light: 'rgba(217,242,212,0.95)', dark: 'rgba(27,94,32,0.7)'},
  {x: 1180, y: 160, r: 480, ax: 160, ay: 70, sp: 0.013, ph: 3.1, light: 'rgba(233,230,0,0.22)', dark: 'rgba(233,230,0,0.13)'},
  {x: 520, y: 940, r: 520, ax: 110, ay: 80, sp: 0.012, ph: 4.6, light: 'rgba(145,215,138,0.5)', dark: 'rgba(145,215,138,0.16)'},
];

const Layer: React.FC<{mode: Mode; frame: number; clip?: string}> = ({mode, frame, clip}) => {
  const dark = mode === 'dark';
  return (
    <AbsoluteFill
      style={{
        background: dark
          ? `linear-gradient(135deg, ${colors.forestDeep} 0%, ${colors.forestField} 100%)`
          : `linear-gradient(135deg, ${colors.background} 0%, #e4f3df 100%)`,
        clipPath: clip,
      }}
    >
      {blobs.map((b, i) => {
        const dx = Math.sin(frame * b.sp + b.ph) * b.ax;
        const dy = Math.cos(frame * b.sp * 1.3 + b.ph) * b.ay;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: b.x - b.r + dx,
              top: b.y - b.r + dy,
              width: b.r * 2,
              height: b.r * 2,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${dark ? b.dark : b.light} 0%, rgba(0,0,0,0) 68%)`,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${dark ? 'rgba(201,230,196,0.16)' : 'rgba(0,69,13,0.16)'} 1.6px, transparent 1.7px)`,
          backgroundSize: '44px 44px',
          opacity: 0.55,
        }}
      />
    </AbsoluteFill>
  );
};

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  let base: Mode = 'dark';
  let active: (typeof transitions)[number] | null = null;
  for (const t of transitions) {
    if (frame >= t.f1) base = t.to;
    else {
      if (frame >= t.f0) active = t;
      break;
    }
  }
  const r = active ? interpolate(frame, [active.f0, active.f1], [0, 2100], {easing: Easing.bezier(0.65, 0, 0.35, 1)}) : 0;
  return (
    <AbsoluteFill>
      <Layer mode={base} frame={frame} />
      {active ? <Layer mode={active.to} frame={frame} clip={`circle(${r}px at ${CX}px ${CY}px)`} /> : null}
    </AbsoluteFill>
  );
};
