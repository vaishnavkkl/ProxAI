# Offline Malayalam OCR data

Unmodified `mal.traineddata` and `eng.traineddata` from
https://github.com/tesseract-ocr/tessdata_fast/tree/87416418657359cb625c412a48b6e1d6d41c29bd

Licensed under Apache 2.0; the upstream LICENSE is included alongside these files.
The two language models total 9,389,084 bytes. They are bundled in the APK and
copied atomically to app-private storage on first Malayalam recognition. No
runtime download is needed. The LSTM-only engine recognizes Malayalam + English
in one pass and is released after each image. English/Latin mode uses ML Kit.

If upgrading these assets, also update the native storage directory and the
Malayalam OCR cache version in services/screenshot-ocr.ts.
