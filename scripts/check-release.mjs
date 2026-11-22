import {readFile} from 'node:fs/promises';
import {waitForRelease} from './lib/release.mjs';
const {runtimeDigest}=JSON.parse(await readFile(new URL('../dist/release.json',import.meta.url),'utf8'));
await waitForRelease(runtimeDigest);
console.log('Both production API hosts match the tested website source.');
