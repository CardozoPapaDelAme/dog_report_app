import React from 'react';

type P = {size?: number; color?: string; stroke?: number};

const base = (size: number, color: string, stroke: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: stroke,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const PinIcon: React.FC<P> = ({size = 22, color = '#fff', stroke = 2}) => (
  <svg {...base(size, color, stroke)}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

export const ShieldIcon: React.FC<P> = ({size = 22, color = '#fff', stroke = 2}) => (
  <svg {...base(size, color, stroke)}>
    <path d="M12 3 5 6v6c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6l-7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

export const PencilIcon: React.FC<P> = ({size = 22, color = '#fff', stroke = 2}) => (
  <svg {...base(size, color, stroke)}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export const CloseIcon: React.FC<P> = ({size = 24, color = '#00450d', stroke = 2.4}) => (
  <svg {...base(size, color, stroke)}>
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);

export const CheckIcon: React.FC<P> = ({size = 24, color = '#fff', stroke = 3}) => (
  <svg {...base(size, color, stroke)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const LayersIcon: React.FC<P> = ({size = 28, color = '#fff', stroke = 2}) => (
  <svg {...base(size, color, stroke)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12.5 9 5 9-5" />
    <path d="m3 16.5 9 5 9-5" />
  </svg>
);

export const FlameIcon: React.FC<P> = ({size = 28, color = '#00450d', stroke = 2}) => (
  <svg {...base(size, color, stroke)}>
    <path d="M12 3c.6 3.2 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-1.7.8-2.8 1.7-3.6.2 1.2.9 1.9 1.6 2C10.4 7.6 10.8 5 12 3Z" />
  </svg>
);

export const BackIcon: React.FC<P> = ({size = 26, color = '#00450d', stroke = 2.4}) => (
  <svg {...base(size, color, stroke)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const PawIcon: React.FC<P & {fill?: string}> = ({size = 26, color = '#fff', stroke = 2, fill = 'none'}) => (
  <svg {...base(size, color, stroke)} fill={fill}>
    <path d="M7.8 14.2c-1.4 1-2.3 2.2-2.3 3.4 0 1.5 1.3 2.4 3 2.4 1.2 0 2-.5 3.5-.5s2.3.5 3.5.5c1.7 0 3-.9 3-2.4 0-1.2-.9-2.4-2.3-3.4-1-.7-1.7-1.9-2.2-3-.3-.7-1-1.2-2-1.2s-1.7.5-2 1.2c-.5 1.1-1.2 2.3-2.2 3Z" />
    <circle cx="6" cy="9.5" r="1.4" />
    <circle cx="10" cy="6" r="1.4" />
    <circle cx="14.5" cy="6" r="1.4" />
    <circle cx="18.5" cy="9.5" r="1.4" />
  </svg>
);

export const DownloadIcon: React.FC<P> = ({size = 26, color = '#c9e6c4', stroke = 2}) => (
  <svg {...base(size, color, stroke)}>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />
  </svg>
);
