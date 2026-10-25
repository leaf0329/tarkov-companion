import fs from 'node:fs';
import path from 'node:path';
const tracker = path.resolve('source/tracker');
const target = path.join(tracker, '.output/server/node_modules/unhead');
const version = JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).version;
const packages = path.join(tracker, 'node_modules/.pnpm');
const matches = fs.readdirSync(packages).filter(name => name.startsWith(`unhead@${version}_`));
if (matches.length !== 1) throw Error('Cannot identify the installed unhead runtime ' + version);
const source = path.join(packages, matches[0], 'node_modules/unhead');
// Nitro omits the legacy entry used by its renderer when tracing this pnpm tree.
const destination = fs.realpathSync(target);
if (!destination.startsWith(path.join(tracker, '.output') + path.sep)) throw Error('Runtime target is outside the build');
fs.cpSync(source, destination, { recursive: true, dereference: true, filter: file =>
  !path.relative(source, file).split(path.sep).includes('node_modules') && !file.endsWith('.map') });
console.log('Completed unhead runtime ' + version);
