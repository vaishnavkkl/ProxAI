import * as SQLite from 'expo-sqlite';

import type { LedgerItem } from '@/types/ledger';
import { isLifeItem } from '@/types/ledger';
import { withAccount } from '@/utils/bank-account';

export type LedgerRow = {
  id: string;
  title: string;
  amount: number | null;
  category: string;
  date: string;
  note: string;
  bank_id?: string | null;
  bank_label?: string | null;
};

export type ProcessedRow = {
  hash: string;
  source_id: string;
  received_at: number;
  read_at: number;
  sender: string;
};

export type FixedExpenseKind = 'monthly' | 'emi';

export type FixedExpenseRow = {
  id: string;
  label: string;
  amount: number;
  kind: FixedExpenseKind;
  monthsTotal: number | null;
  monthsPaid: number | null;
};

const DB_NAME = 'proxai.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function sqlValue(value: unknown): string | number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return String(value);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDb().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function openDb() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS life_items (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger_details (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS item_states (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      amount REAL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      amount REAL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      amount REAL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

    CREATE TABLE IF NOT EXISTS processed_messages (
      hash TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      read_at INTEGER NOT NULL,
      sender TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_processed_hash ON processed_messages(hash);
    CREATE INDEX IF NOT EXISTS idx_processed_received_at ON processed_messages(received_at);

    CREATE TABLE IF NOT EXISTS scan_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS extraction_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS screenshot_scans (
      asset_id TEXT PRIMARY KEY NOT NULL,
      captured_at INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_screenshot_date ON screenshot_scans(captured_at);

    CREATE TABLE IF NOT EXISTS monthly_salary (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fixed_expenses_label ON fixed_expenses(label);
  `);
  await migrateFixedExpenses(db);
  await migrateTransactionBank(db);
  return db;
}

async function migrateFixedExpenses(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(fixed_expenses)');
  const names = new Set(columns.map((column) => column.name));

  if (!names.has('kind')) {
    await db.execAsync(`ALTER TABLE fixed_expenses ADD COLUMN kind TEXT NOT NULL DEFAULT 'monthly'`);
  }
  if (!names.has('months_total')) {
    await db.execAsync('ALTER TABLE fixed_expenses ADD COLUMN months_total INTEGER');
  }
  if (!names.has('months_paid')) {
    await db.execAsync('ALTER TABLE fixed_expenses ADD COLUMN months_paid INTEGER');
  }
}

async function migrateTransactionBank(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('bank_id')) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN bank_id TEXT');
  }
  if (!names.has('bank_label')) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN bank_label TEXT');
  }
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_id)');
}

function asLedger(row: LedgerRow, type: LedgerItem['type']): LedgerItem {
  return withAccount({
    id: row.id,
    type,
    amount: row.amount,
    merchant: row.title,
    date: row.date,
    category: row.category,
    note: row.note,
    bankId: row.bank_id ?? undefined,
    bankLabel: row.bank_label ?? undefined,
  });
}

export async function loadTransactions(): Promise<LedgerItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LedgerRow>(
    'SELECT id, title, amount, category, date, note, bank_id, bank_label FROM transactions ORDER BY date DESC LIMIT 200',
  );
  return restoreDetails(rows.map((row) => asLedger(row, 'transaction')));
}

export async function loadEvents(): Promise<LedgerItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LedgerRow>(
    'SELECT id, title, amount, category, date, note FROM events ORDER BY starts_at DESC LIMIT 200',
  );
  return restoreDetails(rows.map((row) => asLedger(row, 'event')));
}

export async function loadSubscriptions(): Promise<LedgerItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LedgerRow>(
    'SELECT id, title, amount, category, date, note FROM subscriptions ORDER BY date DESC LIMIT 200',
  );
  return restoreDetails(rows.map((row) => asLedger(row, 'subscription')));
}

export async function loadProcessedHashes(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ hash: string }>('SELECT hash FROM processed_messages');
  return rows.map((row) => row.hash);
}

export async function clearProcessedHashes() {
  const db = await getDb();
  await db.runAsync('DELETE FROM processed_messages');
}

export async function clearSmsDerivedLedger() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM events WHERE note != 'calendar' AND id NOT LIKE 'cal-%';
    DELETE FROM subscriptions WHERE note != 'app' AND id NOT LIKE 'app-%';
    DELETE FROM processed_messages;
    DELETE FROM scan_meta WHERE key IN (
      'last_received_at',
      'last_scan_at',
      'history_since',
      'applied_lookback_months'
    );
  `);
}

export async function getScanMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM scan_meta WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setScanMeta(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO scan_meta (key, value) VALUES (?, ?)', [key, value]);
}

export async function getLastReceivedAt(): Promise<number> {
  return Number((await getScanMeta('last_received_at')) ?? 0) || 0;
}

export async function getLastScanAt(): Promise<number> {
  return Number((await getScanMeta('last_scan_at')) ?? 0) || 0;
}

export async function getHistorySince(): Promise<number> {
  return Number((await getScanMeta('history_since')) ?? 0) || 0;
}

export async function setHistorySince(value: number) {
  if (value <= 0) {
    const db = await getDb();
    await db.runAsync('DELETE FROM scan_meta WHERE key = ?', ['history_since']);
    return;
  }
  await setScanMeta('history_since', String(value));
}

export async function advanceHistoryCursor(input: {
  receivedAts: number[];
  fetched: number;
  limit: number;
  backfill: boolean;
}) {
  const now = Date.now();
  await setScanMeta('last_scan_at', String(now));
  if (!input.backfill) {
    return;
  }
  if (input.fetched <= 0 || input.fetched < input.limit) {
    await setHistorySince(0);
    return;
  }
  await setHistorySince(Math.max(0, ...input.receivedAts));
}

export async function persistParsedBatch(input: {
  items: LedgerItem[];
  processed: { hash: string; sourceId: string; receivedAt: number; sender: string }[];
}) {
  const db = await getDb();
  const now = Date.now();
  let maxReceived = await getLastReceivedAt();

  await db.withTransactionAsync(async () => {
    for (const item of input.items) {
      await db.runAsync('INSERT OR REPLACE INTO ledger_details (id, payload) VALUES (?, ?)', [item.id, JSON.stringify(item)]);
      if (isLifeItem(item)) {
        await db.runAsync(`INSERT INTO life_items (id, payload) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
          WHERE COALESCE(json_extract(excluded.payload, '$.receivedAt'), 0) >= COALESCE(json_extract(life_items.payload, '$.receivedAt'), 0)`, [item.id, JSON.stringify(item)]);
        continue;
      }
      const title = item.merchant ?? item.note ?? item.category;
      const amount = sqlValue(item.amount);
      const date = sqlValue(item.date ?? '');
      const note = sqlValue(item.note ?? '');
      const id = sqlValue(item.id);
      const category = sqlValue(item.category);
      if (item.type === 'transaction') {
        await db.runAsync(
          `INSERT OR IGNORE INTO transactions (id, title, amount, category, date, note, bank_id, bank_label, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            sqlValue(title),
            amount,
            category,
            date,
            note,
            sqlValue(item.bankId),
            sqlValue(item.bankLabel),
            now,
          ],
        );
      } else if (item.type === 'event') {
        await db.runAsync(
          `INSERT OR IGNORE INTO events (id, title, amount, category, date, note, starts_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, sqlValue(title), amount, category, date, note, date, now],
        );
      } else {
        await db.runAsync(
          `INSERT OR IGNORE INTO subscriptions (id, title, amount, category, date, note, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, sqlValue(title), amount, category, date, note, 'active', now],
        );
      }
    }

    for (const message of input.processed) {
      await db.runAsync(
        `INSERT OR IGNORE INTO processed_messages (hash, source_id, received_at, read_at, sender)
         VALUES (?, ?, ?, ?, ?)`,
        [
          sqlValue(message.hash),
          sqlValue(message.sourceId),
          sqlValue(message.receivedAt),
          now,
          sqlValue(message.sender),
        ],
      );
      if (message.receivedAt > maxReceived) {
        maxReceived = message.receivedAt;
      }
    }

    await db.runAsync('INSERT OR REPLACE INTO scan_meta (key, value) VALUES (?, ?)', [
      'last_received_at',
      String(maxReceived),
    ]);
    await db.runAsync('INSERT OR REPLACE INTO scan_meta (key, value) VALUES (?, ?)', [
      'last_scan_at',
      String(now),
    ]);
  });
}

export async function loadSalary(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ amount: number }>('SELECT amount FROM monthly_salary WHERE id = ?', [
    'current',
  ]);
  return row?.amount ?? 0;
}

export async function saveSalary(amount: number) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO monthly_salary (id, amount, updated_at) VALUES (?, ?, ?)', [
    'current',
    amount,
    Date.now(),
  ]);
}

type FixedExpenseSqlRow = {
  id: string;
  label: string;
  amount: number;
  kind: string | null;
  months_total: number | null;
  months_paid: number | null;
};

export async function loadFixedExpenses(): Promise<FixedExpenseRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FixedExpenseSqlRow>(
    'SELECT id, label, amount, kind, months_total, months_paid FROM fixed_expenses ORDER BY label COLLATE NOCASE',
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    amount: row.amount,
    kind: row.kind === 'emi' ? 'emi' : 'monthly',
    monthsTotal: row.months_total,
    monthsPaid: row.months_paid,
  }));
}

export async function upsertFixedExpense(row: FixedExpenseRow) {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO fixed_expenses (id, label, amount, kind, months_total, months_paid, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       label = excluded.label,
       amount = excluded.amount,
       kind = excluded.kind,
       months_total = excluded.months_total,
       months_paid = excluded.months_paid,
       updated_at = excluded.updated_at`,
    [row.id, row.label, row.amount, row.kind, row.monthsTotal, row.monthsPaid, now, now],
  );
}

export async function deleteFixedExpense(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM fixed_expenses WHERE id = ?', [id]);
}

export async function deleteTransactionsByIds(ids: string[]) {
  if (ids.length === 0) {
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    }
  });
}

export async function clearLedgerTables() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM life_items;
    DELETE FROM ledger_details;
    DELETE FROM item_states;
    DELETE FROM transactions;
    DELETE FROM events;
    DELETE FROM subscriptions;
    DELETE FROM processed_messages;
    DELETE FROM extraction_cache;
    DELETE FROM screenshot_scans;
    DELETE FROM scan_meta WHERE key IN (
      'last_received_at',
      'last_scan_at',
      'history_since',
      'applied_lookback_months'
    );
  `);
}

async function restoreDetails(items: LedgerItem[]): Promise<LedgerItem[]> {
  if (items.length === 0) return [];
  const db = await getDb();
  const placeholders = items.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ id: string; payload: string }>(
    `SELECT id, payload FROM ledger_details WHERE id IN (${placeholders})`, items.map((item) => item.id),
  );
  const details = new Map(rows.map((row) => [row.id, row.payload]));
  return items.map((item) => {
    try { return { ...item, ...JSON.parse(details.get(item.id) ?? '{}'), id: item.id, type: item.type }; }
    catch { return item; }
  });
}

export async function loadLifeItems(): Promise<LedgerItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM life_items');
  return rows.flatMap((row) => {
    try { const item = JSON.parse(row.payload) as LedgerItem; return isLifeItem(item) ? [item] : []; }
    catch { return []; }
  });
}

export type ItemState = { status?: 'open' | 'done' | 'dismissed'; date?: string | null; title?: string };

export async function loadItemStates(): Promise<Record<string, ItemState>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; payload: string }>('SELECT id, payload FROM item_states');
  return Object.fromEntries(rows.flatMap((row) => {
    try { return [[row.id, JSON.parse(row.payload) as ItemState]]; } catch { return []; }
  }));
}

export async function saveItemState(id: string, state: ItemState) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO item_states (id, payload) VALUES (?, ?)', [id, JSON.stringify(state)]);
}

export async function clearBudgetTables() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM monthly_salary;
    DELETE FROM fixed_expenses;
  `);
}
