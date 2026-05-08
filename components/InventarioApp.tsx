'use client'
import { QRModal } from './QRModal'
import { BarcodeScanner } from './BarcodeScanner'
import { useEffect, useRef, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Fornitore = { id: string; nome: string; telefono?: string; email?: string; indirizzo?: string; note?: string }
type Zona = { id: string; codice: string; nome: string; tipo: string; parent_id: string | null; ordine: number; livello: number; path_codice: string; path_nome: string; sort_key: string }
type Articolo = { id: string; nome: string; codice?: string; categoria?: string; descrizione?: string; utilizzo?: string; posizione?: string; zona_id?: string; foto_url?: string; prezzo_acquisto?: number; prezzo_vendita?: number; quantita: number; soglia_riordino: number; fornitore_id?: string; note?: string; fornitori?: Fornitore | null; zona_codice?: string; zona_nome?: string; zona_path?: string }
type Cliente = { id: string; nome: string; telefono?: string; email?: string; indirizzo?: string; note?: string; created_at?: string }

// ─── Nuovi tipi vendite ───
type Vendita = { id: string; numero: number; data: string; cliente_id: string|null; cliente_nome: string|null; totale: number; metodo_pagamento: string|null; note: string|null; esportata_fic: boolean; created_at: string; vendite_righe?: VenditaRiga[] }
type VenditaRiga = { id: string; vendita_id: string; articolo_id: string|null; articolo_nome: string; articolo_codice: string|null; quantita: number; prezzo_unitario: number; prezzo_acquisto_snapshot: number|null; totale_riga: number }
type CarrelloItem = { articolo_id: string; nome: string; codice: string|null; quantita: number; prezzo_unitario: number; prezzo_acquisto: number; quantita_disponibile: number }
type Spesa = { id: string; data: string; categoria: string; descrizione: string|null; importo: number; ricorrente: boolean; frequenza: string|null; pagato: boolean; note: string|null; created_at: string }

const CATEGORIE_SPESE = ['INPS / Contributi','TARI / Rifiuti','Condominio','IMU / Tasse immobile','Luce / Gas / Acqua','Internet / Telefono','Commercialista','Assicurazioni','Manutenzione immobile','Forniture ufficio','Pubblicità','Altro']
type ArticoloStats = { id: string; nome: string; categoria: string|null; fornitore_id: string|null; quantita_attuale: number; soglia_riordino: number; venduto_30gg: number; venduto_7gg: number; fatturato_30gg: number; ultima_vendita: string|null; status_vendita: 'attivo'|'lento'|'morto'|'mai_venduto'|'nuovo'; velocita_giornaliera: number; giorni_scorta_stimati: number|null; prezzo_acquisto: number|null; prezzo_vendita: number|null }
type VenditaGiorno = { giorno: string; numero_vendite: number; fatturato: number; costo_merci: number; margine_lordo: number }

const CATEGORIE = ['Raccordi','Valvole','Tubi e Tubazioni','Guarnizioni e O-ring','Pompe','Filtri','Manometri e Strumenti','Rubinetteria','Giunti','Accessori','Altro']
const METODI_PAGAMENTO: Array<{val:'contanti'|'carta'|'bonifico'|'altro'; label:string; icon:string}> = [
  { val:'contanti', label:'Contanti', icon:'💶' },
  { val:'carta', label:'Carta', icon:'💳' },
  { val:'bonifico', label:'Bonifico', icon:'🏦' },
  { val:'altro', label:'Altro', icon:'•' },
]

const C = { bg:'#0f0f0f', surface:'#1a1a1a', surfaceHi:'#222', border:'#2a2a2a', text:'#e8e8e8', muted:'#888', dim:'#444', accent:'#3b82f6', accentSoft:'#1e3a5f', red:'#ef4444', green:'#22c55e', orange:'#f97316', purple:'#a855f7' }

const inp: React.CSSProperties = { width:'100%', padding:'9px 11px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:5, color:C.text, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
const sel: React.CSSProperties = { ...inp, cursor:'pointer' }
const btnPrimary: React.CSSProperties = { padding:'10px 18px', background:C.accent, color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' }
const btnSecondary: React.CSSProperties = { padding:'10px 16px', background:'none', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12, cursor:'pointer', fontFamily:'inherit' }
const btnSuccess: React.CSSProperties = { ...btnPrimary, background:C.green }
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

// Export vendite per Fatture in Cloud
function exportVenditeCSV(vendite: Vendita[], dal: string, al: string) {
  const headers = ['Numero','Data','Cliente','Articolo','Codice','Quantità','Prezzo Unit.','Totale Riga','Metodo Pagamento','Totale Vendita','Note']
  const rows: string[][] = []
  vendite.forEach(v => {
    if (!v.vendite_righe || v.vendite_righe.length===0) {
      rows.push([String(v.numero), new Date(v.data).toLocaleDateString('it-IT'), v.cliente_nome||'', '', '', '', '', '', v.metodo_pagamento||'', v.totale.toFixed(2), v.note||''])
    } else {
      v.vendite_righe.forEach((r, i) => rows.push([
        String(v.numero), new Date(v.data).toLocaleDateString('it-IT'), v.cliente_nome||'',
        r.articolo_nome, r.articolo_codice||'', String(r.quantita),
        r.prezzo_unitario.toFixed(2), r.totale_riga.toFixed(2),
        i===0?(v.metodo_pagamento||''):'', i===0?v.totale.toFixed(2):'', i===0?(v.note||''):'',
      ]))
    }
  })
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href=url; el.download=`vendite_${dal}_${al}.csv`; el.click()
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
  const [tab, setTab] = useState<'dashboard'|'inventario'|'vendita'|'storico'|'spese'|'aggiungi'|'fornitori'|'clienti'|'alert'>('inventario')
  const [articoli, setArticoli] = useState<Articolo[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [zone, setZone] = useState<Zona[]>([])
  const [vendite, setVendite] = useState<Vendita[]>([])
  const [spese, setSpese] = useState<Spesa[]>([])
  const [stats, setStats] = useState<ArticoloStats[]>([])
  const [trend, setTrend] = useState<VenditaGiorno[]>([])
  const [loading, setLoading] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanResult, setScanResult] = useState<{found: boolean; articolo?: Articolo; codice?: string} | null>(null)
  const [initialCodice, setInitialCodice] = useState('')

  const carica = async () => {
    setLoading(true)
    const [
      { data: arts }, { data: forn }, { data: zon }, { data: cli },
      { data: vend }, { data: sp }, { data: st }, { data: tr },
    ] = await Promise.all([
      supabase.from('articoli').select('*, fornitori(*)').order('nome'),
      supabase.from('fornitori').select('*').order('nome'),
      supabase.from('zone_albero').select('*').order('sort_key'),
      supabase.from('clienti').select('*').order('nome'),
      supabase.from('vendite').select('*, vendite_righe(*)').order('data', { ascending:false }).limit(500),
      supabase.from('spese').select('*').order('data', { ascending:false }),
      supabase.from('articoli_stats').select('*'),
      supabase.from('vendite_per_giorno').select('*').limit(60),
    ])
    setArticoli(arts||[]); setFornitori(forn||[]); setZone(zon||[]); setClienti(cli||[])
    setVendite(vend||[]); setSpese(sp||[]); setStats(st||[]); setTrend(tr||[])
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
    { id:'vendita', label:'💰 Vendita' },
    { id:'storico', label:`📋 Storico (${vendite.length})` },
    { id:'spese', label:`💸 Spese` },
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
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
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
        {tab==='dashboard' && <TabDashboard articoli={articoli} fornitori={fornitori} stats={stats} trend={trend} vendite={vendite} spese={spese} />}
        {tab==='inventario' && <TabInventario articoli={articoli} fornitori={fornitori} zone={zone} onReload={carica} />}
        {tab==='vendita' && <TabVendita articoli={articoli} clienti={clienti} onSold={carica} />}
        {tab==='storico' && <TabStorico vendite={vendite} clienti={clienti} onReload={carica} />}
        {tab==='spese' && <TabSpese spese={spese} onReload={carica} />}
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
// TAB DASHBOARD POTENZIATA (con analytics vendite)
// ═══════════════════════════════════════════════════════════════════
function TabDashboard({ articoli, fornitori, stats, trend, vendite, spese }: { articoli:Articolo[]; fornitori:Fornitore[]; stats:ArticoloStats[]; trend:VenditaGiorno[]; vendite:Vendita[]; spese:Spesa[] }) {
  // Magazzino
  const va = articoli.reduce((s,a)=>s+a.quantita*(a.prezzo_acquisto||0),0)
  const vv = articoli.reduce((s,a)=>s+a.quantita*(a.prezzo_vendita||0),0)
  const margineMagazzino = va>0?((vv-va)/va*100):0
  const sottoSoglia = articoli.filter(a=>a.quantita<=a.soglia_riordino).length
  const esauriti = articoli.filter(a=>a.quantita===0).length

  // Vendite (calcolate dai dati delle vendite caricate)
  const oggi = new Date(); oggi.setHours(0,0,0,0)
  const settimanaFa = new Date(); settimanaFa.setDate(settimanaFa.getDate()-7); settimanaFa.setHours(0,0,0,0)
  const meseFa = new Date(); meseFa.setDate(meseFa.getDate()-30); meseFa.setHours(0,0,0,0)

  const venditeOggi = vendite.filter(v=>new Date(v.data)>=oggi)
  const venditeSettimana = vendite.filter(v=>new Date(v.data)>=settimanaFa)
  const venditeMese = vendite.filter(v=>new Date(v.data)>=meseFa)

  const fattOggi = venditeOggi.reduce((s,v)=>s+Number(v.totale),0)
  const fattSett = venditeSettimana.reduce((s,v)=>s+Number(v.totale),0)
  const fattMese = venditeMese.reduce((s,v)=>s+Number(v.totale),0)

  // Margine reale ultimi 30gg
  const margineReale = trend.filter(t=>new Date(t.giorno)>=meseFa).reduce((s,t)=>s+Number(t.margine_lordo),0)
  const costoMese = trend.filter(t=>new Date(t.giorno)>=meseFa).reduce((s,t)=>s+Number(t.costo_merci),0)
  const margineRealePerc = costoMese>0?(margineReale/costoMese*100):0

  // Top venduti 30gg
  const topVenduti = [...stats].filter(s=>s.venduto_30gg>0).sort((a,b)=>b.fatturato_30gg-a.fatturato_30gg).slice(0,5)

  // Articoli morti / mai venduti / lenti
  const morti = stats.filter(s=>s.status_vendita==='morto'||s.status_vendita==='mai_venduto').slice(0,8)

  // Articoli che stanno per finire (basato su velocità vendita)
  const finiranno = [...stats].filter(s=>s.giorni_scorta_stimati!==null && s.giorni_scorta_stimati<14 && s.quantita_attuale>0).sort((a,b)=>(a.giorni_scorta_stimati||0)-(b.giorni_scorta_stimati||0)).slice(0,5)

  // Per categoria & fornitore (esistente)
  const perCategoria = CATEGORIE.map(cat=>({ cat, count:articoli.filter(a=>a.categoria===cat).length, valore:articoli.filter(a=>a.categoria===cat).reduce((s,a)=>s+a.quantita*(a.prezzo_vendita||0),0) })).filter(c=>c.count>0).sort((a,b)=>b.valore-a.valore)
  const maxV = Math.max(...perCategoria.map(c=>c.valore),1)
  const perForn = fornitori.map(f=>({ nome:f.nome, count:articoli.filter(a=>a.fornitore_id===f.id).length, valore:articoli.filter(a=>a.fornitore_id===f.id).reduce((s,a)=>s+a.quantita*(a.prezzo_acquisto||0),0) })).filter(f=>f.count>0).sort((a,b)=>b.valore-a.valore)

  const haVendite = vendite.length>0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* SEZIONE 1: VENDITE */}
      <div>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:12 }}>
          <h2 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.1em' }}>📈 Vendite</h2>
          {!haVendite && <span style={{ fontSize:11, color:C.muted }}>— ancora nessuna vendita registrata</span>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 }}>
          <KpiCard icon="🌅" label="Oggi" value={`€ ${fattOggi.toFixed(0)}`} sub={`${venditeOggi.length} vendite`} color={C.green} />
          <KpiCard icon="📅" label="Ultimi 7 giorni" value={`€ ${fattSett.toFixed(0)}`} sub={`${venditeSettimana.length} vendite`} color={C.accent} />
          <KpiCard icon="🗓️" label="Ultimi 30 giorni" value={`€ ${fattMese.toFixed(0)}`} sub={`${venditeMese.length} vendite`} color={C.purple} />
          <KpiCard icon="💎" label="Margine reale 30gg" value={`€ ${margineReale.toFixed(0)}`} sub={`${margineRealePerc.toFixed(1)}% sul costo`} color={C.orange} />
        </div>

        {/* Grafico trend */}
        {trend.length>0 && <TrendChart trend={trend} giorni={30} />}
      </div>

      {/* SEZIONE 2: TOP VENDITORI / IN ESAURIMENTO / MORTI */}
      {haVendite && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
            <div style={{ ...labelStyle, marginBottom:14 }}>🏆 Top venditori (30gg)</div>
            {topVenduti.length===0 ? <div style={{ color:C.muted, fontSize:13 }}>Nessun dato disponibile</div>
            : topVenduti.map((s,i)=>(
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, paddingBottom:10, borderBottom:i<topVenduti.length-1?`1px solid ${C.border}`:'none' }}>
                <span style={{ fontSize:11, color:C.muted, width:20 }}>#{i+1}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nome}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.venduto_30gg} pz · {s.velocita_giornaliera}/gg</div>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:C.green }}>€{Number(s.fatturato_30gg).toFixed(0)}</span>
              </div>
            ))}
          </div>

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
            <div style={{ ...labelStyle, marginBottom:14 }}>⏰ Stanno per finire</div>
            {finiranno.length===0 ? <div style={{ color:C.muted, fontSize:13 }}>Tutto sotto controllo ✓</div>
            : finiranno.map((s,i)=>(
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, paddingBottom:10, borderBottom:i<finiranno.length-1?`1px solid ${C.border}`:'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nome}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.quantita_attuale} pz · velocità {s.velocita_giornaliera}/gg</div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:s.giorni_scorta_stimati!&&s.giorni_scorta_stimati<7?C.red:C.orange, background:s.giorni_scorta_stimati!&&s.giorni_scorta_stimati<7?'#3d1515':'#3d2415', padding:'3px 8px', borderRadius:3 }}>~{s.giorni_scorta_stimati}gg</span>
              </div>
            ))}
          </div>

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
            <div style={{ ...labelStyle, marginBottom:14 }}>💀 Articoli morti</div>
            {morti.length===0 ? <div style={{ color:C.muted, fontSize:13 }}>Nessun articolo stagnante</div>
            : <>
              <div style={{ fontSize:11, color:C.muted, marginBottom:12, lineHeight:1.5 }}>Mai venduti o fermi da 60+ giorni. Capitale bloccato: <strong style={{color:C.red}}>€{morti.reduce((s,m)=>s+m.quantita_attuale*(m.prezzo_acquisto||0),0).toFixed(0)}</strong></div>
              {morti.slice(0,5).map((s,i)=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:C.muted }}>{s.nome}</div>
                  </div>
                  <span style={{ fontSize:11, color:C.dim }}>{s.quantita_attuale} pz · €{(s.quantita_attuale*(s.prezzo_acquisto||0)).toFixed(0)}</span>
                </div>
              ))}
              {morti.length>5 && <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>+{morti.length-5} altri</div>}
            </>}
          </div>
        </div>
      )}

      {/* SEZIONE 3: P&L - Conto Economico semplificato */}
      {(haVendite || spese.length>0) && (() => {
        const speseAnno = spese.filter(s=>new Date(s.data).getFullYear()===new Date().getFullYear() && s.pagato).reduce((sum,s)=>sum+Number(s.importo),0)
        const fattAnno = vendite.filter(v=>new Date(v.data).getFullYear()===new Date().getFullYear()).reduce((s,v)=>s+Number(v.totale),0)
        const costoAnno = trend.filter(t=>new Date(t.giorno).getFullYear()===new Date().getFullYear()).reduce((s,t)=>s+Number(t.costo_merci),0)
        const margineAnno = fattAnno - costoAnno
        const risultatoAnno = margineAnno - speseAnno
        return (
          <div>
            <h2 style={{ margin:'0 0 12px', fontSize:13, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.1em' }}>📑 P&L {new Date().getFullYear()} (anno corrente)</h2>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {[
                  { label:'Fatturato', value:fattAnno, color:C.green, bold:false, indent:0 },
                  { label:'− Costo merci vendute', value:-costoAnno, color:C.muted, bold:false, indent:1 },
                  { label:'= Margine lordo', value:margineAnno, color:margineAnno>=0?C.green:C.red, bold:true, indent:0, border:true },
                  { label:'− Spese operative', value:-speseAnno, color:C.muted, bold:false, indent:1 },
                  { label:'= Risultato operativo', value:risultatoAnno, color:risultatoAnno>=0?C.green:C.red, bold:true, indent:0, border:true },
                ].map(({label,value,color,bold,indent,border},i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderTop:border||i===0?`1px solid ${C.border}`:'none', paddingLeft:indent?16:0 }}>
                    <span style={{ fontSize:13, color:bold?C.text:C.muted, fontWeight:bold?700:400 }}>{label}</span>
                    <span style={{ fontSize:bold?16:13, fontWeight:bold?700:400, color }}>{value>=0?'':'-'}€ {Math.abs(value).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              {speseAnno===0 && <div style={{ fontSize:11, color:C.muted, marginTop:12, fontStyle:'italic' }}>💡 Aggiungi le spese nella tab "Spese" per completare il P&L</div>}
            </div>
          </div>
        )
      })()}

      {/* SEZIONE 4: MAGAZZINO */}
      <div>
        <h2 style={{ margin:'0 0 12px', fontSize:13, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.1em' }}>📦 Magazzino</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 }}>
          <KpiCard icon="📦" label="Articoli totali" value={String(articoli.length)} color={C.accent} />
          <KpiCard icon="💰" label="Valore acquisto" value={`€ ${va.toFixed(0)}`} color={C.green} />
          <KpiCard icon="📈" label="Valore potenziale" value={`€ ${vv.toFixed(0)}`} color={C.orange} />
          <KpiCard icon="📊" label="Margine teorico" value={`${margineMagazzino.toFixed(1)}%`} color={C.purple} />
          <KpiCard icon="⚠️" label="Sotto soglia" value={String(sottoSoglia)} color={sottoSoglia>0?C.red:C.green} />
          <KpiCard icon="❌" label="Esauriti" value={String(esauriti)} color={esauriti>0?C.red:C.green} />
        </div>
      </div>

      {/* Grafici esistenti */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14 }}>
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

        {perForn.length>0 && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
            <div style={{ ...labelStyle, marginBottom:12 }}>Per fornitore (€ acquisto in stock)</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {perForn.map(({nome,count,valore})=>(
                <div key={nome} style={{ background:C.surfaceHi, borderRadius:8, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{nome}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{count} articoli</div>
                  </div>
                  <span style={{ fontSize:15, fontWeight:700, color:C.orange }}>€{valore.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={()=>exportCSV(articoli,fornitori)} style={btnSecondary}>📥 Esporta inventario CSV</button>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }: { icon:string; label:string; value:string; sub?:string; color:string }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 16px' }}>
      <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:20, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:10, color:C.muted, marginTop:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function TrendChart({ trend, giorni }: { trend:VenditaGiorno[]; giorni:number }) {
  // Riempi i giorni mancanti con 0
  const days: { giorno:string; fatturato:number }[] = []
  for (let i=giorni-1; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0)
    const key = d.toISOString().split('T')[0]
    const found = trend.find(t=>t.giorno===key)
    days.push({ giorno:key, fatturato: found?Number(found.fatturato):0 })
  }
  const max = Math.max(...days.map(d=>d.fatturato), 1)
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18, marginTop:14 }}>
      <div style={{ ...labelStyle, marginBottom:14 }}>Trend ultimi {giorni} giorni</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:80 }}>
        {days.map((d,i)=>(
          <div key={i} title={`${new Date(d.giorno).toLocaleDateString('it-IT')}: €${d.fatturato.toFixed(0)}`}
            style={{ flex:1, height:`${(d.fatturato/max)*100}%`, minHeight:d.fatturato>0?2:1, background:d.fatturato>0?C.accent:C.border, borderRadius:'2px 2px 0 0' }} />
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:C.muted }}>
        <span>{new Date(days[0].giorno).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
        <span>oggi</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB VENDITA (POS)
// ═══════════════════════════════════════════════════════════════════
function TabVendita({ articoli, clienti, onSold }: { articoli:Articolo[]; clienti:Cliente[]; onSold:()=>void }) {
  const [carrello, setCarrello] = useState<CarrelloItem[]>([])
  const [cerca, setCerca] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteNomeManuale, setClienteNomeManuale] = useState('')
  const [metodoPagamento, setMetodoPagamento] = useState<'contanti'|'carta'|'bonifico'|'altro'>('contanti')
  const [note, setNote] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [confermando, setConfermando] = useState(false)
  const [ricevuta, setRicevuta] = useState<{numero:number; totale:number; data:Date; righe:CarrelloItem[]; cliente:string|null; metodo:string} | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtrati = useMemo(()=>cerca.length<2?[]:articoli.filter(a=>
    a.nome.toLowerCase().includes(cerca.toLowerCase()) || a.codice?.toLowerCase().includes(cerca.toLowerCase())
  ).slice(0,8),[cerca,articoli])

  const aggiungi = (a: Articolo) => {
    if (a.quantita<=0) { alert(`"${a.nome}" è esaurito.`); return }
    setCarrello(c => {
      const exists = c.find(x=>x.articolo_id===a.id)
      if (exists) {
        if (exists.quantita>=a.quantita) { alert(`Disponibili solo ${a.quantita} pz di "${a.nome}".`); return c }
        return c.map(x=>x.articolo_id===a.id?{...x, quantita:x.quantita+1}:x)
      }
      return [...c, { articolo_id:a.id, nome:a.nome, codice:a.codice||null, quantita:1, prezzo_unitario:a.prezzo_vendita||0, prezzo_acquisto:a.prezzo_acquisto||0, quantita_disponibile:a.quantita }]
    })
    setCerca(''); inputRef.current?.focus()
  }

  const aggiornaQta = (id:string, delta:number) => {
    setCarrello(c=>c.map(x=>{
      if (x.articolo_id!==id) return x
      const nuova = x.quantita+delta
      if (nuova<1) return x
      if (nuova>x.quantita_disponibile) { alert(`Disponibili solo ${x.quantita_disponibile} pz.`); return x }
      return {...x, quantita:nuova}
    }))
  }

  const setPrezzo = (id:string, p:string) => {
    const num = Number(p); if (isNaN(num)||num<0) return
    setCarrello(c=>c.map(x=>x.articolo_id===id?{...x, prezzo_unitario:num}:x))
  }

  const setQta = (id:string, q:string) => {
    const num = Number(q); if (isNaN(num)||num<1) return
    setCarrello(c=>c.map(x=>{
      if (x.articolo_id!==id) return x
      if (num>x.quantita_disponibile) { alert(`Disponibili solo ${x.quantita_disponibile} pz.`); return x }
      return {...x, quantita:num}
    }))
  }

  const rimuovi = (id:string) => setCarrello(c=>c.filter(x=>x.articolo_id!==id))

  const totale = carrello.reduce((s,x)=>s+x.quantita*x.prezzo_unitario,0)

  const conferma = async () => {
    if (carrello.length===0) return
    if (!confirm(`Confermi vendita di ${carrello.length} articoli per € ${totale.toFixed(2)}?`)) return
    setConfermando(true)
    const cliente = clienti.find(c=>c.id===clienteId)
    const nomeCliente = cliente?.nome || clienteNomeManuale || null
    const { data, error } = await supabase.rpc('registra_vendita', {
      p_cliente_id: clienteId||null,
      p_cliente_nome: nomeCliente,
      p_metodo_pagamento: metodoPagamento,
      p_note: note||null,
      p_righe: carrello.map(x=>({ articolo_id:x.articolo_id, quantita:x.quantita, prezzo_unitario:x.prezzo_unitario })),
    })
    if (error) { alert(`Errore: ${error.message}`); setConfermando(false); return }
    setRicevuta({ numero:(data as any).numero, totale:Number((data as any).totale), data:new Date(), righe:carrello, cliente:nomeCliente, metodo:metodoPagamento })
    setCarrello([]); setClienteId(''); setClienteNomeManuale(''); setNote(''); setMetodoPagamento('contanti')
    setConfermando(false); onSold()
  }

  const handleBarcode = (code:string) => {
    setScannerOpen(false)
    const a = articoli.find(x=>x.codice===code)
    if (a) aggiungi(a)
    else alert(`Codice ${code} non trovato in inventario.`)
  }

  if (ricevuta) return <Ricevuta ricevuta={ricevuta} onClose={()=>setRicevuta(null)} />

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16, '@media (min-width:768px)':{ gridTemplateColumns:'1fr 380px' } } as any}>
      {/* COLONNA SINISTRA: Ricerca articoli */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={inputRef} autoFocus placeholder="Cerca articolo per nome o codice..." value={cerca} onChange={e=>setCerca(e.target.value)} style={{ ...inp, flex:1 }} />
          <button onClick={()=>setScannerOpen(true)} style={{ padding:'9px 14px', background:C.accentSoft, color:C.accent, border:`1px solid #2a4a7f`, borderRadius:5, fontSize:13, cursor:'pointer', flexShrink:0 }}>📷</button>
        </div>

        {filtrati.length>0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:1, maxHeight:400, overflowY:'auto' }}>
            {filtrati.map(a=>(
              <button key={a.id} onClick={()=>aggiungi(a)} disabled={a.quantita<=0}
                style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:'10px 12px', display:'flex', alignItems:'center', gap:10, cursor:a.quantita<=0?'not-allowed':'pointer', textAlign:'left', fontFamily:'inherit', opacity:a.quantita<=0?0.4:1 }}
                onMouseEnter={e=>{ if(a.quantita>0) e.currentTarget.style.borderColor=C.accent }}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
              >
                {a.foto_url && <img src={a.foto_url} alt="" style={{ width:36, height:36, borderRadius:4, objectFit:'cover', flexShrink:0 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{a.nome}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2, display:'flex', gap:8 }}>
                    {a.codice && <span>#{a.codice}</span>}
                    {a.categoria && <span>{a.categoria}</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.green }}>€ {Number(a.prezzo_vendita||0).toFixed(2)}</div>
                  <div style={{ fontSize:11, color:a.quantita<=a.soglia_riordino?C.red:C.muted, marginTop:2 }}>{a.quantita} pz</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {cerca.length<2 && carrello.length===0 && (
          <div style={{ textAlign:'center', color:C.muted, padding:40, fontSize:13, background:C.surface, borderRadius:8, border:`1px dashed ${C.border}` }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🛒</div>
            Cerca un articolo o scansiona un codice per iniziare
          </div>
        )}
      </div>

      {/* COLONNA DESTRA: Carrello */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:16, position:'sticky', top:16, alignSelf:'flex-start', maxHeight:'calc(100vh - 100px)', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>🛒 Carrello</h3>
          {carrello.length>0 && <span style={{ fontSize:11, color:C.muted }}>{carrello.reduce((s,x)=>s+x.quantita,0)} pz</span>}
        </div>

        {carrello.length===0 ? (
          <div style={{ textAlign:'center', color:C.muted, padding:'40px 20px', fontSize:12 }}>Carrello vuoto</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
            {carrello.map(x=>(
              <div key={x.articolo_id} style={{ background:C.surfaceHi, borderRadius:6, padding:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:6 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis' }}>{x.nome}</div>
                    {x.codice && <div style={{ fontSize:10, color:C.muted }}>#{x.codice}</div>}
                  </div>
                  <button onClick={()=>rimuovi(x.articolo_id)} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:14, padding:0, lineHeight:1 }}>✕</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button onClick={()=>aggiornaQta(x.articolo_id,-1)} style={{ width:26, height:26, background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, cursor:'pointer', fontSize:14 }}>−</button>
                  <input type="number" min={1} max={x.quantita_disponibile} value={x.quantita} onChange={e=>setQta(x.articolo_id, e.target.value)}
                    style={{ width:42, padding:'4px 6px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, textAlign:'center', fontSize:12 }} />
                  <button onClick={()=>aggiornaQta(x.articolo_id,+1)} style={{ width:26, height:26, background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, cursor:'pointer', fontSize:14 }}>+</button>
                  <span style={{ color:C.muted, fontSize:11, margin:'0 4px' }}>×</span>
                  <input type="number" step="0.01" min={0} value={x.prezzo_unitario} onChange={e=>setPrezzo(x.articolo_id, e.target.value)}
                    style={{ width:64, padding:'4px 6px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, fontSize:12 }} />
                  <span style={{ flex:1, textAlign:'right', fontSize:13, fontWeight:700, color:C.green }}>€{(x.quantita*x.prezzo_unitario).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {carrello.length>0 && (
          <>
            {/* Totale */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'12px 0', borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, marginBottom:14 }}>
              <span style={{ fontSize:13, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em' }}>Totale</span>
              <span style={{ fontSize:24, fontWeight:700, color:C.green }}>€ {totale.toFixed(2)}</span>
            </div>

            {/* Cliente */}
            <div style={{ marginBottom:10 }}>
              <label style={labelStyle}>Cliente (opzionale)</label>
              <select value={clienteId} onChange={e=>{setClienteId(e.target.value); setClienteNomeManuale('')}} style={sel}>
                <option value="">— Cliente generico —</option>
                {clienti.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {!clienteId && (
                <input placeholder="o digita un nome..." value={clienteNomeManuale} onChange={e=>setClienteNomeManuale(e.target.value)} style={{ ...inp, marginTop:6 }} />
              )}
            </div>

            {/* Metodo pagamento */}
            <div style={{ marginBottom:10 }}>
              <label style={labelStyle}>Pagamento</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4, marginTop:4 }}>
                {METODI_PAGAMENTO.map(m=>(
                  <button key={m.val} onClick={()=>setMetodoPagamento(m.val)}
                    style={{ padding:'8px 4px', background:metodoPagamento===m.val?C.accentSoft:C.surfaceHi, border:`1px solid ${metodoPagamento===m.val?C.accent:C.border}`, borderRadius:5, color:metodoPagamento===m.val?C.accent:C.text, cursor:'pointer', fontSize:11, fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                    <span style={{ fontSize:14 }}>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <Field label="Note (opzionale)">
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="es. cantiere via Roma..." style={inp} />
            </Field>

            <button onClick={conferma} disabled={confermando} style={{ ...btnSuccess, width:'100%', marginTop:14, padding:'14px', fontSize:13, opacity:confermando?0.6:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {confermando ? <><Spinner /> Registrazione...</> : `✓ Conferma vendita € ${totale.toFixed(2)}`}
            </button>
          </>
        )}
      </div>

      {scannerOpen && <BarcodeScanner onDetected={handleBarcode} onClose={()=>setScannerOpen(false)} />}
    </div>
  )
}

function Ricevuta({ ricevuta, onClose }: { ricevuta:{numero:number; totale:number; data:Date; righe:CarrelloItem[]; cliente:string|null; metodo:string}; onClose:()=>void }) {
  const stampa = () => window.print()
  return (
    <div style={{ maxWidth:500, margin:'40px auto', animation:'slideUp 0.3s ease' }}>
      <style>{`@media print{body{background:white!important}.no-print{display:none!important}.ricevuta{color:black!important;background:white!important;border:none!important}.ricevuta *{color:black!important}}`}</style>
      <div className="ricevuta" style={{ background:C.surface, border:`2px solid ${C.green}`, borderRadius:12, padding:30 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>✅</div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:C.green }}>Vendita registrata</h2>
          <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Documento N° {ricevuta.numero}</div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
          <span>{ricevuta.data.toLocaleString('it-IT')}</span>
          <span>{ricevuta.metodo}</span>
        </div>
        {ricevuta.cliente && <div style={{ fontSize:12, marginBottom:12 }}><span style={{color:C.muted}}>Cliente:</span> <strong>{ricevuta.cliente}</strong></div>}
        <div style={{ marginBottom:16 }}>
          {ricevuta.righe.map((r,i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px dashed ${C.border}`, fontSize:12 }}>
              <div style={{ flex:1 }}>
                <div>{r.nome}</div>
                <div style={{ color:C.muted, fontSize:11 }}>{r.quantita} × € {r.prezzo_unitario.toFixed(2)}</div>
              </div>
              <div style={{ fontWeight:700 }}>€ {(r.quantita*r.prezzo_unitario).toFixed(2)}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:700, padding:'12px 0', borderTop:`2px solid ${C.green}` }}>
          <span>TOTALE</span>
          <span style={{ color:C.green }}>€ {ricevuta.totale.toFixed(2)}</span>
        </div>
        <div className="no-print" style={{ display:'flex', gap:8, marginTop:20 }}>
          <button onClick={stampa} style={{ ...btnSecondary, flex:1 }}>🖨 Stampa</button>
          <button onClick={onClose} style={{ ...btnPrimary, flex:1 }}>Nuova vendita</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB STORICO VENDITE
// ═══════════════════════════════════════════════════════════════════
function TabStorico({ vendite, clienti, onReload }: { vendite:Vendita[]; clienti:Cliente[]; onReload:()=>void }) {
  const [periodo, setPeriodo] = useState<'oggi'|'7gg'|'30gg'|'tutto'|'custom'>('30gg')
  const [dal, setDal] = useState(() => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0] })
  const [al, setAl] = useState(() => new Date().toISOString().split('T')[0])
  const [expanded, setExpanded] = useState<string|null>(null)
  const [eliminando, setEliminando] = useState<string|null>(null)

  const filtrate = useMemo(()=>{
    const ora = new Date()
    let inizio = new Date(0)
    if (periodo==='oggi') { inizio=new Date(); inizio.setHours(0,0,0,0) }
    else if (periodo==='7gg') { inizio=new Date(); inizio.setDate(inizio.getDate()-7); inizio.setHours(0,0,0,0) }
    else if (periodo==='30gg') { inizio=new Date(); inizio.setDate(inizio.getDate()-30); inizio.setHours(0,0,0,0) }
    else if (periodo==='custom') { inizio=new Date(dal); inizio.setHours(0,0,0,0) }
    let fine = ora
    if (periodo==='custom') { fine=new Date(al); fine.setHours(23,59,59,999) }
    return vendite.filter(v=>{ const d=new Date(v.data); return d>=inizio && d<=fine })
  },[vendite, periodo, dal, al])

  const totale = filtrate.reduce((s,v)=>s+Number(v.totale),0)
  const numero = filtrate.length

  const elimina = async (id:string, num:number) => {
    if (!confirm(`Eliminare vendita #${num}?\n\nATTENZIONE: il magazzino NON verrà ripristinato automaticamente. Dovrai correggere manualmente le quantità degli articoli se necessario.`)) return
    setEliminando(id)
    const { error } = await supabase.from('vendite').delete().eq('id',id)
    if (error) alert(`Errore: ${error.message}`)
    else onReload()
    setEliminando(null)
  }

  const dalLabel = periodo==='custom'?dal:filtrate.length>0?new Date(filtrate[filtrate.length-1].data).toISOString().split('T')[0]:dal
  const alLabel = periodo==='custom'?al:new Date().toISOString().split('T')[0]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Filtri periodo */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        {[
          { v:'oggi', l:'Oggi' }, { v:'7gg', l:'7 giorni' }, { v:'30gg', l:'30 giorni' },
          { v:'tutto', l:'Tutto' }, { v:'custom', l:'Personalizza' },
        ].map(({v,l})=>(
          <button key={v} onClick={()=>setPeriodo(v as any)} style={{ padding:'6px 12px', background:periodo===v?C.accentSoft:C.surface, border:`1px solid ${periodo===v?C.accent:C.border}`, color:periodo===v?C.accent:C.muted, borderRadius:5, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
        {periodo==='custom' && (
          <>
            <input type="date" value={dal} onChange={e=>setDal(e.target.value)} style={{ ...inp, width:'auto' }} />
            <input type="date" value={al} onChange={e=>setAl(e.target.value)} style={{ ...inp, width:'auto' }} />
          </>
        )}
      </div>

      {/* Riepilogo periodo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
          <div style={labelStyle}>Vendite</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.accent }}>{numero}</div>
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
          <div style={labelStyle}>Fatturato</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.green }}>€ {totale.toFixed(2)}</div>
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
          <div style={labelStyle}>Scontrino medio</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.purple }}>€ {numero>0?(totale/numero).toFixed(2):'0.00'}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
          <button onClick={()=>exportVenditeCSV(filtrate, dalLabel, alLabel)} disabled={filtrate.length===0} style={{ ...btnPrimary, opacity:filtrate.length===0?0.4:1 }}>📥 Esporta CSV</button>
        </div>
      </div>

      {/* Lista vendite */}
      {filtrate.length===0 ? (
        <div style={{ textAlign:'center', color:C.muted, padding:60, fontSize:13 }}>
          Nessuna vendita nel periodo selezionato.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          {filtrate.map(v=>(
            <div key={v.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6 }}>
              <div onClick={()=>setExpanded(expanded===v.id?null:v.id)} style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                <div style={{ background:C.accentSoft, color:C.accent, padding:'4px 8px', borderRadius:4, fontSize:11, fontWeight:700, fontFamily:'monospace', flexShrink:0 }}>#{v.numero}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{v.cliente_nome||'Cliente generico'}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span>{new Date(v.data).toLocaleString('it-IT',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                    <span>· {v.vendite_righe?.length||0} articoli</span>
                    {v.metodo_pagamento && <span>· {v.metodo_pagamento}</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.green }}>€ {Number(v.totale).toFixed(2)}</div>
                </div>
                <span style={{ color:C.dim, fontSize:14 }}>{expanded===v.id?'⌃':'⌄'}</span>
              </div>

              {expanded===v.id && (
                <div style={{ padding:'0 12px 12px', borderTop:`1px solid ${C.border}` }}>
                  <div style={{ marginTop:10 }}>
                    {v.vendite_righe?.map(r=>(
                      <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px dashed ${C.border}`, fontSize:12 }}>
                        <div style={{ flex:1 }}>
                          <div>{r.articolo_nome}</div>
                          <div style={{ color:C.muted, fontSize:10 }}>{r.articolo_codice && `#${r.articolo_codice} · `}{r.quantita} × € {Number(r.prezzo_unitario).toFixed(2)}</div>
                        </div>
                        <div style={{ fontWeight:700 }}>€ {Number(r.totale_riga).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  {v.note && <div style={{ marginTop:8, fontSize:11, color:C.muted, fontStyle:'italic' }}>📝 {v.note}</div>}
                  <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
                    <button onClick={()=>elimina(v.id, v.numero)} disabled={eliminando===v.id} style={{ ...btnSecondary, color:C.red, borderColor:C.red+'44', fontSize:11, padding:'6px 12px' }}>{eliminando===v.id?'...':'🗑 Elimina'}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB SPESE
// ═══════════════════════════════════════════════════════════════════
function TabSpese({ spese, onReload }: { spese:Spesa[]; onReload:()=>void }) {
  const [form, setForm] = useState({ data:new Date().toISOString().split('T')[0], categoria:'', descrizione:'', importo:'', ricorrente:false, frequenza:'mensile', pagato:true, note:'' })
  const [saving, setSaving] = useState(false)
  const [periodo, setPeriodo] = useState<'mese'|'anno'|'tutto'>('mese')
  const [editId, setEditId] = useState<string|null>(null)
  const set = (k:string, v:any) => setForm(f=>({...f,[k]:v}))

  const ora = new Date()
  const filtrate = spese.filter(s=>{
    const d = new Date(s.data)
    if (periodo==='mese') return d.getFullYear()===ora.getFullYear() && d.getMonth()===ora.getMonth()
    if (periodo==='anno') return d.getFullYear()===ora.getFullYear()
    return true
  })

  const totalePagato = filtrate.filter(s=>s.pagato).reduce((sum,s)=>sum+Number(s.importo),0)
  const totaleDaPagare = filtrate.filter(s=>!s.pagato).reduce((sum,s)=>sum+Number(s.importo),0)

  const perCategoria = CATEGORIE_SPESE.map(cat=>({
    cat, totale: filtrate.filter(s=>s.categoria===cat).reduce((sum,s)=>sum+Number(s.importo),0)
  })).filter(c=>c.totale>0).sort((a,b)=>b.totale-a.totale)

  const salva = async () => {
    if (!form.categoria || !form.importo || Number(form.importo)<=0) return
    setSaving(true)
    const payload = { data:form.data, categoria:form.categoria, descrizione:form.descrizione||null, importo:Number(form.importo), ricorrente:form.ricorrente, frequenza:form.ricorrente?form.frequenza:null, pagato:form.pagato, note:form.note||null }
    const { error } = await supabase.from('spese').insert(payload)
    if (error) { alert(error.message); setSaving(false); return }
    setForm({ data:new Date().toISOString().split('T')[0], categoria:'', descrizione:'', importo:'', ricorrente:false, frequenza:'mensile', pagato:true, note:'' })
    setSaving(false); onReload()
  }

  const togglePagato = async (s:Spesa) => {
    await supabase.from('spese').update({ pagato:!s.pagato }).eq('id',s.id)
    onReload()
  }

  const elimina = async (id:string) => {
    if (!confirm('Eliminare questa spesa?')) return
    await supabase.from('spese').delete().eq('id',id); onReload()
  }

  const mesiLabel = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

  return (
    <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
      {/* COLONNA SINISTRA: Lista spese */}
      <div style={{ flex:1, minWidth:300 }}>
        {/* Filtri */}
        <div style={{ display:'flex', gap:6, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          {[['mese',`${mesiLabel[ora.getMonth()]} ${ora.getFullYear()}`],['anno',String(ora.getFullYear())],['tutto','Tutto']].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriodo(v as any)} style={{ padding:'5px 12px', background:periodo===v?C.accentSoft:C.surface, border:`1px solid ${periodo===v?C.accent:C.border}`, color:periodo===v?C.accent:C.muted, borderRadius:5, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>

        {/* KPI */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
            <div style={labelStyle}>Pagate</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.red }}>€ {totalePagato.toFixed(0)}</div>
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
            <div style={labelStyle}>Da pagare</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.orange }}>€ {totaleDaPagare.toFixed(0)}</div>
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
            <div style={labelStyle}>Totale</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.text }}>€ {(totalePagato+totaleDaPagare).toFixed(0)}</div>
          </div>
        </div>

        {/* Per categoria mini-chart */}
        {perCategoria.length>0 && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ ...labelStyle, marginBottom:10 }}>Per categoria</div>
            {perCategoria.map(({cat,totale})=>{
              const max = perCategoria[0].totale
              return (
                <div key={cat} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:12 }}>{cat}</span>
                    <span style={{ fontSize:11, color:C.muted }}>€ {totale.toFixed(0)}</span>
                  </div>
                  <div style={{ height:4, background:C.border, borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(totale/max)*100}%`, background:C.red, borderRadius:2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Lista */}
        {filtrate.length===0 ? (
          <div style={{ textAlign:'center', color:C.muted, padding:40, fontSize:13, background:C.surface, borderRadius:8, border:`1px dashed ${C.border}` }}>
            Nessuna spesa nel periodo selezionato.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {filtrate.map(s=>(
              <div key={s.id} style={{ background:C.surface, border:`1px solid ${s.pagato?C.border:C.orange+'66'}`, borderRadius:6, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
                <button onClick={()=>togglePagato(s)} title={s.pagato?'Segna come da pagare':'Segna come pagata'} style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${s.pagato?C.green:C.orange}`, background:s.pagato?C.green+'33':'transparent', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                  {s.pagato?'✓':''}
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>{s.categoria}</span>
                    {s.ricorrente && <span style={{ fontSize:10, padding:'1px 5px', borderRadius:3, background:C.accentSoft, color:C.accent }}>↻ {s.frequenza}</span>}
                    {!s.pagato && <span style={{ fontSize:10, padding:'1px 5px', borderRadius:3, background:'#3d2a00', color:C.orange }}>da pagare</span>}
                  </div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2, display:'flex', gap:8 }}>
                    <span>{new Date(s.data).toLocaleDateString('it-IT')}</span>
                    {s.descrizione && <span>· {s.descrizione}</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:s.pagato?C.red:C.orange }}>€ {Number(s.importo).toFixed(2)}</div>
                </div>
                <button onClick={()=>elimina(s.id)} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:14, padding:0 }}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COLONNA DESTRA: Aggiungi spesa */}
      <div style={{ width:280, flexShrink:0 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ ...labelStyle, marginBottom:14 }}>NUOVA SPESA</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <Field label="Data">
              <input type="date" value={form.data} onChange={e=>set('data',e.target.value)} style={inp} />
            </Field>
            <Field label="Categoria *">
              <select value={form.categoria} onChange={e=>set('categoria',e.target.value)} style={sel}>
                <option value="">— Scegli —</option>
                {CATEGORIE_SPESE.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Descrizione">
              <input value={form.descrizione} onChange={e=>set('descrizione',e.target.value)} placeholder="es. Febbraio 2025, quota trimestrale..." style={inp} />
            </Field>
            <Field label="Importo € *">
              <input type="number" inputMode="decimal" step="0.01" min="0" value={form.importo} onChange={e=>set('importo',e.target.value)} placeholder="0.00" style={inp} />
            </Field>

            {/* Ricorrente */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" id="ricorrente" checked={form.ricorrente} onChange={e=>set('ricorrente',e.target.checked)} style={{ width:16, height:16, cursor:'pointer' }} />
              <label htmlFor="ricorrente" style={{ fontSize:12, color:C.text, cursor:'pointer' }}>Spesa ricorrente</label>
            </div>
            {form.ricorrente && (
              <Field label="Frequenza">
                <select value={form.frequenza} onChange={e=>set('frequenza',e.target.value)} style={sel}>
                  <option value="mensile">Mensile</option>
                  <option value="trimestrale">Trimestrale</option>
                  <option value="semestrale">Semestrale</option>
                  <option value="annuale">Annuale</option>
                </select>
              </Field>
            )}

            {/* Già pagata */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" id="pagato" checked={form.pagato} onChange={e=>set('pagato',e.target.checked)} style={{ width:16, height:16, cursor:'pointer' }} />
              <label htmlFor="pagato" style={{ fontSize:12, color:C.text, cursor:'pointer' }}>Già pagata</label>
            </div>

            <Field label="Note">
              <input value={form.note} onChange={e=>set('note',e.target.value)} placeholder="es. fattura n°..." style={inp} />
            </Field>

            <button onClick={salva} disabled={!form.categoria||!form.importo||Number(form.importo)<=0||saving}
              style={{ ...btnPrimary, opacity:!form.categoria||!form.importo||saving?0.5:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {saving?<><Spinner/> Salvo...</>:'+ Registra spesa'}
            </button>
          </div>
        </div>

        {/* Info immobile */}
        <div style={{ background:'#1a1a0a', border:`1px solid #3d3d00`, borderRadius:8, padding:'12px 14px', marginTop:12 }}>
          <div style={{ fontSize:11, color:'#a0a000', fontWeight:600, marginBottom:6 }}>🏠 Nota immobile</div>
          <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>
            L'immobile è di proprietà. Non registrare affitto. Usa <strong style={{color:C.text}}>IMU / Tasse immobile</strong> per la tassa annuale e <strong style={{color:C.text}}>Condominio</strong> per le spese condominiali se presenti.
          </div>
        </div>
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
  const [quickEditId, setQuickEditId] = useState<string|null>(null)

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
            <div key={a.id} style={{ background:C.surface, border:`1px solid ${quickEditId===a.id?C.accent:C.border}`, borderRadius:6, overflow:'hidden' }}>
              <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:8 }}
                onMouseEnter={e=>{ if(quickEditId!==a.id) e.currentTarget.parentElement!.style.borderColor=C.accent }}
                onMouseLeave={e=>{ if(quickEditId!==a.id) e.currentTarget.parentElement!.style.borderColor=C.border }}
              >
                <div onClick={()=>setSelected(a)} style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor:'pointer', minWidth:0 }}>
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
                <button title="Modifica rapida" onClick={e=>{ e.stopPropagation(); setQuickEditId(quickEditId===a.id?null:a.id) }}
                  style={{ padding:'4px 9px', background:quickEditId===a.id?C.accent:C.accentSoft, color:quickEditId===a.id?'#fff':C.accent, border:`1px solid ${quickEditId===a.id?C.accent:'#2a4a7f'}`, borderRadius:5, fontSize:13, cursor:'pointer', flexShrink:0 }}>✎</button>
                <button title="QR code" onClick={e=>{ e.stopPropagation(); setQrArticolo(a) }} style={{ padding:'4px 9px', background:C.accentSoft, color:C.accent, border:`1px solid #2a4a7f`, borderRadius:5, fontSize:11, cursor:'pointer', flexShrink:0 }}>📱</button>
              </div>
              {quickEditId===a.id && <QuickEdit articolo={a} onClose={()=>setQuickEditId(null)} onSaved={()=>{ setQuickEditId(null); onReload() }} />}
            </div>
          ))}
        </div>
      )}
      {qrArticolo && <QRModal articolo={qrArticolo} onClose={()=>setQrArticolo(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// QUICK EDIT — modifica rapida di quantità + prezzo vendita
// ═══════════════════════════════════════════════════════════════════
function QuickEdit({ articolo, onClose, onSaved }: { articolo:Articolo; onClose:()=>void; onSaved:()=>void }) {
  const [qty, setQty] = useState(String(articolo.quantita))
  const [prezzo, setPrezzo] = useState(String(articolo.prezzo_vendita ?? ''))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string|null>(null)

  const numQty = Number(qty)
  const numPrezzo = prezzo === '' ? null : Number(prezzo)
  const valid = !isNaN(numQty) && numQty >= 0 && (numPrezzo === null || (!isNaN(numPrezzo) && numPrezzo >= 0))
  const dirty = numQty !== articolo.quantita || numPrezzo !== (articolo.prezzo_vendita ?? null)

  const salva = async () => {
    if (!valid || !dirty) return
    setSaving(true); setFeedback(null)

    const updates: any = {}
    if (numQty !== articolo.quantita) updates.quantita = numQty
    if (numPrezzo !== (articolo.prezzo_vendita ?? null)) updates.prezzo_vendita = numPrezzo

    const { error } = await supabase.from('articoli').update(updates).eq('id', articolo.id)
    if (error) { setFeedback(`Errore: ${error.message}`); setSaving(false); return }

    // Audit trail: registra movimento se cambia la quantità
    if (numQty !== articolo.quantita) {
      const diff = numQty - articolo.quantita
      await supabase.from('movimenti').insert({
        articolo_id: articolo.id,
        tipo: diff > 0 ? 'entrata' : 'uscita',
        quantita: Math.abs(diff),
        quantita_precedente: articolo.quantita,
        quantita_dopo: numQty,
        note: 'Modifica rapida',
      })
    }
    setSaving(false); onSaved()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') salva()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div style={{ borderTop:`1px solid ${C.border}`, background:C.surfaceHi, padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }} onKeyDown={handleKey}>
      <Field label="Quantità" flex={1}>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={()=>setQty(String(Math.max(0, numQty-1)))} style={{ width:32, height:34, background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>−</button>
          <input type="number" inputMode="numeric" min="0" value={qty} onChange={e=>setQty(e.target.value)} style={{ ...inp, textAlign:'center', minWidth:60 }} />
          <button onClick={()=>setQty(String(numQty+1))} style={{ width:32, height:34, background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>+</button>
        </div>
      </Field>
      <Field label="€ Vendita" flex={1}>
        <input type="number" inputMode="decimal" step="0.01" min="0" value={prezzo} onChange={e=>setPrezzo(e.target.value)} placeholder="0.00" style={inp} />
      </Field>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={salva} disabled={!valid||!dirty||saving} style={{ ...btnPrimary, opacity:!valid||!dirty||saving?0.4:1, padding:'9px 16px', background:C.green, display:'flex', alignItems:'center', gap:6 }}>
          {saving ? <Spinner /> : '✓ Salva'}
        </button>
        <button onClick={onClose} style={{ ...btnSecondary, padding:'9px 14px' }}>Annulla</button>
      </div>
      {feedback && <div style={{ width:'100%', color:C.red, fontSize:11, marginTop:4 }}>{feedback}</div>}
      {!feedback && dirty && (
        <div style={{ width:'100%', fontSize:11, color:C.muted, marginTop:2 }}>
          {numQty !== articolo.quantita && <span>Quantità: {articolo.quantita} → <strong style={{color:numQty>articolo.quantita?C.green:C.orange}}>{numQty}</strong> ({numQty>articolo.quantita?'+':''}{numQty-articolo.quantita}) </span>}
          {numPrezzo !== (articolo.prezzo_vendita ?? null) && <span>· Prezzo: €{Number(articolo.prezzo_vendita||0).toFixed(2)} → <strong style={{color:C.accent}}>€{(numPrezzo||0).toFixed(2)}</strong></span>}
        </div>
      )}
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
