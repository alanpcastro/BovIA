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
from ..models.movimentacao import Movimentacao, TipoMovEnum
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
    # Numeracao automatica de brincos (opcional): se preenchido, gera prefixo+numero sequencial
    brinco_prefixo: Optional[str] = None  # ex: "L1-" gera "L1-001", "L1-002" ...
    brinco_inicio: int = 1  # numero inicial da sequencia


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
    tipo: TipoMovEnum
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
    pasto_id_atual = lote.pasto_atual_id

    # Desvincular animais (eles ficam sem lote, mas continuam cadastrados)
    db.query(Animal).filter(Animal.lote_id == lote.id).update({Animal.lote_id: None})
    # Deletar custos nutricionais vinculados: se desvincularmos (lote_id=NULL),
    # passam a ser interpretados como "rebanho inteiro" e inflam analises retroativas
    db.query(CustoNutricional).filter(CustoNutricional.lote_id == lote.id).delete()
    # Remover historico_ocupacao (lote_id e NOT NULL na tabela, nao da pra preservar)
    from ..models.pasto import HistoricoOcupacao, Pasto, StatusPastoEnum
    db.query(HistoricoOcupacao).filter(HistoricoOcupacao.lote_id == lote.id).delete()
    db.delete(lote)
    db.flush()

    # Se o lote estava ocupando um pasto e nao sobrou nenhum outro lote nele,
    # marca o pasto como em descanso (evita pasto "ocupado" sem ocupantes)
    if pasto_id_atual is not None:
        ainda_ocupado = db.query(Lote).filter(Lote.pasto_atual_id == pasto_id_atual).first()
        if not ainda_ocupado:
            pasto = db.query(Pasto).filter(
                Pasto.id == pasto_id_atual, Pasto.user_id == current_user.id
            ).first()
            if pasto and pasto.status == StatusPastoEnum.ocupado:
                pasto.status = StatusPastoEnum.descanso

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
    if data.brinco_inicio < 1:
        raise HTTPException(status_code=400, detail="Numero inicial do brinco deve ser >= 1")

    # Gera brincos se prefixo foi informado (padding dinamico: minimo 3 digitos)
    brincos = []
    prefixo = (data.brinco_prefixo or "").strip()
    if prefixo:
        ultimo_num = data.brinco_inicio + data.quantidade - 1
        padding = max(3, len(str(ultimo_num)))
        brincos = [f"{prefixo}{str(data.brinco_inicio + i).zfill(padding)}" for i in range(data.quantidade)]

        # Valida duplicidade antes de comecar a inserir
        ja_existentes = db.query(Animal.brinco).filter(
            Animal.user_id == current_user.id,
            Animal.brinco.in_(brincos),
        ).all()
        if ja_existentes:
            conflitos = ", ".join(b[0] for b in ja_existentes[:5])
            extra = f" (+{len(ja_existentes) - 5} outros)" if len(ja_existentes) > 5 else ""
            raise HTTPException(
                status_code=400,
                detail=f"Brincos ja cadastrados: {conflitos}{extra}. Ajuste prefixo ou numero inicial.",
            )

    criados = []
    for i in range(data.quantidade):
        animal = Animal(
            user_id=current_user.id,
            lote_id=lote.id,
            brinco=brincos[i] if brincos else None,
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
        if data.tipo == TipoMovEnum.venda:
            animal.status = "vendido"
            animal.lote_id = None
        elif data.tipo == TipoMovEnum.morte:
            animal.status = "morto"
            animal.lote_id = None

    db.commit()
    return {"registrados": len(animais)}
