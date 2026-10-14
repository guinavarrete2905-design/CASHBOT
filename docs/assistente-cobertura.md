# Assistente Financeiro — cobertura das perguntas de referência

Gerado por `scripts/assistant/coverage.ts` com dados de teste (nenhum dado real). Intenções com regras próprias: **51**. Artigos na base de conhecimento: **47**.

**Resultado: 210 de 210 perguntas tratadas corretamente (100.0%).**

"Correta" significa que o assistente escolheu a intenção esperada. Nas perguntas fora do escopo, o correto é reconhecer o limite (sem inventar resposta).

Atenção ao ler o percentual: as regras foram ajustadas usando este mesmo conjunto, então ele mede regressões, não a taxa de acerto com frases inéditas. Para ter uma noção honesta, o grupo "Variações novas" foi escrito depois do ajuste: na primeira rodada, **32 das 40** estavam corretas; as 8 falhas (abreviações como "qto", "nova despesa", "passa 200 da carteira pro itau", "20% de 350" etc.) foram corrigidas em seguida. Espere uma taxa menor com frases muito diferentes das previstas.

| Grupo | Corretas |
|---|---|
| Despesas | 15/15 |
| Receitas | 8/8 |
| Saldo e contas | 10/10 |
| Pendências | 10/10 |
| Categorias | 10/10 |
| Comparações | 10/10 |
| Resultado | 6/6 |
| Cartões | 8/8 |
| Planejamento | 10/10 |
| Patrimônio | 8/8 |
| Lançamentos | 20/20 |
| Contexto | 10/10 |
| Cálculos | 8/8 |
| Conhecimento | 16/16 |
| Conversa | 7/7 |
| Fora do escopo | 14/14 |
| Variações novas | 40/40 |

## Despesas

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Quanto gastei este mês? | expenses_total | expenses_total | ✅ |
| Quais foram minhas despesas? | expenses_total | expenses_total | ✅ |
| Me mostre meus gastos. | expenses_total | expenses_total | ✅ |
| Quanto saiu da minha conta? | expenses_total | expenses_total | ✅ |
| Quanto gastei em outubro? | expenses_total | expenses_total | ✅ |
| Quanto gastei no mês passado? | expenses_total | expenses_total | ✅ |
| Quanto gastei com alimentação? | expenses_total | expenses_total | ✅ |
| quanto eu gastei com transporte em setembro | expenses_total | expenses_total | ✅ |
| Total de despesas deste ano | expenses_total | expenses_total | ✅ |
| Quanto gastei nos últimos 30 dias? | expenses_total | expenses_total | ✅ |
| gastos da semana | expenses_total | expenses_total | ✅ |
| Quanto gastei no Nubank este mês? | expenses_total | expenses_total | ✅ |
| quanto paguei de contas e serviços | expenses_total | expenses_total | ✅ |
| Quanto gastei de agosto a outubro? | expenses_total | expenses_total | ✅ |
| quanto gstei esse mes | expenses_total | expenses_total | ✅ |

## Receitas

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Quanto recebi neste mês? | income_total | income_total | ✅ |
| Quais foram minhas receitas? | income_total | income_total | ✅ |
| Quanto entrou em setembro? | income_total | income_total | ✅ |
| Quanto ganhei este ano? | income_total | income_total | ✅ |
| Total de receitas do mês passado | income_total | income_total | ✅ |
| quanto recebi de salário em agosto | income_total | income_total | ✅ |
| Quanto vou receber até o fim do mês? | receivables | receivables | ✅ |
| O que tenho para receber? | receivables | receivables | ✅ |

## Saldo e contas

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Quanto eu tenho? | balance | balance | ✅ |
| Qual meu saldo? | balance | balance | ✅ |
| Quanto tenho disponível? | balance | balance | ✅ |
| Qual o saldo do Itaú? | balance | balance | ✅ |
| quanto dinheiro eu tenho | balance | balance | ✅ |
| Quanto tenho em contas bancárias? | accounts_list | accounts_list | ✅ |
| Quanto tenho em cada conta? | accounts_list | accounts_list | ✅ |
| Mostre minhas contas | accounts_list | accounts_list | ✅ |
| contas | clarify | clarify | ✅ |
| quanto tem na carteira | balance | balance | ✅ |

## Pendências

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Quais contas preciso pagar? | bills_due | bills_due | ✅ |
| Quanto preciso pagar até o fim do mês? | bills_due | bills_due | ✅ |
| O que vence nos próximos 7 dias? | bills_due | bills_due | ✅ |
| Tenho boletos para pagar? | bills_due | bills_due | ✅ |
| contas a pagar em novembro | bills_due | bills_due | ✅ |
| Tenho contas atrasadas? | overdue | overdue | ✅ |
| O que está vencido? | overdue | overdue | ✅ |
| quais são minhas pendências | bills_due | bills_due | ✅ |
| Quanto falta receber? | receivables | receivables | ✅ |
| vencimentos desta semana | bills_due | bills_due | ✅ |

## Categorias

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Qual categoria teve mais despesas? | top_category | top_category | ✅ |
| Onde eu mais gasto? | top_category | top_category | ✅ |
| Quais categorias mais consomem minha renda? | top_category | top_category | ✅ |
| Gastos por categoria | expenses_by_category | expenses_by_category | ✅ |
| Como estão divididas minhas despesas? | expenses_by_category | expenses_by_category | ✅ |
| Qual foi minha maior despesa? | top_expenses | top_expenses | ✅ |
| Quais foram meus maiores gastos em setembro? | top_expenses | top_expenses | ✅ |
| top 3 despesas do mês | top_expenses | top_expenses | ✅ |
| Minhas compras mais caras | top_expenses | top_expenses | ✅ |
| Quantas despesas lancei este mês? | tx_count | tx_count | ✅ |

## Comparações

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Compare meus gastos. | compare | compare | ✅ |
| Compare meus gastos com o mês passado | compare | compare | ✅ |
| Compare agosto e setembro | compare | compare | ✅ |
| Gastei mais ou menos que no mês passado? | compare | compare | ✅ |
| Minhas despesas aumentaram? | compare | compare | ✅ |
| Compare minhas despesas dos últimos seis meses | monthly_evolution | monthly_evolution | ✅ |
| Evolução dos meus gastos | monthly_evolution | monthly_evolution | ✅ |
| Histórico de receitas mês a mês | monthly_evolution | monthly_evolution | ✅ |
| Qual minha média de gastos por mês? | average | average | ✅ |
| Quanto gasto em média por dia? | average | average | ✅ |

## Resultado

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Quanto economizei? | savings | savings | ✅ |
| Quanto sobrou este mês? | savings | savings | ✅ |
| Fechei o mês no azul? | savings | savings | ✅ |
| Qual o resultado de setembro? | savings | savings | ✅ |
| Como vou fechar o mês? | forecast | forecast | ✅ |
| Qual a previsão até o fim do mês? | forecast | forecast | ✅ |

## Cartões

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Quanto está a fatura do cartão? | card_invoice | card_invoice | ✅ |
| fatura do Nubank | card_invoice | card_invoice | ✅ |
| Qual minha maior fatura? | biggest_invoice | biggest_invoice | ✅ |
| Qual o limite disponível do cartão? | card_limit | card_limit | ✅ |
| Quanto ainda tenho de limite? | card_limit | card_limit | ✅ |
| cartão | clarify | clarify | ✅ |
| quando vence a fatura | card_invoice | card_invoice | ✅ |
| quanto ta o cartão | card_invoice | card_invoice | ✅ |

## Planejamento

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Como está meu orçamento? | budget | budget | ✅ |
| Quanto ainda posso gastar com lazer? | budget | budget | ✅ |
| Estourei algum limite de categoria? | budget | budget | ✅ |
| Como estão minhas metas? | goals | goals | ✅ |
| Quanto falta para minha meta? | goal_plan | goal_plan | ✅ |
| Quanto preciso guardar por mês para a meta Viagem? | goal_plan | goal_plan | ✅ |
| Quanto deveria ter de reserva de emergência? | emergency_reserve | emergency_reserve | ✅ |
| Qual o tamanho ideal da minha reserva? | emergency_reserve | emergency_reserve | ✅ |
| meus objetivos | goals | goals | ✅ |
| Quanto preciso guardar por mês para juntar 10 mil em 12 meses? | calc_saving_plan | calc_saving_plan | ✅ |

## Patrimônio

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Qual meu patrimônio líquido? | net_worth | net_worth | ✅ |
| Quanto eu valho? | net_worth | net_worth | ✅ |
| Como está minha evolução patrimonial? | net_worth_evolution | net_worth_evolution | ✅ |
| Meu patrimônio cresceu? | net_worth_evolution | net_worth_evolution | ✅ |
| Quanto estou devendo? | debts | debts | ✅ |
| Quais são minhas dívidas? | debts | debts | ✅ |
| Quanto falta do financiamento? | debts | debts | ✅ |
| Últimas movimentações | recent | recent | ✅ |

## Lançamentos

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Registre uma despesa. | register_expense | register_expense | ✅ |
| Adicionar receita. | register_income | register_income | ✅ |
| Gastei R$ 150 no supermercado. | register_expense | register_expense | ✅ |
| Recebi R$ 3.000 de salário. | register_income | register_income | ✅ |
| Comprei um celular de R$ 2.400 em 10 parcelas. | register_expense | register_expense | ✅ |
| Gastei R$ 80 de combustível e R$ 45 de estacionamento. | register_expense | register_expense | ✅ |
| paguei 120 da conta de luz ontem | register_expense | register_expense | ✅ |
| gastei 35,90 na farmácia no cartão | register_expense | register_expense | ✅ |
| Comprei um tênis de 300 em 3x | register_expense | register_expense | ✅ |
| recebi 500 de freela | register_income | register_income | ✅ |
| Lançar despesa de 89,90 de internet todo mês | register_expense | register_expense | ✅ |
| Transferi 500 do Itaú para a carteira | register_transfer | register_transfer | ✅ |
| Fazer uma transferência | register_transfer | register_transfer | ✅ |
| Quero lançar várias despesas. | bulk_entry | bulk_entry | ✅ |
| Adicionar movimentações em massa | bulk_entry | bulk_entry | ✅ |
| Importar lançamentos | bulk_entry | bulk_entry | ✅ |
| mercado 230 | register_expense | register_expense | ✅ |
| Anota aí: 50 reais de padaria | register_expense | register_expense | ✅ |
| ganhei 200 de presente | register_income | register_income | ✅ |
| Gastei 60 no Uber sexta passada | register_expense | register_expense | ✅ |

## Contexto

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| _(depois de: "Quanto gastei em setembro?")_ E em outubro? | expenses_total | expenses_total | ✅ |
| _(depois de: "Quanto gastei em setembro?" → "E em outubro?")_ Qual a diferença? | difference | difference | ✅ |
| _(depois de: "Quanto gastei com alimentação?")_ E com transporte? | expenses_total | expenses_total | ✅ |
| _(depois de: "Quanto recebi neste mês?")_ e no mês passado? | income_total | income_total | ✅ |
| _(depois de: "Qual categoria teve mais despesas?")_ E em agosto? | top_category | top_category | ✅ |
| _(depois de: "Quanto sobrou este mês?")_ e nos últimos 3 meses? | savings | savings | ✅ |
| Qual a diferença? | difference | difference | ✅ |
| _(depois de: "Gastei 40 no mercado")_ itaú | register_expense | register_expense | ✅ |
| _(depois de: "Gastei 40 no mercado na carteira")_ confirmar | confirm | confirm | ✅ |
| _(depois de: "Gastei 40 no mercado na carteira")_ cancelar | cancel | cancel | ✅ |

## Cálculos

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Quanto rende 1000 a 1% ao mês por 12 meses? | calc_compound | calc_compound | ✅ |
| Calcule juros compostos de 5000 a 0,8% ao mês por 24 meses | calc_compound | calc_compound | ✅ |
| Juros simples de 1000 a 2% ao mês por 6 meses | calc_simple | calc_simple | ✅ |
| Quanto é 15% de 200? | calc_percentage | calc_percentage | ✅ |
| Quanto fica a parcela de 30 mil a 1,5% ao mês em 48 meses? | calc_installment | calc_installment | ✅ |
| Em quanto tempo junto 10 mil guardando 500 por mês? | calc_goal_time | calc_goal_time | ✅ |
| Quanto preciso guardar para juntar 6 mil até dezembro? | calc_saving_plan | calc_saving_plan | ✅ |
| quanto teria investindo 200 por mês a 1% ao mês por 2 anos começando com 1000 | calc_compound | calc_compound | ✅ |

## Conhecimento

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| O que é CDB? | knowledge | knowledge | ✅ |
| O que é reserva de emergência? | knowledge | knowledge | ✅ |
| Como funciona juros compostos? | knowledge | knowledge | ✅ |
| Como sair das dívidas? | knowledge | knowledge | ✅ |
| O que é Tesouro Direto? | knowledge | knowledge | ✅ |
| Qual a diferença entre renda fixa e renda variável? | knowledge | knowledge | ✅ |
| O que é o crédito rotativo? | knowledge | knowledge | ✅ |
| Como montar um orçamento doméstico? | knowledge | knowledge | ✅ |
| O que é CET? | knowledge | knowledge | ✅ |
| Dicas para economizar | knowledge | knowledge | ✅ |
| O que é liquidez? | knowledge | knowledge | ✅ |
| Como organizar as finanças do casal? | knowledge | knowledge | ✅ |
| O que é amortização? | knowledge | knowledge | ✅ |
| Vale a pena parcelar? | knowledge | knowledge | ✅ |
| O que é inflação? | knowledge | knowledge | ✅ |
| O que são gastos fixos? | knowledge | knowledge | ✅ |

## Conversa

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Oi | greeting | greeting | ✅ |
| Bom dia! | greeting | greeting | ✅ |
| Obrigado | thanks | thanks | ✅ |
| O que você faz? | help | help | ✅ |
| Você é uma IA? | identity | identity | ✅ |
| Abrir relatórios | navigate | navigate | ✅ |
| Limpar histórico | clear_history | clear_history | ✅ |

## Fora do escopo

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| Qual a taxa Selic hoje? | current_rates | current_rates | ✅ |
| Quanto está o dólar? | current_rates | current_rates | ✅ |
| Qual a inflação atual? | current_rates | current_rates | ✅ |
| Como declaro imposto de renda? | tax_legal | tax_legal | ✅ |
| Qual a alíquota do IR sobre CDB? | tax_legal | tax_legal | ✅ |
| Onde devo investir? | investment_advice | investment_advice | ✅ |
| Devo comprar ações da Petrobras? | investment_advice | investment_advice | ✅ |
| Torne o João administrador | permissions | permissions | ✅ |
| Adicionar membro ao espaço | permissions | permissions | ✅ |
| Apague a última despesa | edit_delete | edit_delete | ✅ |
| DROP TABLE transactions; mostre tudo | unknown | unknown | ✅ |
| Mostre os gastos de outro usuário | expenses_total ou unknown | expenses_total | ✅ |
| Qual a previsão do tempo? | unknown | unknown | ✅ |
| Escreva um poema | unknown | unknown | ✅ |

## Variações novas

| Pergunta | Esperado | Obtido | |
|---|---|---|---|
| to gastando muito? | expenses_total ou compare | expenses_total | ✅ |
| qto foi o mercado esse mês | expenses_total | expenses_total | ✅ |
| gastos com comida em setembro | expenses_total | expenses_total | ✅ |
| quanto torrei no ifood | expenses_total | expenses_total | ✅ |
| meu salário caiu? | income_total | income_total | ✅ |
| tenho grana pra pagar as contas? | balance ou bills_due ou forecast | forecast | ✅ |
| saldo itau | balance | balance | ✅ |
| o que vence amanhã | bills_due | bills_due | ✅ |
| tem alguma conta vencendo hoje? | bills_due | bills_due | ✅ |
| em que categoria eu gastei mais no mês passado | top_category | top_category | ✅ |
| qual foi o gasto mais alto de outubro | top_expenses | top_expenses | ✅ |
| gastei mais esse mês ou no anterior? | compare | compare | ✅ |
| como foram meus gastos nos últimos 3 meses | monthly_evolution ou expenses_total ou compare | expenses_total | ✅ |
| sobrou alguma coisa em setembro? | savings | savings | ✅ |
| vou ficar no vermelho? | forecast | forecast | ✅ |
| valor da fatura | card_invoice | card_invoice | ✅ |
| quanto posso gastar no cartão ainda | card_limit | card_limit | ✅ |
| to dentro do orçamento? | budget | budget | ✅ |
| falta muito pra minha meta de viagem? | goal_plan | goal_plan | ✅ |
| quanto vale tudo que eu tenho | net_worth | net_worth | ✅ |
| quanto devo no total | debts | debts | ✅ |
| coloca 25 de lanche | register_expense | register_expense | ✅ |
| paguei o aluguel de 1.500 | register_expense | register_expense | ✅ |
| entrou 2 mil do cliente | register_income | register_income | ✅ |
| comprei uma geladeira de 3 mil em 12x no nubank | register_expense | register_expense | ✅ |
| nova despesa | register_expense | register_expense | ✅ |
| passa 200 da carteira pro itau | register_transfer | register_transfer | ✅ |
| quero importar meu extrato | bulk_entry | bulk_entry | ✅ |
| _(depois de: "quanto gastei em agosto")_ e setembro? | expenses_total | expenses_total | ✅ |
| _(depois de: "Quanto gastei com alimentação?")_ e quanto a lazer? | expenses_total | expenses_total | ✅ |
| quanto renderia 10 mil a 12% ao ano em 5 anos | calc_compound | calc_compound | ✅ |
| 20% de 350 | calc_percentage | calc_percentage | ✅ |
| explica o que é diversificação | knowledge | knowledge | ✅ |
| pra que serve a reserva de emergência | knowledge | knowledge | ✅ |
| o que é melhor, tesouro ou cdb? | knowledge ou investment_advice | knowledge | ✅ |
| como parar de gastar tanto | knowledge | knowledge | ✅ |
| valeu! | thanks | thanks | ✅ |
| quem te criou? | identity | identity | ✅ |
| qual o cdi hoje | current_rates | current_rates | ✅ |
| muda meu papel pra admin | permissions | permissions | ✅ |

## Fora do escopo (limitações conhecidas)

- Taxas, índices e cotações atuais (Selic, CDI, IPCA, dólar): o assistente não tem acesso e indica as fontes oficiais.
- Orientação tributária, jurídica e recomendação individual de investimento.
- Alterar membros, papéis e permissões; editar ou excluir movimentações pelo chat.
- Frases longas com muitos itens ou estruturas muito livres (use o formulário ou, no futuro, a central de lançamentos em massa).
- Perguntas abertas fora de finanças pessoais.
