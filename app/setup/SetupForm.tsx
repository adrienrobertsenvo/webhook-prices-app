'use client';

import { useState, useEffect } from 'react';
import type { StoredSubscription } from '@/lib/types';

interface CreateResult {
  signing_secret?: string;
  subscription_id?: string;
  target_url?: string;
  object_type?: string;
  event_type?: string;
  is_active?: boolean;
  error?: string;
}

export default function SetupForm({ defaultTargetUrl }: { defaultTargetUrl: string }) {
  const [result, setResult] = useState<CreateResult | null>(null);
  const [saved, setSaved] = useState<StoredSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((data: StoredSubscription[]) => setSaved(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/setup', { method: 'POST', body: formData });
      const data: CreateResult = await res.json();
      setResult(data);
      if (data.subscription_id && !data.error) {
        // Refresh the server-side list
        fetch('/api/subscriptions')
          .then((r) => r.json())
          .then((list: StoredSubscription[]) => setSaved(list))
          .catch(() => {});
      }
    } catch {
      setResult({ error: 'Unexpected error — please try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senvo API Key ID</label>
          <input
            name="apiKeyId"
            type="text"
            required
            placeholder="Find this in app.senvo.ai → Settings → API Keys"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senvo API Key Secret</label>
          <input
            name="apiKeySecret"
            type="password"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Target URL</label>
          <input
            name="targetUrl"
            type="url"
            required
            defaultValue={defaultTargetUrl}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
          <select name="eventType" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
            <option value="created">created</option>
            <option value="updated">updated</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">Run this twice to subscribe to both created and updated.</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Subscription'}
        </button>
      </form>

      {result?.error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Error</p>
          <p className="mt-1 text-sm text-red-600">{result.error}</p>
        </div>
      )}

      {result?.subscription_id && !result.error && (
        <SubscriptionCard sub={result} copied={copied} onCopy={copySecret} isNew />
      )}

      {saved.length > 0 && (
        <div className="mt-10">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Previously created subscriptions</h2>
          <div className="space-y-3">
            {saved.map((sub) => (
              <SubscriptionCard key={sub.subscription_id} sub={sub} copied={false} onCopy={copySecret} isNew={false} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SubscriptionCard({
  sub,
  copied,
  onCopy,
  isNew,
}: {
  sub: CreateResult | StoredSubscription;
  copied: boolean;
  onCopy: (s: string) => void;
  isNew: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{isNew ? 'Subscription created' : 'Subscription'}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sub.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {sub.is_active ? 'active' : 'inactive'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-500">ID</span>
        <span className="font-mono text-gray-800 truncate">{sub.subscription_id}</span>
        <span className="text-gray-500">Object type</span>
        <span className="text-gray-800">{sub.object_type}</span>
        <span className="text-gray-500">Event type</span>
        <span className="text-gray-800">{sub.event_type}</span>
        <span className="text-gray-500">Target URL</span>
        <span className="font-mono text-gray-800 truncate">{sub.target_url}</span>
      </div>
      {sub.signing_secret && (
        <div>
          <p className="text-xs font-semibold text-amber-700 mb-1">Signing secret — copy now, shown only once</p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 rounded border bg-amber-50 px-3 py-2 text-xs font-mono break-all">
              {sub.signing_secret}
            </code>
            <button
              type="button"
              onClick={() => onCopy(sub.signing_secret as string)}
              className="shrink-0 rounded border px-3 text-xs font-medium hover:bg-gray-50"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 space-y-0.5">
            <p className="font-medium">Next steps:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Vercel &rarr; Settings &rarr; Environment Variables &rarr; set <code className="bg-gray-100 px-1 rounded">WEBHOOK_SIGNING_SECRET</code></li>
              <li>Redeploy</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
