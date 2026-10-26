import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDocumentPaths } from './check-doc-paths.mjs';

function fixture(t, trace = '') {
  const root = mkdtempSync(join(tmpdir(), 't4-doc-paths-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/testing/nested'), { recursive: true });
  mkdirSync(join(root, 'models'));
  writeFileSync(join(root, 'models/real.test.js'), '');
  writeFileSync(join(root, 'docs/TRACEABILITY.md'), trace);
  return root;
}

test('valid root paths resolve from the repo regardless of the document directory', (t) => {
  const root = fixture(t, '`models/real.test.js`');
  writeFileSync(join(root, 'docs/testing/nested/case.md'), '[test](/models/real.test.js#test)');
  assert.equal(checkDocumentPaths(root).errors.length, 0);
});

test('links without a leading slash fail because GitHub resolves them from the document directory', (t) => {
  const root = fixture(t, '[ok](/models/real.test.js)');
  writeFileSync(join(root, 'docs/testing/nested/case.md'), '[test](models/real.test.js)\n[missing](/models/missing.js)');
  const errors = checkDocumentPaths(root).errors;
  assert.deepEqual(errors.map(x => [x.doc, x.line]), [['docs/testing/nested/case.md', 1], ['docs/testing/nested/case.md', 2]]);
  assert.match(errors[0].reason, /empezar con \//);
  assert.equal(errors[1].reason, 'archivo inexistente');
});

test('missing paths in code, plain prose, fenced examples and links fail with source lines', (t) => {
  const root = fixture(t, '`models/missing.test.js`\nmodels/absent.js\n```sh\nnode scripts/missing.mjs\n```\n[missing](/docs/testing/missing.md)');
  const result = checkDocumentPaths(root);
  assert.deepEqual(result.errors.map(x => x.line), [1, 2, 4, 6]);
});

test('relative paths and backend abbreviations fail even when the target exists', (t) => {
  const root = fixture(t, '[test](./models/real.test.js)\n[test](docs/../models/real.test.js)\n`B/controllers/missing.js`');
  const errors = checkDocumentPaths(root).errors;
  assert.equal(errors.length, 3);
  assert(errors.some(x => x.path.startsWith('B/')));
});

test('backlog is the only document excluded; nested docs and JSON citations are checked', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'docs/testing/BACKLOG.md'), '`models/intentionally-wrong.js`');
  writeFileSync(join(root, 'docs/testing/nested/case.md'), '`models/missing.js`');
  writeFileSync(join(root, 'docs/testing/fixture.json'), '{"source":"models/missing.test.js"}');
  assert.equal(checkDocumentPaths(root).errors.length, 2);
});

test('stage 5 deployment docs and manuals are checked; their backlog is excluded', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'docs/deployment'));
  mkdirSync(join(root, 'docs/manuals'));
  writeFileSync(join(root, 'docs/deployment/BACKLOG.md'), '`scripts/future.mjs`');
  writeFileSync(join(root, 'docs/deployment/SLA.md'), '`models/missing.js`');
  writeFileSync(join(root, 'docs/manuals/INSTALLATION.md'), '`models/real.test.js`\n`scripts/missing.mjs`');
  const errors = checkDocumentPaths(root).errors;
  assert.deepEqual(errors.map(x => x.doc), ['docs/deployment/SLA.md', 'docs/manuals/INSTALLATION.md']);
});

test('URLs, contract fields and parameterized templates are not concrete file citations', (t) => {
  const root = fixture(t, 'https://example.test/missing.js\n[source](https://example.test/file.md)\n`details.cantidad_aprox`\n`docs/testing/cases/<modulo>.md`\n`docs/testing/data/*.json`');
  assert.equal(checkDocumentPaths(root).errors.length, 0);
});

test('encoded filenames and file citations to directories are handled correctly', (t) => {
  const root = fixture(t, '[file](/docs/testing/My%20file.md)\n`docs/testing/pretend.js`');
  writeFileSync(join(root, 'docs/testing/My file.md'), '');
  mkdirSync(join(root, 'docs/testing/pretend.js'));
  assert.deepEqual(checkDocumentPaths(root).errors.map(x => x.path), ['docs/testing/pretend.js']);
});


test('file paths with uncommon extensions are checked, including install artifacts', (t) => {
  const root = fixture(t, '`docs/testing/data/missing.apk`\n`docs/testing/data/missing.customext`');
  assert.equal(checkDocumentPaths(root).errors.length, 2);
});


test('a command template does not hide a concrete missing file beside its parameter', (t) => {
  const root = fixture(t, '`node scripts/missing.mjs <option>`');
  assert.deepEqual(checkDocumentPaths(root).errors.map(x => x.path), ['scripts/missing.mjs']);
});

test('image embeds resolve from the document directory, as GitHub renders them', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'docs/manuals/img'), { recursive: true });
  writeFileSync(join(root, 'docs/manuals/img/shot.png'), '');
  writeFileSync(join(root, 'docs/manuals/USER-MANUAL.md'),
    '![ok](img/shot.png)\n![rooted](docs/manuals/img/shot.png)\n![missing](img/none.png)\n![outside](../../../x.png)');
  const errors = checkDocumentPaths(root).errors;
  assert.deepEqual(errors.map(x => x.line), [2, 3, 4]);
  assert.match(errors[0].reason, /relativa al documento/);
});
