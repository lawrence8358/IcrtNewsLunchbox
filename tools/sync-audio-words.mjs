#!/usr/bin/env node
/**
 * 排程用的自動同步流程：
 *   1. 切換並拉取目標分支（預設 n8n-test）的最新內容
 *   2. 依序執行 tools/update-audio-words.mjs（Whisper 轉錄）與
 *      tools/merge-audio-words.mjs（Gemini 對齊）
 *   3. 若 public/assets/data 或 public/assets/audio-words 有異動，
 *      以「yyyy/mm/dd 自動對齊音檔時間軸」為訊息 commit 並推回分支
 *
 * 用法：
 *   node tools/sync-audio-words.mjs                  # 最近兩個月（上個月＋本月）
 *   node tools/sync-audio-words.mjs 202506           # 指定月份，可一次多個
 *
 * 執行 node tools/sync-audio-words.mjs --help 查看所有參數。
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULTS = {
  branch: 'n8n-test',
  remote: 'origin',
  dataDir: 'public/assets/data',
  // 兩個工具唯一會寫入的位置：Whisper 時間軸輸出與月份 data（含 months.json、tag.json）。
  commitPaths: ['public/assets/data', 'public/assets/audio-words'],
};

const USAGE = `用法：node tools/sync-audio-words.mjs [選項] [YYYYMM...]

拉取分支最新內容後依序執行 update-audio-words 與 merge-audio-words，
若 ${DEFAULTS.commitPaths.join(' 或 ')} 有異動則自動 commit 並推回分支。
不指定月份時，兩個工具各自處理最近兩個月（上個月與本月，避免跨月遺漏）。

選項：
  --branch <名稱>    目標分支（預設 ${DEFAULTS.branch}）
  --remote <名稱>    遠端名稱（預設 ${DEFAULTS.remote}）
  --data-dir <路徑>  月份 data JSON 資料夾，供 --all 掃描（預設 ${DEFAULTS.dataDir}）
  --all              掃描 --data-dir 內所有月份 JSON（YYYYMM.json）交給兩個工具處理，不可與 [YYYYMM...] 同時使用
  --no-pull          跳過切換分支與 git pull（本機測試用）
  --no-push          只 commit 不 push（本機測試用）
  --allow-dirty      工作目錄有其他異動時仍繼續執行（只會提交上述兩個資料夾）
  -h, --help         顯示說明

轉錄與對齊所需的 TRANSCRIBE_API_URL、GEMINI_API_KEY 等設定
由環境變數或專案根目錄 .env 提供，兩個工具會自行讀取。`;

/** 掃描 dataDir，回傳所有月份 JSON（YYYYMM.json）的月份代碼，由小到大排序。 */
export function listAllMonths(dataDir) {
  return readdirSync(dataDir)
    .filter((name) => /^\d{6}\.json$/.test(name))
    .map((name) => path.basename(name, '.json'))
    .sort();
}

/** 解析命令列參數，回傳設定物件；參數不合法時擲出錯誤。 */
export function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      branch: { type: 'string' },
      remote: { type: 'string' },
      'data-dir': { type: 'string' },
      all: { type: 'boolean' },
      'no-pull': { type: 'boolean' },
      'no-push': { type: 'boolean' },
      'allow-dirty': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    return { help: true };
  }

  for (const month of positionals) {
    if (!/^\d{6}$/.test(month)) {
      throw new Error(`月份格式錯誤：${month}（需為 YYYYMM，例 202506）`);
    }
  }

  if (values.all && positionals.length > 0) {
    throw new Error('--all 不可與月份參數同時使用。');
  }

  return {
    help: false,
    branch: values.branch ?? DEFAULTS.branch,
    remote: values.remote ?? DEFAULTS.remote,
    dataDir: values['data-dir'] ?? DEFAULTS.dataDir,
    all: values.all === true,
    pull: values['no-pull'] !== true,
    push: values['no-push'] !== true,
    allowDirty: values['allow-dirty'] === true,
    months: positionals,
  };
}

/** 以本地時區格式化日期為 yyyy/mm/dd。 */
export function formatDateLabel(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
}

/** 組出自動 commit 的訊息：標題為日期＋說明，內文註明產生來源。 */
export function buildCommitMessage(now = new Date()) {
  return `${formatDateLabel(now)} 自動對齊音檔時間軸\n\n`
    + '由排程執行 update-audio-words（Whisper 轉錄）與 merge-audio-words（Gemini 對齊）自動產生。';
}

/** 執行 git 並回傳結果；git 不存在等系統層錯誤直接擲出。 */
function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  return result;
}

/** 執行 git，失敗（非零 exit code）時擲出含輸出訊息的錯誤。 */
function gitOrThrow(args) {
  const result = git(args);
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    throw new Error(`git ${args.join(' ')} 失敗（exit ${result.status}）${detail ? `：${detail}` : '。'}`);
  }
  return result.stdout;
}

/** 執行單一步驟並沿用本程序的輸出串流，失敗時擲出錯誤。 */
function runStep(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} 失敗（exit ${result.status}）。`);
  }
}

/** 取得工作目錄的異動清單（porcelain 格式），可用 paths 限縮範圍。 */
function statusLines(paths = []) {
  const args = ['status', '--porcelain', '--untracked-files=all'];
  if (paths.length > 0) {
    args.push('--', ...paths);
  }
  return gitOrThrow(args).split(/\r?\n/).filter((line) => line.trim() !== '');
}

/** 確認工作目錄乾淨；有異動且未指定 --allow-dirty 時擲出錯誤。 */
function ensureCleanWorkTree(config) {
  const lines = statusLines();
  if (lines.length > 0 && !config.allowDirty) {
    throw new Error(
      `工作目錄尚有 ${lines.length} 筆異動，為避免混入自動 commit 已中止；`
      + '請先提交或還原，或改用 --allow-dirty 繼續（僅會提交工具輸出的兩個資料夾）。',
    );
  }
}

/** 切換至目標分支並以 fast-forward 拉取最新內容。 */
function checkoutAndPull(config) {
  const current = gitOrThrow(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (current !== config.branch) {
    runStep(`切換至 ${config.branch} 分支`, 'git', ['checkout', config.branch]);
  }
  runStep(`拉取 ${config.remote}/${config.branch}`, 'git', ['pull', '--ff-only', config.remote, config.branch]);
}

function main() {
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
    ensureCleanWorkTree(config);
    if (config.pull) {
      checkoutAndPull(config);
    }
    else {
      console.log('已指定 --no-pull，跳過切換分支與 git pull。');
    }

    // 無論是否有 pull，commit 前都必須確實站在目標分支上，避免提交／推送到錯的分支。
    const current = gitOrThrow(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (current !== config.branch) {
      throw new Error(`目前分支為 ${current}，與目標分支 ${config.branch} 不符，已中止。`);
    }
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  if (config.all) {
    try {
      config.months = listAllMonths(config.dataDir);
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

  try {
    runStep('Whisper 轉錄（update-audio-words）', process.execPath, [
      path.join(ROOT, 'tools', 'update-audio-words.mjs'), ...config.months,
    ]);
    runStep('Gemini 對齊（merge-audio-words）', process.execPath, [
      path.join(ROOT, 'tools', 'merge-audio-words.mjs'), ...config.months,
    ]);
  }
  catch (error) {
    console.error(`\n${error.message}`);
    console.error('工具執行失敗，本次不進行 commit 與 push；已完成的部分保留在工作目錄，處理後可重跑續作。');
    process.exitCode = 1;
    return;
  }

  let changes;
  try {
    changes = statusLines(DEFAULTS.commitPaths);
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (changes.length === 0) {
    console.log('\n沒有檔案異動，不需要 commit。');
    return;
  }

  console.log(`\n偵測到 ${changes.length} 筆異動：`);
  for (const line of changes) {
    console.log(`  ${line}`);
  }

  try {
    // 只挑實際有異動的資料夾加入，避免資料夾不存在時 git add 報錯。
    const dirtyPaths = DEFAULTS.commitPaths.filter((dir) =>
      changes.some((line) => line.slice(3).startsWith(`${dir}/`)));
    if (dirtyPaths.length === 0) {
      throw new Error('無法從異動清單推導 git add 路徑，已中止以避免誤加其他檔案。');
    }
    gitOrThrow(['add', '-A', '--', ...dirtyPaths]);

    const message = buildCommitMessage();
    gitOrThrow(['commit', '-m', message]);
    console.log(`\n已建立 commit：${message.split('\n')[0]}`);

    if (config.push) {
      runStep(`推送至 ${config.remote}/${config.branch}`, 'git', ['push', config.remote, config.branch]);
      console.log('\n完成：異動已推上遠端分支。');
    }
    else {
      console.log('已指定 --no-push，僅完成 commit，未推送。');
    }
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
