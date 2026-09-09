'use strict';

const crypto = require('crypto');
const fs = require('fs');
const childProcess = require('child_process');

const originalExecSync = childProcess.execSync.bind(childProcess);

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function toUnixPath(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const drive = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (drive) {
    return `/${drive[1].toLowerCase()}/${drive[2]}`;
  }
  return normalized;
}

childProcess.execSync = function patchedExecSync(command, options) {
  const cmd = String(command);

  if (/sha256sum .* \|\| shasum -a 256/.test(cmd)) {
    const match = cmd.match(/"(.+)"\s*\|\|\s*shasum/);
    if (match?.[1]) {
      return Buffer.from(`${sha256File(match[1])}  ${match[1]}\n`);
    }
  }

  if (cmd.startsWith('tar -xzmf ')) {
    const match = cmd.match(/^tar -xzmf "(.+)" -C "(.+)"$/);
    if (match) {
      const tarball = process.platform === 'win32' ? match[1] : toUnixPath(match[1]);
      const destDir = process.platform === 'win32' ? match[2] : toUnixPath(match[2]);
      fs.mkdirSync(destDir, { recursive: true });
      return childProcess.execFileSync('tar', ['-xzmf', tarball, '-C', destDir], options);
    }
  }

  return originalExecSync(command, options);
};
