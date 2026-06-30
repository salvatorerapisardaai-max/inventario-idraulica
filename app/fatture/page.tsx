'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { emettiFatturaDaVendita } from './azioni'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Fattura = {
  id: string
  numero: string
  data: string
  cliente_nome: string
  totale: number
  stato: string
  vendita_id?: string
}

export default function FattureListPage() {
  const [fatture, setFatture] = useState<Fattura[]>([])
  const [loading, setLoading] = useState(true)
  const [emettendo, setEmettendo] = useState<string | null>(null)

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('fatture')
      .select('id, numero, data, stato, totale')
      .order('data', { ascending: false })
    
    if (data) {
      setFatture(data as Fattura[])
    }
    setLoading(false)
  }

  useEffect(() => {
    carica()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
        <p style={{ color: '#888' }}>Caricamento fatture…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: 30, fontSize: 24 }}>📄 Fatture</h1>
        
        {fatture.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>
            Nessuna fattura ancora emessa.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {fatture.map(f => (
              <div
                key={f.id}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>
                    Fattura #{f.numero}
                  </div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                    {new Date(f.data).toLocaleDateString('it-IT')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#0f0', fontWeight: 700 }}>
                    € {Number(f.totale).toFixed(2)}
                  </div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                    {f.stato}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
