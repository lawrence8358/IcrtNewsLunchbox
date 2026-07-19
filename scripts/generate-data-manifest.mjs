import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = join(scriptDirectory, '..', 'public', 'assets', 'data');

const fileNames = await readdir(dataDirectory);
const months = fileNames
  .map(fileName => /^(\d{6})\.json$/.exec(fileName)?.[1])
  .filter(month => month !== undefined)
  .sort((a, b) => b.localeCompare(a));

const tags = JSON.parse(await readFile(join(dataDirectory, 'tag.json'), 'utf8'));
const versions = {};

const dateParts = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date()).map(({ type, value }) => [type, value])
);
const buildVersion = `v.${dateParts.year}${dateParts.month}${dateParts.day}-${dateParts.hour}${dateParts.minute}`;

for (const month of months) {
  const content = await readFile(join(dataDirectory, `${month}.json`));
  versions[month] = createHash('sha256').update(content).digest('hex').slice(0, 12);
}

const manifest = {
  buildVersion,
  months,
  tags,
  versions
};

await writeFile(
  join(dataDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);

console.log(`Generated data manifest ${buildVersion} for ${months.length} month(s).`);
