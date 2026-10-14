// Roda o conjunto de perguntas de referência contra o motor do assistente (com dados de teste)
// e gera docs/assistente-cobertura.md.
// Uso: node --experimental-strip-types --no-warnings --import ./scripts/node-test/register.mjs scripts/assistant/coverage.ts [--write]
import { writeFileSync } from 'node:fs'
import { respond } from '../../src/features/assistant/engine.ts'
import { EMPTY_CONTEXT, type ConversationContext } from '../../src/features/assistant/types.ts'
import { createFakeDataSource } from '../../src/features/assistant/testing/fakeData.ts'
import { REFERENCE } from '../../src/features/assistant/testing/reference.ts'
import { intentCount } from '../../src/features/assistant/intents.ts'
import { ARTICLES } from '../../src/features/assistant/knowledge/index.ts'

type Row = { group: string; q: string; expected: string; got: string; ok: boolean; scope: string; before?: string[] }
const rows: Row[] = []
for (const c of REFERENCE) {
  const ds = createFakeDataSource()
  let ctx: ConversationContext = EMPTY_CONTEXT
  for (const b of c.before ?? []) ctx = (await respond(b, ctx, ds)).ctx
  const { reply } = await respond(c.q, ctx, ds)
  const expected = Array.isArray(c.expect) ? c.expect : [c.expect]
  rows.push({ group: c.group, q: c.q, expected: expected.join(' ou '), got: reply.intent, ok: expected.includes(reply.intent), scope: c.scope ?? 'in', before: c.before })
}

const ok = rows.filter((r) => r.ok).length
const fails = rows.filter((r) => !r.ok)
for (const f of fails) console.log(`✗ [${f.group}] ${f.q}  → ${f.got} (esperado ${f.expected})`)
console.log(`\n${ok}/${rows.length} corretas (${((ok / rows.length) * 100).toFixed(1)}%)`)

if (process.argv.includes('--write')) {
  const groups = [...new Set(rows.map((r) => r.group))]
  const md: string[] = [
    '# Assistente Financeiro — cobertura das perguntas de referência',
    '',
    `Gerado por \`scripts/assistant/coverage.ts\` com dados de teste (nenhum dado real). Intenções com regras próprias: **${intentCount()}**. Artigos na base de conhecimento: **${ARTICLES.length}**.`,
    '',
    `**Resultado: ${ok} de ${rows.length} perguntas tratadas corretamente (${((ok / rows.length) * 100).toFixed(1)}%).**`,
    '',
    '"Correta" significa que o assistente escolheu a intenção esperada. Nas perguntas fora do escopo, o correto é reconhecer o limite (sem inventar resposta).',
    '',
    'Atenção ao ler o percentual: as regras foram ajustadas usando este mesmo conjunto, então ele mede regressões, não a taxa de acerto com frases inéditas. Para ter uma noção honesta, o grupo "Variações novas" foi escrito depois do ajuste: na primeira rodada, **32 das 40** estavam corretas; as 8 falhas (abreviações como "qto", "nova despesa", "passa 200 da carteira pro itau", "20% de 350" etc.) foram corrigidas em seguida. Espere uma taxa menor com frases muito diferentes das previstas.',
    '',
    '| Grupo | Corretas |',
    '|---|---|',
    ...groups.map((g) => {
      const gr = rows.filter((r) => r.group === g)
      return `| ${g} | ${gr.filter((r) => r.ok).length}/${gr.length} |`
    }),
    '',
  ]
  for (const g of groups) {
    md.push(`## ${g}`, '', '| Pergunta | Esperado | Obtido | |', '|---|---|---|---|')
    for (const r of rows.filter((x) => x.group === g)) {
      const q = (r.before?.length ? `_(depois de: ${r.before.map((b) => `"${b}"`).join(' → ')})_ ` : '') + r.q.replace(/\|/g, '\\|')
      md.push(`| ${q} | ${r.expected} | ${r.got} | ${r.ok ? '✅' : '❌'} |`)
    }
    md.push('')
  }
  md.push(
    '## Fora do escopo (limitações conhecidas)',
    '',
    '- Taxas, índices e cotações atuais (Selic, CDI, IPCA, dólar): o assistente não tem acesso e indica as fontes oficiais.',
    '- Orientação tributária, jurídica e recomendação individual de investimento.',
    '- Alterar membros, papéis e permissões; editar ou excluir movimentações pelo chat.',
    '- Frases longas com muitos itens ou estruturas muito livres (use o formulário ou, no futuro, a central de lançamentos em massa).',
    '- Perguntas abertas fora de finanças pessoais.',
    '',
  )
  writeFileSync(new URL('../../docs/assistente-cobertura.md', import.meta.url), md.join('\n'))
  console.log('docs/assistente-cobertura.md atualizado')
}
