import Dexie, { type Table } from 'dexie'

// ── Interfaces locais (espelham a API) ──────────────────────────────────────

export interface LocalLote {
  id?: number
  serverId?: number
  nome: string
  descricao?: string
  rendimento_carcaca?: number
  ua_ha?: number | null
  created_at?: string
  total_animais?: number
}

export interface LocalAnimal {
  id?: number
  serverId?: number
  brinco?: string
  nome?: string
  raca?: string
  sexo: string
  data_nascimento?: string
  peso_entrada?: number
  origem?: string
  lote_id?: number
  status: string
  observacoes?: string
  created_at?: string
}

export interface LocalPesagem {
  id?: number
  serverId?: number
  animal_id: number
  data: string
  peso_kg: number
  observacoes?: string
  gmd?: number
}

export interface LocalSaude {
  id?: number
  serverId?: number
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

export interface LocalReproducao {
  id?: number
  serverId?: number
  animal_id: number
  tipo: string
  data: string
  touro_brinco?: string
  resultado?: string
  data_prevista_parto?: string
  bezerro_brinco?: string
  observacoes?: string
}

export interface LocalMovimentacao {
  id?: number
  serverId?: number
  animal_id: number
  tipo: string
  data: string
  valor?: number
  peso_kg?: number
  preco_arroba?: number
  agio_compra?: number
  origem?: string
  destino?: string
  observacoes?: string
}

export interface LocalCustoNutricional {
  id?: number
  serverId?: number
  lote_id?: number
  produto: string
  preco_kg: number
  consumo_kg_dia: number
  custo_diario_cab?: number
  data_inicio: string
  data_fim?: string
  observacoes?: string
  created_at?: string
}

export interface LocalDespesaFixa {
  id?: number
  serverId?: number
  categoria: string
  descricao: string
  valor_mensal: number
  data_inicio: string
  data_fim?: string
  observacoes?: string
  created_at?: string
}

// ── Fila de sincronizacao ───────────────────────────────────────────────────

export interface SyncQueueItem {
  id?: number
  entity: string        // 'animais' | 'lotes' | 'pesagens' | etc.
  action: 'create' | 'update' | 'delete'
  entityId?: number     // id local
  serverId?: number     // id no servidor (para update/delete)
  payload: string       // JSON do body
  createdAt: number     // timestamp
}

// ── Banco Dexie ─────────────────────────────────────────────────────────────

class BovIADB extends Dexie {
  lotes!: Table<LocalLote>
  animais!: Table<LocalAnimal>
  pesagens!: Table<LocalPesagem>
  saude!: Table<LocalSaude>
  reproducao!: Table<LocalReproducao>
  movimentacoes!: Table<LocalMovimentacao>
  custosNutricionais!: Table<LocalCustoNutricional>
  despesasFixas!: Table<LocalDespesaFixa>
  syncQueue!: Table<SyncQueueItem>

  constructor() {
    super('bovia')
    this.version(1).stores({
      lotes: '++id, serverId, nome',
      animais: '++id, serverId, brinco, lote_id, status, sexo',
      pesagens: '++id, serverId, animal_id, data',
      saude: '++id, serverId, animal_id, data',
      reproducao: '++id, serverId, animal_id, data',
      movimentacoes: '++id, serverId, animal_id, tipo, data',
      custosNutricionais: '++id, serverId, lote_id',
      despesasFixas: '++id, serverId, categoria',
      syncQueue: '++id, entity, action, createdAt',
    })
  }
}

const db = new BovIADB()
export default db
