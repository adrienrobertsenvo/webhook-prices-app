import { headers } from 'next/headers';
import { getSubscriptions } from '@/lib/kv';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const defaultTargetUrl = `${proto}://${host}/api/webhook`;
  const initialSubscriptions = await getSubscriptions();

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <div className="mb-8">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← Back to dashboard</a>
        <h1 className="text-2xl font-bold tracking-tight mt-3">Create Webhook Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect Senvo to this app to start receiving selling price events.
        </p>
      </div>
      <SetupForm defaultTargetUrl={defaultTargetUrl} initialSubscriptions={initialSubscriptions} />
    </main>
  );
}
