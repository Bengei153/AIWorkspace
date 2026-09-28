"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { findCourse, getProviderKeyName, PROVIDERS, readMaterialFile, saveCourse, type StudyCourse, type StudySection } from "@/lib/workspace";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SAMPLE_SECTION: StudySection = {
  id: "sample-inheritance",
  title: "Inheritance in object-oriented design",
  css: ".lesson-content h1{color:#2563eb;font-size:2rem}.lesson-content h2{color:#7c3aed;margin-top:1.8rem}.lesson-content .callout{background:#eef2ff;border-left:4px solid #6366f1;padding:14px 18px;border-radius:8px}.lesson-content code{background:#e2e8f0;padding:2px 5px;border-radius:4px}.lesson-content details{border:1px solid #d8dee9;border-radius:8px;padding:12px 16px;margin-top:12px}.lesson-content summary{font-weight:600;cursor:pointer}",
  html: "<h1>Inheritance in object-oriented design</h1><p>Inheritance lets one class reuse and extend the behavior of another. It is useful when several types share a meaningful <strong>is-a</strong> relationship.</p><div class=\"callout\"><strong>Picture it:</strong> A Student is a Person. The student has the person's name and email, plus a student ID.</div><h2>A small example</h2><pre><code>class Person {\n  String name;\n  String email;\n}\n\nclass Student extends Person {\n  String studentId;\n}</code></pre><p><code>Student</code> inherits the shared fields and adds its own. Each class keeps a clear responsibility.</p><details><summary>Check your understanding</summary><p>Is a Lecturer a Person? Which fields could Lecturer inherit, and what would remain specific to Lecturer?</p></details>",
};

function previewDocument(section: StudySection) {
  const css = (section.css ?? "").replace(/<\/style/gi, "<\\/style");
  const js = (section.js ?? "").replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'"><style>body{font-family:Arial,sans-serif;color:#17202a;margin:0;padding:24px;line-height:1.65}a{color:#2563eb}${css}</style></head><body><main class="lesson-content">${section.html}</main><script>${js}</script></body></html>`;
}

export default function StudySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { workspaceReady, workspaceRevision } = useAuth();
  const searchParams = useSearchParams();
  const [course, setCourse] = useState<StudyCourse>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mode, setMode] = useState<"ask" | "design">("ask");
  const [provider, setProvider] = useState<string>(PROVIDERS[0].id);
  const [model, setModel] = useState<string>(PROVIDERS[0].model);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  const [sourcePdfs, setSourcePdfs] = useState<{ id: string; name: string; url: string }[]>([]);
  const [pdfLoadError, setPdfLoadError] = useState("");
  const [studyView, setStudyView] = useState<"lesson" | "pdf">("lesson");
  const [selectedPdfId, setSelectedPdfId] = useState("");

  useEffect(() => {
    if (!workspaceReady) return;
    // Refresh saved lesson state after sign-in and same-account sync events.
    const saved = findCourse(id);
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCourse(saved);
      setProvider(saved.provider);
      setModel(saved.model);
      setActiveIndex(Math.max(0, Number(searchParams.get("lesson") ?? 0)));
    } else {
      setCourse({ id, name: "OOAD", description: "Object-Oriented Analysis and Design", provider: PROVIDERS[0].id, model: PROVIDERS[0].model, materials: [], sections: [SAMPLE_SECTION], updatedAt: new Date().toISOString() });
    }
  }, [id, searchParams, workspaceReady, workspaceRevision]);

  const materialCourseId = course?.id;
  const sourceMaterials = useMemo(() => course?.materials.filter((material) => material.type === "pdf" && material.id) ?? [], [course?.materials]);

  useEffect(() => {
    if (!materialCourseId) return;
    let current = true;
    const urls: string[] = [];
    let loadError = "";
    void Promise.all(sourceMaterials.map(async (material) => {
      try {
        const blob = await readMaterialFile(materialCourseId, material.id!);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { id: material.id!, name: material.name, url };
      } catch {
        loadError ||= "A source PDF could not be downloaded from your private cloud storage. Check that you are signed into the same account and that the storage migration is applied.";
        return null;
      }
    })).then((loaded) => {
      if (!current) {
        urls.forEach(URL.revokeObjectURL);
        return;
      }
      const available = loaded.filter((item): item is { id: string; name: string; url: string } => item !== null);
      setSourcePdfs(available);
      setPdfLoadError(available.length ? "" : loadError);
      setSelectedPdfId((selected) => available.some((item) => item.id === selected) ? selected : available[0]?.id ?? "");
    });
    return () => {
      current = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [materialCourseId, sourceMaterials]);

  const sections = course?.sections ?? [];
  const active = sections[activeIndex] ?? sections[0] ?? SAMPLE_SECTION;
  const pdfMaterials = sourceMaterials;
  const selectedPdf = sourcePdfs.find((pdf) => pdf.id === selectedPdfId);
  const lessonCount = Math.max(sections.length, 1);
  const progress = Math.round(((activeIndex + 1) / lessonCount) * 100);
  const providerLabel = useMemo(() => PROVIDERS.find((item) => item.id === provider)?.label ?? provider, [provider]);

  function updateCourse(next: StudyCourse) {
    setCourse(next);
    if (next.id !== id || next.id === "") return;
    if (next.sections[0]?.id !== "sample-inheritance") saveCourse(next);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    setUpdated(false);
    setMessages((current) => [...current, { role: "user", content: text }]);
    setBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "ask" ? "question" : "design",
          provider,
          model,
          courseName: course?.name,
          materials: course?.materials,
          lesson: active,
          question: mode === "ask" ? text : undefined,
          styleNotes: mode === "design" ? text : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The assistant could not complete that update.");
      const revised = mode === "ask"
        ? { ...active, html: result.updatedHtml, css: result.updatedCss ?? active.css, js: result.updatedJs ?? active.js }
        : { ...active, html: result.html, css: result.css, js: result.js ?? active.js };
      const next = { ...course!, provider, model, sections: sections.map((item, index) => index === activeIndex ? revised : item), updatedAt: new Date().toISOString() };
      updateCourse(next);
      setMessages((current) => [...current, { role: "assistant", content: mode === "ask" ? result.replyHtml : result.note }]);
      setUpdated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reach the assistant.");
    } finally {
      setBusy(false);
    }
  }

  if (!course) return <div className="grid h-dvh place-items-center text-sm text-slate-500">Loading study session…</div>;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-slate-900">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 text-sm text-slate-500"><Link href="/courses" className="hover:text-slate-900">Courses</Link><span>/</span><span className="truncate font-medium text-slate-900">{course.name}</span></div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
          <ThemeToggle compact />
          <button onClick={() => setAssistantOpen((open) => !open)} aria-label={assistantOpen ? "Close study assistant" : "Open study assistant"} title={assistantOpen ? "Close study assistant" : "Open study assistant"} className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700">{assistantOpen ? "Hide tutor" : "Ask tutor"}</button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 sm:flex">
          <div className="border-b border-slate-200 p-4"><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Learning path</div><div className="mt-1 text-xs text-slate-400">{sections.length} lessons</div></div>
          <nav className="space-y-1 p-2">{sections.map((section, index) => <button key={section.id} onClick={() => { setActiveIndex(index); setUpdated(false); }} className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm ${index === activeIndex ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}><span className="mt-0.5 text-[11px] text-slate-400">{String(index + 1).padStart(2, "0")}</span><span>{section.title}</span></button>)}</nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-white p-4 sm:p-8">
          <div className="mx-auto max-w-4xl">
            <label className="mb-4 block sm:hidden"><span className="sr-only">Choose lesson</span><select value={activeIndex} onChange={(event) => { setActiveIndex(Number(event.target.value)); setUpdated(false); }} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm">{sections.map((section, index) => <option key={section.id} value={index}>{String(index + 1).padStart(2, "0")} · {section.title}</option>)}</select></label>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Lesson {activeIndex + 1} of {lessonCount}</div><h1 className="mt-1 text-2xl font-semibold text-slate-900">{active.title}</h1></div>{updated && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Reading updated</span>}</div>
            <div role="tablist" aria-label="Study content" className="mb-3 flex border-b border-slate-200">
              <button role="tab" aria-selected={studyView === "lesson"} onClick={() => setStudyView("lesson")} className={`border-b-2 px-3 py-2.5 text-xs font-medium sm:px-4 sm:text-sm ${studyView === "lesson" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>Interactive lesson</button>
              {pdfMaterials.length > 0 && <button role="tab" aria-selected={studyView === "pdf"} onClick={() => setStudyView("pdf")} className={`border-b-2 px-3 py-2.5 text-xs font-medium sm:px-4 sm:text-sm ${studyView === "pdf" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>Source PDF <span className="ml-1 text-xs text-slate-400">{pdfMaterials.length}</span></button>}
            </div>
            {studyView === "lesson" ? <iframe key={`${active.id}-${active.html.length}-${active.js?.length ?? 0}`} title={`Interactive lesson: ${active.title}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewDocument(active)} className="h-[min(62dvh,760px)] min-h-[360px] w-full rounded-lg border border-slate-200 bg-white sm:h-[min(68vh,760px)] sm:min-h-[430px]" /> : <section aria-label="Original PDF" className="flex h-[min(70dvh,900px)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:h-[min(78vh,900px)] sm:min-h-[540px]">
              {pdfMaterials.length > 1 && <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2"><label htmlFor="source-pdf" className="text-xs font-medium text-slate-600">Source material</label><select id="source-pdf" value={selectedPdfId} onChange={(event) => setSelectedPdfId(event.target.value)} className="max-w-[70%] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">{pdfMaterials.map((material, index) => <option key={material.id ?? index} value={material.id ?? ""}>{material.name}</option>)}</select></div>}
              {selectedPdf ? <iframe key={selectedPdf.id} title={`Original PDF: ${selectedPdf.name}`} src={selectedPdf.url} className="min-h-0 w-full flex-1 bg-white" /> : <div className="grid flex-1 place-items-center p-6 text-center text-sm text-slate-600">{pdfLoadError || "No viewable PDF is attached to this course."}</div>}
            </section>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-400">Using {providerLabel} · {model}</span><div className="flex gap-2"><button disabled={activeIndex <= 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-40">Previous</button><button disabled={activeIndex >= lessonCount - 1} onClick={() => setActiveIndex((index) => Math.min(lessonCount - 1, index + 1))} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Next lesson</button></div></div>
          </div>
        </main>
        {assistantOpen && <aside className="flex w-[340px] flex-shrink-0 flex-col border-l border-slate-200 bg-white max-lg:absolute max-lg:bottom-0 max-lg:right-0 max-lg:top-14 max-lg:z-10 max-lg:w-[min(92vw,380px)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><div className="text-sm font-semibold text-slate-900">Study assistant</div><div className="text-xs text-slate-500">Can read this lesson&apos;s HTML and CSS</div></div><button onClick={() => setAssistantOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close assistant">×</button></div>
          <div className="grid grid-cols-2 border-b border-slate-200 p-2"><button onClick={() => setMode("ask")} className={`rounded-md px-3 py-2 text-sm ${mode === "ask" ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>Ask</button><button onClick={() => setMode("design")} className={`rounded-md px-3 py-2 text-sm ${mode === "design" ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>Design</button></div>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2"><select aria-label="AI provider" value={provider} onChange={(event) => { const item = PROVIDERS.find((entry) => entry.id === event.target.value)!; setProvider(item.id); setModel(item.model); }} className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs">{PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input aria-label="Model" value={model} onChange={(event) => setModel(event.target.value)} className="min-w-0 w-[46%] rounded-md border border-slate-200 px-2 py-1.5 text-xs" /></div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">{messages.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{mode === "ask" ? "Ask about this lesson. Answers are added to the reading so you can revisit them." : "Describe a change to the lesson's colors, layout, examples, or interactions."}<div className="mt-3 text-xs text-slate-400">{getProviderKeyName(provider)} is read from the server environment.</div></div>}{messages.map((message, index) => <div key={index} className={message.role === "user" ? "ml-8 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900" : "mr-2 rounded-lg border border-slate-200 bg-white p-2"}>{message.role === "user" ? message.content : <iframe title="Assistant response" sandbox="" referrerPolicy="no-referrer" srcDoc={previewDocument({ ...active, html: message.content, css: "", js: "" })} className="h-40 w-full border-0" />}</div>)}{busy && <div className="text-sm text-slate-500">Updating lesson…</div>}{error && <div role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</div>}{updated && <div className="text-xs font-medium text-emerald-700">The lesson reading has been saved.</div>}</div>
          <div className="border-t border-slate-200 p-3"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={3} placeholder={mode === "ask" ? "Ask a question about this lesson…" : "Describe the change you want…"} className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /><div className="mt-2 flex items-center justify-between"><span className="text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line</span><button onClick={() => void sendMessage()} disabled={busy || !input.trim()} aria-label="Send message" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Send</button></div></div>
        </aside>}
      </div>
    </div>
  );
}
