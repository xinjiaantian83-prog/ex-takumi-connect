import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.html')) htmlFiles.push(file);
  }
};
walk(root);

const missing = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|\/\/)/.test(ref) || ref === '/') continue;
    let target = ref.startsWith('/') ? path.resolve(root, `.${ref}`) : path.resolve(path.dirname(file), ref);
    if (ref.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) missing.push(`${path.relative(root, file)} -> ${ref}`);
  }
}

if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}
console.log(`Checked ${htmlFiles.length} HTML files: all local links and assets resolve.`);
