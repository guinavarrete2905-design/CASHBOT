import { describe, expect, it } from 'vitest'
import { evaluateRow, type BulkContext } from '../model'
import { parseCsv, detectDelimiter } from './csv'
import { decodeText } from './decode'
import { FATURA_XLSX_BASE64 } from './fixtures'
import { parseAmountCell, parseDateCell, readRows, suggestOptions } from './mapping'
import { ofxAmountToCents, parseOfx } from './ofx'
import { importedToRows } from './toRows'
import { excelSerialToISO, readXlsx } from './xlsx'

const ctx: BulkContext = {
  today: '2026-10-14',
  accounts: [
    { id: 'itau', name: 'Itaú', type: 'checking', archived: false },
    { id: 'nu', name: 'Nubank', type: 'credit_card', archived: false },
  ],
  categories: [
    { id: 'food', name: 'Alimentação', kind: 'expense', archived: false },
    { id: 'transp', name: 'Transporte', kind: 'expense', archived: false },
    { id: 'salary', name: 'Salário', kind: 'income', archived: false },
  ],
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

describe('decodificação', () => {
  it('UTF-8 com BOM e Windows-1252', () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0xc3, 0xa7]))).toBe('Aç')
    expect(decodeText(new Uint8Array([0x41, 0xe7, 0xe3, 0x6f]))).toBe('Ação')
  })
})

describe('CSV', () => {
  it('detecta ";" e lê aspas', () => {
    const text = 'Data;Histórico;Valor\n05/10/2026;"PIX ""João""; parcela";-50,00\n06/10/2026;Salário;3.000,00\n'
    expect(detectDelimiter(text)).toBe(';')
    expect(parseCsv(text)).toEqual([
      ['Data', 'Histórico', 'Valor'],
      ['05/10/2026', 'PIX "João"; parcela', '-50,00'],
      ['06/10/2026', 'Salário', '3.000,00'],
    ])
  })
  it('detecta "," (formato Nubank)', () => {
    const text = 'date,title,amount\n2026-10-03,Supermercado Dia,89.90\n2026-10-04,Uber *Trip,23.45\n'
    expect(detectDelimiter(text)).toBe(',')
  })
})

describe('datas e valores do arquivo', () => {
  it('datas', () => {
    expect(parseDateCell('05/10/2026', 'dmy')).toBe('2026-10-05')
    expect(parseDateCell('05/10/26', 'dmy')).toBe('2026-10-05')
    expect(parseDateCell('2026-10-05', 'dmy')).toBe('2026-10-05')
    expect(parseDateCell('10/05/2026', 'mdy')).toBe('2026-10-05')
    expect(parseDateCell('31/02/2026', 'dmy')).toBeNull()
    expect(parseDateCell(46299, 'dmy')).toBe(excelSerialToISO(46299))
    expect(excelSerialToISO(45931)).toBe('2025-10-01')
  })
  it('valores em formato brasileiro e americano', () => {
    expect(parseAmountCell('-1.234,56', 'br')).toBe(-123456)
    expect(parseAmountCell('R$ 1.234,56', 'br')).toBe(123456)
    expect(parseAmountCell('(12,34)', 'br')).toBe(-1234)
    expect(parseAmountCell('12,34-', 'br')).toBe(-1234)
    expect(parseAmountCell('12,34 D', 'br')).toBe(-1234)
    expect(parseAmountCell('12,34 C', 'br')).toBe(1234)
    expect(parseAmountCell('1,234.56', 'us')).toBe(123456)
    expect(parseAmountCell('89.90', 'us')).toBe(8990)
    expect(parseAmountCell(250.9, 'br')).toBe(25090)
    expect(parseAmountCell('abc', 'br')).toBeNull()
  })
})

describe('extrato CSV de banco', () => {
  const text = [
    'Extrato de conta corrente',
    '',
    'Data;Lançamento;Valor;Saldo',
    '01/10/2026;Saldo anterior;;1.000,00',
    '05/10/2026;SUPERMERCADO PAO DE ACUCAR;-250,90;749,10',
    '06/10/2026;SALARIO EMPRESA X;5.000,00;5.749,10',
    '07/10/2026;POSTO IPIRANGA;-120,00;5.629,10',
    'xx/10/2026;Linha estranha;-1,00;',
  ].join('\n')
  it('detecta cabeçalho, colunas e formato e lê as linhas', () => {
    const grid = parseCsv(text)
    const o = suggestOptions(grid, 'negative-is-out')
    expect(o.headerRow).toBe(1)
    expect(o.roles).toMatchObject({ date: 0, description: 1, amount: 2 })
    expect(o.numberFormat).toBe('br')
    const { transactions, skipped } = readRows(grid, o)
    expect(transactions.map((t) => [t.date, t.description, t.cents, t.direction])).toEqual([
      ['2026-10-05', 'SUPERMERCADO PAO DE ACUCAR', 25090, 'out'],
      ['2026-10-06', 'SALARIO EMPRESA X', 500000, 'in'],
      ['2026-10-07', 'POSTO IPIRANGA', 12000, 'out'],
    ])
    expect(skipped.map((s) => s.reason)).toEqual(['linha de saldo ou total', 'data “xx/10/2026” não reconhecida'])
  })
  it('vira linhas válidas da planilha, com categoria sugerida', () => {
    const grid = parseCsv(text)
    const { transactions } = readRows(grid, suggestOptions(grid, 'negative-is-out'))
    const rows = importedToRows(transactions, { source: 'statement', accountId: 'itau', categories: ctx.categories, fileName: 'extrato.csv' })
    expect(rows.map((r) => [r.kind, r.amount, r.accountId, r.categoryId])).toEqual([
      ['expense', '250,90', 'itau', 'food'],
      ['income', '5.000,00', 'itau', 'salary'],
      ['expense', '120,00', 'itau', 'transp'],
    ])
    expect(rows.every((r) => evaluateRow(r, ctx).state === 'valid')).toBe(true)
  })
  it('colunas separadas de crédito e débito', () => {
    const grid = parseCsv('Data;Descrição;Crédito;Débito\n05/10/2026;Mercado;;250,90\n06/10/2026;Salário;5.000,00;\n')
    const o = suggestOptions(grid, 'negative-is-out')
    expect(o.roles).toMatchObject({ credit: 2, debit: 3, amount: null })
    expect(readRows(grid, o).transactions.map((t) => [t.cents, t.direction])).toEqual([
      [25090, 'out'],
      [500000, 'in'],
    ])
  })
})

describe('fatura CSV (Nubank)', () => {
  it('positivo = compra; negativo = pagamento/estorno', () => {
    const grid = parseCsv('date,title,amount\n2026-10-03,Supermercado Dia,89.90\n2026-10-04,Uber *Trip,23.45\n2026-10-08,Pagamento recebido,-850.00\n2026-10-09,Estorno de compra,-10.00\n')
    const o = suggestOptions(grid, 'positive-is-out')
    expect(o.numberFormat).toBe('us')
    const { transactions } = readRows(grid, o)
    const rows = importedToRows(transactions, { source: 'card', accountId: 'nu', categories: ctx.categories, fileName: 'fatura.csv' })
    expect(rows.map((r) => [r.kind, r.amount, r.accountId, r.transferAccountId])).toEqual([
      ['expense', '89,90', 'nu', ''],
      ['expense', '23,45', 'nu', ''],
      ['transfer', '850,00', '', 'nu'],
      ['income', '10,00', 'nu', ''],
    ])
    // Pagamento da fatura fica incompleto até o usuário escolher a conta de origem.
    expect(evaluateRow(rows[2], ctx).state).toBe('incomplete')
  })
})

describe('OFX', () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>-250.90
<FITID>abc1
<MEMO>COMPRA CARTAO - SUPERMERCADO &amp; CIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261006
<TRNAMT>5000,00
<FITID>abc2
<NAME>SALARIO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261340
<TRNAMT>-1.00
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
  it('lê transações SGML, com vírgula ou ponto', () => {
    const r = parseOfx(ofx)
    expect(r.source).toBe('bank')
    expect(r.transactions).toEqual([
      { date: '2026-10-05', cents: -25090, description: 'COMPRA CARTAO - SUPERMERCADO & CIA', fitid: 'abc1', type: 'DEBIT' },
      { date: '2026-10-06', cents: 500000, description: 'SALARIO', fitid: 'abc2', type: 'CREDIT' },
    ])
    expect(r.skipped).toEqual([{ line: 3, reason: 'data inexistente' }])
  })
  it('reconhece cartão de crédito (OFX 2.x em XML)', () => {
    const xml = '<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261003</DTPOSTED><TRNAMT>-89.90</TRNAMT><MEMO>Mercado</MEMO></STMTTRN></BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>'
    const r = parseOfx(xml)
    expect(r.source).toBe('card')
    expect(r.transactions[0]).toMatchObject({ date: '2026-10-03', cents: -8990, description: 'Mercado' })
  })
  it('valores', () => {
    expect(ofxAmountToCents('-1234.5')).toBe(-123450)
    expect(ofxAmountToCents('+50')).toBe(5000)
    expect(ofxAmountToCents('abc')).toBeNull()
  })
})

describe('XLSX', () => {
  it('lê planilhas, datas formatadas, números e textos com caracteres especiais', async () => {
    const sheets = await readXlsx(base64ToBytes(FATURA_XLSX_BASE64))
    expect(sheets.map((s) => s.name)).toEqual(['Fatura', 'Resumo'])
    const grid = sheets[0].rows
    expect(grid[1]).toEqual(['Data', 'Estabelecimento', 'Valor (R$)'])
    expect(grid[2]).toEqual(['2026-10-03', 'SUPERMERCADO EXTRA & CIA', 250.9])
    expect(grid[3]).toEqual(['2026-10-05', 'POSTO SHELL <BR>', 120])
  })
  it('fatura em XLSX vira linhas', async () => {
    const grid = (await readXlsx(base64ToBytes(FATURA_XLSX_BASE64)))[0].rows
    const o = suggestOptions(grid, 'positive-is-out')
    expect(o.headerRow).toBe(1)
    const { transactions, skipped } = readRows(grid, o)
    expect(transactions.map((t) => [t.date, t.cents, t.direction])).toEqual([
      ['2026-10-03', 25090, 'out'],
      ['2026-10-05', 12000, 'out'],
      ['2026-10-08', 85000, 'in'],
      ['2026-10-09', 3050, 'in'],
    ])
    expect(skipped.map((s) => s.reason)).toEqual(['linha de saldo ou total'])
  })
  it('arquivo que não é XLSX', async () => {
    let message = ''
    try {
      await readXlsx(new Uint8Array([1, 2, 3, 4]))
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toBe('O arquivo não é um XLSX válido.')
  })
})
