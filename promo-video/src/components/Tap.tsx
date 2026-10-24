import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

/** Expanding touch ripple at (x, y) on the phone canvas, starting at local frame `at`. */
export const Tap: React.FC<{x: number; y: number; at: number}> = ({x, y, at}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (frame < at || frame > at + 16) return null;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - 30,
          top: y - 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          background: 'rgba(0,0,0,0.18)',
          border: '2px solid rgba(255,255,255,0.7)',
          opacity: 1 - p,
          scale: String(0.5 + p * 0.9),
          zIndex: 40,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
