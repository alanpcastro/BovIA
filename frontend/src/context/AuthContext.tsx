import { createContext, useContext, useState, ReactNode } from 'react'
import api, { User } from '../services/api'

interface AuthContextData {
  user: User | null
  token: string | null
  login: (email: string, senha: string) => Promise<void>
  register: (nome: string, email: string, senha: string, fazenda_nome: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  async function login(email: string, senha: string) {
    const { data } = await api.post('/auth/login', { email, senha })
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
  }

  async function register(nome: string, email: string, senha: string, fazenda_nome: string) {
    const { data } = await api.post('/auth/register', { nome, email, senha, fazenda_nome })
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
