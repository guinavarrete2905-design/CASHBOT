// Subconjunto mínimo da API do Vitest (describe/it/expect) para rodar os testes puros no Node.
import { isDeepStrictEqual, inspect } from 'node:util'

const queue = []
let prefix = []
export function describe(name, fn) {
  prefix.push(name)
  fn()
  prefix.pop()
}
export function it(name, fn) {
  queue.push({ name: [...prefix, name].join(' › '), fn })
}
export const test = it

function fail(msg) {
  throw new Error(msg)
}
function show(v) {
  return inspect(v, { depth: 6, breakLength: 120 })
}
function matchesObject(actual, expected) {
  if (typeof expected !== 'object' || expected === null) return isDeepStrictEqual(actual, expected)
  if (typeof actual !== 'object' || actual === null) return false
  return Object.keys(expected).every((k) => matchesObject(actual[k], expected[k]))
}

export function expect(actual) {
  const make = (negate) => {
    const check = (ok, msg) => {
      if (negate ? ok : !ok) fail((negate ? 'NÃO esperado: ' : '') + msg)
    }
    return {
      toBe: (e) => check(Object.is(actual, e), `${show(actual)} deveria ser ${show(e)}`),
      toEqual: (e) => check(isDeepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(e ?? null))), `${show(actual)} deveria igualar ${show(e)}`),
      toMatchObject: (e) => check(matchesObject(actual, e), `${show(actual)} deveria conter ${show(e)}`),
      toBeNull: () => check(actual === null, `${show(actual)} deveria ser null`),
      toBeUndefined: () => check(actual === undefined, `${show(actual)} deveria ser undefined`),
      toBeDefined: () => check(actual !== undefined, `valor deveria estar definido`),
      toBeTruthy: () => check(Boolean(actual), `${show(actual)} deveria ser verdadeiro`),
      toBeFalsy: () => check(!actual, `${show(actual)} deveria ser falso`),
      toContain: (e) => check(actual?.includes?.(e), `${show(actual)} deveria conter ${show(e)}`),
      toMatch: (re) => check(typeof actual === 'string' && (re instanceof RegExp ? re.test(actual) : actual.includes(re)), `${show(actual)} deveria casar com ${re}`),
      toHaveLength: (n) => check(actual?.length === n, `tamanho ${actual?.length} deveria ser ${n}`),
      toBeGreaterThan: (n) => check(actual > n, `${actual} deveria ser > ${n}`),
      toBeGreaterThanOrEqual: (n) => check(actual >= n, `${actual} deveria ser >= ${n}`),
      toBeLessThan: (n) => check(actual < n, `${actual} deveria ser < ${n}`),
      toBeCloseTo: (n, d = 2) => check(Math.abs(actual - n) < 10 ** -d / 2, `${actual} deveria ser ~${n}`),
    }
  }
  const api = make(false)
  api.not = make(true)
  return api
}

export function installGlobals() {
  Object.assign(globalThis, { describe, it, test, expect })
}

export async function run(files) {
  installGlobals()
  for (const f of files) await import(f)
  let passed = 0
  const failures = []
  for (const t of queue) {
    try {
      await t.fn()
      passed++
    } catch (e) {
      failures.push({ name: t.name, error: e })
    }
  }
  for (const f of failures) console.log(`✗ ${f.name}\n   ${f.error?.message ?? f.error}`)
  console.log(`\n${passed} passaram, ${failures.length} falharam (${queue.length} testes)`)
  if (failures.length) process.exitCode = 1
}
