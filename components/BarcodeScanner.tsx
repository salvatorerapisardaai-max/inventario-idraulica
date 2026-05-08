'use client'

import { useEffect, useRef, useState } from 'react'

declare const BarcodeDetector: any

type Props = {
  onDetected: (code: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const activeRef = useRef(true)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState('Avvio fotocamera…')

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!('BarcodeDetector' in window)) {
      setError('Scanner non supportato. Usa Chrome su Android oppure Safari 17+ su iPhone.')
      return
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        })

        setHint('Inquadra il QR code o il barcode nel riquadro')

        async function detect() {
          if (!activeRef.current || !videoRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0 && activeRef.current) {
              activeRef.current = false
              onDetected(barcodes[0].rawValue)
              return
            }
          } catch {}
          animRef.current = requestAnimationFrame(detect)
        }

        animRef.current = requestAnimationFrame(detect)
      } catch {
        setError('Fotocamera non accessibile. Controlla i permessi del browser.')
      }
    }

    start()

    return () => {
      activeRef.current = false
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const C = {
    surface: '#1a1a1a', border: '#2a2a2a',
    text: '#e8e8e8', muted: '#888', accent: '#3b82f6', red: '#ef4444',
  }

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={onClose}
    >
      <div
        style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:20, width:'100%', maxWidth:360, display:'flex', flexDirection:'column', gap:14 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:16, color:C.text }}>📷 Scanner</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {error ? (
          <div style={{ background:'#3d1515', border:`1px solid ${C.red}44`, borderRadius:8, padding:16, textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
            <p style={{ color:C.red, fontSize:13, margin:0 }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Video con overlay QUADRATO — adatto sia per QR che barcode */}
            <div style={{ position:'relative', borderRadius:10, overflow:'hidden', background:'#000', aspectRatio:'1/1' }}>
              <video
                ref={videoRef}
                style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                muted
                playsInline
              />
              {/* Sfondo scuro attorno al riquadro */}
              <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                {/* Overlay scuro con finestra centrale quadrata */}
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position:'absolute', inset:0 }}>
                  <defs>
                    <mask id="scanMask">
                      <rect width="100" height="100" fill="white" />
                      <rect x="15" y="15" width="70" height="70" rx="2" fill="black" />
                    </mask>
                  </defs>
                  <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask="url(#scanMask)" />
                </svg>

                {/* Bordo blu del riquadro */}
                <div style={{
                  position:'absolute',
                  left:'15%', top:'15%', width:'70%', height:'70%',
                  border:`2px solid ${C.accent}`,
                  borderRadius:4,
                  boxSizing:'border-box',
                }} />

                {/* Angoli evidenziati */}
                {[
                  { top:'15%', left:'15%', borderTop:`3px solid ${C.accent}`, borderLeft:`3px solid ${C.accent}`, borderRadius:'4px 0 0 0' },
                  { top:'15%', right:'15%', borderTop:`3px solid ${C.accent}`, borderRight:`3px solid ${C.accent}`, borderRadius:'0 4px 0 0' },
                  { bottom:'15%', left:'15%', borderBottom:`3px solid ${C.accent}`, borderLeft:`3px solid ${C.accent}`, borderRadius:'0 0 0 4px' },
                  { bottom:'15%', right:'15%', borderBottom:`3px solid ${C.accent}`, borderRight:`3px solid ${C.accent}`, borderRadius:'0 0 4px 0' },
                ].map((style, i) => (
                  <div key={i} style={{ position:'absolute', width:20, height:20, ...style }} />
                ))}

                {/* Linea di scansione animata */}
                <div style={{
                  position:'absolute',
                  left:'15%', width:'70%', height:2,
                  background:`linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
                  animation:'scanline 1.8s ease-in-out infinite',
                  top:'50%',
                }} />
              </div>
            </div>

            <p style={{ color:C.muted, fontSize:12, textAlign:'center', margin:0, lineHeight:1.5 }}>
              {hint}<br />
              <span style={{ fontSize:11, color:'#555' }}>Funziona con QR code dell'app e codici a barre</span>
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes scanline {
          0%,100% { transform: translateY(-30px); opacity: 0.3; }
          50% { transform: translateY(30px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
