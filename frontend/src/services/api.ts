import axios from 'axios'

// Em dev, usa '/api' (proxy do Vite -> localhost:8000).
// Em producao, VITE_API_URL aponta pro backend hospedado (ex: https://bovia-api.onrender.com).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
  descricao?: string
  rendimento_carcaca?: number
  ua_ha?: number | null
  data_entrada?: string | null
  pasto_atual_id?: number | null
  pasto_atual_nome?: string | null
  data_entrada_pasto?: string | null
  created_at: string
  total_animais?: number
}

export interface LoteNoPasto {
  id: number
  nome: string
  total_animais: number
  peso_medio_kg?: number | null
  data_entrada_pasto?: string | null
}

export interface Pasto {
  id: number
  nome: string
  area_ha: number
  capacidade_ua_ha?: number | null
  status: 'disponivel' | 'ocupado' | 'descanso'
  descricao?: string | null
  created_at: string
  total_animais: number
  peso_total_kg: number
  unidades_animais: number
  taxa_lotacao_ua_ha: number
  capacidade_total_ua: number
  ocupacao_pct: number
  superlotado: boolean
  dias_ocupacao?: number | null
  dias_descanso?: number | null
  lotes_no_pasto: LoteNoPasto[]
}

export interface HistoricoOcupacao {
  id: number
  pasto_id: number
  lote_id: number
  lote_nome?: string | null
  data_entrada: string
  data_saida?: string | null
  dias?: number | null
  observacoes?: string | null
}

export interface AlertaPasto {
  pasto_id: number
  pasto_nome: string
  tipo: 'superlotacao' | 'sem_rotacao' | 'descanso_excedido'
  mensagem: string
  severidade: 'alta' | 'media' | 'baixa'
}

export type AlertaTipo =
  | 'vacina'
  | 'superlotacao'
  | 'sem_rotacao'
  | 'descanso_excedido'
  | 'abate'
  | 'parto'

export interface Alerta {
  tipo: AlertaTipo
  severidade: 'alta' | 'media' | 'baixa'
  titulo: string
  mensagem: string
  data?: string | null
  dias?: number | null
  entidade_tipo: 'animal' | 'pasto' | 'lote'
  entidade_id: number
  entidade_nome?: string | null
  link: string
}

export type CategoriaAnimal = 'bezerro' | 'garrote' | 'novilha' | 'vaca' | 'boi_magro' | 'boi_gordo'

export interface Animal {
  id: number
  brinco?: string
  nome?: string
  raca?: string
  sexo: 'macho' | 'femea'
  categoria?: CategoriaAnimal | null
  data_nascimento?: string
  peso_entrada?: number
  data_entrada?: string
  peso_atual?: number
  origem?: string
  lote_id?: number
  status: 'ativo' | 'vendido' | 'morto' | 'transferido'
  observacoes?: string
  foto_url?: string | null
  created_at: string
}

export interface ImpactoDelete {
  pesagens: number
  saudes: number
  reproducoes: number
  movimentacoes: number
  receita_perdida: number
  custo_perdido: number
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
  preco_arroba?: number
  agio_compra?: number
  frete?: number
  desconto?: number
  custo_kg?: number | null
  origem?: string
  destino?: string
  observacoes?: string
}

export interface CustoNutricional {
  id: number
  lote_id?: number
  produto: string
  preco_kg: number
  consumo_kg_dia: number
  custo_diario_cab?: number
  data_inicio: string
  data_fim?: string
  observacoes?: string
  created_at: string
}

export interface DespesaFixa {
  id: number
  categoria: string
  descricao: string
  valor_mensal: number
  data_inicio: string
  data_fim?: string
  observacoes?: string
  created_at: string
}

export interface AnaliseFinanceira {
  periodo_inicio: string
  periodo_fim: string
  lote_id?: number
  qtd_cabecas: number
  dias_periodo: number
  peso_medio_inicial?: number
  peso_medio_final?: number
  gpd_medio?: number
  ganho_periodo_arroba?: number
  rendimento_carcaca_pct: number
  peso_carcaca_medio_final?: number
  gmc_medio?: number
  arrobas_entrada_total?: number
  arrobas_saida_total?: number
  arrobas_produzidas_total?: number
  custo_nutricional_total: number
  custo_nutricional_por_cabeca?: number
  custo_operacional_total: number
  custo_operacional_por_cabeca?: number
  custo_saude_total: number
  custo_total_por_cabeca?: number
  custo_por_arroba_produzida?: number
  preco_arroba_compra_medio?: number
  preco_arroba_venda_medio?: number
  ganho_por_arroba?: number
  receita_vendas: number
  custo_compras: number
  lucro_bruto: number
  impostos: number
  lucro_liquido: number
  rentabilidade_pct?: number
  preco_medio_compra_animal?: number
  preco_medio_venda_animal?: number
  lucro_liquido_sem_agil?: number
  lucro_liquido_sem_agil_por_cab?: number
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
