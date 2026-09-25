from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models.pesagem import Pesagem
from ..models.animal import Animal
from ..schemas.pesagem import (
    PesagemCreate, PesagemOut,
    PesagemLoteCreate, PesagemLoteResult,
)
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User
from ..zootecnia import calcular_gmd

router = APIRouter()


class BulkDeleteIn(BaseModel):
    pesagem_ids: List[int]


class BulkResult(BaseModel):
    total: int
    afetados: int


@router.get("", response_model=List[PesagemOut])
def listar_pesagens(
    animal_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Pesagem).join(Animal).filter(
        Animal.user_id == current_user.id,
        Animal.deletado_em.is_(None),
    )
    if animal_id:
        q = q.filter(Pesagem.animal_id == animal_id)

    pesagens = q.order_by(Pesagem.data.desc()).all()

    # Adiciona GMD calculado na saida
    result = []
    for p in pesagens:
        out = PesagemOut.model_validate(p)
        out.gmd = calcular_gmd(db, p.animal_id, p, current_user.id)
        result.append(out)
    return result


@router.post("", response_model=PesagemOut, status_code=201)
def criar_pesagem(data: PesagemCreate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    animal = db.query(Animal).filter(Animal.id == data.animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    pesagem = Pesagem(**data.model_dump(), user_id=current_user.id)
    db.add(pesagem)
    db.commit()
    db.refresh(pesagem)

    out = PesagemOut.model_validate(pesagem)
    out.gmd = calcular_gmd(db, pesagem.animal_id, pesagem, current_user.id)
    return out


@router.post("/lote", response_model=PesagemLoteResult, status_code=201)
def criar_pesagens_lote(
    data: PesagemLoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """Modo Curral: grava numa transação as pesagens individuais de uma sessão.

    No curral o sinal cai, e o app reenvia. Por isso a gravação é idempotente por
    (animal, data): reenviar a mesma sessão ATUALIZA o peso em vez de duplicar o
    registro. Isso também cobre o caso legítimo de recorrigir um animal no mesmo dia.
    """
    ids = [i.animal_id for i in data.itens]

    # Só grava em animais do próprio usuário — o resto é ignorado e reportado.
    meus = {
        a.id: a for a in db.query(Animal).filter(
            Animal.id.in_(ids),
            Animal.user_id == current_user.id,
            Animal.deletado_em.is_(None),
        ).all()
    }

    # Pesagens já existentes desses animais nessa data (o caso do reenvio)
    existentes = {
        p.animal_id: p for p in db.query(Pesagem).filter(
            Pesagem.animal_id.in_(list(meus.keys()) or [0]),
            Pesagem.data == data.data,
            Pesagem.user_id == current_user.id,
        ).all()
    } if meus else {}

    criados = 0
    atualizados = 0
    gravadas: List[Pesagem] = []

    for item in data.itens:
        if item.animal_id not in meus:
            continue
        anterior = existentes.get(item.animal_id)
        if anterior:
            anterior.peso_kg = item.peso_kg
            if data.observacoes:
                anterior.observacoes = data.observacoes
            gravadas.append(anterior)
            atualizados += 1
        else:
            nova = Pesagem(
                user_id=current_user.id,
                animal_id=item.animal_id,
                data=data.data,
                peso_kg=item.peso_kg,
                observacoes=data.observacoes,
            )
            db.add(nova)
            gravadas.append(nova)
            criados += 1

    db.commit()

    # Resumo da sessão — é o que fecha o trabalho no curral com um número
    peso_medio = None
    gmd_medio = None
    if gravadas:
        for p in gravadas:
            db.refresh(p)
        peso_medio = round(sum(p.peso_kg for p in gravadas) / len(gravadas), 1)
        gmds = [g for g in (calcular_gmd(db, p.animal_id, p, current_user.id) for p in gravadas) if g is not None]
        if gmds:
            gmd_medio = round(sum(gmds) / len(gmds), 3)

    return PesagemLoteResult(
        recebidos=len(data.itens),
        criados=criados,
        atualizados=atualizados,
        ignorados=len(data.itens) - criados - atualizados,
        peso_medio=peso_medio,
        gmd_medio=gmd_medio,
    )


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete_pesagens(
    data: BulkDeleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    if not data.pesagem_ids:
        raise HTTPException(status_code=400, detail="Nenhuma pesagem selecionada")

    # Deleta apenas as pesagens explicitamente selecionadas (validando ownership via animal)
    pesagens = db.query(Pesagem).join(Animal).filter(
        Pesagem.id.in_(data.pesagem_ids),
        Animal.user_id == current_user.id,
    ).all()

    for p in pesagens:
        db.delete(p)

    db.commit()
    return BulkResult(total=len(data.pesagem_ids), afetados=len(pesagens))


@router.delete("/{pesagem_id}", status_code=204)
def deletar_pesagem(pesagem_id: int, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    pesagem = db.query(Pesagem).join(Animal).filter(
        Pesagem.id == pesagem_id, Animal.user_id == current_user.id
    ).first()
    if not pesagem:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada")
    db.delete(pesagem)
    db.commit()
