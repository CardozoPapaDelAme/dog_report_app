import React from 'react';
import {AbsoluteFill, Easing, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {Hook} from './scenes/Hook';
import {Types} from './scenes/Types';
import {Closing} from './scenes/Closing';
import {Backdrop} from './components/Backdrop';
import {Headline} from './components/Headline';
import {CamKey, Stage} from './components/Stage';
import {FloatChip, PulseRing} from './components/Chip';
import {Checklist, NotifCard} from './components/Cards';
import {Tap} from './components/Tap';
import {CheckIcon, FlameIcon, LayersIcon, PinIcon, ShieldIcon} from './components/icons';
import {SCREEN_H, SCREEN_W} from './components/Phone';
import {CameraScreen} from './screens/CameraScreen';
import {FormScreen} from './screens/FormScreen';
import {scenes, sec} from './theme';

export type PromoProps = {cameraSource: 'recreated' | 'real'};

const range = (s: {from: number; to: number}) => ({from: sec(s.from), durationInFrames: sec(s.to) - sec(s.from)});

/** First / last frame of every scene (global frames @30fps). Everything below is written relative to these. */
const S = {
  camera: sec(scenes.camera.from),
  types: sec(scenes.types.from),
  form: sec(scenes.form.from),
  map: sec(scenes.map.from),
  zone: sec(scenes.zone.from),
  assoc: sec(scenes.association.from),
  admin: sec(scenes.admin.from),
  closing: sec(scenes.closing.from),
};

const Clip: React.FC<{src: string; taps?: {x: number; y: number; at: number}[]}> = ({src, taps = []}) => (
  <AbsoluteFill style={{background: '#000'}}>
    <OffthreadVideo src={staticFile(src)} muted style={{width: SCREEN_W, height: SCREEN_H, objectFit: 'cover'}} />
    {taps.map((t, i) => (
      <Tap key={i} x={t.x} y={t.y} at={t.at} />
    ))}
  </AbsoluteFill>
);

const TextSlot: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', left: 130, top: 0, bottom: 0, width: 940, display: 'flex', alignItems: 'center'}}>{children}</div>
);

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeIn = Easing.bezier(0.7, 0, 0.84, 0);

// Base placement of the phone: screen center on (1390, 540), zoom 1.05.
const B = {s: 1.05, fx: 196.5, fy: 426, tx: 1390, ty: 540};
const below = {...B, ty: 540 + 1250};

/** A whip: the phone leaves upward at the end of a scene and re-enters from below with the next framing. */
const whip = (end: number, from: Omit<CamKey, 'f'>, to: Omit<CamKey, 'f' | 'e'>): CamKey[] => [
  {f: end - 6, ...from},
  {f: end + 4, ...from, ty: from.ty - 1700, e: easeIn},
  {f: end + 5, ...to, ty: to.ty + 1700},
  {f: end + 24, ...to, e: easeOut},
];

const E = {
  form: S.map,
  map: S.zone,
  zone: S.assoc,
  assoc: S.admin,
  admin: S.closing,
};

const formEnd = {s: 1.55, fx: 196, fy: 700, tx: 1390, ty: 690, r: 0};
const mapView = {s: 1.45, fx: 196, fy: 300, tx: 1390, ty: 540, r: 4};
const mapClose = {...mapView, s: 1.7};
const zoneSheet = {s: 1.4, fx: 196, fy: 560, tx: 1390, ty: 600, r: 0};
const zoneList = {s: 1.4, fx: 196, fy: 430, tx: 1390, ty: 540, r: 0};
const zoneDetail = {s: 1.5, fx: 196, fy: 330, tx: 1390, ty: 520, r: 0};
const assocTop = {s: 1.7, fx: 196, fy: 190, tx: 1390, ty: 420, r: -4};
const assocList = {s: 1.35, fx: 196, fy: 480, tx: 1390, ty: 540, r: -4};
const adminTop = {s: 1.7, fx: 196, fy: 230, tx: 1390, ty: 470, r: 4};
const adminEnd = {s: 1.45, fx: 196, fy: 330, tx: 1390, ty: 520, r: 4};

/**
 * Global camera over the phone. `r` is a flat 2D tilt in degrees (no 3D).
 * Interaction scenes hold each framing while the steps happen, so the flow can be followed.
 */
const camera: CamKey[] = [
  {f: 0, ...below},
  {f: 75, ...below},
  {f: 104, ...B, r: -5, e: easeOut},
  // camera scene: push in on the dog, pull back
  {f: 138, ...B, r: -5},
  {f: 162, s: 1.6, fx: 196, fy: 330, tx: 1390, ty: 520, r: -3},
  {f: S.types - 34, s: 1.6, fx: 196, fy: 330, tx: 1390, ty: 520, r: -3},
  {f: S.types - 12, ...B, r: -5},
  {f: S.types + 10, ...below, r: -5, e: easeIn},
  // types scene: phone is away
  {f: S.form - 4, ...below},
  // form: enter, follow the fields, drop to the submit button
  {f: S.form + 18, ...B, e: easeOut},
  {f: S.form + 37, s: 1.38, fx: 196, fy: 470, tx: 1390, ty: 560},
  {f: S.form + 185, s: 1.38, fx: 196, fy: 470, tx: 1390, ty: 560},
  {f: S.form + 212, ...formEnd},
  ...whip(E.form, formEnd, mapView),
  // map: settle, then a slow push while the heat map shows
  {f: S.map + 90, ...mapClose},
  {f: E.map - 6, ...mapClose},
  // zone: same framing during each step so every tap is readable
  {f: S.zone + 22, ...zoneSheet},
  {f: S.zone + 138, ...zoneSheet},
  {f: S.zone + 154, ...zoneList},
  {f: S.zone + 214, ...zoneList},
  {f: S.zone + 238, ...zoneDetail},
  ...whip(E.zone, zoneDetail, assocTop),
  // association: top for the period taps, then the list
  {f: S.assoc + 288, ...assocTop},
  {f: S.assoc + 304, ...assocList},
  ...whip(E.assoc, assocList, adminTop),
  // admin: top for the taps, then the thresholds
  {f: S.admin + 300, ...adminTop},
  {f: S.admin + 320, ...adminEnd},
  {f: E.admin + 18, ...adminEnd, ty: adminEnd.ty + 1300, e: easeIn},
];

export const Promo: React.FC<PromoProps> = ({cameraSource}) => {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Audio src={staticFile('promo-audio.wav')} volume={0.9} />

      <Sequence name="Hook" {...range(scenes.hook)}>
        <Hook />
      </Sequence>

      <Sequence name="Text camera" {...range(scenes.camera)}>
        <TextSlot>
          <Headline eyebrow="Reportar" lines={['Abre directo', 'en cámara.']} sub="La foto se valida en tu teléfono." tone="dark" />
        </TextSlot>
      </Sequence>
      <Sequence name="Types" {...range(scenes.types)}>
        <Types />
      </Sequence>
      <Sequence name="Text form" {...range(scenes.form)}>
        <TextSlot>
          <Headline eyebrow="Formulario" lines={['Reporta', 'en segundos.']} sub="Tipo, tamaño y color en un toque." tone="dark" />
        </TextSlot>
      </Sequence>
      <Sequence name="Text map" {...range(scenes.map)}>
        <TextSlot>
          <Headline eyebrow="Mapa público" lines={['Todo llega a un', 'mapa público.']} sub="Clusters, calor y pines por severidad." tone="light" />
        </TextSlot>
      </Sequence>
      <Sequence name="Text zone" {...range(scenes.zone)}>
        <TextSlot>
          <Headline eyebrow="Por zona" lines={['Gravedad por zona,', 'de un vistazo.']} sub="Cada reporte con su foto, tipo y fecha." tone="light" size={92} />
        </TextSlot>
      </Sequence>
      <Sequence name="Text association" {...range(scenes.association)}>
        <TextSlot>
          <Headline
            eyebrow="Asociación hotelera"
            lines={['Datos aceptados,', 'listos para exportar.']}
            tone="dark"
            size={82}
            extra={<Checklist title="Exporta en:" items={['CSV', 'Excel (XLSX)']} start={34} tone="dark" />}
          />
        </TextSlot>
      </Sequence>
      <Sequence name="Text admin" {...range(scenes.admin)}>
        <TextSlot>
          <Headline eyebrow="Administrador" lines={['Moderación y control,', 'sin perder el rastro.']} sub="Duplicados, zonas y umbrales." tone="light" size={88} />
        </TextSlot>
      </Sequence>

      <Stage keys={camera}>
        <AbsoluteFill>
          <Sequence name="Screen camera" {...range(scenes.camera)} layout="none">
            <CameraScreen source={cameraSource} />
          </Sequence>
          <Sequence name="Screen form" {...range(scenes.form)} layout="none">
            <FormScreen />
          </Sequence>
          <Sequence name="Screen map" {...range(scenes.map)} layout="none">
            <Clip
              src="map-c.mp4"
              taps={[
                {x: 363, y: 141, at: 69},
                {x: 363, y: 93, at: 162},
              ]}
            />
          </Sequence>
          <Sequence name="Screen zone" {...range(scenes.zone)} layout="none">
            <Clip
              src="zone-steps.mp4"
              taps={[
                {x: 178, y: 408, at: 5},
                {x: 201, y: 803, at: 128},
                {x: 201, y: 402, at: 215},
              ]}
            />
          </Sequence>
          <Sequence name="Screen association" {...range(scenes.association)} layout="none">
            <Clip
              src="assoc-c.mp4"
              taps={[
                {x: 78, y: 319, at: 93},
                {x: 201, y: 319, at: 231},
              ]}
            />
          </Sequence>
          <Sequence name="Screen admin" {...range(scenes.admin)} layout="none">
            <Clip
              src="admin-c.mp4"
              taps={[
                {x: 50, y: 297, at: 92},
                {x: 105, y: 89, at: 231},
                {x: 352, y: 297, at: 291},
              ]}
            />
          </Sequence>

          <PulseRing at={S.camera + 124} x={196} y={790} />
          <PulseRing at={S.form + 224} x={196} y={806} />
          <PulseRing at={S.map + 30} x={174} y={398} color="#ffffff" size={110} />
        </AbsoluteFill>
      </Stage>

      {/* notification cards and pills sit left of the phone so nothing covers the UI */}
      <NotifCard at={S.camera + 183} dur={24} x={1075} y={880} icon={<CheckIcon size={40} />} title="Foto validada" sub="Lista en tu teléfono" accent="ok" />

      <FloatChip at={S.form + 88} dur={60} x={1075} y={250} label="Human attack" tone="alert" anchor="right" />
      <NotifCard at={S.form + 232} dur={24} x={1075} y={900} icon={<CheckIcon size={40} />} title="Reporte enviado" sub="Human attack · hace un momento" accent="ok" />

      <NotifCard at={S.map + 34} dur={90} x={1075} y={230} icon={<PinIcon size={40} color="#ffffff" />} title="{n} reportes en la zona" sub="Mayor gravedad: Human attack" value={14} accent="alert" />
      <FloatChip at={S.map + 72} dur={70} x={1075} y={900} label="Mapa de calor" icon={<FlameIcon size={34} color="#ffffff" />} tone="forest" anchor="right" />
      <FloatChip at={S.map + 165} dur={40} x={1075} y={900} label="Vista de grupos" icon={<LayersIcon size={34} color="#ffffff" />} tone="forest" anchor="right" />

      <FloatChip at={S.zone + 6} dur={56} x={1075} y={900} label="1  Toca un grupo" tone="white" anchor="right" />
      <FloatChip at={S.zone + 16} dur={60} x={1075} y={230} label="Gravedad alta" tone="alert" anchor="right" />
      <FloatChip at={S.zone + 129} dur={50} x={1075} y={900} label="2  Ver reportes de la zona" tone="white" anchor="right" />
      <FloatChip at={S.zone + 216} dur={50} x={1075} y={900} label="3  Abre un reporte" tone="white" anchor="right" />
      <FloatChip at={S.zone + 252} dur={36} x={1075} y={230} label="Foto, tipo y fecha" icon={<PinIcon size={34} color="#ffffff" />} tone="forest" anchor="right" />

      <NotifCard at={S.assoc + 6} dur={76} x={1075} y={940} icon={<CheckIcon size={40} />} title="{n} reportes aceptados" sub="Últimos 30 días" value={67} accent="ok" />
      <FloatChip at={S.assoc + 94} dur={60} x={1075} y={230} label="Últimos 7 días" tone="white" anchor="right" />
      <NotifCard at={S.assoc + 118} dur={70} x={1075} y={940} icon={<CheckIcon size={40} />} title="{n} reportes aceptados" sub="Últimos 7 días" value={10} accent="ok" />
      <FloatChip at={S.assoc + 232} dur={50} x={1075} y={230} label="Últimos 30 días" tone="white" anchor="right" />

      <FloatChip at={S.admin + 10} dur={60} x={1075} y={900} label="Moderación" icon={<ShieldIcon size={34} color="#ffffff" />} tone="forest" anchor="right" />
      <FloatChip at={S.admin + 93} dur={60} x={1075} y={230} label="Duplicados" tone="signal" anchor="right" />
      <NotifCard at={S.admin + 130} dur={80} x={1075} y={940} icon={<PinIcon size={40} color="#ffffff" />} title="Reportes conectados" sub="Sugerencia 1 · 3 reportes" accent="warn" />
      <FloatChip at={S.admin + 232} dur={40} x={1075} y={230} label="Volver" tone="white" anchor="right" />
      <FloatChip at={S.admin + 292} dur={70} x={1075} y={900} label="Umbrales" tone="forest" anchor="right" />

      <Sequence name="Closing" {...range(scenes.closing)}>
        <Closing />
      </Sequence>
    </AbsoluteFill>
  );
};
