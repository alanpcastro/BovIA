# Melhorias de UX no mobile

Levantadas em 2026-07-28 após teste completo do app no celular (viewport 390×844,
logado com dados reais). Foco: agradar o público-alvo (produtor rural usando no campo,
com uma mão, sol forte, às vezes de luva). Ordenado por **impacto ÷ esforço**.

---

## 🐛 Bugs de layout já corrigidos (2026-07-28)

- ✅ **Financeiro** — o filtro de período jogava o 2º campo de data pra fora da tela.
  Agora as duas datas dividem a linha e o botão "Analisar" ocupa a largura toda.
- ✅ **Detalhe do animal** — a barra de abas não cabia e arrastava a página inteira;
  as tabelas de histórico dentro das abas estouravam. Agora as abas **rolam de lado**
  e os históricos viraram **cartões**.
- ✅ **Tabelas → cartões** nas telas de lista (ver [BUGS_MOBILE.md](BUGS_MOBILE.md)).

---

## 🎯 Melhorias propostas

| # | Melhoria | Por que agrada o público | Esforço | Status |
|---|---|---|---|---|
| 1 | **Barra de navegação inferior (mobile)** | Hoje tudo passa pela gaveta ☰. Uma barra fixa embaixo (Início · Animais · Pesar · Agenda · Mais) dá cara de **app nativo** e é operável com uma mão no curral. Maior salto de percepção de qualidade. | Médio | ✅ Feito |
| 2 | **GMD colorido na lista de Animais** | Ganho em verde / perda em vermelho ao lado do peso atual. O produtor bate o olho e vê quem está engordando. | Baixo | ✅ Feito |
| 3 | **Teclado numérico nos campos de peso/valor** | `inputMode="decimal"` faz o celular abrir o teclado numérico direto — menos atrito ao digitar peso/dinheiro em campo. | Baixo | ✅ Feito |
| 4 | **Atalhos de data no Financeiro** | Botões "30 dias / 90 dias / este ano" em vez de digitar data no celular. | Baixo | ✅ Feito |
| 5 | **Botão flutuante (+) de ação** | "+" grande fixo no canto pra ação principal (cadastrar/pesar) ao alcance do polegar. | Médio | ⏳ |

---

## 1. Barra de navegação inferior — ✅ Feito

- Barra fixa no rodapé, só no mobile (≤768px): **Início · Animais · Pesar · Agenda · Mais**.
- "Mais" abre a gaveta lateral existente (com todos os outros menus: Lotes, Saúde,
  Financeiro, Relatórios, etc.).
- O menu ☰ do topo continua funcionando; a barra inferior é o atalho rápido.
- Item ativo destacado em verde.
- Arquivos: [frontend/src/components/Layout.tsx](frontend/src/components/Layout.tsx),
  [frontend/src/index.css](frontend/src/index.css) (`.bottom-nav`).

## 2. GMD colorido na lista de Animais — ✅ Feito

- Ao lado do **Peso Atual**, mostra o ganho total desde a entrada:
  **verde com `+`** se ganhou, **vermelho** se perdeu.
- Base: `peso_atual − peso_entrada` (backend já envia os dois campos).
- Só aparece quando há peso atual e peso de entrada pra comparar.
- Arquivo: [frontend/src/pages/Animais.tsx](frontend/src/pages/Animais.tsx).

## 3. Teclado numérico nos campos de peso/valor — ✅ Feito

- `inputMode="decimal"` em todos os campos numéricos (`type="number"`) das telas —
  no celular abre direto o teclado numérico com vírgula/ponto, em vez do alfanumérico.
- 35 campos cobertos em 13 telas (peso, valor, preço, quantidade, etc.).
- Arquivos: telas em [frontend/src/pages/](frontend/src/pages/).

## 4. Atalhos de data no Financeiro — ✅ Feito

- Botões rápidos abaixo do período: **30 dias · 90 dias · 12 meses · Este ano**.
- 1 toque aplica as datas **e já reanalisa** (sem precisar clicar em "Analisar").
- Arquivo: [frontend/src/pages/Financeiro.tsx](frontend/src/pages/Financeiro.tsx).

---

## Próximos (não feitos ainda)

Item 5 acima (botão flutuante +). Fazer conforme prioridade / feedback do sócio.
