# BovIA — Futuro da Auditoria

Auditoria de codigo feita em 23/09/2026. Quatro itens que **nao devem ser construidos agora** —
cada um esta travado por uma decisao, nao por falta de tempo.

Para pedir: "Faca o F1".

**Legenda**: ⬜ pendente · 🟡 em andamento · ✅ concluido · ⛔ descartado · ⏸️ aguardando decisao

> **Regra desta lista**: nenhum item aqui entra em producao antes de a trava dele ser
> destravada. Construir qualquer um deles no escuro e o risco principal do projeto nesta fase.

---

## Quadro de travas

| ID | Item | Travado por |
|----|------|-------------|
| F1 | Mapa de piquetes | validar com produtor real quantos piquetes ele tem |
| F2 | Indicadores de cria | A7 + A8 (`ALTO_IMPACTO_AUDITORIA.md`) |
| F3 | NDVI por piquete | F1 existir e ter uso comprovado |
| F4 | Offline-first | decisao sua: quando houver infraestrutura paga |

---

## F1 — Mapa de piquetes sobre imagem de satelite ⏸️

**Categoria**: funcionalidade · **Complexidade**: media · **Prazo**: ~2,5 dias

### Oportunidade

`Pasto.area_ha` e **obrigatorio e digitado de memoria** (`models/pasto.py:21`), e e o
denominador de todo o modulo:

```python
# pastos.py:93
taxa = ua / pasto.area_ha if pasto.area_ha else 0
superlotado = taxa > pasto.capacidade_ua_ha
```

Ou seja: **todo alerta de superlotacao do app depende de um numero que o produtor chutou**.
Se ele digitou 20 ha num pasto de 14, a taxa sai 30% otimista e o alerta nunca dispara.

Mas o ganho maior nao e esse. E **adjacencia**.

### O argumento principal: adjacencia

Rotacao de pasto e decisao espacial. "Para qual piquete eu mudo o gado?" depende de duas coisas:

- qual esta descansado o suficiente -> **o app ja sabe** (`dias_descanso`);
- qual e **vizinho** de onde o gado esta -> **o app nao tem como saber**.

Ninguem toca 80 bois pelo meio da fazenda porque o piquete 9 esta mais descansado. Toca pro
vizinho. E adjacencia e informacao que uma lista de cards e **estruturalmente incapaz** de
representar — nao e questao de UI feia, o dado nao existe no sistema.

Com poligono, o alerta deixa de ser:

> "Piquete 02 em descanso ha 94 dias"

e vira:

> "O gado esta no Piquete 05 ha 47 dias. O Piquete 06, do lado, esta descansado ha 38."

A primeira e constatacao. A segunda e recomendacao.

### Ressalva honesta

O mapa corrige o denominador, **mas nao o limiar**: `capacidade_ua_ha` nasce 1.5 em todo pasto
e continua sendo palpite. O alerta fica *menos errado*, nao certo. Quem resolve isso de fato e
o F3.

### Para quem agrega

| Perfil | Vale? |
|---|---|
| 12+ piquetes, rotacao de verdade | **muito** |
| 5-8 piquetes | medio |
| 3 pastos grandes, extensivo | **nao** — ele sabe de cor |
| Confinamento | inutil |

### Trava: a pergunta de validacao

Antes de escrever uma linha, o socio leva a campo:

> **"Quantos piquetes o senhor tem, e como decide para qual vai mudar o gado?"**

- "Tenho 3, e obvio" -> **nao construir**.
- "Tenho 12 e as vezes me perco no rodizio" -> **construir, e o caso dele**.

### Como construir, se destravar

Fases que param sozinhas:

| Fase | O que | Custo | Vale sozinha? |
|---|---|---|---|
| **A** | Desenhar poligono sobre satelite, area geodesica preenche `area_ha` | ~1 dia | sim |
| **B** | Mapa colorido por status + adjacencia nos alertas de rotacao | ~1,5 dia | sim |

**Stack**: Leaflet + Esri World Imagery (gratis, com atribuicao) + leaflet-draw, area geodesica
via turf.js.

**"Google Earth" nao e opcao**: a imagem do Google exige Maps JS API paga (~US$ 7/1000
carregamentos) e os termos proibem cachear tile.

| Provedor | Custo | Observacao |
|---|---|---|
| **Esri World Imagery** | gratis, com atribuicao | melhor custo/beneficio; resolucao rural BR decente |
| Mapbox Satellite | 50k loads/mes gratis | visual melhor, vira custo se escalar |
| Google Maps | pago desde o primeiro dia | so se a imagem for diferencial de venda |

**Backend**: uma coluna `geometria` (JSON) em `pastos` + migration. O resto de
`_build_pasto_out` nao muda.

### Duas regras de escopo

1. **So piquete.** Nada de desenhar "a propriedade" separado — a propriedade e a uniao dos
   piquetes.
2. **O mapa preenche o campo, nao substitui.** Quem nao quiser desenhar continua digitando
   `area_ha`.

### O que nao resolve

- Nao ajuda no curral. A dor diaria e lancar dado no campo; o mapa e tela de escritorio.
- Trabalho de setup sem retorno imediato — desenhar 10 piquetes rende zero no mesmo dia.
- Desenhar poligono com o dedo no celular e chato. Se o publico for celular-only, ha chance
  concreta de ficar sem uso.

### Seja honesto sobre o que esta comprando

E disparado o melhor recurso de **demonstracao** do app. Mapa com piquete colorido fecha
reuniao. O valor diario e bom, mas o valor de venda e maior — razao legitima para construir,
desde que isso esteja claro.

---

## F2 — Indicadores de cria: taxa de prenhez e kg de bezerro desmamado ⏸️

**Categoria**: funcionalidade · **Complexidade**: media · **Trava**: A7 + A8

### Oportunidade

Hoje o app tem metrica de engorda (arroba, GMD, custo/@) e **nenhuma de cria**. Os dados
reprodutivos ja sao coletados — falta poder agrega-los com seguranca.

### Impacto

Para quem vende bezerro, e a diferenca entre o app servir ou nao servir. Os tres numeros que
ele usa para decidir descarte:

- taxa de prenhez;
- intervalo entre partos;
- kg de bezerro desmamado por vaca por ano.

### Por que esta travado

Nenhuma dessas contas e confiavel hoje:

- **A8** — `resultado` e texto livre comparado com string literal (`== "nasceu bezerro"`).
  Sem enum, nao da para contar prenhez.
- **A7** — nao existe `mae_id`. A mae do bezerro e a string
  `f"Filho(a) de #{mae.brinco}"`. Sem relacao, nao da para somar kg de bezerro por vaca.

**Fazer A7 e A8 primeiro.** Depois disso, boa parte do F2 vira query.

### Como deveria funcionar

Um painel de cria equivalente ao financeiro, ligado na ficha de cada matriz.

---

## F3 — NDVI por piquete alimentando a capacidade ⏸️

**Categoria**: funcionalidade · **Complexidade**: alta · **Trava**: F1

### Oportunidade

Com o poligono salvo, da para puxar **NDVI do Sentinel-2 de graca** (Sentinel Hub ou Earth
Engine; revisita de 5 dias, 10 m de resolucao).

NDVI e vigor de pastagem. E exatamente o que transformaria `capacidade_ua_ha` de palpite em
**medicao** — e ainda capturaria seca e aguas automaticamente, coisa que o app hoje ignora por
completo.

### Por que importa mencionar agora

Nao para construir. Para justificar o F1: **o poligono e o ativo que destrava isso depois.**
Desenhar o pasto nao e so uma funcionalidade; e a materia-prima de tudo que vier de
sensoriamento remoto.

Isso sozinho ja justifica desenhar cedo, mesmo com retorno imediato medio.

### O que importa agora

Que o **F1 guarde a geometria num formato que sirva depois** (GeoJSON padrao, WGS84).
O resto e projeto a parte.

---

## F4 — Offline-first ⏸️

**Categoria**: arquitetura · **Complexidade**: alta · **Trava**: decisao sua

> Adiado por decisao explicita: sera feito quando o app estiver pronto para lancamento e houver
> infraestrutura paga.

### Por que continua sendo o item de maior valor do roteiro

Diferente de tudo o mais nesta lista:

- resolve a **dor diaria** (lancar dado no campo sem sinal);
- serve **todo produtor**, independente de fase de producao;
- **nao depende de definir publico-alvo**.

O mapa melhora o melhor modulo que existe. O offline resolve o problema que faz o produtor
desistir de usar.

### O que ja esta pronto

O **Modo Curral** foi construido com parte da resiliencia necessaria:

- sessao em `localStorage` (`CHAVE_SESSAO = 'bovia:curral:sessao'`), sobrevive a fechar o app;
- gravacao **idempotente por (animal, data)** no servidor (`POST /pesagens/lote`), sobrevive a
  reenvio;
- sessao so e limpa **depois** da confirmacao do servidor.

Esse padrao de idempotencia e o modelo a repetir nos outros endpoints quando chegar a hora.

### Como deveria funcionar

Fila de escrita local sincronizada ao voltar o sinal, com resolucao de conflito.

---

## Nota de fundo: a Fase 4 e o problema de publico

A "Fase 4" (recomendar quando vender) foi avaliada e **posta em suspenso**. O motivo vale para
metade desta lista, entao fica registrado aqui.

### O que o codigo revelou

`models/lote.py` **nao tem campo de finalidade ou fase de producao** — mas tem:

```python
rendimento_carcaca = Column(Float, nullable=True, default=52.0)
```

Rendimento de carcaca so importa para quem manda pro frigorifico. **O BovIA ja assumiu que o
usuario e de engorda, mas nunca disse isso.** O mesmo vale para
`PESO_ABATE_MINIMO = 480.0` em `alertas.py:23`.

### Quem nao se encaixa

| Fase | Como ganha dinheiro | O que a Fase 4 entrega |
|---|---|---|
| **Cria** | vende bezerro desmamado | **nada** — a moeda e bezerro/vaca/ano |
| **Recria** | vende magro (~380 kg) | serve, **se** a meta for dele |
| **Engorda** | termina pro frigorifico | serve — foi escrita pra ele |
| **Leite** | litros/dia | **nada** — o app nem tem onde lancar |

### As tres perguntas que decidem o roteiro

Para o socio levar a campo:

1. **"O que o senhor faz com o bicho — vende bezerro, vende magro, ou termina?"**
   -> define se o app tem um publico ou tres.
2. **"Como o senhor decide que chegou a hora de vender?"**
   -> revela se ele usa peso, idade, preco da @ ou so o olho.
3. **"Qual numero o senhor olha para saber se o ano foi bom?"**
   -> a melhor das tres. O que ele responder e o que o app deveria calcular.

### O que serve todo mundo, independente da resposta

- quanto custou cada animal;
- vacina em dia (todo mundo, e exigencia legal);
- saber o que tem em cada pasto;
- **lancar dado no campo sem sinal**.

E por isso que **F4 e aposta segura e F1 nao e**. E e por isso que os criticos e o alto impacto
vem antes de tudo nesta lista: nenhum deles depende de decidir o publico.

---

## Resumo

| ID | Titulo | Complex. | Trava | Status |
|----|--------|----------|-------|--------|
| F1 | Mapa de piquetes (fases A + B) | media | validacao com produtor | ⏸️ |
| F2 | Indicadores de cria | media | A7 + A8 | ⏸️ |
| F3 | NDVI por piquete | alta | F1 | ⏸️ |
| F4 | Offline-first | alta | decisao sua | ⏸️ |

**Ordem que eu defenderia, quando destravar**:

1. **F4 (offline-first)** — dor diaria, serve todo mundo, independe de segmento
2. **F1 A+B (mapa)** — melhora o melhor modulo que existe e destrava o F3
3. **F2 (cria)** — so depois de A7 e A8
4. **F3 (NDVI)** — projeto a parte

**Fase 4 (recomendar venda)**: ⏸️ em suspenso, aguardando definicao de publico.
