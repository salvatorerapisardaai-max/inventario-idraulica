// =============================================================================
//  app/fatture/NuovaFattura.tsx — riquadro client per creare una fattura.
//  Sceglie una vendita e chiama la Server Action. Aggiorna la lista al successo.
// =============================================================================
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { emettiFatturaDaVendita } from './azioni';

interface VenditaOpt {
  id: string;
  numero: number;
  data: string;
  totale: number;
  cliente_nome: string | null;
  cliente_id: string | null;
}

const euro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default function NuovaFattura({
  vendite,
  disabilitato,
}: {
  vendite: VenditaOpt[];
  disabilitato: boolean;
}) {
  const [sel, setSel] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const genera = () => {
    if (!sel) return;
    setMsg(null);
    start(async () => {
      try {
        const r = await emettiFatturaDaVendita(sel);
        if (r.ok) {
          setMsg({ tipo: 'ok', testo: `Fattura n.${r.numero} creata — stato: ${r.stato}.` });
          setSel('');
          router.refresh();
        } else {
          setMsg({ tipo: 'err', testo: r.errore ?? 'Errore sconosciuto.' });
        }
      } catch (e: any) {
        setMsg({ tipo: 'err', testo: e?.message ?? 'Errore durante la generazione.' });
      }
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-2">Crea fattura da una vendita</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="min-w-[18rem] rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          disabled={disabilitato || pending}
        >
          <option value="">— seleziona una vendita —</option>
          {vendite.map((v) => (
            <option key={v.id} value={v.id}>
              #{v.numero} · {v.data?.slice(0, 10)} · {v.cliente_nome ?? 'cliente n.d.'} · {euro(v.totale)}
            </option>
          ))}
        </select>
        <button
          onClick={genera}
          disabled={disabilitato || pending || !sel}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Genero…' : 'Genera fattura'}
        </button>
      </div>

      {disabilitato && (
        <p className="mt-2 text-xs text-amber-700">Configura prima i dati azienda.</p>
      )}
      {vendite.length === 0 && !disabilitato && (
        <p className="mt-2 text-xs text-gray-500">Nessuna vendita disponibile da fatturare.</p>
      )}
      {msg && (
        <p className={`mt-2 text-sm ${msg.tipo === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
          {msg.testo}
        </p>
      )}
    </div>
  );
}
