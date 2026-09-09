export type NativeMemorySnapshot = {
  totalBytes: number;
  availBytes: number;
  nativeHeapBytes: number;
  javaUsedBytes: number;
  lowMemory?: number;
  thresholdBytes?: number;
  clearedCacheBytes?: number;
  freedJavaBytes?: number;
  freedNativeBytes?: number;
};

export type NativeInboxRow = {
  id: string;
  sender: string;
  body: string;
  date: string;
};

export type NativeScreenshot = {
  id: string;
  uri: string;
  name: string;
  capturedAt: number;
  revision: string;
};

export type NativeImageFolder = {
  name: string;
  count: number;
};

export type NativeCalendarRow = {
  id: string;
  title: string;
  notes: string;
  location: string;
  start: string;
  calendar: string;
  account: string;
};
