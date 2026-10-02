import { detectDeviceLanguage, pickLanguage } from './deviceLanguage.js';

function assertEquals(actual, expected) {
  if (actual !== expected) throw new Error(`${actual} !== ${expected}`);
}

Deno.test('deviceLanguage: English locales select en', () => {
  assertEquals(pickLanguage(['en-US']), 'en');
  assertEquals(pickLanguage(['EN_gb']), 'en');
});

Deno.test('deviceLanguage: Spanish and unsupported locales fall back to es', () => {
  assertEquals(pickLanguage(['es-MX']), 'es');
  assertEquals(pickLanguage(['fr-FR', 'de']), 'es');
  assertEquals(pickLanguage([undefined, '']), 'es');
});

Deno.test('deviceLanguage: first supported preference wins', () => {
  assertEquals(pickLanguage(['fr-FR', 'en-US', 'es-MX']), 'en');
});

Deno.test('deviceLanguage: detects from navigator then Intl, tolerates missing env', () => {
  assertEquals(detectDeviceLanguage({ navigator: { languages: ['en-US'] } }), 'en');
  assertEquals(detectDeviceLanguage({ Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ locale: 'en-CA' }) }) } }), 'en');
  assertEquals(detectDeviceLanguage({}), 'es');
});
