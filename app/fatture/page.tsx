// =============================================================================
//  app/fatture/page.tsx — Pagina "Fatture" (server component).
//  Client Supabase inline. Stile inline coerente con InventarioApp.tsx.
// =============================================================================
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CSSProperties } from 'react';
import NuovaFattura from './NuovaFattura';

export const dynamic = 'force-dynamic';

const C = { bg:'#0f0f0f', surface:'#1a1a1a', surfaceHi:'#222', border:'#2a2a2a', text:'#e8e8e8', muted:'#888', accent:'#3b82f6', accentSoft:'#1e3a5f', red:'#ef4444', green:'#22c55e', orange:'#f97316' };

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}

const STATI: Record<string, { label: string; bg: string; color: string }> = {
  bozza:      { label: 'Bozza',      bg: C.surfaceHi,  color: C.muted },
  inviata:    { label: 'Inviata',    bg: C.accentSoft, color: C.accent },
  consegnata: { label: 'Consegnata', bg: '#0f2d1f',    color: C.green },
  scartata:   { label: 'Scartata',   bg: '#3d1515',    color: C.red },
  errore:     { label: 'Errore',     bg: '#3d1515',    color: C.red },
};

const euro = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

const th: CSSProperties = { padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em' };
const td: CSSProperties = { padding:'10px 12px', fontSize:13, color:C.text, borderTop:`1px solid ${C.border}` };

export default async function FatturePage() {
  const supabase = await getSupabase();

  const { data: fatture } = await supabase
    .from('fatture')
    .select('id, numero, data, totale, stato, clienti(nome)')
    .order('created_at', { ascending: false });

  const { count: nAzienda } = await supabase
    .from('azienda').select('*', { count: 'exact', head: true });

  const { data: vendite } = await supabase
    .from('vendite')
    .select('id, numero, data, totale, cliente_nome, cliente_id')
    .order('data', { ascending: false })
    .limit(50);

  const { data: linkFatture } = await supabase.from('fatture').select('vendita_id');
  const giaFatturate = new Set((linkFatture ?? []).map((f: any) => f.vendita_id).filter(Boolean));
  const venditeDisponibili = (vendite ?? []).filter((v: any) => !giaFatturate.has(v.id));

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text, fontFamily:'system-ui, sans-serif' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <a href="/" style={{ color:C.muted, textDecoration:'none', fontSize:13 }}>← Gestionale</a>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700 }}>🧾 Fatture</h1>
        </div>

        {!nAzienda && (
          <div style={{ marginBottom:16, borderRadius:8, border:`1px solid ${C.orange}55`, background:'#2d1f0f', padding:'12px 14px', color:C.orange, fontSize:13 }}>
            Dati azienda non ancora configurati. Inserisci una riga nella tabella <code>azienda</code> (P.IVA, denominazione, indirizzo, regime RF01) per poter emettere fatture.
          </div>
        )}

        <NuovaFattura vendite={venditeDisponibili} disabilitato={!nAzienda} />

        <div style={{ marginTop:24, overflowX:'auto', borderRadius:10, border:`1px solid ${C.border}` }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead style={{ background:C.surface }}>
              <tr>
                <th style={th}>Numero</th>
                <th style={th}>Data</th>
                <th style={th}>Cliente</th>
                <th style={{ ...th, textAlign:'right' }}>Totale</th>
                <th style={th}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {(fatture ?? []).map((f: any) => {
                const s = STATI[f.stato] ?? STATI.bozza;
                return (
                  <tr key={f.id}>
                    <td style={{ ...td, fontWeight:600 }}>{f.numero}</td>
                    <td style={td}>{f.data}</td>
                    <td style={td}>{f.clienti?.nome ?? '—'}</td>
                    <td style={{ ...td, textAlign:'right' }}>{euro(f.totale)}</td>
                    <td style={td}>
                      <span style={{ display:'inline-block', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:600, background:s.bg, color:s.color }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
              {(!fatture || fatture.length === 0) && (
                <tr><td colSpan={5} style={{ ...td, textAlign:'center', color:C.muted, padding:'24px 12px' }}>Nessuna fattura ancora.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
