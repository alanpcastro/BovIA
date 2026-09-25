# BovIA — Melhorias Importantes da Auditoria

Auditoria de codigo feita em 23/09/2026. Oito achados de **consistencia visual e precisao de
calculo**. Podem esperar, mas nao indefinidamente — sao o que separa "parece produto" de
"parece prototipo".

Para pedir: "Faca o Bloco M1" ou "Faca o M2".

**Legenda**: ⬜ pendente · 🟡 em andamento · ✅ concluido · ⛔ descartado

---

## Ordem de ataque

```
Bloco F   M2 + M3            meio dia   dark mode dos graficos — ganho visivel barato
Bloco G   M7                 meio dia   skeleton de carregamento
Bloco H   M5 + M6 + M8       1,5 dia    precisao do financeiro — FAZER DEPOIS DO BLOCO 2 CRITICO
Bloco I   M4                 1 dia      categoria do animal
Bloco J   M1                 continuo   design system, uma pagina por vez
```

> **Atencao ao Bloco H**: mexe em `analise_financeira`, o mesmo arquivo do Bloco 2 dos
> criticos. Fazer **depois** deles, nunca em paralelo, e reutilizar o mesmo procedimento de
> snapshot antes/depois.

---

## BLOCO F — M2 + M3: graficos no modo escuro ⬜

Os dois sao do mesmo arquivo (`pages/Graficos.tsx`). Fazer junto.

### M2 — tooltip branco no modo escuro ⬜

**Categoria**: visual / dark mode · **Complexidade**: baixa

#### Problema

Nenhum dos `<Tooltip>` do recharts define `contentStyle` — zero ocorrencias no arquivo. O
padrao da biblioteca e fundo branco com texto escuro.

#### Impacto

Depois de todo o trabalho na paleta Zinc/Emerald, o grafico acende um retangulo branco no meio
da tela escura a cada toque. E o defeito visual mais visivel que sobrou no app.

#### Como corrigir

`contentStyle` usando `var(--surface)`, `var(--gray-200)` e `var(--gray-900)` em todos os
`<Tooltip>` — ou um componente `<TooltipTema />` compartilhado.

---

### M3 — paleta dos graficos fixada em hexadecimal ⬜

**Categoria**: visual / dark mode · **Complexidade**: baixa

#### Problema

```javascript
// Graficos.tsx:10
const COLORS = ['#2d6a4f','#d97706','#db2777','#2563eb','#0d9488','#6b7280']
// :247  <Line stroke="#2d6a4f" />
// :293  <Bar  fill="#2d6a4f" />
// :294  <Bar  fill="#dc2626" />
```

Sao os **unicos** valores de cor fora do sistema de temas em toda a aplicacao. O `#2d6a4f` e o
verde antigo, de antes da paleta Emerald.

#### Impacto

Os graficos ficam num tema e o resto do app em outro. O cinza `#6b7280` tem contraste
insuficiente sobre fundo escuro.

#### Como corrigir

Montar `COLORS` em tempo de execucao via
`getComputedStyle(document.documentElement).getPropertyValue('--...')`, recalculando quando o
atributo `data-theme` muda.

#### Verificacao

Alternar tema com os graficos abertos e conferir linha, barra, pizza e tooltip nos dois modos.

---

## BLOCO G — M7: sem skeleton de carregamento ⬜

**Categoria**: UX · **Complexidade**: baixa · **Prazo**: meio dia

### Problema

Nenhuma regra `skeleton` no `index.css` (1.925 linhas). Todo carregamento e a palavra
"Carregando..." ou um spinner sobre tela vazia, em 20 paginas.

### Impacto

No 4G da fazenda sao varios segundos de tela em branco a cada navegacao. A percepcao de
lentidao e muito maior que a lentidao real — e e o tipo de coisa que faz o app parecer pesado
mesmo depois de resolver o A4.

### Como corrigir

- Classe `.skeleton` com animacao de brilho, respeitando `prefers-reduced-motion`.
- Componente `<SkeletonLinhas n={5} />` nas listas principais.
- Blocos no formato do conteudo que vai chegar, para a pagina nao "pular" quando carrega.

### Verificacao

Com throttling de rede no DevTools (Slow 3G), navegar entre Animais, Pesagens e Saude.

---

## BLOCO H — M5 + M6 + M8: precisao do financeiro ⬜

> **Fazer depois do Bloco 2 de `CRITICOS_AUDITORIA.md`.** Mesmo arquivo, mesmo procedimento de
> snapshot antes/depois.

### M5 — "arrobas produzidas" subtrai populacoes diferentes ⬜

**Categoria**: logica financeira · **Complexidade**: media

#### Problema

`financeiro.py:180`: `arrobas_entrada` acumula para **todo** animal que tenha peso inicial —
inclusive quem so tem `peso_entrada` e nenhuma pesagem no periodo. `arrobas_saida` so acumula
para quem tem peso final. A diferenca entre os dois e apresentada como producao.

#### Impacto

Quem pesou 30 de 100 animais no periodo ve 70 animais entrando na conta de entrada e nenhum na
de saida: **"arrobas produzidas" aparece negativo**. O `custo_por_arroba` se protege com
`> 0`, mas o numero negativo vai para a tela.

#### Como corrigir

Acumular entrada e saida dentro do mesmo `if pi is not None and pf is not None` que
`ganhos_arroba_por_animal` ja usa. Devolver tambem `animais_com_ganho` e a tela informar a
cobertura: "calculado sobre 30 de 100 animais".

---

### M6 — rentabilidade compara periodos incomparaveis ⬜

**Categoria**: logica financeira · **Complexidade**: media

#### Problema

```python
# financeiro.py:333
investimento  = custo_compras + custo_total   # compras DO periodo
rentabilidade = lucro_liquido / investimento * 100
```

Gado comprado no ano passado e vendido agora nao entra no denominador.

#### Impacto

Num periodo em que so houve venda, o denominador encolhe para os custos correntes e a
rentabilidade dispara para centenas de por cento. Aparece no **Dashboard como KPI principal**,
ao lado de numeros corretos, o que lhe da credibilidade que nao tem.

#### Como corrigir

Rentabilidade de **ciclo**, ancorada na compra do animal vendido: para cada venda no periodo,
buscar a compra do mesmo animal (em qualquer data) e usar esse valor como investimento.

**Paliativo enquanto nao for feito**: rotular como "rentabilidade do periodo" e tirar do
destaque do Dashboard.

---

### M8 — detalhes de calculo e ordenacao ⬜

**Categoria**: polimento · **Complexidade**: baixa

Tres pequenos, agrupados:

**1. Contagem de dias inconsistente na mesma funcao**

```python
# financeiro.py:89
dias_periodo = (data_fim - data_inicio).days      # sem +1
# financeiro.py:74  _overlap_days
return max(0, (end - start).days + 1)             # com +1
```

Um periodo de 1 a 31 vale 30 dias num lugar e 31 no outro.

**2. Ordenacao alfabetica de brinco**

`animais.py:85` usa `q.order_by(Animal.brinco)`, que coloca "A10" antes de "A9" e "100" antes
de "99". Para quem numera o rebanho em sequencia, a lista parece embaralhada.

> Atualizado no Bloco 1 dos criticos: a ordenacao natural ja existe no backend
> (`_chave_natural_brinco` em `animais.py`, usada por `/animais/lookup`). Falta aplica-la a lista
> paginada `/animais` — que ordena no SQL, entao precisa de chave natural no banco ou ordenar
> em Python antes de paginar.

**3. Custo de saude nao filtra apagados**

A soma em `financeiro.py:249` nao tem `Animal.deletado_em.is_(None)`, filtro que todas as
outras queries do arquivo tem.

#### Impacto

Cada um sozinho e pequeno. Juntos, sao o tipo de imprecisao que o produtor detalhista encontra
e passa a duvidar do resto.

#### Como corrigir

- `dias_periodo = _overlap_days(data_inicio, data_fim, data_inicio, data_fim)`.
- Ordenacao natural de brinco no backend, com `NULLS LAST`.
- Acrescentar o filtro de apagados faltante.

---

## M9 — Livro caixa do ano corrente lanca meses futuros ⬜

**Categoria**: logica financeira · **Complexidade**: baixa · **Descoberto no Bloco 2 dos criticos**

### Problema

`exportar_livro_caixa` (`relatorios.py`) usa o ano inteiro (01/01 a 31/12) como periodo. Despesa
fixa e custo nutricional **sem data de fim** vao ate 31/12 — inclusive os meses que ainda nao
aconteceram. Exportado em setembro, o livro de 2026 ja traz linhas de outubro, novembro e
dezembro, com data futura.

### Impacto

O livro caixa e documento para o contador (base do LCDPR/IRPF Rural). Exportado no meio do ano,
mostra despesa que nao existiu e saldo mais negativo do que o real. Quem exporta so em janeiro
do ano seguinte nao ve o problema.

### Como corrigir

Limitar o fim do periodo a `min(31/12, hoje)` para o ano corrente. Anos passados ficam iguais.

---

## BLOCO I — M4: a categoria do animal nunca envelhece ⬜

**Categoria**: logica de negocio · **Complexidade**: media · **Prazo**: 1 dia

### Problema

`models/animal.py:18` define `categoria` como enum estatico preenchido a mao. Bezerro vira
garrote por volta dos 8 meses, novilha vira vaca quando pare — nada disso e automatico, mesmo
com `data_nascimento` e registro de parto disponiveis.

### Impacto

A categoria alimenta duas coisas:

- `PESO_PADRAO_POR_CATEGORIA` (`pastos.py:28`), usado no calculo de UA quando o animal nao tem
  pesagem — ou seja, **entra direto na taxa de lotacao**;
- o alerta de abate (`alertas.py:148`).

Um rebanho cadastrado ha dois anos tem "bezerros" de 400 kg no sistema, e a taxa de lotacao sai
errada por causa disso.

### Como corrigir

- Funcao `categoria_sugerida(animal)` a partir de idade, sexo e historico de parto.
- Aviso na lista quando a categoria gravada divergir da sugerida, com acao de atualizar em
  massa (o `bulk-update` ja aceita `categoria`, `animais.py:228`).
- **Nao sobrescrever silenciosamente** — o produtor pode ter motivo para travar a categoria.

### Verificacao

Animal nascido ha 14 meses cadastrado como bezerro deve aparecer como divergente.

---

## BLOCO J — M1: design system ⬜

**Categoria**: consistencia visual · **Complexidade**: alta · **Prazo**: continuo

### Problema

O design system tem 51 variaveis CSS, mas as paginas o contornam com **621 estilos inline**:

```
AnimalDetalhe    64        Dashboard        34
Animais          61        Agenda           29
Lotes            50        Movimentacoes    27
Reproducao       46        ...
Pastagens        43        ModoCurral        1   <- feito com classes
```

E **16 tamanhos de fonte diferentes** em uso inline:

```
10 11 12 13 14 15 16 18 20 22 24 26 28 32 36 40
```

Um sistema de tipografia tem 5 ou 6 degraus. Aqui ha 16, escolhidos caso a caso.

### Impacto

E a causa raiz da sensacao de "cada tela e um app diferente". Indireto, mas e o que separa
parecer produto de parecer prototipo — e cada tela nova nasce ja com o problema.

### Como corrigir

**Nao refatorar tudo de uma vez.** Sequencia:

1. Definir a escala fechada em variaveis: `--fs-xs: 12px`, `--fs-sm: 13px`, `--fs-md: 15px`,
   `--fs-lg: 18px`, `--fs-xl: 24px`, `--fs-2xl: 32px`.
2. Regra de ouro para codigo novo: **sem `fontSize` inline**.
3. Converter uma pagina por vez, comecando por `Animais.tsx` e `AnimalDetalhe.tsx`
   (as duas com mais inline).

`ModoCurral.tsx` serve de referencia — foi escrito com classes desde o inicio e tem 1 estilo
inline em 348 linhas.

---

## Resumo

| ID | Titulo | Complex. | Migration | Status |
|----|--------|----------|-----------|--------|
| M2 | Tooltip branco no dark mode | baixa | nao | ⬜ |
| M3 | Paleta de graficos hardcoded | baixa | nao | ⬜ |
| M7 | Sem skeleton de carregamento | baixa | nao | ⬜ |
| M5 | "Arrobas produzidas" mistura populacoes | media | nao | ⬜ |
| M6 | Rentabilidade compara periodos incomparaveis | media | nao | ⬜ |
| M8 | Off-by-one, ordenacao, filtro faltante | baixa | nao | ⬜ |
| M4 | Categoria do animal nunca envelhece | media | nao | ⬜ |
| M1 | 621 estilos inline, 16 tamanhos de fonte | alta | nao | ⬜ |
| M9 | Livro caixa lanca meses futuros | baixa | nao | ⬜ |

**Nenhum precisa de migration.**

**Ganho visivel mais barato**: Bloco F (M2 + M3), meio dia, e resolve o defeito visual mais
aparente que sobrou.
