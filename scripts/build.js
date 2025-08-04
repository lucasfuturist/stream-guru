const { rmSync, cpSync } = require('fs');
const { join } = require('path');

// Vercel expects static assets to live in a directory named "public" after the
// build step. Previously we copied the `web` folder to `dist`, which caused the
// build to fail because Vercel couldn't find the `public` directory. Copy the
// source assets to `public` instead so deployment succeeds.
const outDir = join(__dirname, '..', 'public');
const srcDir = join(__dirname, '..', 'web');

rmSync(outDir, { recursive: true, force: true });
cpSync(srcDir, outDir, { recursive: true });

console.log(`Copied ${srcDir} to ${outDir}`);
