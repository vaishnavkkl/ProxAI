const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const microsoftJdks = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft');
const installedJdks = fs.existsSync(microsoftJdks)
  ? fs.readdirSync(microsoftJdks).filter((name) => /^jdk-(21|17)\./.test(name)).sort().reverse()
  : [];
const javaHome = process.env.JAVA_HOME || installedJdks
  .map((name) => path.join(microsoftJdks, name))
  .find((directory) => fs.existsSync(path.join(directory, 'bin', 'java.exe')));
const androidHome =
  process.env.ANDROID_HOME ||
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const javaBin = javaHome ? path.join(javaHome, 'bin') : '';

if (!fs.existsSync(path.join(javaBin, 'java.exe'))) {
  console.error('Set JAVA_HOME to an installed JDK 17 or 21 directory.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  PATH: `${javaBin}${path.delimiter}${process.env.PATH || ''}`,
};

const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'run:android', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
