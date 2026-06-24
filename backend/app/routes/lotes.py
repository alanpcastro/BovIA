from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from pydantic import BaseModel
from ..database import get_db
from ..models.lote import Lote
from ..models.animal import Animal
from ..models.pesagem import Pesagem
from ..models.saude import Saude
from ..models.movimentacao import Movimentacao
from ..models.custo_nutricional import CustoNutricional
from ..schemas.lote import LoteCreate, LoteUpdate, LoteOut
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_lote_or_404(lote_id: int, db: Session, user: User) -> Lote:
    lote = db.query(Lote).filter(Lote.id == lote_id, Lote.user_id == user.id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    return lote


def _animais_ativos(lote_id: int, db: Session, user_id: int):
    return db.query(Animal).filter(
        Animal.lote_id == lote_id,
        Animal.user_id == user_id,
        Animal.deletado_em == None,
        Animal.status == "ativo",
    ).all()


def _lote_out(lote: Lote, db: Session) -> LoteOut:
    total = db.query(Animal).filter(
        Animal.lote_id == lote.id,
        Animal.status == "ativo",
        Animal.deletado_em == None,  # noqa: E711
    ).count()
    out = LoteOut.model_validate(lote)
    out.total_animais = total
    out.pasto_atual_nome = lote.pasto_atual.nome if lote.pasto_atual else None
    return out


# ── Schemas para operações em lote ──────────────────────────────────────────

class LoteAnimaisCreate(BaseModel):
    quantidade: int
    raca: Optional[str] = None
    sexo: str = "macho"
    peso_medio: Optional[float] = None
    origem: Optional[str] = None
    observacoes: Optional[str] = None


class LotePesagemCreate(BaseModel):
    data: date
    peso_medio_kg: float
    observacoes: Optional[str] = None


class LoteSaudeCreate(BaseModel):
    tipo: str
    data: date
    descricao: str
    medicamento: Optional[str] = None
    dose: Optional[str] = None
    custo_total: Optional[float] = None
    responsavel: Optional[str] = None
    proxima_data: Optional[date] = None
    observacoes: Optional[str] = None


class LoteMovimentacaoCreate(BaseModel):
    tipo: str
    data: date
    valor_total: Optional[float] = None
    peso_medio_kg: Optional[float] = None
    origem: Optional[str] = None
    destino: Optional[str] = None
    observacoes: Optional[str] = None


# ── CRUD de Lotes ────────────────────────────────────────────────────────────

@router.get("", response_model=List[LoteOut])
def listar_lotes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lotes = db.query(Lote).filter(Lote.user_id == current_user.id).all()
    return [_lote_out(lote, db) for lote in lotes]


@router.post("", response_model=LoteOut, status_code=201)
def criar_lote(data: LoteCreate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    lote = Lote(**data.model_dump(), user_id=current_user.id)
    db.add(lote)
    db.commit()
    db.refresh(lote)
    return _lote_out(lote, db)


@router.get("/{lote_id}", response_model=LoteOut)
def get_lote(lote_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lote = _get_lote_or_404(lote_id, db, current_user)
    return _lote_out(lote, db)


@router.put("/{lote_id}", response_model=LoteOut)
def atualizar_lote(lote_id: int, data: LoteUpdate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    lote = _get_lote_or_404(lote_id, db, current_user)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lote, field, value)
    db.commit()
    db.refresh(lote)
    return _lote_out(lote, db)


@router.delete("/{lote_id}", status_code=204)
def deletar_lote(lote_id: int, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    lote = _get_lote_or_404(lote_id, db, current_user)
    # Desvincular animais (eles ficam sem lote, mas continuam cadastrados)
    db.query(Animal).filter(Animal.lote_id == lote.id).update({Animal.lote_id: None})
    # Desvincular custos nutricionais (FK nullable, preserva o historico)
    db.query(CustoNutricional).filter(CustoNutricional.lote_id == lote.id).update({CustoNutricional.lote_id: None})
    # Remover historico_ocupacao (lote_id e NOT NULL na tabela, nao da pra preservar)
    from ..models.pasto import HistoricoOcupacao
    db.query(HistoricoOcupacao).filter(HistoricoOcupacao.lote_id == lote.id).delete()
    db.delete(lote)
    db.commit()


# ── Operações em lote ────────────────────────────────────────────────────────

@router.post("/{lote_id}/animais", status_code=201)
def criar_animais_em_lote(
    lote_id: int,
    data: LoteAnimaisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """Cria N animais de uma vez dentro de um lote."""
    lote = _get_lote_or_404(lote_id, db, current_user)
    if data.quantidade < 1 or data.quantidade > 5000:
        raise HTTPException(status_code=400, detail="Quantidade deve ser entre 1 e 5000")

    criados = []
    for _ in range(data.quantidade):
        animal = Animal(
            user_id=current_user.id,
            lote_id=lote.id,
            sexo=data.sexo,
            raca=data.raca,
            peso_entrada=data.peso_medio,
            origem=data.origem,
            observacoes=data.observacoes,
        )
        db.add(animal)
        criados.append(animal)

    db.commit()
    return {"criados": len(criados), "lote": lote.nome}


@router.post("/{lote_id}/pesagens", status_code=201)
def pesagem_em_lote(
    lote_id: int,
    data: LotePesagemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """Registra pesagem (peso médio) para todos os animais ativos do lote."""
    _get_lote_or_404(lote_id, db, current_user)
    animais = _animais_ativos(lote_id, db, current_user.id)
    if not animais:
        raise HTTPException(status_code=400, detail="Nenhum animal ativo neste lote")

    for animal in animais:
        p = Pesagem(
            animal_id=animal.id, user_id=current_user.id,
            data=data.data, peso_kg=data.peso_medio_kg,
            observacoes=data.observacoes,
        )
        db.add(p)

    db.commit()
    return {"registrados": len(animais)}


@router.post("/{lote_id}/saude", status_code=201)
def saude_em_lote(
    lote_id: int,
    data: LoteSaudeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """Registra evento de saúde para todos os animais ativos do lote."""
    _get_lote_or_404(lote_id, db, current_user)
    animais = _animais_ativos(lote_id, db, current_user.id)
    if not animais:
        raise HTTPException(status_code=400, detail="Nenhum animal ativo neste lote")

    custo_por_animal = None
    if data.custo_total is not None and len(animais) > 0:
        custo_por_animal = round(data.custo_total / len(animais), 2)

    for animal in animais:
        s = Saude(
            animal_id=animal.id, user_id=current_user.id,
            tipo=data.tipo, data=data.data, descricao=data.descricao,
            medicamento=data.medicamento, dose=data.dose,
            custo=custo_por_animal, responsavel=data.responsavel,
            proxima_data=data.proxima_data, observacoes=data.observacoes,
        )
        db.add(s)

    db.commit()
    return {"registrados": len(animais)}


@router.post("/{lote_id}/movimentacoes", status_code=201)
def movimentacao_em_lote(
    lote_id: int,
    data: LoteMovimentacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """Registra movimentação para todos os animais ativos do lote."""
    _get_lote_or_404(lote_id, db, current_user)
    animais = _animais_ativos(lote_id, db, current_user.id)
    if not animais:
        raise HTTPException(status_code=400, detail="Nenhum animal ativo neste lote")

    valor_por_animal = None
    if data.valor_total is not None and len(animais) > 0:
        valor_por_animal = round(data.valor_total / len(animais), 2)

    for animal in animais:
        m = Movimentacao(
            animal_id=animal.id, user_id=current_user.id,
            tipo=data.tipo, data=data.data,
            valor=valor_por_animal, peso_kg=data.peso_medio_kg,
            origem=data.origem, destino=data.destino,
            observacoes=data.observacoes,
        )
        db.add(m)

        # Sincronizar status do animal com a movimentação em lote
        if data.tipo == "venda":
            animal.status = "vendido"
            animal.lote_id = None
        elif data.tipo == "morte":
            animal.status = "morto"
            animal.lote_id = None

    db.commit()
    return {"registrados": len(animais)}
