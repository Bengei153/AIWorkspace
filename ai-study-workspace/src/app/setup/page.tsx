import Link from "next/link";

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase text-indigo-700">Private workspace setup</p>
      <h1 className="mt-2 text-3xl font-semibold">Connect your database</h1>
      <p className="mt-3 text-slate-600">Sign-in and cloud sync stay locked until a Supabase project is configured. Your workspace data is not exposed publicly.</p>
      <ol className="mt-8 list-decimal space-y-4 pl-5 text-sm text-slate-700">
        <li>Create a Supabase project and copy its Project URL and publishable key.</li>
        <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code> and in your deployment environment.</li>
        <li>Run <code>supabase/migrations/202609270001_private_user_workspaces.sql</code> in the Supabase SQL Editor.</li>
        <li>Set the Supabase Auth Site URL to your deployed domain and allow <code>/auth/confirm</code> as a redirect URL.</li>
        <li>Restart the development server, then create an account or sign in.</li>
      </ol>
      <p className="mt-8 text-sm text-slate-500">Use only the publishable key in the <code>NEXT_PUBLIC_</code> variable. Never put a Supabase secret or service-role key in browser code.</p>
      <Link href="https://supabase.com/dashboard" className="mt-6 inline-flex rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white">Open Supabase dashboard</Link>
    </main>
  );
}
