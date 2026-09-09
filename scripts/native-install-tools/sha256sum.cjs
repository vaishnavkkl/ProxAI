#!/usr/bin/env node
'use strict';

// ExecuTorch's install script invokes sha256sum, which Windows does not ship.
// npm adds this local package's command to PATH before dependency install hooks.
const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: sha256sum <file>');
  const file = process.argv[2];
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  process.stdout.write(`${hash.digest('hex')}  ${file}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
