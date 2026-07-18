#!/usr/bin/env node
/**
 * 使用 Gemini 將 public/assets/audio-words 的逐段轉錄時間軸，
 * 對齊並回寫至 public/assets/data 的 content、vocabulary 與 quiz time 欄位。
 *
 * 用法：
 *   node tools/merge-audio-words.mjs                  # 最近兩個月（上個月＋本月）
 *   node tools/merge-audio-words.mjs 202506           # 指定月份，可一次多個
 *
 * 執行 node tools/merge-audio-words.mjs --help 查看所有參數。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = {
  dataDir: 'public/assets/data',
  audioWordsDir: 'public/assets/audio-words',
  promptFile: 'tools/prompts/merge-audio-words.txt',
  model: 'gemini-2.5-flash',
  timeoutMs: 2 * 60 * 1000,
  retries: 3,
};

export const ENV_KEY = 'GEMINI_API_KEY';
export const MODEL_ENV_KEY = 'GEMINI_MODEL';
const MAX_RETRY_DELAY_MS = 60_000;

const USAGE = `用法：node tools/merge-audio-words.mjs [選項] [YYYYMM...]

從 --data-dir 的月份 JSON 開始判斷；僅處理 content 第一段 time 為空的主題，
並用相同月份 --audio-words-dir 內對應 id 的 segments 交給 Gemini 對齊後回寫 data。
不指定月份時，處理最近兩個月（上個月與本月，避免跨月遺漏）。

選項：
  --data-dir <路徑>         月份 data JSON 資料夾（預設 ${DEFAULTS.dataDir}）
  --audio-words-dir <路徑>  Whisper 時間軸資料夾（預設 ${DEFAULTS.audioWordsDir}）
  --prompt-file <路徑>      Gemini 提示詞文字檔（預設 ${DEFAULTS.promptFile}）
  --model <名稱>            Gemini 模型（預設讀取 .env 的 ${MODEL_ENV_KEY}）
  --timeout <秒>            單次 API 逾時秒數（預設 ${DEFAULTS.timeoutMs / 1000}）
  --retries <次數>          每題最大嘗試次數（預設 ${DEFAULTS.retries}）
  --id <主題 id>            只處理指定 id（可重複使用）
  --force                   重新對齊已有 time 的主題
  -h, --help                顯示說明

Gemini API Key 與模型由環境變數或專案根目錄 .env 的 ${ENV_KEY}、${MODEL_ENV_KEY} 提供。`;

/** 解析 .env 內容為物件，支援 KEY=VALUE、# 註解與空行，值可用單／雙引號包住。 */
export function parseEnvText(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const matched = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!matched) {
      continue;
    }
    let value = matched[2].trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    values[matched[1]] = value;
  }
  return values;
}

/** 讀取專案根目錄的 .env 併入 process.env；既有環境變數優先。 */
async function loadDotEnv() {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  try {
    const parsed = parseEnvText(await fs.readFile(envPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/** 回傳最近兩個月的 YYYYMM（上個月與本月）。 */
export function defaultMonths(now = new Date()) {
  const formatMonth = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return [
    formatMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    formatMonth(new Date(now.getFullYear(), now.getMonth(), 1)),
  ];
}

/** 解析命令列參數，回傳設定物件；參數不合法時擲出錯誤。 */
export function parseCliArgs(argv, env = process.env) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'data-dir': { type: 'string' },
      'audio-words-dir': { type: 'string' },
      'prompt-file': { type: 'string' },
      model: { type: 'string' },
      timeout: { type: 'string' },
      retries: { type: 'string' },
      id: { type: 'string', multiple: true },
      force: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    return { help: true };
  }

  for (const month of positionals) {
    if (!/^\d{6}$/.test(month)) {
      throw new Error(`月份必須是 YYYYMM：${month}\n\n${USAGE}`);
    }
  }

  const apiKey = String(env[ENV_KEY] ?? '').trim();
  if (apiKey === '') {
    throw new Error(`請在環境變數或 .env 設定 ${ENV_KEY}（參考 .env.example）。\n\n${USAGE}`);
  }

  const timeoutSeconds = values.timeout === undefined ? DEFAULTS.timeoutMs / 1000 : Number(values.timeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error(`--timeout 必須是正數（秒）：${values.timeout}`);
  }

  const retries = values.retries === undefined ? DEFAULTS.retries : Number(values.retries);
  if (!Number.isSafeInteger(retries) || retries <= 0) {
    throw new Error(`--retries 必須是正整數：${values.retries}`);
  }

  const model = String(values.model ?? env[MODEL_ENV_KEY] ?? DEFAULTS.model).trim();
  if (model === '') {
    throw new Error(`--model 或 ${MODEL_ENV_KEY} 不可為空。`);
  }

  return {
    help: false,
    months: positionals.length > 0 ? positionals : defaultMonths(),
    dataDir: values['data-dir'] ?? DEFAULTS.dataDir,
    audioWordsDir: values['audio-words-dir'] ?? DEFAULTS.audioWordsDir,
    promptFile: values['prompt-file'] ?? DEFAULTS.promptFile,
    model,
    timeoutMs: timeoutSeconds * 1000,
    retries,
    ids: values.id ?? [],
    force: values.force ?? false,
    apiKey,
  };
}

function detectIndent(raw) {
  const matched = /\n([ \t]+)\S/.exec(raw);
  return matched?.[1] ?? '  ';
}

async function readJsonDocument(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return {
      value: JSON.parse(raw),
      indent: detectIndent(raw),
      eol: raw.includes('\r\n') ? '\r\n' : '\n',
    };
  }
  catch (error) {
    throw new Error(`無法解析 JSON：${filePath}\n${error.message}`);
  }
}

async function writeJsonAtomic(filePath, document) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  const json = `${JSON.stringify(document.value, null, document.indent)}\n`.replaceAll('\n', document.eol);
  await fs.writeFile(temporaryPath, json, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

function isMissingTime(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** topic 的三個可播放區塊都存在，且每一筆 time 都有值時才算完整。 */
export function hasCompleteTimestamps(topic) {
  const groups = [topic?.content, topic?.vocabulary?.content, topic?.quiz];
  return groups.every(Array.isArray)
    && groups.flat().every((item) => !isMissingTime(item?.time));
}

function compareEnglishText(left, right) {
  return left.localeCompare(right, 'en', { sensitivity: 'base' })
    || left.localeCompare(right, 'en');
}

/**
 * 保留既有索引，只加入所有時間戳完整月份及其 tags，最後去重排序。
 * monthDocuments: [{ month: 'YYYYMM', topics: [...] }]
 */
export function mergeDataIndexes(existingMonths, existingTags, monthDocuments) {
  if (!Array.isArray(existingMonths) || !Array.isArray(existingTags)) {
    throw new Error('months.json 與 tag.json 應為陣列');
  }

  const completeDocuments = monthDocuments.filter(({ month, topics }) => (
    /^\d{6}$/.test(month)
    && Array.isArray(topics)
    && topics.length > 0
    && topics.every(hasCompleteTimestamps)
  ));
  const completeMonths = completeDocuments.map(({ month }) => month);
  const completeTags = completeDocuments.flatMap(({ topics }) => (
    topics.flatMap((topic) => Array.isArray(topic.tag) ? topic.tag : [])
  ));

  const normalizeStrings = (values) => values
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim());
  const months = [...new Set(normalizeStrings([...existingMonths, ...completeMonths]))].sort();
  const tags = [...new Set(normalizeStrings([...existingTags, ...completeTags]))].sort(compareEnglishText);
  const existingMonthSet = new Set(normalizeStrings(existingMonths));
  const existingTagSet = new Set(normalizeStrings(existingTags));

  return {
    months,
    tags,
    monthsAdded: months.filter((month) => !existingMonthSet.has(month)),
    tagsAdded: tags.filter((tag) => !existingTagSet.has(tag)),
  };
}

function targetLists(topic) {
  return {
    content: Array.isArray(topic.content) ? topic.content : [],
    vocabulary: Array.isArray(topic.vocabulary?.content) ? topic.vocabulary.content : [],
    quiz: Array.isArray(topic.quiz) ? topic.quiz : [],
  };
}

function buildResponseSchema(topic) {
  const lists = targetLists(topic);
  const indexedTimes = (length, description) => ({
    type: 'array',
    description,
    minItems: length,
    maxItems: length,
    items: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: 'The zero-based target index.' },
        time: {
          type: 'string',
          description: 'Start time in total-minutes:two-digit-seconds format. Prefer a timeline start_time; infer only when Whisper omitted the target.',
        },
      },
      required: ['index', 'time'],
    },
  });

  return {
    type: 'object',
    properties: {
      content: indexedTimes(lists.content.length, 'Start segment for each main article paragraph.'),
      vocabulary: indexedTimes(lists.vocabulary.length, 'Start segment for each vocabulary item.'),
      quiz: indexedTimes(lists.quiz.length, 'Start segment for each quiz question.'),
    },
    required: ['content', 'vocabulary', 'quiz'],
  };
}

/** 把教材與 Whisper 時間軸代入外部提示詞；缺少必要佔位符時拒絕執行。 */
export function buildPrompt(template, topic, segments) {
  const requiredPlaceholders = ['{{DATA_JSON}}', '{{WHISPER_SUBTITLES}}'];
  for (const placeholder of requiredPlaceholders) {
    if (!template.includes(placeholder)) {
      throw new Error(`提示詞缺少必要佔位符：${placeholder}`);
    }
  }

  const lists = targetLists(topic);
  const targets = {
    id: String(topic.id ?? ''),
    title: String(topic.title ?? ''),
    content: lists.content.map((item, index) => ({ index, en: item.en, tw: item.tw })),
    vocabulary: lists.vocabulary.map((item, index) => ({ index, text: item.text })),
    quiz: lists.quiz.map((item, index) => ({
      index,
      question: item.question,
      options: item.options,
    })),
  };
  const subtitles = segments
    .map((segment) => JSON.stringify({
      start_time: String(segment.start_time ?? ''),
      end_time: String(segment.end_time ?? ''),
      text: String(segment.text ?? ''),
    }))
    .join('\n');

  return template
    .replaceAll('{{DATA_JSON}}', JSON.stringify(targets, null, 2))
    .replaceAll('{{WHISPER_SUBTITLES}}', subtitles);
}

class GeminiHttpError extends Error {
  constructor(status, message, retryAfterMs = null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** 從 Gemini 429 內容解析 retryDelay／Please retry in；額外保留 250ms 緩衝。 */
export function parseRetryDelayText(detail) {
  const matched = /(?:retryDelay["']?\s*:\s*["']?|retry in\s+)(\d+(?:\.\d+)?)s/i.exec(String(detail));
  return matched ? Math.ceil(Number(matched[1]) * 1000) + 250 : null;
}

function retryAfterMs(response, detail) {
  const value = response.headers.get('retry-after');
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000) + 250;
    }
  }
  return parseRetryDelayText(detail);
}

/** 呼叫 Gemini structured output，取得尚未通過語意驗證的對齊結果。 */
async function requestGemini(config, topic, segments) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(config.promptTemplate, topic, segments) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(topic),
      },
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new GeminiHttpError(
      response.status,
      `Gemini API 回應 HTTP ${response.status}${detail ? `：${detail}` : ''}`,
      retryAfterMs(response, detail),
    );
  }

  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    const reason = body.candidates?.[0]?.finishReason ?? body.promptFeedback?.blockReason ?? '未知原因';
    throw new Error(`Gemini 未回傳結果（${reason}）`);
  }

  try {
    return JSON.parse(text);
  }
  catch (error) {
    throw new Error(`Gemini 回傳無法解析的 JSON：${error.message}`);
  }
}

function validateGroup(name, values, expectedLength, maxTimelineSeconds, strictOrder) {
  if (!Array.isArray(values) || values.length !== expectedLength) {
    throw new Error(`${name} 應有 ${expectedLength} 筆，實際為 ${Array.isArray(values) ? values.length : '非陣列'}`);
  }

  const ordered = [...values].sort((a, b) => a.index - b.index);
  let previousSeconds = null;
  for (let index = 0; index < ordered.length; index += 1) {
    const item = ordered[index];
    if (item?.index !== index) {
      throw new Error(`${name} 缺少或重複 index ${index}`);
    }
    const seconds = timeToSeconds(item.time);
    if (!Number.isFinite(seconds) || seconds > maxTimelineSeconds) {
      throw new Error(`${name}[${index}] 的 time 格式錯誤或超出 timeline：${item.time}`);
    }
    if (previousSeconds !== null && (strictOrder ? seconds <= previousSeconds : seconds < previousSeconds)) {
      throw new Error(`${name}[${index}] 的 time 未依播放順序遞增：${item.time}`);
    }
    previousSeconds = seconds;
  }

  return ordered;
}

function timeToSeconds(value) {
  const matched = /^(\d+):([0-5]\d)$/.exec(String(value));
  return matched ? Number(matched[1]) * 60 + Number(matched[2]) : Number.NaN;
}

/** 驗證數量、index、格式、音訊範圍與教材播放順序。 */
export function validateAlignment(topic, segments, alignment) {
  const lists = targetLists(topic);
  const timelineSeconds = segments
    .flatMap((segment) => [timeToSeconds(segment.start_time), timeToSeconds(segment.end_time)])
    .filter(Number.isFinite);
  if (timelineSeconds.length === 0) {
    throw new Error('segments 不可為空');
  }
  const maxTimelineSeconds = Math.max(...timelineSeconds);

  const validated = {
    content: validateGroup('content', alignment?.content, lists.content.length, maxTimelineSeconds, false),
    vocabulary: validateGroup('vocabulary', alignment?.vocabulary, lists.vocabulary.length, maxTimelineSeconds, true),
    quiz: validateGroup('quiz', alignment?.quiz, lists.quiz.length, maxTimelineSeconds, true),
  };

  const boundaries = [
    ['content', 'vocabulary'],
    ['vocabulary', 'quiz'],
  ];
  for (const [beforeName, afterName] of boundaries) {
    const before = validated[beforeName];
    const after = validated[afterName];
    if (before.length > 0 && after.length > 0
      && timeToSeconds(after[0].time) <= timeToSeconds(before.at(-1).time)) {
      throw new Error(`${beforeName} → ${afterName} 時間重疊或倒退：${before.at(-1).time} → ${after[0].time}`);
    }
  }

  return validated;
}

/** 將已驗證的整題時間戳全部覆寫至 topic 複本，不修改輸入物件。 */
export function mergeTimestamps(topic, alignment) {
  const merged = structuredClone(topic);
  for (const { index, time } of alignment.content) {
    merged.content[index].time = time;
  }
  for (const { index, time } of alignment.vocabulary) {
    merged.vocabulary.content[index].time = time;
  }
  for (const { index, time } of alignment.quiz) {
    merged.quiz[index].time = time;
  }
  return merged;
}

/** 產生方便人工檢查的單題時間戳摘要。 */
export function formatAlignmentResult(alignment) {
  const times = (items) => items.map(({ time }) => time).join(', ');
  return [
    `content=[${times(alignment.content)}]`,
    `vocabulary=[${times(alignment.vocabulary)}]`,
    `quiz=[${times(alignment.quiz)}]`,
  ].join('；');
}

function isRetryable(error) {
  return !(error instanceof GeminiHttpError) || error.status === 408 || error.status === 429 || error.status >= 500;
}

async function alignTopic(config, topic, segments) {
  let lastError;
  for (let attempt = 1; attempt <= config.retries; attempt += 1) {
    try {
      const result = await requestGemini(config, topic, segments);
      return validateAlignment(topic, segments, result);
    }
    catch (error) {
      lastError = error;
      if (attempt === config.retries || !isRetryable(error)) {
        break;
      }
      const delayMs = error.retryAfterMs ?? Math.min(1000 * (2 ** (attempt - 1)), 10_000);
      if (delayMs > MAX_RETRY_DELAY_MS) {
        console.warn(`    API 要求等待 ${Math.ceil(delayMs / 1000)} 秒，超過單題等待上限，不在本輪重試。`);
        break;
      }
      console.warn(`    第 ${attempt} 次失敗，${delayMs / 1000} 秒後重試：${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/** 處理單一月份；每題成功後立即原子寫回 data，可中斷續跑。 */
async function processFile(config, dataPath, stats) {
  const monthFile = path.basename(dataPath);
  const audioWordsPath = path.join(config.audioWordsDir, monthFile);
  console.log(`\n處理 ${dataPath} ← ${audioWordsPath}`);

  const dataDocument = await readJsonDocument(dataPath);
  if (!Array.isArray(dataDocument.value)) {
    throw new Error(`月份 data JSON 應為陣列：${dataPath}`);
  }

  let audioWords;
  try {
    audioWords = (await readJsonDocument(audioWordsPath)).value;
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`找不到 audio-words 月份檔：${audioWordsPath}`);
    }
    throw error;
  }
  if (!Array.isArray(audioWords)) {
    throw new Error(`audio-words JSON 應為陣列：${audioWordsPath}`);
  }
  const timelineById = new Map(audioWords.map((entry) => [String(entry.id ?? ''), entry.segments]));

  for (let topicIndex = 0; topicIndex < dataDocument.value.length; topicIndex += 1) {
    const topic = dataDocument.value[topicIndex];
    const id = String(topic.id ?? '');
    if (config.ids.length > 0 && !config.ids.includes(id)) {
      continue;
    }
    if (!config.force && !isMissingTime(topic.content?.[0]?.time)) {
      console.log(`  [${id}] content 時間已存在，略過。`);
      stats.skipped += 1;
      continue;
    }

    const segments = timelineById.get(id);
    if (!Array.isArray(segments) || segments.length === 0) {
      console.warn(`  [${id}] 找不到有效 audio-words segments，略過。`);
      stats.failed.push(id);
      continue;
    }

    try {
      console.log(`  [${id}] Gemini 對齊中（${segments.length} 段）...`);
      const alignment = await alignTopic(config, topic, segments);
      dataDocument.value[topicIndex] = mergeTimestamps(topic, alignment);
      const indexes = await writeDataAndSyncIndexes(dataPath, dataDocument, config.dataDir);
      console.log(`  [${id}] 完成：${formatAlignmentResult(alignment)}`);
      if (indexes.monthsAdded.length > 0 || indexes.tagsAdded.length > 0) {
        console.log(`  [${id}] 索引同步：months 新增 ${indexes.monthsAdded.length} 筆、tags 新增 ${indexes.tagsAdded.length} 筆。`);
      }
      stats.updated += 1;
    }
    catch (error) {
      console.warn(`  [${id}] 失敗：${error.message}`);
      stats.failed.push(id);
    }
  }
}

/** 從 data 目錄依月份解析來源檔；不存在的月份提示並略過。 */
async function resolveDataFiles(config) {
  const files = [];
  for (const month of config.months) {
    const filePath = path.join(config.dataDir, `${month}.json`);
    try {
      await fs.access(filePath);
      files.push(filePath);
    }
    catch {
      console.warn(`找不到 ${filePath}，略過。`);
    }
  }
  if (files.length === 0) {
    throw new Error(`指定月份（${config.months.join(', ')}）沒有對應的 data 月份 JSON。`);
  }
  return files;
}

/** 掃描 data 目錄，將時間戳完整月份與 tags 補入索引並排序。 */
export async function syncDataIndexes(dataDir) {
  const fileNames = await fs.readdir(dataDir);
  const monthDocuments = [];
  for (const fileName of fileNames.filter((name) => /^\d{6}\.json$/.test(name)).sort()) {
    monthDocuments.push({
      month: path.basename(fileName, '.json'),
      topics: (await readJsonDocument(path.join(dataDir, fileName))).value,
    });
  }

  const monthsPath = path.join(dataDir, 'months.json');
  const tagsPath = path.join(dataDir, 'tag.json');
  const monthsDocument = await readJsonDocument(monthsPath);
  const tagsDocument = await readJsonDocument(tagsPath);
  const merged = mergeDataIndexes(monthsDocument.value, tagsDocument.value, monthDocuments);

  if (JSON.stringify(monthsDocument.value) !== JSON.stringify(merged.months)) {
    monthsDocument.value = merged.months;
    await writeJsonAtomic(monthsPath, monthsDocument);
  }
  if (JSON.stringify(tagsDocument.value) !== JSON.stringify(merged.tags)) {
    tagsDocument.value = merged.tags;
    await writeJsonAtomic(tagsPath, tagsDocument);
  }

  return merged;
}

/**
 * 原子寫回單題所在的月份 data 後，立刻同步 months.json 與 tag.json。
 * 若索引同步失敗，錯誤訊息會明確指出 data 已成功落盤，方便安全續跑。
 */
export async function writeDataAndSyncIndexes(dataPath, dataDocument, dataDir = path.dirname(dataPath)) {
  await writeJsonAtomic(dataPath, dataDocument);
  try {
    return await syncDataIndexes(dataDir);
  }
  catch (error) {
    throw new Error(`data 已寫入，但 months.json / tag.json 同步失敗：${error.message}`, { cause: error });
  }
}

async function main() {
  await loadDotEnv();

  let config;
  try {
    config = parseCliArgs(process.argv.slice(2));
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  if (config.help) {
    console.log(USAGE);
    return;
  }

  try {
    config.promptTemplate = await fs.readFile(config.promptFile, 'utf8');
    // 在真正呼叫 API 前先確認提示詞保留必要佔位符。
    buildPrompt(config.promptTemplate, { content: [], vocabulary: { content: [] }, quiz: [] }, []);
  }
  catch (error) {
    console.error(`無法讀取 Gemini 提示詞 ${config.promptFile}：${error.message}`);
    process.exitCode = 2;
    return;
  }

  let dataFiles;
  try {
    dataFiles = await resolveDataFiles(config);
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  const stats = { updated: 0, skipped: 0, failed: [] };
  console.log(`處理月份：${config.months.join(', ')}`);
  console.log(`Gemini 模型：${config.model}`);
  console.log(`提示詞：${config.promptFile}`);

  for (const dataPath of dataFiles) {
    try {
      await processFile(config, dataPath, stats);
    }
    catch (error) {
      console.error(`處理 ${dataPath} 失敗：${error.message}`);
      stats.failed.push(path.basename(dataPath));
    }
  }

  try {
    const indexes = await syncDataIndexes(config.dataDir);
    console.log(`\n索引完成：months 新增 ${indexes.monthsAdded.length} 筆、tags 新增 ${indexes.tagsAdded.length} 筆。`);
    if (indexes.monthsAdded.length > 0) {
      console.log(`新增月份：${indexes.monthsAdded.join(', ')}`);
    }
    if (indexes.tagsAdded.length > 0) {
      console.log(`新增 tags：${indexes.tagsAdded.join(', ')}`);
    }
  }
  catch (error) {
    console.error(`更新 months.json / tag.json 失敗：${error.message}`);
    stats.failed.push('data indexes');
  }

  console.log(`\n完成：合併 ${stats.updated} 題、略過 ${stats.skipped} 題、失敗 ${stats.failed.length} 筆。`);
  if (stats.failed.length > 0) {
    console.error(`失敗清單：${stats.failed.join(', ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
