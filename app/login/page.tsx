'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o password errati.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const C = {
    bg: '#0f0f0f', card: '#1a1a1a', border: '#2a2a2a',
    accent: '#3b82f6', text: '#e5e5e5', muted: '#666', red: '#ef4444',
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif", padding: 16,
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '40px 32px', width: '100%', maxWidth: 380,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔧</div>
          <h1 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: 0 }}>
            Inventario Idraulica
          </h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
            Accedi per gestire il negozio
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: C.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              EMAIL
            </label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="tu@email.com"
              style={{
                width: '100%', padding: '10px 12px', background: '#111',
                border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ color: C.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              PASSWORD
            </label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 12px', background: '#111',
                border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#2a1010', border: `1px solid ${C.red}44`,
              borderRadius: 8, padding: '10px 12px', color: C.red, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              width: '100%', padding: '12px',
              background: loading ? '#1a3a6a' : C.accent,
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              marginTop: 4, opacity: (!email || !password) ? 0.5 : 1,
            }}
          >
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </div>
      </div>
    </div>
  )
}
