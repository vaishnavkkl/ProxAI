import { Directory, File, Paths } from 'expo-file-system';

import type { ModelSources } from '@/services/model-catalog';

export type ModelFileInfo = {
  name: string;
  bytes: number;
};

export type ModelStorageInfo = {
  path: string;
  exists: boolean;
  files: ModelFileInfo[];
  totalBytes: number;
};

export function getModelDirectory(): Directory {
  return new Directory(Paths.document, 'react-native-executorch');
}

export function cacheNameFromUrl(uri: string): string {
  const clean = uri.replace(/^https?:\/\//, '').split('#')[0] ?? uri;
  return clean.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function basenameFromUrl(uri: string): string {
  const clean = uri.split('?')[0]?.split('#')[0] ?? uri;
  return clean.slice(clean.lastIndexOf('/') + 1);
}

export function getModelStorageInfo(): ModelStorageInfo {
  try {
    return readModelStorage();
  } catch {
    return {
      path: 'Documents/react-native-executorch',
      exists: false,
      files: [],
      totalBytes: 0,
    };
  }
}

function toFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

export function fileUriForName(name: string): string {
  return toFileUri(new File(getModelDirectory(), name).uri);
}

export function findCachedFile(remoteUrl: string): string | null {
  if (remoteUrl.startsWith('file://')) {
    const file = new File(remoteUrl);
    return file.exists && file.size > 0 ? remoteUrl : null;
  }
  if (remoteUrl.startsWith('/')) {
    const file = new File(`file://${remoteUrl}`);
    return file.exists && file.size > 0 ? file.uri : null;
  }

  try {
    const directory = getModelDirectory();
    if (!directory.exists) {
      return null;
    }

    const expected = cacheNameFromUrl(remoteUrl);

    for (const entry of directory.list()) {
      if (!(entry instanceof File)) {
        continue;
      }
      // tokenizer.json is shared as a basename by unrelated models. Match the full URL key.
      if (entry.name === expected && entry.size > 0) {
        return toFileUri(entry.uri);
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveLocalSources(sources: ModelSources): ModelSources | null {
  const model = findCachedFile(sources.model);
  const tokenizer = findCachedFile(sources.tokenizer);
  const tokenizerConfig = findCachedFile(sources.tokenizerConfig);
  if (!model || !tokenizer || !tokenizerConfig) {
    return null;
  }
  return { model, tokenizer, tokenizerConfig };
}

export function findAnyLocalTrio(): ModelSources | null {
  const files = getModelStorageInfo().files.filter((file) => file.bytes > 0);
  const model = files.find((file) => file.name.endsWith('.pte'));
  const tokenizerConfig = files.find((file) => file.name.endsWith('tokenizer_config.json'));
  const tokenizer = files.find(
    (file) => file.name.endsWith('tokenizer.json') && !file.name.endsWith('tokenizer_config.json'),
  );
  if (!model || !tokenizer || !tokenizerConfig) {
    return null;
  }
  return {
    model: fileUriForName(model.name),
    tokenizer: fileUriForName(tokenizer.name),
    tokenizerConfig: fileUriForName(tokenizerConfig.name),
  };
}

export function resolveOfflineSources(preferred: ModelSources | null): ModelSources | null {
  if (preferred) {
    const exact = resolveLocalSources(preferred);
    if (exact) {
      return exact;
    }
  }
  return null;
}

export function hasCachedSources(sources: ModelSources | null): boolean {
  return resolveOfflineSources(sources) != null;
}

export function countPteFiles(): number {
  return getModelStorageInfo().files.filter((file) => file.name.endsWith('.pte')).length;
}

export function clearDownloadedModels(): number {
  try {
    const directory = getModelDirectory();
    if (!directory.exists) {
      return 0;
    }

    let removed = 0;
    for (const entry of directory.list()) {
      if (!(entry instanceof File)) {
        continue;
      }
      entry.delete();
      removed += 1;
    }
    return removed;
  } catch {
    return 0;
  }
}

function readModelStorage(): ModelStorageInfo {
  const directory = getModelDirectory();
  const path = directory.uri;

  if (!directory.exists) {
    return { path, exists: false, files: [], totalBytes: 0 };
  }

  const files: ModelFileInfo[] = [];
  let totalBytes = 0;

  for (const entry of directory.list()) {
    if (!(entry instanceof File)) {
      continue;
    }
    const bytes = entry.size ?? 0;
    files.push({ name: entry.name, bytes });
    totalBytes += bytes;
  }

  return { path, exists: true, files, totalBytes };
}
