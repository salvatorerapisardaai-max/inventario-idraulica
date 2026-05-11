'use client'

/**
 * Componente isolato per upload immagine articolo.
 *
 * USO TIPICO nel form di modifica:
 *
 *   import ImageUpload from '@/components/ImageUpload'
 *
 *   const [fotoUrl, setFotoUrl] = useState<string | null>(articolo.foto_url ?? null)
 *
 *   <ImageUpload
 *     articoloId={articolo.id}
 *     currentUrl={fotoUrl}
 *     onChange={setFotoUrl}
 *   />
 *
 *   // poi al salvataggio del form:
 *   await supabase.from('articoli')
 *     .update({ foto_url: fotoUrl, ...altriCampi })
 *     .eq('id', articolo.id)
 *
 * COSA FA:
 *  - Compressione client-side a max 800×800 px in formato WebP (qualità 85%)
 *    → file tipici 30-150 KB, non scrivibili a mano
 *  - Upload su Supabase Storage (bucket "articoli-immagini")
 *  - Path file: {articoloId}/{timestamp}.webp
 *    → il timestamp fa da cache-busting al CDN, nessun problema di
 *      immagine "vecchia" che resta in cache dopo un cambio
 *  - Pulsanti separati per fotocamera e galleria su mobile
 *  - Preview live con stato (idle / compressione / upload / errore)
 *
 * COSA NON FA (di proposito):
 *  - NON elimina il vecchio file dallo Storage quando ne carichi uno nuovo.
 *    Mantenere lo storico costa pochissimo e protegge da rollback / errori.
 *    Una cleanup di file orfani si fa in seguito con job batch.
 *  - NON aggiorna il DB. Lo fa il form parent quando salva.
 *    Così "annulla" sul form NON lascia orfani nel DB (anche se nello Storage sì).
 */

import { useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BUCKET = 'articoli-immagini'
const MAX_DIM = 800           // px lato lungo
const WEBP_QUALITY = 0.85
const MAX_RAW_BYTES = 20 * 1024 * 1024  // 20 MB pre-compressione

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
        cacheControl: '31536000', // 1 anno: l'URL contiene timestamp, non c'è rischio stale
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Preview o slot vuoto */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
          background: '#0f0f0f',
          border: '1px dashed #2a2a2a',
          borderRadius: 12,
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
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(15,15,15,0.85)',
                  border: '1px solid #3a3a3a',
                  color: '#e05252',
                  width: 32, height: 32, borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 16, fontWeight: 700,
                  backdropFilter: 'blur(6px)',
                }}
              >
                ✕
              </button>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 6, opacity: 0.5 }}>🖼️</div>
            <div style={{ color: '#666', fontSize: 13 }}>Nessuna immagine</div>
            <div style={{ color: '#444', fontSize: 11, marginTop: 4 }}>
              Verrà mostrato il placeholder di categoria
            </div>
          </div>
        )}

        {/* Overlay durante upload/compressione */}
        {busy && (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(15,15,15,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, flexDirection: 'column',
            }}
          >
            <div style={{ color: '#60a5fa', fontSize: 14, fontWeight: 600 }}>
              {stato === 'compressione' ? '🔄 Ottimizzazione…' : '☁️ Caricamento…'}
            </div>
            <div style={{ color: '#666', fontSize: 11 }}>
              {stato === 'compressione' ? 'Ridimensiono e converto in WebP' : 'Invio al server'}
            </div>
          </div>
        )}
      </div>

      {/* Input nascosti: due varianti per gestire camera vs galleria su mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          handleFile(e.target.files?.[0])
          e.target.value = ''  // permette di ri-selezionare lo stesso file
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {/* Pulsanti azione */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy || disabled}
          style={btnPrimary(busy || disabled)}
        >
          📷 Scatta foto
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy || disabled}
          style={btnSecondary(busy || disabled)}
        >
          📁 Galleria
        </button>
      </div>

      {/* Messaggio errore */}
      {errore && (
        <div
          role="alert"
          style={{
            background: '#3d1515', border: '1px solid #e05252',
            color: '#e05252', borderRadius: 8, padding: '10px 12px',
            fontSize: 13, lineHeight: 1.4,
          }}
        >
          ⚠️ {errore}
        </div>
      )}
    </div>
  )
}

/* ---------- helper: compressione canvas-based ---------- */

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Calcolo dimensioni mantenendo aspect ratio
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
      if (!ctx) {
        reject(new Error('Canvas 2D non disponibile'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob)
          else reject(new Error('toBlob ha restituito null'))
        },
        'image/webp',
        WEBP_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Immagine non leggibile'))
    }

    img.src = objectUrl
  })
}

/* ---------- helper: stili pulsanti ---------- */

function btnPrimary(disabled: boolean | undefined): React.CSSProperties {
  return {
    flex: 1,
    padding: '12px 16px',
    background: disabled ? '#1a1a1a' : '#1e3a5f',
    color: disabled ? '#444' : '#60a5fa',
    border: '1px solid',
    borderColor: disabled ? '#2a2a2a' : '#1e3a5f',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  }
}

function btnSecondary(disabled: boolean | undefined): React.CSSProperties {
  return {
    flex: 1,
    padding: '12px 16px',
    background: disabled ? '#1a1a1a' : '#1a1a1a',
    color: disabled ? '#444' : '#ccc',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  }
}
