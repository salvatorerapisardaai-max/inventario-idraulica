// =============================================================================
//  app/fatture-acquisto/ImportaXml.tsx — upload XML del fornitore.
// =============================================================================
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { importaXmlAcquisto } from './azioni';

export default function ImportaXml() {
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const onFile = async (file: File) => {
    setMsg(null);
    const xml = await file.text();
    start(async () => {
      const r = await importaXmlAcquisto(xml);
      if (r.ok) {
        setMsg({ tipo: 'ok', testo: 'XML importato. Apri la fattura per controllare il mapping articoli.' });
        router.refresh();
      } else {
        setMsg({ tipo: 'err', testo: r.errore ?? 'Errore durante l\'import.' });
      }
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-2">Importa una fattura di acquisto (XML)</h2>
      <input
        type="file"
        accept=".xml,application/xml,text/xml,.p7m"
        disabled={pending}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        className="block text-sm"
      />
      <p className="mt-2 text-xs text-gray-500">
        Quando Aruba sarà collegato, le fatture entranti compariranno qui in automatico (codice destinatario <code>KRRH6B9</code> da registrare nell'AdE).
      </p>
      {msg && (
        <p className={`mt-2 text-sm ${msg.tipo === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{msg.testo}</p>
      )}
    </div>
  );
}
