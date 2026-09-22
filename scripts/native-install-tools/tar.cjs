#!/usr/bin/env node
'use strict';

// ExecuTorch extracts native libs with: tar -xzmf "<win-path>" -C "<win-path>"
// Git/MSYS tar treats "C:\..." as a remote host unless paths use /c/... form.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');

function toUnixPath(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const drive = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (drive) {
    return `/${drive[1].toLowerCase()}/${drive[2]}`;
  }
  return normalized;
}

function usage() {
  throw new Error('Unsupported tar invocation for native-install-tools shim');
}

const args = process.argv.slice(2);
const xzmfIndex = args.indexOf('-xzmf');
const destIndex = args.indexOf('-C');

if (xzmfIndex === -1 || destIndex === -1 || destIndex <= xzmfIndex) {
  const result = spawnSync('tar', args, { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const tarball = args[xzmfIndex + 1];
const destDir = args[destIndex + 1];

if (!tarball || !destDir) {
  usage();
}

fs.mkdirSync(destDir, { recursive: true });

const tarArgs = [
  ...args.slice(0, xzmfIndex),
  '-xzmf',
  process.platform === 'win32' ? toUnixPath(tarball) : tarball,
  '-C',
  process.platform === 'win32' ? toUnixPath(destDir) : destDir,
  ...args.slice(destIndex + 2),
];

execFileSync('tar', tarArgs, { stdio: 'inherit' });
