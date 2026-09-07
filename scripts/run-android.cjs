const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const javaHome =
  process.env.JAVA_HOME || 'C:\\Program Files\\Microsoft\\jdk-17.0.20.8-hotspot';
const androidHome =
  process.env.ANDROID_HOME ||
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const javaBin = path.join(javaHome, 'bin');

if (!fs.existsSync(path.join(javaBin, 'java.exe'))) {
  console.error(`JAVA_HOME is invalid: ${javaHome}`);
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  PATH: `${javaBin}${path.delimiter}${process.env.PATH || ''}`,
};

const child = spawn('npx', ['expo', 'run:android', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
