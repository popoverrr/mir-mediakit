// Выкладка dist/ на mir-mediakit.asia (Plesk) по FTPS: npm run deploy (сборка + выкладка) или node scripts/deploy-ftp.mjs.
// Реквизиты — deploy/ftp.env (вне git, образец deploy/ftp.env.example): FTP_HOST, FTP_USER, FTP_PASS,
// FTP_REMOTE_DIR (необязательно — корень сайта ищется по index.html), SITE_URL (необязательно).
// Сравнивает dist/ с сервером и заливает только новое и изменившееся: на сервере лежит манифест прошлой
// выкладки (/.deploy-manifest.json, sha1 по файлам). Без манифеста текст заливается целиком, остальное
// (ролики, картинки) — по размеру, поэтому 200 МБ медиа повторно не гоняются.
// Порядок: ассеты → страницы (пока HTML старый, он работает со старыми чанками). Затем удаляет из _assets/
// файлы прошлых сборок (--no-clean — не удалять), кладёт манифест и проверяет страницы по HTTP.
// Plesk рвёт контрольное соединение на длинной заливке — каждая операция переподключается и повторяется.
import { Client } from 'basic-ftp';
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MANIFEST = '.deploy-manifest.json';
const ASSETS = '_assets';
const TEXT = /\.(html|js|mjs|css|xml|txt|json|webmanifest|svg)$|(^|\/)\.htaccess$/;
const sha1 = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');

const ROOT = process.cwd();
const NO_CLEAN = process.argv.includes('--no-clean');
const DRY = process.argv.includes('--dry-run');
const ENV_FILE = path.join(ROOT, 'deploy', 'ftp.env');
const DIST = path.join(ROOT, 'dist');

if (!existsSync(ENV_FILE)) {
  console.error('deploy/ftp.env не найден — создайте по образцу deploy/ftp.env.example.');
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
for (const k of ['FTP_HOST', 'FTP_USER', 'FTP_PASS']) {
  if (!env[k]) {
    console.error(`В deploy/ftp.env не заполнено ${k}`);
    process.exit(2);
  }
}
if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html нет — сначала npm run build');
  process.exit(2);
}
const SITE = (env.SITE_URL || 'https://mir-mediakit.asia').replace(/\/$/, '');
const builtFor = readFileSync(path.join(DIST, 'index.html'), 'utf8').match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
if (!builtFor.startsWith(SITE)) {
  console.error(`dist собран для ${builtFor || '?'}, а выкладка на ${SITE}. Пересоберите: npm run build (без MIR_SITE/MIR_BASE).`);
  process.exit(2);
}

let client = null;
let remote = env.FTP_REMOTE_DIR || '';

async function connect() {
  if (client) client.close();
  client = new Client(120_000);
  client.ftp.verbose = false;
  const base = { host: env.FTP_HOST, user: env.FTP_USER, password: env.FTP_PASS, port: Number(env.FTP_PORT || 21) };
  try {
    await client.access({ ...base, secure: true, secureOptions: { rejectUnauthorized: false } });
  } catch (e) {
    if (/530|login|auth/i.test(String(e.message))) throw e; // неверный логин/пароль — без открытого FTP
    console.warn('FTPS не удался (' + String(e.message).slice(0, 80) + '), пробую обычный FTP');
    client.close();
    client = new Client(120_000);
    client.ftp.verbose = false;
    await client.access({ ...base, secure: false });
  }
  client.ftp.socket.setKeepAlive(true, 15_000);
  if (!remote) {
    // корень сайта — каталог с index.html: у одних аккаунтов /httpdocs, у других сам корень FTP
    remote = '/';
    for (const candidate of ['/httpdocs', '/']) {
      try {
        await client.size(`${candidate === '/' ? '' : candidate}/index.html`);
        remote = candidate;
        break;
      } catch {
        /* пробуем следующий */
      }
    }
  }
}

let onReconnect = () => {};
async function withRetry(label, fn, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      if (!client || client.closed) await connect();
      return await fn();
    } catch (e) {
      const msg = String(e.message || e).slice(0, 100);
      if (i === tries || /530/.test(msg)) throw new Error(`${label}: ${msg}`);
      console.warn(`  ${label}: ${msg} — переподключаюсь (попытка ${i + 1} из ${tries})`);
      onReconnect();
      try {
        client.close();
      } catch {
        /* уже закрыт */
      }
      client = null;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}
const join = (d, f = '') => [remote === '/' ? '' : remote, d, f].filter(Boolean).join('/').replace(/^(?!\/)/, '/');

async function main() {
  await connect();
  console.log(`Подключено к ${env.FTP_HOST} (${client.ftp.socket.encrypted ? 'FTPS' : 'FTP'}), корень сайта: ${remote}`);

  const local = walk(DIST);
  const dirs = [...new Set(local.map((f) => f.split('/').slice(0, -1).join('/')))].sort();
  const remoteSizes = new Map();
  for (const d of dirs) {
    const list = await withRetry(`список /${d}`, async () => {
      try {
        return await client.list(join(d));
      } catch (e) {
        if (String(e.message).includes('550')) return [];
        throw e;
      }
    });
    for (const f of list) if (f.isFile) remoteSizes.set((d ? `${d}/` : '') + f.name, f.size);
  }

  const hashes = Object.fromEntries(local.map((f) => [f, sha1(path.join(DIST, f))]));
  let manifest = null;
  const tmp = mkdtempSync(path.join(tmpdir(), 'mir-deploy-'));
  await withRetry('чтение манифеста', async () => {
    try {
      await client.downloadTo(path.join(tmp, MANIFEST), join('', MANIFEST));
      manifest = JSON.parse(readFileSync(path.join(tmp, MANIFEST), 'utf8'));
    } catch (e) {
      if (!String(e.message).includes('550')) throw e;
      manifest = null;
    }
  });

  const changed = local.filter((f) => {
    const size = statSync(path.join(DIST, f)).size;
    if (remoteSizes.get(f) !== size) return true;
    if (manifest) return manifest[f] !== hashes[f];
    return TEXT.test(f);
  });
  changed.sort((a, b) => Number(a.endsWith('.html')) - Number(b.endsWith('.html')));
  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  const bytes = changed.reduce((s, f) => s + statSync(path.join(DIST, f)).size, 0);
  console.log(
    `Файлов в сборке: ${local.length}; совпадают: ${local.length - changed.length}; заливаю: ${changed.length} (${mb(bytes)} МБ)` +
      (manifest ? ' — сверка по манифесту' : ' — манифеста нет: текст целиком, остальное по размеру'),
  );
  if (DRY) {
    console.log(changed.map((f) => `  ${f}`).join('\n'));
    client.close();
    return;
  }

  let done = 0;
  let lastDir = null;
  onReconnect = () => {
    lastDir = null;
  };
  for (const f of changed) {
    const d = f.split('/').slice(0, -1).join('/');
    await withRetry(`загрузка ${f}`, async () => {
      if (d !== lastDir) {
        await client.ensureDir(join(d));
        lastDir = d;
      }
      await client.uploadFrom(path.join(DIST, f), f.split('/').pop());
    });
    done++;
    if (done % 25 === 0 || done === changed.length) console.log(`  загружено ${done} из ${changed.length}`);
  }

  if (!NO_CLEAN) {
    const keep = new Set(local.filter((f) => f.startsWith(`${ASSETS}/`)).map((f) => f.slice(ASSETS.length + 1)));
    const removed = await withRetry(`чистка ${ASSETS}`, async () => {
      await client.cd(join(ASSETS));
      let n = 0;
      for (const f of await client.list()) {
        if (f.isFile && !keep.has(f.name)) {
          await client.remove(f.name);
          n++;
        }
      }
      return n;
    });
    console.log(`${ASSETS}: удалено файлов прошлых сборок — ${removed}`);
  }

  writeFileSync(path.join(tmp, MANIFEST), JSON.stringify(hashes));
  await withRetry('запись манифеста', async () => {
    await client.cd(join());
    await client.uploadFrom(path.join(tmp, MANIFEST), MANIFEST);
  });
  client.close();

  const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const asset = (html.match(new RegExp(`/${ASSETS}/[^"']+\\.js`)) || [])[0];
  let ok = true;
  for (const p of ['/', '/en/', asset, '/media/cases/fata-preview.mp4', '/.htaccess'].filter(Boolean)) {
    try {
      const r = await fetch(`${SITE}${p}${p.endsWith('/') ? `?v=${Date.now()}` : ''}`, { method: 'GET', redirect: 'follow' });
      const expect = p === '/.htaccess' ? 403 : 200;
      console.log(`${r.status}  ${SITE}${p}`);
      if (r.status !== expect && !(p === '/.htaccess' && r.status === 404)) ok = false;
    } catch (e) {
      console.log(`ERR  ${p}: ${String(e.message).slice(0, 80)}`);
      ok = false;
    }
  }
  console.log(ok ? 'Выкладка завершена, сайт отвечает.' : 'Файлы залиты, но HTTP-проверка прошла не полностью — посмотрите вывод выше.');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  const msg = String(e.message || e);
  console.error('Ошибка выкладки:', /530/.test(msg) ? 'сервер не принял логин/пароль (530) — проверьте FTP_USER и FTP_PASS в deploy/ftp.env' : msg);
  try {
    client?.close();
  } catch {
    /* уже закрыт */
  }
  process.exit(1);
});
