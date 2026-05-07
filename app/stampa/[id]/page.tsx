'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StampaPage({ params }: { params: { id: string } }) {
  const [articolo, setArticolo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const articoloUrl = `${baseUrl}/articolo/${params.id}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(articoloUrl)}&bgcolor=ffffff&color=000000&margin=5`

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('articoli')
        .select('nome, codice, categoria, posizione, zone(codice, nome)')
        .eq('id', params.id)
        .single()
      setArticolo(data)
      setLoading(false)
    }
    fetch()
  }, [params.id])

  useEffect(() => {
    if (!loading && articolo) {
      const img = document.getElementById('qr-img') as HTMLImageElement
      if (!img) return
      if (img.complete) window.print()
      else img.onload = () => window.print()
    }
  }, [loading, articolo])

  if (loading) return <div style={{ padding:40, fontFamily:'sans-serif' }}>Caricamento…</div>
  if (!articolo) return <div style={{ padding:40, fontFamily:'sans-serif' }}>Articolo non trovato.</div>

  const posizione = articolo.zone?.codice || articolo.posizione || '—'

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:white}
        .label{width:90mm;height:55mm;border:1.5px solid #000;border-radius:4px;padding:6px 8px;display:flex;gap:10px;align-items:center;margin:8mm auto}
        .qr-box{flex-shrink:0;width:42mm;height:42mm}
        .qr-box img{width:100%;height:100%;display:block}
        .info{flex:1;display:flex;flex-direction:column;gap:5px;overflow:hidden}
        .shop{font-size:7pt;color:#666;text-transform:uppercase;letter-spacing:0.1em}
        .nome{font-size:11pt;font-weight:700;color:#000;line-height:1.2}
        .codice{font-size:8pt;color:#444;font-family:monospace}
        .categoria{font-size:7.5pt;color:#555}
        .pos-box{margin-top:auto;background:#f0f0f0;border-radius:3px;padding:3px 6px;display:inline-flex;align-items:center;gap:4px}
        .pos-label{font-size:6.5pt;color:#888;text-transform:uppercase;letter-spacing:0.1em}
        .pos-value{font-size:10pt;font-weight:700;color:#000;font-family:monospace}
        .no-print{text-align:center;padding:20px;font-size:13px;color:#666}
        @media print{.no-print{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      `}</style>

      <div className="no-print">
        Preparazione stampa…&nbsp;
        <button onClick={()=>window.print()} style={{ padding:'6px 14px', cursor:'pointer', background:'#3b82f6', color:'#fff', border:'none', borderRadius:5 }}>
          🖨️ Stampa manualmente
        </button>
      </div>

      <div className="label">
        <div className="qr-box">
          <img id="qr-img" src={qrSrc} alt="QR" />
        </div>
        <div className="info">
          <div className="shop">🔧 Idraulica</div>
          <div className="nome">{articolo.nome}</div>
          {articolo.codice && <div className="codice">{articolo.codice}</div>}
          {articolo.categoria && <div className="categoria">{articolo.categoria}</div>}
          <div className="pos-box">
            <span className="pos-label">Pos.</span>
            <span className="pos-value">{posizione}</span>
          </div>
        </div>
      </div>
    </>
  )
}
