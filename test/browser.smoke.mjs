import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const repository = new URL('../', import.meta.url);
const today = '2026-10-05';
const fixedTime = new Date(`${today}T12:00:00+02:00`);
let browser;
let server;
let url;

async function freePort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  listener.close();
  await once(listener, 'close');
  return port;
}

before(async () => {
  const port = await freePort();
  url = `http://127.0.0.1:${port}/`;
  server = spawn(process.execPath, ['server.mjs'], {
    cwd: repository,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  for (const stream of [server.stdout, server.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', chunk => { serverOutput += chunk; });
  }
  let ready = false;
  for (let attempt = 0; attempt < 50 && server.exitCode === null; attempt += 1) {
    try {
      ready = (await fetch(url)).ok;
    } catch {
      await delay(100);
    }
    if (ready) break;
  }
  assert.ok(ready, `L’application ne répond pas à ${url}\n${serverOutput}`);

  let executablePath = process.env.CAP_CHROMIUM_PATH;
  if (!executablePath) {
    try {
      await access(chromium.executablePath());
    } catch {
      await access('/usr/bin/chromium');
      executablePath = '/usr/bin/chromium';
    }
  }
  browser = await chromium.launch({ executablePath, headless: true });
});

after(async () => {
  try {
    await browser?.close();
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {
      const stopped = once(server, 'exit');
      server.kill();
      await stopped;
    }
  }
});

async function openPage(t, device) {
  const context = await browser.newContext({ ...device, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  page.on('request', request => {
    const destination = new URL(request.url());
    if (/^https?:$/.test(destination.protocol) && destination.origin !== new URL(url).origin) {
      externalRequests.push(destination.origin);
    }
  });
  await page.clock.setFixedTime(fixedTime);
  await page.goto(url);
  return { page, errors, externalRequests };
}

async function submit(page, form) {
  await page.locator(`${form} [type="submit"]`).click();
}

async function startPersonalBudget(page, balance) {
  await page.locator('#start-budget').click();
  const dialog = page.locator('#balance-dialog');
  if (!await dialog.isVisible()) await page.locator('#balance-button').click();
  await page.locator('#balance-input').fill(balance);
  await page.locator('#balance-asof').fill(today);
  await submit(page, '#balance-form');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#demo-banner').isVisible(), false);
}

async function addEntry(page, { type, label, amount, date, settled = false }) {
  await page.locator('#add-entry').click();
  await page.locator('#entry-type').selectOption(type);
  await page.locator('#entry-label').fill(label);
  await page.locator('#entry-amount').fill(amount);
  await page.locator('#entry-date').fill(date);
  if (type !== 'expense') await page.locator('#entry-settled').setChecked(settled);
  await submit(page, '#entry-form');
  await page.locator('#entry-dialog').waitFor({ state: 'hidden' });
}

async function assertAmount(page, expectedEuros) {
  const amount = (await page.locator('#available-amount').innerText())
    .replace(/[\s€]/gu, '').replace(',', '.').replace('−', '-');
  assert.equal(Number(amount), expectedEuros);
}

function entry(page, label) {
  return page.locator('#entry-list li').filter({ hasText: label });
}

test('budget personnel, prévision, opérations et sauvegarde dans Chromium', async t => {
  const { page, errors, externalRequests } = await openPage(t, { viewport: { width: 1440, height: 900 } });
  await page.locator('#demo-banner').waitFor({ state: 'visible' });
  assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
  assert.match(await page.title(), /Cap Étudiant/i);
  assert.ok(await page.locator('#entry-list li').count() > 0, 'La démo comporte des opérations.');

  await startPersonalBudget(page, '220');
  await addEntry(page, { type: 'bill', label: 'Loyer test', amount: '180', date: '2026-10-08' });
  await addEntry(page, { type: 'income', label: 'Bourse test', amount: '480', date: '2026-10-12' });
  await assertAmount(page, 40);
  const schedule = await page.locator('#forecast-list').innerText();
  assert.match(schedule, /Loyer test/);
  assert.match(schedule, /Bourse test/);
  assert.match(await page.locator('#forecast-chart').getAttribute('aria-label'), /40,00\s*€/);
  const heights = await page.locator('#forecast-chart .chart-bar').evaluateAll(
    bars => bars.map(bar => bar.getBoundingClientRect().height),
  );
  assert.ok(heights.every(height => height > 0));
  assert.ok(new Set(heights).size > 1, 'Les hauteurs des barres reflètent les soldes.');

  await addEntry(page, { type: 'expense', label: 'Courses test', amount: '15,50', date: today, settled: true });
  await assertAmount(page, 24.5);
  await page.locator('#entry-filter').selectOption('expense');
  await entry(page, 'Courses test').waitFor({ state: 'visible' });
  assert.equal(await entry(page, 'Bourse test').count(), 0);
  assert.equal(await entry(page, 'Loyer test').count(), 0);
  await entry(page, 'Courses test').getByRole('button', { name: /modifier/i }).click();
  await page.locator('#entry-amount').fill('20');
  await submit(page, '#entry-form');
  await page.locator('#entry-dialog').waitFor({ state: 'hidden' });
  await assertAmount(page, 20);

  await page.reload();
  await assertAmount(page, 20);
  assert.equal(await page.locator('#demo-banner').isVisible(), false);
  const exported = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const file = await exported;
  const exportedPath = await file.path();
  const data = await readFile(exportedPath);
  assert.match(data.toString(), /Courses test/);
  assert.match(data.toString(), /Bourse test/);

  await entry(page, 'Courses test').getByRole('button', { name: /modifier/i }).click();
  await page.locator('#entry-delete').click();
  await page.locator('#entry-dialog').waitFor({ state: 'hidden' });
  assert.equal(await entry(page, 'Courses test').count(), 0);
  await assertAmount(page, 40);

  await page.locator('#import-file').setInputFiles({
    name: 'invalide.json', mimeType: 'application/json', buffer: Buffer.from('{"unexpected":true}'),
  });
  await page.locator('#status').filter({ hasText: /sauvegarde Cap Étudiant compatible/ }).waitFor({ state: 'attached' });
  await assertAmount(page, 40);
  await page.locator('#import-file').setInputFiles({ name: file.suggestedFilename(), mimeType: 'application/json', buffer: data });
  await entry(page, 'Courses test').waitFor({ state: 'visible' });
  await assertAmount(page, 20);

  const secondTab = await page.context().newPage();
  secondTab.setDefaultTimeout(5000);
  await secondTab.clock.setFixedTime(fixedTime);
  await secondTab.goto(url);
  await addEntry(secondTab, { type: 'expense', label: 'Second onglet test', amount: '5', date: today });
  await entry(page, 'Second onglet test').waitFor({ state: 'visible' });
  await assertAmount(page, 15);
  await entry(page, 'Second onglet test').getByRole('button', { name: /modifier/i }).click();
  await page.locator('#entry-delete').click();
  await entry(secondTab, 'Second onglet test').waitFor({ state: 'detached' });
  await assertAmount(secondTab, 20);

  await page.locator('#demo-button').click();
  await page.locator('#demo-banner').waitFor({ state: 'visible' });
  assert.equal(await entry(page, 'Courses test').count(), 0);
  await page.locator('#start-budget').click();
  await entry(page, 'Courses test').waitFor({ state: 'visible' });
  await assertAmount(page, 20);

  await addEntry(page, { type: 'bill', label: 'Imprévu test', amount: '35', date: '2026-10-08' });
  await assertAmount(page, 0);
  await page.locator('#risk-notice').waitFor({ state: 'visible' });
  assert.match(await page.locator('#risk-text').innerText(), /Manque prévu de 15,00\s*€/);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
});

test('parcours tactile à 390 px sans débordement horizontal', async t => {
  const { page, errors, externalRequests } = await openPage(t, devices['iPhone 13']);
  await page.locator('#demo-banner').waitFor({ state: 'visible' });
  await startPersonalBudget(page, '100');
  await addEntry(page, { type: 'expense', label: 'Transport test', amount: '12', date: today, settled: true });
  await assertAmount(page, 88);
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.content <= dimensions.viewport, JSON.stringify(dimensions));
  await page.locator('#add-entry').click();
  await page.locator('#entry-dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('#entry-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
});
