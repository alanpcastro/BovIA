# Guia de Deploy — BovIA (Render + Neon)

Hospedagem gratuita para testes com sócio. Backend + Frontend na Render, banco no Neon.

**Tempo estimado:** ~1h30 na primeira vez.

---

## Antes de começar

- [ ] Código commitado e **pushado** pro GitHub (`github.com/alanpcastro/BovIA`)
- [ ] Conta no [Neon](https://neon.tech) (login com GitHub)
- [ ] Conta no [Render](https://render.com) (login com GitHub)

> ⚠️ A Render deploya a partir do GitHub. Qualquer correção que não estiver
> pushada **não vai pro ar**. Sempre: commit → push → deploy automático.

---

## Passo 1 — Banco de dados (Neon)

1. Entre no [Neon](https://console.neon.tech) → **New Project**
2. Nome: `bovia` · Região: **AWS US East (Ohio)** ou a mais próxima
3. Depois de criar, vá em **Connection Details** (ou "Connection string")
4. Copie a **connection string** completa. Formato:
   ```
   postgresql://usuario:senha@ep-xxxx.us-east-2.aws.neon.tech/bovia?sslmode=require
   ```
5. **Guarde essa string** — vai usar no Passo 2.

> O `?sslmode=require` no final é importante — o Neon exige SSL. Mantenha.

---

## Passo 2 — Backend (Render Web Service)

1. No [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Conecte o repositório `BovIA` do GitHub
3. Configure:
   | Campo | Valor |
   |---|---|
   | **Name** | `bovia-api` |
   | **Region** | Ohio (mesma do Neon, menos latência) |
   | **Root Directory** | `backend` |
   | **Runtime** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | Free |

4. Em **Environment Variables**, adicione:
   | Chave | Valor |
   |---|---|
   | `DATABASE_URL` | (a connection string do Neon, do Passo 1) |
   | `SECRET_KEY` | gere com o comando abaixo |
   | `FRONTEND_URL` | `http://localhost:5173` (ajusta no Passo 4) |

   Gerar a SECRET_KEY (rode no terminal do seu Mac):
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

5. Clique **Create Web Service**. Vai buildar e subir (~3-5 min).
6. Quando terminar, copie a URL gerada. Ex: `https://bovia-api.onrender.com`
7. **Teste**: abra `https://bovia-api.onrender.com/` no navegador. Deve responder:
   ```json
   {"status": "ok", "app": "Gado System API"}
   ```
   Se aparecer isso, o backend subiu **e as tabelas foram criadas no Neon** (a migration rodou no start).

---

## Passo 3 — Frontend (Render Static Site)

1. No Render → **New** → **Static Site**
2. Conecte o mesmo repositório `BovIA`
3. Configure:
   | Campo | Valor |
   |---|---|
   | **Name** | `bovia-web` |
   | **Root Directory** | `frontend` |
   | **Build Command** | `npm install && npm run build` |
   | **Publish Directory** | `dist` |

4. Em **Environment Variables**:
   | Chave | Valor |
   |---|---|
   | `VITE_API_URL` | a URL do backend do Passo 2 (ex: `https://bovia-api.onrender.com`) |

5. Clique **Create Static Site**. Build ~1-2 min.
6. Copie a URL gerada. Ex: `https://bovia-web.onrender.com`

> O arquivo `frontend/public/_redirects` já cuida do roteamento SPA —
> atualizar a página em telas internas (F5 em `/animais/5`) não dá 404.

---

## Passo 4 — Resolver o "ovo e galinha" das URLs

O backend precisa saber a URL do frontend (pro CORS) e vice-versa.
Como cada um só existe depois de criado, agora fechamos o ciclo:

1. Volte no **backend** (`bovia-api`) → **Environment**
2. Edite `FRONTEND_URL` para a URL real do frontend:
   ```
   FRONTEND_URL = https://bovia-web.onrender.com
   ```
3. Salve. A Render vai **redeployar o backend** automaticamente (~2 min).

Pronto. Agora backend aceita chamadas do frontend, e o frontend sabe onde está o backend.

---

## Passo 5 — Testar de ponta a ponta

1. Abra `https://bovia-web.onrender.com`
2. **Crie uma conta** (Register)
3. Deve cair no Dashboard com os 3 passos de onboarding
4. Cadastre um lote → um animal → uma pesagem
5. Se tudo salvar e aparecer, **está funcionando** 🎉

Manda o link do frontend pro sócio.

---

## Coisas que vão acontecer (normal, não é bug)

- **Primeira carga do dia é lenta (~30s)**: o backend free "dorme" após 15 min
  sem uso. O primeiro request acorda ele. Depois fica rápido.
- **Fotos de animais somem após um deploy**: disco da Render free é efêmero.
  Avise o sócio que fotos são temporárias por enquanto. (Solução futura: Cloudflare R2.)

---

## Manutenção

### Atualizar o app
```
Edita código → commit → push (GitHub Desktop)
→ Render detecta e redeploya sozinho (~3-5 min)
```
Não precisa mexer no painel. Backend e frontend têm **Auto-Deploy** ligado por padrão.

### ⏰ Prazo do Neon
O plano free do Neon **não expira**, mas tem limite de storage (~0.5 GB).
Para o volume de um alpha, dura meses. Fique de olho no painel do Neon.

### Trabalhar sem quebrar o app do sócio
Crie uma branch `dev` e trabalhe nela. Só a `main` deploya:
```bash
git checkout -b dev
# ...mexe, testa...
git checkout main && git merge dev && git push   # só agora vai pro ar
```

---

## Se algo der errado

| Sintoma | Causa provável | Solução |
|---|---|---|
| Frontend abre mas login/dados não funcionam | `VITE_API_URL` errado ou faltando | Confira no painel do frontend; rebuild |
| Erro de CORS no console do navegador | `FRONTEND_URL` no backend != URL real | Corrija no backend (Passo 4) |
| Backend não sobe, log fala de tabela | Migration não rodou | Confira o Start Command (Passo 2) |
| `SSL connection has been closed` | (já corrigido no código: `pool_pre_ping`) | Se persistir, confira `?sslmode=require` na DATABASE_URL |
| Build do frontend falha | Erro de TypeScript | Rode `npm run build` local antes de pushar |

Logs ficam em: painel da Render → serviço → aba **Logs**.
