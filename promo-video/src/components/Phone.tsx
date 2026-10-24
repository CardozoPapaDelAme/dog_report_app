import React from 'react';
import {fonts} from '../theme';

export const SCREEN_W = 393;
export const SCREEN_H = 852;

export const StatusBar: React.FC<{light: boolean}> = ({light}) => {
  const c = light ? '#ffffff' : '#000000';
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_W,
        height: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 34px 0 48px',
        boxSizing: 'border-box',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <span style={{fontFamily: fonts.system, fontWeight: 600, fontSize: 17, color: c}}>9:41</span>
      <span style={{display: 'flex', gap: 6, alignItems: 'center'}}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill={c}>
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
          <path d="M1.5 4.2a10 10 0 0 1 14 0" />
          <path d="M4 7a6.4 6.4 0 0 1 9 0" />
          <circle cx="8.5" cy="10" r="1.1" fill={c} stroke="none" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke={c} opacity="0.4" />
          <rect x="2" y="2" width="19" height="9" rx="2.2" fill={c} />
          <path d="M24 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2Z" fill={c} opacity="0.5" />
        </svg>
      </span>
    </div>
  );
};

/**
 * iPhone frame. Children are laid out on a 393x852 pt canvas (the real app
 * viewport) and the whole device is scaled with `scale`.
 */
export const Phone: React.FC<{
  children: React.ReactNode;
  scale?: number;
  lightStatus?: boolean;
  rim?: boolean;
  style?: React.CSSProperties;
}> = ({children, scale = 1, lightStatus = false, rim = false, style}) => {
  const bezel = 13;
  return (
    <div
      style={{
        width: SCREEN_W + bezel * 2,
        height: SCREEN_H + bezel * 2,
        borderRadius: 68,
        background: 'linear-gradient(145deg, #2b2f2a, #0b0d0b)',
        padding: bezel,
        boxSizing: 'border-box',
        boxShadow: rim
          ? '0 50px 90px rgba(0,0,0,0.55), 0 0 0 2px #6d776a inset, 0 0 0 2px rgba(201,230,196,0.35)'
          : '0 50px 90px rgba(0,0,0,0.45), 0 0 0 2px #4a4f48 inset, 0 0 0 1px rgba(255,255,255,0.08)',
        scale: String(scale),
        transformOrigin: 'center center',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 55,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            top: 11,
            left: (SCREEN_W - 124) / 2,
            width: 124,
            height: 36,
            borderRadius: 20,
            background: '#000',
            zIndex: 60,
          }}
        />
      </div>
    </div>
  );
};
