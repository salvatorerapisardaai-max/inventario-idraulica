'use client'
import { QRModal } from './QRModal'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase client ─────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ────────────────────────────────────────────────────────
type Fornitore = {
  id: string
  nome: string
  telefono?: string
  email?: string
  indirizzo?: string
  note?: string
}

type Zona = {
  id: string
  codice: string
  nome: string
  tipo: string
  parent_id: string | null
  ordine: number
  livello: number
  path_codice: string
  path_nome: string
  sort_key: string
}

type Articolo = {
  id: string
  nome: string
  codice?: string
  categoria?: string
  descrizione?: string
  utilizzo?: string
  posizione?: string
  zona_id?: string
  foto_url?: string
  prezzo_acquisto?: number
  prezzo_vendita?: number
  quantita: number
  soglia_riordino: number
  fornitore_id?: string
  note?: string
  fornitori?: Fornitore | null
  zona_codice?: string
  zona_nome?: string
  zona_path?: string
}

const CATEGORIE = [
  'Raccordi', 'Valvole', 'Tubi e Tubazioni', 'Guarnizioni e O-ring',
  'Pompe', 'Filtri', 'Manometri e Strumenti', 'Rubinetteria',
  'Giunti', 'Accessori', 'Altro',
]

// ─── Palette colori ──────────────────────────────────────────────
const C = {
  bg: '#0f0f0f', surface: '#1a1a1a', surfaceHi: '#222',
  border: '#2a2a2a', text: '#e8e8e8', muted: '#888',
  dim: '#444', accent: '#3b82f6', accentSoft: '#1e3a5f',
  red: '#ef4444', green: '#22c55e', orange: '#f97316',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', background: C.surface,
  border: `1px solid ${C.border}`, borderRadius: 5,
  color: C.text, fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = {
  padding: '10px 18px', background: C.accent, color: '#fff',
  border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnSecondary: React.CSSProperties = {
  padding: '10px 16px', background: 'none', color: C.muted,
  border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, color: C.muted, textTransform: 'uppercase',
  letterSpacing: '0.1em', marginBottom: 4,
}

// ─── Helper: sanitizza form per Supabase ─────────────────────────
function sanitize(form: Record<string, any>) {
  const uuidFields = ['fornitore_id', 'zona_id']
  const numFields = ['prezzo_acquisto', 'prezzo_vendita', 'quantita', 'soglia_riordino']
  return Object.fromEntries(
    Object.entries(form).map(([k, v]) => {
      if (uuidFields.includes(k)) return [k, v || null]
      if (numFields.includes(k)) return [k, v === '' ? null : Number(v)]
      return [k, v || null]
    })
  )
}

// ─── Spinner ─────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: `2px solid ${C.dim}`, borderTopColor: C.accent,
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  )
}

// ─── Badge stock ─────────────────────────────────────────────────
function badge(q: number, soglia: number): React.CSSProperties {
  const low = q <= soglia
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 3,
    fontSize: 11, fontWeight: 600,
    background: low ? '#3d1515' : C.surfaceHi,
    color: low ? C.red : C.text,
    border: `1px solid ${low ? C.red + '44' : C.border}`,
  }
}

// ─── Tag categoria ───────────────────────────────────────────────
function Tag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 6px', borderRadius: 3,
      background: C.accentSoft, color: C.accent,
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{label}</span>
  )
}

// ─── Field wrapper ───────────────────────────────────────────────
function Field({ label, children, flex = 1 }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <div style={{ flex, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ─── Dropdown Zone gerarchico ─────────────────────────────────────
function ZoneSelect({ value, onChange, zone }: {
  value: string
  onChange: (v: string) => void
  zone: Zona[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={sel}>
      <option value="">— Nessuna zona —</option>
      {zone.map(z => (
        <option key={z.id} value={z.id}>
          {'  '.repeat(z.livello - 1)}{z.codice} — {z.nome}
        </option>
      ))}
    </select>
  )
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════
export default function InventarioApp() {
  const [tab, setTab] = useState<'inventario' | 'aggiungi' | 'fornitori' | 'alert'>('inventario')
  const [articoli, setArticoli] = useState<Articolo[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [zone, setZone] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)

  const carica = async () => {
    setLoading(true)
    const [{ data: arts }, { data: forn }, { data: zon }] = await Promise.all([
      supabase.from('articoli').select('*, fornitori(*)').order('nome'),
      supabase.from('fornitori').select('*').order('nome'),
      supabase.from('zone_albero').select('*').order('sort_key'),
    ])
    setArticoli(arts || [])
    setFornitori(forn || [])
    setZone(zon || [])
    setLoading(false)
  }

  useEffect(() => { carica() }, [])

  const alertCount = articoli.filter(a => a.quantita <= a.soglia_riordino).length

  const tabs = [
    { id: 'inventario', label: `Inventario (${articoli.length})` },
    { id: 'aggiungi', label: '+ Aggiungi' },
    { id: 'fornitori', label: `Fornitori (${fornitori.length})` },
    { id: 'alert', label: `⚠ Alert${alertCount > 0 ? ` (${alertCount})` : ''}` },
  ] as const

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, textarea { color-scheme: dark; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${C.accent}; outline-offset: -1px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.dim}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ padding: '16px 0 0', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
              🔧 Inventario Idraulica
            </h1>
            {loading && <Spinner />}
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 12 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                color: tab === t.id ? C.accent : C.muted,
                borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
                transition: 'color 0.15s',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px' }}>
        {tab === 'inventario' && (
          <TabInventario articoli={articoli} fornitori={fornitori} zone={zone} onReload={carica} />
        )}
        {tab === 'aggiungi' && (
          <TabAggiungi fornitori={fornitori} zone={zone} onSaved={() => { carica(); setTab('inventario') }} />
        )}
        {tab === 'fornitori' && (
          <TabFornitori fornitori={fornitori} onReload={carica} />
        )}
        {tab === 'alert' && (
          <TabAlert articoli={articoli} />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB INVENTARIO
// ═══════════════════════════════════════════════════════════════════
function TabInventario({ articoli, fornitori, zone, onReload }: {
  articoli: Articolo[]
  fornitori: Fornitore[]
  zone: Zona[]
  onReload: () => void
}) {
  const [cerca, setCerca] = useState('')
  const [selected, setSelected] = useState<Articolo | null>(null)
  const [qrArticolo, setQrArticolo] = useState<Articolo | null>(null)  // ← QR STATE

  const filtrati = articoli.filter(a =>
    a.nome.toLowerCase().includes(cerca.toLowerCase()) ||
    a.codice?.toLowerCase().includes(cerca.toLowerCase()) ||
    a.categoria?.toLowerCase().includes(cerca.toLowerCase())
  )

  if (selected) {
    return (
      <ArticoloDetail
        item={selected}
        fornitori={fornitori}
        zone={zone}
        onClose={() => setSelected(null)}
        onReload={() => { onReload(); setSelected(null) }}
      />
    )
  }

  return (
    <div>
      <input
        placeholder="Cerca per nome, codice, categoria..."
        value={cerca}
        onChange={e => setCerca(e.target.value)}
        style={{ ...inp, marginBottom: 16, maxWidth: 400 }}
      />
      {filtrati.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.muted, padding: 60, fontSize: 14 }}>
          {articoli.length === 0
            ? 'Nessun articolo. Vai su "+ Aggiungi" per iniziare.'
            : 'Nessun risultato per questa ricerca.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtrati.map(a => (
            <div key={a.id} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '12px 16px', display: 'flex',
              alignItems: 'center', gap: 12, transition: 'border-color 0.15s',
            }}>
              {/* Foto — cliccabile per aprire dettaglio */}
              <div onClick={() => setSelected(a)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.parentElement!.style.borderColor = C.accent)}
                onMouseLeave={e => (e.currentTarget.parentElement!.style.borderColor = C.border)}
              >
                {a.foto_url && (
                  <img src={a.foto_url} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{a.nome}</div>
                  <div style={{ fontSize: 11, color: C.muted, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {a.categoria && <span>{a.categoria}</span>}
                    {a.codice && <span>#{a.codice}</span>}
                    {(a as any).fornitori?.nome && <span>{(a as any).fornitori.nome}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={badge(a.quantita, a.soglia_riordino)}>{a.quantita} pz {a.quantita <= a.soglia_riordino ? '⚠' : ''}</span>
                  {a.prezzo_vendita ? (
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>€ {Number(a.prezzo_vendita).toFixed(2)}</div>
                  ) : null}
                </div>
                <span style={{ color: C.dim, fontSize: 18 }}>›</span>
              </div>

              {/* ← BOTTONE QR */}
              <button
                onClick={e => { e.stopPropagation(); setQrArticolo(a) }}
                title="Genera QR Code"
                style={{
                  padding: '5px 10px', background: C.accentSoft, color: C.accent,
                  border: `1px solid #2a4a7f`, borderRadius: 5,
                  fontSize: 12, cursor: 'pointer', flexShrink: 0,
                }}
              >
                📱 QR
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ← QR MODAL */}
      {qrArticolo && (
        <QRModal articolo={qrArticolo} onClose={() => setQrArticolo(null)} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ARTICOLO DETAIL + EDIT
// ═══════════════════════════════════════════════════════════════════
function ArticoloDetail({ item, fornitori, zone, onClose, onReload }: {
  item: Articolo
  fornitori: Fornitore[]
  zone: Zona[]
  onClose: () => void
  onReload: () => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome: item.nome || '',
    codice: item.codice || '',
    categoria: item.categoria || '',
    descrizione: item.descrizione || '',
    utilizzo: item.utilizzo || '',
    posizione: item.posizione || '',
    zona_id: item.zona_id || '',
    fornitore_id: item.fornitore_id || '',
    prezzo_acquisto: item.prezzo_acquisto?.toString() || '',
    prezzo_vendita: item.prezzo_vendita?.toString() || '',
    quantita: item.quantita?.toString() || '0',
    soglia_riordino: item.soglia_riordino?.toString() || '1',
    note: item.note || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const salva = async () => {
    if (!form.nome) return
    setSaving(true)
    const { error } = await supabase
      .from('articoli')
      .update(sanitize(form))
      .eq('id', item.id)
    if (error) {
      console.error('Errore salvataggio:', error)
      alert(`Errore: ${error.message}`)
      setSaving(false)
      return
    }
    setSaving(false)
    onReload()
  }

  const elimina = async () => {
    if (!confirm(`Eliminare "${item.nome}"?`)) return
    await supabase.from('articoli').delete().eq('id', item.id)
    onReload()
  }

  const margine = item.prezzo_acquisto && item.prezzo_vendita && item.prezzo_acquisto > 0
    ? (((item.prezzo_vendita - item.prezzo_acquisto) / item.prezzo_acquisto) * 100).toFixed(1)
    : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onClose} style={{ ...btnSecondary, padding: '8px 12px' }}>← Indietro</button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1 }}>{item.nome}</h2>
        {!editMode && (
          <button onClick={() => setEditMode(true)} style={btnPrimary}>✏ Modifica</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {item.foto_url && (
          <div style={{ flexShrink: 0 }}>
            <img src={item.foto_url} alt={item.nome} style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 300 }}>
          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Nome *" flex={3}>
                  <input value={form.nome} onChange={e => set('nome', e.target.value)} style={inp} />
                </Field>
                <Field label="Codice" flex={1}>
                  <input value={form.codice} onChange={e => set('codice', e.target.value)} style={inp} />
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Categoria">
                  <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={sel}>
                    <option value="">— Scegli —</option>
                    {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fornitore">
                  <select value={form.fornitore_id} onChange={e => set('fornitore_id', e.target.value)} style={sel}>
                    <option value="">— Nessuno —</option>
                    {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Zona magazzino">
                <ZoneSelect value={form.zona_id} onChange={v => set('zona_id', v)} zone={zone} />
              </Field>

              <Field label="Posizione (testo libero)">
                <input value={form.posizione} onChange={e => set('posizione', e.target.value)} placeholder="es. ripiano 2, cassetto in fondo..." style={inp} />
              </Field>

              <Field label="Descrizione">
                <input value={form.descrizione} onChange={e => set('descrizione', e.target.value)} style={inp} />
              </Field>

              <Field label="Utilizzo">
                <input value={form.utilizzo} onChange={e => set('utilizzo', e.target.value)} style={inp} />
              </Field>

              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  ['Quantità', 'quantita', '0', 'number', '1'],
                  ['Soglia riordino', 'soglia_riordino', '1', 'number', '1'],
                  ['€ Acquisto', 'prezzo_acquisto', '0.00', 'number', '0.01'],
                  ['€ Vendita', 'prezzo_vendita', '0.00', 'number', '0.01'],
                ].map(([label, key, placeholder, type, step]) => (
                  <Field key={key} label={label}>
                    <input
                      type={type}
                      step={step}
                      min="0"
                      value={form[key as keyof typeof form]}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      style={inp}
                    />
                  </Field>
                ))}
              </div>

              <Field label="Note">
                <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </Field>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={salva} disabled={saving || !form.nome} style={{
                  ...btnPrimary,
                  opacity: saving || !form.nome ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {saving ? <><Spinner /> Salvo...</> : '✓ Salva modifiche'}
                </button>
                <button onClick={() => setEditMode(false)} style={btnSecondary}>Annulla</button>
                <button onClick={elimina} style={{ ...btnSecondary, color: C.red, borderColor: C.red + '44', marginLeft: 'auto' }}>🗑 Elimina</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  ['Categoria', item.categoria && <Tag label={item.categoria} />],
                  ['Codice', item.codice],
                  ['Fornitore', (item as any).fornitori?.nome],
                  ['Zona', (item as any).zona_path || (item as any).zona_nome],
                  ['Posizione', item.posizione],
                  ['Descrizione', item.descrizione],
                  ['Utilizzo', item.utilizzo],
                  ['€ Acquisto', item.prezzo_acquisto ? `€ ${Number(item.prezzo_acquisto).toFixed(2)}` : null],
                  ['€ Vendita', item.prezzo_vendita ? `€ ${Number(item.prezzo_vendita).toFixed(2)}` : null],
                  ['Margine', margine ? `${margine}%` : null],
                  ['Note', item.note],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={String(label)}>
                    <div style={labelStyle}>{label}</div>
                    <div style={{ fontSize: 13 }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={labelStyle}>Stock attuale</div>
                  <span style={badge(item.quantita, item.soglia_riordino)}>
                    {item.quantita} pz — {item.quantita <= item.soglia_riordino ? '⚠ Sotto soglia' : 'OK'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={labelStyle}>Soglia riordino</div>
                  <span style={{ fontSize: 13 }}>{item.soglia_riordino} pz</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB AGGIUNGI
// ═══════════════════════════════════════════════════════════════════
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
    quantita: '0', soglia_riordino: '1', note: '',
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
    const payload = {
      ...sanitize(form),
      foto_url: fotoB64 ? `data:${mediaType};base64,${fotoB64}` : null,
    }
    const { error } = await supabase.from('articoli').insert(payload)
    if (error) {
      console.error('Errore inserimento:', error)
      alert(`Errore: ${error.message}`)
      setSaving(false)
      return
    }
    setForm({ nome: '', codice: '', categoria: '', descrizione: '', utilizzo: '', zona_id: '', posizione: '', fornitore_id: '', prezzo_acquisto: '', prezzo_vendita: '', quantita: '0', soglia_riordino: '1', note: '' })
    setFoto(null); setFotoB64(null); setAiNote(null)
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ width: 220, flexShrink: 0 }}>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          style={{
            width: 220, height: 220, border: `2px dashed ${C.border}`, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', overflow: 'hidden', background: C.surface,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
        >
          {foto
            ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ textAlign: 'center', color: C.muted, fontSize: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                Clicca o trascina foto
              </div>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

        {foto && (
          <button onClick={analizza} disabled={analizzando} style={{
            ...btnPrimary, width: '100%', marginTop: 8, justifyContent: 'center',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {analizzando ? <><Spinner /> Analisi AI...</> : '⚡ Analizza con AI'}
          </button>
        )}

        {aiNote && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 5, fontSize: 11, textAlign: 'center',
            background: aiNote === 'errore' ? '#3d1515' : C.accentSoft,
            color: aiNote === 'errore' ? C.red : C.accent,
          }}>
            {aiNote === 'errore' ? '⚠ Errore analisi' : `✓ AI — confidenza: ${aiNote}`}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Nome *" flex={3}>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome articolo..." style={inp} />
          </Field>
          <Field label="Codice" flex={1}>
            <input value={form.codice} onChange={e => set('codice', e.target.value)} placeholder="SKU..." style={inp} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Categoria">
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={sel}>
              <option value="">— Scegli —</option>
              {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Fornitore">
            <select value={form.fornitore_id} onChange={e => set('fornitore_id', e.target.value)} style={sel}>
              <option value="">— Nessuno —</option>
              {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Zona magazzino">
          <ZoneSelect value={form.zona_id} onChange={v => set('zona_id', v)} zone={zone} />
        </Field>

        <Field label="Posizione (testo libero)">
          <input value={form.posizione} onChange={e => set('posizione', e.target.value)} placeholder="es. ripiano 2, cassetto in fondo..." style={inp} />
        </Field>

        <Field label="Descrizione tecnica">
          <input value={form.descrizione} onChange={e => set('descrizione', e.target.value)} placeholder="Materiale, dimensioni, specifiche..." style={inp} />
        </Field>

        <Field label="Utilizzo">
          <input value={form.utilizzo} onChange={e => set('utilizzo', e.target.value)} placeholder="Contesto di utilizzo tipico..." style={inp} />
        </Field>

        <div style={{ display: 'flex', gap: 10 }}>
          {[
            ['Quantità', 'quantita', '0', 'number', '1'],
            ['Soglia riordino', 'soglia_riordino', '1', 'number', '1'],
            ['€ Acquisto', 'prezzo_acquisto', '0.00', 'number', '0.01'],
            ['€ Vendita', 'prezzo_vendita', '0.00', 'number', '0.01'],
          ].map(([label, key, placeholder, type, step]) => (
            <Field key={key} label={label}>
              <input
                type={type}
                step={step}
                min="0"
                value={form[key as keyof typeof form]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                style={inp}
              />
            </Field>
          ))}
        </div>

        <Field label="Note">
          <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Note aggiuntive..." style={inp} />
        </Field>

        <button onClick={salva} disabled={!form.nome || saving} style={{
          ...btnPrimary, width: '100%', justifyContent: 'center',
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
          opacity: !form.nome || saving ? 0.6 : 1,
          cursor: !form.nome ? 'not-allowed' : 'pointer',
        }}>
          {saving ? <><Spinner /> Salvataggio...</> : '✓ Salva nel database'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB FORNITORI
// ═══════════════════════════════════════════════════════════════════
function TabFornitori({ fornitori, onReload }: { fornitori: Fornitore[]; onReload: () => void }) {
  const [form, setForm] = useState({ nome: '', telefono: '', email: '', indirizzo: '', note: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const salva = async () => {
    if (!form.nome) return
    setSaving(true)
    await supabase.from('fornitori').insert(form)
    setForm({ nome: '', telefono: '', email: '', indirizzo: '', note: '' })
    setSaving(false)
    onReload()
  }

  const elimina = async (id: string) => {
    if (!confirm('Eliminare questo fornitore?')) return
    await supabase.from('fornitori').delete().eq('id', id)
    onReload()
  }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={labelStyle}>FORNITORI ({fornitori.length})</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {fornitori.length === 0
            ? <div style={{ color: C.muted, fontSize: 13, padding: '20px 0' }}>Nessun fornitore ancora.</div>
            : fornitori.map(f => (
              <div key={f.id} style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.nome}</div>
                  {f.telefono && <div style={{ fontSize: 11, color: C.muted }}>📞 {f.telefono}</div>}
                  {f.email && <div style={{ fontSize: 11, color: C.muted }}>✉ {f.email}</div>}
                </div>
                <button onClick={() => elimina(f.id)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 16 }}>🗑</button>
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ width: 300, flexShrink: 0 }}>
        <div style={labelStyle}>NUOVO FORNITORE</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Nome *">
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ragione sociale..." style={inp} />
          </Field>
          <Field label="Telefono">
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)} style={inp} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} />
          </Field>
          <Field label="Indirizzo">
            <input value={form.indirizzo} onChange={e => set('indirizzo', e.target.value)} style={inp} />
          </Field>
          <Field label="Note">
            <input value={form.note} onChange={e => set('note', e.target.value)} style={inp} />
          </Field>
          <button onClick={salva} disabled={!form.nome || saving} style={{
            ...btnPrimary, opacity: !form.nome || saving ? 0.6 : 1,
            cursor: !form.nome ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Salvo...' : '+ Aggiungi fornitore'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB ALERT
// ═══════════════════════════════════════════════════════════════════
function TabAlert({ articoli }: { articoli: Articolo[] }) {
  const critici = articoli.filter(a => a.quantita <= a.soglia_riordino)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={labelStyle}>ARTICOLI SOTTO SOGLIA DI RIORDINO</span>
        {critici.length > 0 && (
          <span style={{ marginLeft: 12, background: C.red + '22', color: C.red, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3 }}>
            {critici.length} articoli
          </span>
        )}
      </div>
      {critici.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.muted, padding: 60 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          Tutti gli articoli sono sopra la soglia di riordino.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {critici.map(a => (
            <div key={a.id} style={{
              background: '#1a1010', border: `1px solid ${C.red}33`, borderRadius: 6,
              padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.nome}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {a.categoria} {(a as any).fornitori?.nome ? `· ${(a as any).fornitori.nome}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: C.red, fontWeight: 700, fontSize: 14 }}>{a.quantita} pz</div>
                <div style={{ color: C.muted, fontSize: 11 }}>soglia: {a.soglia_riordino}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
