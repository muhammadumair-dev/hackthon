import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios.js'
import AuthContext from './auth-context.js'

const TOKEN_KEY = 'hcm-lite-token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [setupComplete, setSetupComplete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchSession = useCallback(async () => {
    const { data } = await api.get('/api/setup/status')

    if (!data.setupComplete) {
      localStorage.removeItem(TOKEN_KEY)
      return { setupComplete: false, user: null }
    }

    if (!localStorage.getItem(TOKEN_KEY)) {
      return { setupComplete: true, user: null }
    }

    try {
      const response = await api.get('/api/auth/me')
      return { setupComplete: true, user: response.data.user }
    } catch (sessionError) {
      if (sessionError.response?.status !== 401) {
        throw sessionError
      }

      localStorage.removeItem(TOKEN_KEY)
      return { setupComplete: true, user: null }
    }
  }, [])

  const initialize = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const session = await fetchSession()
      setSetupComplete(session.setupComplete)
      setUser(session.user)
    } catch {
      setError('Could not check the server or restore your session. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [fetchSession])

  useEffect(() => {
    let active = true

    fetchSession()
      .then((session) => {
        if (active) {
          setSetupComplete(session.setupComplete)
          setUser(session.user)
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not check the server or restore your session. Please retry.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [fetchSession])

  const completeSetup = useCallback(async (setupData) => {
    await api.post('/api/setup', setupData)
    setSetupComplete(true)
  }, [])

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/api/auth/login', credentials)
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data.user
  }, [])

  const changePassword = useCallback(async (passwordData) => {
    const { data } = await api.post('/api/auth/change-password', passwordData)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      setupComplete,
      loading,
      error,
      retry: initialize,
      completeSetup,
      login,
      changePassword,
      logout,
    }),
    [
      user,
      setupComplete,
      loading,
      error,
      initialize,
      completeSetup,
      login,
      changePassword,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
