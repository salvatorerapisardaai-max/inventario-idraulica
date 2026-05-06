'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Articolo = {
  id: string
  nome: string
  codice?: string
  categoria?: string
  descrizione?: string
  utilizzo?: string
  foto_url?: string
  prezzo_vendita?: number
  quantita: number
  soglia_riordino: number
  posizione?: string
  fornitori?: { nome: string } | null
  zone?: { codice: string; nome: string } | null
}

export default function ArticoloPage({ params }: { params: { id: string } }) {
  const [articolo, setArticolo] = useState<Articolo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function fetchArticolo() {
      const { data, error } = await supabase
        .from('articoli')
        .select(`id, nome, codice, categoria, descrizione, utilizzo,
          foto_url, prezzo_vendita, quantita, soglia_riordino, posizione,
          fornitori ( nome ), zone ( codice, nome )`)
        .eq('id', params.id)
        .single()
      if (error || !data) setNotFound(true)
      else setArticolo(data as unknown as Articolo) 
      setLoading(false)
    }
    fetchArticolo()
  }, [params.id])

  const disponibile = articolo && articolo.quantita > articolo.soglia_riordino
  const esaurito = articolo && articolo.quantita === 0

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0f0f0f' }}>
      <p style={{ color:'#888' }}>Caricamento…</p>
    </div>
  )

  if (notFound || !articolo) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0f0f0f' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
      <h2 style={{ color:'#fff', margin:0 }}>Articolo non trovato</h2>
      <p style={{ color:'#888' }}>Il codice QR potrebbe essere obsoleto.</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0f0f0f', padding:'0 0 40px', fontFamily:'-apple-system, sans-serif', maxWidth:480, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'20px 20px 16px', borderBottom:'1px solid #1e1e1e' }}>
        <div style={{ fontSize:28 }}>🔧</div>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Idraulica</div>
          <div style={{ color:'#666', fontSize:12 }}>Scheda Prodotto</div>
        </div>
      </div>

      {articolo.foto_url && (
        <div style={{ width:'100%', height:240, overflow:'hidden', background:'#1a1a1a' }}>
          <img src={articolo.foto_url} alt={articolo.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
      )}

      <div style={{ margin:'16px 16px 0', background:'#1a1a1a', borderRadius:12, padding:20, border:'1px solid #2a2a2a' }}>
        {articolo.categoria && (
          <span style={{ display:'inline-block', background:'#1e3a5f', color:'#60a5fa', fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, textTransform:'uppercase', marginBottom:10 }}>
            {articolo.categoria}
          </span>
        )}
        <h1 style={{ color:'#fff', fontSize:22, fontWeight:700, margin:'0 0 6px', lineHeight:1.3 }}>{articolo.nome}</h1>
        {articolo.codice && <p style={{ color:'#666', fontSize:12, margin:'0 0 16px', fontFamily:'monospace' }}>Codice: {articolo.codice}</p>}

        <div style={{
          display:'inline-flex', alignItems:'center', padding:'6px 14px', borderRadius:8, border:'1px solid',
          fontSize:14, fontWeight:600, marginBottom:16,
          background: esaurito ? '#3d1515' : disponibile ? '#0f2d1f' : '#2d1f0f',
          borderColor: esaurito ? '#e05252' : disponibile ? '#22c55e' : '#f59e0b',
          color: esaurito ? '#e05252' : disponibile ? '#22c55e' : '#f59e0b',
        }}>
          {esaurito ? '❌ Esaurito' : disponibile ? '✅ Disponibile' : '⚠️ Scorte limitate'}
          {!esaurito && <span style={{ marginLeft:8, opacity:0.7, fontSize:12 }}>({articolo.quantita} pz)</span>}
        </div>

        {articolo.prezzo_vendita && articolo.prezzo_vendita > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #2a2a2a' }}>
            <span style={{ color:'#888', fontSize:13 }}>Prezzo</span>
            <span style={{ color:'#fff', fontSize:24, fontWeight:700 }}>€ {Number(articolo.prezzo_vendita).toFixed(2)}</span>
          </div>
        )}
      </div>

      <div style={{ margin:'12px 16px 0', background:'#1a1a1a', borderRadius:12, padding:20, border:'1px solid #2a2a2a' }}>
        {articolo.descrizione && (
          <div style={{ marginBottom:16 }}>
            <span style={{ display:'block', fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>📋 Descrizione</span>
            <p style={{ color:'#ccc', fontSize:14, margin:0, lineHeight:1.5 }}>{articolo.descrizione}</p>
          </div>
        )}
        {articolo.utilizzo && (
          <div style={{ marginBottom:16 }}>
            <span style={{ display:'block', fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>🔩 Utilizzo</span>
            <p style={{ color:'#ccc', fontSize:14, margin:0, lineHeight:1.5 }}>{articolo.utilizzo}</p>
          </div>
        )}
        {(articolo.zone || articolo.posizione) && (
          <div style={{ marginBottom:16 }}>
            <span style={{ display:'block', fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>📍 Posizione</span>
            <p style={{ color:'#ccc', fontSize:14, margin:0 }}>
              {articolo.zone ? `${articolo.zone.codice} — ${articolo.zone.nome}` : articolo.posizione}
            </p>
          </div>
        )}
        {articolo.fornitori && (
          <div>
            <span style={{ display:'block', fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>🏭 Fornitore</span>
            <p style={{ color:'#ccc', fontSize:14, margin:0 }}>{articolo.fornitori.nome}</p>
          </div>
        )}
      </div>

      <p style={{ textAlign:'center', color:'#444', fontSize:11, marginTop:24, padding:'0 20px' }}>
        Scansiona il QR sul prodotto per aggiornamenti in tempo reale
      </p>
    </div>
  )
  }
