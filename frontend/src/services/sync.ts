import db, { SyncQueueItem } from './db'
import api from './api'

// ── Adicionar item na fila de sync ──────────────────────────────────────────

export async function enqueueSync(
  entity: string,
  action: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>,
  serverId?: number,
  entityId?: number,
) {
  await db.syncQueue.add({
    entity,
    action,
    payload: JSON.stringify(payload),
    serverId,
    entityId,
    createdAt: Date.now(),
  })
}

// ── Processar a fila (chamado quando volta online) ──────────────────────────

export async function processQueue(): Promise<{ ok: number; failed: number }> {
  const items = await db.syncQueue.orderBy('createdAt').toArray()
  let ok = 0
  let failed = 0

  for (const item of items) {
    try {
      await syncItem(item)
      await db.syncQueue.delete(item.id!)
      ok++
    } catch {
      failed++
    }
  }

  return { ok, failed }
}

async function syncItem(item: SyncQueueItem) {
  const payload = JSON.parse(item.payload)
  const base = `/${item.entity}`

  switch (item.action) {
    case 'create':
      await api.post(base, payload)
      break
    case 'update':
      if (!item.serverId) throw new Error('serverId required for update')
      await api.put(`${base}/${item.serverId}`, payload)
      break
    case 'delete':
      if (!item.serverId) throw new Error('serverId required for delete')
      await api.delete(`${base}/${item.serverId}`)
      break
  }
}

// ── Quantidade pendente na fila ─────────────────────────────────────────────

export async function pendingCount(): Promise<number> {
  return db.syncQueue.count()
}
