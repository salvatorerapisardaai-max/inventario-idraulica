# 🔧 Inventario Idraulica

Sistema di gestione inventario per attività di idraulica con **analisi AI automatica dei componenti**.

**🌐 Live:** [inventario-idraulica.vercel.app](https://inventario-idraulica.vercel.app)

---

## ✨ Panoramica

**Inventario Idraulica** è una piattaforma web moderna progettata specificamente per le attività di idraulica. Consente di:

- **Gestire il magazzino** con catalogo completo (foto, descrizioni, prezzi)
- **Analizzare componenti automaticamente** tramite IA generativa (Claude Sonnet)
- **Organizzare fisicamente** gli articoli in zone gerarchiche
- **Monitorare stock** con alert di riordino automatici
- **Tracciare movimenti** di magazzino storico
- **Esportare dati** in CSV per reportistica

---

## 🎯 Funzionalità Principali

### 📦 Gestione Inventario
- Catalogo articoli con foto, descrizione, prezzo e posizione
- Classificazione gerarchica per zone (A → B → C → D → sezione)
- Ricerca e filtri avanzati
- Anagrafiche fornitori

### 🤖 Analisi AI
- Riconoscimento automatico dei componenti idraulici da foto
- Estrazione dati strutturati (tipo, modello, specifiche)
- Integrazione con Claude Sonnet 4.6 di Anthropic

### ⚠️ Monitoraggio Stock
- Alert automatici per articoli sotto soglia
- Notifiche di riordino
- Storico movimenti tracciato

### 💾 Export & Reporting
- Export CSV completo del catalogo
- Reportistica per fornitore
- Analisi giacenze per area

### 🔐 Autenticazione
- Accesso tramite Supabase Auth
- Protezione delle rotte sensibili
- Sessioni sicure

---

## 🛠️ Stack Tecnologico

| Aspetto | Tecnologia |
|---------|-----------|
| **Frontend** | Next.js 14 (App Router) + React 18 |
| **Linguaggio** | TypeScript 5 |
| **Database** | Supabase (PostgreSQL) |
| **Autenticazione** | Supabase Auth |
| **AI/ML** | Anthropic Claude Sonnet 4.6 |
| **Deploy** | Vercel |
| **Styling** | CSS/Tailwind (inferred) |

---

## 📋 Prerequisiti

- **Node.js** 18+ 
- **npm** o **yarn**
- Account **Supabase** con progetto creato
- Account **Anthropic** con API key per Claude

---

## 🚀 Setup Locale

### 1. Clona il repository
```bash
git clone https://github.com/salvatorerapisardaai-max/inventario-idraulica.git
cd inventario-idraulica
```

### 2. Installa dipendenze
```bash
npm install
```

### 3. Configura variabili d'ambiente
```bash
cp .env.local.example .env.local
```

Compila `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Come ottenere le credenziali:**
- **Supabase URL e Anon Key:** Dashboard Supabase → Settings → API
- **Anthropic API Key:** [console.anthropic.com](https://console.anthropic.com)

### 4. Esegui il server di sviluppo
```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

### 5. Build per produzione
```bash
npm run build
npm start
```

---

## 🔄 Struttura del Progetto

```
inventario-idraulica/
├── app/                 # Next.js App Router pages
├── components/          # React components riutilizzabili
├── lib/                 # Utility e servizi
├── middleware.ts        # Protezione rotte & auth
├── package.json         # Dipendenze
├── tsconfig.json        # Configurazione TypeScript
└── README.md            # Questo file
```

---

## 🌐 Deploy su Vercel

### Opzione 1: Deploy Automatico
1. Connetti il repository a [Vercel Dashboard](https://vercel.com)
2. Imposta le variabili d'ambiente nel progetto
3. Ogni push su `main` triggera un nuovo deploy

### Opzione 2: Manuale
```bash
npm install -g vercel
vercel --prod
```

**Variabili d'ambiente in Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`

---

## 📚 Script Disponibili

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia server di sviluppo (port 3000) |
| `npm run build` | Build per produzione |
| `npm start` | Esegui build produzione |
| `npm run lint` | ESLint check |

---

## 🔐 Autenticazione & Sicurezza

- **Middleware di protezione:** Route protezione via Supabase Auth
- **Rotte pubbliche:** `/login`, `/articolo/:id`, `/cliente/:id`
- **Gestione sessioni:** Cookie-based tramite Supabase SSR
- **CSRF protection:** Built-in via Next.js

---

## 🚧 Roadmap Futura

- [ ] Dashboard con grafici analitici
- [ ] Notifiche push per alert stock
- [ ] Integrazione con Telegram/WhatsApp
- [ ] App mobile nativa
- [ ] Barcode/QR code scanning
- [ ] Integrazione e-commerce

---

## 🤝 Contribuire

Le pull request sono benvenute! Per cambiamenti significativi:

1. Fai un fork del repository
2. Crea un branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit i cambiamenti (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

---

## 📄 Licenza

Questo progetto è privato. Vedi il repository per dettagli.

---

## 👤 Autore

**Salvatore Rapisarda** — [GitHub](https://github.com/salvatorerapisardaai-max)

---

## 📞 Supporto

Per bug report, feature request o domande:
- Apri una [Issue su GitHub](https://github.com/salvatorerapisardaai-max/inventario-idraulica/issues)
- O contatta direttamente l'autore

---

## 🔗 Link Utili

- 📖 [Documentazione Next.js](https://nextjs.org/docs)
- 🔑 [Documentazione Supabase](https://supabase.com/docs)
- 🤖 [Documentazione Anthropic Claude](https://docs.anthropic.com)
- 🚀 [Guida Deploy Vercel](https://vercel.com/docs)

---

**Ultimo aggiornamento:** Giugno 2026
