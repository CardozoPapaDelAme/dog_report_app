# Promo video

Remotion project for the Creel Stray-Dog Reporting promo video (16:9, 30 fps, about 56 s).
It lives apart from the app: nothing here is imported by the mobile client.

## Run

```bash
npm install
node scripts-audio.mjs        # generates public/promo-audio.wav (music + SFX, no downloads)
npx remotion studio           # interactive preview
npx remotion render src/index.ts Promo renders/promo.mp4 --codec=h264 --crf=18
```

## Structure

- `src/scenes.json`: scene boundaries in seconds. Single source of truth, read by `src/theme.ts` and `scripts-audio.mjs`.
- `src/Promo.tsx`: timeline, 2D camera keyframes, tap marks and floating cards. All timings are relative to scene starts.
- `src/components/`: `Stage` (flat 2D camera with directional motion blur), `Backdrop` (circle-wipe background), `Headline`, `Cards`, `Chip`, `Phone`, `Tap`.
- `src/screens/` and `src/scenes/`: recreated camera and form screens, hook, incident-type scene, closing.
- `public/`: edited screen recordings (`*-c.mp4`, `zone-steps.mp4`), logo and placeholder photo.
- `odd/tasks/promo-video.md`: task log.

## Raw material

`material/` holds the simulator screenshots and the full-resolution, constant-30-fps screen recordings (`*-cfr.mp4`)
that the clips in `public/` are cut from with ffmpeg. The original variable-fps `.mov` files, the obsolete first-round
captures and the rendered videos stay local (not versioned). Re-record against the staging build if the UI changes.
