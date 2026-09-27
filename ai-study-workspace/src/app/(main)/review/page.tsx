"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readCourses, readReviewProgress, saveReviewSession, type ReviewProgress, type StudyCourse, type StudySection } from "@/lib/workspace";
import { useAuth } from "@/components/AuthProvider";

type ReviewQuestion = {
  concept: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

type ReviewItem = { course: StudyCourse; section: StudySection; index: number; progress?: ReviewProgress; due: boolean; solid: boolean };
type Session = { item: ReviewItem; questions: ReviewQuestion[] };

const CONFIDENCE = [
  { value: 1 as const, label: "Low", detail: "I was unsure" },
  { value: 2 as const, label: "Medium", detail: "I mostly knew it" },
  { value: 3 as const, label: "High", detail: "I knew it" },
];

function reviewDate(date: string) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (days <= 0) return "Due now";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export default function ReviewPage() {
  const { workspaceReady, workspaceRevision } = useAuth();
  const [courses, setCourses] = useState<StudyCourse[]>([]);
  const [progress, setProgress] = useState<ReviewProgress[]>([]);
  const [filter, setFilter] = useState<"due" | "all" | "solid">("due");
  const [courseFilter, setCourseFilter] = useState("all");
  const [session, setSession] = useState<Session>();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [score, setScore] = useState(0);
  const [confidenceTotal, setConfidenceTotal] = useState(0);
  const [finished, setFinished] = useState<{ score: number; total: number; item: ReviewItem }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspaceReady) return;
    // Load local-only progress after mount to preserve deterministic server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCourses(readCourses());
    setProgress(readReviewProgress());
  }, [workspaceReady, workspaceRevision]);

  const items = useMemo<ReviewItem[]>(() => courses.flatMap((course) => course.sections.map((section, index) => {
    const record = progress.find((entry) => entry.courseId === course.id && entry.sectionId === section.id);
    const solid = Boolean(record && record.streak >= 3 && record.confidence === 3);
    const due = !record || new Date(record.dueAt).getTime() <= Date.now();
    return { course, section, index, progress: record, due, solid };
  })), [courses, progress]);
  const filteredItems = items.filter((item) => {
    if (courseFilter !== "all" && item.course.id !== courseFilter) return false;
    if (filter === "due") return item.due;
    if (filter === "solid") return item.solid;
    return true;
  });
  const dueCount = items.filter((item) => item.due).length;
  const solidCount = items.filter((item) => item.solid).length;
  const practicingCount = items.filter((item) => item.progress && !item.solid).length;
  const activeQuestion = session?.questions[questionIndex];
  const currentCorrect = Boolean(activeQuestion && selected === activeQuestion.answerIndex);

  async function startReview(item: ReviewItem) {
    setBusy(true);
    setError("");
    setFinished(undefined);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          courseName: item.course.name,
          materials: item.course.materials.map(({ name, content }) => ({ name, content })),
          lesson: item.section,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not prepare this review.");
      setSession({ item, questions: result.questions as ReviewQuestion[] });
      setQuestionIndex(0);
      setSelected(null);
      setConfidence(null);
      setScore(0);
      setConfidenceTotal(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not prepare this review.");
    } finally {
      setBusy(false);
    }
  }

  function advanceQuestion() {
    if (!session || !activeQuestion || selected === null || confidence === null) return;
    const correct = selected === activeQuestion.answerIndex;
    const nextScore = score + Number(correct);
    const nextConfidence = confidenceTotal + confidence;
    setScore(nextScore);
    if (questionIndex + 1 >= session.questions.length) {
      const averageConfidence = nextConfidence / session.questions.length;
      const confidenceRating = (averageConfidence >= 2.5 ? 3 : averageConfidence >= 1.5 ? 2 : 1) as 1 | 2 | 3;
      setProgress(saveReviewSession(session.item.course.id, session.item.section.id, nextScore, session.questions.length, confidenceRating));
      setFinished({ score: nextScore, total: session.questions.length, item: session.item });
      setSession(undefined);
      return;
    }
    setConfidenceTotal(nextConfidence);
    setQuestionIndex((index) => index + 1);
    setSelected(null);
    setConfidence(null);
  }

  function cancelSession() {
    setSession(undefined);
    setError("");
  }

  if (session && activeQuestion) {
    const link = `/study/${session.item.course.id}?lesson=${session.item.index}`;
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase text-indigo-600">{session.item.course.name} · {session.item.section.title}</p><h1 className="mt-1 text-xl font-semibold text-slate-900">Question {questionIndex + 1} of {session.questions.length}</h1></div>
          <button onClick={cancelSession} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">End session</button>
        </div>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${((questionIndex + 1) / session.questions.length) * 100}%` }} /></div>
        <section className="border-y border-slate-200 py-7">
          <p className="mb-3 text-xs font-semibold uppercase text-slate-500">{activeQuestion.concept}</p>
          <h2 className="mb-6 text-xl font-semibold leading-snug text-slate-900">{activeQuestion.prompt}</h2>
          <div className="space-y-2" aria-label="Answer choices">
            {activeQuestion.options.map((option, index) => {
              const isAnswer = index === activeQuestion.answerIndex;
              const isChosen = selected === index;
              const style = selected === null ? (isChosen ? "border-indigo-500 bg-indigo-50 text-indigo-900" : "border-slate-200 text-slate-700 hover:border-indigo-300") : isAnswer ? "border-emerald-500 bg-emerald-50 text-emerald-900" : isChosen ? "border-red-400 bg-red-50 text-red-900" : "border-slate-200 text-slate-500";
              return <button key={index} aria-pressed={isChosen} disabled={selected !== null} onClick={() => setSelected(index)} className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm ${style}`}><span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border border-current text-xs font-semibold">{String.fromCharCode(65 + index)}</span><span>{option}</span></button>;
            })}
          </div>
          {selected !== null && <div className={`mt-5 border-l-2 p-4 text-sm ${currentCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-amber-500 bg-amber-50 text-amber-900"}`}><p className="font-semibold">{currentCorrect ? "Correct" : "Not quite"}</p><p className="mt-1">{activeQuestion.explanation}</p></div>}
          {selected !== null && <div className="mt-6"><p className="mb-2 text-sm font-medium text-slate-800">How confident were you?</p><div className="grid grid-cols-3 gap-2">{CONFIDENCE.map((choice) => <button key={choice.value} aria-pressed={confidence === choice.value} onClick={() => setConfidence(choice.value)} className={`rounded-md border px-2 py-2 text-left ${confidence === choice.value ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}><span className="block text-sm font-medium text-slate-800">{choice.label}</span><span className="mt-0.5 block text-xs text-slate-500">{choice.detail}</span></button>)}</div></div>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><Link href={link} className="text-sm font-medium text-indigo-700 hover:underline">Open lesson</Link>{selected === null ? <button disabled={selected === null} className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40">Choose an answer</button> : <button disabled={confidence === null} onClick={advanceQuestion} className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40">{questionIndex + 1 === session.questions.length ? "Finish review" : "Next question"}</button>}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Review</h1><p className="mt-1 text-sm text-slate-500">Gemini 3.5 Flash Lite · questions grounded in your lesson and source materials.</p></div>
        <label className="text-sm text-slate-600">Course <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="ml-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="all">All courses</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
      </header>

      <div className="mb-8 grid grid-cols-3 border-y border-slate-200 py-4 text-center"><div><div className="text-xl font-semibold text-slate-900">{dueCount}</div><div className="mt-1 text-xs text-slate-500">Due now</div></div><div className="border-x border-slate-200"><div className="text-xl font-semibold text-slate-900">{practicingCount}</div><div className="mt-1 text-xs text-slate-500">Practicing</div></div><div><div className="text-xl font-semibold text-emerald-700">{solidCount}</div><div className="mt-1 text-xs text-slate-500">Feeling solid</div></div></div>

      {finished && <section className="mb-6 flex flex-wrap items-center justify-between gap-4 border-l-2 border-emerald-500 bg-emerald-50 p-4"><div><h2 className="font-semibold text-emerald-900">Session complete · {finished.score}/{finished.total}</h2><p className="mt-1 text-sm text-emerald-800">Your answers and confidence have been saved. {finished.score < finished.total ? "Missed or uncertain concepts return sooner." : "Keep it up; confident answers will space out over time."}</p></div><Link href={`/study/${finished.item.course.id}?lesson=${finished.item.index}`} className="text-sm font-medium text-emerald-800 underline">Revisit lesson</Link></section>}
      {error && <div role="alert" className="mb-5 border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {busy && <div role="status" className="mb-5 text-sm text-slate-500">Preparing five questions from your lesson and materials…</div>}

      {courses.length === 0 ? <div className="border-y border-slate-200 py-10 text-center"><h2 className="font-medium text-slate-900">No learning paths to review yet</h2><p className="mt-2 text-sm text-slate-500">Create a path from a topic or your study materials, then review its lessons here.</p><Link href="/courses/new" className="mt-4 inline-flex rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Create learning path</Link></div> : <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div role="tablist" aria-label="Review queue" className="flex border-b border-slate-200">{(["due", "all", "solid"] as const).map((value) => <button key={value} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${filter === value ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{value === "due" ? `Due ${dueCount > 0 ? `· ${dueCount}` : ""}` : value === "solid" ? `Solid · ${solidCount}` : "All lessons"}</button>)}</div>{dueCount > 0 && filter === "due" && <button disabled={busy} onClick={() => { const first = filteredItems[0]; if (first) void startReview(first); }} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Start due review</button>}</div>
        {filteredItems.length > 0 ? <div className="divide-y divide-slate-200 border-y border-slate-200">{filteredItems.map((item) => <article key={`${item.course.id}-${item.section.id}`} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0 flex-1"><div className="text-xs font-medium text-slate-500">{item.course.name} · {item.solid ? "Feeling solid" : item.progress ? reviewDate(item.progress.dueAt) : "New lesson"}</div><h2 className="mt-1 font-medium text-slate-900">{item.section.title}</h2>{item.progress && <p className="mt-1 text-xs text-slate-500">{item.progress.correct}/{item.progress.attempts} correct · last confidence {CONFIDENCE[item.progress.confidence - 1].label.toLowerCase()}</p>}<Link href={`/study/${item.course.id}?lesson=${item.index}`} className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:underline">Open lesson</Link></div><button disabled={busy} onClick={() => void startReview(item)} className="rounded-md border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{item.progress ? "Practice" : "Start review"}</button></article>)}</div> : <div className="border-y border-slate-200 py-10 text-center"><h2 className="font-medium text-slate-900">{filter === "due" ? "You’re all caught up" : filter === "solid" ? "Nothing marked solid yet" : "No lessons match this course"}</h2><p className="mt-2 text-sm text-slate-500">{filter === "due" ? "Come back when your next lesson is due, or browse all lessons for extra practice." : "Complete review sessions and rate your confidence to build your personalized queue."}</p>{filter === "due" && <button onClick={() => setFilter("all")} className="mt-3 text-sm font-medium text-indigo-700 hover:underline">Browse all lessons</button>}</div>}
      </>}
    </div>
  );
}
