'use client'

type Articolo = {
  id: string
  nome: string
  codice?: string
  categoria?: string
  posizione?: string
  zona_codice?: string
}

type Props = {
  articolo: Articolo
  onClose: () => void
}

export function QRModal({ articolo, onClose }: Props) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const articoloUrl = `${baseUrl}/articolo/${articolo.id}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(articoloUrl)}&bgcolor=1a1a1a&color=ffffff&margin=10`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(articoloUrl)
    alert('Link copiato!')
  }

  const handlePrintLabel = () => {
    window.open(`/stampa/${articolo.id}`, '_blank')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }} onClick={onClose}>
      <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:16, padding:'24px 24px 20px', width:'100%', maxWidth:340, display:'flex', flexDirection:'column', alignItems:'center' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <h2 style={{ margin:0, fontSize:16, color:'#fff' }}>QR Code</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#666', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <p style={{ color:'#aaa', fontSize:13, margin:'0 0 20px', textAlign:'center' }}>
          {articolo.nome}
          {articolo.codice && <span style={{ color:'#666', marginLeft:8, fontFamily:'monospace' }}>· {articolo.codice}</span>}
        </p>
        <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:12, padding:12, marginBottom:12 }}>
          <img src={qrSrc} alt="QR Code" style={{ width:220, height:220, borderRadius:8, display:'block' }} />
        </div>
        <div style={{ width:'100%', background:'#111', border:'1px solid #2a2a2a', borderRadius:6, padding:'8px 12px', textAlign:'center' }}>
          <span style={{ color:'#666', fontSize:11, wordBreak:'break-all' }}>{articoloUrl}</span>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, width:'100%' }}>
          <button onClick={handleCopyLink} style={{ flex:1, padding:'10px 0', background:'#2a2a2a', color:'#ccc', border:'1px solid #333', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>📋 Copia link</button>
          <button onClick={handlePrintLabel} style={{ flex:1, padding:'10px 0', background:'#3b82f6', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>🖨️ Stampa</button>
        </div>
        <p style={{ color:'#555', fontSize:11, textAlign:'center', marginTop:16 }}>
          Il cliente scansiona → vede la scheda prodotto in tempo reale
        </p>
      </div>
    </div>
  )
}
