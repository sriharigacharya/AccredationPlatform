import React, { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../api/client'

const AuthContext = createContext(null)

// Role-based default redirect after login
export const ROLE_HOME = {
  admin:   '/dashboard',
  teacher: '/dashboard',
  student: '/my-record',
  worker:  '/documents',
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token  = localStorage.getItem('token')
    const stored = localStorage.getItem('user')
    if (token && stored) {
      try {
        setUser(JSON.parse(stored))
      } catch (_) {
        localStorage.clear()
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password)
    localStorage.setItem('token', data.access_token)
    const u = {
      id:        data.user_id,    // e.g. "U001"
      name:      data.name,
      role:      data.role,       // student | teacher | admin | worker
      linked_id: data.linked_id,  // STU001 / FAC001 / null
      redirect:  data.redirect,   // hint from server
    }
    localStorage.setItem('user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
