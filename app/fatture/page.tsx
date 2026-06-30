// =============================================================================
//  app/fatture/page.tsx — Pagina "Fatture" (server component).
//  Client Supabase inline (no helper esterno).
// =============================================================================
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import NuovaFattura from './NuovaFattura';

export const dynamic = 'force-dynamic';

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

const STATI: Record<string, { label: string; cls: string }> = {
  bozza:      { label: 'Bozza',      cls: 'bg-gray-100 text-gray-700' },
  inviata:    { label: 'Inviata',    cls: 'bg-blue-100 text-blue-700' },
  consegnata: { label: 'Consegnata', cls: 'bg-green-100 text-green-700' },
  scartata:   { label: 'Scartata',   cls: 'bg-red-100 text-red-700' },
  errore:     { label: 'Errore',     cls: 'bg-red-100 text-red-700' },
};

const euro = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

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
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Fatture</h1>

      {!nAzienda && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm">
          Dati azienda non ancora configurati. Inserisci una riga nella tabella <code>azienda</code>
          {' '}(P.IVA, denominazione, indirizzo, regime RF01) per poter emettere fatture.
        </div>
      )}

      <NuovaFattura vendite={venditeDisponibili} disabilitato={!nAzienda} />

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Numero</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-right">Totale</th>
              <th className="px-3 py-2 text-left">Stato</th>
            </tr>
          </thead>
          <tbody>
            {(fatture ?? []).map((f: any) => {
              const s = STATI[f.stato] ?? STATI.bozza;
              return (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{f.numero}</td>
                  <td className="px-3 py-2">{f.data}</td>
                  <td className="px-3 py-2">{f.clienti?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{euro(f.totale)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
                  </td>
                </tr>
              );
            })}
            {(!fatture || fatture.length === 0) && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Nessuna fattura ancora.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
