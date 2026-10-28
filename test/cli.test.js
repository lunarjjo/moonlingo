import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BIN = fileURLToPath(new URL('../bin/moonlingo.js', import.meta.url));
const ROOT = dirname(dirname(BIN)); // repository root

function makeProject(dictionaries, configExtra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'moonlingo-cli-'));
  mkdirSync(join(dir, 'site'), { recursive: true });
  mkdirSync(join(dir, 'locales'), { recursive: true });
  writeFileSync(
    join(dir, 'site', 'index.html'),
    '<html><head><title data-i18n="title">src</title></head><body><p data-i18n="hello">hi</p></body></html>',
  );
  for (const [tag, dict] of Object.entries(dictionaries)) {
    writeFileSync(join(dir, 'locales', `${tag}.json`), JSON.stringify(dict));
  }
  writeFileSync(
    join(dir, 'moonlingo.config.json'),
    JSON.stringify({ locales: Object.keys(dictionaries), ...configExtra }),
  );
  return dir;
}

test('cli: --version prints the package version', () => {
  const result = spawnSync(process.execPath, [BIN, '--version'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('cli: build succeeds end-to-end on a fixture project', () => {
  const dir = makeProject(
    { en: { title: 'Site', hello: 'Hello' }, id: { title: 'Situs', hello: 'Halo' } },
  );
  try {
    const result = spawnSync(process.execPath, [BIN, 'build', '--config', join(dir, 'moonlingo.config.json')], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(result.stdout.includes('locales: en, id'));
    assert.ok(existsSync(join(dir, 'dist', 'id', 'index.html')));
    assert.ok(existsSync(join(dir, 'dist', 'index.html')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: check exits non-zero when keys are missing', () => {
  const dir = makeProject({ en: { title: 'Site', hello: 'Hello' }, id: { title: 'Situs' } });
  try {
    const result = spawnSync(process.execPath, [BIN, 'check', '--config', join(dir, 'moonlingo.config.json')], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.equal(result.status, 1);
    assert.ok(result.stdout.includes('missing: hello'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: check exits zero when dictionaries are complete', () => {
  const dir = makeProject({ en: { title: 'Site', hello: 'Hello' }, id: { title: 'Situs', hello: 'Halo' } });
  try {
    const result = spawnSync(process.execPath, [BIN, 'check', '--config', join(dir, 'moonlingo.config.json')], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('moonlingo check: ok'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: missing config produces a friendly error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moonlingo-empty-'));
  try {
    const result = spawnSync(process.execPath, [BIN, 'build'], { encoding: 'utf8', cwd: dir });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('config file not found'));
    assert.ok(result.stderr.includes('moonlingo init'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: unknown command shows help and fails', () => {
  const result = spawnSync(process.execPath, [BIN, 'frobnicate'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('unknown command'));
});
