'use client'

import { useState } from 'react'

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
    const posizione = articolo.zona_codice || articolo.posizione || '—'
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Etichetta — ${articolo.nome}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; }
          .label {
            width: 90mm; height: 55mm;
            border: 1.5px solid #000; border-radius: 4px;
            padding: 6px 8px; display: flex; gap: 10px;
            align-items: center; margin: 8mm auto;
          }
          .qr-box { flex-shrink: 0; width: 42mm; height: 42mm; }
          .qr-box img { width: 100%; height: 100%; display: block; }
          .info { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
          .shop { font-size: 7pt; color: #666; text-transform: uppercase; letter-spacing: 0.1em; }
          .nome { font-size: 11pt; font-weight: 700; color: #000; line-height: 1.2; }
          .codice { font-size: 8pt; color: #444; font-family: monospace; }
          .categoria { font-size: 7.5pt; color: #555; }
          .posizione-box {
            margin-top: auto; background: #f0f0f0; border-radius: 3px;
            padding: 3px 6px; display: inline-flex; align-items: center; gap: 4px;
          }
          .pos-label { font-size: 6.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }
          .pos-value { font-size: 10pt; font-weight: 700; color: #000; font-family: monospace; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="qr-box">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(articoloUrl)}&bgcolor=ffffff&color=000000&margin=5" />
          </div>
          <div class="info">
            <div class="shop">🔧 Idraulica</div>
            <div class="nome">${articolo.nome}</div>
            ${articolo.codice ? `<div class="codice">${articolo.codice}</div>` : ''}
            ${articolo.categoria ? `<div class="categoria">${articolo.categoria}</div>` : ''}
            <div class="posizione-box">
              <span class="pos-label">Pos.</span>
              <span class="pos-value">${posizione}</span>
            </div>
          </div>
        </div>
        <script>
          window.onload = () => {
            const img = document.querySelector('img')
            if (img && img.complete) { window.print(); window.close(); }
            else if (img) { img.onload = () => { window.print(); window.close(); } }
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={modalHeader}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#fff' }}>QR Code</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <p style={{ color: '#aaa', fontSize: 13, margin: '0 0 20px', textAlign: 'center' }}>
          {articolo.nome}
          {articolo.codice && <span style={{ color: '#666', marginLeft: 8, fontFamily: 'monospace' }}>· {articolo.codice}</span>}
        </p>
        <div style={qrWrapper}>
          <img src={qrSrc} alt="QR Code" style={{ width: 220, height: 220, borderRadius: 8, display: 'block' }} />
        </div>
        <div style={urlBox}>
          <span style={{ color: '#666', fontSize: 11, wordBreak: 'break-all' }}>
            {articoloUrl}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={handleCopyLink} style={btnSecondary}>📋 Copia link</button>
          <button onClick={handlePrintLabel} style={btnPrimary}>🖨️ Stampa etichetta</button>
        </div>
        <p style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
          Il cliente scansiona → vede la scheda prodotto in tempo reale
        </p>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
}
const modal: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16,
  padding: '24px 24px 20px', width: '100%', maxWidth: 340,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
}
const modalHeader: React.CSSProperties = {
  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
}
const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', padding: '0 4px',
}
const qrWrapper: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 12, marginBottom: 12,
}
const urlBox: React.CSSProperties = {
  width: '100%', background: '#111', border: '1px solid #2a2a2a',
  borderRadius: 6, padding: '8px 12px', textAlign: 'center',
}
const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 0', background: '#3b82f6', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px 0', background: '#2a2a2a', color: '#ccc',
  border: '1px solid #333', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
