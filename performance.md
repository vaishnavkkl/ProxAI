# FinLife Assistant — Performance Contract

Read this before changing lists, Zustand stores, SQLite, background tasks, or on-device LLM code.

This app runs an on-device model on mid-range Android. A single extra re-render during inference, a `ScrollView` of transactions, or a per-message LLM call will blow the memory and battery budgets.

Style, color, and spacing live in the FinLife design-system rule. This file is only about **speed, memory, battery, and re-renders**.

---

## 1. Hard budgets

| Surface | Budget | How we stay under it |
|---|---|---|
| Home first paint | < 1s | Indexed SQLite, no LLM on launch, no chart on Home |
| Financial calculations | < 500ms | Pre-aggregate in SQLite / Zustand; never reduce the full ledger on every render |
| SMS / email batch | < 30s for 10–20 messages | Regex first; one LLM call per batch; hash-cache |
| Idle RAM | < 150MB | Unload the model after the window; no leaked listeners |
| Inference RAM | < 300MB | Small quantized model (≤ ~300MB download); single loaded context |
| Battery (background) | < 5% / day | Off-peak windows only; no polling timers |
| Database queries | < 100ms | Indexes on `hash`, `date`, `category`, `status`; no `SELECT *` on Home |

If a change cannot meet a budget, do not ship it. Profile first (`npx expo start`, React DevTools, Android Studio Memory Profiler).

---

## 2. Expo SDK 54 — do not fight the stack

This repo is Expo SDK 54, React 19, React Native 0.81, New Architecture on, React Compiler on (`app.json` → `experiments.reactCompiler`).

- **React Compiler memoizes for you.** Do not add `useMemo`, `useCallback`, or `React.memo` by default. Add them only when DevTools shows a hot path the compiler skipped (native module callbacks, Reanimated worklets that close over changing values, or a third-party list that compares props by reference).
- **New Architecture / JSI / Fabric** is the default. Prefer TurboModule-friendly libs. Do not disable `newArchEnabled`.
- **Prefer Expo libraries:** `expo-sqlite`, `expo-image`, `expo-notifications`, `expo-file-system`, `expo-background-task`, `expo-task-manager`, `expo-secure-store`, `react-native-reanimated` + `react-native-worklets`.
- **Never use:** `AsyncStorage`, Axios, `react-native` `SafeAreaView`, `expo-av`, `react-native-push-notification`, `react-native-sqlite-storage`.
- File names are **kebab-case**. Colocate `StyleSheet.create` at the **bottom** of the component file.
- `process.env.EXPO_OS` instead of `Platform.OS` when choosing platform behavior.
- LLM and SMS native modules require a **development build**. Expo Go cannot run them.

---

## 3. Re-render rules

The UI thread must stay free while the model runs. Treat every subscription as a cost.

### 3.1 Zustand — selector slices only

Never subscribe to an entire store. Split **data** stores from a tiny **UI** store. LLM progress, toasts, and the Refresh spinner live only in `uiStore`.

```ts
// BAD — every token / progress tick re-renders Home, Finance, and every card
const { transactions, progress, toast } = useUiStore();
const everything = useTransactionStore();

// GOOD — one field, one reason to re-render
const transactions = useTransactionStore((s) => s.transactions);
const progress = useUiStore((s) => s.llmProgress);
const showToast = useUiStore((s) => s.showToast);
```

Use `shallow` (or multiple hooks) when a component needs two primitives. Do not return a new object from a selector.

```ts
// BAD — new object every time → always re-render
const { income, expense } = useFinanceStore((s) => ({
  income: s.income,
  expense: s.expense,
}));

// GOOD
const income = useFinanceStore((s) => s.income);
const expense = useFinanceStore((s) => s.expense);
```

Keep actions stable: define them inside `create()` so they are not recreated. Screens call actions; they do not pass new lambdas into list rows.

### 3.2 Isolate LLM progress from lists

```ts
// store/ui-store.ts — the only store allowed to change during inference
type UiState = {
  llmProgress: number; // 0–1, updated at most every 250ms
  llmLabel: string;
  toast: { kind: 'info' | 'success' | 'error'; message: string } | null;
};

// BAD — writing parsed transactions into the list store on every message
useTransactionStore.getState().add(tx); // inside the LLM token loop

// GOOD — accumulate in the service, commit once per batch
const parsed = await llmService.processBatch(messages);
await databaseService.insertTransactions(parsed);
useTransactionStore.getState().replaceMany(parsed);
useUiStore.getState().setToast({
  kind: 'success',
  message: `Found ${parsed.length} transactions`,
});
```

Home / Finance lists subscribe to `transactions`, not `llmProgress`. The Refresh modal / toast subscribes to `uiStore` only.

### 3.3 Lists

- Transactions, events, subscriptions, and tasks: **`FlashList`** (or `FlatList` with `keyExtractor`, a stable `renderItem`, and `getItemLayout` when row height is fixed).
- **Never** `ScrollView` + `.map()` for those collections.
- Fixed row heights from the design system (transaction card ≈ content + 16px padding). Pass `estimatedItemSize` / `getItemLayout`.
- `keyExtractor` uses the SQLite `id` (string), never the array index.
- Do not put the chart, calendar, or what-if calculator inside the same list virtualization window as the rows.

```tsx
// BAD
<ScrollView>
  {transactions.map((tx) => (
    <TransactionCard key={tx.id} transaction={tx} onPress={() => open(tx.id)} />
  ))}
</ScrollView>

// GOOD
<FlashList
  data={transactions}
  keyExtractor={keyExtractor}
  renderItem={renderTransaction}
  estimatedItemSize={88}
  extraData={undefined}
/>
```

`keyExtractor` and `renderItem` are module-level functions or store actions — not inline closures that close over changing screen state. If the row needs navigation, pass an `id` and read params in the route.

### 3.4 Expensive widgets

- Home: summary numbers + task list only. No pie chart.
- Finance chart, Events calendar, and what-if calculator: load with the screen, not at app boot. Prefer a deferred child so the tab chrome paints first.
- Images: `expo-image` only (`recyclingKey`, explicit `style` width/height). Never `Image` from `react-native` for remote or large assets.

### 3.5 Props and styles

- No new object / array literals in JSX props on **list rows** (`style={{ margin: 8 }}`, `contentContainerStyle={[styles.foo, { padding }]}`).
- `StyleSheet.create` at the bottom of the file.
- Touch targets stay ≥ 48×48 per the design system; that is not a reason to add extra wrappers that remount on parent render.

---

## 4. LLM and battery

### 4.1 Where inference runs

- Native module only: **`react-native-executorch`** (preferred, Expo resource fetcher) or **`llama.rn`**.
- Development build required. Never Expo Go. Never a JS-thread / WASM fallback in production.
- One loaded model at a time. Unload when the off-peak window or manual Refresh batch finishes.
- Target a quantized model that stays near the 300MB download budget (SmolLM2 360M or Qwen 0.5B-class Q4). **Do not bundle Qwen 3 1.7B in the APK.** Download on first use via `expo-file-system`.

### 4.2 Scheduling

Run inference only in these windows, plus an explicit user Refresh:

- 06:00–09:00
- 12:00–13:00
- 20:00–22:00

Background cadence is 2–3 hours **and** inside a window (user-configurable). Implement with `expo-background-task` / `expo-task-manager`, not `setInterval`.

### 4.3 Batch, cache, fast path

1. Collect 10–20 new messages (SMS and/or email).
2. Hash each raw body (`sha256(sender + date + body)`). Skip rows already in `processed_messages`.
3. Run **regex / bank parsers first**. Only send unmatched messages to the LLM.
4. One LLM call per batch, structured JSON out, Zod-validate, then one SQLite transaction.
5. Never re-process a cached hash. Never call the model once per message.

```ts
// BAD
for (const sms of inbox) {
  const json = await llm.complete(sms.body);
  await db.insert(json);
}

// GOOD
const fresh = inbox.filter((m) => !cache.has(hashOf(m)));
const { parsed, unmatched } = bankParsers.parseMany(fresh);
const llmJson = unmatched.length
  ? await llmService.completeBatch(unmatched)
  : [];
await db.withTransactionAsync(async () => {
  await db.insertAll([...parsed, ...llmJson]);
  await db.markProcessed(fresh.map(hashOf));
});
```

### 4.4 Progress UI

- Throttle `uiStore.llmProgress` to **≤ 4 updates / second** (250ms).
- Do not stream tokens into React state.
- Toast copy is a summary only (`Found 3 transactions, 1 exam reminder`). Never put raw SMS or amounts in logs or toasts that might be captured.

### 4.5 JS thread hygiene

- Do not `JSON.parse` multi-megabyte payloads on the UI thread during scroll.
- Heavy date / category reductions belong in the service layer or a SQLite `VIEW`, not in the component body.
- Reanimated animations use worklets. Do not animate from JS on every progress tick.

---

## 5. Data and I/O

### 5.1 SQLite (`expo-sqlite`)

- Open once (`SQLite.openDatabaseAsync`). Reuse the handle.
- Index `processed_messages.hash`, `transactions.date`, `transactions.category`, `events.starts_at`, `subscriptions.status`.
- Home queries project columns (`id, title, amount, category, date`) — never `SELECT *`.
- Batch writes in `withTransactionAsync`.
- Encrypt at rest when SQLCipher / `expo-sqlite` encryption is wired; until then treat the file as sensitive (no backups of raw SMS).

```ts
// BAD
const rows = await db.getAllAsync('SELECT * FROM transactions');
const monthTotal = rows
  .filter((r) => r.date.startsWith(month))
  .reduce((sum, r) => sum + r.amount, 0);

// GOOD
const row = await db.getFirstAsync<{ total: number }>(
  `SELECT COALESCE(SUM(amount), 0) AS total
   FROM transactions
   WHERE date >= ? AND date < ? AND type = 'expense'`,
  [start, end],
);
```

### 5.2 Settings and secrets

- Settings / schedule / onboarding flags: `expo-sqlite` **localStorage polyfill** (`import "expo-sqlite/localStorage/install"`).
- Tokens and encryption keys: `expo-secure-store`.
- Never `AsyncStorage`.

### 5.3 Network

- Offline is the default. Optional cloud sync is user-gated, AES-256, never raw SMS.
- Use `fetch` (not Axios). Pass `AbortController` and cancel on unmount.
- Check connectivity with `@react-native-community/netinfo` only when the user opted into sync.

### 5.4 Background work

- `expo-background-task` + `expo-task-manager` for the 2–3h scan.
- After the task: schedule notifications with `expo-notifications`.
- Do not keep a JS timer alive while the app is backgrounded.

---

## 6. Navigation and screen cost

- Expo Router: `app/` is **routes only**. Screen bodies live in `screens/<name>/`.
- Five tabs via `NativeTabs` (`expo-router/unstable-native-tabs`, SDK 54 `Icon` / `Label` imports). Tabs are static — do not add/remove triggers at runtime.
- Lazy by default: a tab that has never been visited must not mount its chart or calendar.
- Modals and Refresh status use Expo Router modal / form sheet or `@gorhom/bottom-sheet` — not a full-screen view that remounts the tab tree.

---

## 7. Accessibility vs performance

Meet the design-system a11y rules (48px targets, contrast, labels) without extra re-renders:

- Static `accessibilityLabel` strings, not recreated objects.
- Do not wrap every row in an extra `Pressable` + `View` just for a11y; set labels on the row root.

---

## 8. Checklist before merging UI or LLM work

- [ ] No full-store Zustand subscriptions
- [ ] LLM progress is not wired into list stores
- [ ] Lists use FlashList / virtualized FlatList
- [ ] No `useMemo` / `useCallback` / `React.memo` added “just in case”
- [ ] Home query is indexed and projected
- [ ] Batch + hash cache; regex before LLM
- [ ] Model unloaded after the window
- [ ] No raw SMS / amounts in logs
- [ ] Development-build-only native modules not imported from web/Expo Go paths without a stub
