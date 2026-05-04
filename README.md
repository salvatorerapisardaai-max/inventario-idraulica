# Inventario Idraulica

Sistema di gestione inventario per attività di idraulica con analisi AI dei componenti.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Database:** Supabase (PostgreSQL)
- **AI:** Claude Sonnet 4.6 (analisi automatica delle foto)
- **Deploy:** Vercel

## Funzionalità

- Inventario completo con foto, descrizione, prezzi, posizione
- Analisi AI automatica dei componenti da foto
- Dropdown gerarchico delle zone fisiche del negozio (A → B → C → D, fino a sezione)
- Alert articoli sotto soglia di riordino
- Storico movimenti automatico
- Gestione fornitori
- Export CSV

## Variabili d'ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

## Setup locale

```bash
npm install
cp .env.local.example .env.local  # compila con le credenziali
npm run dev
```

## Deploy

Importa il repository su Vercel, imposta le variabili d'ambiente nel pannello Vercel, e il deploy parte automatico ad ogni push.
