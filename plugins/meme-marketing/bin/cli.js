#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, '..', 'scripts', 'meme-craft.ts');

// Check if bun is available or if we are already in bun
const isBun = Boolean(process.versions.bun);

if (isBun) {
  await import(scriptPath);
} else {
  // Spawn via bun if installed, else execute with node/tsx/native
  const bunProcess = spawn('bun', [scriptPath, ...process.argv.slice(2)], {
    stdio: 'inherit'
  });

  bunProcess.on('error', () => {
    // If bun is not found on machine, fallback to node execution with ts-blank-space or basic loader
    console.error('[meme-craft] Note: Bun is recommended for instant TypeScript execution. Please install Bun via https://bun.sh');
    const nodeProcess = spawn('node', ['--loader', 'tsx', scriptPath, ...process.argv.slice(2)], {
      stdio: 'inherit'
    });
    nodeProcess.on('error', (err) => {
      console.error(`[meme-craft] Error: ${err.message}`);
      process.exit(1);
    });
    nodeProcess.on('exit', (code) => process.exit(code || 0));
  });

  bunProcess.on('exit', (code) => process.exit(code || 0));
}
