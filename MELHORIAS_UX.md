# BovIA — Melhorias de UX e plano de execução

Documento de trabalho, criado em **2026-09-03**, a partir da inspeção do app rodando
em 390×844 (mobile) com conta nova (vazia) e com dados.

**Público-alvo:** produtor de 50–500 cabeças, pouca intimidade com aplicativo,
celular na mão, sinal ruim no curral.

**Princípio que guia a ordem abaixo:** o produtor não abandona um app porque falta
funcionalidade — abandona porque cada uso custa tempo demais. Primeiro tiramos o atrito
do que ele já faz; depois entregamos o que ele ainda não tem.

> ⚠️ Nada aqui é urgente antes do retorno do seu sócio com produtores reais.
> Se um deles disser "eu não levo celular pro curral", a Fase 3 muda de forma inteira.
> Use este arquivo para decidir **o que fazer quando decidir fazer** — não como fila obrigatória.

---

**Legenda:** ✅ feito · 🟡 parcial · ⬜ pendente · ⛔ descartado (com o motivo registrado)

## Visão geral das fases

| Fase | O que entrega | Itens | Esforço | Backend? |
|------|---------------|-------|---------|----------|
| **1** | ✅ Acabamento — tira o "cheiro de inacabado" | 1–4 | **feito** | Não |
| **2** | ✅ Atrito diário — a tela mais usada fica leve | 5–7, 5.0–5.4 | **feito** | Não |
| **3** | ✅ **Modo Curral** — o app vira ferramenta de trabalho | 8 | **feito** | Sim |
| **4** | "Quando vender?" — resposta de negócio | 9 | ~1 dia | Sim (leve) |
| **5** | Offline-first — funciona sem sinal | 10 | ~1–2 semanas | Sim (grande) |

Fases 1 e 2 estão fechadas — todo o frontend que dava pra melhorar sem backend já saiu.
A 3 é a que muda o produto. A 5 só depois de validar a demanda.

---

# FASE 1 — Acabamento ✅ CONCLUÍDA (2026-09-09)

Quatro correções pontuais. Tudo CSS e cópia, sem tocar em backend. É o melhor retorno
por hora investida: some com a sensação de protótipo.

**Resultado:** 3 correções aplicadas e verificadas no navegador em 390 px; 1 item
(o nº 2) se revelou alarme falso na verificação e foi descartado sem alteração.
`tsc --noEmit` limpo.

## 1. Onboarding espremido no celular — ✅ FEITO (2026-09-09)

**Problema.** Os três cards do "Vamos começar!" usam layout horizontal
(número · texto · botão). Em 390 px sobra uma coluna de texto estreitíssima e o
título quebra em três linhas: *"Crie seu / primeiro / lote"*. É a **primeira tela**
que um usuário novo vê.

**Onde.** `frontend/src/pages/Dashboard.tsx` — bloco do onboarding (~linhas 104–125),
o `<div>` com `display: 'flex', gap: 22, alignItems: 'center'`.

**Como.**
1. Trocar os estilos inline por uma classe `.onboard-step` no `index.css`.
2. Desktop: mantém a linha horizontal atual.
3. Mobile (`max-width: 768px`): `flex-direction: column; align-items: flex-start;`
   — número e título em cima, descrição abaixo, botão em `width: 100%`.
4. Reduzir o quadrado do número de 64 px para 48 px no mobile.

**Pronto quando.** Em 390 px, nenhum dos três títulos quebra em mais de duas linhas
e o botão ocupa a largura do card.

---

## 2. ~~"Comprar / Vender" aparece cortado~~ — ⛔ ALARME FALSO, descartado

**Não era bug.** Medido no DOM em 390 px: o rótulo renderiza em **uma linha, texto
completo**, com `overflow: visible` e sem `white-space: nowrap`. O tile tem
`min-height` (não altura fixa), então cresceria se precisasse.

O que eu tinha visto era **artefato do screenshot de página inteira**: a barra de
navegação inferior é `position: fixed` e, na captura full-page, ela se sobrepõe ao
conteúdo do meio da página — cobrindo justamente esse tile.

**Lição para as próximas inspeções.** Não diagnosticar corte de texto por screenshot
full-page com elementos `fixed`. Medir no DOM (`scrollWidth` vs `clientWidth`) ou
capturar só o viewport.

---

## 3. KPI zerado parece defeito — ✅ FEITO (2026-09-09)

**Problema.** Com rebanho cadastrado mas **sem venda registrada**, o "Resultado do Mês"
mostra `R$ 0`, `R$ 0,00` e uma **Rentabilidade com um traço vermelho**. Parece que a
conta quebrou — não que falta dado. O usuário novo conclui que o app está com erro.

**Onde.** `frontend/src/pages/Dashboard.tsx:238–247` — o `.kpi-big` de Rentabilidade,
onde `fin.rentabilidade_pct` vem `null`.

**Como.**
1. Quando `fin.rentabilidade_pct == null` **e** não há movimentações de venda no período:
   trocar o valor por uma frase curta em `var(--gray-500)`:
   **"Registre uma venda para ver"**.
2. Usar o cinza neutro em vez do vermelho — ausência de dado não é resultado negativo.
3. Aplicar a mesma regra a "Lucro do Mês" e "Custo / @" quando ambos forem zero
   por falta de lançamento (não por prejuízo real).

**Cuidado.** Distinguir *"não há dado"* de *"o resultado é zero/negativo"* — um prejuízo
real **deve** aparecer em vermelho.

**Pronto quando.** Conta nova com animais cadastrados e nenhuma venda mostra frases
explicativas, não `R$ 0` em vermelho.

---

## 4. O cabeçalho mostra zeros que não informam — ✅ FEITO (2026-09-09)

**Problema.** Em um lote só de machos, "Seu Rebanho" exibe **0 FÊMEAS** ocupando um
quadrante inteiro do hero — espaço nobre gasto com ausência de informação.

**Onde.** `frontend/src/pages/Dashboard.tsx:137–155` — os quatro `.field-hero-stat`.

**Como.** Envolver "Machos" e "Fêmeas" em condicional (`{data.total_machos > 0 && ...}`),
como já é feito com `peso_medio_kg` na linha 151. O grid de 2 colunas no mobile
reflui sozinho.

**Pronto quando.** Rebanho só de machos mostra três números (Animais, Machos, Peso Médio),
sem quadrante vazio.

---

# FASE 2 — Atrito diário ✅ CONCLUÍDA

A tela de Animais é a mais aberta do app. Hoje ela cobra rolagem e paciência todo dia.

**Itens 5, 6 e 7 — ✅ feitos em 2026-09-09.** Medido em 390 px: cartão de
**250 px → 73 px** (−71%, como projetado); o primeiro animal agora aparece sem rolagem;
menu com nenhum bloco acima de 6 itens. Desktop conferido intacto
(10 `<th>` = 10 `<td>` visíveis, filtros todos na barra). As outras telas de cartões
seguem no formato antigo — a variante compacta é opt-in via `.table-cards-compact`.

**Itens 5.0 a 5.4 — ✅ feitos em 2026-09-13.** Cartão compacto estendido às quatro
telas que rendiam. Medido em 390 px:

| Tela | Antes | Depois |
|---|---|---|
| Movimentações | 433 px | **73 px** |
| Saúde | 372 px | **110 px** |
| Pesagens | 291 px | **111 px** |
| Reprodução | — | **132 px** |

Desktop conferido nas quatro: `<th>` = `<td>` visíveis, linhas como `table-row`.

### Bug encontrado e corrigido no caminho (não estava no plano)

Ao verificar Pesagens, o cartão exibiu **`#725`** — o id cru — no lugar do brinco.
Causa: Pesagens, Saúde e Reprodução carregavam a lista de animais com
`status: 'ativo'`, então o mapa de exibição não continha animais **vendidos/mortos**
e caía no `animal_id`. Movimentações já fazia certo (busca sem filtro de status).

É um bug **pré-existente**, mas o cartão compacto promoveu o brinco a herói da linha 1 —
um id cru ali é pior do que era na tabela antiga, então foi corrigido junto:

- a busca que alimenta o **mapa de exibição** passou a trazer todos os animais;
- o dropdown de **cadastro** (registrar pesagem/saúde/reprodução) passou a filtrar
  `status === 'ativo'` no cliente — não faz sentido lançar em animal vendido;
- o dropdown de **filtro** segue listando todos, de propósito: rever o histórico de
  um animal vendido é caso de uso legítimo.

## 5. Card do animal: 8 linhas com o mesmo peso visual — ✅ FEITO (2026-09-09)

**Problema.** Cada animal ocupa 8 linhas — brinco, nome, raça, sexo, categoria, lote,
peso, status — todas na mesma hierarquia visual. Em um lote homogêneo, **cinco delas
repetem o mesmo valor** em todos os cards ("Nelore", "Macho", "Garrote", "Pasto Alto"),
e "Nome" costuma aparecer vazio como "—". Com 50 por página, isso dá cerca de
**12.500 px de rolagem** para percorrer uma página.

O produtor abre essa tela para responder *"quanto esse bicho está pesando e quanto ganhou"*.
O resto é ruído nesse momento.

**Onde.** `frontend/src/pages/Animais.tsx:398–430` (as células `data-label`)
e o bloco `.table-cards` no `frontend/src/index.css`.

**Como.** No mobile, deixar de renderizar rótulo+valor para tudo. Estrutura alvo:

```
┌──────────────────────────────────────┐
│  #A01              293 kg  [+101 kg] │   ← linha 1: identidade + o número
│  Pasto Alto · Garrote · 0,72 kg/dia  │   ← linha 2: contexto, fonte menor
└──────────────────────────────────────┘
```

1. Marcar as células secundárias com uma classe, ex. `cell-secundaria`
   (Nome, Raça, Sexo, Categoria, Status).
2. No `index.css`, dentro do `@media (max-width: 768px)`:
   `.table-cards td.cell-secundaria { display: none; }`
3. Compor a linha 2 (lote · categoria · GMD) numa única célula nova,
   visível só no mobile, com `font-size: 12px` e `color: var(--gray-500)`.
4. Aumentar brinco e peso para ~19 px, manter o badge de ganho como está
   (ele já funciona bem).
5. **Status** só aparece quando for diferente de "ativo" — animal vendido/morto
   precisa se destacar; ativo é o padrão e não precisa ser dito.

**Ganho.** De ~250 px para ~72 px por card — **71% menos rolagem**.

**Pronto quando.** Uma página de 50 animais cabe em ~3.600 px de rolagem, e brinco,
peso e ganho são legíveis sem esforço a um braço de distância.

---

## 6. Filtros ocupam uma tela antes do primeiro animal — ✅ FEITO (2026-09-09)

**Problema.** Busca + quatro selects empilhados (status, sexo, categoria, lote) ficam
sempre abertos. No celular você rola quase uma tela inteira antes de ver **um único
animal** — e na maioria das vezes não vai filtrar nada.

**Onde.** `frontend/src/pages/Animais.tsx:266–300` — o `<div className="filters-bar">`.

**Como.**
1. Deixar **só o campo de busca** visível por padrão no mobile.
2. Adicionar um botão **"Filtrar"** ao lado, que expande os quatro selects.
3. Mostrar no botão a contagem de filtros ativos: **"Filtrar · 2"**, com destaque
   em `var(--green-800)` quando houver algum ativo — assim o usuário nunca esquece
   que está vendo uma lista filtrada.
4. Um botão **"Limpar filtros"** dentro do painel expandido.
5. No desktop, manter tudo visível como está hoje (lá sobra espaço).

**Pronto quando.** Ao abrir /animais em 390 px, o primeiro animal aparece sem rolagem
(ou com no máximo um leve scroll).

---

## 7. 16 itens no menu, sem agrupamento — ✅ FEITO (2026-09-09)

**Problema.** Dashboard, Agenda, Animais, Lotes, Pastagens, Pesagens, Saúde, Reprodução,
Movimentações, Financeiro, Simulador, Custos Nutri, Despesas Fixas, Gráficos, Relatórios,
Configurações — uma lista corrida de 16. Para quem tem 80 cabeças e pouca intimidade com
aplicativo, dá vontade de fechar.

**Onde.** `frontend/src/components/Layout.tsx:7–72` — o array `navItems`.

**Como.** O menu **não precisa encolher** — precisa parar de parecer uma lista única.
Agrupar em três blocos, usando o `.sidebar-section-label` que já existe no CSS:

- **Rebanho** — Animais, Lotes, Pastagens, Pesagens, Saúde, Reprodução
- **Financeiro** — Movimentações, Financeiro, Custos Nutri, Despesas Fixas
- **Análise** — Gráficos, Relatórios, Simulador

Dashboard e Agenda ficam soltos no topo (uso diário); Configurações solto no fim.

**Opcional.** Deixar o bloco "Análise" recolhido por padrão — são as telas que o
produtor pequeno menos usa.

**Pronto quando.** Nenhum bloco do menu tem mais de 6 itens.

---

## 5.1 — 5.4 Estender o cartão compacto a outras telas — ✅ FEITO (2026-09-13)

O cartão compacto do item 5 valeu tanto que a pergunta natural é: onde mais?
Medi a altura real de cada tela de cartões em 390 px antes de decidir.

| Tela | Colunas | Altura hoje | Células vazias na medição |
|---|---|---|---|
| **Movimentações** | 10 | **433 px** | 4 de 10 (`@`, Origem, Destino, Obs.) |
| **Saúde** | 7 | **372 px** | Medicamento |
| **Pesagens** | 5 | **291 px** | Obs. em **6 de 6** linhas |
| Animais ✅ | 8 | 250 → **73 px** | — |
| Pastagens | 4 | curta | pouca |

**O critério.** Compactar rende onde se **varre** (achar um animal, conferir o rebanho),
não onde se **lê** (abri esse bicho pra ver o histórico inteiro). E a forma **não
transfere igual**: o cartão de Animais funcionou porque tem identidade + **um número
dominante**. Cada tela tem um "herói" diferente, e é ele que vai pra direita da linha 1.

### 5.0 Renomear as classes antes de espalhar — ✅ FEITO

As classes nasceram pensando só em Animais: `cell-brinco`, `cell-peso`. Aplicadas a um
lançamento financeiro, `cell-brinco` passa a mentir.

**Como.** Renomear para nomes neutros antes de usar em outra tela:
`cell-brinco → cell-id`, `cell-peso → cell-destaque`, `cell-resumo` fica como está.
Mexe em `frontend/src/pages/Animais.tsx` e no bloco `.table-cards-compact`
do `frontend/src/index.css`.

**Por que primeiro.** Renomear depois de espalhar por quatro telas custa quatro vezes mais.

---

### 5.1 Pesagens — o herói já é número ✅

Maior retorno por esforço: a forma é **idêntica** à de Animais, quase sem trabalho novo.
"Obs." estava vazia em 6 de 6 linhas na medição.

```
┌──────────────────────────────────────────┐
│  #A02            276,0 kg  [+0,442 kg/dia] │
│  20/08/2026                                │
└──────────────────────────────────────────┘
```

- Secundárias: Obs. (só aparece quando preenchida).
- **Atenção:** o GMD aqui é entre as duas últimas pesagens. Na lista de Animais é a
  média desde a entrada (prefixada com "méd." justamente pra não confundir). Manter
  a distinção.

**Onde.** `frontend/src/pages/Pesagens.tsx`.

---

### 5.2 Movimentações — o herói é o valor ✅

**Maior ganho isolado:** o cartão mais alto do app (433 px) e 40% das células vazias.

```
┌──────────────────────────────────────────┐
│  #A01  Compra              R$ 2.500,00   │
│  01/09/2026 · 200 kg · R$ 12,50/kg       │
└──────────────────────────────────────────┘
```

- Secundárias: `@`, Origem, Destino, Obs. (só quando preenchidas).
- **Diferença em relação a Animais:** compra e venda precisam se distinguir de relance —
  cor ou sinal no valor (venda entra, compra sai). Não basta a palavra.

**Onde.** `frontend/src/pages/Movimentacoes.tsx`.

---

### 5.3 Saúde — o herói NÃO é número, é urgência ✅

Aqui a forma muda de verdade. O produtor não abre Saúde pra ver custo — abre pra saber
**o que está vencendo**. A tela já marca urgência (vi `Próxima: 10/09/2026!` na medição);
é isso que merece a direita da linha 1.

```
┌──────────────────────────────────────────┐
│  #A01  Aftosa           [Urgente · 10/09] │
│  Vacinação · 01/08/2026 · R$ 12,50        │
└──────────────────────────────────────────┘
```

- Herói: **próxima data** com badge de urgência (não o custo).
- Secundárias: Medicamento, Custo (vão pra linha 2).

**Onde.** `frontend/src/pages/Saude.tsx`.

---

### 5.4 Reprodução — o herói é status + data prevista ✅

Mesma lógica do 5.3: o que importa é em que pé está a matriz e quando pare.

```
┌──────────────────────────────────────────┐
│  #A01  Prenha          Parto ~ mai/2027  │
│  Cobertura natural · 01/08/2026 · Touro 7 │
└──────────────────────────────────────────┘
```

- Herói: **Resultado** (prenha / pendente / nasceu / aborto) + **Parto Previsto**.
- Secundárias: Touro, Bezerro (só quando existirem).

**Onde.** `frontend/src/pages/Reproducao.tsx`.

---

### Onde NÃO aplicar — decidido, não esquecido

- **Pastagens** — 4 colunas (Lote, Entrada, Saída, Dias), cartão já curto e sem
  redundância. Compactar não devolve nada.
- **Lotes** — não usa `table-cards`; já tem layout de cartão próprio.
- **Sub-tabelas do detalhe do animal** (`AnimalDetalhe.tsx`) — é tela de **leitura**:
  você escolheu aquele animal justamente pra ver tudo. Já são mais enxutas porque não
  repetem a coluna "Animal". Prioridade baixa.

**Pronto quando.** Pesagens e Movimentações caem para ~2 linhas por cartão, e as outras
telas de cartões seguem inalteradas (a variante continua opt-in via
`.table-cards-compact`).

---

# FASE 3 — Modo Curral ✅ CONCLUÍDA (2026-09-16)

**É o item que muda o produto.** Os outros tiram atrito; este cria a razão de levar
o celular pro serviço.

**O que foi entregue**

- `POST /pesagens/lote` — grava a sessão inteira numa transação
  (`backend/app/routes/pesagens.py`, schemas em `backend/app/schemas/pesagem.py`).
- Tela `/curral` (`frontend/src/pages/ModoCurral.tsx`) + estilos `.curral-*`
  no `index.css`. Atalho "Modo Curral" no topo da tela de Pesagens.

**Decisão de projeto: gravação idempotente por (animal, data).** No curral o sinal cai
e o app reenvia. Em vez de duplicar, o reenvio **atualiza** o peso. Isso também cobre o
caso legítimo de recorrigir um animal no mesmo dia. Verificado: reenviar a mesma sessão
deu `criados: 0, atualizados: 3`, com **um único** registro no banco.

**Verificado no navegador em 390×844**

| Comportamento | Resultado |
|---|---|
| brinco → Enter → peso → Enter → salva | foco volta sozinho pro brinco |
| feedback no ato | "#A01: +13 kg desde a última pesagem" |
| fechar o app no meio | sessão sobreviveu ao reload, com média corrente |
| envio | 3 pesagens no banco, GMD recalculado, sem duplicata |
| brinco novo | "Cadastrar e pesar" criou o animal sem sair da tela |
| corrigir | leitura volta pros campos pra ser regravada |
| alvo de toque | botão principal com 60 px (mínimo de 48 px) |

**Bug pego na verificação.** No desktop a barra fixa de ações usava `left: 0` e passava
**por baixo da sidebar**, escondendo parte do "Salvar e próximo". Corrigido com
`left: 240px` no desktop e `left: 0` no mobile (onde a sidebar é gaveta).

## 8. O fluxo do tronco não existe — ✅ FEITO (2026-09-16)

**Problema.** Hoje há só dois jeitos de pesar, e nenhum é o que se faz na balança:

| Caminho atual | Por que não serve |
|---|---|
| Um por vez pelo modal | Abrir modal → achar o animal no dropdown → digitar → salvar → fechar → repetir. Inviável para 60 animais em fila. |
| `POST /lotes/{id}/pesagens` com `peso_medio_kg` | Grava **o mesmo peso para todos** os animais do lote. Rápido, mas destrói o dado individual — e é justamente o GMD individual que o app promete. |

No curral o ritmo é: animal entra no tronco → lê o brinco → lê o peso → solta → próximo.
Sem tirar a mão do celular, sem navegar.

**Onde.** `frontend/src/pages/Pesagens.tsx` (nova tela) e
`backend/app/routes/pesagens.py` (novo endpoint).

### Backend

Criar `POST /pesagens/lote` recebendo uma lista, em vez de uma chamada por animal
(no curral o sinal cai; mandar 60 requisições separadas é frágil):

```python
class PesagemLoteItem(BaseModel):
    animal_id: int
    peso_kg: float

class PesagemLoteCreate(BaseModel):
    data: date
    itens: List[PesagemLoteItem]

@router.post("/lote", response_model=BulkResult, status_code=201)
def criar_pesagens_lote(...):
    # valida que todos os animais são do usuário, grava tudo numa transação
```

A busca por brinco **já existe**: `GET /animais?busca=A01` (filtra por brinco ou nome,
ver `backend/app/routes/animais.py:80-82`). Não precisa de endpoint novo para isso.

### Frontend — a tela

Tela cheia, **sem modal**, otimizada para uma mão e luva:

1. **Topo:** o lote/pasto selecionado e um contador grande — **"12 de 60"**.
2. **Campo do brinco** em destaque, com `autofocus`. Ao digitar, busca incremental e
   mostra o animal encontrado (nome, categoria, último peso e a data dele).
3. **Campo do peso** com `inputMode="decimal"`, fonte grande (~32 px).
4. **Um único botão, largo, na parte de baixo da tela** (zona do polegar):
   **"Salvar e próximo"**. Ao tocar: grava na fila local, limpa os campos e devolve o
   foco ao brinco.
5. **Feedback imediato:** o ganho desde a última pesagem aparece por um instante
   (ex.: `+18 kg desde 20/08`) — é o número que dá satisfação no ato.
6. **Lista do que já foi pesado** na sessão, rolável, com opção de corrigir o último
   lançamento (errar o peso e não conseguir voltar é frustrante no campo).
7. **Fim:** botão "Concluir" → resumo (quantos animais, peso médio, GMD médio do lote)
   → envia tudo de uma vez pelo `POST /pesagens/lote`.

### Detalhes que fazem diferença no campo

- **Não travar em erro de rede.** Guardar a sessão inteira no `localStorage` e só
  limpar depois do envio confirmado. Se o app fechar no meio, retomar de onde parou.
- **Alvos de toque grandes** — mínimo 48 px. Luva e tela suja não acertam botão pequeno.
- **Alto contraste** — a tela vai ser lida no sol.
- **Sem confirmação por modal** entre um animal e outro. O fluxo não pode ter passo extra.
- **Brinco não encontrado:** oferecer "cadastrar agora" com só brinco + peso,
  sem sair da tela.

**Pronto quando.** É possível pesar 20 animais seguidos sem sair da tela, sem abrir
modal e sem tirar o foco do campo — e fechar o app no meio não perde nada.

---

# FASE 4 — "Quando vender?"

## 9. O app tem os dados, mas não responde a pergunta de negócio ⬜

**Problema.** Peso, GMD e custo por arroba já estão calculados. Falta a **conclusão**.
O produtor não quer ler três telas e fazer a conta de cabeça — quer a data e o número.
Hoje o app informa; falta ele **aconselhar**.

**Onde.** `frontend/src/pages/AnimalDetalhe.tsx` e o card do animal em `Animais.tsx`;
cálculo pode ficar no backend junto do GMD (`backend/app/routes/pesagens.py`,
função `_calcular_gmd`).

**Como.**
1. Definir o peso-alvo de abate em **Configurações** (padrão sugerido: 18 @ ≈ 540 kg
   de peso vivo — deixar o produtor ajustar, varia por raça e por comprador).
2. Com GMD e peso atual: `dias_restantes = (peso_alvo - peso_atual) / gmd`.
3. Exibir no detalhe do animal, em linguagem direta:
   > No ritmo atual (**0,72 kg/dia**), atinge **18 @** em **mai/2027**.
4. No **lote**, a versão agregada: "38 de 60 animais atingem o ponto até mar/2027".
5. Marcar em destaque quem **já está no ponto** — é a ação que gera dinheiro.

**Cuidado.** Só mostrar a projeção com **pelo menos duas pesagens** e GMD positivo.
Com um dado só, ou GMD negativo (seca), a projeção mente — nesse caso mostrar
"faltam mais pesagens para projetar".

**Pronto quando.** Abrir um animal com duas pesagens mostra a data estimada de abate
em uma frase, sem o usuário fazer conta.

---

# FASE 5 — Offline-first

## 10. Sem sinal, o app não trabalha ⬜

**Problema.** O curral raramente tem 4G. Hoje a interface abre pelo cache do PWA,
mas **não carrega dados nem aceita cadastro** offline — exatamente no momento e no
lugar em que o registro precisa acontecer. Com a Fase 3 entregue, isso deixa de ser
inconveniente e passa a ser bloqueador: o Modo Curral só cumpre a promessa se
funcionar sem sinal.

**Como.**
- Banco local no aparelho + fila de sincronização que sobe quando a rede volta.
- **Facilitador do nosso caso:** é 1 usuário por fazenda, então quase não há
  conflito de dados — o que elimina a parte mais difícil de sincronização.
- Ferramentas a avaliar: **PowerSync**, **ElectricSQL**, **RxDB**, **WatermelonDB**.
- Indicador de estado sempre visível ("3 registros aguardando envio") — o produtor
  precisa confiar que não perdeu o trabalho.

**Esforço.** É o maior investimento técnico do projeto.

**Quando.** Depois de validar a demanda **e** depois da Fase 3 — a fila local do
Modo Curral (item 8) já é um primeiro passo nessa direção e pode ser reaproveitada.

---

# O que NÃO mudar

Isso já está acima da média do que se vê em software de pecuária. Mexer aqui é risco
sem retorno:

- **Onboarding de 3 passos** para conta nova — evita a tela vazia que mata a adoção.
- **"O que você quer fazer?"** com botões grandes — linguagem de tarefa, não de sistema.
- **Cadastro em lote** por quantidade de cabeças — essencial para quem compra 50 de uma vez.
- **Badge de ganho colorido** (`+101 kg`) — é o número que o pecuarista procura, e já
  está destacado.
- **Paginação de 50/página** no backend — a lista não quebra com rebanho grande.
- **Barra inferior + cards no mobile** — navegação de polegar, sem tabela espremida.

---

# Se for fazer só três coisas

*Atualizado em 2026-09-09: as duas recomendações anteriores — card compacto (item 5) e
filtros colapsáveis (item 6) — já foram entregues. O que sobra, na ordem:*

1. **Modo Curral** (item 8) — transforma o BovIA de cadastro em ferramenta de trabalho.
   Segue sendo o item que muda o produto.
2. **Cartão compacto em Movimentações** (item 5.2) — o cartão mais alto do app
   (433 px) com 40% de células vazias. Maior ganho isolado que resta no frontend.
3. **"Quando vender?"** (item 9) — o app já tem peso, GMD e custo; falta a conclusão.

---

*Referências de linha conferem com o código em 2026-09-03 e podem sair de lugar
conforme o arquivo muda — use-as como ponto de partida, não como endereço fixo.*
