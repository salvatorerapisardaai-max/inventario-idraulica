'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Markup = {
  categoria: string
  markup_percentuale: number
  updated_at: string
}

type StatCategoria = {
  categoria: string
  totale: number
  auto: number
}

export default function MarkupPage() {
  const [markup, setMarkup] = useState<Markup[]>([])
  const [stats, setStats] = useState<Record<string, StatCategoria>>({})
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [m, s] = await Promise.all([
      supabase.from('markup_categorie').select('*').order('categoria'),
      supabase.from('articoli').select('categoria, usa_markup_auto'),
    ])
    if (m.data) setMarkup(m.data as Markup[])

    const aggr: Record<string, StatCategoria> = {}
    if (s.data) {
      for (const row of s.data as { categoria: string | null; usa_markup_auto: boolean }[]) {
        const c = row.categoria || 'Altro'
        if (!aggr[c]) aggr[c] = { categoria: c, totale: 0, auto: 0 }
        aggr[c].totale++
        if (row.usa_markup_auto) aggr[c].auto++
      }
    }
    setStats(aggr)
    setLoading(false)
  }

  async function save(categoria: string) {
    const raw = editing[categoria]
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0 || val > 1000) {
      alert('Valore non valido. Inserisci un numero tra 0 e 1000.')
      return
    }
    setSaving(categoria)
    const { error } = await supabase
      .from('markup_categorie')
      .update({ markup_percentuale: val, updated_at: new Date().toISOString() })
      .eq('categoria', categoria)
    setSaving(null)
    if (error) {
      alert('Errore nel salvataggio: ' + error.message)
      return
    }
    setMarkup(prev => prev.map(m => m.categoria === categoria ? { ...m, markup_percentuale: val } : m))
    setEditing(prev => { const c = { ...prev }; delete c[categoria]; return c })
    setSavedFlash(categoria)
    setTimeout(() => setSavedFlash(null), 1500)
  }

  function pct(c: string) {
    return editing[c] !== undefined
      ? editing[c]
      : markup.find(m => m.categoria === c)?.markup_percentuale.toString() ?? ''
  }

  function isDirty(c: string) {
    if (editing[c] === undefined) return false
    const current = markup.find(m => m.categoria === c)?.markup_percentuale
    return parseFloat(editing[c]) !== current
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
      <p style={{ color: '#888' }}>Caricamento…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', padding: '0 0 40px', fontFamily: '-apple-system, sans-serif', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 28 }}>📈</div>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Markup per Categoria</h1>
        </div>
        <p style={{ color: '#888', fontSize: 13, margin: '8px 0 0', lineHeight: 1.5 }}>
          Il <strong style={{ color: '#ccc' }}>prezzo di vendita</strong> viene ricalcolato automaticamente quando aggiorni il prezzo di acquisto, applicando la percentuale di ricarico della categoria.
        </p>
        <p style={{ color: '#666', fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>
          Esempio: con markup 80%, un articolo acquistato a € 5,00 viene venduto a € 9,00.
        </p>
      </div>

      <div style={{ padding: '16px' }}>
        {markup.map(m => {
          const stat = stats[m.categoria] || { totale: 0, auto: 0 }
          const dirty = isDirty(m.categoria)
          const flashing = savedFlash === m.categoria
          return (
            <div key={m.categoria} style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: '16px 18px',
              marginBottom: 10,
              border: '1px solid',
              borderColor: flashing ? '#22c55e' : dirty ? '#f59e0b' : '#2a2a2a',
              transition: 'border-color 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{m.categoria}</div>
                  <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                    {stat.auto}/{stat.totale} articoli in modalità automatica
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={1000}
                    step="0.5"
                    value={pct(m.categoria)}
                    onChange={e => setEditing(prev => ({ ...prev, [m.categoria]: e.target.value }))}
                    style={{
                      width: 78, padding: '8px 10px', textAlign: 'right',
                      background: '#0f0f0f', border: '1px solid #2a2a2a',
                      color: '#fff', borderRadius: 6, fontSize: 15, fontWeight: 600,
                    }}
                  />
                  <span style={{ color: '#666', fontSize: 13 }}>%</span>
                  {dirty && (
                    <button
                      onClick={() => save(m.categoria)}
                      disabled={saving === m.categoria}
                      style={{
                        marginLeft: 6, padding: '8px 14px',
                        background: '#22c55e', color: '#0f0f0f',
                        border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', opacity: saving === m.categoria ? 0.5 : 1,
                      }}>
                      {saving === m.categoria ? '…' : 'Salva'}
                    </button>
                  )}
                  {flashing && (
                    <span style={{ marginLeft: 6, color: '#22c55e', fontSize: 13, fontWeight: 600 }}>✓</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ margin: '16px', padding: '14px 16px', background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' }}>
        <p style={{ color: '#888', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: '#ccc' }}>Nota tecnica:</strong> il ricalcolo avviene solo quando aggiorni <em>esplicitamente</em> il prezzo di acquisto di un articolo. Modificare la percentuale di markup qui <em>non</em> ricalcola i prezzi degli articoli esistenti — agisce solo sui prossimi aggiornamenti. Per applicare il nuovo markup a una categoria intera puoi usare la futura pagina di ingestione listini.
        </p>
      </div>
    </div>
  )
}
