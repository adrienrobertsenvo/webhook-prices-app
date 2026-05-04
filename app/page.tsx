import { getEvents } from '@/lib/kv';
import type { StoredEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EVENT_TYPE_COLORS: Record<StoredEvent['event_type'], string> = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
};

export default async function DashboardPage() {
  const events = await getEvents();

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Selling Prices</h1>
        <p className="text-sm text-gray-500 mt-1">
          {events.length} event{events.length !== 1 ? 's' : ''} received · newest first
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No selling price events yet. Push one from Senvo to see it here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-100">
              <tr>
                {[
                  'Event ID', 'Type', 'SP ID', 'Charge ID',
                  'Amount', 'Ref Date', 'Tenant', 'Received',
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e, i) => (
                <tr key={e.webhook_event_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.webhook_event_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_COLORS[e.event_type]}`}>
                      {e.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.selling_price_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.charge_id}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {e.net_amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: e.currency,
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{e.charge_reference_date}</td>
                  <td className="px-4 py-3 text-gray-600">{e.tenant_slug}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-500 whitespace-nowrap">
                    {new Date(e.received_at).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
