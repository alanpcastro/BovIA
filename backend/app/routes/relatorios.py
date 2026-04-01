import csv
import io
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import date
from ..database import get_db
from ..models.animal import Animal, StatusEnum, SexoEnum
from ..models.pesagem import Pesagem
from ..models.saude import Saude
from ..models.movimentacao import Movimentacao
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


@router.get("/animais.csv")
def exportar_animais(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    animais = (
        db.query(Animal)
        .filter(Animal.user_id == current_user.id, Animal.deletado_em == None)
        .order_by(Animal.brinco)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Brinco", "Nome", "Raça", "Sexo", "Status", "Lote ID",
        "Data Nascimento", "Peso Entrada (kg)", "Origem", "Observações", "Cadastrado em"
    ])
    for a in animais:
        writer.writerow([
            a.brinco, a.nome or "", a.raca or "", a.sexo, a.status,
            a.lote_id or "", a.data_nascimento or "", a.peso_entrada or "",
            a.origem or "", a.observacoes or "",
            a.created_at.strftime("%d/%m/%Y") if a.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=animais_{date.today()}.csv"},
    )


@router.get("/pesagens.csv")
def exportar_pesagens(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pesagens = (
        db.query(Pesagem)
        .join(Animal)
        .filter(Animal.user_id == current_user.id)
        .order_by(Animal.brinco, Pesagem.data)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Brinco Animal", "Data", "Peso (kg)", "GMD", "Observações"])
    for p in pesagens:
        writer.writerow([
            p.animal.brinco if p.animal else p.animal_id,
            p.data, p.peso_kg, "", p.observacoes or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=pesagens_{date.today()}.csv"},
    )


@router.get("/financeiro.csv")
def exportar_financeiro(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movs = (
        db.query(Movimentacao)
        .join(Animal)
        .filter(Animal.user_id == current_user.id)
        .order_by(Movimentacao.data.desc())
        .all()
    )

    saudes = (
        db.query(Saude)
        .join(Animal)
        .filter(Animal.user_id == current_user.id, Saude.custo != None)
        .order_by(Saude.data.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Data", "Tipo", "Animal (Brinco)", "Valor (R$)", "Peso (kg)", "Descrição"])

    for m in movs:
        writer.writerow([
            m.data, m.tipo,
            m.animal.brinco if m.animal else m.animal_id,
            m.valor or "", m.peso_kg or "",
            f"{m.origem or ''} → {m.destino or ''}".strip(" →"),
        ])

    for s in saudes:
        writer.writerow([
            s.data, f"saude/{s.tipo}",
            s.animal.brinco if s.animal else s.animal_id,
            s.custo or "", "", s.descricao,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=financeiro_{date.today()}.csv"},
    )


@router.post("/animais/importar")
async def importar_animais(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    contents = await file.read()
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    criados = 0
    erros: list[str] = []

    for i, row in enumerate(reader, start=2):
        brinco = (row.get("Brinco") or row.get("brinco") or "").strip()
        if not brinco:
            erros.append(f"Linha {i}: brinco ausente")
            continue

        existe = db.query(Animal).filter(
            Animal.user_id == current_user.id, Animal.brinco == brinco
        ).first()
        if existe:
            erros.append(f"Linha {i}: brinco '{brinco}' já existe")
            continue

        sexo_raw = (row.get("Sexo") or row.get("sexo") or "macho").strip().lower()
        sexo = SexoEnum.femea if sexo_raw in ("femea", "fêmea", "f") else SexoEnum.macho

        animal = Animal(
            user_id=current_user.id,
            brinco=brinco,
            nome=(row.get("Nome") or row.get("nome") or "").strip() or None,
            raca=(row.get("Raça") or row.get("Raca") or row.get("raca") or "").strip() or None,
            sexo=sexo,
            status=StatusEnum.ativo,
            origem=(row.get("Origem") or row.get("origem") or "").strip() or None,
            observacoes=(row.get("Observações") or row.get("observacoes") or "").strip() or None,
        )

        peso_raw = (row.get("Peso Entrada (kg)") or row.get("peso_entrada") or "").strip()
        if peso_raw:
            try:
                p = float(peso_raw.replace(",", "."))
                if p > 0:
                    animal.peso_entrada = p
            except ValueError:
                pass

        db.add(animal)
        criados += 1

    db.commit()
    return {"importados": criados, "erros": erros}
