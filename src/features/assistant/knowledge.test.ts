import { describe, expect, it } from 'vitest'
import { ARTICLES, loadArticle, searchArticles } from './knowledge/index'
import { compoundInterest, periodsToReach, priceInstallment, savingPerPeriod, simpleInterest } from './calc'

describe('base de conhecimento', () => {
  it('tem pelo menos 45 artigos, todos completos', async () => {
    expect(ARTICLES.length).toBeGreaterThanOrEqual(45)
    for (const meta of ARTICLES) {
      const a = await loadArticle(meta.id)
      expect(a).not.toBeNull()
      expect(a!.summary.length).toBeGreaterThan(30)
      expect(a!.details.length).toBeGreaterThan(0)
      expect(a!.examples.length).toBeGreaterThan(0)
      expect(a!.relatedQuestions.length).toBeGreaterThan(0)
      expect(a!.keywords.length).toBeGreaterThan(0)
      expect(a!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const r of a!.related) expect(ARTICLES.some((x) => x.id === r)).toBe(true)
    }
  })
  it('não cita taxas atuais como número (exemplos são ilustrativos)', async () => {
    for (const meta of ARTICLES) {
      const a = await loadArticle(meta.id)
      const body = [a!.summary, ...a!.details].join(' ')
      expect(body).not.toMatch(/(selic|cdi|ipca)[^.]{0,30}\d+(,\d+)?\s?%/i)
    }
  })
  it('busca por palavra-chave e sinônimo', () => {
    expect(searchArticles('o que é cdb')[0]?.id).toBe('cdb')
    expect(searchArticles('como sair das dívidas')[0]?.id).toBe('dividas')
    expect(searchArticles('regra 50 30 20')[0]?.id).toBe('orcamento-domestico')
    expect(searchArticles('previsão do tempo')).toHaveLength(0)
  })
})

describe('motor de cálculos', () => {
  it('juros simples e compostos', () => {
    expect(simpleInterest(1000, 2, 6)).toEqual({ interest: 120, total: 1120 })
    expect(compoundInterest(1000, 1, 12).total).toBe(1126.83)
    expect(compoundInterest(0, 0, 10, 100).total).toBe(1000)
  })
  it('parcela pela tabela Price', () => {
    expect(priceInstallment(30000, 1.5, 48).payment).toBe(881.25)
    expect(priceInstallment(1200, 0, 12).payment).toBe(100)
  })
  it('planos de economia', () => {
    expect(savingPerPeriod(10000, 12)).toBe(833.34)
    expect(periodsToReach(10000, 500)).toBe(20)
    expect(periodsToReach(100, 0)).toBeNull()
  })
})
