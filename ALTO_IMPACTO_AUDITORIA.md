# BovIA — Alto Impacto da Auditoria

Auditoria de codigo feita em 23/09/2026. Oito achados que **nao estao quebrados no sentido
tecnico**, mas aparecem no uso real e limitam o que o app consegue oferecer depois.

Para pedir: "Faca o Bloco A2" ou "Faca o A5".

**Legenda**: ⬜ pendente · 🟡 em andamento · ✅ concluido · ⛔ descartado

> **Pre-requisito**: fazer depois dos criticos (`CRITICOS_AUDITORIA.md`). O A2 em especial
> depende do C2 para fazer sentido.

---

## Ordem de ataque

```
Bloco A   A5                  1 dia      so frontend, ganho visivel imediato
Bloco B   A1 + A3             1,5 dia    1 migration — cria a tela de Configuracoes de verdade
Bloco C   A4                  1 dia      performance, sem migration
Bloco D   A2                  1 dia      1 migration — fecha o par com o C2
Bloco E   A6 + A7 + A8        2-3 dias   migrations — destrava as metricas de cria (F2)
```

**Sequencia recomendada**: A -> B -> C -> D -> E.
O Bloco A e um ganho visivel barato para comecar. O Bloco E e o mais pesado e o unico que
muda modelo de dados de verdade.

---

## BLOCO A — A5: 17 caixas de confirmacao nativas ⬜

**Categoria**: UX / visual · **Complexidade**: baixa · **Prazo**: 1 dia

### Problema

`confirm()` nativo em 10 paginas, sempre nas acoes destrutivas:

```
Saude.tsx        Lotes.tsx          Reproducao.tsx     Configuracoes.tsx
Movimentacoes.tsx Pesagens.tsx      DespesasFixas.tsx  CustosNutricionais.tsx
AnimalDetalhe.tsx Pastagens.tsx
```

O app **ja tem** `components/Modal.tsx` e `components/Toast.tsx` prontos e sem uso nesses pontos.

### Impacto

No PWA instalado no Android a caixa aparece como dialogo do sistema, com
**"bovia-web.onrender.com diz:"** no topo. Quebra o tema escuro por completo e denuncia que e
um site embrulhado — exatamente no momento de maior tensao, quando o produtor vai apagar
alguma coisa. E o ponto do app que mais destoa do resto do acabamento.

### Como corrigir

1. Hook `useConfirm()` sobre o `Modal` existente, devolvendo `Promise<boolean>`.
2. Substituir as 17 chamadas.
3. Texto do modal nomeia o que sera apagado ("Excluir 3 pesagens?") e o botao diz a acao,
   nunca "OK".

### Verificacao

Percorrer as 10 paginas, acionar cada exclusao, conferir que nenhum dialogo do navegador
aparece e que o tema escuro se mantem.

---

## BLOCO B — A1 + A3: Configuracoes de verdade ⬜

Os dois moram na mesma tela. Fazer junto.

### A1 — nao existe trocar senha nem editar perfil ⬜

**Categoria**: funcionalidade ausente · **Complexidade**: baixa

#### Problema

`routes/auth.py` expoe apenas `register`, `login`, `me`, `solicitar-reset` e `reset-senha`.
Nao ha endpoint de troca de senha autenticada nem de edicao de perfil. O usuario nunca pode
corrigir o nome da fazenda que digitou no cadastro.

E `Configuracoes.tsx` anuncia no subtitulo **"Backup, preferencias e administracao"** — mas so
tem backup.

#### Impacto

Para trocar a senha o produtor precisa sair da conta, pedir recuperacao e esperar e-mail — um
fluxo que acabou de dar trabalho para funcionar (migracao para Brevo). Para um SaaS pago, e
lacuna basica que aparece na primeira semana.

#### Como corrigir

- `PUT /auth/me` — nome, nome da fazenda, e-mail.
- `POST /auth/trocar-senha` — exige senha atual, minimo 6 caracteres (mesma regra do reset).
- Secao "Conta" em `Configuracoes.tsx`.

---

### A3 — meta de abate fixa em 480 kg para todos ⬜

**Categoria**: logica de negocio · **Complexidade**: baixa

#### Problema

```python
# alertas.py:23
PESO_ABATE_MINIMO = 480.0  # kg de peso vivo (macho)
```

Constante global, igual para todo usuario. Nelore e Angus terminam em pesos diferentes; quem
faz recria vende magro perto de 380 kg e nao quer alerta de abate nenhum.

O mesmo vale para dois outros padroes embutidos:

- `Lote.rendimento_carcaca` nasce **52.0** em todo lote;
- `Pasto.capacidade_ua_ha` nasce **1.5** em todo pasto.

#### Impacto

Para quem nao termina gado, esse alerta e puro ruido desde o primeiro dia — e reforca a
sensacao de que o app "nao e para mim".

E tambem a **versao barata e correta da Fase 4** que ficou em suspenso: o mecanismo de avisar
"esse animal chegou na meta" ja existe; falta so a meta ser do produtor, nao do codigo.

#### Como corrigir

- Colunas em `users`: `peso_alvo_kg`, `rendimento_padrao`, `capacidade_padrao_ua_ha` + migration.
- Ler em `alertas.py` em vez da constante.
- Formulario na mesma tela do A1.
- Valores atuais viram **default**, nao lei. Peso-alvo zerado **desliga** o alerta de abate.

#### Verificacao

Definir peso-alvo 380 numa conta e conferir que o alerta muda de faixa. Zerar e conferir que
o alerta some.

---

## BLOCO C — A4: N+1 no endpoint do Dashboard ⬜

**Categoria**: performance · **Complexidade**: media · **Prazo**: 1 dia

### Problema

Tres lacos aninhados, cada um com query dentro:

```
_build_pasto_out(pasto)            -> query lotes          (pastos.py:74)
  _peso_total_lote(lote)           -> query animais        (pastos.py:56)
    _ultima_pesagem_animal(a.id)   -> 1 QUERY POR ANIMAL   (pastos.py:45)

# alertas.py:141 — mesmo padrao para cada macho ativo
for a in machos_ativos:
    ultima = db.query(Pesagem)...first()
```

E em `alertas.py:126` existe uma subquery `subq_ult` **construida e nunca usada** — alguem
comecou a corrigir exatamente isso e nao terminou.

### Impacto

Rebanho de 300 cabecas em 8 pastos dispara facilmente mais de 400 queries a cada abertura do
Dashboard. No 4G instavel da fazenda, e a diferenca entre abrir o app e desistir dele.

O `financeiro.py:130` ja corrigiu esse mesmo padrao — o comentario de la diz "antes eram 2
queries por animal — 100 queries para 50 animais".

### Como corrigir

1. Promover a `subq_ult` ja escrita a helper compartilhado (ex.: `ultimas_pesagens(ids, db)`
   devolvendo `dict[animal_id, peso]`).
2. Substituir `_ultima_pesagem_animal` pelo dicionario em `pastos.py` e `alertas.py`.
3. Apagar o codigo morto de qualquer forma.

### Verificacao

Ligar `echo=True` no engine (ou log de queries) e contar queries de `GET /alertas` antes e
depois, com a conta de 250 animais. Meta: de centenas para menos de 10.

---

## BLOCO D — A2: alerta nao pode ser dispensado ✅ (concluido 24/09/2026)

**Categoria**: UX / produto · **Complexidade**: media · **Prazo**: 1 dia

### Resultado

Decisao do produto: **o usuario deve ter a opcao de apagar qualquer alerta.** Feito para todos os
tipos (vacina, pasto, abate, parto), em todas as telas que mostram alerta, com recuperacao.

**Identidade do alerta — o ponto que define se a dispensa funciona.** Cada alerta carrega chaves
que identificam a *ocorrencia*, nao o tipo (`app/dispensas.py`):

| Alerta | Chave | Consequencia |
|---|---|---|
| Vacina | `vacina:{id do registro}` | o reforco cria outro registro — a proxima dose volta a alertar |
| Parto | `parto:{id da cobertura}` | a proxima gestacao volta a alertar |
| Abate | `abate:{animal}` | a decisao e sobre aquele animal |
| Pasto | `{tipo}:{pasto}:{ocupacao}` | nova ocupacao do pasto volta a alertar |

Assim, dispensar tira **aquele** alerta sem silenciar os proximos do mesmo tipo. Alerta agrupado
de vacina carrega uma chave por dose: dispensar o grupo dispensa cada dose, e se um animal ganhar
uma dose nova ela aparece sozinha.

**Backend**
- Tabela `alertas_dispensados` (`user_id`, `chave`, unica por usuario) — migration
  `d3e4f5a6b7c8`, testada em ida e volta; `alembic check` sem diferencas.
- `POST /alertas/dispensar` e `POST /alertas/restaurar` (`{chaves: [...]}`, idempotente, ate 2000
  chaves de ate 100 caracteres). `GET /alertas?dispensados=true` devolve so os dispensados.
- A dispensa vale em **todo lugar**: Agenda e faixa da Dashboard (`/alertas`), lista da Pastagens
  (`/pastos/alertas`, mesma chave), quadro de vacinas da Dashboard, e-mail, filtro `vencendo` e
  marcacao da Saude (via `zootecnia.sanidade_pendente`).
- **Limite de 1 ano de atraso do C2 removido** — nao e mais necessario.
- `PastoOut.ocupacao_id` (novo) identifica o episodio de ocupacao.

**Frontend**
- Agenda: o cartao virou duas areas — abrir (a principal) e **dispensar (×, 44px de toque)**. Antes
  o cartao inteiro era um `<button>`, e botao dentro de botao e HTML invalido. Classes novas no
  `index.css` (`.alerta-card*`), sem estilo inline.
- Agenda: "Ver alertas dispensados" lista o que saiu, com **Restaurar**.
- Pastagens: × em cada alerta de pasto.
- Sem dialogo de confirmacao: a acao e reversivel, e o aviso diz onde recuperar.

**Verificacao**
- Cenario pelos endpoints (criado e apagado): um alerta de cada tipo dispensado; lista normal
  vazia; `?dispensados=true` com os 5; repetir e idempotente; Pastagens, quadro da Dashboard,
  `vencendo` e Saude respeitam; **dose nova do mesmo animal e nova ocupacao do pasto voltam a
  alertar**; restaurar devolve; lista vazia/chave longa -> 422; sem token -> 401.
- Navegador (celular 390px, conta com 50 vacinas atrasadas): × tira o cartao, aviso aparece,
  "Ver dispensados" mostra, Restaurar devolve. Cartao nao transborda. 0 erros. Dados restaurados.

**Nao feito (continua pendente neste item)**
- **Agrupar alertas de abate** ("12 animais prontos para abate") — hoje ainda e um por animal.
  Com a dispensa, o produtor ja consegue limpar a lista, mas um a um.
- "Adiar 30 dias" — a dispensa e definitiva ate restaurar. Nao foi pedido.

**Achado de carona**: `--surface-subtle` nao existe no design system. A Pastagens usava essa
variavel nas linhas de "Lotes no pasto", entao o fundo nunca aparecia. Trocada por `--gray-50`.

---

> Fecha o par com o **C2**. Sem isso, corrigir o alerta atrasado troca um problema por outro.

### Problema

Os alertas sao recalculados do zero a cada chamada (`alertas.py:48`), sem nenhum estado de
"visto" ou "resolvido". O alerta de abate dispara para **todo** macho acima de 480 kg, toda
vez, para sempre.

### Impacto

Oitenta bois terminados geram oitenta alertas permanentes que empurram para baixo a vacina
atrasada e o parto previsto. Uma lista que nao se limpa deixa de ser lida — e ai os alertas
que importam tambem somem.

### Como corrigir

- Tabela `alertas_dispensados` (`user_id`, `tipo`, `entidade_id`, `dispensado_ate`) + migration.
- Filtro em `listar_alertas`.
- Acoes na UI: "dispensar" e "adiar 30 dias".
- **Agrupar alertas de grupo**: "12 animais prontos para abate" em vez de doze linhas.

### Verificacao

Dispensar um alerta e conferir que nao volta. Conferir que o de abate aparece agrupado.

---

## BLOCO E — A6 + A7 + A8: modelo de dados da reproducao ⬜

Os tres sao do mesmo dominio e os dois ultimos destravam juntos o **F2** (indicadores de cria).

### A6 — bezerro criado no parto nasce incompleto ⬜

**Categoria**: logica de negocio · **Complexidade**: baixa

#### Problema

`_criar_bezerro` (`reproducao.py:36`) grava `data_nascimento` e `peso_entrada`, mas **nao grava
`data_entrada`** — que e justamente o campo que o calculo de GMD usa. E nao cria a
`Movimentacao(tipo=nascimento)` correspondente, embora o enum tenha o tipo.

#### Impacto

Ao lancar um parto ocorrido ha tres meses, o bezerro entra com data de entrada vazia: o GMD
cai para a data de cadastro (hoje) e sai errado ou nulo. E o livro de movimentacoes fica sem
os nascimentos — se o produtor lancar a mao para compensar, passa a contar o animal duas vezes.

#### Como corrigir

Em `_criar_bezerro`: adicionar `data_entrada=data_nascimento` e emitir a `Movimentacao` na
mesma transacao.

---

### A7 — nao existe genealogia ⬜

**Categoria**: modelo de dados · **Complexidade**: media

#### Problema

```python
# reproducao.py:51
origem = f"Filho(a) de #{mae.brinco}"   # string, nao relacao
```

`Animal` nao tem `mae_id` nem `pai_id`, e `Reproducao.bezerro_brinco` / `touro_brinco` tambem
sao texto solto. Se o brinco da mae mudar, o texto fica desatualizado e ninguem percebe.

#### Impacto

Bloqueia a metrica mais valiosa que existe para quem faz cria: **quilos de bezerro desmamado
por vaca por ano**. Tambem impede descartar vaca improdutiva com dado — hoje e impossivel
responder "quantos bezerros essa vaca me deu em cinco anos?".

Para produtor de cria, e a diferenca entre um app de registro e um app de decisao.

#### Como corrigir

- Colunas `mae_id` e `pai_id` em `animais` + migration.
- Preencher em `_criar_bezerro`.
- Bloco "Crias" na ficha do animal (`AnimalDetalhe.tsx`), com peso e data.

---

### A8 — resultado reprodutivo e texto livre ⬜

**Categoria**: modelo de dados · **Complexidade**: baixa

#### Problema

`schemas/reproducao.py:21` declara `resultado: Optional[str]` — sem enum. E a regra de negocio
depende de igualdade exata de string:

```python
# reproducao.py:30
resultado == "nasceu bezerro"

# alertas.py:165
RES_TERMINAIS = ("nasceu bezerro", "aborto", "vazia")
```

Qualquer variacao — maiuscula, acento, "nasceu" sozinho — quebra a criacao automatica do
bezerro e o filtro de partos previstos, **sem erro nenhum**.

#### Impacto

Alem da fragilidade, impossibilita agregar **taxa de prenhez** — o indicador numero um de quem
trabalha com cria. Os dados estao todos la; so nao da para conta-los com seguranca.

#### Como corrigir

- `ResultadoEnum`: `prenha`, `vazia`, `nasceu_bezerro`, `aborto`.
- Aplicar no schema e no model.
- Migration normalizando os valores existentes.
- Trocar as comparacoes literais pelo enum.

Depois disso, taxa de prenhez vira uma query.

#### Verificacao

Registrar cobertura, marcar resultado, conferir criacao do bezerro e o filtro de partos
previstos. Conferir que valor invalido e recusado pelo Pydantic.

---

## Resumo

| ID | Titulo | Complex. | Migration | Status |
|----|--------|----------|-----------|--------|
| A5 | 17 confirm() nativos | baixa | nao | ⬜ |
| A1 | Sem trocar senha / editar perfil | baixa | sim | ⬜ |
| A3 | Meta de abate fixa em 480 kg | baixa | sim | ⬜ |
| A4 | N+1 em alertas e pastos | media | nao | ⬜ |
| A2 | Alerta nao pode ser dispensado | media | sim | ✅ |
| A6 | Bezerro sem data_entrada nem movimentacao | baixa | nao | ⬜ |
| A7 | Sem genealogia (mae_id) | media | sim | ⬜ |
| A8 | Resultado reprodutivo em texto livre | baixa | sim | ⬜ |

**Total estimado**: cerca de uma semana.

**Dependencias que importam**:
- A2 depende do C2 para fazer sentido (e vice-versa).
- A3 reutiliza a tela criada pelo A1.
- F2 (`FUTURO_AUDITORIA.md`) depende de A7 **e** A8.
