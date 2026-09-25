# BovIA — Críticos da Auditoria

Auditoria de codigo feita em 23/09/2026. Seis achados que produzem **numero errado ou perda
de acesso a dado sem nenhuma mensagem de erro**.

Para pedir: "Faca o Bloco 1" ou "Faca o C5".

**Legenda**: ⬜ pendente · 🟡 em andamento · ✅ concluido · ⛔ descartado

> **Propriedade importante**: nenhum dos seis originais precisa de migration. Sao todos mudanca
> de query, calculo ou rota nova. Cada bloco e um commit proprio e um deploy proprio;
> rollback e `git revert`. O **C7**, descoberto no Bloco 2, e a excecao.

> **Testes**: o projeto nao tinha nenhum. O Bloco 2 criou os primeiros (`backend/tests/`,
> rodar com `venv/bin/python -m pytest` de `backend/`) e usou verificacao por snapshot
> antes/depois para o financeiro.

---

## Ordem de ataque

```
Bloco 1   C1                    meio dia    deploy isolado
Bloco 2   C5 -> C3 -> C4        1,5-2 dias  deploy apos comparar snapshots
Bloco 3   C2                    meio dia    deploy
Bloco 4   C6                    meio dia    deploy
```

**Se precisar cortar**: Bloco 1 e Bloco 4 entregam quase todo o beneficio com quase nenhum
risco. O Bloco 2 e o que mais rende em credibilidade e o que mais exige cuidado.

---

## BLOCO 1 — C1: paginacao silenciosa ✅ (concluido 24/09/2026)

**Categoria**: bug de dados · **Complexidade**: baixa · **Prazo**: meio dia

### Resultado

**Backend**
- `schemas/animal.py` — novo `AnimalLookup` (`id`, `brinco`, `nome`, `sexo`, `status`, `lote_id`).
- `routes/animais.py` — novo `GET /animais/lookup`, declarado antes de `/{animal_id}`. Consulta
  so as 6 colunas, sem paginacao, sem `count()`, excluindo apagados.
- Ordem **natural** de brinco no servidor (`_chave_natural_brinco`): `7, 99, 100, A1, A02, A9,
  A10`, sem brinco no fim. A rota `/animais` paginada continua alfabetica — isso e o M8.

**Frontend**
- `services/api.ts` — tipo `AnimalLookup = Pick<Animal, ...>`. Trocar o tipo do estado fez o `tsc`
  provar que nenhuma tela usa campo fora do lookup.
- Seis chamadas trocadas. Cada tela manteve o filtro que ja aplicava, agora no cliente:
  Graficos filtra ativos, Reproducao filtra femeas.
- `Pesagens.tsx` — removida a ordenacao manual no cliente (o servidor ja entrega ordenado).
- `Reproducao.tsx` — **segundo bug corrigido de carona**: a recarga apos salvar (linha 205)
  pedia so femeas *ativas*, enquanto a carga inicial (linha 75) pedia todas. Depois do primeiro
  registro, o mapa de brincos perdia as vendidas. As duas agora usam `carregarFemeas()`.
- `ModoCurral.tsx` **nao mudou**: ja paginava corretamente e usa `peso_atual`, que o lookup nao tem.

**Verificacao** (conta `apcameloc@gmail.com`: 250 femeas, 100 ativas, 150 vendidas)

| Tela | Seletor | Antes | Depois |
|---|---|---|---|
| Saude | filtro / formulario | 200 / 52 | **250 / 100** |
| Pesagens | filtro / formulario | 200 / 52 | **250 / 100** |
| Reproducao | filtro / formulario | 200 / 52 | **250 / 100** |
| Movimentacoes | formulario | 200 | **250** |
| Graficos | por animal | ≤200 | **100** |

- Endpoint: 250 itens = `COUNT(*)` do banco; so os 6 campos; sem token -> 401; conta de outro
  usuario nao ve nenhum id em comum; `/animais?page_size=201` continua 422.
- Navegador (Playwright): unica chamada restante e `/api/animais/lookup`; 0 erros no console.
- `tsc --noEmit` e `npm run build` limpos.

**Observado e nao corrigido** (fora do escopo):
- Animal sem brinco aparece como `#` vazio nos seletores de Saude, Pesagens, Movimentacoes e
  Reproducao. Graficos usa `#{brinco || id}` e `alertas.py` usa `brinco or nome or #id` — o
  rotulo de fallback e inconsistente entre telas. A conta de teste tem 248 de 250 animais sem
  brinco, o que deixa isso muito visivel nela.
- O seletor de formulario de Movimentacoes lista vendidos (250). E por ali que se vende um
  animal ja vendido — tratado no Bloco 4 (C6).

---

### Problema

O backend limita `page_size` a 200 (`animais.py:63`). Sete telas pedem exatamente 200 e usam
**so a primeira pagina**, descartando o resto sem aviso.

`listar_animais` **nao tem filtro de status por padrao**, entao as 200 vagas sao gastas
tambem com vendidos e mortos. A ordenacao e `order_by(Animal.brinco)` — alfabetica — e como
`brinco` e anulavel, o Postgres joga `NULL` para o fim: **animal sem brinco e o primeiro a
sumir**.

### Medicao real (conta `apcameloc@gmail.com`, banco local, 23/09/2026)

| | |
|---|---|
| Animais no banco | 250 |
| Chegam no frontend | 200 |
| Ativos no rebanho | 100 |
| **Ativos visiveis no seletor** | **52** |

Quase metade do rebanho ativo invisivel com 250 animais — nao com 2.000.

### Impacto para o produtor

Nenhum registro e perdido ou corrompido no banco. Sao tres sintomas distintos:

1. **Seletor incompleto** — nao da para lancar pesagem, vacina ou venda para os animais que
   ficaram de fora. Bloqueio operacional: o dado que nunca pode ser lancado nao existe.
2. **Brinco errado na lista** — `animaisMap[x.animal_id]` volta vazio e a tela mostra o id
   interno (`#725`) em vez do brinco (`#A02`). Registro certo, rotulo errado.
3. **Graficos com numero falso** — calcula media e total sobre um subconjunto e apresenta
   como se fosse o rebanho inteiro. Sem aviso.

O publico declarado e 50-500 cabecas. O app quebra calado exatamente nessa faixa.

### Por que ninguem notou

`Animais.tsx:134` pagina corretamente (`{ page: p, page_size: pageSize }`). Navegar pelo
rebanho funciona. So as outras seis telas e que veem um recorte.

### Como corrigir

**Backend** — `routes/animais.py`, endpoint novo **antes** de `/{animal_id}` (senao a rota
dinamica captura "lookup"):

```python
class AnimalLookup(BaseModel):
    id: int
    brinco: Optional[str]
    nome: Optional[str]
    status: StatusEnum
    sexo: SexoEnum
    lote_id: Optional[int]

    class Config:
        from_attributes = True


@router.get("/lookup", response_model=List[AnimalLookup])
def lookup_animais(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Rebanho inteiro, so o necessario para montar seletor e mapa de brinco.

    Sem paginacao de proposito: toda tela que monta lookup precisa de TODOS os animais,
    inclusive vendidos (senao o historico exibe id interno em vez de brinco).
    """
```

Seis colunas, sem join, sem `count()`. Leve o bastante para nao paginar mesmo com milhares
de cabecas.

**Frontend** — trocar as seis chamadas e o tipo em `services/api.ts`:

| Arquivo | Linha |
|---|---|
| `Saude.tsx` | 50 |
| `Reproducao.tsx` | 75, 205 |
| `Movimentacoes.tsx` | 42 |
| `Pesagens.tsx` | 34 |
| `Graficos.tsx` | 64 |

`Animais.tsx:134` **nao muda** — ali a paginacao e intencional.

### Cuidado

Filtrar por `status: 'ativo'` **nao resolve**. As telas precisam dos vendidos no mapa de
brinco para exibir o historico corretamente — foi a licao do bug de brinco corrigido nas
Pesagens. O filtro de ativos fica **so nos seletores de formulario**, nunca no lookup.

### Verificacao

1. Banco local ja tem a conta com 250 animais (100 ativos).
2. Abrir Saude, Reproducao, Movimentacoes, Pesagens e conferir que o seletor lista 100 ativos.
3. Conferir que a lista de registros mostra brinco, nunca `#<numero>`.
4. Graficos: total exibido tem que bater com `SELECT COUNT(*) FROM animais WHERE status='ativo'`.

---

## BLOCO 2 — financeiro: C5 -> C3 -> C4 ✅ (concluido 24/09/2026)

### Resultado

**Tres correcoes no plano que o codigo obrigou**

1. **C5 era maior que trocar um campo.** O Financeiro nao usava `_calcular_gmd`; tinha calculo
   proprio e, com 1 pesagem no periodo, ignorava a pesagem *anterior ao periodo* e voltava direto
   ao peso de entrada. Trocar so `data_nascimento` por `data_entrada` deixaria as telas ainda
   discordando. A regra compartilhada certa e o **ponto de partida do ganho**: pesagem anterior,
   senao entrada do animal (`referencia_de_ganho`).
2. **C3 precisava mudar o divisor junto.** Incluir a racao dos vendidos mas continuar dividindo
   pelos ativos de hoje inflaria o custo por cabeca. O divisor passou a ser o **rebanho medio do
   periodo** (cabeca-dias / dias), exposto como `cabecas_medias_periodo`.
3. **C3 estava em tres lugares, nao um.** `relatorios.py` reimplementava o custo nutricional no
   PDF do contador e no livro caixa com a mesma regra errada. Corrigir so a tela faria o
   Financeiro discordar do documento que vai pro contador. Os tres usam a mesma funcao agora.

**Arquivos**
- `app/zootecnia.py` (novo) — unica fonte de: `ponto_de_entrada`, `referencia_de_ganho`,
  `gmd_entre`, `calcular_gmd`, `presencas`, `cabeca_dias`, `rebanho_medio`,
  `custos_nutricionais_no_periodo`. Segue a convencao plana do projeto (`app/auth.py`,
  `app/email_service.py`), e nao `app/services/` como o plano dizia.
- `routes/pesagens.py` — `_calcular_gmd` saiu daqui; `animais.py` e `relatorios.py` importam
  `calcular_gmd` de `zootecnia`.
- `routes/financeiro.py` — C5 (1 query extra para as pesagens anteriores ao periodo, sem N+1),
  C3 (funcao compartilhada + divisor por rebanho medio), C4 (`lucro_liquido + total_agio`).
- `routes/relatorios.py` — resumo do contador e livro caixa na funcao compartilhada; 2 imports
  sem uso removidos.
- Frontend: `Financeiro.tsx` (cabecalho com rebanho medio; "Lucro Liquido sem Agio"),
  `Movimentacoes.tsx` ("Agio / comissao", placeholder "Ja incluido no valor"), tipo em `api.ts`.
- `tests/test_zootecnia.py` (8 testes), `pytest.ini`, `requirements-dev.txt` (pytest fora do
  `requirements.txt`, para o Render nao instalar).

**Regra de presenca (C3) — so usa datas que o sistema conhece**
- entrada: `data_entrada`, senao `data_nascimento`; sem nenhuma, sem limite inicial. A data de
  cadastro **nao** e usada: o produtor costuma cadastrar o rebanho que ja estava na fazenda.
- saida: data da ultima venda/morte/transferencia. Animal ativo nao tem saida.
- inativo **sem** movimentacao de saida fica de fora (como antes): nao ha como saber quando saiu.

**Decisao sobre o agio (C4)** — o codigo sempre tratou o agio como *parte* do valor da compra
(nenhum dos tres calculos o soma como custo). O formulario nao dizia isso. Agora diz ("Ja
incluido no valor"), alinhando o que o produtor digita com o que o sistema calcula. Se a
intencao for o contrario (agio pago a parte), a mudanca e somar `agio_compra` ao custo de compra
nos tres lugares.

Os nomes de campo da API (`lucro_liquido_sem_agil*`) **nao** mudaram: backend e frontend sobem
em deploys separados no Render, e renomear quebraria o frontend publicado na janela entre os dois.

### Verificacao

Os dados de teste nao tinham custo nutricional nem despesa fixa — um antes/depois neles mostraria
o C3 "sem mudanca". Por isso: cenario montado com resposta calculavel a mao, medido com o codigo
antigo e com o novo, e **apagado no fim** (script em scratchpad, nao versionado).

Cenario: lote L1 com 10 animais (entrada 01/01, 300 kg; A3 nascido em 2024). A7-A10 vendidos em
31/03. Racao R$ 2/kg x 5 kg/dia; sal do lote R$ 4/kg x 0,1 kg/dia; mao de obra R$ 3.000/mes;
vacina R$ 20/cab.

| Jan-jun | Antes | Depois | Calculo a mao |
|---|---|---|---|
| Custo nutricional | 11.073,60 | **14.673,60** | racao (6x181 + 4x90) x 10 + sal 6x89x0,4 |
| Rebanho medio | — | **7,99** | 1.446 cab-dia / 181 |
| Custo total / cabeca | 4.895,60 (/6) | **4.127,40** (/7,99) | 32.973,60 / 7,99 |
| GPD medio | 0,466 | **0,587** | A3: 0,069 -> 0,432 (entrada, nao nascimento) |
| Lucro liquido | -41.683,60 | **-45.283,60** | -3.600 da racao dos vendidos |
| Lucro sem agio | -26.600,00 | **-43.283,60** | liquido + 2.000 de agio |
| PDF do contador — nutricao | 11.073,60 | **14.673,60** | = Financeiro |
| Livro caixa — nutricao | 11.073,60 | **14.673,60** | = Financeiro |

- **GMD da tela de Pesagens: identico antes e depois** (prova que mover `calcular_gmd` nao mudou
  nada la). E agora o GPD do Financeiro e a media exata dos GMDs que a tela de Pesagens mostra.
- **Periodo de controle (abr-jun, ninguem saiu): custo nutricional inalterado** — a mudanca so
  aparece quando ha saida no periodo, como deveria.
- **Contas reais**: `apcameloc` so ganhou o campo novo (sem custos, nada a mudar).
  `pedroazm66`: "sem agio" 206.000 -> 205.700 — os R$ 300 de vacina que a formula antiga
  ignorava; sem agio no periodo, agora e igual ao lucro liquido, como deve.
- Todo campo que mudou foi conferido contra o calculo a mao. Nenhuma mudanca sem explicacao.
- `pytest`: 8 passando. `tsc` e `npm run build` limpos. Tela do Financeiro renderizada sem erros.

### Descobertos no caminho (nao corrigidos)

- **Analise por lote perde tudo de quem saiu** — virou o **C7** abaixo.
- **Livro caixa do ano corrente lanca meses futuros**: custo sem data de fim vai ate 31/12. Em
  setembro, o livro de 2026 ja traz racao e despesas de outubro a dezembro. Pre-existente — virou
  o **M9** em `MELHORIAS_IMPORTANTES_AUDITORIA.md`.
- **Status x movimentacao inconsistentes nos dois sentidos** — anotado na pendencia do C6.

---

**Nesta ordem obrigatoriamente.** Os tres mexem em `analise_financeira`; fazer junto evita
tocar duas vezes no mesmo arquivo. C3 depende de um GMD confiavel, que e o C5.

### Procedimento de verificacao (fazer ANTES de tocar no codigo)

Como nao ha teste, o refactor de calculo financeiro e o ponto mais perigoso do app:

1. Rodar `GET /financeiro/analise` no banco local com **3 periodos diferentes** e salvar os
   JSON de resposta.
2. Refatorar.
3. Rodar de novo e comparar campo a campo.
4. **Todo campo que mudou precisa de justificativa escrita.** Campo que mudou sem explicacao
   significa que o refactor esta errado.

Aproveitar para deixar **2 testes pytest** no `calcular_gmd` extraido — e funcao pura, custa
20 minutos, e vira a primeira rede de seguranca do projeto.

---

### C5 — GMD calculado de duas formas diferentes ✅

**Categoria**: inconsistencia · **Complexidade**: baixa

#### Problema

`pesagens.py:42-44` tem um comentario proibindo explicitamente o que `financeiro.py:164` faz:

```python
# pesagens.py — "NAO usar data_nascimento — peso_entrada e o peso quando o animal
# foi cadastrado, nao o peso ao nascer"
data_ant = animal.data_entrada or animal.created_at.date()

# financeiro.py:164 — faz exatamente isso
data_pi = animal.data_nascimento or animal.created_at.date()
```

Os dois pareiam a data com `peso_entrada`, mas escolhem datas diferentes.

#### Impacto

O mesmo animal mostra um GMD na tela de Pesagens e outro no Financeiro. Para boi comprado
adulto a diferenca e enorme: `data_nascimento` pode estar dois anos antes de `data_entrada`,
diluindo o ganho e devolvendo um GMD ridiculamente baixo. Numero que nao bate entre telas e
o defeito que mais rapido faz um produtor abandonar o sistema.

#### Como corrigir

1. Extrair `_calcular_gmd` de `pesagens.py` para `app/services/zootecnia.py`.
2. Importar nos dois modulos.
3. Corrigir `financeiro.py:164` de `data_nascimento` para `data_entrada`.
4. Dois testes pytest cobrindo: com pesagem anterior, e sem pesagem (fallback de entrada).

---

### C3 — custo nutricional usa o rebanho de hoje ✅

**Categoria**: logica financeira · **Complexidade**: media

#### Problema

`qtd_cabecas` conta so animais com `status == "ativo"` **hoje**, e esse numero multiplica o
consumo de todo o periodo (`financeiro.py:226`):

```python
custo_nutri_total += c.preco_kg * c.consumo_kg_dia * dias * n
```

Animal vendido em marco comeu racao de janeiro a marco e nao entra na conta. O mesmo `n`
ainda e o divisor de `custo_total_por_cabeca`.

#### Impacto

Subestima o custo justamente no ciclo que fechou. Quem vendeu metade do lote ve custo
artificialmente baixo e lucro artificialmente alto — erro na direcao mais perigosa: faz o
produtor achar que a operacao e mais rentavel do que e.

#### Como corrigir

Separar dois conceitos que hoje sao o mesmo `qtd_cabecas`:

```
plantel_atual         -> status == ativo                          -> zootecnia (GMD, peso medio)
presentes_no_periodo  -> entrou antes do fim E nao saiu antes do   -> financeiro
                         inicio
```

A data de saida ja existe: e a `data` da movimentacao de venda/morte. A de entrada e
`animal.data_entrada` (com fallback para `created_at`).

---

### C4 — "Lucro Liq. s/ Agil" ✅

**Categoria**: logica financeira · **Complexidade**: baixa

#### Problema

Dois problemas no mesmo indicador.

**A conta** (`financeiro.py:325`):

```python
lucro_bruto        = receita - custo_compras - custo_total   # nutri + oper + saude
lucro_liquido      = lucro_bruto - impostos

lucro_liq_sem_agil = receita - custo_compras_sem_agil - custo_oper_total
                                                        # ^ so operacional
```

O segundo **ignora custo nutricional, custo de saude e impostos**. Nao e "lucro sem agio" —
e outra metrica, sempre maior, exibida lado a lado com a primeira como se fossem comparaveis.

**O rotulo** (`Financeiro.tsx:213-214`) diz **"Agil"**, que nao significa nada. O campo do
model e `agio_compra` — agio, a comissao do intermediario.

#### Impacto

O produtor ve dois lucros, escolhe o maior, e o maior e o que esquece a racao. Somado ao
rotulo incompreensivel, e o tipo de numero que destroi a confianca no app inteiro quando
alguem confere na ponta do lapis.

#### Como corrigir

O codigo atual ja assume que o agio esta **dentro** do `valor` da compra
(`custo_compras_sem_agil = custo_compras - total_agio`), entao a correcao e consistente:

```python
lucro_liq_sem_agil = lucro_liquido + total_agio
```

E renomear para **"Lucro liquido sem comissao"** nos dois lados (backend e `Financeiro.tsx`).

**Alternativa a considerar**: se o indicador nao tiver dono claro, remover. Dois lucros na
tela sempre confunde.

---

## BLOCO 3 — C2: vacina atrasada desaparece ✅ (concluido 24/09/2026)

### Resultado

**A pergunta que o plano nao respondeu**: como o sistema sabe que uma dose atrasada ja foi
aplicada? Resposta do codigo: nao sabe. Aplicar o reforco cria um registro **novo** — o antigo
continua com `proxima_data` no passado. O piso de 7 dias escondia isso por acidente (o registro
antigo "sumia" sozinho). So remover o piso faria **toda vacina ja reforcada virar atraso para
sempre**. Por isso a correcao tem tres pecas que so funcionam juntas:

1. **Regra de dose pendente** (`zootecnia.doses_pendentes`): vale so o registro mais recente de
   cada (animal, tipo, descricao) — descricao comparada sem caixa e sem espacos nas pontas. Reforco
   sem proxima data encerra a pendencia.
2. **Sem o piso de 7 dias** — com limite de 1 ano (`ATRASO_MAXIMO_DIAS`), ver decisao abaixo.
3. **Agrupamento** (`zootecnia.agrupar_por_dose`): mesma dose e mesmo vencimento = 1 alerta.
   A vacinacao de um lote de 50 animais e 1 cartao "(50 animais)", com link para a Saude.

**Eram quatro lugares com a regra errada, nao dois** — todos usam `zootecnia.sanidade_pendente`
agora:

| Lugar | Antes |
|---|---|
| `alertas.py` — Agenda e faixa da Dashboard | piso de 7 dias |
| `saude.py` — filtro `vencendo` | excluia todo atrasado |
| `dashboard.py` — quadro "Proximas vacinas" | excluia todo atrasado: dizia **"Nenhuma vacina agendada"** logo abaixo do alerta de atraso |
| `dashboard.py` — e-mail de alerta | excluia todo atrasado: o e-mail nao avisava justamente das atrasadas |

E um quinto, com o problema oposto: a coluna "Proxima" da tela de Saude pintava de vermelho a data
de registros ja reforcados. A listagem agora devolve `pendente` por registro; dose sem pendencia
fica em cinza.

**Frontend**: selo do quadro da Dashboard dizia "Urgente — -88d" para dose atrasada; agora
"Atrasada — 88d" / "Hoje" / "Urgente — Nd", com a contagem de animais do grupo. Tipos em `api.ts`
(`entidade_tipo: 'grupo'`, `pendente`, `qtd_animais`).

**Decisao: limite de 1 ano de atraso.** O plano dizia "atrasado nunca sai da lista ate ser
resolvido". Com a regra do registro mais recente, o que sobra atrasado e dose que ninguem aplicou —
mas um protocolo abandonado (ex.: aftosa, cuja vacinacao foi suspensa no pais) ficaria atrasado
para sempre, e **a tela de Saude nao tem edicao de registro nem existe dispensar alerta (A2)** — o
produtor nao teria como tirar o alerta. Um ano cobre qualquer reforco semestral ou anual perdido.
A constante tem comentario para ser removida quando o A2 existir.

> **Revertida no mesmo dia (24/09/2026)**: decisao do produto — "o usuario deve ter a opcao de
> apagar qualquer alerta". O A2 foi implementado em seguida e o limite de 1 ano **foi removido**:
> dose atrasada fica ate o reforco ser registrado ou o produtor dispensar o alerta. Ver
> `ALTO_IMPACTO_AUDITORIA.md`, Bloco D.

### Verificacao

**Dados reais** (hoje invisiveis por passarem de 7 dias):

| Conta | Antes | Depois |
|---|---|---|
| `pedroazm66` — febre aftosa, 50 animais, 88 dias | 0 alertas de vacina | **1 alerta critico agrupado** |
| `uidemo2` — Aftosa, 1 animal, 14 dias | 0 | **1 alerta**, link para o animal |
| `apcameloc` (sem vacina pendente) | — | inalterada |

No navegador (conta `pedroazm66`): faixa da Dashboard "1 alerta critico — Vacina atrasada: febre
aftosa (50 animais)"; quadro de vacinas "febre aftosa · 50 animais — Atrasada — 88d"; Agenda com
2 alertas; Saude com as 50 doses em vermelho. 0 erros.

**Cenario montado** (criado, medido e apagado) — os dados reais nao tinham nenhum reforco:

| Caso | Resultado |
|---|---|
| Vacina reforcada | registro antigo **nao** pendente — sem falso atraso |
| 2 animais, mesma dose e data, atrasados | 1 alerta "Aftosa (2 animais)", critico |
| Reforco sem proxima data, descricao " aftosa " x "AFTOSA" | pendencia encerrada |
| Vermifugo em 7 dias | alerta medio, link para o animal |
| Animal vendido | fora |
| Atraso de mais de 1 ano | fora |

`pytest`: 12 passando (4 novos para a regra de dose e o agrupamento). `tsc` e build limpos.

### Observado e nao corrigido

- **Parto previsto tem o mesmo piso de 7 dias** (`alertas.py`, bloco 4). Semantica diferente: a
  previsao de parto da cobertura natural e a data *mais cedo possivel*, nao um vencimento. Decidir
  junto com o A8 (resultado reprodutivo em enum).
- Alerta de vermifugacao diz "**Vacina** em 7 dia(s): Ivermectina" — o titulo usa "Vacina" para
  qualquer tipo de sanidade. Pre-existente.
- O endpoint de e-mail de vacinacao (`POST /dashboard/alertas/email`) **nao e chamado por nenhuma
  tela**. Foi corrigido mesmo assim, para nao ficar uma regra diferente escondida.

---

**Categoria**: logica de negocio · **Complexidade**: baixa · **Prazo**: meio dia

### Problema

Dois filtros independentes empurram o atraso para fora da tela.

```python
# alertas.py:66 — so olha 7 dias para tras
Saude.proxima_data >= hoje - timedelta(days=7)

# saude.py:41 — filtro "vencendo" exclui TODO atrasado
if vencendo:
    q = q.filter(Saude.proxima_data >= date.today())
```

O filtro `vencendo` ainda devolve tudo que vence nos proximos dois anos, o que o torna
inutil nos dois sentidos.

### Impacto

E exatamente ao contrario do que deveria ser: **quanto mais atrasada a vacina, mais grave** —
e e justamente ai que ela some. Produtor que fica duas semanas sem abrir o app perde o alerta
para sempre. Em campanha de aftosa isso tem consequencia legal, nao so zootecnica.

### Como corrigir

- `alertas.py:66` — remover o piso de 7 dias (ou abrir para 180).
- `saude.py:41` — `vencendo` passa a significar `proxima_data <= hoje + 30d`, **incluindo**
  atrasados.

### Risco que precisa ser tratado junto

Isoladamente, essa correcao **piora** a experiencia: hoje a lista esconde atraso; depois,
meses de vacina atrasada aparecem de uma vez e a Agenda fica intransitavel.

Duas saidas:

- **(a)** fazer junto com o **A2** (dispensar alerta) — vira ~1,5 dia somado;
- **(b)** entregar C2 com agrupamento simples ("14 vacinas atrasadas") e deixar A2 depois.

**Recomendado: (b).** Resolve o perigoso (atraso invisivel) sem esperar o A2, e o agrupamento
e cerca de uma hora de trabalho.

---

## BLOCO 4 — C6: apagar venda nao devolve o animal ⬜

**Categoria**: bug de estado · **Complexidade**: media · **Prazo**: meio dia

### Problema

Criar sincroniza o status; apagar nao reverte.

```python
# criar_movimentacao (movimentacoes.py:42)
if data.tipo == TipoMovEnum.venda:
    animal.status = "vendido"
    animal.lote_id = None

# deletar_movimentacao (movimentacoes.py:88) — so apaga o registro
db.delete(mov); db.commit()
```

Tambem nao ha validacao de transicao: da para vender um animal ja vendido, ou registrar venda
de um animal morto. E `transferencia` nunca marca `status = transferido`, embora o enum tenha
o valor.

### Impacto

Errou o animal no lancamento da venda? Apagar nao resolve: ele fica **"vendido" para sempre**,
fora do lote e fora de todas as contagens. Nao existe caminho pela interface para traze-lo de
volta — e lancar venda errada no curral, com o celular na mao, e das coisas mais faceis de
acontecer.

### Como corrigir

Tres mudancas em `movimentacoes.py`:

1. `deletar_movimentacao` — se o tipo e `venda`/`morte` e **nao existe outra movimentacao
   terminal** para o mesmo animal, voltar `status = ativo`.
2. `criar_movimentacao` — recusar venda de animal que ja nao esta ativo, com mensagem clara.
3. `transferencia` passa a marcar `status = transferido`.

> Nota do Bloco 1: o seletor do formulario de Movimentacoes lista **todos** os animais, inclusive
> vendidos. Alem da validacao no backend (item 2), filtrar ativos nesse seletor quando o tipo for
> venda/morte/transferencia.

### Pendencia a decidir

Pode ja existir animal preso em "vendido" por lancamento apagado antes da correcao. Duas
opcoes:

- rodar query de diagnostico no banco local para ver se ha algum, e corrigir na mao; ou
- deixar so a correcao para frente.

**Decidido em 24/09/2026: opcao 2**, a ser feita junto com o Bloco 4:
- corrigir o codigo para frente (itens 1-3 acima e o item 4 abaixo);
- **mais uma consulta somente leitura** que lista os animais cujo status nao bate com as
  movimentacoes, nos dois sentidos (vendido/morto sem movimentacao de saida; venda/morte
  registrada com animal ativo). Nao altera nada. Rodar uma vez na **producao**: vazia encerra o
  assunto; com resultado, decidir caso a caso. Nao ha correcao automatica — o sistema nao tem como
  saber qual lado esta certo.

**Item 4 (descoberto em 24/09/2026)**: editar o animal de "vendido" para "ativo"
(`atualizar_animal` em `animais.py`) deixa a venda registrada. Editar para "vendido" cria a venda,
mas voltar nao desfaz. E o provavel caminho dos 50 animais da conta `pedroazm66` — R$ 206 mil
de receita no Financeiro para animais que continuam no rebanho. Aplicar a mesma regra do item 1.

> **Nota do Bloco 2** — o diagnostico precisa olhar os **dois sentidos**, e os dois ja existem
> no banco local:
> - `apcameloc@gmail.com`: **150 animais "vendidos" sem nenhuma movimentacao de venda**;
> - `pedroazm66@gmail.com`: **50 animais com venda lancada que continuam "ativos"**.
>
> A venda em lote (`lotes.py:267`) sincroniza o status corretamente, entao a origem e outra:
> alteracao em massa de status, edicao manual ou importacao de backup. Isso afeta o C3: animal
> inativo sem data de saida fica fora do rebanho medio, e animal ativo com venda conta como
> presente.

### Verificacao

1. Criar venda de um animal -> conferir `status = vendido` e `lote_id = NULL`.
2. Apagar a venda -> conferir `status = ativo`.
3. Criar venda, criar morte, apagar a venda -> status **continua** `morto` (ha outra terminal).
4. Tentar vender animal ja vendido -> 400 com mensagem clara.

---

## C7 — Analise por lote perde tudo de quem saiu do lote ⬜

**Categoria**: logica financeira · **Complexidade**: media · **Descoberto no Bloco 2**

> **Unico critico que precisa de migration.**

### Problema

A venda e a morte fazem `animal.lote_id = None` — em `criar_movimentacao`
(`movimentacoes.py`) e em `movimentacao_em_lote` (`lotes.py:296`). Toda consulta "do lote" filtra
por `Animal.lote_id == X`, entao **quem saiu deixa de pertencer ao lote para sempre**.

No Financeiro com `lote_id`:

- a **receita da venda do lote some** — o comentario em `financeiro.py` diz "mesmo os ja
  vendidos", mas o filtro por `Animal.lote_id` exclui exatamente eles;
- a **compra** dos animais vendidos some;
- a racao e a vacina deles somem;
- e as **despesas fixas da fazenda inteira** entram cheias na conta do lote.

### Prova (cenario do Bloco 2, lote L1)

4 dos 10 animais do L1 vendidos por R$ 20.000. Analise do lote jan-jun:
`receita_vendas = 0`, compras de 6 animais em vez de 10, custo operacional R$ 18.100 (a fazenda
toda). Resultado: -R$ 49.403,60 — um lote que vendeu R$ 20 mil aparece so com prejuizo.

### Impacto para o produtor

Analisar o lote do inicio ao fim do ciclo (compra -> engorda -> venda) e **o** uso principal da
analise por lote para quem faz engorda. Depois da venda, e justamente o resultado que ele quer
ver — e o app mostra receita zero.

### Como corrigir (precisa decidir)

- **(a) Recomendado**: gravar `lote_id` na `Movimentacao` no momento do lancamento (migration
  em `movimentacoes`). As consultas financeiras por lote passam a usar o lote *da movimentacao*.
  Mantem a regra de "venda tira do lote" que o resto do app assume. Vendas antigas nao tem o
  lote gravado — so vale daqui para frente.
- (b) Parar de zerar `lote_id` na venda. Raio de impacto grande: toda consulta de "animais do
  lote" passaria a precisar filtrar status.
- Despesas fixas: ratear pela participacao do lote no rebanho medio (`cabeca_dias` do lote /
  `cabeca_dias` total) — as funcoes ja existem em `zootecnia.py`.

---

## Resumo

| ID | Titulo | Complex. | Migration | Status |
|----|--------|----------|-----------|--------|
| C1 | Paginacao silenciosa em 200 animais | baixa | nao | ✅ |
| C5 | GMD divergente entre modulos | media | nao | ✅ |
| C3 | Custo nutricional com rebanho de hoje | media | nao | ✅ |
| C4 | "Lucro Liq. s/ Agil" errado | baixa | nao | ✅ |
| C2 | Vacina atrasada desaparece | media | nao | ✅ |
| C6 | Apagar venda nao reverte status | media | nao | ⬜ |
| C7 | Analise por lote perde quem saiu do lote | media | **sim** | ⬜ |

**Total estimado**: 3 a 4 dias. Nenhum depende de decidir publico-alvo — por isso vem antes
do mapa de pastos e da Fase 4.
