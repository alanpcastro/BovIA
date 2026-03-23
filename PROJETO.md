# Gado System — Definição do Projeto

## O que é
Sistema web de gestão pecuária para fazendeiros acompanharem seu rebanho.
Multi-tenant: cada fazendeiro tem seus próprios dados isolados.

## Stack
- **Backend**: Python + FastAPI + PostgreSQL + SQLAlchemy + Alembic + JWT
- **Frontend**: React + Vite + TypeScript
- **Auth**: JWT (token expira em 7 dias)

## Módulos / Entidades

### 1. Usuário (User)
- Cadastro com nome, email, senha, nome da fazenda
- Login retorna JWT

### 2. Lote (Lote)
- Agrupa animais por pasto/área
- Campos: nome, área em hectares, descrição

### 3. Animal (Animal)
- Brinco (identificador único por fazendeiro), nome, raça, sexo, data de nascimento
- Peso de entrada, origem (nascido/comprado), status (ativo/vendido/morto/transferido)
- Pertence a um lote (opcional)

### 4. Pesagem (Pesagem)
- Histórico de pesagens por animal
- Data + peso em kg + observações
- Permite calcular GMD (ganho médio diário)

### 5. Saúde (Saude)
- Vacinação, vermifugação, tratamento, exame, cirurgia
- Data, descrição, medicamento, dose, custo, responsável, próxima data

### 6. Reprodução (Reproducao)
- Cobertura natural, inseminação, transferência de embrião, parto
- Touro (brinco), resultado (prenha/vazia/nasceu bezerro), data prevista parto, brinco do bezerro

### 7. Movimentação (Movimentacao)
- Compra, venda, transferência, nascimento, morte
- Data, valor, peso, origem, destino

## Endpoints da API (planejados)

```
POST /auth/register       — cadastrar fazendeiro
POST /auth/login          — login, retorna token

GET/POST        /lotes
GET/PUT/DELETE  /lotes/{id}

GET/POST        /animais
GET/PUT/DELETE  /animais/{id}
GET             /animais/{id}/historico   — pesagens + saúde + reprodução juntos

GET/POST        /pesagens
GET/DELETE      /pesagens/{id}

GET/POST        /saude
GET/PUT/DELETE  /saude/{id}

GET/POST        /reproducao
GET/PUT/DELETE  /reproducao/{id}

GET/POST        /movimentacoes
GET             /movimentacoes/{id}

GET             /dashboard   — resumo: total animais, peso médio, próximas vacinas, nascimentos esperados
```

## Regras de Negócio
- Cada fazendeiro só vê seus próprios dados (filtro por `user_id` em todo SELECT)
- Brinco é único por fazendeiro (não global)
- Ao marcar animal como vendido/morto, registrar movimentação automaticamente
- Pesagem registra GMD se houver pesagem anterior

## Frontend (telas planejadas)
1. Login / Cadastro
2. Dashboard (cards: total animais, peso médio rebanho, alertas de vacinação)
3. Lista de Animais (tabela com filtro por lote/status/sexo)
4. Ficha do Animal (todas as informações + histórico)
5. Lotes (gestão de pastos)
6. Pesagens em lote (pesar vários animais de uma vez)
7. Saúde (agenda de vacinações, histórico)
8. Reprodução (controle de prenhez, previsão de partos)
9. Movimentações (entradas e saídas com valor)
10. Relatórios (evolução de peso, custo de saúde)

## Status Atual (23/03/2026)

### Backend — COMPLETO ✅
- [x] Models: User, Animal, Lote, Pesagem, Reproducao, Saude, Movimentacao
- [x] config.py, database.py, requirements.txt, .env.example
- [x] app/auth.py — JWT (hash senha, criar token, get_current_user)
- [x] app/schemas/ — Pydantic schemas para todas as entidades
- [x] app/routes/ — todos os endpoints REST (auth, lotes, animais, pesagens, saude, reproducao, movimentacoes, dashboard)
- [x] app/main.py — FastAPI com CORS configurado

### Frontend — COMPLETO ✅
- [x] package.json, vite.config.ts, tsconfig.json, index.html
- [x] src/main.tsx, src/App.tsx (React Router, rotas privadas)
- [x] src/services/api.ts (axios, interceptors JWT, tipos TypeScript)
- [x] src/context/AuthContext.tsx (login, register, logout)
- [x] src/components/Layout.tsx (sidebar com nav), PrivateRoute.tsx
- [x] src/pages/Login.tsx, Register.tsx
- [x] src/pages/Dashboard.tsx (cards + alertas)
- [x] src/pages/Animais.tsx (listagem com filtros + cadastro)
- [x] src/pages/AnimalDetalhe.tsx (ficha completa com tabs)
- [x] src/pages/Lotes.tsx (CRUD completo)
- [x] src/pages/Pesagens.tsx (registro com GMD)
- [x] src/pages/Saude.tsx (vacinações, tratamentos)
- [x] src/pages/Reproducao.tsx (inseminação, partos)
- [x] src/pages/Movimentacoes.tsx (compras/vendas com resumo financeiro)

### Pendente
- [ ] Alembic migrations (opcional — em dev, as tabelas são criadas automaticamente)

## Como rodar (local)
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # editar com credenciais reais
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```
