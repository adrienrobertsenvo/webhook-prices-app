'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ResetButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!window.confirm('Delete all selling price events? This cannot be undone.')) return;
    setLoading(true);
    await fetch('/api/reset', { method: 'POST' });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
    >
      {loading ? 'Clearing…' : 'Reset data'}
    </button>
  );
}
