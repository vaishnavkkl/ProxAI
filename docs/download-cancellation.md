# Model download cancellation

The installed ExecuTorch 0.10.1 fetcher starts each model's files with
`Promise.all`. If one file fails, that promise rejects without aborting its
siblings. Previously our UI cleared the job while the remaining files could
still transfer. Its Android fallback uses DownloadManager with native download
notifications hidden; those OS transfers can outlive JavaScript and its Zustand
state.

Both language and image downloads now go through `downloadModelResources`:

- Each attempt owns an AbortController. Stop or any failed file cancels siblings.
- Native DownloadManager removal is awaited before returning the failure and
  clearing the active job. Large language downloads no longer retry automatically.
- Startup cancels orphaned transfers before permitting new model downloads.
- Native module destruction also attempts cleanup during development reloads.
- A root banner exposes the active job's Stop button outside Settings.
- Settings → Stop all model downloads works even without a current JS job.

Native cleanup queries this app's active DownloadManager records only and matches
`.downloading` staging files directly inside its internal/external
`react-native-executorch` directories. It removes partial transfers, not completed
model files or unrelated downloads. A process killed without lifecycle callbacks
can leave an OS transfer until the next app launch performs recovery.

The native recovery requires rebuilding with `npx expo run:android`; a Metro
reload does not add the native method. The JS wrapper improves failure cleanup
on an older binary but cannot discover its orphaned OS downloads.

Validation: Node tests simulate sibling failure, cancellation during startup,
native removal delays, and failed recovery. Native Kotlin compilation and
TypeScript checks pass. Live device network traffic has not been measured.
