#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Minimal enterprise license policy gate.
 *
 * Fails CI when a production dependency is:
 * - Unknown / unlicensed
 * - Copyleft or source-restricted (GPL/AGPL/SSPL/BUSL)
 */

const fs = require('fs');
const path = require('path');

const reportPath = process.argv[2];

if (!reportPath) {
    console.error('Usage: node scripts/check-license-policy.js <license-report.json>');
    process.exit(2);
}

const absolutePath = path.resolve(reportPath);
if (!fs.existsSync(absolutePath)) {
    console.error(`License report not found: ${absolutePath}`);
    process.exit(2);
}

const raw = fs.readFileSync(absolutePath, 'utf8');
const report = JSON.parse(raw);

const blockedPatterns = [
    /\bAGPL\b/i,
    /\bGPL\b/i,
    /\bSSPL\b/i,
    /\bBUSL\b/i,
    /\bUNLICENSED\b/i,
    /\bUNKNOWN\b/i
];

const violations = [];

for (const [pkgName, pkgMeta] of Object.entries(report)) {
    const license = String(pkgMeta.licenses || 'UNKNOWN').trim();
    if (!license || blockedPatterns.some((pattern) => pattern.test(license))) {
        violations.push({ pkgName, license });
    }
}

console.log(`Scanned ${Object.keys(report).length} production dependencies for license policy.`);

if (violations.length === 0) {
    console.log('License policy check passed.');
    process.exit(0);
}

console.error(`License policy violation count: ${violations.length}`);
for (const violation of violations.slice(0, 50)) {
    console.error(`- ${violation.pkgName}: ${violation.license}`);
}
if (violations.length > 50) {
    console.error(`... and ${violations.length - 50} more`);
}

process.exit(1);
