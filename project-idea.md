# ProxAI — Project Idea

An on-device everyday assistant that turns messages into useful actions, journeys, deliveries, reminders, and security reviews. Android first. Offline first. No cloud required for core organization.

This living product spec replaces the finance-first **FinLife Assistant** direction with the broader ProxAI idea. Keep existing finance and other working features; extend the app around everyday needs rather than making finance tracking its main purpose.

See [LIFE-FEATURES.md](LIFE-FEATURES.md) for the current feature walkthrough and platform setup. Engineering must also follow [performance.md](performance.md) and the existing design tokens. Read the exact [Expo SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/) before writing code.

---

## 1. Product vision

**Name:** ProxAI

**Job:** Help people answer “What needs my attention?” by extracting useful information from messages and device calendars, organizing it locally, and making the next action easy.

Banking applications already cover much of transaction tracking. ProxAI's primary value is connecting the other important things scattered across messages: a form to submit, a bus to catch, a parcel to receive, a bill to pay, an appointment to attend, or a suspicious message to review.

**Core combination:** Action Tracker + Events + Travel + Deliveries + Finance + Security.

Finance remains a complete supporting capability: preserve the existing ledger, bank filters, budgeting, salary and fixed-expense planning, subscription tools, insights, and money coach. No existing functionality should be removed to accommodate the new modules.

**Product principles**

- Start with today's priorities and upcoming commitments.
- Turn message details into useful cards, not just category labels.
- Keep original-message context available for verification.
- Let users correct titles/dates, complete items, dismiss alerts, and reopen items.
- Support manual tasks and screenshot extraction without inbox access or a downloaded model.
- Preserve saved data and user corrections across restarts, rescans, and parser upgrades.
- Leave missing or uncertain information unset; never invent a deadline, amount, or booking reference.

## 2. Sources and platforms

| Source / platform | Current scope | Future scope |
|---|---|---|
| Android SMS | Read the selected inbox range after permission using the existing native module in a development build | Broader message-format coverage and device validation |
| Pasted messages | Review locally extracted items before saving; use the message's receipt date for relative dates | Richer review workflows |
| Manual entry | Tasks with optional due dates and times | Dedicated creation forms for other modules |
| Device calendars | Upcoming events, including Gmail-derived events already synced to the calendar | Better update reconciliation and duplicate detection |
| Installed subscription apps | Known package checks and app-specific deep-link resolution; discovered services have Open and Add my plan actions | More provider integrations with actual renewal evidence |
| Android screenshots | Bundled offline Latin OCR for a selected capture month; current-month new images included in Refresh after opt-in; local image hash cache and source preview | Malayalam OCR after model and device evaluation; richer screenshot interpretation |
| Imported email files | Planned; separate from calendar import | Local file import and parsing with explicit user choice |
| iOS | manual tasks and screenshot extraction; supported native calendar access | Broader local imports; no automatic SMS inbox access |
| Web | Manual organizer and structured plan entry with SQLite web configuration; native SMS and LLM are unavailable | Further browser validation and hosting support |

There is currently no direct Gmail mailbox integration. Do not describe synced calendar information as full email access.

An HTTP 200 from a public OTT website does not establish a subscription. App discovery, confirmed renewals and unknown plan details stay distinct. Email notices are read from saved screenshots; no copying or pasting is required. Direct mailbox access is not implemented.

### Scan consistency and mobile AI

SMS pagination sorts and advances by the same ID. Scans process bounded pages and 12-message AI batches without the former 48-message AI limit. Clear parser results are retained; optional AI does not override them. Extraction uses greedy decoding, strict complete JSON, source attribution and cached decisions keyed by source, model and parser revision. Failed batches retry; receipt/capture timestamps anchor relative dates. Full database clearing also removes OCR text and model-decision caches.

Screenshot OCR reads one image at a time from Screenshot-named folders, records original image provenance, avoids duplicate imports of identical files and shows only images containing useful extracted details. This feature is Android-only, requires photo permission, and currently recognizes English/Latin rather than Malayalam. It runs on manual scan/Refresh; an automatic background folder watcher is not implemented.

The existing Qwen2.5 0.5B default remains; LFM2.5 350M is an extraction candidate and Qwen3.5 0.8B is an optional advanced text model. The model picker shows verified download sizes and license labels, not unmeasured low-RAM promises. Larger models require device evaluation before production use. See [current mobile AI research and implementation decisions](docs/mobile-ai-research.md).

## 3. Modules

### Primary modules

| Module | Information to extract | Example | Useful outcome |
|---|---|---|---|
| **Action Tracker** | Tasks, promises, required actions, deadlines | “Submit documents before Sept 12” | Editable task, due date, completion state, reminder action |
| **Events & Appointments** | Exams, meetings, interviews, doctor/service appointments, dates, times, locations | “Appointment confirmed Monday 3 PM” | Event card and calendar-reminder action |
| **Travel Hub** | Flight/train/bus bookings, PNR, hotels, journey dates, departure times, routes | “Train 12627 departs tomorrow at 7:40 PM” | Journey card with booking details and original message |
| **Delivery Tracker** | Orders, merchants/carriers, tracking references, expected dates, delivery updates | “Amazon package arriving tomorrow” | Delivery card reflecting newer matched updates |
| **Finance & Bills** | Actual debits/credits, amounts, merchants, bill providers, payment deadlines | “Credit card ₹4,250 due tomorrow” | Payment reminder alongside the existing finance tools |
| **Security Review** | Account threats, suspicious payment/KYC requests, secret-code requests, risky installation prompts | “Your bank account will be blocked. Update KYC immediately…” | Possible-risk card explaining the indicators for user review |

### Supporting modules

| Module | Information to extract | Example | Useful outcome |
|---|---|---|---|
| **Subscription / Renewal Manager** | Memberships, renewals, recurring charges, next billing dates | “Spotify renews Sunday” | Renewal card and existing subscription management |
| **Document Expiry Tracker** | Insurance/policy expiry, licences, passports, FASTag, recharge validity | “Insurance expires Oct 5” | Expiry reminder with an editable date |
| **Purchase Assistant** | Purchases, warranty dates, return windows | “Return available until Sep 18” | Card for the next purchase-related deadline |
| **Daily Digest** | Today's items, tomorrow's commitments, overdue actions, security reviews | “2 payments, 1 delivery, 2 tasks tomorrow” | Concise overview generated from saved information |

These describe intended coverage. Current parsers cover common formats; broader language, merchant, and message-format support remains ongoing work.

### Behavioral requirements

- **Actions:** Completion removes a task from the active agenda. Users can reopen it from history. Unclear deadlines appear under “Date needed.”
- **Events and travel:** Preserve available timing, references, routes, and source context. A booking price is not automatically a bank transaction. Calendar reminders require an explicit user action.
- **Deliveries:** Match updates using sender and tracking/order reference when available. Older messages must not overwrite newer delivery information. Delivered or cancelled items belong in history. Do not merge unrelated orders solely because they share a merchant.
- **Finance:** Separate actual money movement from requests to pay. Credit-card due notices become bills, not new expenses. Preserve bank debits, salary credits, balance filtering, and duplicate-payment handling. A message containing both a renewal and a genuine debit can produce both items.
- **Security:** Check suspicious messages before spam filtering. Explain possible risk without claiming a verified scam. Routine OTPs and “do not share your code” warnings should not automatically become alerts. Keep suspicious links as plain text; never open them automatically. Dismissal is a user review action, not proof of safety.
- **Subscriptions and purchases:** Distinguish installed apps from confirmed subscriptions. Never invent charges, renewal dates, warranty terms, or return windows. Unsubscribe suggestions and cancellations remain user-controlled.
- **Digest:** Summarize saved information without fabricating activity. The current digest uses counts and agenda groups; richer on-device narrative summaries are future work.

## 4. Home and navigation

Home leads with life organization. Finance summaries remain accessible beneath the agenda and through the Finance tab.

Illustrative content, not preloaded user data:

```text
Good morning 👋

TODAY
🚌 Bus at 8:30 AM
📦 Amazon delivery today
📋 Submit college form by 5 PM

TOMORROW
💳 Credit card ₹4,250 due

IMPORTANT
⚠️ Possible phishing SMS detected — review indicators

UPCOMING THIS WEEK
✈️ Flight to Bengaluru — Friday
🔁 Spotify renewal — Sunday

RECENT FINANCE
💰 Salary received — ₹42,000
```

The current agenda groups items into **Important, Overdue, Today, Tomorrow, Next 7 days, Later, Date needed, History, and Completed**. Module filters and search let users focus on one area. History and completed items remain available without crowding today's view.

**Home actions:** Refresh scans the configured sources; **+** opens optional task entry; opening a card shows source details, corrections, and completion/dismissal controls; **Add calendar reminder** opens the native calendar editor.

Retain the existing five tabs:

1. **Home:** Agenda, digest, module filters, manual capture, scan controls, existing finance shortcuts.
2. **Finance:** Transactions, account/category filters, analysis, budgeting, and planning tools.
3. **Events:** Existing events and calendar import, including saved title/date corrections.
4. **Subscriptions:** Existing discovered apps and extracted renewals, including saved corrections.
5. **Settings:** Existing model, schedule, scan-range, privacy, resource, and local-data controls.

Keep the money coach and processing/resource views. New modules do not need a tab each. Preserve established navigation unless a separate navigation change is agreed.

## 5. Message-to-action pipeline

1. Collect messages from authorized sources, retaining source identifiers and receipt times.
2. Hash messages and skip previously handled content and duplicates within the scan.
3. Check possible security risks before ordinary spam and credit-card-copy filtering.
4. Use deterministic life and bank parsers for common formats.
5. Send suitable unmatched messages to the existing small on-device LLM in batches; validate structured output with Zod.
6. Match model results to exact source identifiers, never their returned array positions. One source may produce multiple useful facts.
7. Save extracted items and processed-message records transactionally in SQLite. Commit list-store updates after processing, not on every model token.
8. Build the agenda from saved items, user corrections, completion states, and the current local date.

**Shared information:** Type, title/merchant, optional amount, optional date/time, category, review/note, source identifier/context, and available reference/location/status details.

**Current item types:** `transaction`, `event`, `subscription`, `action`, `travel`, `delivery`, `bill`, `security`, `document`, and `purchase`.

**Dates:** Resolve “tomorrow” and weekdays against receipt time, not the day an old message is scanned. Preserve the correct local day for date-only values. Reject invalid dates and leave uncertain deadlines unset. Allow user corrections.

**Persistence:** Keep user corrections and completion/dismissal states separate from extraction results. Rescans must not silently reset them. Parser upgrades must preserve existing ledger and organizer data.

## 6. Reminders and follow-through

**Current:** Users choose **Add calendar reminder** on a dated item. ProxAI opens the native calendar editor with a reminder request 15 minutes before the event. The user saves it there, and the calendar app controls delivery. ProxAI does not currently schedule automatic background notifications for every extracted item.

**Planned:** Configurable local notifications for tasks, trips, deliveries, bills, expiry, and appointments. Offer suitable presets such as seven days, 24 hours, or one hour before. Add snooze, rescheduling, and cancellation reconciliation before calling automatic reminders complete.

Use Expo notification/background APIs for this phase. Respect permissions, user preferences, OS scheduling limits, and battery budgets. Manual organization must remain useful with notifications disabled.

## 7. Technical direction

Preserve Expo SDK 54, TypeScript strict mode, New Architecture, React Compiler, and the existing design system. Product expansion is not a stack rewrite.

| Area | Direction |
|---|---|
| Routing | Expo Router; routes in `app/`, screen bodies in `screens/`; retain the current five-tab shell |
| State | Zustand slices for transactions, events, subscriptions, life items/user states, budgets, settings, and UI progress |
| Database | Existing `expo-sqlite`, additive migrations, parameterized queries, transactional writes |
| Settings | Existing SQLite-backed persistence |
| Local AI | Existing ExecuTorch runtime, model catalog, download controls, and Expo resource fetcher; native development build required |
| Parsing | Bank/life/security rules, shared date handling, Zod-validated model output |
| Calendar | Existing native integration and `expo-calendar` |
| Lists | Virtualized FlatList/FlashList with stable IDs; never mount an entire message history in a ScrollView |
| UI | Existing `styles/` tokens, icons, gestures, and Reanimated integration |
| Web | Native-AI setup/runtime stubs and SQLite WebAssembly configuration; required isolation headers on hosting |
| Future reminders | `expo-notifications`; `expo-background-task` / `expo-task-manager` for appropriate background work |
| Future email import | Local document import and parsing; no raw-email upload by default |
| Future secrets / sync | Secure storage for keys/tokens and explicit opt-in before sync |

Use existing model selection rather than hard-coding a new model or a download-size claim into the product spec. Regex-first parsing, batched inference, model unloading, and performance targets remain governed by [performance.md](performance.md). Core organization must work without a downloaded model.

Keep the root layout: `app/`, `screens/`, `components/`, `services/`, `store/`, `styles/`, `types/`, `utils/`, `hooks/`, and `modules/`. Use kebab-case file names. Do not migrate the repository into `src/`.

Retain the original constraints against Axios, AsyncStorage, legacy SQLite/notification libraries, cloud or Ollama-hosted default parsing, per-message LLM calls, full-store Zustand subscriptions, and large models bundled into the APK.

## 8. Offline, privacy, and permissions

- Process and store organizer information on-device. Never send raw SMS to a server or log real message bodies and financial amounts.
- Explain SMS/calendar access in terms of everyday organization, not only finance.
- Keep structured manual entry usable when inbox access is unavailable or revoked.
- Treat stored messages and references as sensitive. Do not claim encryption at rest unless configured and verified.
- Model downloads require connectivity; local parsing and downloaded-model inference should work offline.
- Retain local-data reset controls and clearly explain what they remove, including the distinction between budget and organizer data.
- CSV/JSON export and import remain roadmap items. Define whether source text is included and require deliberate user choice.
- Contacts enrichment, optional analytics, and cloud sync remain optional future work, not core dependencies. Any sync design must define encryption and exclude raw-message upload by default.
- Review applicable SMS-distribution requirements before a store release; a working development build does not establish distribution eligibility.

## 9. Delivery roadmap

### Existing capabilities to preserve

Finance parsing and ledger views; bank filters; budgeting and fixed expenses; salary/EMI planning; money coach; calendar import; subscription discovery; model selection/download controls; scan settings; processing/resource views; local-data controls.

### Implemented expansion

- Life-item extraction/storage alongside the existing ledger.
- Daily agenda/digest, module filters, search, virtualized cards, manual tasks, and screenshot extraction.
- Editable titles/dates, completion/dismissal, and reopening history.
- Delivery updates by sender/reference, possible-risk review, and calendar-reminder creation.
- Persistence of source context and user corrections; rescans that preserve saved data.

Implementation does not mean every native flow has been verified on a phone. Device SMS permissions, local-model inference, calendar reminders, and performance still require native validation.

### Next: reliability and real-device validation

- Exercise scan → extraction → save → agenda → correction → restart.
- Expand tests for action, travel, delivery, renewal, bill, and security formats.
- Improve update/cancellation reconciliation and cross-source duplicate handling.
- Validate timezone boundaries, missing dates, ambiguous messages, and denied permissions.
- Profile large histories, repeated scans, inference memory, and battery usage.

### Then: automatic assistance

- Configurable local reminders, snooze, background scheduling, richer daily summaries.
- Dedicated manual forms and richer travel, delivery, document, and purchase details.
- Local email-file import and additional user-authorized sources.

### Retained finance and product roadmap

Keep the original goals of category budget alerts (including an 80% threshold), unusual-spending detection, daily/weekly/monthly trends, subscription cost summaries, unsubscribe suggestions with confirmation, and what-if planning. Extend current implementations where available; do not claim unimplemented alerts or automatic cancellation.

Retain future event calendar views, data export/import, accessibility polish, offline/retry states, and release documentation. These complement the broader assistant rather than displacing everyday actions and commitments.

## 10. Validation and success criteria

**Automated:** Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and relevant platform exports. Cover suggested message examples, preserved bank/card behavior, source attribution, date handling, agenda grouping, delivery updates, persistence, and resets.

**Device:** Scan with permission granted and denied; test the downloaded model; save a calendar reminder; complete/reopen tasks; restart/rescan; confirm existing finance and subscription flows. Follow the current smoke-test steps in [LIFE-FEATURES.md](LIFE-FEATURES.md).

**Success:** Users can quickly see what needs attention, find the original evidence, correct a mistake, and take the next action. Measure useful items recovered, extraction corrections, missed deadlines, security false positives, duplicate cards, and persistence failures—not only the number of financial transactions parsed.

The defining experience is **“My messages became an organized day.”** Finance is one valuable part, alongside actions, events, travel, deliveries, and security.

## Latest product refinements

Home gives Screenshot Intelligence a prominent card above the daily brief. It shows concise, deduplicated information and up to six highlights; transaction history lives in Finance. Optional task/renewal entry remains, while pasted-message entry and Settings copy actions are removed. Original evidence is available only when a user opens Source in item details.

Settings uses a different icon for each option. Events uses month sections and personal/holiday filters, imports the next twelve months, and includes offline Kerala/India observances including Christmas. Year-specific festival dates come from the Kerala government calendar; unverified future lunar dates are not invented.

Renewals displays actual installed-app icons with bundled public publisher icons for common services. App detection does not imply a paid plan. Finance labels credits/debits explicitly, offers direction filters, shows dates/accounts/references, and counts repeated transfer references once. Credit-card, Swiggy and Zomato transactions remain excluded at the user's request; other banking functionality is retained.
