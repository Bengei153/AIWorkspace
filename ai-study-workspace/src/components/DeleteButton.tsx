"use client";

export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      title={`Delete ${label}`}
      aria-label={`Delete ${label}`}
      onClick={() => {
        if (window.confirm(`Delete ${label}? This cannot be undone.`)) onDelete();
      }}
      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3" />
      </svg>
    </button>
  );
}
