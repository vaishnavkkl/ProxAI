'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const preload = path.join(__dirname, 'executorch-sha256-preload.cjs');
const downloader = path.join(
  projectRoot,
  'node_modules/react-native-executorch/scripts/download-libs.js',
);

if (!require('fs').existsSync(downloader)) {
  console.warn(
    '[proxai] react-native-executorch is not installed yet; skipping native lib download.',
  );
  process.exit(0);
}

const env = { ...process.env, INIT_CWD: projectRoot };
delete env.RNET_SKIP_DOWNLOAD;

const result = spawnSync(
  process.execPath,
  ['-r', preload, downloader],
  {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
