"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteCourseData, deleteMaterialData, findCourse, readDeletedCourseIds, readDeletedMaterialIds, type StudyCourse } from "@/lib/workspace";
import { useAuth } from "@/components/AuthProvider";

const COURSE_DATA = {
  "ins-204": { name: "INS 204", title: "Systems Thinking", lecturer: "Dr. Adeyemi", description: "Intro to systems thinking, feedback loops, and complex adaptive systems.", progress: 42, color: "bg-emerald-500", materials: [{ id: "ins-l1", title: "Lecture 1: Introduction", type: "PDF", sections: 5, progress: 100 },{ id: "ins-l2", title: "Lecture 2: Feedback Loops", type: "PDF", sections: 7, progress: 100 },{ id: "ins-l45", title: "Lecture 4 and 5", type: "PDF", sections: 9, progress: 20 }], concepts: [{ name: "System Boundaries", mastery: "Confident" },{ name: "Feedback Loops", mastery: "Needs Review" },{ name: "Adaptation", mastery: "Not Started" }] },
  "ooad": { name: "OOAD", title: "Object-Oriented Analysis and Design", lecturer: "Dr. Ibrahim", description: "OOP principles, UML, design patterns, and software architecture.", progress: 78, color: "bg-indigo-500", materials: [{ id: "ooad-l1", title: "Lecture 1: OOP Foundations", type: "PDF", sections: 6, progress: 100 },{ id: "ooad-l3", title: "Lecture 3: Inheritance", type: "PDF", sections: 8, progress: 75 },{ id: "ooad-l4", title: "Lecture 4: Polymorphism", type: "PDF", sections: 7, progress: 0 }], concepts: [{ name: "Encapsulation", mastery: "Confident" },{ name: "Inheritance", mastery: "Practiced" },{ name: "Polymorphism", mastery: "Learning" },{ name: "Method Overriding", mastery: "Needs Review" }] },
  "mth-103": { name: "MTH 103", title: "Probability and Statistics", lecturer: "Dr. Okonkwo", description: "Foundation in probability theory, distributions, and statistical inference.", progress: 31, color: "bg-amber-500", materials: [{ id: "mth-l1", title: "Lecture 1: Sample Spaces", type: "PDF", sections: 4, progress: 100 },{ id: "mth-l2", title: "Lecture 2: Probability Rules", type: "PDF", sections: 6, progress: 50 }], concepts: [{ name: "Sample Space", mastery: "Confident" },{ name: "Conditional Probability", mastery: "Needs Review" },{ name: "Bayes Theorem", mastery: "Not Started" }] },
  "csc-203": { name: "CSC 203", title: "Data Structures", lecturer: "Dr. Balogun", description: "Arrays, linked lists, trees, graphs, and algorithmic complexity.", progress: 61, color: "bg-blue-500", materials: [{ id: "csc-l1", title: "Lecture 1: Arrays and Lists", type: "PDF", sections: 5, progress: 100 },{ id: "csc-l3", title: "Lecture 3: Trees", type: "PDF", sections: 7, progress: 60 },{ id: "csc-l4", title: "Lecture 4: Graphs", type: "PDF", sections: 5, progress: 0 }], concepts: [{ name: "Arrays", mastery: "Confident" },{ name: "Binary Trees", mastery: "Practiced" },{ name: "Graph Traversal", mastery: "Not Started" }] },
};

const M = { "Confident": "bg-emerald-100 text-emerald-700", "Practiced": "bg-blue-100 text-blue-700", "Learning": "bg-indigo-100 text-indigo-700", "Needs Review": "bg-amber-100 text-amber-700", "Not Started": "bg-slate-100 text-slate-500" };

export default function CourseDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { workspaceReady, workspaceRevision } = useAuth();
  const [savedCourse, setSavedCourse] = useState<StudyCourse>();
  const [deletedCourseIds, setDeletedCourseIds] = useState<string[]>([]);
  const [deletedMaterialIds, setDeletedMaterialIds] = useState<string[]>([]);
  useEffect(() => {
    if (!workspaceReady) return;
    // Refresh this client view when its private workspace cache changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedCourse(findCourse(id));
  }, [id, workspaceReady, workspaceRevision]);
  useEffect(() => {
    if (!workspaceReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeletedCourseIds(readDeletedCourseIds());
    setDeletedMaterialIds(readDeletedMaterialIds(id));
  }, [id, workspaceReady, workspaceRevision]);
  const course = deletedCourseIds.includes(id) ? undefined : COURSE_DATA[id as keyof typeof COURSE_DATA];

  function removeCourse() {
    deleteCourseData(id);
    router.push("/courses");
  }

  function removeSavedMaterial(index: number) {
    const material = savedCourse?.materials[index];
    if (!material) return;
    const materials = deleteMaterialData(id, material.id ?? `material-${index}`);
    if (materials && savedCourse) setSavedCourse({ ...savedCourse, materials });
  }

  function removeSampleMaterial(materialId: string) {
    deleteMaterialData(id, materialId);
    setDeletedMaterialIds((current) => [...new Set([...current, materialId])]);
  }

  if (!workspaceReady) return <div className="p-10 text-sm text-slate-500">Loading your private workspace…</div>;
  if (savedCourse) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-12">
        <div className="mb-8 text-sm text-slate-500"><Link href="/courses" className="hover:text-slate-900">Courses</Link><span className="mx-2">/</span>{savedCourse.name}</div>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase text-emerald-700">AI learning path</p><h1 className="text-3xl font-semibold text-slate-900">{savedCourse.name}</h1><p className="mt-2 text-slate-500">{savedCourse.description}</p></div><div className="flex items-center gap-3"><DeleteButton label={savedCourse.name} onDelete={removeCourse} /><Link href={`/study/${savedCourse.id}`} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Start learning</Link></div></div>
        <section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Learning path <span className="ml-2 font-normal normal-case">{savedCourse.sections.length} lessons</span></h2><ol className="divide-y divide-slate-200 border-y border-slate-200">{savedCourse.sections.map((section, index) => <li key={section.id}><Link href={`/study/${savedCourse.id}?lesson=${index}`} className="flex items-center gap-4 py-4 text-slate-800 hover:text-indigo-700"><span className="grid place-items-center w-8 h-8 rounded-full bg-slate-100 text-xs font-semibold">{String(index + 1).padStart(2, "0")}</span><span className="font-medium">{section.title}</span><span className="ml-auto text-sm text-slate-400">Open lesson →</span></Link></li>)}</ol></section>
        {savedCourse.materials.length > 0 && <section className="mt-10"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Materials</h2><ul className="divide-y divide-slate-200 border-y border-slate-200">{savedCourse.materials.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-4 py-2"><span className="truncate text-sm text-slate-700">{item.name}</span><DeleteButton label={item.name} onDelete={() => removeSavedMaterial(index)} /></li>)}</ul></section>}
      </div>
    );
  }
  if (!course) return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-8">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Course not found</h2>
      <Link href="/courses" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium mt-4">Back to Courses</Link>
    </div>
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-12">
      <div className="flex items-center space-x-2 text-sm text-slate-500 mb-8">
        <Link href="/" className="hover:text-slate-900">Home</Link><span>/</span>
        <Link href="/courses" className="hover:text-slate-900">Courses</Link><span>/</span>
        <span className="text-slate-900 font-medium">{course.name}</span>
      </div>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:mb-10 sm:flex-row">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{course.name}</div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{course.title}</h1>
          <p className="text-slate-500 mt-2">{course.lecturer} - {course.description}</p>
        </div>
        <div className="flex w-full flex-shrink-0 items-center gap-3 sm:w-auto sm:ml-8"><DeleteButton label={course.name} onDelete={removeCourse} /><Link href={"/study/" + id} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-700 sm:flex-none sm:px-5">Continue Studying</Link></div>
      </div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-slate-700">Overall Progress</span>
          <span className="text-sm font-semibold text-slate-900">{course.progress}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={course.color + " h-full"} style={{ width: course.progress + "%" }}></div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Materials</h2>
          <div className="space-y-3">
            {course.materials.filter((mat) => !deletedMaterialIds.includes(mat.id)).map((mat) => (
              <div key={mat.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold">{mat.type}</div>
                    <div><div className="text-sm font-medium text-slate-900">{mat.title}</div><div className="text-xs text-slate-500">{mat.sections} sections</div></div>
                  </div>
                  <div className="flex items-center gap-2"><DeleteButton label={mat.title} onDelete={() => removeSampleMaterial(mat.id)} /><Link href={"/study/" + mat.id} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100">{mat.progress === 0 ? "Start" : mat.progress === 100 ? "Review" : "Continue"}</Link></div>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div className={"h-full " + (mat.progress === 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: mat.progress + "%" }}></div></div>
              </div>
            ))}
            <button className="w-full border-2 border-dashed border-slate-200 rounded-xl p-5 flex items-center justify-center space-x-3 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <span className="text-sm font-medium">Upload Material</span>
            </button>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Concepts</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
            {course.concepts.map((concept, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-800">{concept.name}</span>
                <span className={"text-xs font-medium px-2 py-0.5 rounded-full " + (M[concept.mastery as keyof typeof M] || "bg-slate-100 text-slate-500")}>{concept.mastery}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Exam Preparation</h3>
            <p className="text-xs text-slate-500 mb-4">Generate practice questions from your course materials.</p>
            <button className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors">Start Exam Prep</button>
          </div>
        </div>
      </div>
    </div>
  );
}
