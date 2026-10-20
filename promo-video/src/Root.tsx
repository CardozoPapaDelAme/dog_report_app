import React from 'react';
import {Composition} from 'remotion';
import {Promo} from './Promo';
import {FPS, HEIGHT, WIDTH, scenes} from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Promo"
        component={Promo}
        durationInFrames={Math.round(scenes.closing.to * FPS)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{cameraSource: 'recreated' as 'recreated' | 'real'}}
      />
    </>
  );
};
