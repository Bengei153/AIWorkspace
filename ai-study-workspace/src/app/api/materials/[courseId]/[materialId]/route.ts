import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const FILE_FORMATS = {
  pdf: { mime: "application/pdf", extension: "pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx" },
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  const { courseId, materialId } = await params;
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(courseId) || !/^[A-Za-z0-9_-]{1,120}$/.test(materialId)) {
    return NextResponse.json({ error: "Invalid material identifier." }, { status: 400 });
  }
  const format = new URL(request.url).searchParams.get("format") as keyof typeof FILE_FORMATS | null;
  if (!format || !(format in FILE_FORMATS)) return NextResponse.json({ error: "Unsupported source file format." }, { status: 400 });
  const fileFormat = FILE_FORMATS[format];

  try {
    const supabase = await createClient();
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    const userId = identity?.claims?.sub;
    if (authError || typeof userId !== "string") {
      return NextResponse.json({ error: "Sign in to access this source file." }, { status: 401 });
    }

    const path = `${userId}/${courseId}/${materialId}.${fileFormat.extension}`;
    const { data, error } = await supabase.storage.from("course-materials").download(path);
    if (error || !data) return NextResponse.json({ error: "This source file could not be found in your private cloud storage." }, { status: 404 });

    return new Response(data, {
      headers: {
        "Content-Type": fileFormat.mime,
        "Content-Disposition": format === "pdf" ? "inline; filename=source.pdf" : `attachment; filename=source.${format}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not retrieve the source file from private cloud storage." }, { status: 503 });
  }
}
