# BovIA — O que falta fazer

Fonte única do que está **pendente** (atualizado em 2026-08-19). Tudo que já foi concluído
saiu daqui de propósito.

> Recomendação geral: o sócio está testando o app de verdade agora. Nenhum item de código
> abaixo é urgente — deixe o **feedback dele guiar a prioridade**, em vez de construir mais
> no escuro. A única coisa a fazer já, independente disso, é a **recuperação de senha**.

---

## ⚙️ Configuração (feito no painel do Render — não é código)

### 1. Recuperação de senha por e-mail — ÚNICO com risco real
Hoje o "esqueci minha senha" **não funciona**. Se o sócio esquecer a senha, fica trancado fora.
- Conta: `bovia.contato@gmail.com`
- Gerar **Senha de App** no Google (ativar verificação em 2 etapas → App passwords)
- Na Render (backend `bovia-api` → Environment), adicionar:
  - `MAIL_USERNAME` = `bovia.contato@gmail.com`
  - `MAIL_PASSWORD` = a senha de 16 letras
  - `MAIL_FROM` = `bovia.contato@gmail.com`

### 2. Keep-alive (opcional)
O backend grátis "dorme" após ~15 min → primeiro acesso demora ~30s. Some com um ping:
- cron-job.org (grátis) acessando `https://bovia-api.onrender.com/` a cada 10 min.

---

## 🎨 Produto / UX (código)

### 3. Botão flutuante (+) de ação
"+" grande fixo no canto da tela pra ação principal (cadastrar/pesar), ao alcance do polegar
no celular. Esforço médio.

### 4. Consistência visual (Fase 3 do upgrade de frontend)
Refino incremental do CSS artesanal que já existe (sem Tailwind/shadcn):
- Aplicar a escala de espaçamento (`--space-1..12`, já criada) nas telas de maior tráfego
  (Dashboard, Animais, Financeiro), trocando margens/gaps inline ad-hoc.
- Unificar cabeçalho de página, títulos de seção e estados vazios.
- Escala tipográfica coerente (tamanhos/pesos padronizados).

### 5. Microinterações (Fase 4 do upgrade de frontend)
- **Skeleton loaders** no lugar do texto "Carregando..." (Dashboard, listas).
- Transições suaves ao trocar aba / filtro / lista.
- Refino de hover/active e sombras em cartões e tiles.
- Garantir toque mínimo de 44px em alvos pequenos (ícones de lixeira/editar).

---

## 🧹 Pontas soltas (surgiram no caminho, não fechadas)

### 6. Estados de erro por campo nos formulários
O CSS já existe (`.input-error` + `.form-error`), mas **nenhum formulário usa ainda** —
o erro aparece só no banner do topo do modal. Falta ligar a validação por campo.

### 7. Navegação por teclado nas demais tabelas
Feita só na tela de **Animais** (linha clicável com `tabindex`/Enter). As outras tabelas
(Pesagens, Saúde, Movimentações, Reprodução) ainda não têm.

### 8. Editar reprodução no detalhe do animal
O botão de **editar registro reprodutivo** (mudar resultado, marcar nascimento) está só na
tela de **Reprodução**. A sub-tabela de reprodução dentro do **detalhe do animal** ainda só
tem excluir — falta replicar o editar lá.

---

## 🏗️ Grande (só depois de validar a demanda)

### 9. Offline-first (funcionar sem sinal no campo)
Hoje o app **não funciona offline**: abre a interface cacheada, mas sem sinal não carrega
dados nem deixa cadastrar. É o coração do uso no curral e o maior investimento técnico do
projeto (banco local no celular + fila de sincronização).
- Facilitadores no nosso caso: 1 usuário por fazenda (quase sem conflito de dados).
- Ferramentas a avaliar: PowerSync, ElectricSQL, RxDB, WatermelonDB.
- **Fazer só depois de confirmar que o produto interessa.**

---

## 🎯 Estratégico (em andamento)

### 10. Validar demanda com o sócio
O maior risco do projeto é de **mercado/distribuição**, não técnico. O sócio mostra pra
5–10 produtores reais e observa quem realmente pagaria. É o passo mais importante — e o que
deve decidir se/quando atacar os itens acima (principalmente o offline-first).
