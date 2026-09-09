/* global __dirname */
// Run the real TypeScript parsers and SQL using Node, without a device or new dependencies.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...rest) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, ...rest);
};
require.extensions['.ts'] = function (module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(result.outputText, filename);
};
const sql = new DatabaseSync(':memory:');
const sqlite = {
  execAsync: async (query) => sql.exec(query),
  runAsync: async (query, params = []) => sql.prepare(query).run(...params),
  getAllAsync: async (query, params = []) => sql.prepare(query).all(...params),
  getFirstAsync: async (query, params = []) => sql.prepare(query).get(...params),
  withTransactionAsync: async (work) => {
    sql.exec('BEGIN');
    try { await work(); sql.exec('COMMIT'); } catch (error) { sql.exec('ROLLBACK'); throw error; }
  },
};
const originalLoad = Module._load;
const nativeTest = {};
const virtualModelFiles = [];
class TestFile {
  constructor(parent, name) { this.uri = name ? `${parent.uri}${name}` : parent; this.name = this.uri.split('/').at(-1); }
  get exists() { return virtualModelFiles.some((file) => file.name === this.name); }
  get size() { return virtualModelFiles.find((file) => file.name === this.name)?.bytes ?? 0; }
}
class TestDirectory {
  uri = 'file://documents/react-native-executorch/'; exists = true;
  list() { return virtualModelFiles.map((file) => new TestFile(this, file.name)); }
}
Module._load = function (name, ...rest) {
  if (name === 'expo-sqlite') return { openDatabaseAsync: async () => sqlite };
  if (name === 'expo-file-system') return { File: TestFile, Directory: TestDirectory, Paths: { document: 'file://documents/' } };
  if (name === 'expo-crypto') return { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, text) => require('node:crypto').createHash('sha256').update(text).digest('hex') };
  if (name === '@/services/finlife-native') return { getFinlifeNative: () => nativeTest };
  if (name === 'react-native') return { Platform: { Version: 35 }, PermissionsAndroid: { PERMISSIONS: { READ_MEDIA_IMAGES: 'images', READ_MEDIA_VISUAL_USER_SELECTED: 'selected' }, check: async () => true } };
  return originalLoad.call(this, name, ...rest);
};
const { parseInbox } = require('../utils/parse-inbox.ts');
const { extractMessageDate, localDay } = require('../utils/message-date.ts');
const { securityReasons } = require('../utils/life-extraction.ts');
const { agendaGroups, effectiveItem, dashboardHighlights } = require('../utils/life-agenda.ts');
const { toLedgerItem } = require('../types/ledger.ts');
const { parseModelJson } = require('../utils/json-from-model.ts');
const db = require('../services/database.ts');
const { useTransactionStore } = require('../store/transaction-store.ts');
const { listBankAccounts } = require('../utils/bank-account.ts');
const { relevantEvents, normalizeEvent } = require('../utils/relevant-events.ts');
const { confirmedRenewals } = require('../utils/renewals.ts');
const receipt = new Date(2026, 8, 7, 10).getTime();
const message = (body, id = 'sms-1') => ({ id, body, sender: 'TEST', date: '2026-09-07', receivedAt: receipt });
const parse = (body) => parseInbox([message(body)]).parsed;

test('events keep Kerala and national holidays plus personal plans, excluding other holiday feeds and ads', () => {
  const event = (id, merchant, extra = {}) => ({ id, merchant, type: 'event', amount: null, date: '2026-09-12', category: 'other', note: 'calendar', ...extra });
  const rows = [event('cal-1', 'Onam'), event('cal-2', 'Gandhi Jayanti'), event('cal-3', 'Thanksgiving'), event('cal-4', 'Chhath Puja'), event('cal-5', 'Dentist appointment', { location: 'Bengaluru' }), event('cal-6', 'Dentist appointment', { location: 'Bengaluru' }), event('sms-1', 'Concert', { note: 'regex', sourceBody: 'Book now for a concert in Mumbai September 12' }), event('cal-old', 'Meeting', { date: '2026-08-01' }), event('cal-done', 'Meeting', { date: '2026-09-13' }), event('cal-far', 'Wedding', { date: '2026-12-20', location: 'Bengaluru' })];
  assert.deepEqual(relevantEvents(rows, { 'cal-done': { status: 'done' } }, new Date(2026, 8, 9)).map((item) => item.id), ['cal-1', 'cal-2', 'cal-5']);
  assert.equal(normalizeEvent(event('holiday', 'Gandhi Jayanti', { date: '2026-10-02T00:00:00.000Z' })).date, '2026-10-02');
  assert.equal(normalizeEvent(event('appointment', 'Dentist appointment', { date: '2026-10-02T09:00:00.000Z' })).date, '2026-10-02T09:00:00.000Z');
});

test('OTT notices recognize Kerala services and use renewal dates instead of receipt dates', () => {
  for (const name of ['JioHotstar', 'Sony LIV', 'Sun NXT', 'ManoramaMAX', 'Saina Play']) {
    const item = parse(`Your ${name} subscription renews on September 15 for INR 299`)[0];
    assert.equal(item.type, 'subscription'); assert.equal(item.date, '2026-09-15'); assert.equal(item.amount, 299);
  }
  assert.equal(parse('Netflix subscription activated on September 7')[0].date, null);
  assert.equal(parse('Your Netflix payment of INR 499 was received September 7. Next billing date October 7')[0].date, '2026-10-07');
  assert.equal(parse('Netflix offer! Subscribe now for INR 199').some((item) => item.type === 'subscription'), false);
  assert.equal(parse('Book now for a concert on September 15').some((item) => item.type === 'event'), false);
});

test('renewals ignore installed apps and stale promotions, merge notices and respect cancellation', () => {
  const notice = (body, id, receivedAt) => toLedgerItem({ ...parse(body)[0], receivedAt }, id);
  const old = notice('Your Netflix subscription renews on September 15', 'old', receipt);
  const newer = notice('Your Netflix subscription renews on October 15', 'new', receipt + 1000);
  const app = { ...old, id: 'app-netflix', note: 'app', date: '2026-09-09' };
  const promo = { ...old, id: 'promo', sourceBody: 'Netflix offer! Subscribe now', receivedAt: receipt + 2000 };
  assert.deepEqual(confirmedRenewals([old, app, newer, promo], {}).map((item) => item.date), ['2026-10-15']);
  assert.equal(confirmedRenewals([old, newer], { [newer.id]: { status: 'done' } }).length, 0);
  const cancelled = notice('Your Netflix subscription has been cancelled', 'cancelled', receipt + 3000);
  assert.equal(confirmedRenewals([old, newer, cancelled], {}).length, 0);
  assert.equal(confirmedRenewals([{ ...old, id: 'manual', sourceBody: undefined, note: 'Added by you', date: null }], {})[0].date, null);
});

test('all supported subscription packages are declared for Android visibility', () => {
  const { subscriptionAppPackages } = require('../utils/subscription-apps.ts');
  const manifest = fs.readFileSync(path.join(root, 'modules/finlife-native/android/src/main/AndroidManifest.xml'), 'utf8');
  for (const name of subscriptionAppPackages()) assert.ok(manifest.includes(`android:name="${name}"`), name);
});

test('dashboard balances urgent and upcoming plans, excludes transactions and caps visible items', () => {
  const groups = {
    Important: [{ id: 'security', type: 'security' }],
    Overdue: [
      { id: 'old-bill', type: 'bill', date: '2026-08-19' },
      ...Array.from({ length: 20 }, (_, i) => ({ id: `old-${i}`, type: 'action', date: `2026-08-${String(i + 1).padStart(2, '0')}` })),
    ],
    Today: [{ id: 'bank', type: 'transaction' }, { id: 'appointment', type: 'event' }],
    Tomorrow: [{ id: 'train', type: 'travel' }],
    'Next 7 days': [{ id: 'renewal', type: 'subscription' }],
  };
  const ids = dashboardHighlights(groups).map((item) => item.id);
  assert.equal(ids.length, 6);
  assert.ok(ids.includes('appointment')); assert.ok(ids.includes('train')); assert.ok(ids.includes('renewal'));
  assert.ok(!ids.includes('bank'));
  assert.ok(!ids.includes('old-bill'));
  assert.ok(ids.includes('old-19'));
});

test('finance excludes card and food-app records on load and scan without deleting originals', () => {
  const base = { type: 'transaction', amount: 100, date: '2026-09-07', category: 'other', note: '', merchant: 'Grocer', bankId: 'hdfc', bankLabel: 'HDFC Bank' };
  const rows = [
    { ...base, id: 'salary', amount: 42000, category: 'income', merchant: 'Salary' },
    { ...base, id: 'debit', sourceBody: 'Rs.100 spent using HDFC debit card at Grocer' },
    { ...base, id: 'swiggy', merchant: 'SWIGGY', bankId: 'swiggy', bankLabel: 'Swiggy' },
    { ...base, id: 'zomato', sourceBody: 'A/c debited Rs.100 at ZOMATO' },
    { ...base, id: 'card', sourceBody: 'Rs.100 spent using HDFC Credit Card XX1234' },
    { ...base, id: 'legacy-card', note: 'Credit-card payment' },
    { ...base, id: 'card-sender', sender: 'VM-SBICRD-S', bankId: 'sbi', bankLabel: 'SBI' },
    { ...base, id: 'legacy-food', review: 'Debit from AX-ZOMATO-S' },
  ];
  const store = useTransactionStore.getState();
  store.replaceAll(rows);
  assert.deepEqual(useTransactionStore.getState().financeItems.map((item) => item.id), ['salary', 'debit']);
  assert.equal(useTransactionStore.getState().items.length, rows.length);
  const accounts = listBankAccounts(useTransactionStore.getState().financeItems, new Date(2026, 8, 9));
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].income, 42000);
  assert.equal(accounts[0].spend, 100);
  store.replaceAll([]);
  store.addMany([...rows, { ...base, type: 'delivery', id: 'delivery' }]);
  store.addMany(rows);
  assert.deepEqual(useTransactionStore.getState().financeItems.map((item) => item.id), ['salary', 'debit']);
  assert.equal(useTransactionStore.getState().items.length, rows.length);
  store.replaceAll([]);
  assert.equal(useTransactionStore.getState().financeItems.length, 0);
});

for (const [body, type, date] of [
  ['Submit documents before Sept 12', 'action', '2026-09-12'],
  ['Submit college form today by 5 PM', 'action', new Date(2026, 8, 7, 17).toISOString()],
  ['Train 12627 departs tomorrow at 7:40 PM. PNR: 1234567890', 'travel', new Date(2026, 8, 8, 19, 40).toISOString()],
  ['Flight to Bengaluru confirmed Friday. PNR: ABC123', 'travel', '2026-09-11'],
  ['Hotel booking confirmed for September 15', 'travel', '2026-09-15'],
  ['Amazon package arriving tomorrow', 'delivery', '2026-09-08'],
  ['Credit card Rs.4,250 due tomorrow', 'bill', '2026-09-08'],
  ['Electricity bill ₹1,240 due Sep 10', 'bill', '2026-09-10'],
  ['Insurance expires Oct 5', 'document', '2026-10-05'],
  ['Appointment confirmed Monday 3 PM', 'event', new Date(2026, 8, 7, 15).toISOString()],
  ['Return available until Sep 18', 'purchase', '2026-09-18'],
  ['Netflix renews Sep 15 for INR 499', 'subscription', '2026-09-15'],
]) {
  test(`extract ${type}: ${body}`, () => {
    const item = parse(body).find((entry) => entry.type === type);
    assert.ok(item, `Expected ${type}, got ${JSON.stringify(parse(body))}`);
    assert.equal(item.date, date);
    assert.equal(item.sourceBody, body);
  });
}

test('unknown deadlines stay unknown', () => assert.equal(parse('Please submit your documents')[0].date, null));
test('invalid calendar dates are not normalized', () => assert.equal(extractMessageDate('Exam on 31-Feb-2026', receipt), null));
test('relative dates use historic receipt time', () => assert.equal(extractMessageDate('arriving tomorrow', new Date(2025, 11, 31).getTime()), '2026-01-01'));
test('December booking for January rolls into next year', () => assert.equal(extractMessageDate('Flight on Jan 5', new Date(2026, 11, 30).getTime()), '2027-01-05'));
test('PNR and rupee amounts survive extraction', () => {
  assert.equal(parse('Train departs tomorrow PNR: 1234567890')[0].reference, '1234567890');
  assert.equal(parse('Electricity bill ₹1,240 due Sep 10')[0].amount, 1240);
});
test('card due notice becomes a bill, never spending', () => assert.deepEqual(parse('HDFC credit card total amount due INR 4250 payment due Sep 10').map((item) => item.type), ['bill']));
test('card payment acknowledgement still drops', () => assert.equal(parse('Payment of Rs.8000 received on your HDFC Credit Card XX1234. Total Amt Due Rs.0').length, 0));
test('bank debit remains a transaction', () => {
  const item = parse('HDFC Bank: Rs.450 debited from A/c XX1234 at SWIGGY. Avl Bal Rs.12000').find((entry) => entry.type === 'transaction');
  assert.equal(item.amount, 450); assert.equal(item.category, 'dining');
});
test('renewal and actual debit in one SMS both survive', () => {
  const types = parse('Rs.499 debited from account for Netflix subscription renews Sep 15').map((item) => item.type);
  assert.ok(types.includes('subscription')); assert.ok(types.includes('transaction'));
});
test('salary income preserved', () => assert.equal(parse('A/c XX1234 credited INR 42000. Info SALARY')[0].category, 'income'));
test('security runs before card mirror and spam filters', () => {
  const items = parse('Your bank credit card account will be blocked. Update KYC immediately https://bit.ly/fake');
  assert.equal(items[0].type, 'security'); assert.equal(items[0].amount, null);
});
test('account threat without a link is still reviewable', () => assert.equal(parse('Your bank account will be blocked')[0].type, 'security'));
test('routine OTP and do-not-share warnings are not security alerts', () => {
  assert.equal(securityReasons('Your OTP is 123456. Do not share this OTP with anyone.').length, 0);
  assert.equal(parse('Your OTP is 123456. Never share your password.').length, 0);
});
test('secret code requests are flagged', () => assert.ok(securityReasons('Please share your OTP with our agent').length));
test('source identifiers survive model JSON validation', () => {
  const item = { type: 'delivery', sourceId: 'sms-42', merchant: 'Parcel', amount: null, date: null, category: 'delivery', note: 'Expected', reference: 'ABC123' };
  assert.equal(parseModelJson(JSON.stringify({ items: [item] })).items[0].sourceId, 'sms-42');
});
test('agenda separates overdue, today, security, unknown dates, and completion', () => {
  const items = [
    { ...parse('Submit form today')[0], id: 'today' },
    { ...parse('Submit form today')[0], id: 'overdue', date: '2026-09-06' },
    { ...parse('Submit form')[0], id: 'unknown' },
    { ...parse('Your bank account will be blocked')[0], id: 'risk' },
    { ...parse('Submit assignment today')[0], id: 'done' },
  ];
  const groups = agendaGroups(items, { done: { status: 'done' } }, new Date(receipt));
  assert.equal(groups.Today.length, 1); assert.equal(groups.Overdue.length, 1);
  assert.equal(groups.Important.length, 1); assert.equal(groups.Completed.length, 1);
  assert.equal(groups['Date needed'].length, 1);
});
test('calendar day stays local across time zones', () => {
  const date = new Date(2026, 8, 7, 0, 30);
  assert.equal(localDay(date), '2026-09-07');
});

test('repeated notices produce one concise card and completing it does not reveal a duplicate', () => {
  const { deduplicateInformation, informationTitle } = require('../utils/information.ts');
  const first = { ...parse('Please submit your college form before September 12')[0], id: 'first', receivedAt: receipt };
  const repeated = { ...first, id: 'again', sourceId: 'other-sms', receivedAt: receipt + 1000 };
  assert.equal(deduplicateInformation([first, repeated]).length, 1);
  assert.equal(informationTitle(first), 'Submit your college form');
  const groups = agendaGroups([first, repeated], { first: { status: 'done' } }, new Date(receipt));
  assert.equal(groups.Completed.length, 1);
  assert.equal(groups['Next 7 days'].length, 0);
});

test('bill reminders merge only for matching provider, consumer account and due date', () => {
  const { deduplicateInformation } = require('../utils/information.ts');
  const a = { ...parse('KSEB electricity bill Rs.1240 due September 12. Consumer ID 12345678')[0], id: 'a' };
  const b = { ...parse('Reminder: KSEB Consumer ID 12345678 bill Rs.1240 payable by September 12')[0], id: 'b' };
  const differentAccount = { ...b, id: 'c', sourceBody: b.sourceBody.replace('12345678', '87654321') };
  assert.equal(deduplicateInformation([a, b]).length, 1);
  assert.equal(deduplicateInformation([a, b, differentAccount]).length, 2);
});

test('duplicate transfer references count once, while separate payments and both transfer sides survive', () => {
  const { deduplicateInformation } = require('../utils/information.ts');
  const base = { type: 'transaction', id: 'a', sourceId: 'a', date: '2026-09-09T10:00:00+05:30', amount: 100, category: 'other', note: '', bankId: 'hdfc', sourceBody: 'A/c XX1234 debited Rs.100. UPI Ref No: 123456789012' };
  assert.equal(deduplicateInformation([base, { ...base, id: 'again', sourceId: 'again' }]).length, 1);
  assert.equal(deduplicateInformation([base, { ...base, id: 'b', sourceBody: base.sourceBody.replace('123456789012', '999456789012') }]).length, 2);
  assert.equal(deduplicateInformation([base, { ...base, id: 'credit', category: 'income' }]).length, 2);
  const noRef = { ...base, sourceBody: 'A/c XX1234 debited Rs.100 at Grocer', receivedAt: receipt };
  assert.equal(deduplicateInformation([noRef, { ...noRef, id: 'restored', sourceId: 'restored' }]).length, 1);
  assert.equal(deduplicateInformation([noRef, { ...noRef, id: 'second-payment', sourceId: 'second-payment', receivedAt: receipt + 60000 }]).length, 2);
});

test('Christmas is available without calendar permission and holiday feed copies do not duplicate it', () => {
  const { regionalHolidays } = require('../utils/regional-holidays.ts');
  const now = new Date(2026, 8, 9);
  const nearChristmas = new Date(2026, 10, 1);
  const holidays = regionalHolidays(now);
  const christmas = holidays.find((item) => item.merchant === 'Christmas');
  assert.equal(christmas.date, '2026-12-25');
  assert.equal(holidays.find((item) => item.merchant === 'Mahanavami').date, '2026-10-20');
  assert.equal(holidays.find((item) => item.merchant === 'Vijayadashami').date, '2026-10-21');
  assert.equal(relevantEvents([{ ...christmas, id: 'cal-christmas', merchant: 'Christmas Day' }, ...holidays], {}, now).filter((item) => /christmas/i.test(item.merchant)).length, 0);
  assert.equal(relevantEvents([{ ...christmas, id: 'cal-christmas', merchant: 'Christmas Day' }, ...holidays], {}, nearChristmas).filter((item) => /christmas/i.test(item.merchant)).length, 1);
  assert.equal(relevantEvents([{ ...christmas, id: 'cal-christmas', merchant: 'Christmas Day' }, ...holidays], { 'cal-christmas': { status: 'done' } }, nearChristmas).filter((item) => /christmas/i.test(item.merchant)).length, 0);
  const gandhi = holidays.find((item) => item.merchant === 'Gandhi Jayanti');
  assert.equal(relevantEvents([{ ...gandhi, id: 'cal-gandhi', merchant: 'Mahatma Gandhi Jayanti' }, ...holidays], {}, now).filter((item) => /gandhi/i.test(item.merchant)).length, 1);
  const diwali = holidays.find((item) => item.merchant === 'Diwali');
  for (const merchant of ['Diwali/Deepavali', 'Diwali (Deepavali)', 'Deepavali']) assert.equal(relevantEvents([{ ...diwali, id: 'cal-diwali', merchant }, ...holidays], {}, now).filter((item) => /diwali|deepavali/i.test(item.merchant)).length, 1);
  assert.ok(regionalHolidays(new Date(2026, 11, 26)).some((item) => item.date === '2027-12-25'));
  assert.ok(!regionalHolidays(new Date(2027, 0, 1)).some((item) => item.merchant === 'Onam'));
});

test('publisher icons are bundled for common OTT and music apps', () => {
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'assets/subscription-icons/sources.json'), 'utf8'));
  for (const id of ['netflix', 'prime', 'hotstar', 'sonyliv', 'zee5', 'sunnxt', 'manoramamax', 'sainaplay', 'spotify', 'ytmusic']) {
    const source = sources.find((item) => item.id === id);
    assert.ok(source, id);
    assert.ok(fs.statSync(path.join(root, 'assets/subscription-icons', source.file)).size > 500);
    assert.ok(source.page.startsWith('https://play.google.com/'));
  }
});
test('delivery references do not invent IDs from ordinary words', () => {
  assert.equal(parse('Your order confirmed today')[0].reference, null);
  assert.equal(parse('Your order will be delivered tomorrow')[0].trackingStatus, 'scheduled');
});
test('delivery updates coalesce and an old rescan cannot overwrite delivery status', async () => {
  const first = toLedgerItem(parse('Order AB12345 shipped today')[0]);
  const delivered = toLedgerItem({ ...parse('Order AB12345 delivered today')[0], receivedAt: receipt + 1000 });
  assert.equal(first.id, delivered.id);
  await db.persistParsedBatch({ items: [first, delivered, first], processed: [] });
  const restored = (await db.loadLifeItems()).find((item) => item.id === first.id);
  assert.equal(restored.trackingStatus, 'delivered');
  assert.equal(agendaGroups([restored], {}, new Date(receipt)).History.length, 1);
  await db.clearLedgerTables();
});
test('travel route does not swallow its departure date', () => {
  assert.equal(parse('Flight booked from Delhi to Bengaluru on Friday')[0].location, 'Delhi → Bengaluru');
});
test('SQL persistence round trip, deduplication, corrections, and reset', async () => {
  const item = toLedgerItem(parse('Train departs tomorrow at 7:40 PM. PNR: ABC123')[0]);
  const event = toLedgerItem(parse('Appointment confirmed Monday 3 PM')[0]);
  const processed = [{ hash: 'hash-1', sourceId: 'sms-1', sender: 'TEST', receivedAt: receipt }];
  await db.persistParsedBatch({ items: [item, event], processed });
  await db.saveItemState(item.id, { status: 'done', title: 'My journey', date: '2026-09-10' });
  await db.persistParsedBatch({ items: [item, event], processed });
  const restored = await db.loadLifeItems();
  assert.equal(restored.length, 1); assert.equal(restored[0].reference, 'ABC123');
  const states = await db.loadItemStates();
  assert.equal(states[item.id].status, 'done');
  assert.equal(effectiveItem(restored[0], states).merchant, 'My journey');
  assert.equal((await db.loadEvents())[0].sourceBody, event.sourceBody);
  assert.deepEqual(await db.loadProcessedHashes(), ['hash-1']);
  await db.clearProcessedHashes();
  assert.equal((await db.loadLifeItems()).length, 1);
  await db.clearLedgerTables();
  assert.equal((await db.loadLifeItems()).length, 0);
  assert.deepEqual(await db.loadItemStates(), {});
});

const { extractScreenshot } = require('../utils/screenshot-extraction.ts');
const { ingestMessagePage } = require('../services/message-ingestion.ts');
const { readExtraction, writeExtraction } = require('../services/extraction-cache.ts');
const { useProcessedStore } = require('../store/processed-store.ts');
const { useLifeStore } = require('../store/life-store.ts');
const { useEventStore } = require('../store/event-store.ts');
const { useSubscriptionStore } = require('../store/subscription-store.ts');
const { hashMessageContent } = require('../utils/message-hash.ts');
const { parseCompleteModelJson } = require('../utils/json-from-model.ts');
async function resetScanTest() {
  await db.clearLedgerTables();
  for (const state of [useProcessedStore.getState(), useLifeStore.getState(), useEventStore.getState(), useSubscriptionStore.getState(), useTransactionStore.getState()]) state.replaceAll([]);
}

test('screenshot extraction anchors relative dates to capture time and retains image provenance', () => {
  const asset = { id: '1', name: 'Screenshot.png', uri: 'content://media/external/images/media/1', revision: '1', capturedAt: receipt };
  const text = 'Your Netflix subscription renews tomorrow for INR 499';
  const a = extractScreenshot(asset, 'abc123', text);
  const b = extractScreenshot({ ...asset, id: '2', uri: 'content://media/external/images/media/2' }, 'abc123', text);
  assert.equal(a[0].date, '2026-09-08');
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].sourceKind, 'screenshot');
  assert.equal(a[0].sourceUri, asset.uri);
  assert.equal(a[0].sourceBody, text);
  assert.equal(extractScreenshot(asset, 'empty', '').length, 0);
});

test('identical recurring notices on different days do not share a content hash', async () => {
  const a = message('Your plan renews tomorrow');
  const b = { ...a, date: '2026-10-07' };
  assert.notEqual(await hashMessageContent(a), await hashMessageContent(b));
  assert.equal(await hashMessageContent(a), await hashMessageContent({ ...a, id: 'carrier-copy' }));
});

test('AI batch completion rejects truncated JSON instead of acknowledging omitted messages', () => {
  assert.deepEqual(parseCompleteModelJson('{"items":[]}').items, []);
  assert.throws(() => parseCompleteModelJson('{"items":[{"sourceId":"sms-1","type":"action","amount":null,"merchant":"Task","date":null,"category":"action","note":"x"}'));
});

test('same source data gives the same ledger after a full clear, and a normal recheck adds nothing', async () => {
  const notices = [message('Your Netflix subscription renews September 15 for INR 499', 'sms-stable-1'), message('Submit college form by September 12 at 5 PM', 'sms-stable-2')];
  await resetScanTest();
  await ingestMessagePage(notices, 'test');
  const snapshot = () => [...useLifeStore.getState().items, ...useSubscriptionStore.getState().items].sort((a,b) => a.id.localeCompare(b.id));
  const first = snapshot();
  const repeat = await ingestMessagePage(notices, 'test');
  assert.equal(repeat.life + repeat.subscriptions, 0);
  assert.deepEqual(snapshot(), first);
  await resetScanTest();
  await ingestMessagePage(notices, 'test');
  assert.deepEqual(snapshot(), first);
});

test('more than 48 unmatched notices are handled in batches and empty decisions do not starve later notices', async () => {
  await resetScanTest();
  const notices = Array.from({ length: 61 }, (_, i) => message(`Invoice reference REVIEW_${i} needs classification`, `sms-ai-${i}`));
  let calls = 0, largest = 0, seen = 0;
  const result = await ingestMessagePage(notices, 'fixture-model', async (batch) => { calls++; largest = Math.max(largest, batch.length); seen += batch.length; return []; });
  assert.equal(seen, 61); assert.equal(calls, 6); assert.equal(largest, 12); assert.equal(result.pending, 0);
  await ingestMessagePage(notices, 'fixture-model', async () => { throw new Error('must be cached'); });
  // Rewalking parser inputs restores the same accepted decisions from SQLite without generating again.
  useProcessedStore.getState().replaceAll([]);
  const replay = await ingestMessagePage(notices, 'fixture-model', async () => { throw new Error('must be cached'); });
  assert.equal(replay.errors, 0); assert.equal(replay.pending, 0);
});

test('failed AI calls stay retryable and do not change reliable parser results', async () => {
  await resetScanTest();
  const uncertain = message('Invoice reference RETRY needs classification', 'sms-retry');
  const reliable = message('Your Netflix subscription renews September 15 for INR 499', 'sms-reliable');
  const result = await ingestMessagePage([uncertain, reliable], 'failure', async () => { throw new Error('interrupted'); });
  assert.equal(result.pending, 1); assert.equal(result.subscriptions, 1);
  const retry = await ingestMessagePage([uncertain, reliable], 'failure', async () => []);
  assert.equal(retry.pending, 0); assert.equal(useSubscriptionStore.getState().items.length, 1);
});

test('Clear database also deletes extracted image text and cached model output', async () => {
  await writeExtraction('private-test', { text: 'private screenshot text' });
  assert.ok(await readExtraction('private-test'));
  await db.clearLedgerTables();
  assert.equal(await readExtraction('private-test'), null);
});

test('insufficient model memory stops repeated load attempts and keeps unmatched notices retryable', async () => {
  await resetScanTest();
  const notices = Array.from({ length: 25 }, (_, index) => message(`Invoice reference MEMORY${index} needs classification`, `memory-${index}`));
  let calls = 0;
  const result = await ingestMessagePage(notices, 'large-model', async () => { calls++; throw new Error('Not enough free memory for this model.'); });
  assert.equal(calls, 1); assert.equal(result.pending, 25);
  assert.match(result.failureReason, /Qwen2.5 0.5B/);
  assert.equal((await ingestMessagePage(notices, 'smaller-model', async () => [])).pending, 0);
});

test('native screenshot scan caches duplicate images, retries failures, and categorizes without duplicate ledger rows', async () => {
  process.env.EXPO_OS = 'android';
  await resetScanTest();
  const { scanScreenshots, listScreenshotScans } = require('../services/screenshot-scanner.ts');
  const assets = [1, 2, 3].map((id) => ({ id: String(id), uri: `content://media/external/images/media/${id}`, name: `Screenshot-${id}.png`, revision: '1', capturedAt: receipt }));
  nativeTest.getScreenshotPage = async (_since, _until, after) => assets.filter((a) => Number(a.id) > after);
  let calls = 0;
  nativeTest.getScreenshotHash = async (uri) => { if (uri.endsWith('/3')) throw new Error('cannot read image'); return 'same-image-hash'; };
  nativeTest.recognizeScreenshot = async () => { calls++; return 'Your Netflix subscription renews September 15 for INR 499'; };
  const first = await scanScreenshots(new Date(2026, 8, 1));
  assert.equal(first.read, 3); assert.equal(first.added, 1); assert.equal(first.errors, 1); assert.equal(calls, 1);
  const repeat = await scanScreenshots(new Date(2026, 8, 1));
  assert.equal(repeat.added, 0); assert.equal(repeat.errors, 1); assert.equal(calls, 1);
  assert.equal((await listScreenshotScans(new Date(2026, 8, 1))).length, 2);
  assert.equal(useSubscriptionStore.getState().items.length, 1);
});

test('native screenshot month SQL handles string-bound timestamps, missing capture dates and folder scope', () => {
  const source = fs.readFileSync(path.join(root, 'modules/finlife-native/android/src/main/java/expo/modules/finlifenative/ScreenshotReader.kt'), 'utf8');
  const captured = source.match(/val captured = "([^"]+)"/)[1];
  const selection = source.match(/"(_id > \? AND [^"]+)"/)[1].replaceAll('$captured', captured).replaceAll('$folder', 'relative_path');
  sql.exec('CREATE TEMP TABLE gallery_fixture (_id INTEGER, datetaken INTEGER, date_added INTEGER, bucket_display_name TEXT, relative_path TEXT)');
  const start = new Date(2026, 8, 1).getTime(), end = new Date(2026, 9, 1).getTime();
  const add = sql.prepare('INSERT INTO gallery_fixture VALUES (?, ?, ?, ?, ?)');
  add.run(1, start - 1000, (start - 1000) / 1000, 'Screenshots', 'Pictures/Screenshots/');
  add.run(2, start + 1000, (start + 1000) / 1000, 'Screenshots', 'Pictures/Screenshots/');
  add.run(3, 0, (start + 2000) / 1000, 'Screenshots', 'Pictures/Screenshots/');
  add.run(4, start + 1000, (start + 1000) / 1000, 'Camera', 'DCIM/Camera/');
  add.run(5, end, end / 1000, 'Screenshots', 'Pictures/Screenshots/');
  const query = sql.prepare(`SELECT _id FROM gallery_fixture WHERE ${selection} ORDER BY _id ASC`);
  assert.deepEqual(query.all('0', String(start), String(end), '%screenshot%', '%screenshot%').map(row => row._id), [2, 3]);
  assert.deepEqual(query.all('2', String(start), String(end), '%screenshot%', '%screenshot%').map(row => row._id), [3]);
});

test('model cache never substitutes another model or a tokenizer with the same basename', () => {
  const { cacheNameFromUrl, resolveOfflineSources, hasCachedSources } = require('../services/model-storage.ts');
  const a = { model: 'https://models.example/a/model.pte', tokenizer: 'https://models.example/a/tokenizer.json', tokenizerConfig: 'https://models.example/a/tokenizer_config.json' };
  const b = { model: 'https://models.example/b/model.pte', tokenizer: 'https://models.example/b/tokenizer.json', tokenizerConfig: 'https://models.example/b/tokenizer_config.json' };
  virtualModelFiles.splice(0);
  for (const url of Object.values(a)) virtualModelFiles.push({ name: cacheNameFromUrl(url), bytes: 100 });
  assert.equal(hasCachedSources(a), true);
  assert.equal(hasCachedSources(b), false);
  assert.equal(resolveOfflineSources(null), null);
  virtualModelFiles.push({ name: cacheNameFromUrl(b.model), bytes: 100 });
  assert.equal(hasCachedSources(b), false, 'B must not use A tokenizers');
  virtualModelFiles.push({ name: cacheNameFromUrl(b.tokenizer), bytes: 0 }, { name: cacheNameFromUrl(b.tokenizerConfig), bytes: 100 });
  assert.equal(hasCachedSources(b), false, 'empty download must not count as cached');
});

test('screenshot menu labels and ProxAI dashboard captures cannot create fictional or recursive items', () => {
  const asset = { id: '1', name: 'Screenshot.png', uri: 'content://media/external/images/media/1', revision: '1', capturedAt: receipt };
  assert.deepEqual(extractScreenshot(asset, 'menu', 'Preferences Bills. Quick access. Pay bills. Renew subscriptions.'), []);
  assert.deepEqual(extractScreenshot(asset, 'dashboard', 'Performance Bills. Quick access. Today. Total bills INR 200. Pay bills.'), []);
  assert.deepEqual(extractScreenshot(asset, 'own-ui', 'Your day at a glance. Highlights. Electricity bill INR 1240 due September 10. All items.'), []);
  assert.equal(extractScreenshot(asset, 'real-bill', 'Electricity bill INR 1240 due September 10')[0].type, 'bill');
});

test('upcoming plans hide past events and travel even when old screenshots still parse them', () => {
  const { isUpcomingPlan } = require('../utils/information.ts');
  const now = new Date(2026, 8, 9);
  const pastEvent = { id: 'old', type: 'event', amount: null, merchant: 'Meeting', date: '2026-08-01', category: 'other', note: '' };
  const futureEvent = { ...pastEvent, id: 'next', date: '2026-09-20' };
  const spend = { id: 'tx', type: 'transaction', amount: 120, merchant: 'Grocer', date: '2026-08-01', category: 'grocery', note: '' };
  assert.equal(isUpcomingPlan(pastEvent, now), false);
  assert.equal(isUpcomingPlan(futureEvent, now), true);
  assert.equal(isUpcomingPlan(spend, now), true);
  const pastTravel = { ...parse('Train 12627 departs tomorrow at 7:40 PM. PNR: 1234567890')[0], id: 'old-train', date: '2026-08-01' };
  assert.equal(agendaGroups([pastTravel], {}, now).History.length, 0);
  assert.equal(agendaGroups([pastTravel], {}, now).Later.length, 0);
  const farTravel = { ...pastTravel, id: 'later-train', date: '2026-12-20' };
  assert.equal(agendaGroups([farTravel], {}, now).Later.length, 0);
  assert.equal(agendaGroups([futureEvent], {}, now).Later.length, 1);
});

test('old SMS events are not stored; unmatched screenshots are categorized by the model', async () => {
  process.env.EXPO_OS = 'android';
  await resetScanTest();
  await ingestMessagePage([message('Appointment confirmed 1 Jan 2020 3 PM', 'sms-past')], 'test');
  assert.equal(useEventStore.getState().items.length, 0);
  const { scanScreenshots } = require('../services/screenshot-scanner.ts');
  const soon = new Date(); soon.setDate(soon.getDate() + 21);
  const day = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  nativeTest.getScreenshotPage = async (_since, _until, after) => after ? [] : [{ id: '9', uri: 'content://media/external/images/media/9', name: 'Screenshot-9.png', revision: '1', capturedAt: receipt }];
  nativeTest.getScreenshotHash = async () => 'llm-shot-hash';
  nativeTest.recognizeScreenshot = async () => 'Invoice reference SCREEN_1 needs classification';
  const result = await scanScreenshots(new Date(2026, 8, 1), () => {}, async (batch) => [{
    sourceId: batch[0].id, type: 'event', amount: null, merchant: 'Dentist visit', date: day,
    category: 'other', note: 'appointment', valid: true, important: 'normal', review: 'appointment', reference: null, location: null,
  }]);
  assert.equal(result.added, 1);
  assert.equal(result.model, 1);
  assert.equal(useEventStore.getState().items[0].merchant, 'Dentist visit');
  assert.equal(useEventStore.getState().items[0].sourceKind, 'screenshot');
});

test('irrelevant screenshots still keep OCR text for review', async () => {
  process.env.EXPO_OS = 'android';
  await resetScanTest();
  const { scanScreenshots, listScreenshotScans } = require('../services/screenshot-scanner.ts');
  nativeTest.getScreenshotPage = async (_since, _until, after) => after ? [] : [{ id: '8', uri: 'content://media/external/images/media/8', name: 'Screenshot-8.png', revision: '1', capturedAt: receipt }];
  nativeTest.getScreenshotHash = async () => 'menu-ocr-hash';
  nativeTest.recognizeScreenshot = async () => 'Preferences Bills. Quick access. Pay bills. Renew subscriptions.';
  const result = await scanScreenshots(new Date(2026, 8, 1));
  assert.equal(result.added, 0);
  const rows = await listScreenshotScans(new Date(2026, 8, 1));
  assert.equal(rows.length, 1);
  assert.match(rows[0].text, /Quick access/);
  assert.equal(rows[0].itemIds.length, 0);
});

test('catalog keeps the recommended default and lists extra ExecuTorch exports', () => {
  const { CATALOG, DEFAULT_MODEL_ID, getCatalogModel } = require('../services/model-catalog.ts');
  assert.equal(DEFAULT_MODEL_ID, 'qwen2_5_0_5b');
  assert.equal(getCatalogModel('qwen2_5_0_5b').recommended, true);
  assert.equal(getCatalogModel('not-a-model').id, DEFAULT_MODEL_ID);
  for (const id of ['smollm2_135m_bf16', 'hammer2_1_0_5b', 'qwen3_0_6b', 'qwen3_1_7b', 'qwen3_5_2b', 'llama3_2_1b', 'lfm2_5_1_2b', 'phi4_mini_4b', 'gemma4_e2b', 'lfm2_5_vl_450m']) {
    assert.ok(CATALOG.some((item) => item.id === id), id);
  }
  assert.equal(getCatalogModel('smollm2_135m_bf16').compact, true);
  assert.equal(getCatalogModel('hammer2_1_0_5b').compact, true);
  assert.equal(getCatalogModel('gemma4_e2b').sources.model.includes('/xnnpack/'), true);
});

test('assistant prompts cover life and money', () => {
  const { detectCoachTopic, nextCoachPrompts } = require('../utils/coach-prompts.ts');
  const { coachSnapshot, buildSpendPlan, fallbackCoachReply, coachDisplayedReply } = require('../utils/spend-coach.ts');
  assert.equal(detectCoachTopic('What is on my agenda today?'), 'today');
  assert.equal(detectCoachTopic('What tasks still need me?'), 'tasks');
  assert.equal(detectCoachTopic('How much can I spend each day?'), 'daily');
  const plan = buildSpendPlan([], 40000, []);
  const prompts = nextCoachPrompts(null, plan);
  assert.ok(prompts.some((item) => /agenda/i.test(item)));
  const now = new Date(2026, 8, 9);
  const life = [{ id: 'a', type: 'action', merchant: 'College form', date: '2026-09-10', amount: null, category: 'action', note: 'x', sourceId: 'a' }];
  const snapshot = coachSnapshot({
    plan,
    categories: [],
    transactions: [],
    expenses: [],
    subscriptions: [],
    events: [],
    life,
  });
  assert.match(snapshot, /Tasks:/);
  assert.match(snapshot, /College form/);
  const agenda = fallbackCoachReply(plan, 'What is on my agenda today?', life, now);
  assert.match(agenda, /College form/);
  assert.doesNotMatch(agenda, /On your list/);
  const pastBill = [{ id: 'b', type: 'bill', merchant: 'Electricity bill', date: '2026-09-01', amount: 1240, category: 'bills', note: 'x', sourceId: 'b' }];
  assert.doesNotMatch(fallbackCoachReply(plan, 'What is on my agenda today?', pastBill, now), /Electricity/);
  assert.match(coachDisplayedReply('', 'Coming up: College form.', false, 'Qwen is not on this phone yet.'), /not on this phone/);
  assert.doesNotMatch(coachDisplayedReply('', 'Coming up: College form.', false, 'Qwen is not on this phone yet.'), /Coming up/);
  assert.match(coachDisplayedReply('Keep ₹200 today.', 'Coming up: College form.', true), /Keep/);
  const { clipCoachSnapshot } = require('../utils/coach-prompts.ts');
  assert.equal(clipCoachSnapshot('short'), 'short');
  assert.match(clipCoachSnapshot('x'.repeat(1600), 20), /truncated/);
});

test('OCR splits around unidentified symbols but keeps ordinary punctuation', () => {
  const { splitOcrBlocks, ocrTextBlocks, selectedOcrText, ocrCoachQuestion, defaultImageFolders } = require('../utils/ocr-blocks.ts');
  const blocks = splitOcrBlocks('Pay ₹1,240 due 10 Sep. □ KSEB bill | consumer 123');
  const texts = ocrTextBlocks('Pay ₹1,240 due 10 Sep. □ KSEB bill | consumer 123').map((block) => block.text);
  assert.ok(texts.some((item) => /Pay ₹1,240 due 10 Sep/.test(item)));
  assert.ok(texts.some((item) => /KSEB bill/.test(item)));
  assert.ok(texts.some((item) => /consumer 123/.test(item)));
  assert.equal(blocks.filter((block) => block.kind === 'break').length >= 1, true);
  assert.equal(ocrTextBlocks('Pay ₹1,240 due 10 Sep.').length, 1);
  assert.equal(ocrTextBlocks('Email bills to you@home.in {plan} [draft] #1').length, 1);
  const ocrUi = fs.readFileSync(path.join(root, 'components/ocr-text-blocks.tsx'), 'utf8');
  assert.match(ocrUi, /Ask assistant/);
  assert.doesNotMatch(ocrUi, /AppBottomSheet/);
  assert.match(ocrUi, /setAsking\(true\)/);
  const all = selectedOcrText(blocks, {});
  assert.match(all, /KSEB bill/);
  assert.match(ocrCoachQuestion('Create an email from this', 'KSEB bill due 10 Sep'), /no image/);
  assert.match(ocrCoachQuestion('Create an email from this', 'KSEB bill due 10 Sep'), /Create an email/);
  assert.deepEqual(defaultImageFolders([{ name: 'Camera' }, { name: 'Screenshots' }]), ['Screenshots']);
  assert.deepEqual(defaultImageFolders([{ name: 'Camera' }]), ['Screenshots']);
});

test('image asks start a fresh chat and pins store a short Home summary', async () => {
  const { summarizeCoachPin, formatCoachTime } = require('../utils/coach-pin.ts');
  const { ocrCoachQuestion } = require('../utils/ocr-blocks.ts');
  const { useCoachStore } = require('../store/coach-store.ts');
  const question = ocrCoachQuestion('Rephrase this', `Pay KSEB ₹1,240 by 10 September. Consumer 123. ${'Extra line. '.repeat(30)}`);
  const fromOcr = summarizeCoachPin(question);
  assert.equal(/Work only from this OCR/i.test(fromOcr), false);
  assert.ok(fromOcr.length <= 110);
  assert.match(fromOcr, /Rephrase this/i);
  const longReply = 'Pay the KSEB bill of ₹1,240 before 10 September from your savings. Keep the receipt with the consumer number and check the next bill cycle so the amount does not surprise you later this month.';
  const summary = summarizeCoachPin(longReply);
  assert.ok(summary.length <= 110);
  assert.match(summary, /KSEB|1,240|September/);
  assert.ok(formatCoachTime(new Date(2026, 8, 9, 14, 30).getTime()).length > 0);
  useCoachStore.getState().startNewChat();
  useCoachStore.getState().append('user', 'old thread');
  useCoachStore.getState().append('assistant', 'old reply about last week');
  assert.equal(useCoachStore.getState().messages.length, 2);
  useCoachStore.getState().startFreshAsk(question);
  assert.equal(useCoachStore.getState().messages.length, 0);
  assert.equal(useCoachStore.getState().pendingAsk, question);
  const { saveCoachPin, loadCoachPins, clearLedgerTables } = require('../services/database.ts');
  await saveCoachPin({ id: 'pin-test', messageId: 'coach-1', summary, at: Date.now() });
  assert.equal((await loadCoachPins())[0].summary, summary);
  await clearLedgerTables();
  assert.equal((await loadCoachPins()).length, 0);
  useCoachStore.getState().startNewChat();
});

test('model JSON keeps numeric sourceIds and maps a positional batch', () => {
  const { parsedItemSchema } = require('../types/llm-output.ts');
  const { matchLlmItems } = require('../services/message-ingestion.ts');
  assert.equal(parsedItemSchema.parse({
    type: 'action', amount: null, merchant: 'Task', date: null, category: 'action', note: 'x', sourceId: 42,
  }).sourceId, '42');
  const chunk = [{ id: 'sms-1', sender: 'BANK', body: 'Invoice due Friday', date: '2026-09-09' }];
  const positional = matchLlmItems([{
    type: 'event', amount: null, merchant: 'Dentist', date: '2026-09-20', category: 'other', note: 'visit',
  }], chunk[0], chunk);
  assert.equal(positional[0].merchant, 'Dentist');
  const tagged = matchLlmItems([{
    sourceId: 'sms-1', type: 'event', amount: null, merchant: 'Dentist', date: '2026-09-20', category: 'other', note: 'visit',
  }], chunk[0], chunk);
  assert.equal(tagged[0].merchant, 'Dentist');
  const unknown = matchLlmItems([{
    sourceId: 'other', type: 'event', amount: null, merchant: 'Dentist', date: '2026-09-20', category: 'other', note: 'visit',
  }], chunk[0], chunk);
  assert.equal(unknown, undefined);
});

test('text-to-image cache requires every pipeline file and ignores a matching tokenizer basename', () => {
  const { cacheFileNameFromUrl, isCachedTti, ttiCacheNames, ttiSourcesFor } = require('../services/text-to-image-catalog.ts');
  const a = ttiSourcesFor('xnnpack');
  const b = ttiSourcesFor('coreml');
  virtualModelFiles.splice(0);
  const files = new Map();
  for (const url of Object.values(a)) {
    const name = cacheFileNameFromUrl(url);
    virtualModelFiles.push({ name, bytes: 100 });
    files.set(name, 100);
  }
  assert.equal(ttiCacheNames(a).length, 2);
  assert.equal(isCachedTti(a, files), true);
  assert.equal(isCachedTti(b, files), false);
  assert.notEqual(cacheFileNameFromUrl(a.modelPath), cacheFileNameFromUrl(b.modelPath));
  assert.equal(cacheFileNameFromUrl(a.tokenizerPath), cacheFileNameFromUrl(b.tokenizerPath));
});

test('free-app-memory native code never kills other Android processes', () => {
  const kotlin = fs.readFileSync(path.join(root, 'modules/finlife-native/android/src/main/java/expo/modules/finlifenative/FinlifeNativeModule.kt'), 'utf8');
  assert.match(kotlin, /releaseAppMemory/);
  assert.doesNotMatch(kotlin, /killBackgroundProcesses|forceStopPackage|Process\.killProcess/);
  assert.match(kotlin, /Does not stop other apps/);
});

test('on-device catalog lists only models whose trio is already cached', () => {
  const { cacheNameFromUrl, listOnDeviceCatalog } = require('../services/model-storage.ts');
  const { resolveModelSources } = require('../services/model-catalog.ts');
  virtualModelFiles.splice(0);
  const custom = { customModelUrl: '', customTokenizerUrl: '', customTokenizerConfigUrl: '' };
  assert.equal(listOnDeviceCatalog(custom).length, 0);
  const sources = resolveModelSources({ modelId: 'qwen2_5_0_5b', ...custom });
  for (const url of Object.values(sources)) virtualModelFiles.push({ name: cacheNameFromUrl(url), bytes: 100 });
  const listed = listOnDeviceCatalog(custom);
  assert.ok(listed.some((item) => item.id === 'qwen2_5_0_5b'));
  assert.ok(listed.every((item) => item.id !== 'custom'));
});

test('chat unloads the previous model before loading a downloaded one', () => {
  const coach = fs.readFileSync(path.join(root, 'screens/coach/index.tsx'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'services/llm-runtime-executorch.ts'), 'utf8');
  assert.match(coach, /hasCachedSources/);
  assert.match(coach, /CATALOG/);
  assert.match(coach, /switchOnDeviceModel/);
  assert.match(coach, /Start a new chat/);
  const switchFn = runtime.slice(runtime.indexOf('async function switchOnDeviceModel'), runtime.indexOf('async function unloadFromMemory'));
  assert.match(switchFn, /unloadSession/);
  assert.match(switchFn, /loadSession/);
  assert.ok(switchFn.indexOf('unloadSession') < switchFn.indexOf('loadSession'));
});

test('leaving chat unloads RAM, asks first, and never stacks a second chat screen', () => {
  const coach = fs.readFileSync(path.join(root, 'screens/coach/index.tsx'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'services/llm-runtime-executorch.ts'), 'utf8');
  const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
  const open = fs.readFileSync(path.join(root, 'utils/open-coach.ts'), 'utf8');
  const life = fs.readFileSync(path.join(root, 'components/life-agenda.tsx'), 'utf8');
  const finance = fs.readFileSync(path.join(root, 'screens/finance/index.tsx'), 'utf8');
  const shots = fs.readFileSync(path.join(root, 'screens/screenshots/index.tsx'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'components/screenshot-detail-sheet.tsx'), 'utf8');
  const release = runtime.slice(runtime.indexOf('async function releaseCoachSession'), runtime.indexOf('async function switchOnDeviceModel'));
  assert.match(coach, /AppDialog/);
  assert.match(coach, /Leave chat\?/);
  assert.match(coach, /Start a new chat\?/);
  assert.match(coach, /beforeRemove/);
  assert.match(coach, /unloadCoachSession/);
  assert.match(coach, /startNewChat/);
  assert.match(release, /unloadSession/);
  assert.doesNotMatch(release, /delay\(700\)/);
  assert.doesNotMatch(layout, /getId=\{\(\) => 'coach'\}/);
  assert.match(layout, /dangerouslySingular/);
  assert.match(open, /navigate\('\/coach'/);
  assert.match(open, /dangerouslySingular: true/);
  assert.match(life, /openCoach/);
  assert.match(finance, /openCoach/);
  assert.match(shots, /openCoach/);
  assert.match(detail, /openCoach/);
  assert.doesNotMatch(life, /router\.push\('\/coach'/);
  assert.doesNotMatch(finance, /push\('\/coach'/);
  assert.doesNotMatch(shots, /push\('\/coach'/);
  assert.doesNotMatch(detail, /push\('\/coach'/);
});

test('language-model catalog does not list the image diffusion model', () => {
  const { CATALOG } = require('../services/model-catalog.ts');
  const { TTI_MODEL_NAME } = require('../services/text-to-image-catalog.ts');
  assert.ok(CATALOG.every((item) => !/BK-SDM|text-to-image|diffusion/i.test(`${item.id} ${item.label}`)));
  assert.equal(TTI_MODEL_NAME, 'SDXS 512 DreamShaper');
});

test('one native model slot: LLM load unloads vision, image gen unloads the LLM', () => {
  const runtime = fs.readFileSync(path.join(root, 'services/llm-runtime-executorch.ts'), 'utf8');
  const tti = fs.readFileSync(path.join(root, 'services/text-to-image.ts'), 'utf8');
  const slot = fs.readFileSync(path.join(root, 'services/inference-slot.ts'), 'utf8');
  assert.match(runtime, /exclusiveInference/);
  assert.match(runtime, /unloadVisionFromMemory/);
  assert.match(runtime, /occupyInference\('llm'\)/);
  assert.match(runtime, /Could not unload the image generator/);
  assert.match(tti, /exclusiveInference/);
  assert.match(tti, /releaseLlmSlot/);
  assert.match(tti, /occupyInference\('tti'\)/);
  assert.match(tti, /createSdxsTextToImage/);
  assert.doesNotMatch(tti, /cancelFetching/);
  assert.doesNotMatch(tti, /unloadModelFromMemory/);
  assert.match(slot, /Nested calls deadlock/);
});

test('image download stop cancels the resource fetcher, not only interrupt', () => {
  const tti = fs.readFileSync(path.join(root, 'services/text-to-image.ts'), 'utf8');
  const imagine = fs.readFileSync(path.join(root, 'screens/imagine/index.tsx'), 'utf8');
  const interrupt = tti.slice(tti.indexOf('export function interruptTextToImage'), tti.indexOf('async function downloadUnlocked'));
  const dispose = tti.slice(tti.indexOf('export async function disposeTextToImage'), tti.indexOf('export function interruptTextToImage'));
  assert.match(interrupt, /cancelled = true/);
  assert.match(interrupt, /downloadAbort\?\.abort/);
  assert.doesNotMatch(dispose, /downloadAbort/);
  assert.doesNotMatch(dispose, /cancelled = true/);
  assert.match(tti, /TTI_STOPPED/);
  assert.match(tti, /attachImagine/);
  assert.match(tti, /detachImagine/);
  assert.match(imagine, /interruptTextToImage/);
  assert.match(imagine, /ScreenBack/);
  assert.match(imagine, /attachImagine/);
  assert.match(imagine, /detachImagine/);
  assert.doesNotMatch(imagine, /interruptTextToImage\(\);\s*\n\s*router\.back/);
  assert.match(imagine, /name="stop"/);
  assert.match(imagine, /name="download-outline"/);
});

test('chat streams tokens and stack screens share the same back control', () => {
  const coach = fs.readFileSync(path.join(root, 'screens/coach/index.tsx'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'services/llm-runtime-executorch.ts'), 'utf8');
  const screenshots = fs.readFileSync(path.join(root, 'screens/screenshots/index.tsx'), 'utf8');
  const back = fs.readFileSync(path.join(root, 'components/screen-back.tsx'), 'utf8');
  const notice = fs.readFileSync(path.join(root, 'services/download-notice.ts'), 'utf8');
  const tti = fs.readFileSync(path.join(root, 'services/text-to-image.ts'), 'utf8');
  const ask = runtime.slice(runtime.indexOf('async function askCoach'), runtime.indexOf('async function acquireCoachSession'));
  assert.match(ask, /sendMessage/);
  assert.match(ask, /onToken/);
  assert.match(coach, /patch\(/);
  assert.match(coach, /ScreenBack/);
  assert.match(coach, /liveOn/);
  assert.match(coach, /interruptCoach/);
  assert.doesNotMatch(coach, /!focused \?/);
  assert.match(screenshots, /ScreenBack/);
  assert.match(back, /chevron-back/);
  assert.match(notice, /reportDownloadNotice/);
  assert.match(notice, /channelId: CHANNEL/);
  assert.match(runtime, /reportDownloadNotice/);
  assert.match(tti, /reportDownloadNotice/);
});

test('downloads show transferred size and retry a network abort', () => {
  const { formatBytes, transferLabel } = require('../utils/format-bytes.ts');
  const tti = fs.readFileSync(path.join(root, 'services/text-to-image.ts'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'services/llm-runtime-executorch.ts'), 'utf8');
  const imagine = fs.readFileSync(path.join(root, 'screens/imagine/index.tsx'), 'utf8');
  assert.match(formatBytes(10 * 1024 * 1024), /10 MB/);
  assert.match(transferLabel('SDXS 512 DreamShaper XNNPACK FP32', 82_000_000, 1_640_000_000, 0.05), /\/|%/);
  assert.match(tti, /download\(/);
  assert.match(tti, /AbortController/);
  const downloadFn = tti.slice(tti.indexOf('async function downloadUnlocked'), tti.indexOf('export async function downloadTextToImage'));
  assert.doesNotMatch(downloadFn, /releaseLlmSlot/);
  assert.doesNotMatch(downloadFn, /cacheSidecarFile/);
  assert.doesNotMatch(runtime, /cacheTokenizerSources/);
  assert.match(fs.readFileSync(path.join(root, 'services/model-storage.ts'), 'utf8'), /export async function cacheSidecarFile/);
  assert.match(runtime, /transferLabel/);
  assert.match(runtime, /isNetworkAbort/);
  assert.match(imagine, /formatBytes/);
  assert.match(imagine, /Save /);
});

test('free app memory lives on the activity sheet, not Settings', () => {
  const settings = fs.readFileSync(path.join(root, 'screens/settings/index.tsx'), 'utf8');
  const processing = fs.readFileSync(path.join(root, 'screens/processing/index.tsx'), 'utf8');
  assert.match(processing, /Free app memory/);
  assert.match(processing, /Native model slot/);
  assert.doesNotMatch(settings, /<AppText[^>]*>\s*Free app memory\s*<\/AppText>/);
  assert.match(settings, /title="Image generation"/);
  assert.match(settings, /tag="LLM"/);
  assert.match(settings, /tag="Image"/);
  assert.match(settings, /tagTone="image"/);
  assert.match(settings, /App resources/);
  assert.match(settings, /ImageModelPicker/);
  assert.match(settings, /title="Remove downloaded models"/);
  assert.doesNotMatch(settings, /push\('\/imagine'/);
});

test('executorch 0.10 uses the unified API for chat and image generation', () => {
  const pkg = require('../package.json');
  const runtime = fs.readFileSync(path.join(root, 'services/llm-runtime-executorch.ts'), 'utf8');
  const setup = fs.readFileSync(path.join(root, 'services/executorch-setup.ts'), 'utf8');
  const catalog = fs.readFileSync(path.join(root, 'services/model-catalog.ts'), 'utf8');
  const tti = fs.readFileSync(path.join(root, 'services/text-to-image.ts'), 'utf8');
  const persist = fs.readFileSync(path.join(root, 'services/settings-persist.ts'), 'utf8');
  const metro = fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8');
  assert.equal(pkg.dependencies['react-native-executorch'], '0.10.0');
  assert.ok(pkg.dependencies['react-native-blob-util']);
  assert.equal(pkg.dependencies['react-native-executorch-expo-resource-fetcher'], undefined);
  assert.ok(pkg['react-native-executorch'].features.includes('llm'));
  assert.ok(pkg['react-native-executorch'].features.includes('textToImage'));
  assert.doesNotMatch(runtime, /react-native-executorch\/legacy/);
  assert.doesNotMatch(runtime, /expo-resource-fetcher/);
  assert.match(runtime, /createLLMChatSession/);
  assert.match(runtime, /download\(/);
  assert.doesNotMatch(setup, /initExecutorch/);
  assert.match(catalog, /resolve\/v0\.10\.0/);
  assert.doesNotMatch(catalog, /resolve\/v0\.9\.0/);
  assert.match(tti, /createSdxsTextToImage/);
  assert.match(tti, /encodeRgbaPng/);
  assert.match(persist, /ttiVariantId/);
  assert.doesNotMatch(metro, /react-native-executorch\/legacy/);
  assert.doesNotMatch(metro, /expo-resource-fetcher/);
});

