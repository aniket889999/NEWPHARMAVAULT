const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

const backendDir = path.resolve(__dirname, '..', 'backend');
const files = getFiles(backendDir);
let hasError = false;

for (const f of files) {
  const res = spawnSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  if (res.status !== 0) {
    console.error(`Syntax error in ${f}:`);
    console.error(res.stderr.toString());
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log(`Backend syntax check passed (${files.length} files checked).`);
}
