import { register } from 'node:module'
register('./hooks.mjs', import.meta.url)
import('./vitest-shim.mjs').then((m) => m.installGlobals())
