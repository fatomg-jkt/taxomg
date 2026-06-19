import { NextResponse } from "next/server";
import { deleteManualEntry, updateManualEntry } from "@/lib/server-tax-store";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const entry = await updateManualEntry(id, await request.json());
    return entry ? NextResponse.json(entry) : NextResponse.json({ error: "Data manual tidak ditemukan." }, { status: 404 });
  } catch (error) { console.error("[api] Static mode session save fallback", error); return NextResponse.json({ error: `Gagal menyimpan data: ${error instanceof Error ? error.message : "Mode file statis aktif. Gunakan Download Updated JSON untuk menyimpan perubahan sebagai file statis."}` }, { status: 500 }); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteManualEntry(id);
    return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Data manual tidak ditemukan." }, { status: 404 });
  } catch (error) { console.error("[api] Static mode session delete fallback", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Mode file statis aktif. Penghapusan permanen dilakukan dengan memperbarui file statis." }, { status: 500 }); }
}
