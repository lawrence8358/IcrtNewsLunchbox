import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildPrompt,
  defaultMonths,
  formatAlignmentResult,
  hasCompleteTimestamps,
  mergeDataIndexes,
  mergeTimestamps,
  parseCliArgs,
  parseEnvText,
  parseRetryDelayText,
  validateAlignment,
  writeDataAndSyncIndexes,
  DEFAULTS,
  ENV_KEY,
  MODEL_ENV_KEY,
} from '../merge-audio-words.mjs';

const API_ENV = { [ENV_KEY]: 'test-api-key' };

const topic = {
  id: '20260701-01',
  title: 'Test topic',
  content: [
    { en: 'First paragraph', tw: '第一段', time: null },
    { en: 'Second paragraph', tw: '第二段', time: null },
  ],
  vocabulary: {
    content: [{ text: '1. word 單字', time: null }],
  },
  quiz: [{ question: '1. Question?', options: ['a. A', 'b. B'], time: null }],
};

const segments = [
  { start_time: '0:20', end_time: '0:30', text: 'First paragraph' },
  { start_time: '0:31', end_time: '0:40', text: 'Second paragraph' },
  { start_time: '2:00', end_time: '2:10', text: 'word' },
  { start_time: '3:00', end_time: '3:10', text: 'Question number one' },
];

const alignment = {
  content: [{ index: 0, time: '0:20' }, { index: 1, time: '0:31' }],
  vocabulary: [{ index: 0, time: '2:00' }],
  quiz: [{ index: 0, time: '3:00' }],
};

test('parseEnvText 解析 Gemini Key 且略過註解與不合法行', () => {
  assert.deepEqual(parseEnvText([
    '# comment',
    'GEMINI_API_KEY="abc-123"',
    "OTHER='x y'",
    '不合法',
  ].join('\n')), {
    GEMINI_API_KEY: 'abc-123',
    OTHER: 'x y',
  });
});

test('defaultMonths 回傳上個月與本月，含跨年', () => {
  assert.deepEqual(defaultMonths(new Date(2026, 6, 18)), ['202606', '202607']);
  assert.deepEqual(defaultMonths(new Date(2026, 0, 1)), ['202512', '202601']);
});

test('parseCliArgs 由環境變數取得 Key 並解析選項', () => {
  const config = parseCliArgs([
    '--data-dir', 'data',
    '--audio-words-dir', 'words',
    '--prompt-file', 'prompt.txt',
    '--model', 'gemini-test',
    '--timeout', '30',
    '--retries', '2',
    '--id', '20260601-01',
    '--id', '20260701-01',
    '--force',
    '202606',
    '202607',
  ], API_ENV);

  assert.deepEqual(config.months, ['202606', '202607']);
  assert.equal(config.dataDir, 'data');
  assert.equal(config.audioWordsDir, 'words');
  assert.equal(config.promptFile, 'prompt.txt');
  assert.equal(config.model, 'gemini-test');
  assert.equal(config.timeoutMs, 30_000);
  assert.equal(config.retries, 2);
  assert.deepEqual(config.ids, ['20260601-01', '20260701-01']);
  assert.equal(config.force, true);
  assert.equal(config.apiKey, 'test-api-key');
});

test('parseCliArgs 使用預設值並拒絕缺 Key 或不合法選項', () => {
  const config = parseCliArgs(['202607'], API_ENV);
  assert.equal(config.dataDir, DEFAULTS.dataDir);
  assert.equal(config.audioWordsDir, DEFAULTS.audioWordsDir);
  assert.equal(config.promptFile, DEFAULTS.promptFile);
  assert.equal(config.model, DEFAULTS.model);
  assert.throws(() => parseCliArgs(['202607'], {}), /GEMINI_API_KEY/);
  assert.throws(() => parseCliArgs(['2026-07'], API_ENV), /YYYYMM/);
  assert.throws(() => parseCliArgs(['--timeout', '0', '202607'], API_ENV), /--timeout/);
  assert.throws(() => parseCliArgs(['--retries', '1.5', '202607'], API_ENV), /--retries/);
});

test('parseCliArgs 由環境變數讀取模型，CLI 優先', () => {
  const env = { ...API_ENV, [MODEL_ENV_KEY]: 'gemini-from-env' };
  assert.equal(parseCliArgs(['202607'], env).model, 'gemini-from-env');
  assert.equal(parseCliArgs(['--model', 'gemini-from-cli', '202607'], env).model, 'gemini-from-cli');
  assert.throws(() => parseCliArgs(['202607'], { ...API_ENV, [MODEL_ENV_KEY]: '  ' }), /GEMINI_MODEL/);
});

test('parseRetryDelayText 讀取 Gemini 429 的 retryDelay 與訊息秒數', () => {
  assert.equal(parseRetryDelayText('"retryDelay": "6s"'), 6250);
  assert.equal(parseRetryDelayText('Please retry in 46.612536555s.'), 46863);
  assert.equal(parseRetryDelayText('no retry information'), null);
});

test('buildPrompt 只提供目標與 timeline，並要求原樣選取 start_time', () => {
  const template = 'DATA\n{{DATA_JSON}}\nSUBTITLES\n{{WHISPER_SUBTITLES}}\nCopy times exactly';
  const prompt = buildPrompt(template, topic, segments);
  assert.match(prompt, /Test topic/);
  assert.match(prompt, /First paragraph/);
  assert.match(prompt, /"start_time":"0:20","end_time":"0:30","text":"First paragraph"/);
  assert.match(prompt, /Copy times exactly/);
  assert.doesNotMatch(prompt, /"time":null/);
  assert.throws(() => buildPrompt('{{DATA_JSON}}', topic, segments), /WHISPER_SUBTITLES/);
});

test('validateAlignment 驗證完整 index、格式、範圍與播放順序', () => {
  assert.deepEqual(validateAlignment(topic, segments, alignment), alignment);
  assert.equal(validateAlignment(topic, segments, {
    ...alignment,
    content: [{ index: 0, time: '0:20' }, { index: 1, time: '0:35' }],
  }).content[1].time, '0:35');
  assert.throws(
    () => validateAlignment(topic, segments, { ...alignment, content: [{ index: 0, time: '0:20' }] }),
    /content 應有 2 筆/,
  );
  assert.throws(
    () => validateAlignment(topic, segments, {
      ...alignment,
      content: [{ index: 0, time: '0:20' }, { index: 1, time: '9:99' }],
    }),
    /格式錯誤或超出 timeline/,
  );
  assert.throws(
    () => validateAlignment(topic, segments, {
      ...alignment,
      content: [{ index: 0, time: '0:31' }, { index: 1, time: '0:20' }],
    }),
    /未依播放順序遞增/,
  );
  assert.throws(
    () => validateAlignment(topic, segments, {
      ...alignment,
      content: [{ index: 0, time: '0:20' }, { index: 1, time: '3:00' }],
    }),
    /content → vocabulary 時間重疊或倒退/,
  );

  const topicWithTwoQuiz = structuredClone(topic);
  topicWithTwoQuiz.quiz.push({ question: '2. Another?', options: [], time: null });
  assert.throws(
    () => validateAlignment(topicWithTwoQuiz, segments, {
      ...alignment,
      quiz: [{ index: 0, time: '3:00' }, { index: 1, time: '3:00' }],
    }),
    /quiz\[1\].*未依播放順序遞增/,
  );
});

test('mergeTimestamps 只更新複本內各區塊的 time', () => {
  const merged = mergeTimestamps(topic, alignment);
  assert.deepEqual(merged.content.map((item) => item.time), ['0:20', '0:31']);
  assert.deepEqual(merged.vocabulary.content.map((item) => item.time), ['2:00']);
  assert.deepEqual(merged.quiz.map((item) => item.time), ['3:00']);
  assert.equal(topic.content[0].time, null);
  assert.equal(merged.title, topic.title);
});

test('mergeTimestamps 一旦處理整題就覆寫所有既有時間戳', () => {
  const partiallyTimed = structuredClone(topic);
  partiallyTimed.content[1].time = '9:01';
  partiallyTimed.vocabulary.content[0].time = '9:02';

  const merged = mergeTimestamps(partiallyTimed, alignment);
  assert.deepEqual(merged.content.map((item) => item.time), ['0:20', '0:31']);
  assert.deepEqual(merged.vocabulary.content.map((item) => item.time), ['2:00']);
});

test('formatAlignmentResult 顯示三個區塊的處理結果', () => {
  assert.equal(
    formatAlignmentResult(alignment),
    'content=[0:20, 0:31]；vocabulary=[2:00]；quiz=[3:00]',
  );
});

test('hasCompleteTimestamps 檢查 content、vocabulary、quiz 的所有 time', () => {
  const complete = mergeTimestamps(topic, alignment);
  assert.equal(hasCompleteTimestamps(complete), true);

  const incomplete = structuredClone(complete);
  incomplete.vocabulary.content[0].time = null;
  assert.equal(hasCompleteTimestamps(incomplete), false);
  assert.equal(hasCompleteTimestamps({ content: [], vocabulary: {}, quiz: [] }), false);
});

test('mergeDataIndexes 只加入完整月份與 tags，保留既有值並排序去重', () => {
  const complete = mergeTimestamps(topic, alignment);
  complete.tag = ['Technology', 'Adventure', '中文標籤'];
  const incomplete = structuredClone(complete);
  incomplete.quiz[0].time = null;
  incomplete.tag = ['Should Not Be Added'];

  const result = mergeDataIndexes(
    ['202505', '202504'],
    ['Technology', 'Animals'],
    [
      { month: '202607', topics: [complete] },
      { month: '202606', topics: [incomplete] },
    ],
  );

  assert.deepEqual(result.months, ['202504', '202505', '202607']);
  assert.deepEqual(result.tags, ['Adventure', 'Animals', 'Technology', '中文標籤']);
  assert.deepEqual(result.monthsAdded, ['202607']);
  assert.deepEqual(result.tagsAdded, ['Adventure', '中文標籤']);
});

test('每次 data 寫回後立即同步 months.json 與 tag.json', async () => {
  const temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'merge-audio-words-'));
  try {
    const complete = mergeTimestamps(topic, alignment);
    complete.tag = ['Technology', 'Adventure'];
    const dataPath = path.join(temporaryDir, '202607.json');
    await fs.writeFile(dataPath, '[]\n', 'utf8');
    await fs.writeFile(path.join(temporaryDir, 'months.json'), '[]\n', 'utf8');
    await fs.writeFile(path.join(temporaryDir, 'tag.json'), '["Technology"]\n', 'utf8');

    const result = await writeDataAndSyncIndexes(dataPath, {
      value: [complete],
      indent: '  ',
      eol: '\n',
    }, temporaryDir);

    assert.deepEqual(JSON.parse(await fs.readFile(dataPath, 'utf8')), [complete]);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(temporaryDir, 'months.json'), 'utf8')), ['202607']);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(temporaryDir, 'tag.json'), 'utf8')), ['Adventure', 'Technology']);
    assert.deepEqual(result.monthsAdded, ['202607']);
    assert.deepEqual(result.tagsAdded, ['Adventure']);
  }
  finally {
    await fs.rm(temporaryDir, { recursive: true, force: true });
  }
});
