'use client'

import { useEffect, useState } from 'react'
import { supabase, type StoricoPrezzoAcquisto } from '@/lib/supabase'

/**
 * Pannello che mostra lo storico prezzi di acquisto per un articolo.
 *
 * Layout: lista cronologica decrescente (più recente in alto), con badge
 * fornitore, prezzo e data. Mostra anche delta percentuale rispetto al
 * record precedente per evidenziare aumenti/cali.
 *
 * Da inserire nel dettaglio articolo, ad esempio dopo i campi prezzi:
 *   <StoricoPrezziPanel articoloId={articolo.id} />
 */

const MESI_IT = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
]

export default function StoricoPrezziPanel({ articoloId }: { articoloId: string }) {
  const [records, setRecords] = useState<StoricoPrezzoAcquisto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('storico_prezzi_acquisto')
        .select('*, fornitori(id, nome)')
        .eq('articolo_id', articoloId)
        .order('data_stimata', { ascending: false, nullsFirst: false })

      if (cancelled) return
      if (error) setError(error.message)
      else setRecords((data || []) as StoricoPrezzoAcquisto[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [articoloId])

  if (loading) {
    return (
      <div style={{ padding: 12, color: 'var(--muted, #888)', fontSize: 13 }}>
        Caricamento storico…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 12, color: 'var(--red, #c93030)', fontSize: 13 }}>
        Errore caricamento storico: {error}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div
        style={{
          padding: 12,
          color: 'var(--muted, #888)',
          fontSize: 12,
          fontStyle: 'italic',
        }}
      >
        Nessuno storico prezzi disponibile per questo articolo.
      </div>
    )
  }

  // Calcolo i delta % rispetto al record precedente cronologicamente (records è desc, quindi il "precedente" è records[i+1])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--muted, #888)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        Storico prezzi acquisto ({records.length} rilevazioni)
      </div>

      {records.map((r, i) => {
        const prev = records[i + 1]
        const delta = prev ? ((r.prezzo - prev.prezzo) / prev.prezzo) * 100 : null
        const data = formatPeriodo(r.anno, r.mese)
        const fornNome = r.fornitori?.nome || r.fornitore_alias || '?'

        return (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderBottom: '1px solid var(--border, #eee)',
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={fornNome}
              >
                {fornNome}
              </div>
              {!r.fornitori && r.fornitore_alias && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--muted, #aaa)',
                    fontStyle: 'italic',
                  }}
                >
                  (non in anagrafica)
                </div>
              )}
            </div>

            <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              €&nbsp;{r.prezzo.toFixed(3).replace(/\.?0+$/, '')}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 2,
                minWidth: 56,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--muted, #888)' }}>{data}</span>
              {delta !== null && Math.abs(delta) >= 1 && (
                <span
                  style={{
                    fontSize: 10,
                    fontVariantNumeric: 'tabular-nums',
                    color: delta > 0 ? 'var(--red, #c93030)' : 'var(--green, #2a7a3f)',
                  }}
                >
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatPeriodo(anno: number | null, mese: number | null): string {
  if (anno && mese) return `${MESI_IT[mese - 1]} ${String(anno).slice(-2)}`
  if (anno) return String(anno)
  return '—'
}
