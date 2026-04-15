from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pathlib import Path
import uuid
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
from datetime import date, datetime, timezone
from pydantic import BaseModel

router = APIRouter()


class AnimaisPage(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[AnimalOut]

    class Config:
        from_attributes = True


@router.get("", response_model=AnimaisPage)
def listar_animais(
    lote_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    sexo: Optional[str] = Query(None),
    raca: Optional[str] = Query(None),
    busca: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Animal).filter(Animal.user_id == current_user.id, Animal.deletado_em == None)
    if lote_id is not None:
        q = q.filter(Animal.lote_id == lote_id)
    if status:
        q = q.filter(Animal.status == status)
    if sexo:
        q = q.filter(Animal.sexo == sexo)
    if raca:
        q = q.filter(Animal.raca.ilike(f"%{raca}%"))
    if busca:
        q = q.filter(
            Animal.brinco.ilike(f"%{busca}%") | Animal.nome.ilike(f"%{busca}%")
        )
    total = q.count()
    items = q.order_by(Animal.brinco).offset((page - 1) * page_size).limit(page_size).all()
    return AnimaisPage(total=total, page=page, page_size=page_size, items=items)


@router.post("", response_model=AnimalOut, status_code=201)
def criar_animal(data: AnimalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.brinco:
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
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id, Animal.deletado_em == None).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")
    return animal


@router.put("/{animal_id}", response_model=AnimalOut)
def atualizar_animal(animal_id: int, data: AnimalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id, Animal.deletado_em == None).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    updates = data.model_dump(exclude_unset=True)
    novo_status = updates.get("status")

    novo_brinco = updates.get("brinco")
    if novo_brinco and novo_brinco != animal.brinco:
        existe = db.query(Animal).filter(
            Animal.user_id == current_user.id,
            Animal.brinco == novo_brinco,
            Animal.id != animal_id,
        ).first()
        if existe:
            raise HTTPException(status_code=400, detail=f"Brinco '{novo_brinco}' já cadastrado")

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


UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "animais"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024


@router.post("/{animal_id}/foto", response_model=AnimalOut)
async def upload_foto(
    animal_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id, Animal.deletado_em == None).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido (use JPG, PNG ou WEBP)")
    raw = await file.read()
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máx 5MB)")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    fname = f"{current_user.id}_{animal_id}_{uuid.uuid4().hex[:8]}.{ext}"
    (UPLOAD_DIR / fname).write_bytes(raw)
    if animal.foto_url:
        old = UPLOAD_DIR / Path(animal.foto_url).name
        if old.exists():
            try: old.unlink()
            except Exception: pass
    animal.foto_url = f"/uploads/animais/{fname}"
    db.commit()
    db.refresh(animal)
    return animal


@router.delete("/{animal_id}/foto", response_model=AnimalOut)
def deletar_foto(animal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id, Animal.deletado_em == None).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")
    if animal.foto_url:
        old = UPLOAD_DIR / Path(animal.foto_url).name
        if old.exists():
            try: old.unlink()
            except Exception: pass
        animal.foto_url = None
        db.commit()
        db.refresh(animal)
    return animal


@router.delete("/{animal_id}", status_code=204)
def deletar_animal(animal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == current_user.id, Animal.deletado_em == None).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")
    animal.deletado_em = datetime.now(timezone.utc)
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
