import { useState, useEffect, useCallback } from 'react'
import { processQueue, pendingCount } from '../services/sync'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [pending, setPending] = useState(0)

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount())
  }, [])

  useEffect(() => {
    const goOnline = async () => {
      setOnline(true)
      // Tentar sincronizar ao voltar online
      const count = await pendingCount()
      if (count > 0) {
        setSyncing(true)
        await processQueue()
        setSyncing(false)
      }
      await refreshPending()
    }

    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    refreshPending()

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refreshPending])

  return { online, syncing, pending, refreshPending }
}
