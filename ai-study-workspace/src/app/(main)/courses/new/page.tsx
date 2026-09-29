"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import { flushWorkspaceSync, PROVIDERS, saveCourse, saveMaterialFile, type StudyMaterial, type StudyCourse } from "@/lib/workspace";
import { useAuth } from "@/components/AuthProvider";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

async function extractPowerPointText(file: File) {
  const archive = await JSZip.loadAsync(file);
  const slides = Object.keys(archive.files)
    .map((path) => ({ path, match: path.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((item): item is { path: string; match: RegExpMatchArray } => Boolean(item.match))
    .sort((left, right) => Number(left.match[1]) - Number(right.match[1]))
    .slice(0, 60);
  if (!slides.length) throw new Error("No readable slides were found in this presentation.");

  const extracted: string[] = [];
  for (const [index, slide] of slides.entries()) {
    const entry = archive.file(slide.path);
    if (!entry) continue;
    const xml = await entry.async("string");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) continue;
    const text = Array.from(document.getElementsByTagNameNS("*", "t"))
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (text) extracted.push(`[Slide ${index + 1}]\n${text}`);
    if (extracted.join("\n\n").length >= 12000) break;
  }
  const content = extracted.join("\n\n").slice(0, 12000).trim();
  if (!content) throw new Error("No readable text was found in the presentation slides.");
  return content;
}

export default function NewCoursePage() {
  const router = useRouter();
  const { workspaceReady } = useAuth();
  const [topic, setTopic] = useState("");
  const [provider, setProvider] = useState<string>(PROVIDERS[0].id);
  const [model, setModel] = useState<string>(PROVIDERS[0].model);
  const [materials, setMaterials] = useState<(StudyMaterial & { file?: File })[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    const incoming: (StudyMaterial & { file?: File })[] = [];
    for (const file of Array.from(files).slice(0, Math.max(0, 12 - materials.length))) {
      const extension = file.name.toLowerCase().split(".").pop();
      const isPdf = extension === "pdf";
      const isWord = extension === "docx";
      const isPowerPoint = extension === "pptx";
      const isText = ["txt", "md", "markdown", "csv"].includes(extension ?? "");
      if (!isPdf && !isWord && !isPowerPoint && !isText) {
        setError(`${file.name} is not supported. Upload PDF, DOCX, PPTX, TXT, Markdown, or CSV materials.`);
        continue;
      }
      if (file.size > 10_000_000) {
        setError(`${file.name} is over the 10 MB per-file limit.`);
        continue;
      }
      try {
        if (isPdf) {
          const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
          try {
            const document = await loadingTask.promise;
            const pages: string[] = [];
            for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 30); pageNumber += 1) {
              const page = await document.getPage(pageNumber);
              const text = await page.getTextContent();
              pages.push(`[PDF page ${pageNumber}]\n${text.items.map((item) => "str" in item ? item.str : "").join(" ")}`);
              if (pages.join("\n").length >= 12000) break;
            }
            const content = pages.join("\n\n").slice(0, 12000).trim();
            if (!content) throw new Error("No readable text was found. This PDF may contain scanned images.");
            incoming.push({ id: crypto.randomUUID(), name: file.name, content, type: "pdf", file });
          } finally {
            await loadingTask.destroy();
          }
        } else if (isWord) {
          const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
          const content = result.value.trim().slice(0, 12000);
          if (!content) throw new Error("No readable text was found in this Word document.");
          incoming.push({ id: crypto.randomUUID(), name: file.name, content, type: "word", file });
        } else if (isPowerPoint) {
          const content = await extractPowerPointText(file);
          incoming.push({ id: crypto.randomUUID(), name: file.name, content, type: "powerpoint", file });
        } else {
          incoming.push({ id: crypto.randomUUID(), name: file.name, content: (await file.text()).slice(0, 12000), type: "text" });
        }
      } catch (reason) {
        setError(`${file.name}: ${reason instanceof Error ? reason.message : "Could not read this file."}`);
      }
    }
    setMaterials((current) => [...current, ...incoming].slice(0, 12));
  }

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!workspaceReady) throw new Error("Your private workspace is still connecting. Try again shortly.");
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "path", provider, model, topic, materials: materials.map(({ name, content }) => ({ name, content })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create the learning path.");
      const course: StudyCourse = {
        id: crypto.randomUUID(),
        name: result.name,
        description: result.description,
        provider,
        model,
        materials: materials.map(({ id, name, content, type }) => ({ id, name, content, type })),
        sections: result.sections,
        updatedAt: new Date().toISOString(),
      };
      for (const material of materials) {
        if (material.file && material.id) await saveMaterialFile(course.id, material.id, material.file, material.name);
      }
      saveCourse(course);
      await flushWorkspaceSync();
      router.push(`/courses/${course.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the learning path.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-12">
      <div className="flex items-center space-x-2 text-sm text-slate-500 mb-8">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <span>/</span>
        <Link href="/courses" className="hover:text-slate-900">Courses</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">New project</span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Create a learning path</h1>
      <p className="text-slate-500 mb-10">Start with your study materials, a topic, or both.</p>
      <form onSubmit={createCourse} className="space-y-6">
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-slate-700 mb-2">What do you want to learn?</label>
          <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis, from basics to exam revision" className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white" />
        </div>
        <div className="rounded-lg border border-slate-200 p-4 sm:p-5">
          <label htmlFor="materials" className="block text-sm font-medium text-slate-800">Study materials</label>
          <p className="text-xs text-slate-500 mt-1 mb-4">Upload up to 12 PDF, DOCX Word, PPTX PowerPoint, TXT, Markdown, or CSV files, each up to 10 MB. Text is extracted for lesson generation; original Office and PDF files stay in your private workspace.</p>
          <input id="materials" type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/csv" onChange={(event) => void addFiles(event.target.files)} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700" />
          {materials.length > 0 && <ul className="mt-4 divide-y divide-slate-100 text-sm">{materials.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between py-2"><span className="truncate">{file.name}</span><button type="button" onClick={() => setMaterials((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`} className="ml-3 text-slate-500 hover:text-red-600">Remove</button></li>)}</ul>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-slate-700 mb-2">AI provider</label>
            <select id="provider" value={provider} onChange={(event) => { const next = PROVIDERS.find((item) => item.id === event.target.value)!; setProvider(next.id); setModel(next.model); }} className="w-full border border-slate-200 rounded-lg px-3 py-3 text-sm bg-white">{PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          </div>
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-slate-700 mb-2">Model</label>
            <input id="model" value={model} onChange={(event) => setModel(event.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-3 text-sm bg-white" />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center space-x-4 pt-2">
          <button disabled={busy || !workspaceReady || (!topic.trim() && materials.length === 0)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm">{busy ? "Building your path…" : !workspaceReady ? "Connecting workspace…" : "Create learning path"}</button>
          <Link href="/courses" className="px-6 py-2.5 text-slate-600 hover:text-slate-900 font-medium text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
