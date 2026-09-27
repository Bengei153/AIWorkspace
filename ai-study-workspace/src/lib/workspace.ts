export type StudySection = {
  id: string;
  title: string;
  html: string;
  css: string;
  js?: string;
};

export type StudyMaterial = { name: string; content: string };

export type StudyCourse = {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  materials: StudyMaterial[];
  sections: StudySection[];
  updatedAt: string;
};

const STORAGE_KEY = "study-workspace-courses";
const DELETED_COURSES_KEY = "study-workspace-deleted-courses";
const DELETED_MATERIALS_KEY = "study-workspace-deleted-materials";

export function readCourses(): StudyCourse[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? (value as StudyCourse[]) : [];
  } catch {
    return [];
  }
}

export function saveCourse(course: StudyCourse) {
  const courses = readCourses().filter((item) => item.id !== course.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([course, ...courses]));
}

export function findCourse(id: string) {
  return readCourses().find((course) => course.id === id);
}

export function readDeletedCourseIds() {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DELETED_COURSES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function deleteCourseData(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readCourses().filter((course) => course.id !== id)));
  const deleted = new Set(readDeletedCourseIds());
  deleted.add(id);
  localStorage.setItem(DELETED_COURSES_KEY, JSON.stringify([...deleted]));
}

export function readDeletedMaterialIds(courseId: string) {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DELETED_MATERIALS_KEY) ?? "{}");
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const ids = (value as Record<string, unknown>)[courseId];
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function deleteMaterialData(courseId: string, materialId: string) {
  const course = findCourse(courseId);
  if (course) {
    saveCourse({ ...course, materials: course.materials.filter((_, index) => `material-${index}` !== materialId) });
    return course.materials.filter((_, index) => `material-${index}` !== materialId);
  }

  const all = (() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(DELETED_MATERIALS_KEY) ?? "{}");
      return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, string[]> : {};
    } catch {
      return {};
    }
  })();
  all[courseId] = [...new Set([...(all[courseId] ?? []), materialId])];
  localStorage.setItem(DELETED_MATERIALS_KEY, JSON.stringify(all));
  return null;
}

export function getProviderKeyName(provider: string) {
  return {
    openai: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
    claude: "ANTHROPIC_API_KEY",
    kimi: "MOONSHOT_API_KEY",
    qwen: "DASHSCOPE_API_KEY",
  }[provider] ?? "";
}

export const PROVIDERS = [
  { id: "openai", label: "OpenAI", model: "gpt-4o-mini" },
  { id: "gemini", label: "Gemini", model: "gemini-3.1-pro-preview" },
  { id: "claude", label: "Claude", model: "claude-3-5-haiku-latest" },
  { id: "kimi", label: "Kimi", model: "moonshot-v1-8k" },
  { id: "qwen", label: "Qwen", model: "qwen-plus" },
] as const;
