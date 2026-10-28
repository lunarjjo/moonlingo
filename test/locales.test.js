import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { flatten, loadLocales } from '../src/locales.js';

test('locales: nested objects flatten to dot-notation keys', () => {
  const flat = flatten({
    nav: { home: 'Home', about: { long: 'About us' } },
    title: 'Hello',
  });
  assert.deepEqual(flat, {
    'nav.home': 'Home',
    'nav.about.long': 'About us',
    title: 'Hello',
  });
});

test('locales: non-string leaf values are rejected', () => {
  assert.throws(() => flatten({ items: ['a', 'b'] }), /must be a string/);
  assert.throws(() => flatten({ count: 3 }), /must be a string/);
  assert.throws(() => flatten({ nothing: null }), /must be a string/);
});

test('locales: top-level input must be an object', () => {
  assert.throws(() => flatten('nope'), /JSON object/);
  assert.throws(() => flatten([]), /JSON object/);
});

function makeLocalesDir() {
  const dir = mkdtempSync(join(tmpdir(), 'moonlingo-loc-'));
  mkdirSync(join(dir, 'locales'), { recursive: true });
  writeFileSync(join(dir, 'locales/en.json'), '{"a": {"b": "hello"}}');
  writeFileSync(join(dir, 'locales/id.json'), '{"a": {"b": "halo"}}');
  return dir;
}

test('locales: loadLocales returns flattened maps per tag', () => {
  const dir = makeLocalesDir();
  const dicts = loadLocales(join(dir, 'locales'), ['en', 'id']);
  assert.equal(dicts.get('en')['a.b'], 'hello');
  assert.equal(dicts.get('id')['a.b'], 'halo');
});

test('locales: loadLocales names the missing file', () => {
  const dir = makeLocalesDir();
  assert.throws(() => loadLocales(join(dir, 'locales'), ['en', 'fr']), /locale file not found.*fr\.json/);
});

test('locales: loadLocales reports invalid JSON with the file name', () => {
  const dir = makeLocalesDir();
  writeFileSync(join(dir, 'locales/bad.json'), '{ oops');
  assert.throws(() => loadLocales(join(dir, 'locales'), ['bad']), /invalid JSON in.*bad\.json/);
});
