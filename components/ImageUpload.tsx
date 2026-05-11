'use client'

/**
 * Componente isolato per upload immagine articolo.
 * Usa createBrowserClient (@supabase/ssr) — coerente col resto dell'app.
 */

import { useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BUCKET = 'articoli-immagini'
const MAX_DIM = 800
const WEBP_QUALITY = 0.85
const MAX_RAW_BYTES = 20 * 1024 * 1024

type Props = {
  articoloId: string
  currentUrl: string | null | undefined
  onChange: (newUrl: string | null) => void
  disabled?: boolean
}

type Stato = 'idle' | 'compressione' | 'upload'

export default function ImageUpload({ articoloId, currentUrl, onChange, disabled }: Props) {
  const [stato, setStato] = useState<Stato>('idle')
  const [errore, setErrore] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const busy = stato !== 'idle'

  async function handleFile(file: File | undefined) {
    if (!file) return
    setErrore(null)

    if (!file.type.startsWith('image/')) {
      setErrore("Il file selezionato non è un'immagine")
      return
    }
    if (file.size > MAX_RAW_BYTES) {
      setErrore(`Immagine troppo grande: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 20 MB)`)
      return
    }

    setStato('compressione')
    let blob: Blob
    try {
      blob = await compressImage(file)
    } catch (e) {
      setErrore(`Errore nella compressione: ${(e as Error).message}`)
      setStato('idle')
      return
    }

    setStato('upload')
    const path = `${articoloId}/${Date.now()}.webp`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: false,
      })
    if (upErr) {
      setErrore(`Upload fallito: ${upErr.message}`)
      setStato('idle')
      return
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    onChange(data.publicUrl)
    setStato('idle')
  }

  function handleRemove() {
    if (!confirm("Rimuovere l'immagine? L'articolo userà il placeholder di categoria.")) return
    onChange(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#0f0f0f',
          border: '1px dashed #2a2a2a',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt="Immagine articolo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {!busy && !disabled && (
              <button
                type="button"
                onClick={handleRemove}
                aria-label="Rimuovi immagine"
                style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(15,15,15,0.85)',
                  border: '1px solid #3a3a3a',
                  color: '#ef4444',
                  width: 28, height: 28, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  backdropFilter: 'blur(6px)',
                }}
              >
                ✕
              </button>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>🖼️</div>
            <div style={{ color: '#666', fontSize: 11 }}>Nessuna immagine</div>
          </div>
        )}

        {busy && (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(15,15,15,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, flexDirection: 'column',
            }}
          >
            <div style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600 }}>
              {stato === 'compressione' ? '🔄 Ottimizzazione…' : '☁️ Caricamento…'}
            </div>
          </div>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy || disabled}
          style={btn(busy || disabled, true)}
        >
          📷 Foto
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy || disabled}
          style={btn(busy || disabled, false)}
        >
          📁 Galleria
        </button>
      </div>

      {errore && (
        <div role="alert" style={{
          background: '#3d1515', border: '1px solid #ef4444',
          color: '#ef4444', borderRadius: 6, padding: '8px 10px',
          fontSize: 12, lineHeight: 1.4,
        }}>
          ⚠️ {errore}
        </div>
      )}
    </div>
  )
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width)
          width = MAX_DIM
        } else {
          width = Math.round((width * MAX_DIM) / height)
          height = MAX_DIM
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D non disponibile')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => { if (blob) resolve(blob); else reject(new Error('toBlob ha restituito null')) },
        'image/webp',
        WEBP_QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Immagine non leggibile')) }
    img.src = objectUrl
  })
}

function btn(disabled: boolean | undefined, primary: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '9px 10px',
    background: disabled ? '#1a1a1a' : (primary ? '#1e3a5f' : '#1a1a1a'),
    color: disabled ? '#444' : (primary ? '#3b82f6' : '#ccc'),
    border: '1px solid',
    borderColor: disabled ? '#2a2a2a' : (primary ? '#1e3a5f' : '#2a2a2a'),
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }
}
