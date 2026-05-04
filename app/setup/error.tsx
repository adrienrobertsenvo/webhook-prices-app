'use client';

export default function SetupError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Something went wrong</h1>
      <pre className="rounded bg-red-50 border border-red-200 p-4 text-xs text-red-700 whitespace-pre-wrap break-all mb-4">
        {error.message}
        {'\n'}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        Try again
      </button>
    </main>
  );
}
