#!/usr/bin/env node
import { cp, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const target = process.argv[2];
if (!target || process.argv.length !== 3) { console.error('Usage: node scripts/create-app.mjs /absolute/new-app-directory'); process.exit(2); }
const dest = resolve(target);
if (await stat(dest).catch(()=>null)) { console.error('Choose a new directory; existing project files are never overwritten.'); process.exit(2); }
await mkdir(dest, { recursive:true });
await cp(resolve(import.meta.dirname,'../assets/voice-app'), dest, { recursive:true });
await cp(resolve(import.meta.dirname,'voice.mjs'), join(dest,'voice.mjs'));
await cp(resolve(import.meta.dirname,'connection-check.mjs'), join(dest,'connection-check.mjs'));
await writeFile(join(dest,'.gitignore'), 'node_modules/\n.env\n.env.*\n!.env.example\noutput/\n');
await writeFile(join(dest,'.env.example'), 'CASTREADER_API_KEY=\n');
console.log(JSON.stringify({ path:dest, install:'npm install', check:'node connection-check.mjs', run:'npm start', setup:'Node.js 22+. Set CASTREADER_API_KEY in the server environment. Open the loopback URL printed by npm start. Estimate each batch before starting.', generated:false },null,2));
