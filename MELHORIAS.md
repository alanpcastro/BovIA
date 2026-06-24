# BovIA — Melhorias Planejadas

Avaliacao completa feita em 05/04/2026. Use este arquivo como referencia para pedir implementacoes.
Basta dizer: "Faca o item 1.1" ou "Faca o bloco 3" etc.

---

## BLOCO 0 — PRODUCAO / COMERCIALIZACAO (PRIORIDADE MAXIMA, auditoria 03/05/2026)

Identificados como **bloqueantes para venda do BovIA como SaaS**. Devem ser feitos antes do 7.8 (Inteligencia/Extras).
Cada um destes itens, se quebrado, destroi a confianca do cliente ou expoe dados.

### 0.1 Auditoria de multi-tenancy (CRITICO) ✅ (concluido 03/05/2026)
**Resultado**: Nenhum vazamento de dados entre tenants em endpoints HTTP. Os 16 arquivos de rota foram inspecionados linha-a-linha (todas as ~70 queries SQLAlchemy).
**Documentacao**: ver `SECURITY-AUDIT.md` para tabela completa.
**Hardening aplicado** (defense-in-depth) — 8 helpers que dependiam apenas de caller correctness foram explicitamente filtrados por user_id:
- `pastos.py:_ultima_pesagem_animal` — agora requer `user_id` e faz JOIN com Animal
- `pastos.py:_peso_total_lote` — agora filtra `Animal.user_id`
- `pastos.py:_build_pasto_out` — passa `pasto.user_id` para os helpers
- `pesagens.py:_calcular_gmd` — agora requer `user_id` e faz JOIN com Animal
- `lotes.py:_animais_ativos` — agora requer `user_id` e filtra; 4 callers atualizados
- `animais.py:historico_animal` — Pesagem/Saude/Reproducao com JOIN+filtro; Movimentacao com filtro direto
**Issues fora de escopo de multi-tenancy** (anotados em SECURITY-AUDIT.md):
- A. Fotos de animais expostas via static (info disclosure se URL vazar) — recomendado endpoint autenticado
- B. Senha minima de 6 chars (fraco para producao)
- D. Movimentacao aceita `data` arbitraria (impacta relatorios do proprio user)

### 0.2 Rate limit + brute-force protection no `/auth/login` (CRITICO) ✅ (concluido 26/05/2026)
- `slowapi==0.1.9` adicionado em requirements.txt
- `backend/app/rate_limit.py` (novo): Limiter com `get_remote_address` como key_func
- `main.py`: registrado `app.state.limiter`, handler de `RateLimitExceeded` (retorna 429 com JSON), `SlowAPIMiddleware`
- Limites por IP aplicados em `routes/auth.py`:
  - `POST /auth/login` -> **5 tentativas / 5 min** (depois 429)
  - `POST /auth/register` -> 5 / hora (impede spam de contas)
  - `POST /auth/solicitar-reset` -> 3 / hora (impede flood de email)
- Resposta uniforme em login ja existia ("Email ou senha invalidos" pra ambos os casos)
- Testado: 5 tentativas com senha errada -> 401; 6a tentativa -> 429 `{"error":"Rate limit exceeded: 5 per 5 minute"}`
- **Nao feito** (deliberado): contador de tentativas falhas por email + lockout no DB. Adiciona uma migration e cobre o caso de atacante girando IPs (botnet); por enquanto o limite por IP cobre 99% e evita custo de schema.

### 0.3 Backup automatizado verificado (CRITICO)
**Por que**: Cliente com 200 animais cadastrados perdendo o DB e catastrofico (responsabilidade legal + perda de cliente).
**O que fazer**:
- Verificar `backend/app/routes/backup.py` — esta agendado? por quem?
- Configurar cron diario (Render Cron Job ou GitHub Actions) gerando dump pg_dump
- Armazenar dumps em S3/R2/Backblaze (criptografados)
- Documentar procedimento de restore em `RESTORE.md`
- **Testar o restore pelo menos uma vez** — backup que nunca foi restaurado nao e backup

### 0.4 Protecao de arquivos estaticos (Fotos) (SEGURANCA)
**Por que**: Atualmente as fotos em `/uploads` sao publicas. Se a URL vazar, qualquer um ve o animal do cliente.
**O que fazer**:
- Remover `app.mount("/uploads", ...)` do `main.py`
- Criar endpoint `GET /animais/{id}/foto` que verifica se `current_user.id == animal.user_id`
- Retornar o arquivo usando `FileResponse` do FastAPI
- No frontend, atualizar tags `<img>` para apontar para o novo endpoint com header Authorization

### 0.5 Infraestrutura de Assinatura (COMERCIAL)
**Por que**: Necessario para cobrar mensalidade e controlar acesso.
**O que fazer**:
- **Model User**: adicionar `plano` (enum), `assinatura_status` (ativo, inadimplente, cancelado), `assinatura_expira_em` (datetime), `stripe_customer_id` (string)
- **Middleware/Dependency**: criar `check_assinatura_ativa` que bloqueia endpoints de escrita (`POST/PUT/DELETE`) se o status nao for `ativo` ou se a data expirou (modo "apenas leitura")
- **Webhooks**: endpoint para receber confirmacao de pagamento do Stripe/Mercado Pago e atualizar o status no banco

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
  - **Expansao (01/06/2026):** evolucao de peso ganhou filtro "todo rebanho / por animal / por lote"; "receita vs custo" virou serie mensal (6 meses, 6 chamadas paralelas a `/financeiro/analise`); card "animais por lote" trocado por "GMD medio por lote" (barras horizontais ordenadas, calculado no frontend a partir das pesagens com GMD)
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

### 7.3 Relatorios em PDF e Excel (alta prioridade) ✅ (concluido 26/04/2026)
- `requirements.txt`: reportlab==4.2.2 + openpyxl==3.1.5 (deps transitivas: pillow, et-xmlfile, chardet)
- `routes/relatorios.py` refatorado com helpers `_xlsx_response`, `_pdf_response`, `_format_header`, `_autosize`, `_styles`, `_table_style`, `_overlap_days`
- Excel: `/relatorios/animais.xlsx`, `/pesagens.xlsx`, `/financeiro.xlsx` (financeiro com 2 sheets: Movimentações + Custos de Saúde) — header verde-800 com font branca, autosize de colunas
- PDF rebanho: `/animais.pdf` em A4 landscape, tabela com brinco/nome/raça/sexo/categoria/status/peso/nascimento/origem, header verde + zebra em verde-50
- PDF resumo contábil: `/resumo-contador.pdf?data_inicio&data_fim` — receita líquida (vendas - descontos), custos (compras + fretes + saúde + despesas pro rata por dias do período), lucro bruto e líquido (descontando impostos), e tabela detalhada de movimentações
- Para "anual" basta passar 1º jan a 31 dez (não precisei criar endpoint separado)
- Frontend `Relatorios.tsx`: cada card de relatório agora tem botões CSV/Excel/PDF inline; novo card "Para o contador" com seletor de período + PDF; emojis 📤 📂 ⬇️ removidos e trocados por SVG (carry-over da auditoria UI)

### 7.4 Campos financeiros faltantes (media prioridade) ✅ (concluido 16/04/2026)
- `Movimentacao`: colunas `frete` e `desconto` (Float, nullable) em `models/movimentacao.py`
- `MovimentacaoOut`: campo computado `custo_kg` (valor/peso_kg) via `@computed_field`
- `DespesaFixa.CategoriaDespEnum`: adicionadas `sal_mineral`, `suplemento`, `vermifugo`, `combustivel`
- `routes/financeiro.py`: receita_vendas = valor - desconto; custo_compras = valor + frete
- Migration `b8d5f2e9c1a0_campos_financeiros.py` aplicada (autocommit_block para ALTER TYPE)
- Frontend: form de Movimentacoes mostra Frete (compra) e Desconto (venda); coluna R$/kg na tabela
- Frontend: DespesasFixas com 4 novas categorias no select e badges

### 7.5 Categoria do Animal (media prioridade) ✅ (concluido 26/04/2026)
- `CategoriaAnimalEnum` (bezerro, garrote, novilha, vaca, boi_magro, boi_gordo) em `models/animal.py`
- Coluna `categoria` (Enum, nullable) em `animais` + schema Create/Update/Out
- Filtro `?categoria=` em `GET /animais`
- Migration `c9e6f1a2d4b5_categoria_animal.py` aplicada (cria enum `categoriaanimalenum`)
- Frontend `Animais.tsx`: filtro novo, coluna na tabela com badge, campo no form com sugestao automatica (sexo+idade+peso) deixando o usuario sobrescrever
- Frontend `AnimalDetalhe.tsx`: categoria no header e no modal de edicao
- Heuristica: femea <24m=novilha, >=24m=vaca; macho <8m=bezerro; macho >=450kg=boi_gordo, >=360kg=boi_magro, senao garrote

### 7.6 Campos do Lote faltantes (baixa prioridade) ✅ (concluido 26/04/2026)
- `pasto_atual_id` ja existia (criado em 7.1) — agora exposto em `LoteOut` junto com `data_entrada_pasto`
- `data_entrada` (Date) adicionado em `models/lote.py` + Create/Update/Out
- Migration `d2b8a7e4f013_lote_data_entrada.py` aplicada
- Frontend `Lotes.tsx`: campo `Data de Entrada` no form (default hoje) e card mostra "Iniciado em X · N dias"
- `area_hectares` ja existia; quantidade de animais ja vinha como `total_animais` (computada via count)

### 7.7 Agenda de Alertas completa (media prioridade) ✅ (concluido 26/04/2026)
- Backend `routes/alertas.py`: endpoint unificado `GET /alertas` agregando 4 fontes em um schema unico (`Alerta` com tipo, severidade, titulo, mensagem, data, dias, link)
  - **Vacinas**: `saude.proxima_data` em [-7d, +30d]; severidade alta se atrasada/<=3d, media <=14d, baixa >=15d
  - **Pastos**: superlotacao (alta), sem rotacao >45d (media), descanso >90d (baixa) — reusa `_build_pasto_out` de `routes/pastos.py`
  - **Abate**: machos ativos com categoria `boi_gordo` OU peso atual >= 480kg
  - **Partos**: `reproducao.data_prevista_parto` em [-7d, +30d]
  - Ordenacao final: severidade alta > media > baixa, depois por dias asc
- Frontend `pages/Agenda.tsx`: lista cronologica com badges de tipo/severidade, contadores no topo, filtro por tipo+severidade, link clicavel para entidade
- Frontend `Dashboard.tsx`: alerta-big "X alertas criticos" agora consolida tudo (nao so vacinas) e aponta para `/agenda`; fallback de "X alertas de atencao" se so houver media
- Nav `Layout.tsx`: novo item "Agenda" entre Dashboard e Animais
- **Pendente / pos-MVP** (deixei fora desse bloco pra evitar mudanca de schema):
  - Contas a pagar: precisa adicionar `dia_vencimento` em `DespesaFixa`
  - Meta de peso por lote: precisa adicionar `meta_peso_kg` em `Lote`

### 7.8 Inteligencia / Extras Diferencial (pos-MVP)
Bloco "Extra" das imagens — o que diferencia a BovIA.
- Indice de eficiencia por lote (GMD + custo/@ + mortalidade)
- Previsao de ponto de abate (regressao linear sobre pesagens)
- Analise do pior lote (ranking por eficiencia invertida)
- Sugestao automatica de venda (quando lote atinge meta ou preco de mercado favoravel)
- Pode ser feito em `routes/inteligencia.py` com calculos determinicos; IA generativa opcional

---

## BLOCO 8 — DIFERENCIACAO COMPETITIVA (benchmark Rural Data, 03/06/2026)

Analise do concorrente direto **ruraldatabr.com** (produto "Seu Nettao"). Identificamos que o diferencial deles **nao** e o modulo zootecnico (o BovIA ja tem mais coisa: GMD com fallback, reproducao com criacao automatica de bezerro, simulador, GMD por lote, UA/ha por pasto, PWA offline-first). O gap esta em **interface conversacional + multi-fazenda + comercializacao**.

Plano abaixo em ordem de impacto vs custo.

### 8.1 Bot de WhatsApp com IA ("Seu Bovinho"?) — PRIORIDADE MAXIMA
**Objetivo:** produtor manda audio/texto/foto pelo WhatsApp ("gastei 2500 com racao hoje", "comprei 12 bois por 31200") e o sistema:
1. Transcreve audio (Whisper ou Anthropic Voice).
2. Classifica intencao (despesa, receita, pesagem, venda, compra de animal, vacinacao, parto) com LLM.
3. Extrai campos (valor, categoria, qtd cabecas, brinco) com prompt estruturado / function calling.
4. Cria o registro no BovIA do usuario correto.
5. Responde confirmando, com botoes inline para corrigir/desfazer.

**Arquitetura sugerida:**
- Numero WhatsApp Business via API Cloud (Meta) ou provider intermediario (Twilio, Zenvia, WATI)
- Webhook `POST /webhooks/whatsapp` no FastAPI valida assinatura, enfileira mensagem
- Worker assincrono (RQ ou apscheduler) consome a fila: transcreve -> classifica -> persiste -> responde
- Tabela `whatsapp_links` que liga `phone_e164` -> `user_id` (login inicial por codigo OTP enviado no Whats)
- Tabela `mensagens_recebidas` para auditoria e debug
- Provider LLM: Claude Sonnet 4.6 (tem function calling, ja sabemos usar, custo OK para volume baixo)

**Trabalho estimado:** 2-4 semanas focadas. Sub-itens:
1. Cadastro de numero + onboarding (OTP por WhatsApp)
2. Webhook + fila + transcricao
3. Prompt de classificacao + function calling para criar registros
4. UI de auditoria no BovIA mostrando ultimas mensagens recebidas e o que virou
5. Botoes inline de confirmacao/correcao

**Custo operacional:** WhatsApp Business API cobra por sessao iniciada pelo negocio (~R$0,03-0,10 cada). Sessoes iniciadas pelo cliente sao gratis nas primeiras 24h. Mais o custo de tokens LLM (~R$0,01-0,05 por mensagem com Claude Haiku, R$0,10-0,30 com Sonnet).

### 8.2 Multi-fazenda na mesma conta
Hoje `User.fazenda_nome` e uma string e cada `user_id` filtra direto nas queries. Para multi-fazenda:
- Nova tabela `fazendas (id, user_id, nome, criada_em)` com a fazenda atual virando linha
- Migration que cria 1 fazenda por usuario existente e adiciona `fazenda_id` em **todas** as tabelas tenant-aware (Animal, Lote, Pasto, Pesagem, Saude, Reproducao, Movimentacao, CustoNutricional, DespesaFixa)
- Refactor de todos os filtros: `user_id == X` -> `fazenda_id in (fazendas_do_usuario)`. Auditar como foi feito em 0.1
- Header com seletor de fazenda + indicador no canto
- Cobranca extra por fazenda adicional (igual modelo do Rural Data, R$40/mes/fazenda)

**Estimativa:** 1 semana. Maior risco e migrations + refatoracao dos endpoints.

### 8.3 Multi-usuario por fazenda
Casado com 8.2: tabela `fazenda_usuarios (fazenda_id, user_id, role)` com roles `dono`, `editor`, `leitor`. Convite por email. Permite "marido cuida do operacional, esposa do financeiro".
- Sobrepoe-se ao item 6.3 do plano original (que estava marcado como pos-MVP)
- Trabalho: 3-5 dias depois do 8.2

### 8.4 Relatorios em linguagem natural por IA
Endpoint `GET /relatorios/insight?periodo=mes` que:
1. Coleta dados do periodo (custos, receitas, GMD, mortalidade, vendas)
2. Monta prompt para LLM ("aqui sao os dados da fazenda X no mes Y, gere um paragrafo de insight executivo")
3. Devolve 1-3 paragrafos em portugues claro: "Sua margem caiu 12% em maio comparado a abril, principalmente porque o custo de racao subiu 23%. O GMD medio do lote Bezerros2026 esta abaixo da meta (1.1 vs 1.5 kg/dia)"

**Estimativa:** 2-3 dias. Pode reusar a mesma chave de LLM do 8.1.

### 8.5 Lembretes/notificacoes pelo WhatsApp
Quando 8.1 estiver pronto, expandir para mensagens **iniciadas pelo bot**:
- Vacina vence em 3 dias
- Parto esperado essa semana
- Pasto X em superlotacao
- Mensalidade vence amanha

Requer template aprovado pela Meta (sessoes iniciadas pelo negocio precisam de template). Trabalho: 2-4 dias depois do 8.1.

### 8.6 Site institucional + planos pagos
Pos-tecnico — depende de decidir comercializar:
- Landing page de vendas (separada do app, talvez em `/` enquanto o app fica em `/app/*`)
- Integracao Stripe ou Mercado Pago para assinatura
- Planos mensal/anual + cobranca por fazenda adicional
- Pagina de status, politica de privacidade, termos
- Hospedagem em Render/Fly.io com dominio proprio

**Status atual:** Pendente. Ordem de execucao recomendada: 8.1 → 8.4 → 8.2 → 8.3 → 8.5 → 8.6.

---

## BLOCO 9 — FUNCIONALIDADES PARA PEQUENO E MEDIO PRODUTOR (03/06/2026)

Levantamento de funcionalidades que atendem o publico-alvo do BovIA: pequeno e medio produtor brasileiro, tipicamente pecuaria extensiva (pasto + sal), alguns com suplementacao no periodo seco.

Diferente do BLOCO 8 (que veio de benchmark com concorrente), este bloco vem da analise do que o publico realmente precisa no dia-a-dia. Ordem abaixo e por impacto/esforco.

### 9.1 Painel de Cotacoes de Mercado no Dashboard ⭐ — PRIORIDADE
**Por que:** Produtor olha preco da arroba **toda manha** antes de qualquer decisao. E a primeira coisa que ele quer ver ao abrir o app. Rural Data nem tem isso na home — seria diferencial direto.

**O que mostrar (6 indicadores):**
- Boi gordo @ (CEPEA) — referencia de venda
- Bezerro @ (CEPEA) — compra/reposicao
- Vaca @ (CEPEA) — descarte/recria
- Milho saca 60kg (CEPEA) — influencia decisao de suplementar
- Soja saca 60kg (CEPEA) — idem
- Dolar (API Banco Central) — correlacionado com preco do boi (exportacao)

**Arquitetura:**
- Tabela `cotacoes (id, indicador, valor, variacao_pct_7d, variacao_pct_30d, data, fonte, atualizado_em)`
- Job em background (apscheduler) roda 1x/dia as 18h (CEPEA publica ~17h):
  - Scrape de paginas publicas da CEPEA (`cepea.esalq.usp.br/br/indicador/...`)
  - Chamada na API olinda.bcb.gov.br para dolar
- Endpoint `GET /mercado/cotacoes` devolve snapshot atual + variacoes
- Componente "Painel de Mercado" no topo do Dashboard, 6 cards com valor + variacao colorida

**Risco:** scraping da CEPEA quebra se eles mudarem HTML. Tratamento:
- Log + mostra "atualizado ha X dias" quando falha
- Alerta por email/sentry se falhar 2 dias seguidos

**Estimativa:** 1 dia (~4h backend + 2h frontend)

### 9.2 Calendario Sanitario Obrigatorio por UF
**Por que:** Aftosa (maio e novembro), brucelose (fêmeas 3-8 meses), tuberculose, raiva em algumas regioes — campanhas **obrigatorias** que variam por estado. Hoje a Agenda do BovIA so mostra vacinas que o usuario cadastrou; perde quem esquece. Pequeno produtor e exatamente quem mais esquece e leva multa da defesa agropecuaria.

**O que fazer:**
- Tabela `calendario_sanitario_oficial (id, uf, vacina, mes_inicio, mes_fim, publico_alvo, observacoes)` populada via seed com dados de cada estado (Adagri/IDA/IAGRO/IDARON dependendo da UF)
- Campo `uf` adicionado em `User` ou em uma nova tabela `Fazenda` (se 8.2 ja tiver sido feito)
- Endpoint `GET /alertas` ja existente passa a incluir alertas sanitarios obrigatorios com 30 dias de antecedencia
- Botao "Marcar como feita" gera registro em `Saude` automaticamente
- Relatorio anual de cumprimento (PDF) para apresentar a defesa agropecuaria se necessario

**Estimativa:** 2-3 dias (mais o levantamento dos calendarios por estado — pode comecar com SP, MG, GO, MT que cobrem 70% do rebanho nacional)

### 9.3 Previsao do Tempo por Regiao
**Por que:** Pasto depende 100% de chuva. Produtor decide rotacao de pasto, suplementacao, e ate hora de embarcar gado olhando previsao. Open-Meteo e INMET tem API gratuita publica.

**O que fazer:**
- Campo `latitude/longitude` na Fazenda (ou User enquanto 8.2 nao acontece) — pode ser preenchido por endereco via geocoding gratuito
- Chamada a `api.open-meteo.com/v1/forecast` com cache de 6h
- Card no Dashboard: previsao 7 dias + acumulado de chuva da semana
- Bonus: alerta no Agenda quando previsao indicar seca prolongada (>15 dias sem chuva)

**Estimativa:** 2-3h. API e simples, sem auth.

### 9.4 Exportador de LCDPR (Livro Caixa Digital Produtor Rural)
**Por que:** Obrigatorio para IRPF desde 2019 para quem fatura acima do limite (em 2026 ~R$ 5mi/ano, mas praticamente todo medio produtor faz). Gerar o arquivo TXT no formato exato da Receita Federal **economiza ao produtor R$ 500-2000/ano de contador**. E o gancho comercial mais forte de plataformas como Aegro.

**O que fazer:**
- Estudar o leiaute oficial do LCDPR (Receita publica especificacao em PDF)
- Endpoint `GET /relatorios/lcdpr?ano=2026` gera o arquivo TXT
- Mapear cada Movimentacao + Saude + DespesaFixa para o tipo de lancamento correto (4 tipos no leiaute)
- Frontend: botao "Baixar LCDPR" em Relatorios, com selecao de ano-base
- Pode ser cobrado a parte ou estar nos planos pagos como diferencial

**Estimativa:** 4-5 dias (o leiaute e complexo, precisa atencao a detalhes fiscais)

### 9.5 Calculadora de Venda Rapida
**Por que:** Pequeno produtor faz essa conta no papel toda semana — "se eu vender esse lote hoje a R$ XXX a arroba, quanto eu recebo liquido?". Ja temos a base no Simulador, falta um modo rapido em cada lote.

**O que fazer:**
- Em cada card de Lote (em `/lotes`), adicionar botao "Simular venda"
- Modal com 3 campos: peso medio/cabeca, preco da arroba, frete estimado
- Mostra: arrobas totais, valor bruto, frete, imposto (Funrural 1.5% sobre venda), liquido por cabeca, liquido total
- Reusa logica do Simulador.tsx (`rendimento_carcaca`, mortalidade, etc.)

**Estimativa:** 1 dia (~6h)

### 9.6 Itens NAO incluidos (justificativa)

Avaliei e deixei de fora intencionalmente:

- **GTA digital (Guia de Transito Animal)** — varia muito por estado, baixo retorno, burocratico
- **Emissao de NFe** — pequeno produtor geralmente vende informal pra frigorifico/atravessador, complicaria o app
- **Open banking** — pequeno produtor e avesso a conectar conta bancaria
- **Comparacao/benchmark com outras fazendas** — interessante mas requer base de dados grande e tratamento LGPD

**Ordem de execucao recomendada:** 9.1 → 9.3 → 9.5 → 9.2 → 9.4 (cotacoes primeiro por impacto visual; LCDPR por ultimo por ser o mais trabalhoso e fiscal).

### 9.7 Modo Demo / Dados de Exemplo ✅ (concluido 10/06/2026)
**Resultado**: Endpoints `/dashboard/demo` e `/dashboard/limpar-demo` funcionais.
**O que foi feito**:
- Logica para gerar 2 pastos, 2 lotes, 15 animais com historico de pesagens e movimentacoes
- Protegido por assinatura ativa
- Facilita onboarding de novos usuarios
