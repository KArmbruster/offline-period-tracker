// Builds the web app for the native project (served from the root, no base
// path) and copies it into the Capacitor platforms.
import { execSync } from 'node:child_process';

const env = { ...process.env, BUILD_TARGET: 'mobile' };
const run = (command) => execSync(command, { stdio: 'inherit', env });

run('npx next build');
run('npx cap sync');
