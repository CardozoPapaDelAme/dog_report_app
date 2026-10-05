import esLocale from './locales/es.json' with { type: 'json' };
import enLocale from './locales/en.json' with { type: 'json' };

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
function assertEquals(actual, expected, message = 'Values differ') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

const flatten = (node, prefix = '', out = {}) => {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
};

const placeholders = (text) =>
  [...String(text).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

const es = flatten(esLocale);
const en = flatten(enLocale);

Deno.test('i18n: es and en expose identical key sets', () => {
  assertEquals(Object.keys(en).sort(), Object.keys(es).sort());
});

Deno.test('i18n: no empty or non-string values', () => {
  for (const [name, flat] of [['es', es], ['en', en]]) {
    for (const [key, value] of Object.entries(flat)) {
      assert(typeof value === 'string' && value.trim() !== '', `${name}:${key} is empty or not a string`);
    }
  }
});

Deno.test('i18n: interpolation placeholders match per key', () => {
  for (const key of Object.keys(es)) {
    if (key in en) assertEquals(placeholders(en[key]), placeholders(es[key]), `placeholders differ for ${key}`);
  }
});
