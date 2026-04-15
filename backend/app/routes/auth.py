from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserLogin, UserOut, Token
from ..auth import hash_senha, verificar_senha, criar_token, get_current_user
from ..config import settings
from ..email_service import enviar_reset_senha

router = APIRouter()


class ResetSolicitacao(BaseModel):
    email: EmailStr


class ResetSenha(BaseModel):
    token: str
    nova_senha: str


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    user = User(
        nome=data.nome,
        email=data.email,
        senha_hash=hash_senha(data.senha),
        fazenda_nome=data.fazenda_nome,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = criar_token({"sub": str(user.id)}, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verificar_senha(data.senha, user.senha_hash):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")

    token = criar_token({"sub": str(user.id)}, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/solicitar-reset")
async def solicitar_reset(data: ResetSolicitacao, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    # Sempre retorna sucesso para não revelar se o email existe
    if user:
        token = criar_token({"sub": str(user.id), "tipo": "reset"}, timedelta(minutes=30))
        link = f"{settings.FRONTEND_URL}/reset-senha?token={token}"
        background_tasks.add_task(enviar_reset_senha, user.email, user.nome, link)
    return {"message": "Se o email estiver cadastrado, voce recebera um link de recuperacao."}


@router.post("/reset-senha")
def reset_senha(data: ResetSenha, db: Session = Depends(get_db)):
    from jose import JWTError, jwt as jose_jwt
    try:
        payload = jose_jwt.decode(data.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("tipo") != "reset":
            raise HTTPException(status_code=400, detail="Token invalido")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Token invalido")
    except JWTError:
        raise HTTPException(status_code=400, detail="Token invalido ou expirado")

    if len(data.nova_senha) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter no minimo 6 caracteres")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Usuario nao encontrado")

    user.senha_hash = hash_senha(data.nova_senha)
    db.commit()
    return {"message": "Senha redefinida com sucesso!"}
