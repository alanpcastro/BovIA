from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from .config import settings
from .routes import auth, lotes, animais, pesagens, saude, reproducao, movimentacoes, dashboard, relatorios, custos_nutricionais, despesas_fixas, financeiro, backup

app = FastAPI(title="BovIA API", version="1.0.0")

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

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
app.include_router(custos_nutricionais.router, prefix="/custos-nutricionais", tags=["custos-nutricionais"])
app.include_router(despesas_fixas.router, prefix="/despesas-fixas", tags=["despesas-fixas"])
app.include_router(financeiro.router, prefix="/financeiro", tags=["financeiro"])
app.include_router(backup.router, prefix="/backup", tags=["backup"])


@app.get("/")
def root():
    return {"status": "ok", "app": "Gado System API"}
