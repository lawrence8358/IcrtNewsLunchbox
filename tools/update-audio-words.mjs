#!/usr/bin/env node
/**
 * 呼叫 Whisper 轉錄 API，為月份 JSON 產生逐段語音時間軸，
 * 寫入 public/assets/audio-words/<月份檔名>.json。
 *
 * API 網址不簽入程式碼：由 --api-url 或專案根目錄 .env 的 TRANSCRIBE_API_URL 提供
 * （參考 .env.example，.env 已列入 .gitignore）。
 *
 * 用法：
 *   node tools/update-audio-words.mjs                  # 最近兩個月（上個月＋本月）
 *   node tools/update-audio-words.mjs 202506           # 指定月份，可一次多個
 *
 * 執行 node tools/update-audio-words.mjs --help 查看所有參數。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = {
  language: 'zh',
  modelSize: 'medium',
  dataDir: 'public/assets/data',
  outDir: 'public/assets/audio-words',
  timeoutMs: 15 * 60 * 1000,
};

const USAGE = `用法：node tools/update-audio-words.mjs [選項] [YYYYMM...]

以月份為單位處理 --data-dir 下的 <YYYYMM>.json；
不指定月份時，處理最近兩個月（上個月與本月，避免跨月遺漏）。

選項：
  --data-dir <路徑>  月份 JSON 資料夾（預設 ${DEFAULTS.dataDir}）
  --out-dir <路徑>   輸出資料夾（預設 ${DEFAULTS.outDir}）
  --api-url <網址>   轉錄 API，未指定時使用環境變數／.env 的 TRANSCRIBE_API_URL
  --language <lang>  轉錄語言（預設 ${DEFAULTS.language}）
  --model-size <sz>  模型大小（預設 ${DEFAULTS.modelSize}）
  --timeout <秒>     API 逾時秒數（預設 ${DEFAULTS.timeoutMs / 1000}）
  --force            重新處理輸出檔中已存在的 id
  --all              掃描 --data-dir 內所有月份 JSON（YYYYMM.json），不可與 [YYYYMM...] 同時使用
  -h, --help         顯示說明`;

export const ENV_KEY = 'TRANSCRIBE_API_URL';

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

/** 讀取專案根目錄的 .env 併入 process.env；既有的環境變數優先，檔案不存在則忽略。 */
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

/** 將 API 的 "HH:MM:SS.mmm" 正規化為 "分:秒"，分鐘不補零（例 "00:01:02.590" → "1:02"）。 */
export function toMinuteSecond(timeText) {
  const matched = /^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(String(timeText).trim());
  if (!matched) {
    throw new Error(`無法解析時間格式：${timeText}`);
  }
  const minutes = Number(matched[1]) * 60 + Number(matched[2]);
  return `${minutes}:${matched[3]}`;
}

/** 回傳最近兩個月的 YYYYMM（上個月與本月），例 ["202606", "202607"]。 */
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
      'out-dir': { type: 'string' },
      'api-url': { type: 'string' },
      language: { type: 'string' },
      'model-size': { type: 'string' },
      timeout: { type: 'string' },
      force: { type: 'boolean' },
      all: { type: 'boolean' },
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

  if (values.all && positionals.length > 0) {
    throw new Error(`--all 不可與月份參數同時使用。\n\n${USAGE}`);
  }
  const months = positionals.length > 0 ? positionals : defaultMonths();

  const apiUrl = String(values['api-url'] ?? env[ENV_KEY] ?? '').trim();
  if (apiUrl === '') {
    throw new Error(`請以 --api-url 或 .env 的 ${ENV_KEY} 指定轉錄 API 網址（參考 .env.example）。\n\n${USAGE}`);
  }

  const timeoutSeconds = values.timeout === undefined ? null : Number(values.timeout);
  if (timeoutSeconds !== null && (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)) {
    throw new Error(`--timeout 必須是正數（秒）：${values.timeout}`);
  }

  return {
    help: false,
    months,
    all: values.all ?? false,
    dataDir: values['data-dir'] ?? DEFAULTS.dataDir,
    outDir: values['out-dir'] ?? DEFAULTS.outDir,
    apiUrl,
    language: values.language ?? DEFAULTS.language,
    modelSize: values['model-size'] ?? DEFAULTS.modelSize,
    timeoutMs: timeoutSeconds === null ? DEFAULTS.timeoutMs : timeoutSeconds * 1000,
    force: values.force ?? false,
  };
}

/** 掃描 dataDir，回傳所有月份 JSON（YYYYMM.json）的月份代碼，由小到大排序。 */
export async function listMonthFiles(dataDir) {
  const fileNames = await fs.readdir(dataDir);
  return fileNames
    .filter((name) => /^\d{6}\.json$/.test(name))
    .map((name) => path.basename(name, '.json'))
    .sort();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  }
  catch (error) {
    throw new Error(`無法解析 JSON：${filePath}\n${error.message}`);
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

/** 呼叫轉錄 API，回傳正規化後的 segments：[{ start_time, end_time, text }]。 */
async function transcribe(config, audioUrl) {
  const form = new FormData();
  form.set('url', audioUrl);
  form.set('language', config.language);
  form.set('model_size', config.modelSize);
  form.set('output_plain_text', 'false');
  form.set('output_timeline_text', 'false');

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`API 回應 HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.message !== 'success' || !Array.isArray(data.segments)) {
    throw new Error(`API 回傳非預期內容：${JSON.stringify(data).slice(0, 300)}`);
  }

  return data.segments.map((segment) => ({
    start_time: toMinuteSecond(segment.start_time),
    end_time: toMinuteSecond(segment.end_time),
    text: String(segment.text ?? ''),
  }));
}

function isMissingTime(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** 處理單一月份 JSON，逐題轉錄並在每題成功後立即寫回輸出檔（可中斷續跑）。 */
async function processFile(config, sourcePath, stats) {
  const outPath = path.join(config.outDir, path.basename(sourcePath));
  console.log(`\n處理 ${sourcePath} → ${outPath}`);

  const topics = await readJson(sourcePath);
  if (!Array.isArray(topics)) {
    throw new Error(`月份 JSON 應為陣列：${sourcePath}`);
  }

  let results = [];
  try {
    results = await readJson(outPath);
    if (!Array.isArray(results)) {
      throw new Error(`輸出檔應為陣列：${outPath}`);
    }
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  const entryById = new Map(results.map((entry) => [String(entry.id), entry]));

  for (const topic of topics) {
    const id = String(topic.id ?? '');
    if (!config.force && entryById.has(id)) {
      console.log(`  [${id}] 已存在，略過。`);
      stats.skipped += 1;
      continue;
    }
    if (!isMissingTime(topic.content?.[0]?.time)) {
      console.log(`  [${id}] content 時間已存在，略過。`);
      stats.skipped += 1;
      continue;
    }
    const audioUrl = String(topic.audio ?? '').trim();
    if (audioUrl === '') {
      console.warn(`  [${id}] 沒有 audio 網址，略過。`);
      stats.failed.push(id);
      continue;
    }

    try {
      console.log(`  [${id}] 轉錄中：${audioUrl}`);
      const segments = await transcribe(config, audioUrl);
      entryById.set(id, { id, segments });
      // 輸出陣列依 id 排序，與來源月份 JSON 的順序一致。
      const sorted = [...entryById.values()].sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
      await writeJsonAtomic(outPath, sorted);
      console.log(`  [${id}] 完成，共 ${segments.length} 段。`);
      stats.updated += 1;
    }
    catch (error) {
      console.warn(`  [${id}] 失敗：${error.message}`);
      stats.failed.push(id);
    }
  }
}

/** 依月份清單決定要處理的月份 JSON 路徑，檔案不存在時提示並略過。 */
async function resolveSourceFiles(config) {
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
    throw new Error(`指定月份（${config.months.join(', ')}）沒有對應的月份 JSON。`);
  }
  return files;
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

  if (config.all) {
    try {
      config.months = await listMonthFiles(config.dataDir);
    }
    catch (error) {
      console.error(`掃描 ${config.dataDir} 失敗：${error.message}`);
      process.exitCode = 2;
      return;
    }
    if (config.months.length === 0) {
      console.error(`${config.dataDir} 沒有任何月份 JSON（YYYYMM.json）。`);
      process.exitCode = 2;
      return;
    }
  }

  let sourceFiles;
  try {
    sourceFiles = await resolveSourceFiles(config);
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  const stats = { updated: 0, skipped: 0, failed: [] };
  console.log(`處理月份：${config.months.join(', ')}`);

  for (const sourcePath of sourceFiles) {
    try {
      await processFile(config, sourcePath, stats);
    }
    catch (error) {
      console.error(`處理 ${sourcePath} 失敗：${error.message}`);
      stats.failed.push(path.basename(sourcePath));
    }
  }

  console.log(`\n完成：轉錄 ${stats.updated} 題、略過 ${stats.skipped} 題、失敗 ${stats.failed.length} 筆。`);
  if (stats.failed.length > 0) {
    console.error(`失敗清單：${stats.failed.join(', ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
