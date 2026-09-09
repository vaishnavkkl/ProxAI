# Malayalam on Android

Rebuild the development app with `npx expo run:android` to install the new native
OCR engine and bundled language data. A Metro reload alone cannot add native OCR.

In Settings or Image intelligence, choose **മലയാളം + English** before reading a
photo or scanning folders. Both camera/gallery OCR and folder scans use this
setting. OCR is fully offline, including first use. Existing English/Latin mode
keeps ML Kit. Switching languages invalidates the relevant screenshot OCR cache;
unchanged images in the same language are still skipped. A language setting is
captured at scan start so one scan cannot mix engines.

In Settings → Language models choose **Malayalam · Qwen3 0.6B**, then Download.
Selecting this preset also enables Malayalam OCR. This is a Malayalam-first chat
preset of the official multilingual Qwen3 export, not a separate fine-tune. It
uses the same cache files as Qwen3 0.6B (506 MB model plus tokenizer). Replies
default to Malayalam, with explicit requests for other languages respected.
Qwen3 1.7B is also marked as Malayalam-capable but needs a larger download and
more RAM. Extraction JSON keys stay unchanged. Neither model's Malayalam quality
or speed has been benchmarked on the user's 6/8 GB phones.

The native OCR dependency is Tesseract4Android 4.9.0 (single-threaded), with
Tesseract's integer `tessdata_fast` Malayalam and English data (9.39 MB total).
Recognition is serialized to bound concurrent bitmap/engine memory and releases
the engine after each image. No periodic OCR, polling, upload, or cloud service
is used. Clear, upright printed text is the intended input; handwriting, blur,
rotation, and complicated layouts still need device accuracy testing.

Sources:
- https://github.com/adaptech-cz/Tesseract4Android
- https://github.com/tesseract-ocr/tessdata_fast
- https://qwenlm.github.io/blog/qwen3/ (Malayalam is listed under Dravidian)
- https://huggingface.co/software-mansion/react-native-executorch-qwen-3/tree/v0.10.0
