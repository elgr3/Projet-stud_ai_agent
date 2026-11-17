import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORAGE_KEY, parseBackup, readState, serializeBackup } from '../storage.js';

const day = '2026-05-05';
const expense = { id: '1', type: 'expense', label: 'Courses', amount: 399, date: day, settled: true, category: '' };
const budget = { balance: -1000, asOf: day, entries: [expense] };

test('un budget personnel se restaure sans changer les montants ni la date', () => {
  assert.deepEqual(parseBackup(serializeBackup(budget)), budget);
});

test('les sauvegardes non compatibles et les opérations douteuses sont rejetées', () => {
  assert.throws(() => parseBackup('['), /format JSON/);
  assert.throws(() => parseBackup('{"app":"cap-etudiant","version":2}'), /compatible/);
  assert.throws(() => parseBackup(serializeBackup({ ...budget, asOf: '2026-02-30' })), /budget valide/);
  assert.throws(() => parseBackup(serializeBackup({ ...budget, entries: [expense, expense] })), /opération invalide/);
  assert.throws(() => parseBackup(serializeBackup({ ...budget, entries: [{ ...expense, amount: 0.1 }] })), /opération invalide/);
});

test('la démo protège le budget personnel et le stockage corrompu est détecté', () => {
  const draft = { version: 1, demoMode: true, personal: budget, demo: null };
  const storage = new Map([[STORAGE_KEY, JSON.stringify(draft)]]);
  const read = { getItem: (key) => storage.get(key) ?? null };
  assert.deepEqual(readState(read), draft);
  storage.set(STORAGE_KEY, '{"version":1,"demoMode":false}');
  assert.throws(() => readState(read), /ne peut pas être lu/);
  storage.clear();
  assert.equal(readState(read), null);
});
