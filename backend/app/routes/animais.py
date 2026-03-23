from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.animal import Animal, StatusEnum
from ..models.pesagem import Pesagem
from ..models.saude import Saude
from ..models.reproducao import Reproducao
from ..models.movimentacao import Movimentacao, TipoMovEnum
from ..schemas.animal import AnimalCreate, AnimalUpdate, AnimalOut
from ..schemas.pesagem import PesagemOut
from ..schemas.saude import SaudeOut
from ..schemas.reproducao import ReproducaoOut
from ..schemas.movimentacao import MovimentacaoCreate, MovimentacaoOut
from ..auth import get_current_user
from ..models.user import User
from datetime import date

router = APIRouter()


@router.get("", response_model=List[AnimalOut])
def listar_animais(
    lote_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    sexo: Optional[str] = Query(None),
    raca: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Animal).filter(Animal.user_id == current_user.id)
    if lote_id is not None:
        q = q.filter(Animal.lote_id == lote_id)
    if status:
        q = q.filter(Animal.status == status)
    if sexo:
        q = q.filter(Animal.sexo == sexo)
    if raca:
        q = q.filter(Animal.raca.ilike(f"%{raca}%"))
    return q.order_by(Animal.brinco).all()


@router.post("", response_model=AnimalOut, status_code=201)
def criar_animal(data: AnimalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existe = db.query(Animal).filter(Animal.user_id == current_user.id, Animal.brinco == data.brinco).first()
    if existe:
        raise HTTPException(status_code=400, detail=f"Brinco '{data.brinco}' já cadastrado")

    animal = Animal(**data.model_dump(), user_id=current_user.id)
    db.add(animal)
    db.commit()

    # Registrar movimentação de entrada
    if data.origem == "comprado":
        mov = Movimentacao(
            user_id=current_user.id,
            animal_id=animal.id,
            tipo=TipoMovEnum.compra,
            data=date.today(),
            peso_kg=data.peso_entrada,
        )
        db.add(mov)
    elif data.origem == "nascido":
        mov = Movimentacao(
            user_id=current_user.id,
            animal_id=animal.id,
            tipo=TipoMovEnum.nascimento,
            data=date.today(),
            peso_kg=data.peso_entrada,
        )
        db.add(mov)

    db.commit()
    db.refresh(animal)
    return animal


@router.get("/{animal_id}", response_model=AnimalOut)
def get_animal(animal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")
    return animal


@router.put("/{animal_id}", response_model=AnimalOut)
def atualizar_animal(animal_id: int, data: AnimalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    updates = data.model_dump(exclude_unset=True)
    novo_status = updates.get("status")

    for field, value in updates.items():
        setattr(animal, field, value)

    db.commit()

    # Registrar movimentação automática ao mudar status
    if novo_status == "vendido":
        mov = Movimentacao(
            user_id=current_user.id,
            animal_id=animal.id,
            tipo=TipoMovEnum.venda,
            data=date.today(),
        )
        db.add(mov)
        db.commit()
    elif novo_status == "morto":
        mov = Movimentacao(
            user_id=current_user.id,
            animal_id=animal.id,
            tipo=TipoMovEnum.morte,
            data=date.today(),
        )
        db.add(mov)
        db.commit()

    db.refresh(animal)
    return animal


@router.delete("/{animal_id}", status_code=204)
def deletar_animal(animal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")
    db.delete(animal)
    db.commit()


@router.get("/{animal_id}/historico")
def historico_animal(animal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    pesagens = db.query(Pesagem).filter(Pesagem.animal_id == animal_id).order_by(Pesagem.data).all()
    saudes = db.query(Saude).filter(Saude.animal_id == animal_id).order_by(Saude.data.desc()).all()
    reproducoes = db.query(Reproducao).filter(Reproducao.animal_id == animal_id).order_by(Reproducao.data.desc()).all()
    movimentacoes = db.query(Movimentacao).filter(Movimentacao.animal_id == animal_id).order_by(Movimentacao.data.desc()).all()

    return {
        "animal": AnimalOut.model_validate(animal),
        "pesagens": [PesagemOut.model_validate(p) for p in pesagens],
        "saudes": [SaudeOut.model_validate(s) for s in saudes],
        "reproducoes": [ReproducaoOut.model_validate(r) for r in reproducoes],
        "movimentacoes": [MovimentacaoOut.model_validate(m) for m in movimentacoes],
    }
