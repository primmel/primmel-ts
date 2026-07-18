#!/usr/bin/env node
// primmel check <package-dir> — cross-layer lint for Recommendation packages.
import { checkPackage } from '../src/check.ts';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: primmel check <package-dir>');
  process.exit(2);
}

const issues = checkPackage(dir);
const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');

for (const i of issues) {
  const mark = i.severity === 'error' ? '✗' : '⚠';
  console.log(`${mark} [${i.check}] ${i.message}`);
}
console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length > 0 ? 1 : 0);
