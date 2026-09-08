# Mobile OCR and local language models

Research date: 9 September 2026. Target: ProxAI, Expo SDK 54, Android, react-native-executorch 0.9.3. These are integration choices, not a claim that one model wins every mobile benchmark.

## Decision

Use bundled ML Kit Latin OCR for screenshots, deterministic category parsers for clear notices, and an optional local language model for unmatched SMS. Keep Qwen2.5 0.5B as the existing default. Evaluate LFM2.5 350M next for structured extraction. Add Qwen3.5 0.8B as an explicitly optional advanced model, with an available-memory check before loading. Do not download or switch the user's model automatically.

## OCR options

| Option | Fit for this app | Decision |
|---|---|---|
| ML Kit Text Recognition v2, bundled Latin | Google documents about 4 MB added per script per architecture; available immediately without a first-use model download | Integrated through the existing Kotlin module; images and recognized text stay local |
| ExecuTorch OCR | The installed runtime also supports OCR; needs a separate detector/recognizer model pipeline | Retain one text OCR engine for this implementation; no second model download |
| Tesseract 5 + tessdata_fast | Open-source integer LSTM models, including Malayalam `mal.traineddata` | Candidate for Malayalam support; needs a native integration and Kerala screenshot evaluation before enabling |
| A vision language model | Can interpret layout, but brings larger weights, memory use and generative errors | Not the default OCR path; the new Qwen option is used for text only |

ML Kit's language list does not include Malayalam. The screen explicitly explains that limitation; empty/unrecognized text remains reviewable. “Best small OCR” here means the practical Android fit for English/Latin screenshots, not proven superiority on Malayalam. Sources: [ML Kit Android setup and size](https://developers.google.com/ml-kit/vision/text-recognition/v2/android), [supported languages](https://developers.google.com/ml-kit/vision/text-recognition/v2/languages), [ExecuTorch API reference](https://docs.swmansion.com/react-native-executorch/docs/api-reference), [Tesseract fast models](https://github.com/tesseract-ocr/tessdata_fast).

## Local model comparison

| Candidate | License / cost | Practical assessment |
|---|---|---|
| Qwen2.5 0.5B Instruct | Apache 2.0; no paid inference API | Existing default; smallest verified compatible model export in this app's catalog |
| LFM2.5 350M | LFM Open License 1.0; commercial-use conditions apply | Publisher recommends extraction and structured output, and reports sub-1-GB memory in its tested setup. Our ExecuTorch build needs separate measurement. Malayalam is not among its listed languages |
| SmolLM2 135M / 360M Instruct | Apache 2.0 | Small parameter count alone does not imply a small exported file. The particular 360M export is unexpectedly large |
| Qwen3 0.6B | Apache 2.0 | Supported by this runtime; thinking/non-thinking mode and decoding require care. Not automatically preferable to the existing extraction model |
| Qwen3.5 0.8B | Apache 2.0 | Newer multilingual candidate; compatible text export is verified and added to the picker. Its 1.41-GB file makes it an advanced option, not a lightweight default |
| Gemma 3 270M IT | Gemma terms, including gated acceptance on Hugging Face | Interesting small alternative, but no matching built-in model entry was found in the installed runtime. Would require a verified export or another runtime; not wired as a broken download option |

Primary model sources: [Qwen2.5](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct), [LFM2.5 model card](https://huggingface.co/LiquidAI/LFM2.5-350M), [LFM license](https://huggingface.co/LiquidAI/LFM2.5-350M/blob/main/LICENSE), [SmolLM2](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct), [Qwen3](https://huggingface.co/Qwen/Qwen3-0.6B), [Qwen3.5](https://huggingface.co/Qwen/Qwen3.5-0.8B), [Gemma](https://huggingface.co/google/gemma-3-270m-it). LFM's license has a commercial-use revenue threshold; it should not be described as unrestricted Apache-style licensing.

### Verified download sizes

HTTP HEAD requests to the official Software Mansion `resolve/v0.9.0` files returned signed-download redirects and these `x-linked-size` values. These are model files only, in decimal bytes; tokenizers are extra. File size is not peak process RAM. No weights were downloaded for this check.

| Export | Bytes | Approximate model file |
|---|---:|---:|
| [Qwen2.5 0.5B 8da4w](https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.9.0/0_5b/xnnpack/qwen_2_5_0_5b_xnnpack_8da4w.pte) | 417,495,168 | 417 MB |
| [LFM2.5 350M 8da4w](https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.9.0/350m/xnnpack/lfm_2_5_350m_xnnpack_8da4w.pte) | 453,885,568 | 454 MB |
| [SmolLM2 135M 8da4w](https://huggingface.co/software-mansion/react-native-executorch-smolLm-2/resolve/v0.9.0/135m/xnnpack/smollm2_135m_xnnpack_8da4w.pte) | 560,506,880 | 561 MB |
| [Qwen2.5 1.5B 8da4w](https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.9.0/1_5b/xnnpack/qwen_2_5_1_5b_xnnpack_8da4w.pte) | 1,136,177,792 | 1.14 GB |
| [SmolLM2 360M 8da4w](https://huggingface.co/software-mansion/react-native-executorch-smolLm-2/resolve/v0.9.0/360m/xnnpack/smollm2_360m_xnnpack_8da4w.pte) | 1,363,730,688 | 1.36 GB |
| [Qwen3.5 0.8B 8da4w](https://huggingface.co/software-mansion/react-native-executorch-qwen-3.5/resolve/v0.9.0/0_8b/xnnpack/qwen_3_5_0_8b_xnnpack_8da4w.pte) | 1,412,986,112 | 1.41 GB |

The old 80–200 MB model hints and 150–300 MB RAM claims were unsupported and have been removed. `performance.md` contains targets, not measured proof: none of these downloads meets its approximately 300-MB download target. Existing functionality is retained. The new advanced option is available for development evaluation, not certified against that performance contract. Production release still needs device profiling, including first-token latency, peak PSS, battery use, valid JSON rate, category accuracy and exact amount/date accuracy on a fixed consented dataset. No phone inference benchmark for the new model is claimed.

## Why scans changed before

- Model storage silently fell back to any downloaded model, and basename matching could mix tokenizers. Every model could incorrectly show “On device.” Lookup now requires the selected model's complete URL cache keys, and changing selection unloads a stale model session before inference.
- Native SMS queries sorted by date, then continued after the maximum ID in the page. Restored messages can have ID order different from date order. Pagination now sorts and advances by ID consistently.
- Extraction used nonzero temperature and an optional AI verification pass could remove reliable rule results. Extraction now uses greedy decoding, and AI does not veto deterministic hits.
- AI was capped at 48 queued messages per refresh. Processing now uses complete bounded pages and 12-message AI batches, with no silent fixed-message cap.
- Strict JSON validation rejects incomplete responses; failures remain retryable. Valid decisions, including empty results, are cached by source hash, parser revision and model sources.
- Receipt/capture timestamps anchor relative dates. Content hashing includes the notice day so repeated monthly messages are not lost.
- Parser and image caches are deleted by Clear database. Rechecking unchanged sources on the same parser/model should reproduce the same decisions; model/version changes, altered images and newly synced source data can still legitimately change results. Greedy decoding is not a promise of bitwise identity across devices/runtimes.

## Screenshot flow

Home → Screenshot Intelligence → choose a month → grant photo access → Scan this month. Enable Include in Refresh for incremental checks of the current month's screenshots during a normal Refresh. This is a foreground scan integration, not a new background watcher or polling service.

Android MediaStore queries restrict reads to Screenshot-named folders and the selected capture month, paginate 50 metadata rows, decode one image at a time, bound the decoded long edge to 4096 pixels, and close the OCR recognizer after use. Very long screenshots may lose text detail when downsampled. Image SHA-256 plus local extraction records avoid repeated OCR and duplicate imports of identical files. Cropped/compressed versions are different images; cross-source semantic deduplication is not guaranteed. Categories come from the shared deterministic parsers, with extra evidence checks for screenshots. Recognizable ProxAI dashboard captures and menu-only dashboards are excluded from automatic categorization to prevent recursive or fictional items. Unclassified screenshots are omitted from the organizer. Useful extracted items can be corrected through their structured detail forms. Images are not sent to the LLM or a server.

Full/selected/denied photo access are distinguished. Under selected-photo access, only granted images can be scanned. See [Android partial photo access](https://developer.android.com/about/versions/14/changes/partial-photo-video-access) and [Expo SDK 54 MediaLibrary guidance](https://docs.expo.dev/versions/v54.0.0/sdk/media-library/). This implementation uses the app's existing native module instead of adding a second media-library bridge. Automatic screenshot folder scanning is Android-only.

## OTT discovery

HTTP 200 on a public OTT website cannot tell whether the app is installed, whether the user has an account, or whether a plan renews. Discovery checks known packages and resolves supported links against the specific package, preventing the web browser from creating a false match. Found apps appear under Renewals as discovered services with Open and Add my plan actions. Confirmed renewal dates still require source evidence or user entry. There is no direct Gmail mailbox connector in the mobile app.
