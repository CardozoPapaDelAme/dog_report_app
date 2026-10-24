#!/usr/bin/env node
/**
 * Documentation path checker.
 *
 * Invoked as `npm run test:docs` (`node scripts/check-doc-paths.mjs`) and as the `docs`
 * suite of `scripts/test-all.mjs`. Scans `docs/TRACEABILITY.md` and every file under
 * `docs/testing/`, `docs/deployment/` and `docs/manuals/` (except the stage backlogs) for
 * repository file citations and reports those that are not repo-rooted or do not exist. Sets exit code 1 when any error
 * is found.
 *
 * @module scripts/check-doc-paths
 */
// Repository file citations in traceability, Stage 4 and Stage 5 docs must stay valid.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensions = 'js|jsx|mjs|cjs|ts|tsx|json|sql|md|ya?ml|pdf|png|jpe?g|webp|mp4|csv|tsv|txt|toml|tflite|xlsx|zip|html|env|example';
const rootedFileCitation = /(?<![\w/])(?:\.{1,2}\/|\/)?(?:[\w@.-]+\/)+[\w@.-]+\.[a-zA-Z][a-zA-Z\d_-]*(?![\w.])/g;
// Backlogs cite wrong names and future files on purpose.
const excludedDocuments = new Set(['docs/testing/BACKLOG.md', 'docs/deployment/BACKLOG.md']);
const scannedDirectories = ['docs/testing', 'docs/deployment', 'docs/manuals'];
const fileCitation = new RegExp(`(?<![\\w/])(?:\\.{1,2}/|/)?(?:[\\w@.-]+/)*[\\w@.-]+\\.(?:${extensions})(?![\\w.])`, 'g');

/**
 * Lists the documents to scan, sorted.
 *
 * @param {string} root Repository root directory.
 * @returns {string[]} Repository-relative document paths.
 */
function documents(root) {
  const paths = ['docs/TRACEABILITY.md'];
  function walk(dir) {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (excludedDocuments.has(path)) continue;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  for (const dir of scannedDirectories) {
    if (existsSync(join(root, dir))) walk(dir);
  }
  return paths.sort();
}

/**
 * Checks every file citation (Markdown link targets and inline path-like tokens) in the
 * scanned documents. A citation is valid when it is repository-rooted (no `./`, `../`,
 * absolute path or `.`/`..` segment) and points to an existing file.
 *
 * @param {string} [root=repositoryRoot] Repository root directory.
 * @returns {{files: number, citations: number, errors: Array<{doc: string, line: number, path: string, reason: string}>}}
 *   Scanned file count, citation count and invalid citations.
 */
export function checkDocumentPaths(root = repositoryRoot) {
  const errors = [];
  let citations = 0;
  const files = documents(root);
  for (const doc of files) {
    const content = readFileSync(join(root, doc), 'utf8');
    if (content.includes('\0')) continue; // Images and other binary evidence.
    const lines = content.split(/\r?\n/);
    for (const [index, source] of lines.entries()) {
      const candidates = new Set();
      // Links are always rooted at the repo, even when Markdown is nested.
      for (const match of source.matchAll(/\]\(<?([^\s)]+)>?\)/g)) {
        const target = match[1].replace(/>$/, '');
        if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target) || /[<>{}*]/.test(target)) continue;
        candidates.add(decodeURIComponent(target.split('#')[0]));
      }
      const text = source
        .replace(/https?:\/\/[^\s`<>)]*/g, '')
        // Parameters/globs are format examples, not concrete file citations.
        .replace(/`([^`]*)`/g, (_, code) => '`' + code.split(/\s+/)
          .map(token => /[<>{}*]/.test(token) ? '' : token).join(' ') + '`')
        .replace(/\]\([^)]*\)/g, ']');
      for (const pattern of [fileCitation, rootedFileCitation]) {
        for (const match of text.matchAll(pattern)) candidates.add(match[0]);
      }
      for (const path of candidates) {
        citations++;
        const target = resolve(root, path);
        const rooted = !isAbsolute(path) && !path.startsWith('./') &&
          !path.startsWith('../') && !path.split('/').some(part => part === '..' || part === '.') &&
          !path.startsWith('B/') && !relative(root, target).startsWith('..');
        if (!rooted || !existsSync(target) || !statSync(target).isFile()) {
          errors.push({ doc, line: index + 1, path,
            reason: !rooted ? 'usar ruta completa desde la raíz del repo' : 'archivo inexistente' });
        }
      }
    }
  }
  return { files: files.length, citations, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkDocumentPaths();
  for (const error of result.errors) console.error(`${error.doc}:${error.line}: ${error.path}: ${error.reason}`);
  console.log(`Rutas documentales: ${result.files} archivos, ${result.citations} citas, ${result.errors.length} errores.`);
  process.exitCode = result.errors.length ? 1 : 0;
}
