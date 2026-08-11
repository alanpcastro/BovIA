# Upgrade de Frontend — Plano (Caminho A: refinar o CSS existente)

Decisão tomada em 2026-08-03: **Caminho A** — refinar o design system artesanal que já
existe (CSS puro + variáveis), roubando pontualmente as boas ideias do shadcn/Radix
(acessibilidade, estados, microinterações) **sem** trazer Tailwind/shadcn como dependência.
Motivo: o frontend já está bom e distintivo; migração seria alto risco e baixo retorno pro
estágio do projeto. Ver conversa da sessão.

**Regras do upgrade:**
1. Cada fase é testada no Playwright (viewport real 390px + desktop) antes de dar por pronta.
2. `npm run build` (type-check) limpo a cada etapa.
3. Commit por fase — pra poder voltar atrás sem perder trabalho.
4. Nada de reescrever tela inteira: refino incremental, aditivo.

Ferramentas: **Playwright MCP** (regressão visual), **Context7** (docs atualizadas quando
precisar de lib), **Mobbin** (referência que o Alan traz), **Magic MCP** (rascunho pontual).

---

## Estado atual (bom ponto de partida)

- Tokens já existem: cores, `--radius-*`, `--shadow-*`, `--transition`, tema dark.
- `.btn` tem `:focus-visible`; inputs têm anel de foco; hover states presentes.
- Componentes à mão: Layout (sidebar+drawer+bottom-nav), Modal, Toast. Selects são
  nativos (bom pro mobile — não trocar).
- Lacunas: sem escala de espaçamento; foco inconsistente em links/linhas/checkbox;
  sem `prefers-reduced-motion`; sem feedback de "press"; muito estilo inline repetido;
  loading é texto "Carregando..." (sem skeleton).

---

## Fase 1 — Fundação sem risco (tokens + acessibilidade)  ✅ CONCLUÍDA (2026-08-03)

Aditivo e global, quase zero risco de quebrar layout.
- [x] Escala de espaçamento (`--space-1..12`) nos tokens (base pra Fase 3).
- [x] Token de anel de foco (`--focus-ring` / `--focus-offset`).
- [x] **Foco visível consistente** em tudo que é interativo: links, linhas clicáveis,
      `.sidebar-link`, `.bottom-nav-item`, `.action-tile`, `.mobile-select-all`, `.kpi-big`, checkboxes.
- [x] **Feedback de toque** (`:active` press/scale) em botões, tiles e bottom-nav.
- [x] `@media (prefers-reduced-motion: reduce)` — respeita acessibilidade e evita enjoo.
- [x] Verificado no Playwright: sem overflow, sem regressão (desktop + mobile), foco visível, build limpo.

## Fase 2 — Componentes (o "10% do shadcn")  ✅ CONCLUÍDA (2026-08-03)

Refinar os componentes à mão com o comportamento/acessibilidade do Radix, sem a dependência.
- [x] **Modal**: `role="dialog"` + `aria-modal` + `aria-labelledby`; **focus trap** (Tab
      circula dentro); `Esc` fecha; **trava o scroll** do fundo; **devolve o foco ao
      gatilho** ao fechar; botão de fechar com toque de 40px no mobile.
      (Bug corrigido: capturar o gatilho no render, antes do autoFocus dos filhos.)
- [x] **Inputs**: estados `:disabled` e `.input-error` + `.form-error` disponíveis no CSS
      (prontos pra validação por campo adotar; hoje o erro ainda aparece no banner do topo).
- [x] **Linhas clicáveis**: Animais navega por teclado (`tabindex`, `role="link"`,
      Enter/Espaço, com guarda pra não conflitar com o checkbox).
- [x] **Toast**: `aria-live="polite"` + `role="alert"` (erro) / `role="status"` — leitor
      de tela anuncia. (Ícones por tipo já existiam.)
- [~] **Badges/cards**: padronização de padding/cor fica pra Fase 3 (consistência).

Verificado no Playwright: focus trap, Esc, scroll-lock, retorno de foco ao gatilho e
navegação por teclado nas linhas — todos funcionando; build limpo.

## Fase 3 — Consistência visual

- [ ] Aplicar a escala de espaçamento nas telas de maior tráfego (Dashboard, Animais,
      Financeiro) substituindo gaps/margens inline ad-hoc.
- [ ] Unificar cabeçalho de página, títulos de seção e estados vazios (já há bons exemplos).
- [ ] Escala tipográfica coerente (tamanhos/pesos padronizados).

## Fase 4 — Microinterações e percepção de "app caro"

- [ ] **Skeleton loaders** no lugar de "Carregando..." (Dashboard, listas).
- [ ] Transições suaves ao trocar aba/filtro/lista.
- [ ] Refino de hover/active e sombras em cartões e tiles.
- [ ] Revisar toque mínimo de 44px em alvos pequenos (ícones de lixeira etc.).

---

## Progresso

| Fase | Status |
|---|---|
| 1 — Fundação (tokens + a11y) | ✅ Concluída |
| 2 — Componentes | ✅ Concluída |
| 3 — Consistência | ⬜ Próxima |
| 4 — Microinterações | ⬜ |
