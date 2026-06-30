// =============================================================================
//  app/fatture-acquisto/[id]/RigheRevisione.tsx
//  Tabella per modificare articolo e markup_override di ogni riga.
// =============================================================================
'use client';
import { useState, useTransition } from 'react';
import { aggiornaMappingRiga } from '../azioni';

interface Riga {
  id: string;
  numero_linea: number;
  descrizione: string;
  quantita: number;
  unita_misura: string | null;
  prezzo_unitario: number;
  prezzo_totale: number;
  aliquota_iva: number | null;
  articolo_id: string | null;
  markup_override: number | null;
  caricato: boolean;
}
interface Articolo {
  id: string; nome: string; codice: string | null;
  prezzo_acquisto: number | null; usa_markup_auto: boolean | null;
}

const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default function RigheRevisione({ righe, articoli }: { righe: Riga[]; articoli: Articolo[] }) {
  const [stato, setStato] = useState<Record<string, { articolo_id: string | null; markup_override: number | null }>>(
    Object.fromEntries(righe.map((r) => [r.id, { articolo_id: r.articolo_id, markup_override: r.markup_override }]))
  );
  const [pending, start] = useTransition();
  const [salvando, setSalvando] = useState<string | null>(null);

  const salva = (rigaId: string) => {
    setSalvando(rigaId);
    start(async () => {
      await aggiornaMappingRiga(rigaId, stato[rigaId]);
      setSalvando(null);
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Descrizione</th>
            <th className="px-3 py-2 text-right">Q.tà</th>
            <th className="px-3 py-2 text-right">Prezzo</th>
            <th className="px-3 py-2 text-left">Articolo collegato</th>
            <th className="px-3 py-2 text-right">Markup %</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => {
            const s = stato[r.id];
            return (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{r.numero_linea}</td>
                <td className="px-3 py-2">{r.descrizione}</td>
                <td className="px-3 py-2 text-right">{r.quantita} {r.unita_misura ?? ''}</td>
                <td className="px-3 py-2 text-right">{euro(r.prezzo_unitario)}</td>
                <td className="px-3 py-2">
                  <select
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    value={s.articolo_id ?? ''}
                    onChange={(e) => setStato({ ...stato, [r.id]: { ...s, articolo_id: e.target.value || null } })}
                    disabled={r.caricato}
                  >
                    <option value="">— nessuno —</option>
                    {articoli.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.codice ? ` (${a.codice})` : ''}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number" step="0.01" placeholder="auto"
                    className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                    value={s.markup_override == null ? '' : (s.markup_override * 100)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStato({
                        ...stato,
                        [r.id]: { ...s, markup_override: v === '' ? null : Number(v) / 100 },
                      });
                    }}
                    disabled={r.caricato}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {r.caricato ? (
                    <span className="text-xs text-green-700">Caricato ✓</span>
                  ) : (
                    <button
                      onClick={() => salva(r.id)}
                      disabled={pending && salvando === r.id}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      {salvando === r.id ? 'Salvo…' : 'Salva'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
