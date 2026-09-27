import { createClient } from "@/lib/supabase/client";

export type StudySection = { id: string; title: string; html: string; css: string; js?: string };
export type StudyMaterial = { id?: string; name: string; content: string; type?: "pdf" | "text" };
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
export type ReviewProgress = {
  courseId: string;
  sectionId: string;
  attempts: number;
  correct: number;
  streak: number;
  confidence: 1 | 2 | 3;
  lastReviewedAt: string;
  dueAt: string;
};
export type WorkspaceSnapshot = {
  courses: StudyCourse[];
  reviewProgress: ReviewProgress[];
  deletedCourseIds: string[];
  deletedMaterialIds: Record<string, string[]>;
};

const LEGACY_KEYS = {
  courses: "study-workspace-courses",
  deletedCourseIds: "study-workspace-deleted-courses",
  deletedMaterialIds: "study-workspace-deleted-materials",
  reviewProgress: "study-workspace-review-progress",
};
const WORKSPACE_PREFIX = "study-workspace-user:";
const LEGACY_FILE_DB = "study-workspace-files";
let activeUserId: string | null = null;
let workspaceReady = false;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let syncChain: Promise<void> = Promise.resolve();

function emptyWorkspace(): WorkspaceSnapshot {
  return { courses: [], reviewProgress: [], deletedCourseIds: [], deletedMaterialIds: {} };
}

function workspaceKey(userId = activeUserId) {
  return userId ? `${WORKSPACE_PREFIX}${userId}` : null;
}

function readCachedWorkspace(userId = activeUserId): WorkspaceSnapshot {
  if (typeof window === "undefined" || !userId) return emptyWorkspace();
  try {
    const value = JSON.parse(localStorage.getItem(workspaceKey(userId)!) ?? "null") as Partial<WorkspaceSnapshot> | null;
    if (!value) return emptyWorkspace();
    return {
      courses: Array.isArray(value.courses) ? value.courses : [],
      reviewProgress: Array.isArray(value.reviewProgress) ? value.reviewProgress : [],
      deletedCourseIds: Array.isArray(value.deletedCourseIds) ? value.deletedCourseIds : [],
      deletedMaterialIds: value.deletedMaterialIds && typeof value.deletedMaterialIds === "object" ? value.deletedMaterialIds : {},
    };
  } catch {
    return emptyWorkspace();
  }
}

function writeCachedWorkspace(snapshot: WorkspaceSnapshot, userId = activeUserId) {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(workspaceKey(userId)!, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent("workspace:changed", { detail: { userId } }));
}

function updateWorkspace(transform: (snapshot: WorkspaceSnapshot) => WorkspaceSnapshot) {
  if (!activeUserId || !workspaceReady) throw new Error("Your private workspace is still loading. Please try again in a moment.");
  const next = transform(readCachedWorkspace());
  writeCachedWorkspace(next);
  scheduleSync();
  return next;
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    void flushWorkspaceSync().catch(() => undefined);
  }, 350);
}

async function sendSnapshot(snapshot: WorkspaceSnapshot) {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
    cache: "no-store",
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? "Your changes could not be synced.");
  }
}

export function flushWorkspaceSync() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = undefined;
  }
  if (!activeUserId || !workspaceReady) return Promise.resolve();
  const snapshot = readCachedWorkspace();
  syncChain = syncChain.catch(() => undefined).then(() => sendSnapshot(snapshot));
  return syncChain;
}

function readLegacyValue<T>(key: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return value === null ? fallback : value as T;
  } catch {
    return fallback;
  }
}

function readLegacyWorkspace(): WorkspaceSnapshot {
  return {
    courses: readLegacyValue(LEGACY_KEYS.courses, []),
    reviewProgress: readLegacyValue(LEGACY_KEYS.reviewProgress, []),
    deletedCourseIds: readLegacyValue(LEGACY_KEYS.deletedCourseIds, []),
    deletedMaterialIds: readLegacyValue(LEGACY_KEYS.deletedMaterialIds, {}),
  };
}

function clearLegacyWorkspace() {
  Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));
}

function readLegacyPdf(courseId: string, materialId: string) {
  return new Promise<Blob | undefined>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_FILE_DB, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("materials")) {
        db.close();
        resolve(undefined);
        return;
      }
      const transaction = db.transaction("materials", "readonly");
      const get = transaction.objectStore("materials").get(`${courseId}:${materialId}`);
      get.onsuccess = () => resolve(get.result?.file as Blob | undefined);
      get.onerror = () => reject(get.error);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    };
  });
}

async function migrateLegacyPdfs(snapshot: WorkspaceSnapshot) {
  for (const course of snapshot.courses) {
    for (const material of course.materials) {
      if (material.type !== "pdf" || !material.id) continue;
      const blob = await readLegacyPdf(course.id, material.id);
      if (blob) await saveMaterialFile(course.id, material.id, blob);
    }
  }
}

export async function initializeWorkspace(userId: string) {
  if (activeUserId === userId && workspaceReady) return;
  activeUserId = userId;
  workspaceReady = false;
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? "Could not load your private workspace.");
  }
  const result = await response.json() as { found: boolean; workspace: WorkspaceSnapshot | null };
  let snapshot: WorkspaceSnapshot;
  if (result.found && result.workspace) {
    snapshot = { ...emptyWorkspace(), ...result.workspace };
    clearLegacyWorkspace();
  } else {
    const cached = readCachedWorkspace(userId);
    const hasUserCache = localStorage.getItem(workspaceKey(userId)!) !== null;
    snapshot = hasUserCache ? cached : readLegacyWorkspace();
    if (!hasUserCache) await migrateLegacyPdfs(snapshot);
  }
  writeCachedWorkspace(snapshot, userId);
  workspaceReady = true;
  if (!result.found || !result.workspace) {
    await sendSnapshot(snapshot);
    clearLegacyWorkspace();
  }
  window.dispatchEvent(new CustomEvent("workspace:ready", { detail: { userId } }));
}

export function clearActiveWorkspace() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = undefined;
  activeUserId = null;
  workspaceReady = false;
}

export function applyRemoteWorkspace(userId: string, snapshot: WorkspaceSnapshot) {
  if (!workspaceReady || activeUserId !== userId || !Array.isArray(snapshot.courses) || !Array.isArray(snapshot.reviewProgress)) return;
  if (JSON.stringify(readCachedWorkspace()) !== JSON.stringify(snapshot)) writeCachedWorkspace({ ...emptyWorkspace(), ...snapshot }, userId);
}

export function readCourses(): StudyCourse[] {
  return readCachedWorkspace().courses;
}

export function saveCourse(course: StudyCourse) {
  updateWorkspace((snapshot) => ({ ...snapshot, courses: [course, ...snapshot.courses.filter((item) => item.id !== course.id)] }));
}

export function readReviewProgress(): ReviewProgress[] {
  return readCachedWorkspace().reviewProgress;
}

export function saveReviewSession(courseId: string, sectionId: string, correct: number, total: number, confidence: 1 | 2 | 3) {
  let updated: ReviewProgress[] = [];
  updateWorkspace((snapshot) => {
    const records = snapshot.reviewProgress;
    const previous = records.find((record) => record.courseId === courseId && record.sectionId === sectionId);
    const now = new Date();
    const accuracy = total ? correct / total : 0;
    const streak = accuracy >= 0.8 && confidence === 3 ? (previous?.streak ?? 0) + 1 : 0;
    const intervalDays = accuracy < 0.6 || confidence === 1 ? 1 : confidence === 2 ? 3 : [1, 3, 7, 14, 30][Math.min(streak - 1, 4)] ?? 30;
    const next: ReviewProgress = {
      courseId, sectionId,
      attempts: (previous?.attempts ?? 0) + total,
      correct: (previous?.correct ?? 0) + correct,
      streak, confidence,
      lastReviewedAt: now.toISOString(),
      dueAt: new Date(now.getTime() + intervalDays * 86400000).toISOString(),
    };
    updated = [next, ...records.filter((record) => !(record.courseId === courseId && record.sectionId === sectionId))];
    return { ...snapshot, reviewProgress: updated };
  });
  return updated;
}

export function findCourse(id: string) {
  return readCourses().find((course) => course.id === id);
}

export function readDeletedCourseIds() {
  return readCachedWorkspace().deletedCourseIds;
}

export function deleteCourseData(id: string) {
  updateWorkspace((snapshot) => ({
    ...snapshot,
    courses: snapshot.courses.filter((course) => course.id !== id),
    deletedCourseIds: [...new Set([...snapshot.deletedCourseIds, id])],
    reviewProgress: snapshot.reviewProgress.filter((record) => record.courseId !== id),
  }));
  void deleteCourseFiles(id);
}

export function readDeletedMaterialIds(courseId: string) {
  return readCachedWorkspace().deletedMaterialIds[courseId] ?? [];
}

export function deleteMaterialData(courseId: string, materialId: string) {
  const course = findCourse(courseId);
  if (course) {
    const materials = course.materials.filter((item, index) => (item.id ?? `material-${index}`) !== materialId);
    saveCourse({ ...course, materials });
    void deleteMaterialFile(courseId, materialId);
    return materials;
  }
  updateWorkspace((snapshot) => ({
    ...snapshot,
    deletedMaterialIds: { ...snapshot.deletedMaterialIds, [courseId]: [...new Set([...(snapshot.deletedMaterialIds[courseId] ?? []), materialId])] },
  }));
  return null;
}

function filePath(courseId: string, materialId: string) {
  if (!activeUserId) throw new Error("Sign in to access your private course files.");
  return `${activeUserId}/${courseId}/${materialId}.pdf`;
}

export async function saveMaterialFile(courseId: string, materialId: string, file: Blob) {
  const { error } = await createClient().storage.from("course-materials").upload(filePath(courseId, materialId), file, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error("Could not securely save the PDF. Check the private storage migration and try again.");
}

export async function readMaterialFile(courseId: string, materialId: string) {
  const { data, error } = await createClient().storage.from("course-materials").download(filePath(courseId, materialId));
  if (error) return undefined;
  return data;
}

export async function deleteMaterialFile(courseId: string, materialId: string) {
  if (!activeUserId) return;
  await createClient().storage.from("course-materials").remove([filePath(courseId, materialId)]);
}

export async function deleteCourseFiles(courseId: string) {
  if (!activeUserId) return;
  const prefix = `${activeUserId}/${courseId}`;
  const storage = createClient().storage.from("course-materials");
  const { data } = await storage.list(prefix, { limit: 100 });
  if (data?.length) await storage.remove(data.map((file) => `${prefix}/${file.name}`));
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
