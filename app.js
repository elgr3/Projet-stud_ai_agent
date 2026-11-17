import { forecast, isDate, localDate, parseAmount, sampleBudget } from './budget.js';
import {
  BALANCE_LIMIT, ENTRY_LIMIT, STORAGE_KEY, TYPES, parseBackup, readState, serializeBackup, validateBudget,
} from './storage.js';

const $ = (id) => document.getElementById(id);
const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fullDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const typeName = { income: 'Rentrée', bill: 'Charge', expense: 'Dépense' };
const money = (cents) => currency.format(cents / 100);
const formatDate = (date, formatter = shortDate) => formatter.format(new Date(date + 'T12:00:00'));
const text = (id, value) => { $(id).textContent = value; };

let today = localDate();
let state = { version: 1, demoMode: true, personal: null, demo: null };
let storageWarning = '';
let preserveStoredData = false;
let creatingPersonal = false;

try {
  state = readState(localStorage) ?? state;
} catch {
  preserveStoredData = true;
  storageWarning = 'Le budget enregistré est inaccessible. Les modifications de cette session ne seront pas conservées.';
}
let demo = state.demo ?? sampleBudget(today);
const activeBudget = () => state.demoMode ? demo : state.personal;

function persist() {
  if (preserveStoredData) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageWarning = '';
    return true;
  } catch {
    storageWarning = 'Le navigateur bloque la sauvegarde. Télécharge une copie avant de fermer la page.';
    return false;
  }
}

function notify(message = '') {
  text('status', [message, storageWarning].filter(Boolean).join(' '));
}

function updateBudget(budget) {
  if (state.demoMode) {
    demo = budget;
    state.demo = demo;
  } else {
    state.personal = budget;
  }
  persist();
  render();
}

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function statusFor(entry) {
  if (entry.settled) return entry.type === 'income' ? 'Reçue' : 'Payée';
  if (entry.date < today) return entry.type === 'income' ? 'En retard · hors prévision' : 'En retard';
  return 'Prévue';
}

function row(entry, editable) {
  const item = node('li', 'flow-row');
  item.dataset.type = entry.type;
  const icon = node('span', 'row-icon', entry.type === 'income' ? '↗' : '↘');
  icon.setAttribute('aria-hidden', 'true');
  const details = node('span', 'row-main');
  details.append(
    node('strong', '', entry.label),
    node('small', '', [formatDate(entry.date, fullDate), entry.category || typeName[entry.type], statusFor(entry)].join(' · ')),
  );
  const amount = node('strong', 'row-amount', (entry.type === 'income' ? '+' : '−') + money(entry.amount));
  item.append(icon, details, amount);
  if (editable) {
    const action = node('button', 'row-edit', 'Modifier');
    action.type = 'button';
    action.setAttribute('aria-label', 'Modifier ' + entry.label);
    action.addEventListener('click', () => openEntry(entry));
    item.append(action);
  }
  return item;
}

function renderEntries() {
  const { entries } = activeBudget();
  const filter = $('entry-filter').value;
  const filtered = entries.filter((entry) => filter === 'all' || entry.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  $('entry-list').replaceChildren(...filtered.map((entry) => row(entry, true)));
  $('entry-empty').hidden = filtered.length > 0;
  const emptyCopy = $('entry-empty').querySelector('p');
  if (emptyCopy) {
    emptyCopy.textContent = filter === 'all'
      ? 'Ajoute une opération pour commencer ton suivi.'
      : 'Aucune opération dans cette catégorie.';
  }
  text('entry-count', filtered.length <= 1 ? filtered.length + ' opération' : filtered.length + ' opérations');
}

function renderChart(result) {
  const graph = $('forecast-chart');
  const points = result.projection;
  graph.hidden = points.length < 2;
  if (graph.hidden) {
    graph.replaceChildren();
    return;
  }
  const chosen = new Set([0, points.length - 1]);
  if (result.firstShortfall) chosen.add(points.indexOf(result.firstShortfall));
  const incomeIndex = points.findIndex((point) => point.date === result.nextIncome?.date);
  if (incomeIndex >= 0) chosen.add(incomeIndex);
  for (let step = 1; step <= 4 && chosen.size < 6; step++) {
    chosen.add(Math.round(step / 5 * (points.length - 1)));
  }
  const visible = [...chosen].filter((index) => index >= 0).sort((a, b) => a - b).map((index) => points[index]);
  const max = Math.max(1, ...visible.map((point) => Math.abs(point.balance)));
  graph.setAttribute('aria-label', 'Soldes prévus en fin de journée. ' +
    visible.map((point) => formatDate(point.date) + ' : ' + money(point.balance)).join(' ; '));
  graph.replaceChildren(...visible.map((point) => {
    const item = node('div', 'chart-point');
    const column = node('span', 'chart-column');
    const bar = node('span', 'chart-bar' + (point.balance < 0 ? ' is-negative' : ''));
    bar.style.setProperty('--bar-height', Math.max(4, Math.round(Math.abs(point.balance) / max * 75)) + '%');
    column.append(node('span', 'chart-amount', money(point.balance)), bar);
    item.append(column, node('span', 'chart-label', formatDate(point.date)));
    return item;
  }));
}

function render() {
  today = localDate();
  const budget = activeBudget();
  const result = forecast(budget, today);
  $('demo-banner').hidden = !state.demoMode;
  $('demo-button').hidden = state.demoMode;
  text('start-budget', state.personal ? 'Revenir à mon budget' : 'Créer mon budget');
  text('available-amount', money(result.remaining));
  text('forecast-horizon', result.nextIncome
    ? 'Avant le ' + formatDate(result.horizon)
    : 'Jusqu’au ' + formatDate(result.horizon));
  text('forecast-description', result.nextIncome
    ? 'Après tes charges prévues, avant « ' + result.nextIncome.label + ' » (' + money(result.nextIncome.amount) + ').'
    : 'Après tes charges prévues jusqu’à la fin du mois.');
  text('balance-amount', money(result.currentBalance));
  text('balance-date', 'Point de départ au ' + formatDate(budget.asOf, fullDate));
  text('weekly-amount', result.weeklyGuide === null ? '—' : money(result.weeklyGuide));
  text('weekly-caption', result.weeklyGuide === null
    ? 'Horizon de moins de sept jours'
    : 'À répartir sur ' + result.horizonDays + ' jours');
  const alerts = [];
  if (result.firstShortfall) {
    alerts.push('Manque prévu de ' + money(-result.firstShortfall.low) + ' le ' +
      formatDate(result.firstShortfall.date) + '. Vérifie l’ordre de tes paiements et de tes rentrées.');
  }
  if (result.overdueIncomes.length) {
    const count = result.overdueIncomes.length;
    alerts.push(count === 1
      ? 'Une rentrée en retard est exclue du calcul. Confirme sa réception ou change sa date.'
      : count + ' rentrées en retard sont exclues du calcul. Vérifie leur date.');
  }
  $('risk-notice').hidden = alerts.length === 0;
  text('risk-text', alerts.join(' '));

  const planned = budget.entries.filter((entry) => !entry.settled)
    .sort((a, b) => a.date.localeCompare(b.date));
  $('forecast-list').replaceChildren(...planned.map((entry) => row(entry, false)));
  $('forecast-empty').hidden = planned.length > 0;
  renderChart(result);
  renderEntries();
}

function formError(id, message = '') {
  const notice = $(id);
  notice.hidden = !message;
  notice.textContent = message;
}

function openBalance(creating = false) {
  today = localDate();
  creatingPersonal = creating;
  $('balance-form').reset();
  $('balance-asof').max = today;
  const snapshot = creating ? { balance: 0, asOf: today } : activeBudget();
  $('balance-input').value = creating ? '' : String(snapshot.balance / 100).replace('.', ',');
  $('balance-asof').value = snapshot.asOf;
  text('balance-dialog-title', creating ? 'Créer mon budget' : 'Modifier le solde de départ');
  formError('balance-error');
  $('balance-dialog').showModal();
}

function syncEntryFields() {
  const expense = $('entry-type').value === 'expense';
  if (expense) $('entry-settled').checked = true;
  $('entry-settled').disabled = expense;
  const type = $('entry-type').value;
  const statusLabel = type === 'income' ? 'Rentrée déjà reçue'
    : type === 'bill' ? 'Charge déjà payée' : 'Dépense déjà payée';
  text('entry-settled-label', statusLabel);
}

function openEntry(entry = null) {
  today = localDate();
  $('entry-form').reset();
  $('entry-id').value = entry?.id ?? '';
  $('entry-type').value = entry?.type ?? 'expense';
  $('entry-label').value = entry?.label ?? '';
  $('entry-amount').value = entry ? String(entry.amount / 100).replace('.', ',') : '';
  $('entry-date').value = entry?.date ?? today;
  $('entry-category').value = entry?.category ?? '';
  $('entry-settled').checked = entry?.settled ?? true;
  $('entry-delete').hidden = !entry;
  text('entry-dialog-title', entry ? 'Modifier une opération' : 'Ajouter une opération');
  formError('entry-error');
  syncEntryFields();
  $('entry-dialog').showModal();
}

$('start-budget').addEventListener('click', () => {
  if (!state.personal) {
    openBalance(true);
    return;
  }
  state.demoMode = false;
  persist();
  render();
  $('balance-button').focus();
  notify('Ton budget personnel est affiché.');
});
$('balance-button').addEventListener('click', () => openBalance());
$('demo-button').addEventListener('click', () => {
  state.demoMode = true;
  persist();
  render();
  $('start-budget').focus();
  notify('Le budget de démonstration est affiché.');
});
$('add-entry').addEventListener('click', () => openEntry());
$('add-entry-empty').addEventListener('click', () => openEntry());
$('entry-filter').addEventListener('change', renderEntries);
$('entry-type').addEventListener('change', () => {
  $('entry-settled').checked = $('entry-type').value === 'expense';
  syncEntryFields();
});
$('entry-settled').addEventListener('change', () => {
  const original = activeBudget().entries.find((entry) => entry.id === $('entry-id').value);
  today = localDate();
  if ($('entry-settled').checked && original && !original.settled &&
      original.date === $('entry-date').value && original.date < today) {
    $('entry-date').value = today;
  }
});
document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

$('balance-form').addEventListener('submit', (event) => {
  event.preventDefault();
  today = localDate();
  const raw = $('balance-input').value.trim().replace(/^−/, '-');
  const amount = parseAmount(raw.startsWith('-') ? raw.slice(1) : raw);
  const asOf = $('balance-asof').value;
  if (amount === null || amount > BALANCE_LIMIT || !isDate(asOf) || asOf > today) {
    formError('balance-error', 'Saisis un solde valide et une date au plus tard aujourd’hui.');
    return;
  }
  const balance = amount && raw.startsWith('-') ? -amount : amount;
  const entries = creatingPersonal ? [] : activeBudget().entries;
  const newPersonal = creatingPersonal;
  if (newPersonal) state.demoMode = false;
  $('balance-dialog').close();
  updateBudget({ balance, asOf, entries });
  if (newPersonal) $('balance-button').focus();
  notify(newPersonal ? 'Ton budget personnel est prêt.' : 'Solde de départ mis à jour.');
});

$('entry-form').addEventListener('submit', (event) => {
  event.preventDefault();
  today = localDate();
  const budget = activeBudget();
  const existingId = $('entry-id').value;
  const type = $('entry-type').value;
  const label = $('entry-label').value.trim();
  const amount = parseAmount($('entry-amount').value);
  const date = $('entry-date').value;
  const category = $('entry-category').value.trim();
  const settled = type === 'expense' || $('entry-settled').checked;
  if (!TYPES.includes(type) || !label || !amount || amount > BALANCE_LIMIT || !isDate(date)) {
    formError('entry-error', 'Saisis un libellé, un montant positif et une date valide.');
    return;
  }
  if (settled && date > today) {
    formError('entry-error', 'Une opération déjà payée ou reçue ne peut pas être datée dans le futur.');
    return;
  }
  if (!existingId && budget.entries.length >= ENTRY_LIMIT) {
    formError('entry-error', 'Ce budget a atteint sa limite de ' + ENTRY_LIMIT + ' opérations.');
    return;
  }
  const id = existingId || (globalThis.crypto.randomUUID?.() ?? globalThis.crypto.getRandomValues(new Uint32Array(4)).join('-'));
  const entry = { id, type, label, amount, date, settled, category };
  const entries = existingId
    ? budget.entries.map((previous) => previous.id === id ? entry : previous)
    : [entry, ...budget.entries];
  try {
    validateBudget({ ...budget, entries });
  } catch (error) {
    formError('entry-error', error.message);
    return;
  }
  $('entry-dialog').close();
  updateBudget({ ...budget, entries });
  const updatedButton = [...$('entry-list').querySelectorAll('.row-edit')]
    .find((button) => button.getAttribute('aria-label') === 'Modifier ' + label);
  (existingId ? updatedButton ?? $('add-entry') : $('add-entry')).focus();
  notify(date < budget.asOf && settled
    ? 'Opération ajoutée à l’historique. Le solde de départ inclut déjà les opérations antérieures.'
    : 'Opération enregistrée.');
});

$('entry-delete').addEventListener('click', () => {
  const id = $('entry-id').value;
  if (!id || !confirm('Supprimer cette opération du budget ?')) return;
  const budget = activeBudget();
  $('entry-dialog').close();
  updateBudget({ ...budget, entries: budget.entries.filter((entry) => entry.id !== id) });
  $('add-entry').focus();
  notify('Opération supprimée.');
});

$('export-button').addEventListener('click', () => {
  const file = new Blob([serializeBackup(activeBudget())], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = node('a');
  link.href = url;
  link.download = 'cap-etudiant-' + today + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  notify('Sauvegarde téléchargée. Elle contient tes données budgétaires.');
});

$('import-file').addEventListener('change', async (event) => {
  const field = event.currentTarget;
  const file = field.files[0];
  field.value = '';
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Ce fichier dépasse la taille maximale de 2 Mo.');
    const imported = parseBackup(await file.text());
    today = localDate();
    if (imported.asOf > today || imported.entries.some((entry) => entry.settled && entry.date > today)) {
      throw new Error('Le fichier contient un solde ou une opération réalisée datés dans le futur.');
    }
    if ((state.personal || preserveStoredData) && !confirm('Remplacer le budget personnel actuel par cette sauvegarde ?')) return;
    state.personal = imported;
    state.demoMode = false;
    preserveStoredData = false;
    persist();
    render();
    notify('Sauvegarde importée.');
  } catch (error) {
    notify(error.message);
  }
});

window.addEventListener('storage', (event) => {
  if (event.storageArea !== localStorage || (event.key !== STORAGE_KEY && event.key !== null)) return;
  try {
    state = readState(localStorage) ?? { version: 1, demoMode: true, personal: null, demo: null };
    demo = state.demo ?? sampleBudget(localDate());
    preserveStoredData = false;
    storageWarning = '';
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    render();
    notify('Le budget a été actualisé depuis un autre onglet.');
  } catch {
    preserveStoredData = true;
    storageWarning = 'La sauvegarde modifiée dans un autre onglet ne peut pas être lue.';
    notify();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && today !== localDate()) {
    if (!state.demo) demo = sampleBudget(localDate());
    render();
  }
});

render();
notify();
