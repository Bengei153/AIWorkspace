import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  const { courseId, materialId } = await params;
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(courseId) || !/^[A-Za-z0-9_-]{1,120}$/.test(materialId)) {
    return NextResponse.json({ error: "Invalid material identifier." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    const userId = identity?.claims?.sub;
    if (authError || typeof userId !== "string") {
      return NextResponse.json({ error: "Sign in to access this PDF." }, { status: 401 });
    }

    const path = `${userId}/${courseId}/${materialId}.pdf`;
    const { data, error } = await supabase.storage.from("course-materials").download(path);
    if (error || !data) return NextResponse.json({ error: "This PDF could not be found in your private cloud storage." }, { status: 404 });

    return new Response(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not retrieve the PDF from private cloud storage." }, { status: 503 });
  }
}
