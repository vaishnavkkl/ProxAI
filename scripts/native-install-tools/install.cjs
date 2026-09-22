'use strict';

const fs = require('node:fs');
const path = require('node:path');

const packageRoot = __dirname;
const projectRoot = path.resolve(packageRoot, '..', '..');
const binDir = path.join(projectRoot, 'node_modules', '.bin');

const tools = [
  { name: 'sha256sum', source: path.join(packageRoot, 'sha256sum.cjs') },
  { name: 'tar', source: path.join(packageRoot, 'tar.cjs') },
];

if (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  process.exit(0);
}

fs.mkdirSync(binDir, { recursive: true });

for (const tool of tools) {
  if (!fs.existsSync(tool.source)) {
    continue;
  }

  if (process.platform === 'win32') {
    fs.writeFileSync(
      path.join(binDir, `${tool.name}.cmd`),
      `@ECHO off\r\nnode "${tool.source}" %*\r\n`,
    );
  } else {
    const shim = path.join(binDir, tool.name);
    fs.writeFileSync(
      shim,
      `#!/usr/bin/env node\nrequire(${JSON.stringify(tool.source)});\n`,
      { mode: 0o755 },
    );
  }
}
