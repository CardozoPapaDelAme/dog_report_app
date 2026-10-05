import { attachDetectedColor } from './photoColorFlow.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

const photo = { photoUri: 'file:///p.jpg', validation: { status: 'accepted' }, validationSkipped: null };

Deno.test('RF22 attachDetectedColor stores the colour inside photo validation', async () => {
  const result = await attachDetectedColor(photo, async () => ({ color: 'negro', confidence: 0.8 }));
  assert(result.validation.status === 'accepted');
  assert(result.validation.dog_color.color === 'negro');
  assert(photo.validation.dog_color === undefined, 'input must not be mutated');
});

Deno.test('RF22 attachDetectedColor also covers skipped validation (Expo Go/web)', async () => {
  const skipped = { photoUri: 'file:///p.jpg', validation: { status: 'skipped', reason: 'expo_go' } };
  const result = await attachDetectedColor(skipped, async () => ({ color: 'gris', confidence: 0.7 }));
  assert(result.validation.reason === 'expo_go' && result.validation.dog_color.color === 'gris');
});

Deno.test('RF22 attachDetectedColor fails open on null, unknown colour, throw or no photo', async () => {
  assert(await attachDetectedColor(photo, async () => null) === photo);
  assert(await attachDetectedColor(photo, async () => ({ color: 'verde' })) === photo);
  assert(await attachDetectedColor(photo, async () => { throw new Error('boom'); }) === photo);
  assert(await attachDetectedColor(null, async () => ({ color: 'negro' })) === null);
  assert(await attachDetectedColor({ photoUri: null }, async () => ({ color: 'negro' })).then((r) => r.photoUri === null));
});

Deno.test('attachDetectedColor leaves the photo unchanged when detection hangs', async () => {
  const photo = { photoUri: 'file:///photo.jpg', validation: { status: 'accepted' } };
  const result = await attachDetectedColor(photo, () => new Promise(() => {}), 20);
  if (result !== photo) throw new Error('expected the original photo');
});
