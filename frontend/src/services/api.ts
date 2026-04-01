import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  nome: string
  email: string
  fazenda_nome: string
}

export interface Lote {
  id: number
  nome: string
  area_hectares?: number
  descricao?: string
  created_at: string
  total_animais?: number
}

export interface Animal {
  id: number
  brinco?: string
  nome?: string
  raca?: string
  sexo: 'macho' | 'femea'
  data_nascimento?: string
  peso_entrada?: number
  origem?: string
  lote_id?: number
  status: 'ativo' | 'vendido' | 'morto' | 'transferido'
  observacoes?: string
  created_at: string
}

export interface Pesagem {
  id: number
  animal_id: number
  data: string
  peso_kg: number
  observacoes?: string
  gmd?: number
}

export interface Saude {
  id: number
  animal_id: number
  tipo: string
  data: string
  descricao: string
  medicamento?: string
  dose?: string
  custo?: number
  responsavel?: string
  proxima_data?: string
  observacoes?: string
}

export interface Reproducao {
  id: number
  animal_id: number
  tipo: string
  data: string
  touro_brinco?: string
  resultado?: string
  data_prevista_parto?: string
  bezerro_brinco?: string
  observacoes?: string
}

export interface Movimentacao {
  id: number
  animal_id: number
  tipo: string
  data: string
  valor?: number
  peso_kg?: number
  origem?: string
  destino?: string
  observacoes?: string
}

export interface Dashboard {
  total_animais: number
  total_machos: number
  total_femeas: number
  peso_medio_kg?: number
  proximas_vacinas: Array<{
    id: number
    animal_id: number
    descricao: string
    tipo: string
    proxima_data: string
  }>
  partos_previstos: Array<{
    id: number
    animal_id: number
    data_prevista_parto: string
    touro_brinco?: string
  }>
}
