"use client";
import React from "react";
import Link from "next/link";

const CONCEPTS = [
  { name: "Feedback Loops", course: "INS 204", difficulty: "hard" },
  { name: "Method Overriding", course: "OOAD", difficulty: "medium" },
  { name: "Conditional Probability", course: "MTH 103", difficulty: "hard" },
];

export default function ReviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Review</h1>
        <p className="text-slate-500 mt-2">Strengthen your understanding of difficult concepts.</p>
      </header>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-amber-900 mb-1">3 concepts need attention</h2>
        <p className="text-sm text-amber-700">Based on your recent sessions, these areas may need a revisit before your next exam.</p>
      </div>

      <div className="space-y-3">
        {CONCEPTS.map((concept, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between hover:border-indigo-200 transition-colors">
            <div className="flex items-center space-x-4">
              <div className={"w-2 h-2 rounded-full " + (concept.difficulty === "hard" ? "bg-red-400" : "bg-amber-400")}></div>
              <div>
                <div className="font-medium text-slate-900">{concept.name}</div>
                <div className="text-sm text-slate-500">{concept.course}</div>
              </div>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
              Review
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}