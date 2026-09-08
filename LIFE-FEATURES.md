# ProxAI everyday organizer

Home starts with a gradient daily summary and up to six important items, balancing security reviews, recent overdue deadlines, and upcoming plans. **All items** opens the full organizer, filters, search, history, and finance insights. Existing finance, bank filters, budgeting, money coach, calendar imports, subscription app discovery, and settings remain available.

## Use it

- Tap **Refresh** to scan the configured SMS range and device calendars. The parser update rechecks existing messages without clearing saved data.
- Tap **Add** for an optional task or renewal with structured fields. Screenshot Intelligence on Home extracts useful information without copying messages.
- Use module filters and search to browse the agenda. Unknown deadlines appear under **Date needed**.
- Open a card to see its original message, reference, route, and extracted date. Correct its title/date, mark it complete, or dismiss a security alert after review. Reopen items from **history and completed**.
- **Add calendar reminder** opens the phone's calendar editor with a reminder request 15 minutes before the event. Save it there; the calendar app controls reminder delivery. ProxAI does not automatically schedule background notifications.
- Delivery updates with the same sender and reference update one card. Older messages cannot replace a newer delivery status. Delivered and cancelled items appear in history.

All organizer data and corrections persist in local SQLite. Security alerts identify possible risk patterns; they are not verified scam verdicts. Suspicious links remain plain text. Deterministic parsing works without a downloaded model; the existing local LLM handles additional unmatched SMS when available.

## Events and renewals

- Events show upcoming personal plans and a conservative selection of Kerala and India holidays. Unrelated holiday feeds, promotional invitations, completed events, duplicates, and past events are filtered. Personal appointments and confirmed bookings remain visible outside Kerala. Holidays show as all-day events. Calendar imports cover twelve months. A small offline calendar of verified Kerala/India observances includes Christmas even without calendar permission. Year-specific festivals are not guessed for future years.
- Renewals need a renewal/activation notice or manual confirmation. A service name or installed app alone is not enough. Missing dates remain unknown; payment receipt dates are not used as renewal dates. Newer notices replace older notices for a service, and cancellation notices suppress that service's renewal.
- Supported notice names include JioHotstar, SonyLIV, Sun NXT, ManoramaMAX, Saina Play and other major services. **Add renewal** supports any service. Saved email screenshots can supply renewal details without connecting or uploading the mailbox.
- **Installed apps** is a separate, collapsible list with unknown subscription status. **Add my plan** lets the user confirm a plan. Android package visibility is declared in the local module manifest; rebuild the native app after catalog/manifest changes.
- Forms in Settings, manual capture, item details and the finance plan use keyboard avoidance. Settings expansion headers show **Edit/Close**, directional icons, and a highlighted open panel.

## Platform requirements

Automatic inbox access requires an Android development build and SMS permission. iOS and web can use manual task and renewal entry; calendars require a supported native build. Calendar imports include Gmail-derived events already synced to the device, not direct Gmail mailbox access. No sample messages are substituted when the native inbox is unavailable.

The app uses Expo SDK 54. The implementation follows its versioned [SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) and [Calendar](https://docs.expo.dev/versions/v54.0.0/sdk/calendar/) APIs.

Metro is configured for SQLite's WebAssembly worker on web. When hosting a web export, also serve `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers; otherwise browser persistence will not work.

## Verification

Use Node 22.13+ (Node 24 recommended for the regression runner's built-in SQLite adapter):

```sh
npm test
npx tsc --noEmit
npm run lint
npx expo export --platform android --output-dir dist/life-android-check --max-workers 2
```

The tests exercise the production parsers and SQL through Node's in-memory SQLite adapter. Device SMS permissions, model inference, and calendar UI still require a native smoke test:

1. Launch with `npm run android`, allow SMS/calendar access, and refresh.
2. Verify all modules and existing finance screens against your messages.
3. Add a task, correct its deadline, complete it, restart, and reopen it from history.
4. Open a dated item, add a calendar reminder, save it in the native editor, and confirm it in the calendar app.

## Screenshot OCR and repeatable scans

Open **Screenshot Intelligence** on Home, or the screenshot shortcut in Renewals. Choose a month and scan the Screenshot-named folders after granting photo access. Enable Include in Refresh to check new screenshots from the current month. OCR is bundled, offline and Android-only. English/Latin is supported; Malayalam is not. Only screenshots with useful extracted items appear in the results; recognized items retain image and text provenance. Duplicate image bytes share cached OCR and item IDs, while unreadable images retry on the next scan. Full Clear database deletes OCR text and model-decision caches as well.

SMS now pages consistently by ID, processes all pages in bounded batches, preserves reliable parser hits, uses greedy AI extraction, requires complete valid JSON, and caches valid decisions including empty results. It no longer silently caps AI at 48 messages or substitutes sample data when native SMS is unavailable. A failed AI batch stays pending.

Discovered OTT/music apps resolve supported links within their specific Android packages. Renewals has Open app and Add my plan actions, and a modern collapsible discovery section. Public HTTP success never creates a fictional renewal.

The model picker includes optional Qwen3.5 0.8B, accurate official export sizes, license labels and a free-memory check for large models. No automatic model download or model switch occurs. See [mobile AI research](docs/mobile-ai-research.md) for comparison, limitations and the remaining device benchmarking work.

## Information-first display

Repeated notice bodies, matching bill/account/due-date reminders and repeated transaction references are grouped for display without deleting source records. Separate transaction references, accounts, dates, directions and distinct payment times survive. Corrections and completion take precedence over an unedited duplicate. Finance no longer repeats the same records in a Review block. Raw source text is folded under Source; there are no copy actions or pasted-message flows.

Real app icons are read from Android installed packages, with bundled publisher icons from public Google Play listings as offline fallbacks. See [icon sources](assets/subscription-icons/sources.json). Brand assets remain the property of their publishers and identify the service; they do not imply affiliation.

Holiday dates: [Kerala government diary 2026](https://gad.kerala.gov.in/sites/default/files/inline-files/diary2026_0.pdf). Fixed annual observances continue across year boundaries. Movable festival entries are limited to verified years; connected calendars can supply later dates.
