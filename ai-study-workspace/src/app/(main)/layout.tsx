import React from "react";
import { Sidebar } from "@/components/Sidebar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh md:h-dvh md:overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-white text-slate-900 pb-24 md:pb-0">
        {children}
      </main>
    </div>
  );
}
