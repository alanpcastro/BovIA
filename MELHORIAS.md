# BovIA — Melhorias Planejadas

Avaliacao completa feita em 05/04/2026. Use este arquivo como referencia para pedir implementacoes.
Basta dizer: "Faca o item 1.1" ou "Faca o bloco 3" etc.

---

## BLOCO 1 — CRITICO: Mobile e Responsividade ✅ (concluido 13/04/2026)

### 1.1 Menu hamburger no mobile ✅
- Sidebar substituida por drawer lateral deslizante no mobile (≤768px)
- Top bar fixa com botao hamburger, logo e nome da fazenda
- Drawer abre com animacao slide-in, overlay escuro, fecha ao clicar fora ou navegar
- Body scroll bloqueado quando drawer aberto
- Arquivos: `frontend/src/components/Layout.tsx`, `frontend/src/index.css`

### 1.2 Tabelas responsivas ✅
- `.table-wrapper` agora tem `overflow-x: auto` por padrao (nao so no mobile)
- Tabelas em `AnimalDetalhe.tsx` e `Dashboard.tsx` envolvidas em `table-wrapper`
- Todas as demais paginas ja tinham `table-wrapper`
- Grid responsivo: `.grid-4` vira 2 colunas no mobile, 1 coluna em ≤480px

### 1.3 Login/Register responsivo ✅
- Classes `auth-page`, `auth-hero`, `auth-form-panel` adicionadas
- No mobile: hero escondido, painel de formulario ocupa 100% da largura
- Padding reduzido para telas pequenas

---

## BLOCO 2 — CRITICO: PWA e Offline ✅ (concluido 12/04/2026)

### 2.1 Configurar PWA (vite-plugin-pwa) ✅
- `vite-plugin-pwa` configurado no `vite.config.ts` com manifest e service worker autoUpdate
- Icones gerados (192x192, 512x512) em `public/`
- Manifest com nome "BovIA - Gestao Pecuaria", display standalone, cores do tema
- Service worker registrado no `main.tsx` via `virtual:pwa-register`
- Workbox com runtime caching NetworkFirst para chamadas API

### 2.2 Store local com Dexie ✅
- `frontend/src/services/db.ts` criado com schema Dexie espelhando todas as 8 entidades
- Tabelas: lotes, animais, pesagens, saude, reproducao, movimentacoes, custosNutricionais, despesasFixas
- Tabela `syncQueue` para fila de sincronizacao
- Campos `serverId` para mapear IDs locais vs servidor

### 2.3 Sync queue (offline-first) ✅
- `frontend/src/services/sync.ts` com `enqueueSync()` e `processQueue()`
- Suporta create, update e delete na fila
- Sincronizacao automatica ao voltar online via evento `online`
- `pendingCount()` para exibir quantidade pendente na UI

### 2.4 Cache de leitura ✅
- Hook `useOfflineData<T>()` com estrategia stale-while-revalidate
- Dados servidos do cache Dexie imediatamente, API atualiza em background
- Cache atualizado automaticamente apos resposta da API
- Hook `useOnlineStatus()` com deteccao online/offline e sync automatico
- Indicador visual na sidebar: badge "Offline", "Sincronizando..." e "X pendentes"
- CSS para status-offline (vermelho), status-syncing (azul), status-pending (amarelo)

---

## BLOCO 3 — IMPORTANTE: UX e Experiencia ✅ (concluido 14/04/2026)

Entregue:
- 3.1 KPIs financeiros no Dashboard (lucro do mes, custo/@, rentabilidade) via `/financeiro/analise`
- 3.2 Nova pagina `/graficos` com recharts: evolucao de peso, composicao de custos (pizza), receita vs custo, animais por lote
- 3.3 Wizard de onboarding no Dashboard quando `total_animais === 0`
- 3.4 Fluxo integrado em Animais.tsx: secoes opcionais de compra e vacinacao no modal de cadastro
- 3.5 Confirmacao em dois passos nos modais de operacao por lote (Pesagens, Saude, Reproducao, Movimentacoes)

Detalhes:

### 3.1 Dashboard com resumo financeiro
- Adicionar mini-KPIs financeiros no Dashboard: lucro do mes, custo/@, rentabilidade
- Puxar dados do endpoint `/financeiro/analise` com periodo = ultimo mes
- Arquivos: `frontend/src/pages/Dashboard.tsx`, possivelmente `backend/app/routes/dashboard.py`

### 3.2 Graficos basicos
- Adicionar biblioteca de graficos (recharts ou chart.js)
- Graficos sugeridos:
  - Evolucao de peso por animal/lote ao longo do tempo
  - Custos vs receita por mes (barras)
  - Composicao de custos (pizza: nutricional, operacional, saude)
  - GMD por lote (barras comparativas)
- Podem ficar no Dashboard, no Financeiro, ou em nova pagina de Graficos

### 3.3 Onboarding / wizard de primeiro acesso
- Detectar usuario novo (0 animais, 0 lotes)
- Mostrar wizard: "Crie seu primeiro lote" -> "Cadastre animais" -> "Registre pesagem"
- Empty states mais informativos em cada pagina

### 3.4 Fluxo integrado de cadastro de animal
- Ao cadastrar animal, permitir ja registrar: peso de entrada, compra (movimentacao), vacinacao
- Tudo no mesmo modal/formulario, com secoes opcionais colapsaveis
- Evita o produtor navegar entre 4 paginas para um cadastro completo

### 3.5 Confirmacao visual em operacoes de lote
- Antes de aplicar operacao em lote (pesagem, vacinacao, movimentacao), mostrar:
  "Isso vai registrar para X animais do lote Y. Confirmar?"
- Arquivos: Pesagens.tsx, Saude.tsx, Reproducao.tsx, Movimentacoes.tsx (modals de lote)

---

## BLOCO 4 — IMPORTANTE: Seguranca e Infraestrutura ✅ (concluido 05/04/2026)

### 4.1 Recuperacao de senha ✅
- Backend: endpoints POST /auth/solicitar-reset e POST /auth/reset-senha
- Token JWT de reset com expiracao de 30 minutos e tipo "reset"
- Email enviado via fastapi-mail em background task
- Frontend: paginas EsqueciSenha.tsx e ResetSenha.tsx
- Link "Esqueci minha senha" adicionado no Login
- Rotas /esqueci-senha e /reset-senha no App.tsx

### 4.2 Alembic migrations ✅
- Alembic configurado com env.py usando DATABASE_URL do .env
- Migration inicial gerada e executada (rendimento_carcaca, preco_arroba, agio_compra)
- Removido Base.metadata.create_all() do main.py
- PROJETO.md atualizado com instrucoes de migration

### 4.3 Validacoes de dados robustas ✅
- MovimentacaoCreate: data nao futura, valor >= 0, peso 0-2000kg, preco_arroba >= 0, agio >= 0
- ReproducaoCreate: data nao futura, data_prevista_parto > data evento
- AnimalUpdate: mesmas validacoes do AnimalCreate (brinco, peso, data nascimento)
- DespesaFixaCreate: data_fim > data_inicio
- Animal, Pesagem, Saude, CustoNutricional ja tinham validacoes adequadas

---

## BLOCO 5 — LIMPEZA E ORGANIZACAO ✅ (concluido 05/04/2026)

### 5.1 Remover arquivos lixo ✅
- Deletado `frontend/src/assets/logo_files/` (114 arquivos, 31MB de lixo)

### 5.2 Atualizar PROJETO.md ✅
- Reescrito com todos os modulos, endpoints, metricas e regras de negocio atuais

### 5.3 Metrica Lucro Liquido s/ Agil ✅
- Campo `agio_compra` adicionado no model/schema de Movimentacao
- Calculo no backend: `valor_venda - (valor_compra - agio) - custo_operacional`
- Campos `lucro_liquido_sem_agil` e `lucro_liquido_sem_agil_por_cab` na AnaliseFinanceira
- Campo "Agil / Comissao" no form de movimentacao (so aparece para compra)
- Exibido no Financeiro no card Resultado Financeiro
- NOTA: rodar `ALTER TABLE movimentacoes ADD COLUMN agio_compra FLOAT;` no banco

---

## BLOCO 6 — FUTURO (pos-MVP) — parcialmente concluido 14/04/2026

Entregue:
- 6.5 Dark mode: tokens semanticos em `index.css`, override `[data-theme="dark"]`, toggle no Layout persistido em localStorage
- 6.4 Backup: `/backup/export` (JSON) e `/backup/import` (multipart). Nova pagina `/configuracoes` no frontend
- 6.2 Fotos dos animais: campo `foto_url` em Animal, `POST/DELETE /animais/{id}/foto`, storage em `backend/uploads/animais/`, servido em `/uploads`. UI no AnimalDetalhe (clica no avatar para enviar). NOTA: rodar `ALTER TABLE animais ADD COLUMN foto_url VARCHAR;` no banco

Pendente (proximos blocos):
- 6.1 Notificacoes push (precisa VAPID + service worker)
- 6.3 Multi-usuario por fazenda (refatorar auth/permissoes)

---

### 6.1 Notificacoes push
- Alertas de vacinacao via push notification (alem do email)
- Requer service worker (depende do Bloco 2)

### 6.2 Fotos dos animais
- Upload de foto por animal
- Armazenamento local (Dexie) + cloud sync

### 6.3 Multi-usuario por fazenda
- Permitir que o dono da fazenda convide funcionarios
- Permissoes: admin, operador (so registra), visualizador

### 6.4 Backup automatico
- Export automatico dos dados periodicamente
- Opcao de restaurar backup

### 6.5 Modo escuro
- Toggle claro/escuro no Layout
- CSS variables ja facilitam isso

---

## BLOCO 7 — LACUNAS DO ESCOPO ORIGINAL (auditoria 15/04/2026)

Auditoria comparando o projeto atual com os 10 blocos de requisitos originais (imagens do ChatGPT).
Cobertura estimada: ~60%. Abaixo as lacunas por prioridade.

### 7.1 Controle de Pastagens (MODULO NOVO — alta prioridade) ✅ (concluido 15/04/2026)
- Model `Pasto` + `HistoricoOcupacao` em `backend/app/models/pasto.py`
- 9 endpoints em `backend/app/routes/pastos.py` (CRUD, ocupar, desocupar, historico, alertas)
- Schemas com metricas computadas: UA/ha, taxa_lotacao, ocupacao_pct, superlotacao
- Frontend `Pastagens.tsx`: cards com KPIs, alertas, modais de criar/editar/ocupar/historico
- Migration `a7c4e1b2d3f0_pastagens.py` aplicada
- FKs `pasto_atual_id` e `data_entrada_pasto` adicionadas em `lotes`

### 7.2 Simulador de Compra e Venda (DIFERENCIAL — alta prioridade) ✅ (concluido 16/04/2026)
- Pagina `/simulador` 100% client-side (sem backend)
- Inputs: qtd animais, peso compra/venda, preco/@ compra/venda, GMD, rendimento carcaca, custo diario/cab, frete compra/venda, mortalidade %
- Presets rapidos: Confinamento, Semiconfinamento, Pasto
- Output: lucro liquido, margem %, @ produzidas, custo/@ produzida, break-even (@/venda e peso minimo), detalhamento de custos e producao
- Responsivo: 2 colunas desktop, 1 coluna mobile
- Arquivo: `frontend/src/pages/Simulador.tsx`

### 7.3 Relatorios em PDF e Excel (alta prioridade)
Hoje `relatorios.py` so exporta CSV.
- Adicionar `reportlab` (PDF) e `openpyxl` (Excel) ao requirements
- Endpoints `/relatorios/animais.pdf`, `/animais.xlsx`, `/financeiro.pdf`, `/pesagens.xlsx`
- Template "resumo para contador": movimentacoes do periodo + despesas + lucro consolidado
- Historico anual: relatorio agregado ano fiscal (jan-dez)
- Arquivos: `backend/app/routes/relatorios.py`, `requirements.txt`

### 7.4 Campos financeiros faltantes (media prioridade) ✅ (concluido 16/04/2026)
- `Movimentacao`: colunas `frete` e `desconto` (Float, nullable) em `models/movimentacao.py`
- `MovimentacaoOut`: campo computado `custo_kg` (valor/peso_kg) via `@computed_field`
- `DespesaFixa.CategoriaDespEnum`: adicionadas `sal_mineral`, `suplemento`, `vermifugo`, `combustivel`
- `routes/financeiro.py`: receita_vendas = valor - desconto; custo_compras = valor + frete
- Migration `b8d5f2e9c1a0_campos_financeiros.py` aplicada (autocommit_block para ALTER TYPE)
- Frontend: form de Movimentacoes mostra Frete (compra) e Desconto (venda); coluna R$/kg na tabela
- Frontend: DespesasFixas com 4 novas categorias no select e badges

### 7.5 Categoria do Animal (media prioridade)
Escopo original pede campo "Categoria: bezerro, garrote, novilha, vaca, boi magro, boi gordo".
- Adicionar `CategoriaAnimalEnum` em `models/animal.py`
- Campo derivavel de sexo + idade + peso, mas deixar editavel
- Filtro por categoria em `Animais.tsx`
- Migration alembic

### 7.6 Campos do Lote faltantes (baixa prioridade)
- `pasto_atual_id` (FK para pasto — depende de 7.1)
- `data_entrada` (Date) — quando o lote comecou
- Ja temos `area_hectares` e quantidade (computada via count animais)

### 7.7 Agenda de Alertas completa (media prioridade)
Hoje so ha alerta de vacinas urgentes no dashboard.
- Rotacao de pasto (depende de 7.1): alertar quando dias_ocupacao > limite
- Data ideal de venda: quando animal atinge peso/categoria de abate
- Contas a pagar: alertas de despesas_fixas com vencimento proximo
- Meta de peso por lote: definir meta e alertar progresso
- Consolidar em `/dashboard/alertas` e em uma pagina `/agenda`

### 7.8 Inteligencia / Extras Diferencial (pos-MVP)
Bloco "Extra" das imagens — o que diferencia a BovIA.
- Indice de eficiencia por lote (GMD + custo/@ + mortalidade)
- Previsao de ponto de abate (regressao linear sobre pesagens)
- Analise do pior lote (ranking por eficiencia invertida)
- Sugestao automatica de venda (quando lote atinge meta ou preco de mercado favoravel)
- Pode ser feito em `routes/inteligencia.py` com calculos determinicos; IA generativa opcional
