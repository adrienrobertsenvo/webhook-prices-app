'use client';

import { useState } from 'react';

interface SetupResult {
  signing_secret?: string;
  subscription_id?: string;
  error?: string;
}

export default function SetupForm({ defaultTargetUrl }: { defaultTargetUrl: string }) {
  const [result, setResult] = useState<SetupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/setup', { method: 'POST', body: new FormData(e.currentTarget) });
    setResult(await res.json());
    setLoading(false);
  }

  async function copySecret() {
    if (!result?.signing_secret) return;
    await navigator.clipboard.writeText(result.signing_secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <select
            name="eventType"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
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

      {result?.signing_secret && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-green-800">Subscription created ✓</p>
            <p className="text-xs text-green-600 mt-0.5">ID: {result.subscription_id}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              ⚠️ Copy this signing secret — shown only once
            </p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 rounded border bg-white px-3 py-2 text-xs font-mono break-all">
                {result.signing_secret}
              </code>
              <button
                onClick={copySecret}
                className="shrink-0 rounded border bg-white px-3 text-xs font-medium hover:bg-gray-50"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-semibold">Next steps:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Go to <strong>Vercel → your project → Settings → Environment Variables</strong></li>
              <li>Add <code className="rounded bg-white px-1 py-0.5 border">WEBHOOK_SIGNING_SECRET</code> = the value above</li>
              <li>Redeploy (Deployments → latest → Redeploy)</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
