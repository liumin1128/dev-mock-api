import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchRecords,
  fetchMocks,
  type ProxyRecord,
  type MocksMap,
} from '@/lib/api'

/** 请求记录轮询 Hook */
export function useRecords(interval = 2000) {
  const [records, setRecords] = useState<ProxyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchRecords()
      if (mountedRef.current) setRecords(data)
    } catch {
      // ignore network errors during polling
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    const timer = setInterval(load, interval)
    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [load, interval])

  return { records, loading, refresh: load }
}

/** Mock 规则轮询 Hook */
export function useMocks(interval = 2000) {
  const [mocks, setMocks] = useState<MocksMap>({})
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchMocks()
      if (mountedRef.current) setMocks(data)
    } catch {
      // ignore
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    const timer = setInterval(load, interval)
    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [load, interval])

  return { mocks, loading, refresh: load }
}
