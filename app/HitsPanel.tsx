'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WebhookHit } from '@/lib/types';

const RESULT_STYLES: Record<WebhookHit['result'], string> = {
  stored:             'bg-green-100 text-green-700',
  ignored:            'bg-gray-100 text-gray-500',
  invalid_signature:  'bg-red-100 text-red-700',
  no_secret:          'bg-orange-100 text-orange-700',
  invalid_json:       'bg-yellow-100 text-yellow-700',
  error:              'bg-red-100 text-red-700',
};

export default function HitsPanel() {
  const [hits, setHits] = useState<WebhookHit[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch('/api/webhook/hits')
      .then((r) => r.json())
      .then((data: WebhookHit[]) => setHits(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  if (hits.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          Webhook hits <span className="text-gray-400 font-normal text-sm">({hits.length})</span>
        </h2>
        <button onClick={refresh} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {['Received', 'Result', 'Status', 'Signature', 'Body'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hits.map((hit, i) => (
              <>
                <tr
                  key={i}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <td className="px-4 py-2 tabular-nums text-xs text-gray-500 whitespace-nowrap">
                    {new Date(hit.received_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RESULT_STYLES[hit.result]}`}>
                      {hit.result.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs tabular-nums">{hit.status}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500 truncate max-w-xs">{hit.signature}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400 truncate max-w-xs">
                    {hit.body.slice(0, 80)}{hit.body.length > 80 ? '…' : ''}
                  </td>
                </tr>
                {expanded === i && (
                  <tr key={`${i}-detail`} className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-3">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all text-gray-700 max-h-64 overflow-y-auto">
                        {(() => { try { return JSON.stringify(JSON.parse(hit.body), null, 2); } catch { return hit.body; } })()}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
