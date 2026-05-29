# BovIA — Auditoria de Multi-Tenancy

**Data**: 2026-05-03
**Escopo**: Todos os endpoints HTTP em `backend/app/routes/*.py`
**Objetivo**: Garantir que nenhum endpoint vaza dados entre fazendas (user_id diferentes).

---

## Veredicto Geral

✅ **Nenhum vazamento de dados entre tenants foi encontrado em endpoints expostos via HTTP.**

Todos os endpoints filtram queries por `user_id` diretamente (em colunas próprias) ou indiretamente (via JOIN em entidade pai já verificada). Os 16 arquivos de rota foram inspecionados linha-a-linha.

---

## Arquivos Auditados (16)

| Arquivo | Status | Observação |
|---------|--------|-----------|
| `auth.py` | ✅ SAFE | Resposta uniforme em reset evita enumeração; senha min de 6 chars é fraco (item separado) |
| `animais.py` | ✅ SAFE | Inclui bulk-update e bulk-delete — todos filtram `Animal.user_id == current_user.id` |
| `alertas.py` | ✅ SAFE | Vacinas, partos, abate, pastos — todos com filtro |
| `backup.py` | ✅ SAFE | Export filtra por user_id; import força `user_id = current_user.id` |
| `custos_nutricionais.py` | ✅ SAFE | CRUD completo com filtro |
| `dashboard.py` | ✅ SAFE | Subqueries de pesagem fazem JOIN com Animal e filtram por user_id |
| `despesas_fixas.py` | ✅ SAFE | CRUD completo com filtro |
| `financeiro.py` | ✅ SAFE | Análise complexa multi-fonte, todas filtradas por user_id |
| `lotes.py` | ✅ SAFE | Endpoints em massa usam `_get_lote_or_404` que filtra |
| `movimentacoes.py` | ✅ SAFE | Sem endpoint de UPDATE/DELETE (gap funcional, não de segurança) |
| `pastos.py` | ✅ SAFE | Endpoints usam `_get_pasto_or_404` |
| `pesagens.py` | ✅ SAFE | JOIN com Animal + filtro user_id |
| `relatorios.py` | ✅ SAFE | Todos os exports CSV/Excel/PDF filtram |
| `reproducao.py` | ✅ SAFE | Padrão JOIN+filter consistente |
| `saude.py` | ✅ SAFE | Padrão JOIN+filter consistente |
| `__init__.py` | n/a | |

---

## Achados de Defense-in-Depth (LOW severity)

Estes **não vazam dados hoje** porque os callers já fazem guard, mas são frágeis: se alguém adicionar um endpoint novo chamando estes helpers com ID não verificado, vai vazar.

### 1. `pastos.py:33-40` — `_ultima_pesagem_animal`
```python
def _ultima_pesagem_animal(animal_id: int, db: Session):
    p = db.query(Pesagem).filter(Pesagem.animal_id == animal_id)...
```
Sem filtro de user. Chamado de `_peso_total_lote` que filtra por `lote_id` (lote já verificado).

### 2. `pastos.py:43-53` — `_peso_total_lote`
Queries `Animal.lote_id == lote_id` sem `Animal.user_id`. Chamado com lote.id verificado.

### 3. `pastos.py:81-86` — histórico de ocupação
`HistoricoOcupacao.pasto_id == pasto.id` sem filtro de user. Pasto já verificado.

### 4. `pastos.py:188` — verificação de ocupado
`db.query(Lote).filter(Lote.pasto_atual_id == p.id).first()` — apenas count check. Pasto verificado.

### 5. `pastos.py:289` — historico endpoint
`db.query(Lote).filter(Lote.id == h.lote_id).first()` — sem filtro de user.

### 6. `pesagens.py:14-26` — `_calcular_gmd`
`db.query(Pesagem).filter(Pesagem.animal_id == animal_id, ...)` sem filtro de user. Chamado pós-verificação.

### 7. `lotes.py:30` — `_animais_ativos`
`db.query(Animal).filter(Animal.lote_id == lote_id, ...)` sem `Animal.user_id`. Chamado após `_get_lote_or_404`.

### 8. `animais.py:308-311` — `historico_animal`
4 queries (Pesagem, Saude, Reproducao, Movimentacao) por `animal_id` sem filtro de user. Animal verificado em L304.

---

## Itens Fora de Escopo (mas relevantes para segurança)

### A. Fotos de animais expostas via static
`/uploads/animais/{userid}_{animalid}_{8chars}.{ext}` é servido sem autenticação. Filename inclui user_id e 8 chars de UUID (~36 bits de entropia). Difícil de adivinhar mas tecnicamente público se URL vazar.

**Recomendação**: servir via endpoint autenticado `GET /animais/{id}/foto` que valida ownership antes de retornar bytes; OU usar URLs assinadas com expiração curta.

### B. Senha mínima de 6 caracteres
`auth.py:83` — fraca para produção. NIST recomenda ≥8 e checagem contra senhas vazadas (HIBP API).

### C. Sem rate limit em `/auth/login`
Coberto em **0.2** do BLOCO 0 da MELHORIAS.md.

### D. `data` field em `criar_movimentacao` aceita qualquer data
Atacante pode criar movimentação com data futura ou passada arbitrária. Não vaza dados, mas distorce relatórios financeiros do próprio usuário.

---

## Plano de Hardening Aplicado

Para os 8 achados de defense-in-depth, vou adicionar filtro explícito por user_id onde aplicável. Custo zero em performance, ganho enorme em robustez contra futuros bugs.

Aplicado em commit subsequente — ver MELHORIAS.md item 0.1.
