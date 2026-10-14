// Resolve imports sem extensão e o alias "@/" para rodar arquivos .ts puros com o Node
// (node --experimental-strip-types). Usado só pelos scripts de verificação, não pelo app.
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')

function tryFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (specifier === 'vitest') return { url: new URL('./vitest-shim.mjs', import.meta.url).href, shortCircuit: true }
  let base = null
  if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2))
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
  }
  if (base) {
    const file = tryFile(base)
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return next(specifier, context)
}
