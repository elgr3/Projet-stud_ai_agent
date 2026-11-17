const DAY_MS = 86_400_000;

// Amounts are represented as integer cents throughout the application.
export const MAX_AMOUNT = 99_999_999;

export function localDate(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateTime(value) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export function isDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const timestamp = dateTime(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function addDays(date, days) {
  if (!isDate(date) || !Number.isInteger(days)) {
    throw new RangeError('Date ou nombre de jours invalide.');
  }
  const result = new Date(dateTime(date) + days * DAY_MS).toISOString().slice(0, 10);
  if (!isDate(result)) throw new RangeError('Date calculée hors limites.');
  return result;
}

export function parseAmount(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;

  const value = String(input).trim();
  const match = /^(\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.](\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const euros = Number(match[1].replace(/[ \u00a0\u202f]/g, ''));
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  const amount = euros * 100 + cents;
  return amount <= MAX_AMOUNT ? amount : null;
}

function lastDayOfMonth(date) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return `${date.slice(0, 7)}-${days[month - 1]}`;
}

function projectionFrom(entries, today, limit, horizon, currentBalance) {
  const schedule = new Map();
  for (const date of [today, horizon, limit]) {
    schedule.set(date, { incoming: 0, outgoing: 0 });
  }

  for (const entry of entries) {
    const date = entry.date < today ? today : entry.date;
    if (date > limit) continue;
    const totals = schedule.get(date) ?? { incoming: 0, outgoing: 0 };
    if (entry.type === 'income') totals.incoming += entry.amount;
    else totals.outgoing += entry.amount;
    schedule.set(date, totals);
  }

  let balance = currentBalance;
  return [...schedule.keys()].sort().map(date => {
    const { incoming, outgoing } = schedule.get(date);
    // A debit may clear before a deposit on the same date.
    const low = balance - outgoing;
    balance = low + incoming;
    return { date, balance, low };
  });
}

export function forecast({ balance, asOf, entries }, today = localDate()) {
  if (!isDate(today)) throw new RangeError('Date de prévision invalide.');

  let currentBalance = balance;
  let nextIncome = null;
  const overdueBills = [];
  const overdueIncomes = [];
  const upcoming = [];

  for (const entry of entries) {
    if (entry.settled) {
      if (entry.date >= asOf && entry.date <= today) {
        currentBalance += entry.type === 'income' ? entry.amount : -entry.amount;
      }
      continue;
    }
    if (entry.date < today) {
      if (entry.type === 'income') {
        overdueIncomes.push(entry);
        continue;
      }
      overdueBills.push(entry);
    }
    if (entry.type === 'income' && (!nextIncome || entry.date < nextIncome.date)) {
      nextIncome = entry;
    }
    upcoming.push(entry);
  }

  const monthEnd = lastDayOfMonth(today);
  const horizon = nextIncome?.date ?? monthEnd;
  const limit = horizon > monthEnd ? horizon : monthEnd;
  const daysBetween = (dateTime(horizon) - dateTime(today)) / DAY_MS;
  const horizonDays = nextIncome ? Math.max(1, daysBetween) : daysBetween + 1;
  const upcomingCosts = upcoming.reduce((total, entry) => {
    return entry.type !== 'income' && entry.date <= horizon ? total + entry.amount : total;
  }, 0);
  const remainingRaw = currentBalance - upcomingCosts;
  const remaining = Math.max(0, remainingRaw);
  const weeklyGuide = horizonDays >= 7 ? Math.floor(remaining * 7 / horizonDays) : null;
  const projection = projectionFrom(upcoming, today, limit, horizon, currentBalance);
  const firstShortfall = projection.find(point => point.low < 0) ?? null;
  const projectedLow = projection.reduce((low, point) => Math.min(low, point.low), currentBalance);

  return {
    currentBalance,
    remaining,
    remainingRaw,
    horizon,
    horizonDays,
    nextIncome,
    weeklyGuide,
    overdueBills,
    overdueIncomes,
    projection,
    firstShortfall,
    projectedLow,
  };
}

export function sampleBudget(today = localDate()) {
  return {
    balance: 46000,
    asOf: today,
    entries: [
      { id: 'demo-1', type: 'expense', label: 'Courses', amount: 1250, date: today, settled: true, category: 'Alimentation' },
      { id: 'demo-2', type: 'expense', label: 'Déjeuner au campus', amount: 850, date: today, settled: true, category: 'Alimentation' },
      { id: 'demo-3', type: 'bill', label: 'Loyer', amount: 23000, date: addDays(today, 2), settled: false, category: 'Logement' },
      { id: 'demo-4', type: 'bill', label: 'Électricité et internet', amount: 6450, date: addDays(today, 4), settled: false, category: 'Logement' },
      { id: 'demo-5', type: 'bill', label: 'Abonnement transport', amount: 2250, date: addDays(today, 7), settled: false, category: 'Transport' },
      { id: 'demo-6', type: 'income', label: 'Bourse étudiante', amount: 37000, date: addDays(today, 9), settled: false, category: 'Bourse' },
    ],
  };
}
