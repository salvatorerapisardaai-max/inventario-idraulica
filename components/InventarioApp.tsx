'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase, CATEGORIE, type Articolo, type Fornitore, type Zona } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────────────────────────

export default function InventarioApp() {
  const [tab, setTab] = useState<'inventario' | 'aggiungi' | 'fornitori' | 'alert'>('inventario')
  const [articoli, setArticoli] = useState<Articolo[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [zone, setZone] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [detail, setDetail] = useState<Articolo | null>(null)

  const loadData = async () => {
    setLoading(true)
    const [a, f, z] = await Promise.all([
      supabase.from('articoli_localizzati').select('*, fornitori(nome, telefono)').order('nome'),
      supabase.from('fornitori').select('*').order('nome'),
      supabase.from('zone_albero').select('*'),
    ])
    if (a.data) setArticoli(a.data as any)
    if (f.data) setFornitori(f.data as any)
    if (z.data) setZone(z.data as any)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    return articoli.filter(a => {
      const matchSearch = !search ||
        a.nome?.toLowerCase().includes(search.toLowerCase()) ||
        a.codice?.toLowerCase().includes(search.toLowerCase()) ||
        a.descrizione?.toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCat || a.categoria === filterCat
      return matchSearch && matchCat
    })
  }, [articoli, search, filterCat])

  const sottoSoglia = articoli.filter(a => a.quantita <= a.soglia_riordino)

  const tabs = [
    { id: 'inventario', label: 'Inventario', count: articoli.length },
    { id: 'aggiungi', label: '+ Aggiungi', count: null },
    { id: 'fornitori', label: 'Fornitori', count: fornitori.length },
    { id: 'alert', label: 'Alert', count: sottoSoglia.length },
  ] as const

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Inventario Idraulica
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
          {articoli.length} articoli · {fornitori.length} fornitori · {zone.length} zone
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, alignItems: 'center',
        borderBottom: '1px solid var(--border)', marginBottom: 0,
      }}>
        <div style={{ display: 'flex', gap: 0, flex: 1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', padding: '10px 16px',
              fontSize: 13, cursor: 'pointer',
              color: tab === t.id ? 'var(--text)' : 'var(--muted)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 7,
            }}>
              {t.label}
              {t.count !== null && (
                <span style={{
                  fontSize: 10,
                  background: t.id === 'alert' && sottoSoglia.length > 0 ? 'var(--red)' : 'var(--dim)',
                  color: t.id === 'alert' && sottoSoglia.length > 0 ? '#fff' : 'var(--muted)',
                  padding: '1px 6px', borderRadius: 10,
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={loadData} style={{
          background: 'none', border: 'none', color: 'var(--muted)',
          fontSize: 18, padding: 8, cursor: 'pointer',
        }} title="Ricarica">↻</button>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 0' }} className="fade-in">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
            <Spinner size={28} />
            <p style={{ marginTop: 14, fontSize: 13 }}>Caricamento...</p>
          </div>
        ) : (
          <>
            {tab === 'inventario' && (
              <TabInventario
                articoli={filtered} allArticoli={articoli}
                search={search} setSearch={setSearch}
                filterCat={filterCat} setFilterCat={setFilterCat}
                onDetail={setDetail}
              />
            )}
            {tab === 'aggiungi' && (
              <TabAggiungi
                fornitori={fornitori}
                zone={zone}
                onSaved={() => { loadData(); setTab('inventario') }}
              />
            )}
            {tab === 'fornitori' && (
              <TabFornitori fornitori={fornitori} onReload={loadData} />
            )}
            {tab === 'alert' && (
              <TabAlert articoli={sottoSoglia} onDetail={setDetail} />
            )}
          </>
        )}
      </div>

      {detail && (
        <DetailModal
          item={detail}
          fornitori={fornitori}
          zone={zone}
          onClose={() => setDetail(null)}
          onReload={loadData}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Tab Inventario
// ─────────────────────────────────────────────────────────────────

function TabInventario({
  articoli, allArticoli, search, setSearch, filterCat, setFilterCat, onDetail,
}: {
  articoli: Articolo[]
  allArticoli: Articolo[]
  search: string
  setSearch: (s: string) => void
  filterCat: string
  setFilterCat: (s: string) => void
  onDetail: (a: Articolo) => void
}) {
  const esportaCSV = () => {
    const h = ['Codice', 'Nome', 'Categoria', 'Descrizione', 'Utilizzo', 'Posizione', 'Zona', 'Fornitore', '€ Acquisto', '€ Vendita', 'Quantità', 'Soglia']
    const rows = allArticoli.map(a => [
      a.codice, a.nome, a.categoria, a.descrizione, a.utilizzo,
      a.posizione, a.zona_path, a.fornitori?.nome,
      a.prezzo_acquisto, a.prezzo_vendita, a.quantita, a.soglia_riordino,
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','))
    const csv = [h.join(','), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventario-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Cerca per nome, codice, descrizione…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">Tutte le categorie</option>
          {CATEGORIE.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={esportaCSV} style={btnSecondary}>Esporta CSV</button>
      </div>

      {articoli.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          Nessun articolo. Vai sulla tab <strong>+ Aggiungi</strong> per iniziare.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {articoli.map(a => (
            <div key={a.id} onClick={() => onDetail(a)} style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr auto auto',
              gap: 14, alignItems: 'center',
              padding: '12px 14px', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}>
              {a.foto_url ? (
                <img src={a.foto_url} alt="" style={{
                  width: 60, height: 60, objectFit: 'cover',
                  borderRadius: 4, border: '1px solid var(--border)',
                }} />
              ) : (
                <div style={{
                  width: 60, height: 60, background: 'var(--surface-2)',
                  borderRadius: 4, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--dim)', fontSize: 22,
                }}>📦</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{a.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.codice && <span>#{a.codice}</span>}
                  {a.categoria && <Tag label={a.categoria} />}
                  {a.zona_codice && <span>📍 {a.zona_codice}{a.posizione ? ` · ${a.posizione}` : ''}</span>}
                  {a.fornitori?.nome && <span>· {a.fornitori.nome}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {a.prezzo_vendita && a.prezzo_vendita > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 600 }}>€ {Number(a.prezzo_vendita).toFixed(2)}</div>
                )}
                <div style={{ marginTop: 3 }}>
                  <span style={stockBadge(a.quantita, a.soglia_riordino)}>
                    {a.quantita} pz {a.quantita <= a.soglia_riordino ? '⚠' : ''}
                  </span>
                </div>
              </div>
              <span style={{ color: 'var(--dim)', fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Tab Aggiungi (foto + AI + form con dropdown gerarchico zone)
// ─────────────────────────────────────────────────────────────────

function TabAggiungi({ fornitori, zone, onSaved }: {
  fornitori: Fornitore[]
  zone: Zona[]
  onSaved: () => void
}) {
  const [foto, setFoto] = useState<string | null>(null)
  const [fotoB64, setFotoB64] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState('image/jpeg')
  const [analizzando, setAnalizzando] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nome: '', codice: '', categoria: '', descrizione: '', utilizzo: '',
    zona_id: '', posizione: '', fornitore_id: '',
    prezzo_acquisto: '', prezzo_vendita: '',
    quantita: '', soglia_riordino: '', note: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleFile = (file: File) => {
    if (!file?.type.startsWith('image/')) return
    setMediaType(file.type)
    setFoto(URL.createObjectURL(file))
    const r = new FileReader()
    r.onload = e => setFotoB64((e.target?.result as string).split(',')[1])
    r.readAsDataURL(file)
    setAiNote(null)
  }

  const analizza = async () => {
    if (!fotoB64) return
    setAnalizzando(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: fotoB64, media_type: mediaType }),
      })
      const p = await res.json()
      if (p.error) {
        setAiNote('errore')
      } else {
        setForm(f => ({
          ...f,
          nome: p.nome || f.nome,
          categoria: p.categoria || f.categoria,
          descrizione: p.descrizione || f.descrizione,
          utilizzo: p.utilizzo || f.utilizzo,
        }))
        setAiNote(p.confidenza || 'bassa')
      }
    } catch {
      setAiNote('errore')
    }
    setAnalizzando(false)
  }

  const salva = async () => {
    if (!form.nome) return
    setSaving(true)
    const payload: any = {
      nome: form.nome,
      codice: form.codice || null,
      categoria: form.categoria || null,
      descrizione: form.descrizione || null,
      utilizzo: form.utilizzo || null,
      zona_id: form.zona_id || null,
      posizione: form.posizione || null,
      foto_url: fotoB64 ? `data:${mediaType};base64,${fotoB64}` : null,
      fornitore_id: form.fornitore_id || null,
      prezzo_acquisto: parseFloat(form.prezzo_acquisto) || 0,
      prezzo_vendita: parseFloat(form.prezzo_vendita) || 0,
      quantita: parseInt(form.quantita) || 0,
      soglia_riordino: parseInt(form.soglia_riordino) || 1,
      note: form.note || null,
    }
    const { error } = await supabase.from('articoli').insert(payload)
    setSaving(false)
    if (error) {
      alert('Errore salvataggio: ' + error.message)
      return
    }
    onSaved()
  }

  const noteColors: Record<string, string> = {
    alta: 'var(--green)', media: 'var(--yellow)', bassa: 'var(--red)', errore: 'var(--red)',
  }
  const noteText: Record<string, string> = {
    alta: '✓ Identificazione AI affidabile — verifica i campi',
    media: '⚠ Identificazione parziale — controlla e correggi',
    bassa: '✗ AI incerta — compila manualmente',
    errore: '✗ Errore AI — compila manualmente',
  }

  return (
    <div style={{ maxWidth: 900, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Foto */}
      <div style={{ width: 280, minWidth: 260 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <p style={labelMaiusc}>Foto articolo</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          {foto ? (
            <>
              <img src={foto} alt="preview" style={{
                width: '100%', maxHeight: 200, objectFit: 'cover',
                borderRadius: 6, marginBottom: 10, border: '1px solid var(--border)',
              }} />
              {analizzando ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--muted)' }}>
                  <Spinner /> Analisi AI in corso...
                </div>
              ) : (
                <button onClick={analizza} style={{ ...btnPrimary, width: '100%', marginBottom: 8 }}>
                  ⚡ Analizza con AI
                </button>
              )}
              <button onClick={() => fileRef.current?.click()} style={{ ...btnSecondary, width: '100%' }}>
                Cambia foto
              </button>
              {aiNote && (
                <div style={{
                  marginTop: 10, padding: '8px 10px', fontSize: 11,
                  background: 'var(--surface-2)', borderRadius: 4,
                  color: noteColors[aiNote], lineHeight: 1.4,
                }}>
                  {noteText[aiNote]}
                </div>
              )}
            </>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: '40px 16px', background: 'var(--surface-2)',
              border: '2px dashed var(--border)', borderRadius: 6,
              color: 'var(--muted)', cursor: 'pointer', fontSize: 13,
            }}>
              📷 Carica foto<br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>Click per selezionare</span>
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Nome *" flex={2}>
            <input value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="es. Raccordo ottone 3/4″" />
          </Field>
          <Field label="Codice">
            <input value={form.codice} onChange={e => set('codice', e.target.value)}
              placeholder="es. RAC-001" />
          </Field>
        </div>

        <Field label="Categoria">
          <select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
            <option value="">— seleziona</option>
            {CATEGORIE.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Descrizione tecnica">
          <textarea value={form.descrizione} onChange={e => set('descrizione', e.target.value)}
            placeholder="Materiale, dimensioni, specifiche…"
            style={{ minHeight: 60, resize: 'vertical' }} />
        </Field>

        <Field label="Utilizzo / a cosa serve">
          <input value={form.utilizzo} onChange={e => set('utilizzo', e.target.value)}
            placeholder="es. Collegamento tubi in impianti idrici civili" />
        </Field>

        {/* ZONA — dropdown gerarchico */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Zona magazzino" flex={2}>
            <ZonaSelect zone={zone} value={form.zona_id} onChange={v => set('zona_id', v)} />
          </Field>
          <Field label="Dettaglio posizione">
            <input value={form.posizione} onChange={e => set('posizione', e.target.value)}
              placeholder="es. ripiano 3, sez. A" />
          </Field>
        </div>

        <Field label="Fornitore">
          <select value={form.fornitore_id} onChange={e => set('fornitore_id', e.target.value)}>
            <option value="">— nessuno</option>
            {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Field>

        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="€ Acquisto">
            <input type="number" step="0.01" value={form.prezzo_acquisto}
              onChange={e => set('prezzo_acquisto', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="€ Vendita">
            <input type="number" step="0.01" value={form.prezzo_vendita}
              onChange={e => set('prezzo_vendita', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Quantità">
            <input type="number" value={form.quantita}
              onChange={e => set('quantita', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Soglia">
            <input type="number" value={form.soglia_riordino}
              onChange={e => set('soglia_riordino', e.target.value)} placeholder="1" />
          </Field>
        </div>

        <Field label="Note">
          <textarea value={form.note} onChange={e => set('note', e.target.value)}
            style={{ minHeight: 50, resize: 'vertical' }} placeholder="Eventuali note aggiuntive…" />
        </Field>

        <button onClick={salva} disabled={!form.nome || saving} style={{
          marginTop: 8, padding: '12px 16px',
          background: form.nome ? 'var(--accent)' : 'var(--dim)',
          color: form.nome ? '#fff' : 'var(--muted)',
          border: 'none', borderRadius: 5,
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: !form.nome || saving ? 0.6 : 1,
          cursor: !form.nome ? 'not-allowed' : 'pointer',
        }}>
          {saving ? <><Spinner /> Salvo…</> : '+ Aggiungi all\'inventario'}
        </button>
      </div>
    </div>
  )
}

// ─── Componente: ZonaSelect ─────────────────────────────────────
// Dropdown gerarchico che pesca da zone_albero
// Mostra l'indentazione tramite spazi per dare la sensazione di tree

function ZonaSelect({ zone, value, onChange }: {
  zone: Zona[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— seleziona zona</option>
      {zone.map(z => (
        <option key={z.id} value={z.id}>
          {'\u00A0\u00A0'.repeat(z.livello - 1)}
          {z.codice} — {z.nome}
        </option>
      ))}
    </select>
  )
}

// ─────────────────────────────────────────────────────────────────
// Tab Fornitori
// ─────────────────────────────────────────────────────────────────

function TabFornitori({ fornitori, onReload }: {
  fornitori: Fornitore[]
  onReload: () => void
}) {
  const [form, setForm] = useState({ nome: '', telefono: '', email: '', indirizzo: '', note: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const aggiungi = async () => {
    if (!form.nome) return
    setSaving(true)
    await supabase.from('fornitori').insert({
      nome: form.nome,
      telefono: form.telefono || null,
      email: form.email || null,
      indirizzo: form.indirizzo || null,
      note: form.note || null,
    })
    setForm({ nome: '', telefono: '', email: '', indirizzo: '', note: '' })
    setSaving(false)
    onReload()
  }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Lista */}
      <div style={{ flex: 2, minWidth: 320 }}>
        {fornitori.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Nessun fornitore.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            {fornitori.map(f => (
              <div key={f.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600 }}>{f.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {f.telefono && <span>📞 {f.telefono}</span>}
                  {f.email && <span>✉ {f.email}</span>}
                  {f.indirizzo && <span>📍 {f.indirizzo}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form aggiungi */}
      <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={labelMaiusc}>+ Nuovo fornitore</p>
        <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome *" />
        <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Telefono" />
        <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email" />
        <input value={form.indirizzo} onChange={e => set('indirizzo', e.target.value)} placeholder="Indirizzo" />
        <textarea value={form.note} onChange={e => set('note', e.target.value)} placeholder="Note" style={{ minHeight: 60 }} />
        <button onClick={aggiungi} disabled={!form.nome || saving} style={{
          padding: '10px', background: form.nome ? 'var(--accent)' : 'var(--dim)',
          color: form.nome ? '#fff' : 'var(--muted)', border: 'none', borderRadius: 5,
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          cursor: !form.nome ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Salvo…' : '+ Aggiungi'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Tab Alert
// ─────────────────────────────────────────────────────────────────

function TabAlert({ articoli, onDetail }: {
  articoli: Articolo[]
  onDetail: (a: Articolo) => void
}) {
  if (articoli.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <p>Tutto il magazzino è a livello sufficiente</p>
      </div>
    )
  }
  return (
    <div>
      <div style={{
        marginBottom: 20, padding: '12px 16px',
        background: '#3d1515', border: '1px solid #e0525244',
        borderRadius: 6, fontSize: 13, color: 'var(--red)',
      }}>
        ⚠ {articoli.length} articol{articoli.length === 1 ? 'o' : 'i'} sotto soglia di riordino
      </div>
      {articoli.map(a => (
        <div key={a.id} onClick={() => onDetail(a)} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '14px 16px', marginBottom: 8, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>{a.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {a.categoria && <Tag label={a.categoria} />}
              {a.zona_codice && <span>📍 {a.zona_codice}</span>}
              {a.fornitori?.nome && <span>· {a.fornitori.nome}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={stockBadge(a.quantita, a.soglia_riordino)}>
              {a.quantita} / {a.soglia_riordino} pz ⚠
            </span>
            {a.fornitori?.telefono && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                📞 {a.fornitori.telefono}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Modale di dettaglio
// ─────────────────────────────────────────────────────────────────

function DetailModal({ item, fornitori, zone, onClose, onReload }: {
  item: Articolo
  fornitori: Fornitore[]
  zone: Zona[]
  onClose: () => void
  onReload: () => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<any>({ ...item })
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const salva = async () => {
    const { id, fornitori: _, zona_codice, zona_nome, zona_path, ...payload } = form
    await supabase.from('articoli').update(payload).eq('id', id)
    setEditMode(false)
    onReload()
  }

  const elimina = async () => {
    if (!confirm(`Eliminare "${item.nome}"? L'azione non è reversibile.`)) return
    await supabase.from('articoli').delete().eq('id', item.id)
    onClose()
    onReload()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 8, padding: 24,
        maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{item.nome}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {item.foto_url && (
          <img src={item.foto_url} alt="" style={{
            width: '100%', maxHeight: 240, objectFit: 'cover',
            borderRadius: 6, marginBottom: 14,
          }} />
        )}

        {!editMode ? (
          <>
            <DetailRow label="Codice" value={item.codice} />
            <DetailRow label="Categoria" value={item.categoria} />
            <DetailRow label="Descrizione" value={item.descrizione} />
            <DetailRow label="Utilizzo" value={item.utilizzo} />
            <DetailRow label="Zona" value={item.zona_path || item.zona_codice} />
            <DetailRow label="Posizione (dettaglio)" value={item.posizione} />
            <DetailRow label="Fornitore" value={item.fornitori?.nome} />
            <DetailRow label="€ Acquisto" value={item.prezzo_acquisto ? `€ ${Number(item.prezzo_acquisto).toFixed(2)}` : '—'} />
            <DetailRow label="€ Vendita" value={item.prezzo_vendita ? `€ ${Number(item.prezzo_vendita).toFixed(2)}` : '—'} />
            <DetailRow label="Quantità" value={`${item.quantita} pz`} />
            <DetailRow label="Soglia riordino" value={`${item.soglia_riordino} pz`} />
            <DetailRow label="Note" value={item.note} />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditMode(true)} style={btnPrimary}>Modifica</button>
              <button onClick={elimina} style={{ ...btnSecondary, color: 'var(--red)', borderColor: '#e0525244' }}>Elimina</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Nome"><input value={form.nome || ''} onChange={e => set('nome', e.target.value)} /></Field>
            <Field label="Categoria">
              <select value={form.categoria || ''} onChange={e => set('categoria', e.target.value)}>
                <option value="">—</option>
                {CATEGORIE.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Zona"><ZonaSelect zone={zone} value={form.zona_id || ''} onChange={v => set('zona_id', v)} /></Field>
            <Field label="Posizione (dettaglio)"><input value={form.posizione || ''} onChange={e => set('posizione', e.target.value)} /></Field>
            <Field label="Fornitore">
              <select value={form.fornitore_id || ''} onChange={e => set('fornitore_id', e.target.value || null)}>
                <option value="">—</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Quantità"><input type="number" value={form.quantita ?? 0} onChange={e => set('quantita', parseInt(e.target.value) || 0)} /></Field>
              <Field label="Soglia"><input type="number" value={form.soglia_riordino ?? 1} onChange={e => set('soglia_riordino', parseInt(e.target.value) || 1)} /></Field>
              <Field label="€ Vendita"><input type="number" step="0.01" value={form.prezzo_vendita ?? 0} onChange={e => set('prezzo_vendita', parseFloat(e.target.value) || 0)} /></Field>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={salva} style={btnPrimary}>Salva modifiche</button>
              <button onClick={() => setEditMode(false)} style={btnSecondary}>Annulla</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Componenti utility
// ─────────────────────────────────────────────────────────────────

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <div style={{ flex: flex ?? 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelMaiusc}>{label}</label>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: any }) {
  if (!value) return null
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 6px', borderRadius: 3,
      background: 'var(--accent-soft)', color: 'var(--accent)',
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{label}</span>
  )
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid var(--dim)', borderTopColor: 'var(--accent)',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  )
}

function stockBadge(q: number, soglia: number): React.CSSProperties {
  const low = q <= soglia
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 3,
    fontSize: 11, fontWeight: 600,
    background: low ? '#3d1515' : 'var(--surface-2)',
    color: low ? 'var(--red)' : 'var(--text)',
    border: `1px solid ${low ? '#e0525244' : 'var(--border)'}`,
  }
}

const labelMaiusc: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)',
  textTransform: 'uppercase', margin: 0,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 14px', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px', background: 'var(--surface-2)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, fontWeight: 500,
  cursor: 'pointer',
}
