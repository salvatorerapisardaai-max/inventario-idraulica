// =============================================================================
//  app/fatture-acquisto/page.tsx — Pagina "Fatture di acquisto"
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import ImportaXml from './ImportaXml';

export const dynamic = 'force-dynamic';

const STATI: Record<string, { label: string; cls: string }> = {
  ricevuta:     { label: 'Ricevuta',     cls: 'bg-blue-100 text-blue-700' },
  in_revisione: { label: 'Da rivedere',  cls: 'bg-amber-100 text-amber-800' },
  registrata:   { label: 'Registrata',   cls: 'bg-green-100 text-green-700' },
  errore:       { label: 'Errore',       cls: 'bg-red-100 text-red-700' },
};

const euro = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default async function FattureAcquistoPage() {
  const supabase = await createClient();
  const { data: fatture } = await supabase
    .from('fatture_acquisto')
    .select('id, numero, data, totale, stato, fornitore_nome_snapshot, fornitori(nome)')
    .order('data', { ascending: false });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Fatture di acquisto</h1>

      <ImportaXml />

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Numero</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Fornitore</th>
              <th className="px-3 py-2 text-right">Totale</th>
              <th className="px-3 py-2 text-left">Stato</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(fatture ?? []).map((f: any) => {
              const s = STATI[f.stato] ?? STATI.ricevuta;
              return (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{f.numero}</td>
                  <td className="px-3 py-2">{f.data}</td>
                  <td className="px-3 py-2">{f.fornitori?.nome ?? f.fornitore_nome_snapshot ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{euro(f.totale)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a className="text-blue-600 hover:underline" href={`/fatture-acquisto/${f.id}`}>Apri</a>
                  </td>
                </tr>
              );
            })}
            {(!fatture || fatture.length === 0) && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Nessuna fattura di acquisto.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
