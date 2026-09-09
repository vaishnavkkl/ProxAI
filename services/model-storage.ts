import { Directory, File, Paths } from 'expo-file-system';

import {
  CATALOG,
  resolveModelSources,
  type CatalogModel,
  type ModelSources,
} from '@/services/model-catalog';

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

/** Matches react-native-executorch 0.10 download() cache keys (djb2 + basename). */
export function cacheNameFromUrl(uri: string): string {
  const urlWithoutQuery = uri.split('?')[0] ?? uri;
  const basename = urlWithoutQuery.split('/').pop() || 'model';
  let hash = 5381;
  for (let index = 0; index < urlWithoutQuery.length; index += 1) {
    hash = (((hash << 5) + hash) ^ urlWithoutQuery.charCodeAt(index)) >>> 0;
  }
  return `${hash}_${basename}`;
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
    const expected = cacheNameFromUrl(remoteUrl);
    const directories = [getModelDirectory(), extraCacheDirectory()].filter(
      (directory): directory is Directory => directory != null,
    );

    for (const directory of directories) {
      if (!directory.exists) {
        continue;
      }
      for (const entry of directory.list()) {
        if (!(entry instanceof File)) {
          continue;
        }
        // tokenizer.json is shared as a basename by unrelated models. Match the full URL key.
        if (entry.name === expected && entry.size > 0) {
          return toFileUri(entry.uri);
        }
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

export function listCachedFileMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const file of getModelStorageInfo().files) {
    if (file.bytes > 0) {
      map.set(file.name, file.bytes);
    }
  }
  return map;
}

export function isCachedTrio(sources: ModelSources | null, files: Map<string, number>): boolean {
  if (!sources) {
    return false;
  }
  return (
    files.has(cacheNameFromUrl(sources.model)) &&
    files.has(cacheNameFromUrl(sources.tokenizer)) &&
    files.has(cacheNameFromUrl(sources.tokenizerConfig))
  );
}

export function listOnDeviceCatalog(custom: {
  customModelUrl: string;
  customTokenizerUrl: string;
  customTokenizerConfigUrl: string;
}): CatalogModel[] {
  const files = listCachedFileMap();
  return CATALOG.filter((item) =>
    isCachedTrio(
      resolveModelSources({
        modelId: item.id,
        customModelUrl: custom.customModelUrl,
        customTokenizerUrl: custom.customTokenizerUrl,
        customTokenizerConfigUrl: custom.customTokenizerConfigUrl,
      }),
      files,
    ),
  );
}

function huggingfaceDownloadUrl(uri: string) {
  if (!uri.includes('huggingface.co') || /[?&]download=/.test(uri)) {
    return uri;
  }
  return uri.includes('?') ? `${uri}&download=true` : `${uri}?download=true`;
}

function ensureModelDirectory() {
  const directory = getModelDirectory();
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

async function cacheRemoteFile(uri: string): Promise<string> {
  const existing = findCachedFile(uri);
  if (existing) {
    return existing;
  }

  const directory = ensureModelDirectory();
  const dest = new File(directory, cacheNameFromUrl(uri));
  const downloaded = await File.downloadFileAsync(huggingfaceDownloadUrl(uri), dest, {
    idempotent: true,
    headers: { 'Accept-Encoding': 'identity' },
  });
  if (!downloaded.exists || downloaded.size <= 0) {
    throw new Error('Tokenizer download produced an empty file.');
  }
  return toFileUri(downloaded.uri);
}

export async function cacheSidecarFile(uri: string): Promise<string> {
  return cacheRemoteFile(uri);
}

/**
 * Hugging Face often omits Content-Length on HEAD for tokenizer JSON, which
 * makes ExecuTorch warn and skip progress. Fetch those small files ourselves
 * and pass local URIs so the fetcher never HEADs them.
 */
export async function cacheTokenizerSources(sources: ModelSources): Promise<ModelSources> {
  return {
    model: sources.model,
    tokenizer: await cacheRemoteFile(sources.tokenizer),
    tokenizerConfig: await cacheRemoteFile(sources.tokenizerConfig),
  };
}

export function countPteFiles(): number {
  return getModelStorageInfo().files.filter((file) => file.name.endsWith('.pte')).length;
}

export function removeNamedCacheFiles(names: string[]): number {
  const unique = [...new Set(names)];
  let removed = 0;
  const directories = [getModelDirectory(), extraCacheDirectory()].filter(
    (directory): directory is Directory => directory != null,
  );
  for (const directory of directories) {
    for (const name of unique) {
      try {
        const file = new File(directory, name);
        if (!file.exists) {
          continue;
        }
        file.delete();
        removed += 1;
      } catch {
        // File may already be gone.
      }
    }
  }
  return removed;
}

export async function unlinkNamedCacheFiles(names: string[]): Promise<number> {
  let removed = removeNamedCacheFiles(names);
  const fs = blobUtilFs();
  if (!fs) {
    return removed;
  }
  const bases = [fs.dirs.SDCardDir, fs.dirs.DocumentDir].filter((dir): dir is string => Boolean(dir));
  for (const base of bases) {
    for (const name of names) {
      const path = `${base}/react-native-executorch/${name}`;
      try {
        if (await fs.exists(path)) {
          await fs.unlink(path);
          removed += 1;
        }
      } catch {
        // File may already be gone.
      }
    }
  }
  return removed;
}

export function clearDownloadedModels(): number {
  try {
    let removed = 0;
    const directory = getModelDirectory();
    if (directory.exists) {
      for (const entry of directory.list()) {
        if (!(entry instanceof File)) {
          continue;
        }
        entry.delete();
        removed += 1;
      }
    }
    const extra = extraCacheDirectory();
    if (extra?.exists) {
      for (const entry of extra.list()) {
        if (!(entry instanceof File)) {
          continue;
        }
        entry.delete();
        removed += 1;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

function blobUtilFs(): {
  dirs: { SDCardDir?: string; DocumentDir?: string };
  exists: (path: string) => Promise<boolean>;
  unlink: (path: string) => Promise<void>;
} | null {
  try {
    const loaded = require('react-native-blob-util') as {
      default?: { fs?: { dirs: { SDCardDir?: string; DocumentDir?: string }; exists: (path: string) => Promise<boolean>; unlink: (path: string) => Promise<void> } };
      fs?: { dirs: { SDCardDir?: string; DocumentDir?: string }; exists: (path: string) => Promise<boolean>; unlink: (path: string) => Promise<void> };
    };
    return loaded.fs ?? loaded.default?.fs ?? null;
  } catch {
    return null;
  }
}

function extraCacheDirectory(): Directory | null {
  const fs = blobUtilFs();
  const base = String(fs?.dirs.SDCardDir || fs?.dirs.DocumentDir || '');
  if (!base) {
    return null;
  }
  const uri = (base.startsWith('file://') ? base : `file://${base}`).replace(/\\/g, '/').replace(/\/$/, '');
  return new Directory(`${uri}/react-native-executorch`);
}

function readDirectoryFiles(directory: Directory): ModelFileInfo[] {
  if (!directory.exists) {
    return [];
  }
  const files: ModelFileInfo[] = [];
  for (const entry of directory.list()) {
    if (!(entry instanceof File)) {
      continue;
    }
    files.push({ name: entry.name, bytes: entry.size ?? 0 });
  }
  return files;
}

function readModelStorage(): ModelStorageInfo {
  const directory = getModelDirectory();
  const extra = extraCacheDirectory();
  const files = [...readDirectoryFiles(directory), ...(extra ? readDirectoryFiles(extra) : [])];
  const seen = new Set<string>();
  const unique: ModelFileInfo[] = [];
  let totalBytes = 0;
  for (const file of files) {
    if (seen.has(file.name) || file.bytes <= 0) {
      continue;
    }
    seen.add(file.name);
    unique.push(file);
    totalBytes += file.bytes;
  }
  return { path: directory.uri, exists: unique.length > 0 || directory.exists, files: unique, totalBytes };
}
