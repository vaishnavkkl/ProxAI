# ExecuTorch efficiency review — 10 September 2026

The app uses Expo 57, React Native 0.86, Worklets 0.10.1 and React Native ExecuTorch 0.10.x. This combination matches the [compatibility table](https://docs.swmansion.com/react-native-executorch/docs/other/compatibility). Reviewed the getting-started, migration, downloading, chat/session, native libraries, compatibility and custom-export documentation alongside the installed implementation.

## Runtime decisions

- Chat uses the public background runner and official chat preprocessor with incremental KV caching. Its context can reset without disposing model weights. `echo: false` is explicit: the 0.10 native runner defaults to echoing the generation header, unlike the old runner.
- Send unchanged snapshots once. Prioritize task, agenda, travel, delivery and bill facts for relevant questions instead of cutting them off after long transaction lists.
- Reserve space for the incoming prompt and 256-token response. Short follow-ups no longer reserve half a 2,048-token context. The byte allowance is conservative; it is not an exact tokenizer count. Native remaining context still controls resets.
- Reset conversation tokens after interrupted or malformed/repeating output before reusing its raw native history. Keep model weights resident across replies and New chat; release them on leaving the screen (or explicit model switching/memory release). Background extraction cannot evict an open chat.
- Send immediately displays the loading/preparation state. Warmup progress is forwarded to the pending reply. Completed assistant text is committed together with the next user turn, avoiding an extra post-response prefill.
- Independent extraction batches use a stateless adapter around the public runner. Model weights stay loaded; earlier SMS and generated JSON do not enter subsequent batches. Reset and generation run together on the background worklet, without re-prefilling assistant output that no subsequent batch needs.
- Preserve the single model slot, cancellable downloads, streamed chat, manual model selection and offline inference.

The public generation options are `echo`, `ignoreEos`, `maxNewTokens` and `temperature`. There is no supported repetition-penalty, top-k, top-p or CPU-thread-count setting in this API. Backend selection belongs to the exported model, not a runtime switch applied to an arbitrary file. See [chat and generation](https://docs.swmansion.com/react-native-executorch/docs/extensions/llm-chat-and-generation) and [custom exports](https://docs.swmansion.com/react-native-executorch/docs/core-and-advanced/exporting-custom-models).

## Compact model choices

Verified official `v0.10.0` model files; sizes exclude tokenizers. These models already exist in the picker. Existing model selection and Qwen default are preserved.

| Model | Model file | Use |
| --- | ---: | --- |
| LFM2.5 350M 8da4w | 277,555,584 bytes | Recommended compact alternative for extraction and short replies; 34% smaller file than Qwen. |
| Qwen2.5 0.5B 8da4w | 417,495,168 bytes | Existing multilingual default; compare answer quality on the same prompts. |
| SmolLM2 135M 8da8w | 165,664,000 bytes | Smallest listed alternative, with weaker instruction following and reasoning. |

Sources: [LFM exports](https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/tree/v0.10.0/350m), [Qwen exports](https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/tree/v0.10.0/0_5b), [Smol exports](https://huggingface.co/software-mansion/react-native-executorch-smolLm-2/tree/v0.10.0/135m), [Liquid model card](https://huggingface.co/LiquidAI/LFM2.5-350M), [Smol model card](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct).

The three compact exports have a 2,048-token native context limit. The upstream checkpoints' larger advertised context windows do not override the exported limits. Model-file size is not total process RAM. Neither 6 GB nor 8 GB of device RAM establishes decode speed: CPU, available memory, thermals, prompt length and export backend also matter. Liquid's published speed/RAM benchmarks use other runtimes and are not measurements of this app. Malayalam is not among LFM350's listed supported languages.

## Verification without screenshots

`npm test` includes context selection/reuse, prompt echo, cancellation, measurements and independent-batch tests. The stateless generation function is also compiled through the actual Expo Babel preset to verify worklet transformation. Run TypeScript and focused ESLint for code validation.

The resource sheet shows the last reply's first visible text latency, native decode tokens/second and committed context occupancy. Values are captured once per completed reply, with no background sampling timer or stored message content. First text includes model loading/queue time; decode speed uses native timestamps only. Compare a fresh question and several follow-ups with the same model, then repeat with LFM350. Performance figures remain unmeasured until run on the phone. The newest assistant reply is committed on the next turn; the context reserve separately accounts for its pending tokens.
