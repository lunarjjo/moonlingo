// moonlingo — locale dictionary loading.
// One JSON file per locale: locales/<tag>.json. Nested objects are flattened
// to dot-notation keys ("nav.home"). Values must be strings.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Flatten a nested dictionary object into dot-notation keys.
 * @param {object} obj
 * @param {string} [prefix]
 * @param {object} [out]
 * @returns {Record<string, string>}
 */
export function flatten(obj, prefix = '', out = {}) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('locale dictionary must be a JSON object');
  }
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else if (typeof value === 'string') {
      if (Object.hasOwn(out, path)) {
        throw new Error(
          `conflicting dictionary keys: "${path}" is defined both as a flat key and inside a nested object`,
        );
      }
      out[path] = value;
    } else {
      throw new Error(
        `locale value at "${path}" must be a string (got ${Array.isArray(value) ? 'array' : typeof value})`,
      );
    }
  }
  return out;
}

/**
 * Load and flatten the dictionary of every requested locale.
 * @param {string} localesDir directory containing <tag>.json files
 * @param {string[]} locales language tags (order preserved)
 * @returns {Map<string, Record<string, string>>}
 */
export function loadLocales(localesDir, locales) {
  const dicts = new Map();
  for (const tag of locales) {
    const file = join(localesDir, `${tag}.json`);
    let raw;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      throw new Error(`locale file not found: ${file}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`invalid JSON in ${file}: ${error.message}`);
    }
    let flat;
    try {
      flat = flatten(parsed);
    } catch (error) {
      throw new Error(`invalid dictionary in ${file}: ${error.message}`);
    }
    dicts.set(tag, flat);
  }
  return dicts;
}
