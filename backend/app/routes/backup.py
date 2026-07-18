from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.inspection import inspect
from datetime import date, datetime
from decimal import Decimal
import json
from ..database import get_db
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User
from ..models.pasto import Pasto, HistoricoOcupacao
from ..models.lote import Lote
from ..models.animal import Animal
from ..models.pesagem import Pesagem
from ..models.saude import Saude
from ..models.reproducao import Reproducao
from ..models.movimentacao import Movimentacao
from ..models.custo_nutricional import CustoNutricional
from ..models.despesa_fixa import DespesaFixa

router = APIRouter()

# Ordem importa: pais antes de filhos (FKs apontam pra cima)
EXPORT_MODELS = [
    ("pastos", Pasto),
    ("lotes", Lote),
    ("animais", Animal),
    ("pesagens", Pesagem),
    ("saude", Saude),
    ("reproducao", Reproducao),
    ("movimentacoes", Movimentacao),
    ("custos_nutricionais", CustoNutricional),
    ("despesas_fixas", DespesaFixa),
    ("historico_ocupacao", HistoricoOcupacao),
]


def serialize(obj):
    out = {}
    for col in inspect(obj).mapper.column_attrs:
        v = getattr(obj, col.key)
        if isinstance(v, (date, datetime)):
            v = v.isoformat()
        elif isinstance(v, Decimal):
            v = float(v)
        elif hasattr(v, "value"):
            v = v.value
        out[col.key] = v
    return out


@router.get("/export")
def export_backup(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "fazenda_nome": current_user.fazenda_nome,
    }
    for name, Model in EXPORT_MODELS:
        rows = db.query(Model).filter(Model.user_id == current_user.id).all()
        data[name] = [serialize(r) for r in rows]
    return data


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        raw = await file.read()
        payload = json.loads(raw)
    except Exception:
        raise HTTPException(400, "Arquivo invalido")

    if not isinstance(payload, dict) or "version" not in payload:
        raise HTTPException(400, "Formato de backup invalido")

    counts = {}
    id_maps: dict[str, dict[int, int]] = {name: {} for name, _ in EXPORT_MODELS}

    fk_map = {
        "lotes": [("pasto_atual_id", "pastos")],
        "animais": [("lote_id", "lotes")],
        "pesagens": [("animal_id", "animais")],
        "saude": [("animal_id", "animais")],
        "reproducao": [("animal_id", "animais")],
        "movimentacoes": [("animal_id", "animais")],
        "custos_nutricionais": [("lote_id", "lotes")],
        "historico_ocupacao": [("pasto_id", "pastos"), ("lote_id", "lotes")],
    }

    for name, Model in EXPORT_MODELS:
        rows = payload.get(name, []) or []
        created = 0
        for row in rows:
            old_id = row.get("id")
            data = {k: v for k, v in row.items() if k not in ("id", "user_id")}
            for fk, target in fk_map.get(name, []):
                if data.get(fk) is not None:
                    data[fk] = id_maps[target].get(data[fk], data[fk])
            data["user_id"] = current_user.id
            sp = db.begin_nested()
            try:
                obj = Model(**data)
                db.add(obj)
                db.flush()
                if old_id is not None:
                    id_maps[name][old_id] = obj.id
                sp.commit()
                created += 1
            except Exception:
                sp.rollback()
                continue
        counts[name] = created
    db.commit()
    return {"status": "ok", "importados": counts}
