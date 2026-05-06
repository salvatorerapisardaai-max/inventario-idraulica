'use client'
import { QRModal } from './QRModal'
import { BarcodeScanner } from './BarcodeScanner'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Fornitore = { id: string; nome: string; telefono?: string; email?: string; indirizzo?: string; note?: string }
type Zona = { id: string; codice: string; nome: string; tipo: string; parent_id: string | null; ordine: number; livello: number; path_codice: string; path_nome: string; sort_key: string }
type Articolo = { id: string; nome: string; codice?: string; categoria?: string; descrizione?: string; utilizzo?: string; posizione?: string; zona_id?: string; foto_url?: string; prezzo_acquisto?: number; prezzo_vendita?: number; quantita: number; soglia_riordino: number; fornitore_id?: string; note?: string; fornitori?: Fornitore | null; zona_codice?: string; zona_nome?: string; zona_path?: string }
type Cliente = { id: string; nome: string; telefono?: string; email?: string; indirizzo?: string; note?: string; created_at?: string }

const CATEGORIE = ['Raccordi','Valvole','Tubi e Tubazioni','Guarnizioni e O-ring','Pompe','Filtri','Manometri e Strumenti','Rubinetteria','Giunti','Accessori','Altro']

const C = { bg:'#0f0f0f', surface:'#1a1a1a', surfaceHi:'#222', border:'#2a2a2a', text:'#e8e8e8', muted:'#888', dim:'#444', accent:'#3b82f6', accentSoft:'#1e3a5f', red:'#ef4444', green:'#22c55e', orange:'#f97316', purple:'#a855f7' }

const inp: React.CSSProperties = { width:'100%', padding:'9px 11px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:5, color:C.text, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
const sel: React.CSSProperties = { ...inp, cursor:'pointer' }
const btnPrimary: React.CSSProperties = { padding:'10px 18px', background:C.accent, color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' }
const btnSecondary: React.CSSProperties = { padding:'10px 16px', background:'none', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12, cursor:'pointer', fontFamily:'inherit' }
const labelStyle: React.CSSProperties = { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }

function sanitize(form: Record<string, any>) {
  const uuidFields = ['fornitore_id','zona_id']
  const numFields = ['prezzo_acquisto','prezzo_vendita','quantita','soglia_riordino']
  return Object.fromEntries(Object.entries(form).map(([k,v]) => {
    if (uuidFields.includes(k)) return [k, v||null]
    if (numFields.includes(k)) return [k, v===''?null:Number(v)]
    return [k, v||null]
  }))
}

function exportCSV(articoli: Articolo[], fornitori: Fornitore[]) {
  const headers = ['Nome','Codice','Categoria','Fornitore','Quantita','€ Acquisto','€ Vendita','Valore Acquisto','Valore Vendita','Margine %','Soglia Riordino']
  const rows = articoli.map(a => {
    const f = fornitori.find(x => x.id === a.fornitore_id)
    const va = a.quantita * (a.prezzo_acquisto||0)
    const vv = a.quantita * (a.prezzo_vendita||0)
    const m = va>0 ? (((vv-va)/va)*100).toFixed(1) : '0'
    return [a.nome, a.codice||'', a.categoria||'', f?.nome||'', a.quantita, (a.prezzo_acquisto||0).toFixed(2), (a.prezzo_vendita||0).toFixed(2), va.toFixed(2), vv.toFixed(2), m, a.soglia_riordino]
  })
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href=url; el.download=`inventario_${new Date().toISOString().split('T')[0]}.csv`; el.click()
  URL.revokeObjectURL(url)
}

function Spinner() {
  return <span style={{ display:'inline-block', width:14, height:14, border:`2px solid ${C.dim}`, borderTopColor:C.accent, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
}

function badge(q: number, soglia: number): React.CSSProperties {
  const low = q<=soglia
  return { display:'inline-block', padding:'2px 8px', borderRadius:3, fontSize:11, fontWeight:600, background:low?'#3d1515':C.surfaceHi, color:low?C.red:C.text, border:`1px solid ${low?C.red+'44':C.border}` }
}

function Tag({ label }: { label: string }) {
  return <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3, background:C.accentSoft, color:C.accent, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
}

function Field({ label, children, flex=1 }: { label:string; children:React.ReactNode; flex?:number }) {
  return (
    <div style={{ flex, display:'flex', flexDirection:'column', gap:4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function ZoneSelect({ value, onChange, zone }: { value:string; onChange:(v:string)=>void; zone:Zona[] }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={sel}>
      <option value="">— Nessuna zona —</option>
      {zone.map(z=><option key={z.id} value={z.id}>{'  '.repeat(z.livello-1)}{z.codice} — {z.nome}</option>)}
    </select>
  )
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════
export default function InventarioApp() {
  const [tab, setTab] = useState<'dashboard'|'inventario'|'aggiungi'|'fornitori'|'clienti'|'alert'>('inventario')
  const [articoli, setArticoli] = useState<Articolo[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [zone, setZone] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanResult, setScanResult] = useState<{found: boolean; articolo?: Articolo; codice?: string} | null>(null)
  const [initialCodice, setInitialCodice] = useState('')

  const carica = async () => {
    setLoading(true)
    const [{ data: arts }, { data: forn }, { data: zon }, { data: cli }] = await Promise.all([
      supabase.from('articoli').select('*, fornitori(*)').order('nome'),
      supabase.from('fornitori').select('*').order('nome'),
      supabase.from('zone_albero').select('*').order('sort_key'),
      supabase.from('clienti').select('*').order('nome'),
    ])
    setArticoli(arts||[]); setFornitori(forn||[]); setZone(zon||[]); setClienti(cli||[])
    setLoading(false)
  }

  useEffect(()=>{ carica() },[])

  const alertCount = articoli.filter(a=>a.quantita<=a.soglia_riordino).length

  const handleBarcode = (code: string) => {
    setScannerOpen(false)
    const found = articoli.find(a => a.codice === code)
    setScanResult({ found: !!found, articolo: found, codice: code })
  }

  const tabs = [
    { id:'dashboard', label:'📊' },
    { id:'inventario', label:`Inventario (${articoli.length})` },
    { id:'aggiungi', label:'+ Aggiungi' },
    { id:'fornitori', label:`Fornitori (${fornitori.length})` },
    { id:'clienti', label:`Clienti (${clienti.length})` },
    { id:'alert', label:`⚠ Alert${alertCount>0?` (${alertCount})`:''}` },
  ] as const

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text, fontFamily:'system-ui, sans-serif' }}>
      <style>{`
        *{box-sizing:border-box}input,select,textarea{color-scheme:dark}
        input:focus,select:focus,textarea:focus{outline:2px solid ${C.accent};outline-offset:-1px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes scanline{0%,100%{transform:translateY(-28px);opacity:.4}50%{transform:translateY(28px);opacity:1}}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.dim};border-radius:3px}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'0 16px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ padding:'14px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
              <h1 style={{ margin:0, fontSize:17, fontWeight:700 }}>🔧 Inventario Idraulica</h1>
              {loading && <Spinner />}
            </div>
            {/* Scan button sempre visibile */}
            <button onClick={()=>setScannerOpen(true)} style={{ padding:'7px 14px', background:C.accentSoft, color:C.accent, border:`1px solid #2a4a7f`, borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              📷 Scan
            </button>
          </div>
          <div style={{ display:'flex', gap:2, marginTop:10, overflowX:'auto' }}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'7px 14px', background:'none', border:'none', cursor:'pointer', fontSize:11, fontFamily:'inherit', fontWeight:600, whiteSpace:'nowrap', color:tab===t.id?C.accent:C.muted, borderBottom:tab===t.id?`2px solid ${C.accent}`:'2px solid transparent' }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'20px 16px' }}>
        {tab==='dashboard' && <TabDashboard articoli={articoli} fornitori={fornitori} />}
        {tab==='inventario' && <TabInventario articoli={articoli} fornitori={fornitori} zone={zone} onReload={carica} />}
        {tab==='aggiungi' && <TabAggiungi fornitori={fornitori} zone={zone} initialCodice={initialCodice} onSaved={()=>{ setInitialCodice(''); carica(); setTab('inventario') }} />}
        {tab==='fornitori' && <TabFornitori fornitori={fornitori} onReload={carica} />}
        {tab==='clienti' && <TabClienti clienti={clienti} onReload={carica} />}
        {tab==='alert' && <TabAlert articoli={articoli} />}
      </div>

      {/* Scanner */}
      {scannerOpen && <BarcodeScanner onDetected={handleBarcode} onClose={()=>setScannerOpen(false)} />}

      {/* Risultato scan */}
      {scanResult && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:900, padding:16 }} onClick={()=>setScanResult(null)}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:24, maxWidth:320, width:'100%' }} onClick={e=>e.stopPropagation()}>
            {scanResult.found && scanResult.articolo ? (
              <>
                <div style={{ fontSize:32, textAlign:'center', marginBottom:12 }}>✅</div>
                <h3 style={{ margin:'0 0 8px', textAlign:'center', color:C.text }}>{scanResult.articolo.nome}</h3>
                <p style={{ margin:'0 0 4px', textAlign:'center', color:C.muted, fontSize:13 }}>{scanResult.articolo.categoria}</p>
                <div style={{ textAlign:'center', margin:'12px 0' }}>
                  <span style={badge(scanResult.articolo.quantita, scanResult.articolo.soglia_riordino)}>{scanResult.articolo.quantita} pz</span>
                </div>
                {scanResult.articolo.prezzo_vendita && (
                  <p style={{ textAlign:'center', fontSize:20, fontWeight:700, color:C.green, margin:'8px 0 16px' }}>€ {Number(scanResult.articolo.prezzo_vendita).toFixed(2)}</p>
                )}
                <button onClick={()=>setScanResult(null)} style={{ ...btnPrimary, width:'100%', textAlign:'center' }}>OK</button>
              </>
            ) : (
              <>
                <div style={{ fontSize:32, textAlign:'center', marginBottom:12 }}>🔍</div>
                <h3 style={{ margin:'0 0 8px', textAlign:'center', color:C.text }}>Codice non trovato</h3>
                <p style={{ margin:'0 0 16px', textAlign:'center', color:C.muted, fontSize:13, fontFamily:'monospace' }}>{scanResult.codice}</p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>setScanResult(null)} style={{ ...btnSecondary, flex:1 }}>Chiudi</button>
                  <button onClick={()=>{ setInitialCodice(scanResult.codice||''); setScanResult(null); setTab('aggiungi') }} style={{ ...btnPrimary, flex:1 }}>+ Aggiungi</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function TabDashboard({ articoli, fornitori }: { articoli:Articolo[]; fornitori:Fornitore[] }) {
  const va = articoli.reduce((s,a)=>s+a.quantita*(a.prezzo_acquisto||0),0)
  const vv = articoli.reduce((s,a)=>s+a.quantita*(a.prezzo_vendita||0),0)
  const margine = va>0?((vv-va)/va*100):0
  const sottoSoglia = articoli.filter(a=>a.quantita<=a.soglia_riordino).length
  const esauriti = articoli.filter(a=>a.quantita===0).length

  const perCategoria = CATEGORIE.map(cat=>({
    cat, count:articoli.filter(a=>a.categoria===cat).length,
    valore:articoli.filter(a=>a.categoria===cat).reduce((s,a)=>s+a.quantita*(a.prezzo_vendita||0),0),
  })).filter(c=>c.count>0).sort((a,b)=>b.valore-a.valore)
  const maxV = Math.max(...perCategoria.map(c=>c.valore),1)

  const top5 = [...articoli].filter(a=>a.prezzo_vendita).sort((a,b)=>b.quantita*(b.prezzo_vendita||0)-a.quantita*(a.prezzo_vendita||0)).slice(0,5)

  const perForn = fornitori.map(f=>({
    nome:f.nome,
    count:articoli.filter(a=>a.fornitore_id===f.id).length,
    valore:articoli.filter(a=>a.fornitore_id===f.id).reduce((s,a)=>s+a.quantita*(a.prezzo_acquisto||0),0),
  })).filter(f=>f.count>0).sort((a,b)=>b.valore-a.valore)

  const kpis = [
    { label:'Articoli totali', value:articoli.length, icon:'📦', color:C.accent },
    { label:'Valore magazzino', value:`€ ${va.toFixed(0)}`, icon:'💰', color:C.green },
    { label:'Valore potenziale', value:`€ ${vv.toFixed(0)}`, icon:'📈', color:C.orange },
    { label:'Margine medio', value:`${margine.toFixed(1)}%`, icon:'📊', color:C.purple },
    { label:'Sotto soglia', value:sottoSoglia, icon:'⚠️', color:sottoSoglia>0?C.red:C.green },
    { label:'Esauriti', value:esauriti, icon:'❌', color:esauriti>0?C.red:C.green },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 }}>
        {kpis.map(({label,value,icon,color})=>(
          <div key={label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
            <div style={{ fontSize:20, fontWeight:700, color }}>{value}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ ...labelStyle, marginBottom:14 }}>Valore per categoria</div>
          {perCategoria.length===0 ? <div style={{ color:C.muted, fontSize:13 }}>Aggiungi categorie agli articoli</div>
          : perCategoria.map(({cat,count,valore})=>(
            <div key={cat} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12, color:C.text }}>{cat}</span>
                <span style={{ fontSize:11, color:C.muted }}>{count} · €{valore.toFixed(0)}</span>
              </div>
              <div style={{ height:5, background:C.border, borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(valore/maxV)*100}%`, background:C.accent, borderRadius:3 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ ...labelStyle, marginBottom:14 }}>Top 5 per valore</div>
          {top5.length===0 ? <div style={{ color:C.muted, fontSize:13 }}>Aggiungi prezzi agli articoli</div>
          : top5.map((a,i)=>(
            <div key={a.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontSize:12, color:C.muted, width:18, flexShrink:0 }}>#{i+1}</span>
              {a.foto_url && <img src={a.foto_url} alt="" style={{ width:30, height:30, borderRadius:4, objectFit:'cover', flexShrink:0 }} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nome}</div>
                <div style={{ fontSize:11, color:C.muted }}>{a.quantita} pz</div>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:C.green, flexShrink:0 }}>€{(a.quantita*(a.prezzo_vendita||0)).toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {perForn.length>0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ ...labelStyle, marginBottom:12 }}>Per fornitore (valore acquisto)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:8 }}>
            {perForn.map(({nome,count,valore})=>(
              <div key={nome} style={{ background:C.surfaceHi, borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{nome}</div>
                <div style={{ fontSize:11, color:C.muted }}>{count} articoli</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.orange, marginTop:4 }}>€{valore.toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={()=>exportCSV(articoli,fornitori)} style={btnSecondary}>📥 Esporta CSV per commercialista</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB INVENTARIO
// ═══════════════════════════════════════════════════════════════════
function TabInventario({ articoli, fornitori, zone, onReload }: { articoli:Articolo[]; fornitori:Fornitore[]; zone:Zona[]; onReload:()=>void }) {
  const [cerca, setCerca] = useState('')
  const [selected, setSelected] = useState<Articolo|null>(null)
  const [qrArticolo, setQrArticolo] = useState<Articolo|null>(null)

  const filtrati = articoli.filter(a=>
    a.nome.toLowerCase().includes(cerca.toLowerCase()) ||
    a.codice?.toLowerCase().includes(cerca.toLowerCase()) ||
    a.categoria?.toLowerCase().includes(cerca.toLowerCase())
  )

  if (selected) return <ArticoloDetail item={selected} fornitori={fornitori} zone={zone} onClose={()=>setSelected(null)} onReload={()=>{ onReload(); setSelected(null) }} />

  return (
    <div>
      <input placeholder="Cerca per nome, codice, categoria..." value={cerca} onChange={e=>setCerca(e.target.value)} style={{ ...inp, marginBottom:14, maxWidth:400 }} />
      {filtrati.length===0 ? (
        <div style={{ textAlign:'center', color:C.muted, padding:60, fontSize:14 }}>
          {articoli.length===0 ? 'Nessun articolo. Vai su "+ Aggiungi" per iniziare.' : 'Nessun risultato.'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          {filtrati.map(a=>(
            <div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >
              <div onClick={()=>setSelected(a)} style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor:'pointer' }}>
                {a.foto_url && <img src={a.foto_url} alt="" style={{ width:40, height:40, borderRadius:4, objectFit:'cover', flexShrink:0 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{a.nome}</div>
                  <div style={{ fontSize:11, color:C.muted, display:'flex', gap:8, flexWrap:'wrap' }}>
                    {a.categoria && <span>{a.categoria}</span>}
                    {a.codice && <span>#{a.codice}</span>}
                    {(a as any).fornitori?.nome && <span>{(a as any).fornitori.nome}</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <span style={badge(a.quantita,a.soglia_riordino)}>{a.quantita} pz {a.quantita<=a.soglia_riordino?'⚠':''}</span>
                  {a.prezzo_vendita ? <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>€{Number(a.prezzo_vendita).toFixed(2)}</div> : null}
                </div>
                <span style={{ color:C.dim, fontSize:18 }}>›</span>
              </div>
              <button onClick={e=>{ e.stopPropagation(); setQrArticolo(a) }} style={{ padding:'4px 9px', background:C.accentSoft, color:C.accent, border:`1px solid #2a4a7f`, borderRadius:5, fontSize:11, cursor:'pointer', flexShrink:0 }}>📱</button>
            </div>
          ))}
        </div>
      )}
      {qrArticolo && <QRModal articolo={qrArticolo} onClose={()=>setQrArticolo(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ARTICOLO DETAIL + EDIT (con log movimenti)
// ═══════════════════════════════════════════════════════════════════
function ArticoloDetail({ item, fornitori, zone, onClose, onReload }: { item:Articolo; fornitori:Fornitore[]; zone:Zona[]; onClose:()=>void; onReload:()=>void }) {
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome:item.nome||'', codice:item.codice||'', categoria:item.categoria||'', descrizione:item.descrizione||'', utilizzo:item.utilizzo||'',
    posizione:item.posizione||'', zona_id:item.zona_id||'', fornitore_id:item.fornitore_id||'',
    prezzo_acquisto:item.prezzo_acquisto?.toString()||'', prezzo_vendita:item.prezzo_vendita?.toString()||'',
    quantita:item.quantita?.toString()||'0', soglia_riordino:item.soglia_riordino?.toString()||'1', note:item.note||'',
  })
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  const salva = async () => {
    if (!form.nome) return
    setSaving(true)
    const nuovaQty = Number(form.quantita)
    const { error } = await supabase.from('articoli').update(sanitize(form)).eq('id',item.id)
    if (error) { alert(`Errore: ${error.message}`); setSaving(false); return }
    if (nuovaQty !== item.quantita) {
      const diff = nuovaQty - item.quantita
      await supabase.from('movimenti').insert({ articolo_id:item.id, tipo:diff>0?'entrata':'uscita', quantita:Math.abs(diff), quantita_precedente:item.quantita, quantita_dopo:nuovaQty, note:'Modifica manuale' })
    }
    setSaving(false); onReload()
  }

  const elimina = async () => {
    if (!confirm(`Eliminare "${item.nome}"?`)) return
    await supabase.from('articoli').delete().eq('id',item.id); onReload()
  }

  const margine = item.prezzo_acquisto && item.prezzo_vendita && item.prezzo_acquisto>0 ? (((item.prezzo_vendita-item.prezzo_acquisto)/item.prezzo_acquisto)*100).toFixed(1) : null

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button onClick={onClose} style={{ ...btnSecondary, padding:'7px 12px' }}>← Indietro</button>
        <h2 style={{ margin:0, fontSize:15, fontWeight:700, flex:1 }}>{item.nome}</h2>
        {!editMode && <button onClick={()=>setEditMode(true)} style={btnPrimary}>✏ Modifica</button>}
      </div>

      <div style={{ display:'flex', gap:18, flexWrap:'wrap' }}>
        {item.foto_url && <img src={item.foto_url} alt={item.nome} style={{ width:160, height:160, objectFit:'cover', borderRadius:8, border:`1px solid ${C.border}`, flexShrink:0 }} />}
        <div style={{ flex:1, minWidth:280 }}>
          {editMode ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', gap:8 }}>
                <Field label="Nome *" flex={3}><input value={form.nome} onChange={e=>set('nome',e.target.value)} style={inp} /></Field>
                <Field label="Codice" flex={1}><input value={form.codice} onChange={e=>set('codice',e.target.value)} style={inp} /></Field>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <Field label="Categoria">
                  <select value={form.categoria} onChange={e=>set('categoria',e.target.value)} style={sel}>
                    <option value="">— Scegli —</option>
                    {CATEGORIE.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fornitore">
                  <select value={form.fornitore_id} onChange={e=>set('fornitore_id',e.target.value)} style={sel}>
                    <option value="">— Nessuno —</option>
                    {fornitori.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Zona"><ZoneSelect value={form.zona_id} onChange={v=>set('zona_id',v)} zone={zone} /></Field>
              <Field label="Posizione"><input value={form.posizione} onChange={e=>set('posizione',e.target.value)} style={inp} /></Field>
              <Field label="Descrizione"><input value={form.descrizione} onChange={e=>set('descrizione',e.target.value)} style={inp} /></Field>
              <Field label="Utilizzo"><input value={form.utilizzo} onChange={e=>set('utilizzo',e.target.value)} style={inp} /></Field>
              <div style={{ display:'flex', gap:8 }}>
                {[['Quantità','quantita','0','1'],['Soglia','soglia_riordino','1','1'],['€ Acq.','prezzo_acquisto','0','0.01'],['€ Vend.','prezzo_vendita','0','0.01']].map(([l,k,p,s])=>(
                  <Field key={k} label={l}><input type="number" step={s} min="0" value={form[k as keyof typeof form]} onChange={e=>set(k,e.target.value)} placeholder={p} style={inp} /></Field>
                ))}
              </div>
              <Field label="Note"><textarea value={form.note} onChange={e=>set('note',e.target.value)} rows={2} style={{ ...inp, resize:'vertical' }} /></Field>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={salva} disabled={saving||!form.nome} style={{ ...btnPrimary, opacity: saving||!form.nome ? 0.6 : 1, display:'flex', alignItems:'center', gap:8 }}>
                  {saving?<><Spinner /> Salvo...</>:'✓ Salva'}
                </button>
                <button onClick={()=>setEditMode(false)} style={btnSecondary}>Annulla</button>
                <button onClick={elimina} style={{ ...btnSecondary, color:C.red, borderColor:C.red+'44', marginLeft:'auto' }}>🗑</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  ['Categoria', item.categoria&&<Tag label={item.categoria}/>],
                  ['Codice', item.codice],
                  ['Fornitore', (item as any).fornitori?.nome],
                  ['Zona', (item as any).zona_path||(item as any).zona_nome],
                  ['Posizione', item.posizione],
                  ['Descrizione', item.descrizione],
                  ['Utilizzo', item.utilizzo],
                  ['€ Acquisto', item.prezzo_acquisto?`€ ${Number(item.prezzo_acquisto).toFixed(2)}`:null],
                  ['€ Vendita', item.prezzo_vendita?`€ ${Number(item.prezzo_vendita).toFixed(2)}`:null],
                  ['Margine', margine?`${margine}%`:null],
                  ['Note', item.note],
                ].filter(([,v])=>v).map(([label,val])=>(
                  <div key={String(label)}><div style={labelStyle}>{label}</div><div style={{ fontSize:13 }}>{val}</div></div>
                ))}
              </div>
              <div style={{ background:C.surfaceHi, border:`1px solid ${C.border}`, borderRadius:6, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div><div style={labelStyle}>Stock attuale</div><span style={badge(item.quantita,item.soglia_riordino)}>{item.quantita} pz — {item.quantita<=item.soglia_riordino?'⚠ Sotto soglia':'OK'}</span></div>
                <div style={{ textAlign:'right' }}><div style={labelStyle}>Soglia</div><span style={{ fontSize:13 }}>{item.soglia_riordino} pz</span></div>
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
function TabAggiungi({ fornitori, zone, initialCodice, onSaved }: { fornitori:Fornitore[]; zone:Zona[]; initialCodice:string; onSaved:()=>void }) {
  const [foto, setFoto] = useState<string|null>(null)
  const [fotoB64, setFotoB64] = useState<string|null>(null)
  const [mediaType, setMediaType] = useState('image/jpeg')
  const [analizzando, setAnalizzando] = useState(false)
  const [aiNote, setAiNote] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ nome:'', codice:initialCodice, categoria:'', descrizione:'', utilizzo:'', zona_id:'', posizione:'', fornitore_id:'', prezzo_acquisto:'', prezzo_vendita:'', quantita:'0', soglia_riordino:'1', note:'' })
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  useEffect(()=>{ if (initialCodice) set('codice', initialCodice) },[initialCodice])

  const handleFile = (file:File) => {
    if (!file?.type.startsWith('image/')) return
    setMediaType(file.type); setFoto(URL.createObjectURL(file))
    const r = new FileReader(); r.onload=e=>setFotoB64((e.target?.result as string).split(',')[1]); r.readAsDataURL(file)
    setAiNote(null)
  }

  const analizza = async () => {
    if (!fotoB64) return; setAnalizzando(true)
    try {
      const res = await fetch('/api/analyze',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ image_base64:fotoB64, media_type:mediaType }) })
      const p = await res.json()
      if (p.error) setAiNote('errore')
      else { setForm(f=>({...f, nome:p.nome||f.nome, categoria:p.categoria||f.categoria, descrizione:p.descrizione||f.descrizione, utilizzo:p.utilizzo||f.utilizzo })); setAiNote(p.confidenza||'bassa') }
    } catch { setAiNote('errore') }
    setAnalizzando(false)
  }

  const salva = async () => {
    if (!form.nome) return; setSaving(true)
    const { error } = await supabase.from('articoli').insert({ ...sanitize(form), foto_url:fotoB64?`data:${mediaType};base64,${fotoB64}`:null })
    if (error) { alert(`Errore: ${error.message}`); setSaving(false); return }
    setForm({ nome:'', codice:'', categoria:'', descrizione:'', utilizzo:'', zona_id:'', posizione:'', fornitore_id:'', prezzo_acquisto:'', prezzo_vendita:'', quantita:'0', soglia_riordino:'1', note:'' })
    setFoto(null); setFotoB64(null); setAiNote(null); setSaving(false); onSaved()
  }

  return (
    <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
      <div style={{ width:200, flexShrink:0 }}>
        <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f) }}
          style={{ width:200, height:200, border:`2px dashed ${C.border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', background:C.surface }}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
        >
          {foto?<img src={foto} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          :<div style={{ textAlign:'center', color:C.muted, fontSize:12 }}><div style={{ fontSize:28, marginBottom:8 }}>📷</div>Clicca o trascina</div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFile(f) }} />
        {foto && <button onClick={analizza} disabled={analizzando} style={{ ...btnPrimary, width:'100%', marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>{analizzando?<><Spinner/> Analisi...</>:'⚡ Analizza AI'}</button>}
        {aiNote && <div style={{ marginTop:6, padding:'5px 8px', borderRadius:5, fontSize:11, textAlign:'center', background:aiNote==='errore'?'#3d1515':C.accentSoft, color:aiNote==='errore'?C.red:C.accent }}>{aiNote==='errore'?'⚠ Errore':`✓ AI: ${aiNote}`}</div>}
      </div>

      <div style={{ flex:1, minWidth:280, display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', gap:8 }}>
          <Field label="Nome *" flex={3}><input value={form.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome articolo..." style={inp} /></Field>
          <Field label="Codice" flex={1}><input value={form.codice} onChange={e=>set('codice',e.target.value)} placeholder="SKU..." style={inp} /></Field>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Field label="Categoria"><select value={form.categoria} onChange={e=>set('categoria',e.target.value)} style={sel}><option value="">— Scegli —</option>{CATEGORIE.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Fornitore"><select value={form.fornitore_id} onChange={e=>set('fornitore_id',e.target.value)} style={sel}><option value="">— Nessuno —</option>{fornitori.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></Field>
        </div>
        <Field label="Zona"><ZoneSelect value={form.zona_id} onChange={v=>set('zona_id',v)} zone={zone} /></Field>
        <Field label="Posizione"><input value={form.posizione} onChange={e=>set('posizione',e.target.value)} placeholder="es. ripiano 2..." style={inp} /></Field>
        <Field label="Descrizione"><input value={form.descrizione} onChange={e=>set('descrizione',e.target.value)} placeholder="Materiale, dimensioni..." style={inp} /></Field>
        <Field label="Utilizzo"><input value={form.utilizzo} onChange={e=>set('utilizzo',e.target.value)} placeholder="Contesto di utilizzo..." style={inp} /></Field>
        <div style={{ display:'flex', gap:8 }}>
          {[['Quantità','quantita','0','1'],['Soglia','soglia_riordino','1','1'],['€ Acquisto','prezzo_acquisto','0.00','0.01'],['€ Vendita','prezzo_vendita','0.00','0.01']].map(([l,k,p,s])=>(
            <Field key={k} label={l}><input type="number" step={s} min="0" value={form[k as keyof typeof form]} onChange={e=>set(k,e.target.value)} placeholder={p} style={inp} /></Field>
          ))}
        </div>
        <Field label="Note"><input value={form.note} onChange={e=>set('note',e.target.value)} placeholder="Note aggiuntive..." style={inp} /></Field>
        <button onClick={salva} disabled={!form.nome||saving} style={{ ...btnPrimary, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity: !form.nome||saving ? 0.6 : 1, cursor: !form.nome ? 'not-allowed' : 'pointer' }}>
          {saving?<><Spinner/> Salvataggio...</>:'✓ Salva nel database'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB FORNITORI
// ═══════════════════════════════════════════════════════════════════
function TabFornitori({ fornitori, onReload }: { fornitori:Fornitore[]; onReload:()=>void }) {
  const [form, setForm] = useState({ nome:'', telefono:'', email:'', indirizzo:'', note:'' })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  const salva = async () => {
    if (!form.nome) return; setSaving(true)
    await supabase.from('fornitori').insert(form)
    setForm({ nome:'', telefono:'', email:'', indirizzo:'', note:'' }); setSaving(false); onReload()
  }

  const elimina = async (id:string) => {
    if (!confirm('Eliminare?')) return
    await supabase.from('fornitori').delete().eq('id',id); onReload()
  }

  return (
    <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
      <div style={{ flex:1, minWidth:280 }}>
        <div style={labelStyle}>FORNITORI ({fornitori.length})</div>
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:1 }}>
          {fornitori.length===0 ? <div style={{ color:C.muted, fontSize:13, padding:'16px 0' }}>Nessun fornitore ancora.</div>
          : fornitori.map(f=>(
            <div key={f.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600 }}>{f.nome}</div>
                {f.telefono && <div style={{ fontSize:11, color:C.muted }}>📞 {f.telefono}</div>}
                {f.email && <div style={{ fontSize:11, color:C.muted }}>✉ {f.email}</div>}
              </div>
              <button onClick={()=>elimina(f.id)} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:16 }}>🗑</button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width:280, flexShrink:0 }}>
        <div style={labelStyle}>NUOVO FORNITORE</div>
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
          {[['Nome *','nome','Ragione sociale...','text'],['Telefono','telefono','','tel'],['Email','email','','email'],['Indirizzo','indirizzo','','text'],['Note','note','','text']].map(([l,k,p,t])=>(
            <Field key={k} label={l}><input type={t} value={form[k as keyof typeof form]} onChange={e=>set(k,e.target.value)} placeholder={p} style={inp} /></Field>
          ))}
          <button onClick={salva} disabled={!form.nome||saving} style={{ ...btnPrimary, opacity: !form.nome||saving ? 0.6 : 1 }}>{saving?'Salvo...':'+ Aggiungi fornitore'}</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB CLIENTI
// ═══════════════════════════════════════════════════════════════════
function TabClienti({ clienti, onReload }: { clienti:Cliente[]; onReload:()=>void }) {
  const [form, setForm] = useState({ nome:'', telefono:'', email:'', indirizzo:'', note:'' })
  const [saving, setSaving] = useState(false)
  const [cerca, setCerca] = useState('')
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  const salva = async () => {
    if (!form.nome) return; setSaving(true)
    await supabase.from('clienti').insert(form)
    setForm({ nome:'', telefono:'', email:'', indirizzo:'', note:'' }); setSaving(false); onReload()
  }

  const elimina = async (id:string) => {
    if (!confirm('Eliminare questo cliente?')) return
    await supabase.from('clienti').delete().eq('id',id); onReload()
  }

  const filtrati = clienti.filter(c=>c.nome.toLowerCase().includes(cerca.toLowerCase()) || c.telefono?.includes(cerca))

  return (
    <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
      <div style={{ flex:1, minWidth:280 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={labelStyle}>CLIENTI ({clienti.length})</span>
        </div>
        <input placeholder="Cerca per nome o telefono..." value={cerca} onChange={e=>setCerca(e.target.value)} style={{ ...inp, marginBottom:10 }} />
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          {filtrati.length===0 ? <div style={{ color:C.muted, fontSize:13, padding:'16px 0' }}>{clienti.length===0?'Nessun cliente ancora.':'Nessun risultato.'}</div>
          : filtrati.map(c=>(
            <div key={c.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>{c.nome}</div>
                <div style={{ display:'flex', gap:12, marginTop:3 }}>
                  {c.telefono && <a href={`tel:${c.telefono}`} style={{ fontSize:12, color:C.accent, textDecoration:'none' }}>📞 {c.telefono}</a>}
                  {c.email && <a href={`mailto:${c.email}`} style={{ fontSize:12, color:C.accent, textDecoration:'none' }}>✉ {c.email}</a>}
                </div>
                {c.indirizzo && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>📍 {c.indirizzo}</div>}
                {c.note && <div style={{ fontSize:11, color:C.muted, marginTop:2, fontStyle:'italic' }}>{c.note}</div>}
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                {c.telefono && (
                  <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding:'3px 8px', background:'#0f2d1f', color:'#22c55e', border:'1px solid #22c55e44', borderRadius:4, fontSize:11, textDecoration:'none', fontWeight:600 }}
                    onClick={e=>e.stopPropagation()}
                  >💬 WA</a>
                )}
                <button onClick={()=>elimina(c.id)} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:14 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width:280, flexShrink:0 }}>
        <div style={labelStyle}>NUOVO CLIENTE</div>
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
          {[['Nome *','nome','Mario Rossi','text'],['Telefono','telefono','+39 333...','tel'],['Email','email','','email'],['Indirizzo','indirizzo','Via...','text'],['Note','note','Preferenze, cantiere...','text']].map(([l,k,p,t])=>(
            <Field key={k} label={l}><input type={t} value={form[k as keyof typeof form]} onChange={e=>set(k,e.target.value)} placeholder={p} style={inp} /></Field>
          ))}
          <button onClick={salva} disabled={!form.nome||saving} style={{ ...btnPrimary, opacity: !form.nome||saving ? 0.6 : 1 }}>{saving?'Salvo...':'+ Aggiungi cliente'}</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB ALERT
// ═══════════════════════════════════════════════════════════════════
function TabAlert({ articoli }: { articoli:Articolo[] }) {
  const critici = articoli.filter(a=>a.quantita<=a.soglia_riordino)
  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <span style={labelStyle}>ARTICOLI SOTTO SOGLIA</span>
        {critici.length>0 && <span style={{ marginLeft:10, background:C.red+'22', color:C.red, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:3 }}>{critici.length} articoli</span>}
      </div>
      {critici.length===0 ? (
        <div style={{ textAlign:'center', color:C.muted, padding:60 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
          Tutti gli articoli sono sopra la soglia di riordino.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          {critici.map(a=>(
            <div key={a.id} style={{ background:'#1a1010', border:`1px solid ${C.red}33`, borderRadius:6, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{a.nome}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{a.categoria}{(a as any).fornitori?.nome?` · ${(a as any).fornitori.nome}`:''}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ color:C.red, fontWeight:700, fontSize:14 }}>{a.quantita} pz</div>
                <div style={{ color:C.muted, fontSize:11 }}>soglia: {a.soglia_riordino}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
