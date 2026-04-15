import { useState, useEffect, useCallback } from 'react'
import db from '../services/db'
import api from '../services/api'
import type { Table } from 'dexie'

type EntityTable = 'lotes' | 'animais' | 'pesagens' | 'saude' | 'reproducao' | 'movimentacoes' | 'custosNutricionais' | 'despesasFixas'

const tableMap: Record<string, EntityTable> = {
  '/lotes': 'lotes',
  '/animais': 'animais',
  '/pesagens': 'pesagens',
  '/saude': 'saude',
  '/reproducao': 'reproducao',
  '/movimentacoes': 'movimentacoes',
  '/custos-nutricionais': 'custosNutricionais',
  '/despesas-fixas': 'despesasFixas',
}

/**
 * Hook stale-while-revalidate:
 * 1. Retorna dados do cache local imediatamente
 * 2. Busca da API em background
 * 3. Atualiza cache e estado quando a API responde
 * 4. Se offline, usa somente cache
 */
export function useOfflineData<T>(
  endpoint: string,
  params?: Record<string, string | number>,
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  const tableName = tableMap[endpoint]

  const load = useCallback(async () => {
    // 1. Servir cache local primeiro
    if (tableName) {
      try {
        const table = db[tableName] as Table
        const cached = await table.toArray()
        if (cached.length > 0) {
          setData(cached as T[])
          setFromCache(true)
          setLoading(false)
        }
      } catch { /* tabela pode nao existir ainda */ }
    }

    // 2. Buscar da API em background (revalidate)
    if (navigator.onLine) {
      try {
        const res = await api.get(endpoint, { params })
        const items: T[] = Array.isArray(res.data) ? res.data : res.data.items ?? []
        setData(items)
        setFromCache(false)
        setLoading(false)

        // 3. Atualizar cache local
        if (tableName) {
          try {
            const table = db[tableName] as Table
            await table.clear()
            if (items.length > 0) {
              // Mapear id do servidor para serverId
              const mapped = (items as Record<string, unknown>[]).map(item => ({
                ...item,
                serverId: item.id as number,
              }))
              await table.bulkAdd(mapped)
            }
          } catch { /* silencioso */ }
        }
      } catch {
        // API falhou — manter dados do cache
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [endpoint, tableName, JSON.stringify(params)])

  useEffect(() => { load() }, [load])

  return { data, loading, fromCache, reload: load }
}
