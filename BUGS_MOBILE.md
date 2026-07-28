# Defeitos de layout no mobile

Testado em viewport de iPhone (390×844), logado com dados reais. Desktop está OK — os
problemas abaixo aparecem só em telas estreitas (celular).

O que já está BOM no mobile (não mexer): login/cadastro, menu lateral (vira gaveta ☰),
grade de botões de ação do dashboard.

---

## 🔴 #1 — Tabelas exigem scroll lateral (prioridade alta)

**Telas afetadas:** Animais, Pesagens, Movimentações, Saúde, Reprodução
(todas usam a classe `data-table-big` dentro de `.table-wrapper`)

**Problema:** a tabela tem ~896px de largura numa tela de 390px. No mobile,
`.table-wrapper` vira `overflow-x: auto`, então a página não estoura, mas a tabela
precisa ser arrastada de lado. O usuário vê só as 3 primeiras colunas (Brinco, Nome,
Raça); Status, Peso, Categoria, Lote e ações ficam escondidos fora da tela.

**Impacto:** é o principal motivo do mobile parecer "ruim". Para uso no campo (celular
no curral), o produtor não consegue bater o olho e ver peso/status — tem que deslizar.

**Correção sugerida:** no mobile, trocar a tabela por **cartões empilhados** — cada
registro vira um card mostrando os campos principais juntos (ex: brinco + nome + peso +
status), sem scroll lateral. No desktop mantém a tabela. Pode ser via media query
(esconder `<table>` e mostrar uma lista de cards) ou um componente que decide o formato
pela largura.

**Sugestão de ordem:** começar por **Animais** como piloto, validar o formato do card,
depois replicar para Pesagens, Movimentações, Saúde e Reprodução.

**Arquivos:** [frontend/src/pages/Animais.tsx](frontend/src/pages/Animais.tsx),
[Pesagens.tsx](frontend/src/pages/Pesagens.tsx),
[Movimentacoes.tsx](frontend/src/pages/Movimentacoes.tsx),
[Saude.tsx](frontend/src/pages/Saude.tsx),
[Reproducao.tsx](frontend/src/pages/Reproducao.tsx),
[index.css](frontend/src/index.css) (`.table-wrapper`, `.data-table-big`)

---

## 🟡 #2 — Dashboard corta o "Peso Médio" (prioridade média, correção rápida)

**Tela:** Dashboard (bloco "Seu Rebanho")

**Problema:** os 4 indicadores (Animais, Machos, Fêmeas, Peso Médio) ficam numa linha só
com `gap: 32`. Somados passam de ~450px, então no celular de 390px o 4º item
(**Peso Médio**) é empurrado para fora da tela e some (fica em x≈377–489, além da borda).

**Correção sugerida:** no mobile, quebrar em grade **2×2** (dois em cima, dois embaixo)
ou reduzir o `gap`. É rápido (~10 min).

**Arquivos:** [frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx)
(bloco `field-hero-stats`, estilo inline `display: flex; gap: 32`),
[index.css](frontend/src/index.css) (`.field-hero-stats`)

---

## 🟢 #3 — Cards "Resultado do Mês" soltos (cosmético, baixa prioridade)

**Tela:** Dashboard (bloco "Resultado do Mês")

**Problema:** os cards de Lucro do Mês / Custo por @ / Rentabilidade ficam pequenos e
centralizados, com muito espaço vazio nas laterais no mobile. Não quebra nada, só parece
mal aproveitado.

**Correção sugerida:** ocupar a largura total (full-width) ou empilhar como cards
maiores no mobile.

**Arquivos:** [frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx)

---

## Resumo

| # | Defeito | Prioridade | Esforço |
|---|---|---|---|
| 1 | Tabelas com scroll lateral → virar cartões no mobile | Alta | Médio |
| 2 | Dashboard corta "Peso Médio" | Média | Baixo |
| 3 | Cards "Resultado do Mês" soltos | Baixa | Baixo |
