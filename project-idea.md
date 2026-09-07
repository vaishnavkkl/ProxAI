# FinLife Assistant — Project Idea

On-device AI personal finance and life-event reminder app. Android first. Offline first. No cloud required.

This is the living product spec for this repo (Expo SDK 54). Implementation follows this file, [performance.md](performance.md), and the FinLife design-system user rule. Do not follow the original prompt’s React Native 0.74 / React Navigation / `react-native-sqlite-storage` stack.

---

## 1. Product

**Name:** FinLife Assistant

**Job:** Read SMS (Android) and imported email, extract transactions / events / subscriptions on-device, and show budgets, reminders, and spending insights — without sending raw messages to a server.

**Platforms**

- Android: SMS + email import + on-device LLM (development build).
- iOS (optional): email import only. No SMS.
- Web: UI shells only. Stub SMS, LLM, and background tasks.

**Language:** TypeScript, `strict` (already on).

---

## 2. Expo-mapped stack

Maximize Expo libraries. New Architecture and React Compiler stay enabled.

| Spec item | Use in this repo | Do not use |
|---|---|---|
| App / routing | Expo Router file routes. Five tabs via `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 54: standalone `Icon`, `Label`, `Badge`). `app/` is routes only; screen bodies in `screens/`. | React Navigation screens as the app shell, `@react-navigation/bottom-tabs` as the primary tab API |
| State | Zustand slices: `transaction-store`, `event-store`, `settings-store`, `ui-store` | Redux Toolkit unless a future need is proven |
| Database | `expo-sqlite` | `react-native-sqlite-storage`, `sqlite3` |
| Settings KV | `expo-sqlite` localStorage polyfill (`expo-sqlite/localStorage/install`) | `AsyncStorage` |
| Secrets | `expo-secure-store` | Plain files / AsyncStorage for keys |
| Notifications | `expo-notifications` | `react-native-push-notification` |
| Calendar / contacts | `expo-calendar`, `expo-contacts` after explanation UI | Unexplained permission prompts |
| Sheets / modals | Expo Router modal / form sheet + `@gorhom/bottom-sheet` | Home-grown full-screen overlays that remount tabs |
| Gestures / animation | `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` | JS-driven animation loops |
| Images / icons | `expo-image` (SF Symbols via `sf:` where useful) | `react-native` `Image` for heavy assets |
| Lists | FlashList (or virtualized FlatList) | `ScrollView` + `.map` for ledgers |
| Dates / validation | `date-fns`, `zod` | `moment`, unbounded `lodash` in render |
| Network (optional sync) | `fetch` + `@react-native-community/netinfo` | Axios |
| Background schedule | `expo-background-task`, `expo-task-manager` | `setInterval` while backgrounded |
| LLM | **ExecuTorch** (`react-native-executorch` 0.9 + Expo resource fetcher). Model: **Qwen2.5 0.5B quantized** (`models.llm.qwen2_5_0_5b()`), downloaded on first Refresh. Chosen over llama.rn for Expo SDK 54 / New Architecture / mid-range phones. Dev client required. | Ollama, cloud LLM, llama.rn as default, Expo Go, bundling Qwen 3 1.7B |
| SMS (Android) | Dev-client native module (e.g. `react-native-get-sms-android` or a small Expo module) | Reading SMS from Expo Go |
| Email import | `expo-document-picker` + local parsers; compose is optional | Uploading mail to a server |
| Permissions | `expo-sms` is send-only — do not use it for inbox read. Use `expo-calendar` / `expo-contacts` plus a custom SMS permission flow | `react-native-permissions` as the default; `expo-permissions` (removed) |

### LLM size and load

- Keep the **downloaded** model near **300MB**. Shipped choice: Qwen2.5 0.5B quantized (~200MB, XNNPACK). SmolLM2 135M is a fallback if a device is too tight on RAM.
- **Do not** ship Qwen 3 1.7B in the APK. Download on first Refresh via ExecuTorch’s Expo fetcher.
- Regex / bank parsers are the fast path. LLM only for unmatched batches (10–20 messages, one call).
- Off-peak windows: 6–9 AM, 12–1 PM, 8–10 PM, plus manual Refresh. Unload the model after the batch.

### SMS / Play Store risk

`READ_SMS` is a **restricted** Play permission. Default-SMS-handler policy may block Play distribution unless the app is the user’s SMS app. Document this in Settings → About. Ship an explanation screen, allow revoke without crashing (email/manual entry still work), and treat sideload / internal tracks as the likely Android path until policy is solved.

---

## 3. Information architecture

Bottom tabs (always these five, static):

1. **Home** — “Let’s organize your life today”, balance / upcoming / pending, category pills, task cards (drag-to-done, swipe-to-delete), Refresh (top-right), empty onboarding.
2. **Finance** — category pie, latest-first transactions, category + date filters, budget bars, budget alerts.
3. **Events** — month/week/day calendar, upcoming reminders, create event, smart reminder previews.
4. **Subscriptions** — grouped by status, estimated monthly cost, cancel (confirm), add manual.
5. **Settings** — offline status, LLM schedule, privacy, export/import, clear local data, About.

**Toasts**

- Info: “Processing SMS messages…” (indeterminate).
- Success: “Found 3 transactions, 2 exam reminders”.
- Error: “1 parsing error (retry)”.

Refresh status may use a bottom sheet / modal. Do not block the tab tree.

---

## 4. Modules

### A — Financial tracking

- Parse bank SMS: amount, merchant, date, category.
- Expenses by category; daily / weekly / monthly trends.
- Budget alerts at 80% (“You’ve spent 80% of your grocery budget”).
- Recurring-charge detection feeds Module C.

### B — Event detection and reminders

- Parse imported email for dates and types (exam, booking, appointment).
- Reminders: 7 days, 24 hours, 1 hour before.
- Dedup against `expo-calendar` when the user granted access.
- Manual create from the Events tab.

### C — Subscription hunter

- Scan for “confirm subscription”, “charge”, “renewal”.
- Aggregate active subscriptions and monthly cost.
- One-tap unsubscribe **suggestion** with confirmation (open browser / mailto; do not silently cancel).

### D — Spending insights

- Anomaly flags on unusual spend.
- On-device copy: “You spent 40% more on dining this month”.
- What-if: “How much can I save if I cut subscriptions?”

---

## 5. Offline, privacy, permissions

**Offline-first**

- All entities in `expo-sqlite`. Parsing and inference on-device.
- Optional cloud sync is user-controlled, AES-256, never raw SMS.
- Core flows work at 100% with the radio off.

**Permissions (Android)**

| Permission | Required? | When |
|---|---|---|
| SMS read (restricted) | For Module A from SMS | After explanation UI; app should be able to run without it |
| Internet | Optional sync / first model download | After user opts in |
| Contacts | Optional payee enrichment | After explanation |
| Calendar | Event dedup | After explanation |

Request with copy that explains why. Revoke must not break Home / manual entry / imported files.

**Data rules**

- Never log financial data or raw SMS.
- Never send raw SMS to a server.
- Optional analytics: anonymized category totals only, off by default.
- Export CSV + JSON. One-tap delete all local data.

---

## 6. Folder map

Keep the current Expo template root. **Do not** migrate to `src/`. `app/` stays routes-only. File names are kebab-case.

```
app/
  _layout.tsx
  modal.tsx
  (tabs)/
    _layout.tsx          # NativeTabs: Home, Finance, Events, Subscriptions, Settings
    index.tsx            # renders screens/home
    finance.tsx
    events.tsx
    subscriptions.tsx
    settings.tsx
screens/
  home/
  finance/
  events/
  subscriptions/
  settings/
components/              # shared UI (transaction-card, event-reminder, …)
services/                # sms, email, llm, database, notification
store/                   # zustand slices
styles/                  # colors, typography, spacing tokens
types/
utils/                   # bank-parsers, email-parsers, date-utils, category-mapping
hooks/
```

Route files only read params and render a screen. Colocate screen-private pieces under `screens/<name>/`. Shared components stay in `components/`.

---

## 7. Implementation phases

Build in this order after the docs exist. Each phase must meet [performance.md](performance.md) budgets.

### Phase 1 — Foundation

- Keep Expo Router; replace starter tabs with the five FinLife tabs (`NativeTabs`).
- Design tokens in `styles/` matching the design-system rule.
- `expo-sqlite` schema + Zustand slices + `ui-store`.
- Permission explanation UI (SMS last, after copy).
- TypeScript strict remains on.

### Phase 2 — SMS parsing

- Android inbox read via dev-client module.
- Bank regex in `utils/bank-parsers.ts` (5+ formats, then 10+ per bank in tests).
- Extract amount, merchant, date; persist; skip cached hashes.

### Phase 3 — LLM

- Dev client + `react-native-executorch` (or `llama.rn`).
- Download a ≤ ~300MB quantized model on first use.
- Batch unmatched messages; Zod-validate JSON; hash cache.
- Off-peak scheduler + Refresh.

### Phase 4 — UI screens

- Home, Finance, Events, Subscriptions, Settings per section 3.
- Refresh / processing sheet and toasts.
- FlashList for all ledgers.

### Phase 5 — Features

- Smart reminders (background).
- Budget alerts, anomaly detection, what-if calculator.
- CSV / JSON export.

### Phase 6 — Polish

- Offline indicator, retry, loading states, a11y, profiling.
- Privacy policy + terms. About calls out SMS Play policy.

---

## 8. Testing

**Unit:** bank parsers (10+ formats per bank), email date/keyword detection, category mapping (every tx has a category), budget math, date utils.

**Integration:** SMS → parse → SQLite; LLM batch → Zod; CRUD; notification schedule.

**E2E (later):** grant SMS → import → see transactions; create event → reminder fires; mark subscription cancelled → removed.

**Performance:** batch of 20 messages; memory after repeated Refresh; background battery. Budgets are in [performance.md](performance.md).

---

## 9. Do not use

- Axios
- AsyncStorage
- `react-native-push-notification`
- `react-native-sqlite-storage`
- Cloud or Ollama-hosted LLM for default parsing
- Per-message LLM calls
- Logging raw SMS, bodies, or amounts
- `ScrollView` + `.map` for transactions / events / subscriptions / tasks
- Full-store Zustand subscriptions
- Bundling a >300MB model into the APK
- Restructuring the repo into `src/` “because the default Expo skill says so”

---

## 10. Agent pointers

| Topic | Source |
|---|---|
| Product and stack | This file |
| Re-renders, LLM, SQLite, lists | [performance.md](performance.md) and `.cursor/rules/performance.mdc` |
| Color, type, space, components | FinLife design-system user rule |
| Routes / tabs / sheets | `expo-router` skill (SDK 54 NativeTabs import style) |
| SQLite / storage | `expo-native-ui` skill → storage |
| Offline / fetch | `expo-data-fetching` skill |
| Expo version | [docs.expo.dev/versions/v54.0.0](https://docs.expo.dev/versions/v54.0.0/) |
