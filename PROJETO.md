# BovIA — Definicao do Projeto

## O que e
Sistema web de gestao pecuaria para pequenos e medios produtores rurais.
Multi-tenant: cada fazendeiro tem seus proprios dados isolados.
Objetivo: substituir papel e planilha Excel, permitindo controle total de gastos, ganhos, lucros e metricas zootecnicas.

## Stack
- **Backend**: Python + FastAPI + PostgreSQL + SQLAlchemy + JWT
- **Frontend**: React + Vite + TypeScript
- **Auth**: JWT (token expira em 7 dias)

## Modulos / Entidades

### 1. Usuario (User)
- Cadastro com nome, email, senha, nome da fazenda
- Login retorna JWT

### 2. Lote (Lote)
- Agrupa animais por pasto/area
- Campos: nome, area em hectares, descricao, rendimento de carcaca (%, padrao 52)

### 3. Animal (Animal)
- Brinco (identificador unico por fazendeiro), nome, raca, sexo, data de nascimento
- Peso de entrada, origem (nascido/comprado), status (ativo/vendido/morto/transferido)
- Pertence a um lote (opcional)
- Soft delete (deletado_em)

### 4. Pesagem (Pesagem)
- Historico de pesagens por animal
- Data + peso em kg + observacoes
- Calcula GMD (ganho medio diario) automaticamente

### 5. Saude (Saude)
- Tipos: vacinacao, vermifugacao, tratamento, exame, cirurgia
- Data, descricao, medicamento, dose, custo, responsavel, proxima data, observacoes

### 6. Reproducao (Reproducao)
- Tipos: cobertura natural, inseminacao, transferencia de embriao, parto
- Touro (brinco), resultado (prenha/vazia/nasceu bezerro/aborto), data prevista parto, brinco do bezerro

### 7. Movimentacao (Movimentacao)
- Tipos: compra, venda, transferencia, nascimento, morte
- Data, valor, peso, preco por arroba (@), origem, destino, observacoes

### 8. Custo Nutricional (CustoNutricional)
- Custos de alimentacao/suplementacao por produto
- Campos: produto, preco/kg, consumo kg/dia/cab, data inicio, data fim, lote (opcional)
- Calcula custo diario por cabeca automaticamente

### 9. Despesa Fixa (DespesaFixa)
- Custos operacionais recorrentes
- Categorias: mao de obra, manutencao, energia, arrendamento, impostos, outros
- Campos: categoria, descricao, valor mensal, data inicio, data fim

## Endpoints da API

```
POST /auth/register       — cadastrar fazendeiro
POST /auth/login          — login, retorna token
GET  /auth/me             — dados do usuario autenticado

GET/POST        /lotes
GET/PUT/DELETE  /lotes/{id}
POST            /lotes/{id}/animais       — criacao em lote
POST            /lotes/{id}/pesagens      — pesagem em lote
POST            /lotes/{id}/saude         — saude em lote
POST            /lotes/{id}/reproducao    — reproducao em lote
POST            /lotes/{id}/movimentacoes — movimentacao em lote

GET/POST        /animais
GET/PUT/DELETE  /animais/{id}
GET             /animais/{id}/historico    — pesagens + saude + reproducao + movimentacoes

GET/POST        /pesagens
DELETE          /pesagens/{id}

GET/POST        /saude
GET/PUT/DELETE  /saude/{id}

GET/POST        /reproducao
GET/PUT/DELETE  /reproducao/{id}

GET/POST        /movimentacoes
GET             /movimentacoes/{id}

GET             /dashboard                — resumo: totais, peso medio, proximas vacinas, partos previstos
POST            /dashboard/alertas/email  — enviar alertas de vacinacao por email

GET/POST        /custos-nutricionais
PUT/DELETE      /custos-nutricionais/{id}

GET/POST        /despesas-fixas
PUT/DELETE      /despesas-fixas/{id}

GET             /financeiro/analise       — analise financeira completa (23+ metricas)
                                            params: data_inicio, data_fim, lote_id (opcional)

GET             /relatorios/animais.csv       — exportar animais
GET             /relatorios/pesagens.csv      — exportar pesagens
GET             /relatorios/financeiro.csv    — exportar movimentacoes + custos saude
POST            /relatorios/animais/importar  — importar animais via CSV
```

## Metricas Financeiras Implementadas

A analise financeira (`/financeiro/analise`) calcula:

| Categoria | Metricas |
|---|---|
| Peso | Peso medio inicial/final, GPD, ganho periodo em @ |
| Carcaca | Rendimento %, peso carcaca, GMC |
| Arrobas | @ entrada, @ saida, @ produzidas |
| Custos | Nutricional (total + /cab), Operacional (total + /cab), Saude, Total/cab, Custo/@ produzida |
| Precos | @ compra medio, @ venda medio, ganho/@, preco medio animal compra/venda |
| Resultado | Receita vendas, custo compras, lucro bruto, impostos, lucro liquido, rentabilidade % |

## Regras de Negocio
- Cada fazendeiro so ve seus proprios dados (filtro por `user_id` em todo SELECT)
- Brinco e unico por fazendeiro (nao global)
- Ao marcar animal como vendido/morto, registrar movimentacao automaticamente
- Pesagem registra GMD se houver pesagem anterior
- 1 arroba (@) = 15 kg
- Rendimento de carcaca padrao = 52% (configuravel por lote)
- Custos nutricionais podem ser por lote ou gerais (toda fazenda)
- Impostos sao separados das despesas operacionais no calculo de lucro liquido
- Calculo de custos usa sobreposicao de datas (overlap) entre registro e periodo de analise

## Frontend (telas)
1. Login / Cadastro
2. Dashboard (stats + alertas vacinacao + partos previstos + acoes rapidas)
3. Animais (tabela paginada com filtros por lote/status/sexo/busca)
4. Ficha do Animal (info + tabs: pesagens, saude, reproducao, movimentacoes)
5. Lotes / Pastos (cards com CRUD, rendimento de carcaca)
6. Pesagens (registro individual + em lote, com GMD)
7. Saude (vacinacoes, tratamentos, alertas de urgencia 7 dias)
8. Reproducao (controle de prenhez, previsao de partos)
9. Movimentacoes (compras/vendas com resumo financeiro, preco/@)
10. Analise Financeira (KPIs, custos, resultado, arrobas, desempenho zootecnico)
11. Custos Nutricionais (CRUD com calculo custo diario/cab)
12. Despesas Fixas (CRUD com categorias, separacao operacional vs impostos)
13. Relatorios (export/import CSV)

## Como rodar (local)
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # editar com credenciais reais
alembic upgrade head   # aplicar migrations no banco
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Migrations (Alembic)
O projeto usa Alembic para controle de schema do banco de dados.

```bash
cd backend

# Aplicar todas as migrations pendentes
alembic upgrade head

# Criar nova migration apos alterar models
alembic revision --autogenerate -m "descricao_da_mudanca"

# Ver migration atual
alembic current

# Reverter ultima migration
alembic downgrade -1
```

## Observacoes tecnicas
- Alembic gerencia o schema do banco (migrations em `backend/alembic/versions/`)
- O `env.py` do Alembic usa `DATABASE_URL` do `.env` automaticamente
- Email de alertas e recuperacao de senha usam `fastapi-mail` (configurar MAIL_* no .env)
- Frontend usa proxy do Vite: `/api` -> `http://localhost:8000`
- Recuperacao de senha usa token JWT com expiracao de 30 minutos
