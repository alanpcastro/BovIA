# BovIA — Críticos da Auditoria

Auditoria de codigo feita em 23/09/2026. Seis achados que produzem **numero errado ou perda
de acesso a dado sem nenhuma mensagem de erro**.

Para pedir: "Faca o Bloco 1" ou "Faca o C5".

**Legenda**: ⬜ pendente · 🟡 em andamento · ✅ concluido · ⛔ descartado

> **Propriedade importante**: nenhum dos seis precisa de migration. Sao todos mudanca de
> query, calculo ou rota nova. Cada bloco e um commit proprio e um deploy proprio;
> rollback e `git revert`.

> **Risco transversal**: o projeto **nao tem nenhum teste**. Por isso o Bloco 2 (financeiro)
> tem um procedimento de verificacao por snapshot descrito no proprio bloco.

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

## BLOCO 1 — C1: paginacao silenciosa ⬜

**Categoria**: bug de dados · **Complexidade**: baixa · **Prazo**: meio dia

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

## BLOCO 2 — financeiro: C5 -> C3 -> C4 ⬜

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

### C5 — GMD calculado de duas formas diferentes ⬜

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

### C3 — custo nutricional usa o rebanho de hoje ⬜

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

### C4 — "Lucro Liq. s/ Agil" ⬜

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

## BLOCO 3 — C2: vacina atrasada desaparece ⬜

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

### Pendencia a decidir

Pode ja existir animal preso em "vendido" por lancamento apagado antes da correcao. Duas
opcoes:

- rodar query de diagnostico no banco local para ver se ha algum, e corrigir na mao; ou
- deixar so a correcao para frente.

**Nao decidido.** Perguntar antes de executar o bloco.

### Verificacao

1. Criar venda de um animal -> conferir `status = vendido` e `lote_id = NULL`.
2. Apagar a venda -> conferir `status = ativo`.
3. Criar venda, criar morte, apagar a venda -> status **continua** `morto` (ha outra terminal).
4. Tentar vender animal ja vendido -> 400 com mensagem clara.

---

## Resumo

| ID | Titulo | Complex. | Migration | Status |
|----|--------|----------|-----------|--------|
| C1 | Paginacao silenciosa em 200 animais | baixa | nao | ⬜ |
| C5 | GMD divergente entre modulos | baixa | nao | ⬜ |
| C3 | Custo nutricional com rebanho de hoje | media | nao | ⬜ |
| C4 | "Lucro Liq. s/ Agil" errado | baixa | nao | ⬜ |
| C2 | Vacina atrasada desaparece | baixa | nao | ⬜ |
| C6 | Apagar venda nao reverte status | media | nao | ⬜ |

**Total estimado**: 3 a 4 dias. Nenhum depende de decidir publico-alvo — por isso vem antes
do mapa de pastos e da Fase 4.
