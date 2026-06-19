import { NextResponse } from "next/server";
import { deleteUploadBatch } from "@/lib/server-tax-store";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteUploadBatch(id);
    return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Batch upload tidak ditemukan." }, { status: 404 });
  } catch (error) { console.error("[api] Upload delete failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Data upload gagal dihapus." }, { status: 500 }); }
}
