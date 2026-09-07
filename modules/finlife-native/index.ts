export type NativeMemorySnapshot = {
  totalBytes: number;
  availBytes: number;
  nativeHeapBytes: number;
  javaUsedBytes: number;
};

export type NativeInboxRow = {
  id: string;
  sender: string;
  body: string;
  date: string;
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
