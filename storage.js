import { MAX_AMOUNT, isDate } from './budget.js';

export const STORAGE_KEY = 'cap-etudiant-budget-v1';
export const TYPES = ['income', 'bill', 'expense'];
export const BALANCE_LIMIT = MAX_AMOUNT;
export const ENTRY_LIMIT = 2_000;

export function validateBudget(budget) {
  if (!budget || !Number.isSafeInteger(budget.balance) || Math.abs(budget.balance) > BALANCE_LIMIT ||
      !isDate(budget.asOf) || !Array.isArray(budget.entries) || budget.entries.length > ENTRY_LIMIT) {
    throw new Error('Ce fichier ne contient pas de budget valide.');
  }

  const ids = new Set();
  const entries = budget.entries.map((entry) => {
    if (!entry || typeof entry.id !== 'string' || !entry.id || entry.id.length > 100 || ids.has(entry.id) ||
        !TYPES.includes(entry.type) || typeof entry.label !== 'string' || !entry.label.trim() ||
        entry.label.length > 80 || !Number.isSafeInteger(entry.amount) || entry.amount <= 0 ||
        entry.amount > BALANCE_LIMIT || !isDate(entry.date) || typeof entry.settled !== 'boolean' ||
        typeof entry.category !== 'string' || entry.category.length > 40 ||
        (entry.type === 'expense' && !entry.settled)) {
      throw new Error('Ce fichier contient une opération invalide.');
    }
    ids.add(entry.id);
    const { id, type, label, amount, date, settled, category } = entry;
    return { id, type, label: label.trim(), amount, date, settled, category: category.trim() };
  });
  return { balance: budget.balance, asOf: budget.asOf, entries };
}

export function readState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || typeof value.demoMode !== 'boolean' ||
      (!value.demoMode && !value.personal)) {
    throw new Error('Le budget sauvegardé ne peut pas être lu.');
  }
  return {
    version: 1,
    demoMode: value.demoMode,
    personal: value.personal ? validateBudget(value.personal) : null,
    demo: value.demo ? validateBudget(value.demo) : null,
  };
}

export function parseBackup(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Le fichier doit être au format JSON.');
  }
  if (payload?.app !== 'cap-etudiant' || payload.version !== 1) {
    throw new Error('Ce fichier n’est pas une sauvegarde Cap Étudiant compatible.');
  }
  return validateBudget(payload.budget);
}

export function serializeBackup(budget) {
  return JSON.stringify({ app: 'cap-etudiant', version: 1, budget }, null, 2);
}
