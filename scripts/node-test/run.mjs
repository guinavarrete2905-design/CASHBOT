// Uso: node --experimental-strip-types --no-warnings --import ./scripts/node-test/register.mjs scripts/node-test/run.mjs <arquivos de teste>
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { run } from './vitest-shim.mjs'

const files = process.argv.slice(2).map((f) => pathToFileURL(path.resolve(f)).href)
await run(files)
