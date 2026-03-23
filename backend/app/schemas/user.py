from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    fazenda_nome: str


class UserLogin(BaseModel):
    email: EmailStr
    senha: str


class UserOut(BaseModel):
    id: int
    nome: str
    email: str
    fazenda_nome: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
