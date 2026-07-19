import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildCommitMessage,
  formatDateLabel,
  listAllMonths,
  parseCliArgs,
  DEFAULTS,
} from '../sync-audio-words.mjs';

test('formatDateLabel 以本地時區格式化 yyyy/mm/dd', () => {
  assert.equal(formatDateLabel(new Date(2026, 6, 9)), '2026/07/09');
  assert.equal(formatDateLabel(new Date(2026, 0, 1)), '2026/01/01');
});

test('buildCommitMessage 標題為日期＋說明，內文註明產生來源', () => {
  const message = buildCommitMessage(new Date(2026, 6, 19));
  assert.match(message, /^2026\/07\/19 自動對齊音檔時間軸\n\n/);
  assert.match(message, /update-audio-words.*merge-audio-words/);
});

test('parseCliArgs 使用預設值，並解析 --branch、--remote、--no-pull 等選項', () => {
  const config = parseCliArgs(['202606', '202607']);
  assert.equal(config.branch, DEFAULTS.branch);
  assert.equal(config.remote, DEFAULTS.remote);
  assert.equal(config.dataDir, DEFAULTS.dataDir);
  assert.equal(config.all, false);
  assert.equal(config.pull, true);
  assert.equal(config.push, true);
  assert.equal(config.allowDirty, false);
  assert.deepEqual(config.months, ['202606', '202607']);

  const custom = parseCliArgs([
    '--branch', 'main',
    '--remote', 'upstream',
    '--data-dir', 'data',
    '--no-pull',
    '--no-push',
    '--allow-dirty',
  ]);
  assert.equal(custom.branch, 'main');
  assert.equal(custom.remote, 'upstream');
  assert.equal(custom.dataDir, 'data');
  assert.equal(custom.pull, false);
  assert.equal(custom.push, false);
  assert.equal(custom.allowDirty, true);
  assert.deepEqual(custom.months, []);

  assert.throws(() => parseCliArgs(['2026-07']), /月份格式錯誤/);
});

test('parseCliArgs 支援 --all 掃描所有月份，且不可與月份參數並用', () => {
  assert.equal(parseCliArgs(['--all']).all, true);
  assert.throws(() => parseCliArgs(['--all', '202607']), /--all 不可與月份參數同時使用/);
});

test('listAllMonths 掃描 dataDir 內的月份 JSON 並排序，略過 months.json／tag.json', async () => {
  const temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-audio-words-list-'));
  try {
    await fs.writeFile(path.join(temporaryDir, '202607.json'), '[]\n', 'utf8');
    await fs.writeFile(path.join(temporaryDir, '202601.json'), '[]\n', 'utf8');
    await fs.writeFile(path.join(temporaryDir, 'months.json'), '[]\n', 'utf8');
    await fs.writeFile(path.join(temporaryDir, 'tag.json'), '[]\n', 'utf8');

    assert.deepEqual(listAllMonths(temporaryDir), ['202601', '202607']);
  }
  finally {
    await fs.rm(temporaryDir, { recursive: true, force: true });
  }
});
