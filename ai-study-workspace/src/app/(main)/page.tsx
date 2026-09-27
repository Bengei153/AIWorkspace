"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { readCourses, readDeletedCourseIds, readReviewProgress, type StudyCourse } from "@/lib/workspace";
import { useAuth } from "@/components/AuthProvider";

export default function Home() {
  const { workspaceReady, workspaceRevision } = useAuth();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [savedCourses, setSavedCourses] = useState<StudyCourse[]>([]);
  const [reviewDueCount, setReviewDueCount] = useState(0);
  useEffect(() => {
    if (!workspaceReady) return;
    // Read browser-only storage after mount to keep server and client markup aligned.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeletedIds(readDeletedCourseIds());
    const currentCourses = readCourses();
    const reviewProgress = readReviewProgress();
    setSavedCourses(currentCourses);
    setReviewDueCount(currentCourses.reduce((count, course) => count + course.sections.filter((section) => {
      const record = reviewProgress.find((item) => item.courseId === course.id && item.sectionId === section.id);
      return !record || new Date(record.dueAt).getTime() <= Date.now();
    }).length, 0));
  }, [workspaceReady, workspaceRevision]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const sampleCourses = [
    { id: "ins-204", name: "INS 204", subtitle: "Systems Thinking", progress: 42, color: "bg-emerald-500" },
    { id: "ooad", name: "OOAD", subtitle: "Object-Oriented Analysis", progress: 78, color: "bg-indigo-500" },
    { id: "mth-103", name: "MTH 103", subtitle: "Probability", progress: 31, color: "bg-amber-500" },
    { id: "csc-203", name: "CSC 203", subtitle: "Data Structures", progress: 61, color: "bg-blue-500" },
  ];
  const customCourses = savedCourses.filter((course) => !deletedIds.includes(course.id)).map((course) => ({
    id: course.id,
    name: course.name,
    subtitle: course.description,
    progress: 0,
    color: "bg-emerald-500",
  }));
  const courses = [...customCourses, ...sampleCourses.filter((course) => !deletedIds.includes(course.id) && !customCourses.some((saved) => saved.id === course.id))];
  const recentMaterials = savedCourses
    .filter((course) => !deletedIds.includes(course.id))
    .flatMap((course) => course.materials.map((material) => ({
      title: material.name,
      course: course.name,
      courseId: course.id,
      type: material.type === "pdf" ? "PDF" : "TXT",
    })))
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{greeting}</h1>
        <p className="text-slate-500 mt-2">Here is your academic overview for today.</p>
      </header>

      {/* Continue Learning */}
      {!deletedIds.includes("ooad") && <section className="mb-12">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Continue Learning</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">OOAD</div>
            <h3 className="text-xl font-semibold text-slate-900">Inheritance &amp; Polymorphism</h3>
            <div className="flex items-center space-x-4 mt-3 text-sm text-slate-500">
              <span>12 min remaining</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: "78%" }}></div>
                </div>
                <span className="text-xs font-medium text-slate-700">78%</span>
              </div>
            </div>
          </div>
          <Link
            href="/study/ooad-1"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </Link>
        </div>
      </section>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">

          {/* Courses */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Your Courses</h2>
              <Link href="/courses" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {courses.length > 0 ? courses.map((course) => (
                <Link key={course.id} href={`/courses/${course.id}`} className="block group">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <span className="text-xs font-medium text-slate-500">{course.progress}%</span>
                    </div>
                    <div className="font-semibold text-slate-900 text-sm">{course.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 mb-3">{course.subtitle}</div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`${course.color} h-full`} style={{ width: `${course.progress}%` }}></div>
                    </div>
                  </div>
                </Link>
              )) : <div className="col-span-2 border border-dashed border-slate-300 p-6 text-center"><p className="text-sm text-slate-500">Your learning paths will appear here.</p><Link href="/courses/new" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">Create a learning path</Link></div>}
            </div>
          </section>

          {/* Recent Materials */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Recent Materials</h2>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {recentMaterials.length > 0 ? recentMaterials.map((doc, i) => (
                <Link key={`${doc.courseId}-${doc.title}-${i}`} href={`/courses/${doc.courseId}`} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      {doc.type}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{doc.title}</div>
                      <div className="text-xs text-slate-500">{doc.course}</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">Material</span>
                </Link>
              )) : <div className="p-4 text-sm text-slate-500">Materials you add to a learning path will appear here.</div>}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Needs Review */}
          {reviewDueCount > 0 && <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Needs Review</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="text-amber-900 font-semibold mb-1">{reviewDueCount} lessons due</div>
              <p className="text-sm text-amber-700 mb-4">Short practice sessions are ready for review.</p>
              <Link href="/review" className="block text-center px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium rounded-lg transition-colors text-sm">
                Start Review
              </Link>
            </div>
          </section>}

          {/* Today Plan */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Today</h2>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></div>
                <div>
                  <div className="text-sm font-medium text-slate-900">OOAD — Polymorphism</div>
                  <div className="text-xs text-slate-500 mt-1">Complete the final 2 sections</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
