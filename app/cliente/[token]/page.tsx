'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Cliente = { id: string; nome: string; telefono: string|null; email: string|null }
type ArticoloCat = { id: string; nome: string; codice: string|null; categoria: string|null; descrizione: string|null; foto_url: string|null; prezzo_vendita: number|null; quantita_disponibile: number; posizione: string|null }
type CarrelloItem = { articolo_id: string; nome: string; prezzo_vendita: number; quantita: number; quantita_disponibile: number }
type Prenotazione = { id: string; numero: number; data_prenotazione: string; data_scadenza: string; stato: string; totale_stimato: number; note: string|null; righe: { articolo_nome: string; quantita: number; prezzo_stimato: number|null }[] }

const C = { bg:'#0f0f0f', surface:'#1a1a1a', surfaceHi:'#222', border:'#2a2a2a', text:'#e8e8e8', muted:'#888', dim:'#444', accent:'#3b82f6', accentSoft:'#1e3a5f', red:'#ef4444', green:'#22c55e', orange:'#f97316' }

const inp: React.CSSProperties = { width:'100%', padding:'10px 12px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
const btnPrimary: React.CSSProperties = { padding:'12px 18px', background:C.accent, color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }

function Spinner() { return <span style={{ display:'inline-block', width:14, height:14, border:`2px solid ${C.dim}`, borderTopColor:C.accent, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> }

export default function ClientePage() {
  const params = useParams()
  const token = params?.token as string

  const [cliente, setCliente] = useState<Cliente|null>(null)
  const [catalogo, setCatalogo] = useState<ArticoloCat[]>([])
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([])
  const [carrello, setCarrello] = useState<CarrelloItem[]>([])
  const [tab, setTab] = useState<'catalogo'|'prenotazioni'>('catalogo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [cerca, setCerca] = useState('')
  const [categoria, setCategoria] = useState<string>('')
  const [mostraCarrello, setMostraCarrello] = useState(false)
  const [confermando, setConfermando] = useState(false)
  const [ricevuta, setRicevuta] = useState<{numero:number; totale:number; scadenza:string}|null>(null)
  const [note, setNote] = useState('')
  const [scadenza, setScadenza] = useState<'stasera'|'domani'>('stasera')

  // Carica dati iniziali
  const carica = async () => {
    setLoading(true); setError(null)
    const [{ data: info, error: e1 }, { data: cat, error: e2 }, { data: pren, error: e3 }] = await Promise.all([
      supabase.rpc('cliente_info', { p_token: token }),
      supabase.rpc('cliente_catalogo', { p_token: token }),
      supabase.rpc('cliente_prenotazioni', { p_token: token }),
    ])

    if (e1 || !info || info.length === 0) {
      setError('Link non valido o scaduto. Contatta Idraulica Rapisarda per un nuovo link.')
      setLoading(false); return
    }
    setCliente(info[0])
    setCatalogo(cat || [])
    setPrenotazioni(pren || [])
    setLoading(false)
  }

  useEffect(() => { if (token) carica() }, [token])

  // Filtro catalogo
  const categorie = useMemo(() => Array.from(new Set(catalogo.map(a=>a.categoria).filter(Boolean) as string[])).sort(), [catalogo])
  const filtrati = useMemo(() => catalogo.filter(a=>{
    if (categoria && a.categoria!==categoria) return false
    if (cerca) {
      const q = cerca.toLowerCase()
      if (!a.nome.toLowerCase().includes(q) && !a.codice?.toLowerCase().includes(q) && !a.descrizione?.toLowerCase().includes(q)) return false
    }
    return true
  }), [catalogo, cerca, categoria])

  // Carrello operations
  const aggiungi = (a: ArticoloCat) => {
    if (a.quantita_disponibile <= 0) return
    setCarrello(c => {
      const exists = c.find(x => x.articolo_id === a.id)
      if (exists) {
        if (exists.quantita >= a.quantita_disponibile) {
          alert(`Disponibili solo ${a.quantita_disponibile} pz`); return c
        }
        return c.map(x => x.articolo_id === a.id ? { ...x, quantita: x.quantita + 1 } : x)
      }
      return [...c, { articolo_id: a.id, nome: a.nome, prezzo_vendita: Number(a.prezzo_vendita || 0), quantita: 1, quantita_disponibile: a.quantita_disponibile }]
    })
  }
  const cambiaQta = (id: string, delta: number) => {
    setCarrello(c => c.map(x => {
      if (x.articolo_id !== id) return x
      const nuova = x.quantita + delta
      if (nuova < 1) return x
      if (nuova > x.quantita_disponibile) { alert(`Disponibili solo ${x.quantita_disponibile} pz`); return x }
      return { ...x, quantita: nuova }
    }))
  }
  const rimuovi = (id: string) => setCarrello(c => c.filter(x => x.articolo_id !== id))

  const totale = carrello.reduce((s,x)=>s + x.quantita * x.prezzo_vendita, 0)
  const totalePezzi = carrello.reduce((s,x)=>s + x.quantita, 0)

  // Calcola scadenza
  const calcolaScadenza = () => {
    const d = new Date()
    if (scadenza === 'stasera') {
      d.setHours(20,0,0,0)
      // Se è già passato l'orario di stasera, sposta a domani sera
      if (d.getTime() < Date.now()) d.setDate(d.getDate()+1)
    } else {
      // Domani sera
      d.setDate(d.getDate()+1)
      d.setHours(20,0,0,0)
    }
    return d
  }

  const conferma = async () => {
    if (carrello.length === 0) return
    setConfermando(true)
    const dataScad = calcolaScadenza()
    const { data, error } = await supabase.rpc('cliente_crea_prenotazione', {
      p_token: token,
      p_data_scadenza: dataScad.toISOString(),
      p_note: note || null,
      p_righe: carrello.map(x => ({ articolo_id: x.articolo_id, quantita: x.quantita })),
    })
    if (error) { alert(`Errore: ${error.message}`); setConfermando(false); return }
    setRicevuta({ numero: (data as any).numero, totale: Number((data as any).totale), scadenza: dataScad.toLocaleString('it-IT') })
    setCarrello([]); setNote(''); setMostraCarrello(false); setConfermando(false)
    carica()
  }

  const annulla = async (id: string) => {
    if (!confirm('Annullare questa prenotazione?')) return
    const { error } = await supabase.rpc('cliente_annulla_prenotazione', { p_token: token, p_prenotazione_id: id })
    if (error) { alert(`Errore: ${error.message}`); return }
    carica()
  }

  if (error) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'system-ui, sans-serif' }}>
        <div style={{ textAlign:'center', maxWidth:340 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <h1 style={{ fontSize:18, marginBottom:8 }}>Accesso negato</h1>
          <p style={{ color:C.muted, fontSize:14 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Spinner />
      </div>
    )
  }

  const prenAttive = prenotazioni.filter(p => p.stato==='attiva' && new Date(p.data_scadenza) > new Date())

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text, fontFamily:'system-ui, sans-serif', paddingBottom: carrello.length>0 ? 80 : 20 }}>
      <style>{`
        *{box-sizing:border-box}input,select,textarea{color-scheme:dark}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.dim};border-radius:3px}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 16px', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <div>
              <h1 style={{ margin:0, fontSize:16, fontWeight:700 }}>🔧 Idraulica Rapisarda</h1>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Ciao, <strong style={{ color:C.accent }}>{cliente?.nome}</strong></div>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginTop:12 }}>
            <button onClick={()=>setTab('catalogo')} style={{ flex:1, padding:'8px 12px', background:tab==='catalogo'?C.accentSoft:'transparent', color:tab==='catalogo'?C.accent:C.muted, border:'none', borderBottom:tab==='catalogo'?`2px solid ${C.accent}`:'2px solid transparent', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>📦 Catalogo</button>
            <button onClick={()=>setTab('prenotazioni')} style={{ flex:1, padding:'8px 12px', background:tab==='prenotazioni'?C.accentSoft:'transparent', color:tab==='prenotazioni'?C.accent:C.muted, border:'none', borderBottom:tab==='prenotazioni'?`2px solid ${C.accent}`:'2px solid transparent', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>📅 Prenotazioni{prenAttive.length>0?` (${prenAttive.length})`:''}</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:600, margin:'0 auto', padding:'14px 16px' }}>
        {tab === 'catalogo' && (
          <>
            {/* Search + filtro */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              <input placeholder="🔍 Cerca pezzo..." value={cerca} onChange={e=>setCerca(e.target.value)} style={{ ...inp, flex:1, minWidth:200 }} />
              <select value={categoria} onChange={e=>setCategoria(e.target.value)} style={{ ...inp, width:'auto', cursor:'pointer' }}>
                <option value="">Tutte</option>
                {categorie.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Catalogo */}
            {filtrati.length===0 ? (
              <div style={{ textAlign:'center', color:C.muted, padding:40, fontSize:13 }}>Nessun risultato.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {filtrati.map(a => {
                  const inCarrello = carrello.find(x=>x.articolo_id===a.id)
                  const esaurito = a.quantita_disponibile <= 0
                  return (
                    <div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:10, display:'flex', gap:10, alignItems:'center', opacity:esaurito?0.5:1 }}>
                      {a.foto_url ? <img src={a.foto_url} alt="" style={{ width:50, height:50, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
                        : <div style={{ width:50, height:50, borderRadius:6, background:C.surfaceHi, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🔧</div>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, lineHeight:1.3 }}>{a.nome}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:3, display:'flex', gap:8, flexWrap:'wrap' }}>
                          {a.categoria && <span>{a.categoria}</span>}
                          {a.codice && <span>#{a.codice}</span>}
                        </div>
                        <div style={{ marginTop:5, display:'flex', gap:8, alignItems:'center', fontSize:12 }}>
                          <strong style={{ color:C.green }}>€ {Number(a.prezzo_vendita||0).toFixed(2)}</strong>
                          <span style={{ color:esaurito?C.red:a.quantita_disponibile<=2?C.orange:C.muted }}>
                            {esaurito ? '✕ Esaurito' : `${a.quantita_disponibile} disp.`}
                          </span>
                        </div>
                      </div>
                      {inCarrello ? (
                        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                          <button onClick={()=>cambiaQta(a.id, -1)} style={{ width:28, height:28, background:C.surfaceHi, border:`1px solid ${C.border}`, borderRadius:5, color:C.text, cursor:'pointer', fontSize:14 }}>−</button>
                          <span style={{ minWidth:20, textAlign:'center', fontSize:14, fontWeight:700 }}>{inCarrello.quantita}</span>
                          <button onClick={()=>cambiaQta(a.id, +1)} style={{ width:28, height:28, background:C.surfaceHi, border:`1px solid ${C.border}`, borderRadius:5, color:C.text, cursor:'pointer', fontSize:14 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={()=>aggiungi(a)} disabled={esaurito} style={{ padding:'7px 12px', background:esaurito?C.surfaceHi:C.accent, color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:600, cursor:esaurito?'not-allowed':'pointer', flexShrink:0 }}>
                          + Prenota
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'prenotazioni' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {prenotazioni.length === 0 ? (
              <div style={{ textAlign:'center', color:C.muted, padding:40, fontSize:13 }}>Non hai ancora fatto prenotazioni.</div>
            ) : prenotazioni.map(p => {
              const isAttiva = p.stato==='attiva' && new Date(p.data_scadenza) > new Date()
              const stati: Record<string, {l:string; c:string}> = {
                attiva: { l:'⏰ Attiva', c:C.accent },
                completata: { l:'✓ Ritirata', c:C.green },
                scaduta: { l:'Scaduta', c:C.dim },
                annullata: { l:'Annullata', c:C.dim },
              }
              const statoLbl = isAttiva ? stati.attiva : stati[p.stato]
              return (
                <div key={p.id} style={{ background:C.surface, border:`1px solid ${isAttiva?C.accent+'44':C.border}`, borderRadius:8, padding:14, opacity:p.stato==='annullata'||p.stato==='scaduta'?0.6:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                    <div>
                      <span style={{ background:C.accentSoft, color:C.accent, padding:'2px 7px', borderRadius:4, fontSize:11, fontWeight:700, fontFamily:'monospace' }}>#{p.numero}</span>
                      <span style={{ marginLeft:8, fontSize:11, color:statoLbl.c, fontWeight:600 }}>{statoLbl.l}</span>
                    </div>
                    <strong style={{ fontSize:15, color:C.green }}>€ {Number(p.totale_stimato).toFixed(2)}</strong>
                  </div>
                  {isAttiva && (
                    <div style={{ fontSize:12, color:C.orange, marginBottom:10, padding:'6px 10px', background:'#1a1500', borderRadius:5 }}>
                      📦 Da ritirare entro: <strong>{new Date(p.data_scadenza).toLocaleString('it-IT', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</strong>
                    </div>
                  )}
                  <div style={{ marginBottom:isAttiva?10:0 }}>
                    {p.righe.map((r,i)=>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:i<p.righe.length-1?`1px dashed ${C.border}`:'none' }}>
                        <span style={{ flex:1 }}>{r.articolo_nome}</span>
                        <span style={{ color:C.muted }}>{r.quantita} × € {Number(r.prezzo_stimato||0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {p.note && <div style={{ fontSize:11, color:C.muted, fontStyle:'italic', marginTop:6 }}>📝 {p.note}</div>}
                  {isAttiva && (
                    <button onClick={()=>annulla(p.id)} style={{ marginTop:10, padding:'7px 12px', background:'transparent', color:C.red, border:`1px solid ${C.red}44`, borderRadius:5, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>🗑 Annulla prenotazione</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Carrello fisso in basso */}
      {carrello.length > 0 && tab==='catalogo' && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:C.surface, borderTop:`1px solid ${C.border}`, padding:'12px 16px', boxShadow:'0 -4px 20px rgba(0,0,0,0.5)', zIndex:20 }}>
          <div style={{ maxWidth:600, margin:'0 auto' }}>
            <button onClick={()=>setMostraCarrello(true)} style={{ ...btnPrimary, width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'12px 16px' }}>
              <span>🛒 {totalePezzi} pezzi nel carrello</span>
              <span>€ {totale.toFixed(2)} →</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal carrello */}
      {mostraCarrello && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:50, display:'flex', alignItems:'flex-end', padding:0 }} onClick={()=>setMostraCarrello(false)}>
          <div style={{ background:C.bg, width:'100%', maxHeight:'90vh', overflowY:'auto', borderRadius:'16px 16px 0 0', padding:20, animation:'slideUp 0.3s ease' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ margin:0, fontSize:18 }}>Conferma prenotazione</h2>
              <button onClick={()=>setMostraCarrello(false)} style={{ background:'none', border:'none', color:C.muted, fontSize:24, cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:14 }}>
              {carrello.map(x => (
                <div key={x.articolo_id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ flex:1, fontSize:13 }}>
                    <div>{x.nome}</div>
                    <div style={{ color:C.muted, fontSize:11 }}>{x.quantita} × € {x.prezzo_vendita.toFixed(2)}</div>
                  </div>
                  <strong style={{ color:C.green, fontSize:14 }}>€ {(x.quantita * x.prezzo_vendita).toFixed(2)}</strong>
                  <button onClick={()=>rimuovi(x.articolo_id)} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:16 }}>✕</button>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, fontSize:16, fontWeight:700 }}>
                <span>Totale</span>
                <span style={{ color:C.green }}>€ {totale.toFixed(2)}</span>
              </div>
            </div>

            {/* Scadenza */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.muted, fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Quando vieni a ritirare?</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <button onClick={()=>setScadenza('stasera')} style={{ padding:'12px 8px', background:scadenza==='stasera'?C.accentSoft:C.surface, border:`1px solid ${scadenza==='stasera'?C.accent:C.border}`, borderRadius:6, color:scadenza==='stasera'?C.accent:C.text, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
                  🌅 Entro stasera
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>(20:00)</div>
                </button>
                <button onClick={()=>setScadenza('domani')} style={{ padding:'12px 8px', background:scadenza==='domani'?C.accentSoft:C.surface, border:`1px solid ${scadenza==='domani'?C.accent:C.border}`, borderRadius:6, color:scadenza==='domani'?C.accent:C.text, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
                  🌆 Entro domani sera
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>(20:00)</div>
                </button>
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.muted, fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Note (opzionale)</div>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="es. cantiere via Roma..." style={inp} />
            </div>

            <button onClick={conferma} disabled={confermando} style={{ ...btnPrimary, width:'100%', background:C.green, padding:'14px', fontSize:14, opacity:confermando?0.6:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {confermando ? <><Spinner /> Prenotazione in corso...</> : `✓ Conferma prenotazione (€ ${totale.toFixed(2)})`}
            </button>
            <p style={{ fontSize:10, color:C.muted, textAlign:'center', marginTop:10, lineHeight:1.5 }}>
              I pezzi verranno tenuti da parte fino alla scadenza scelta. Se non passi a ritirarli, la prenotazione si annulla automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Ricevuta successo */}
      {ricevuta && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:C.surface, border:`2px solid ${C.green}`, borderRadius:14, padding:28, maxWidth:340, width:'100%', textAlign:'center' }}>
            <div style={{ fontSize:54, marginBottom:14 }}>✅</div>
            <h2 style={{ margin:'0 0 8px', fontSize:18, color:C.green }}>Prenotazione confermata!</h2>
            <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Numero <strong style={{ color:C.text }}>#{ricevuta.numero}</strong></div>
            <div style={{ background:C.surfaceHi, borderRadius:8, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>Totale stimato</div>
              <div style={{ fontSize:24, fontWeight:700, color:C.green }}>€ {ricevuta.totale.toFixed(2)}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>Da ritirare entro: <strong style={{ color:C.text }}>{ricevuta.scadenza}</strong></div>
            </div>
            <button onClick={()=>setRicevuta(null)} style={{ ...btnPrimary, width:'100%' }}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}
