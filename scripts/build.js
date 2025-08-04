const { rmSync, cpSync } = require('fs');
const { join } = require('path');

const outDir = join(__dirname, '..', 'dist');
const srcDir = join(__dirname, '..', 'web');

rmSync(outDir, { recursive: true, force: true });
cpSync(srcDir, outDir, { recursive: true });

console.log(`Copied ${srcDir} to ${outDir}`);
