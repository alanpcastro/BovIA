# BovIA — Pendências e próximos passos

Consolidado em 2026-07-28. Fonte única do que falta. Arquivos relacionados:
[BUGS_MOBILE.md](BUGS_MOBILE.md), [BUGS_PENDENTES.md](BUGS_PENDENTES.md), [DEPLOY.md](DEPLOY.md).

---

## ✅ Já concluído (contexto)

- **20 bugs de lógica** corrigidos (ver [BUGS_PENDENTES.md](BUGS_PENDENTES.md) — todos ✅)
- **App hospedado e funcionando**: backend + frontend na Render, banco no Neon (Ohio)
- **Deploy resolvido**: Python 3.12, `bootstrap.py` (cria tabelas em banco novo / aplica migrations em banco existente), SPA redirects, API via `VITE_API_URL`, pooling do Neon (`pool_pre_ping`)
- **Imagem de fundo** comprimida (911 KB → 168 KB)
- **Análise financeira** otimizada (N+1 → 1 query)
- **Coluna "Peso Atual"** na tela de Animais (última pesagem em vez do peso de entrada)
- **Campo "Data de Entrada"** no animal + GMD calculado desde a entrada na 1ª pesagem

---

## ⏳ Pendências imediatas (configuração — você faz no painel)

### 1. Configurar email (recuperação de senha) — IMPORTANTE
Hoje o "esqueci minha senha" **não funciona** (email não configurado). Se o sócio esquecer a senha, fica trancado fora.
- Conta: `bovia.contato@gmail.com`
- Gerar **Senha de App** no Google (ativar verificação em 2 etapas → App passwords)
- Na Render (backend `bovia-api` → Environment), adicionar:
  - `MAIL_USERNAME` = `bovia.contato@gmail.com`
  - `MAIL_PASSWORD` = a senha de 16 letras
  - `MAIL_FROM` = `bovia.contato@gmail.com`

### 2. Keep-alive (opcional — tira o delay de ~30s)
O backend grátis "dorme" após 15 min. Para o teste, aceitável, mas some com um ping:
- [cron-job.org](https://cron-job.org) (grátis) acessando `https://bovia-api.onrender.com/` a cada 10 min
- Cabe no plano grátis (1 backend sozinho ≈ 730h/mês, limite ~750h)

### 3. Conferir o último deploy
Verificar se a Render aplicou a migration do `data_entrada` no Neon (automático via `bootstrap.py`) e se a tela de Animais mostra "Peso Atual" + o campo "Data de Entrada" aparece no cadastro.

---

## 🎨 Pendências de produto / UX (código)

### 4. ✅ Layout mobile — RESOLVIDO (2026-07-28) — ver [BUGS_MOBILE.md](BUGS_MOBILE.md)
- ✅ **Tabelas viram cartões no celular** (Animais, Pesagens, Movimentações, Saúde, Reprodução) — sem scroll lateral
- ✅ **Dashboard "Peso Médio"** — agora em grade 2×2, aparece por inteiro
- ✅ **Cards "Resultado do Mês"** — largura total no mobile
- Como: classes `.table-cards` + `data-label` nas células + media queries em `frontend/src/index.css` (tabela no desktop, cartão no celular)

### 5. GMD com ganho colorido (verde/vermelho) na tela de Animais
Mostrar o ganho ao lado do peso atual — verde se ganhou, vermelho se perdeu.
Já está pronto pra fazer: o backend retorna `peso_atual` e `peso_entrada`, basta calcular a diferença e colorir. (Ficou combinado de fazer "depois".)

---

## 🏗️ Pendência grande (só se validar a demanda)

### 6. Offline-first (funcionar sem sinal no campo)
**Hoje o app NÃO funciona offline**: abre (interface cacheada), mas sem sinal os dados não carregam e não dá pra cadastrar nada. É o coração do uso no campo.
- Precisa: banco local no celular (IndexedDB) + fila de sincronização
- Facilitadores no nosso caso: 1 usuário por fazenda (quase sem conflito), dados quase só de entrada
- Ferramentas a avaliar: PowerSync, ElectricSQL, RxDB, WatermelonDB (podem reduzir de meses para semanas)
- **Fazer só depois de validar que o produto interessa** — é o maior investimento técnico do projeto

---

## 🎯 O passo mais importante (estratégico, não é código)

### 7. Validar demanda ANTES de construir mais
O maior risco do projeto **não é técnico, é de mercado/distribuição**. O código já faz muita coisa.
- O sócio mostra o app pra **5–10 produtores reais**
- Pergunta-chave: *"Você pagaria R$X/mês por isso?"* — observar a reação real
- Se 3–4 puxarem a carteira / perguntarem preço → vale continuar e investir (ex: offline-first)
- Se todos acharem legal mas ninguém pagar → economizou meses
- **O ativo decisivo é a rede do sócio** (conseguir colocar na frente de quem paga)

> Evitar a armadilha de "melhorar o app mais um pouco antes de mostrar". Só o produtor
> real diz o que melhorar. Construir mais no escuro é o caminho de trabalhar muito sem retorno.

---

## Resumo por prioridade

| Prioridade | Item | Tipo |
|---|---|---|
| 🔴 Agora | #1 Email (reset de senha) | Config |
| 🔴 Agora | #7 Validar demanda com o sócio | Estratégico |
| ✅ Feito | #4 Layout mobile (tabelas→cartões, dashboard, cards) | Código |
| 🟡 Curto prazo | #2 Keep-alive | Config |
| 🟡 Médio | #5 GMD colorido | Código |
| 🟢 Depois | #6 Offline-first | Código grande (pós-validação) |
