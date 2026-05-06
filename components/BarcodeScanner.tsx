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

        setHint('Inquadra il codice a barre nella zona blu')

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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }} onClick={onClose}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:20, width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:16 }} onClick={e=>e.stopPropagation()}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:16, color:C.text }}>📷 Scanner Barcode</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {error ? (
          <div style={{ background:'#3d1515', border:`1px solid ${C.red}44`, borderRadius:8, padding:16, textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
            <p style={{ color:C.red, fontSize:13, margin:0 }}>{error}</p>
          </div>
        ) : (
          <>
            <div style={{ position:'relative', borderRadius:10, overflow:'hidden', background:'#000', aspectRatio:'4/3' }}>
              <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} muted playsInline />
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <div style={{ position:'relative', width:'75%', height:80 }}>
                  <div style={{ position:'absolute', inset:0, boxShadow:'0 0 0 9999px rgba(0,0,0,0.45)', borderRadius:6 }} />
                  <div style={{ position:'absolute', inset:0, border:`2px solid ${C.accent}`, borderRadius:6 }} />
                  <div style={{ position:'absolute', left:4, right:4, height:2, background:`linear-gradient(90deg, transparent, ${C.accent}, transparent)`, animation:'scanline 1.5s ease-in-out infinite', top:'50%' }} />
                </div>
              </div>
            </div>
            <p style={{ color:C.muted, fontSize:12, textAlign:'center', margin:0 }}>{hint}</p>
          </>
        )}
      </div>
      <style>{`@keyframes scanline{0%,100%{transform:translateY(-28px);opacity:.4}50%{transform:translateY(28px);opacity:1}}`}</style>
    </div>
  )
}
