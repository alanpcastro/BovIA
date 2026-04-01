from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base
from .routes import auth, lotes, animais, pesagens, saude, reproducao, movimentacoes, dashboard, relatorios

# Cria tabelas (sem Alembic em dev)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="BovIA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(lotes.router, prefix="/lotes", tags=["lotes"])
app.include_router(animais.router, prefix="/animais", tags=["animais"])
app.include_router(pesagens.router, prefix="/pesagens", tags=["pesagens"])
app.include_router(saude.router, prefix="/saude", tags=["saude"])
app.include_router(reproducao.router, prefix="/reproducao", tags=["reproducao"])
app.include_router(movimentacoes.router, prefix="/movimentacoes", tags=["movimentacoes"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(relatorios.router, prefix="/relatorios", tags=["relatorios"])


@app.get("/")
def root():
    return {"status": "ok", "app": "Gado System API"}
