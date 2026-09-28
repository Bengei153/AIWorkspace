"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteCourseData, readCourses, readDeletedCourseIds, type StudyCourse } from "@/lib/workspace";
import { useAuth } from "@/components/AuthProvider";

const COURSES = [
  { id: "ins-204", name: "INS 204", title: "Systems Thinking", progress: 42, color: "bg-emerald-500" },
  { id: "ooad", name: "OOAD", title: "Object-Oriented Analysis", progress: 78, color: "bg-indigo-500" },
  { id: "mth-103", name: "MTH 103", title: "Probability", progress: 31, color: "bg-amber-500" },
  { id: "csc-203", name: "CSC 203", title: "Data Structures", progress: 61, color: "bg-blue-500" },
];

export default function CoursesPage() {
  const { workspaceReady, workspaceRevision } = useAuth();
  const [created, setCreated] = useState<StudyCourse[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  useEffect(() => {
    if (!workspaceReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreated(readCourses());
    setDeletedIds(readDeletedCourseIds());
  }, [workspaceReady, workspaceRevision]);

  function removeCourse(id: string) {
    deleteCourseData(id);
    setCreated((current) => current.filter((course) => course.id !== id));
    setDeletedIds((current) => [...new Set([...current, id])]);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-12">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Your Courses</h1>
          <p className="text-slate-500 mt-2">Manage your academic subjects and materials.</p>
        </div>
        <Link href="/courses/new" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">+ New project</Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {created.map((course) => (
          <div key={course.id} className="relative min-h-48 rounded-lg border border-slate-200 bg-white transition-colors hover:border-indigo-300">
            <Link href={`/courses/${course.id}`} className="flex h-full flex-col p-6 pr-14">
              <div className="mb-6 flex items-start justify-between"><span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">AI path</span><span className="text-xs text-slate-400">{course.sections.length} lessons</span></div>
              <div className="mt-auto"><h2 className="text-lg font-semibold text-slate-900">{course.name}</h2><p className="mt-1 text-sm text-slate-500">{course.description}</p></div>
            </Link>
            <div className="absolute right-3 top-3"><DeleteButton label={course.name} onDelete={() => removeCourse(course.id)} /></div>
          </div>
        ))}
        {COURSES.filter((course) => !deletedIds.includes(course.id)).map((course) => (
          <div key={course.id} className="relative min-h-48 rounded-xl border border-slate-200 bg-white transition-all hover:border-indigo-300 hover:shadow-md">
            <Link href={"/courses/" + course.id} className="flex h-full flex-col p-6 pr-14">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-500">{course.progress}%</span>
              </div>
              <div className="mt-auto">
                <h2 className="text-lg font-semibold text-slate-900">{course.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5 mb-4">{course.title}</p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={course.color + " h-full"} style={{ width: course.progress + "%" }}></div>
                </div>
              </div>
            </Link>
            <div className="absolute right-3 top-3"><DeleteButton label={course.name} onDelete={() => removeCourse(course.id)} /></div>
          </div>
        ))}

        <Link href="/courses/new" className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors min-h-48">
          <svg className="w-8 h-8 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
          <span className="text-sm font-medium">Add New Course</span>
        </Link>
      </div>
    </div>
  );
}
