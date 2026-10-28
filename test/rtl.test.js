import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isRtl } from '../src/rtl.js';

test('rtl: right-to-left primary subtags', () => {
  assert.equal(isRtl('ar'), true);
  assert.equal(isRtl('he'), true);
  assert.equal(isRtl('fa'), true);
  assert.equal(isRtl('ur'), true);
  assert.equal(isRtl('ps'), true);
  assert.equal(isRtl('sd'), true);
  assert.equal(isRtl('ug'), true);
  assert.equal(isRtl('yi'), true);
  assert.equal(isRtl('dv'), true);
  assert.equal(isRtl('ckb'), true);
});

test('rtl: variants keep the direction of their primary subtag', () => {
  assert.equal(isRtl('ar-EG'), true);
  assert.equal(isRtl('fa-Arab'), true);
  assert.equal(isRtl('ur-PK'), true);
  assert.equal(isRtl('he-IL'), true);
});

test('rtl: left-to-right languages', () => {
  assert.equal(isRtl('en'), false);
  assert.equal(isRtl('en-US'), false);
  assert.equal(isRtl('pt-BR'), false);
  assert.equal(isRtl('zh-CN'), false);
  assert.equal(isRtl('id'), false);
  assert.equal(isRtl('es'), false);
});

test('rtl: case-insensitive and whitespace tolerant', () => {
  assert.equal(isRtl('AR'), true);
  assert.equal(isRtl(' He '), true);
});

test('rtl: unknown or invalid input is ltr', () => {
  assert.equal(isRtl('xx'), false);
  assert.equal(isRtl(''), false);
  assert.equal(isRtl(null), false);
  assert.equal(isRtl(undefined), false);
});
