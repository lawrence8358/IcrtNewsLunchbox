import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toMinuteSecond,
  defaultMonths,
  parseCliArgs,
  parseEnvText,
  DEFAULTS,
  ENV_KEY,
} from '../update-audio-words.mjs';

const API_URL = ['--api-url', 'http://localhost:9000/transcribe'];
const EMPTY_ENV = {};

test('toMinuteSecond 轉為分:秒（分鐘不補零）並捨去毫秒', () => {
  assert.equal(toMinuteSecond('00:00:01.330'), '0:01');
  assert.equal(toMinuteSecond('00:01:02.590'), '1:02');
  assert.equal(toMinuteSecond('00:12:34'), '12:34');
  assert.equal(toMinuteSecond('01:05:09.000'), '65:09');
});

test('toMinuteSecond 遇到非預期格式擲出錯誤', () => {
  assert.throws(() => toMinuteSecond('1.33'));
  assert.throws(() => toMinuteSecond(''));
  assert.throws(() => toMinuteSecond(null));
});

test('defaultMonths 回傳上個月與本月，含跨年', () => {
  assert.deepEqual(defaultMonths(new Date(2026, 6, 17)), ['202606', '202607']);
  assert.deepEqual(defaultMonths(new Date(2026, 0, 5)), ['202512', '202601']);
});

test('parseEnvText 解析 KEY=VALUE、註解、空行與引號', () => {
  const parsed = parseEnvText([
    '# 註解',
    '',
    'TRANSCRIBE_API_URL=http://localhost:9000/transcribe',
    'QUOTED="http://a/b"',
    "SINGLE='x y'",
    '不合法的行',
  ].join('\n'));
  assert.deepEqual(parsed, {
    TRANSCRIBE_API_URL: 'http://localhost:9000/transcribe',
    QUOTED: 'http://a/b',
    SINGLE: 'x y',
  });
});

test('parseCliArgs 未給 --api-url 時使用環境變數，CLI 優先', () => {
  const env = { [ENV_KEY]: 'http://from-env:9000/transcribe' };
  assert.equal(parseCliArgs(['202506'], env).apiUrl, 'http://from-env:9000/transcribe');
  assert.equal(parseCliArgs([...API_URL, '202506'], env).apiUrl, 'http://localhost:9000/transcribe');
});

test('parseCliArgs 解析指定月份與預設值', () => {
  const config = parseCliArgs([...API_URL, '202506', '202507']);
  assert.deepEqual(config.months, ['202506', '202507']);
  assert.equal(config.dataDir, DEFAULTS.dataDir);
  assert.equal(config.outDir, DEFAULTS.outDir);
  assert.equal(config.modelSize, DEFAULTS.modelSize);
  assert.equal(config.force, false);
});

test('parseCliArgs 未指定月份時預設為最近兩個月', () => {
  const config = parseCliArgs([...API_URL]);
  assert.equal(config.months.length, 2);
  for (const month of config.months) {
    assert.match(month, /^\d{6}$/);
  }
  assert.ok(config.months[0] < config.months[1]);
});

test('parseCliArgs 解析覆寫選項', () => {
  const config = parseCliArgs([
    ...API_URL,
    '--model-size', 'large',
    '--language', 'en',
    '--timeout', '60',
    '--force',
    '202506',
  ]);
  assert.equal(config.modelSize, 'large');
  assert.equal(config.language, 'en');
  assert.equal(config.timeoutMs, 60000);
  assert.equal(config.force, true);
});

test('parseCliArgs 拒絕不合法的參數', () => {
  assert.throws(() => parseCliArgs(['202506'], EMPTY_ENV), /--api-url/);
  assert.throws(() => parseCliArgs([...API_URL, '2025-06']), /YYYYMM/);
  assert.throws(() => parseCliArgs([...API_URL, '20250601']), /YYYYMM/);
  assert.throws(() => parseCliArgs([...API_URL, '--timeout', '-5', '202506']));
});
