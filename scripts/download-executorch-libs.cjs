'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const preload = path.join(__dirname, 'executorch-sha256-preload.cjs');
const downloader = path.join(
  projectRoot,
  'node_modules/react-native-executorch/scripts/download-libs.js',
);

const result = spawnSync(
  process.execPath,
  ['-r', preload, downloader],
  {
    cwd: projectRoot,
    env: { ...process.env, INIT_CWD: projectRoot },
    stdio: 'inherit',
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
