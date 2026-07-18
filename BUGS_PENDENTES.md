# Bugs pendentes — Auditoria 2026-06

Lista do que ainda falta corrigir da auditoria de lógica. Os itens #1-5 e #13 já foram resolvidos.

Numeração mantida do relatório original para referência cruzada.

---

## 🔴 Alta prioridade — Risco de dados corrompidos ou cálculos errados

### ~~#14 — `_calcular_gmd` usa `data_nascimento` como inicial~~ ✅ CORRIGIDO
**Arquivo:** [backend/app/routes/pesagens.py:41-44](backend/app/routes/pesagens.py#L41)

Trocado para usar `animal.created_at.date()` como data de referência inicial.

---

### ~~#8 — Import CSV duplica brincos no mesmo arquivo~~ ✅ CORRIGIDO
**Arquivo:** [backend/app/routes/relatorios.py:567-585](backend/app/routes/relatorios.py#L567)

Adicionado `brincos_no_csv: set[str]` que detecta duplicatas dentro do próprio arquivo antes do commit.

---

### ~~#16 — `brinco` não é UNIQUE no DB~~ ✅ CORRIGIDO
**Arquivos:**
- [backend/alembic/versions/a8d3e7b2c4f1_brinco_unique.py](backend/alembic/versions/a8d3e7b2c4f1_brinco_unique.py)
- [backend/app/models/animal.py](backend/app/models/animal.py)

Criada migration com índice único parcial `(user_id, brinco) WHERE deletado_em IS NULL AND brinco IS NOT NULL`. A migration aborta com mensagem clara se já existirem duplicatas no banco. Race condition em criações concorrentes agora é bloqueada pelo Postgres.

---

### ~~#11 — Exclusão de lote não trata `Lote.pasto_atual_id`~~ ✅ CORRIGIDO
**Arquivo:** [backend/app/routes/lotes.py:122-148](backend/app/routes/lotes.py#L122)

Após deletar o lote, se ele estava ocupando um pasto e nenhum outro lote ainda ocupa esse pasto, o pasto é marcado como `descanso`. Pasto não fica mais "ocupado" sem ocupante.

---

## 🟡 Média prioridade — Bugs visíveis ao usuário

### ~~#6 — PDF "rebanho" diz "X ativos" e inclui vendidos/mortos~~ ✅ CORRIGIDO
**Arquivo:** [backend/app/routes/relatorios.py:342-350](backend/app/routes/relatorios.py#L342)

Adicionado `Animal.status == StatusEnum.ativo` na query do PDF. Agora o texto e o conteúdo batem.

---

### ~~#7 — CSV de pesagens com coluna GMD vazia~~ ✅ CORRIGIDO
**Arquivos:**
- [backend/app/routes/relatorios.py:129-138](backend/app/routes/relatorios.py#L129) (CSV)
- [backend/app/routes/relatorios.py:243-252](backend/app/routes/relatorios.py#L243) (XLSX)

Importado `_calcular_gmd` de pesagens.py e chamado para cada linha. Coluna "GMD (kg/dia)" adicionada ao XLSX também (não existia antes).

---

### ~~#10 — Movimentação em lote aceita `tipo: str` sem validar~~ ✅ CORRIGIDO
**Arquivo:** [backend/app/routes/lotes.py:79-86, 268-273](backend/app/routes/lotes.py#L79)

`LoteMovimentacaoCreate.tipo` agora é `TipoMovEnum`. Comparações no `movimentacao_em_lote` usam o enum diretamente (`TipoMovEnum.venda` / `TipoMovEnum.morte`). Payload inválido rejeitado com 422 pelo Pydantic.

---

### ~~#9 — `_peso_total_lote` subestima quando falta peso~~ ✅ CORRIGIDO
**Arquivo:** [backend/app/routes/pastos.py:22-33, 55-69](backend/app/routes/pastos.py#L22)

Adicionado `PESO_PADRAO_POR_CATEGORIA` (bezerro 200, garrote 280, novilha 320, vaca 450, boi_magro 350, boi_gordo 500) + fallback 400kg para sem categoria. `_peso_total_lote` nunca mais retorna 0kg fantasma. Alerta de superlotação passa a disparar corretamente mesmo com dados incompletos.

---

### ~~#19 — Bulk-delete de pesagens com comportamento enganoso~~ ✅ CORRIGIDO
**Arquivos:**
- [backend/app/routes/pesagens.py:15-16, 100-118](backend/app/routes/pesagens.py#L15)
- [backend/app/routes/animais.py](backend/app/routes/animais.py) — apagar animal (individual e em massa) agora apaga suas pesagens junto
- [frontend/src/pages/Pesagens.tsx](frontend/src/pages/Pesagens.tsx) — tabela reescrita para mostrar cada pesagem individualmente

Rota `bulk-delete` agora recebe `pesagem_ids` (não `animal_ids`). Checkbox seleciona pesagem individual; botão apaga só as marcadas. Deletar animal em `/animais` faz hard-delete das pesagens dele.

---

### ~~#15 — Status do pasto sobrescrito ao ocupar~~ ✅ CORRIGIDO
**Arquivos:**
- [backend/app/routes/pastos.py](backend/app/routes/pastos.py) — bloqueia ocupação se pasto em descanso há menos de 30 dias
- [backend/app/schemas/pasto.py](backend/app/schemas/pasto.py) — adicionado `forcar: bool = False` em `OcuparPastoIn`
- [frontend/src/pages/Pastagens.tsx](frontend/src/pages/Pastagens.tsx) — quando backend retorna 400 de descanso, aparece aviso amarelo com checkbox "Forçar ocupação"

Constante `DESCANSO_MINIMO = 30` dias (referência PRV — Pastoreio Racional Voisin). Produtor pode forçar via UI.

---

## 🔵 Baixa prioridade — Não afetam números, afetam UX

### ~~#17 — Simulador exibe Lucro Bruto = Lucro Líquido~~ ✅ CORRIGIDO
**Arquivo:** [frontend/src/pages/Simulador.tsx](frontend/src/pages/Simulador.tsx)

Adicionado input "Imposto (Funrural) %" com default 1.5%. `lucro_liquido = lucro_bruto - (receita × imposto%)`. Card de resultado agora mostra 4 linhas: Receita → Custo → Lucro bruto → Impostos → Lucro líquido.

---

### ~~#18 — `break_even_peso_venda` exclui custo de compra~~ ✅ CORRIGIDO
**Arquivo:** [frontend/src/pages/Simulador.tsx](frontend/src/pages/Simulador.tsx)

Fórmula agora usa custo total (compra + operacional + frete) e considera impostos: `receita_break_even = custo_total / (1 - imp%)`. Aplicado tanto ao `break_even_arroba_venda` quanto ao `break_even_peso_venda`.

---

### ~~#20 — `criar_animais_em_lote` cria N animais sem brinco~~ ✅ CORRIGIDO
**Arquivos:**
- [backend/app/routes/lotes.py](backend/app/routes/lotes.py) — `LoteAnimaisCreate` ganhou `brinco_prefixo` e `brinco_inicio`. Gera brincos sequenciais com zero-padding automático (mínimo 3 dígitos). Valida duplicidade antes de inserir.
- [frontend/src/pages/Animais.tsx](frontend/src/pages/Animais.tsx) — modal "Criar em Lote" tem seção "Numeração automática" com preview dos brincos que serão gerados (ex: "L1-001 até L1-050").

Deixar prefixo em branco continua criando sem brinco (comportamento anterior).

---

### ~~#12 — Exclusão de pasto não checa estado inconsistente~~ ✅ CORRIGIDO
**Arquivo:** [backend/app/routes/pastos.py:203-221](backend/app/routes/pastos.py#L203)

Agora bloqueia com 400 em dois cenários: (1) algum lote referencia via `pasto_atual_id`, ou (2) existe `HistoricoOcupacao` sem `data_saida` (ocupação em andamento). Cobre inconsistências onde o histórico ficou aberto sem o lote apontando de volta. Também adicionei `Lote.user_id == current_user.id` como defense-in-depth.

---

## Resumo

| # | Arquivo principal | Esforço |
|---|---|---|
| ~~#14~~ ✅ | backend/app/routes/pesagens.py | — |
| ~~#8~~ ✅ | backend/app/routes/relatorios.py | — |
| ~~#16~~ ✅ | backend/app/models/animal.py + migration | — |
| ~~#11~~ ✅ | backend/app/routes/lotes.py | — |
| ~~#6~~ ✅ | backend/app/routes/relatorios.py | — |
| ~~#7~~ ✅ | backend/app/routes/relatorios.py | — |
| ~~#10~~ ✅ | backend/app/routes/lotes.py | — |
| ~~#9~~ ✅ | backend/app/routes/pastos.py | — |
| ~~#19~~ ✅ | backend/app/routes/pesagens.py + animais.py + Pesagens.tsx | — |
| ~~#15~~ ✅ | backend/app/routes/pastos.py + schemas + Pastagens.tsx | — |
| ~~#17~~ ✅ | frontend/src/pages/Simulador.tsx | — |
| ~~#18~~ ✅ | frontend/src/pages/Simulador.tsx | — |
| ~~#20~~ ✅ | backend/app/routes/lotes.py + Animais.tsx | — |
| ~~#12~~ ✅ | backend/app/routes/pastos.py | — |
