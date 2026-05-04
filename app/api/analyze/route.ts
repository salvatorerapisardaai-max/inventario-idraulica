import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const PROMPT = `Sei un esperto di materiale idraulico italiano (raccordi, valvole, tubi, scaldabagni, pompe, fluidmaster, sali-scendi, motori, filtri, ecc.).

Analizza l'immagine e rispondi SOLO con un JSON valido (no markdown, no backtick, niente testo prima o dopo). Schema:

{
  "nome": "nome breve max 4 parole",
  "categoria": "una tra: Raccordi | Valvole | Tubi e Tubazioni | Guarnizioni e O-ring | Pompe | Filtri | Manometri e Strumenti | Rubinetteria | Giunti | Accessori | Altro",
  "descrizione": "descrizione tecnica breve (materiale, dimensioni se visibili, specifiche)",
  "utilizzo": "contesto di utilizzo tipico nell'idraulica civile o industriale",
  "confidenza": "alta | media | bassa"
}`

export async function POST(req: Request) {
  try {
    const { image_base64, media_type } = await req.json()

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 mancante' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY non configurata sul server' },
        { status: 500 }
      )
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: media_type || 'image/jpeg',
                  data: image_base64,
                },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `API Anthropic: ${res.status}`, detail: errText },
        { status: 500 }
      )
    }

    const data = await res.json()
    const text = (data.content || []).find((b: any) => b.type === 'text')?.text || ''
    const cleaned = text.trim().replace(/^```json\s*|```\s*$/g, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json(
        { error: 'Risposta AI non parsabile come JSON', raw: text },
        { status: 500 }
      )
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore generico' }, { status: 500 })
  }
}
