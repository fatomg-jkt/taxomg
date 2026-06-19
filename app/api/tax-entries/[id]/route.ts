import { NextResponse } from "next/server";
import { deleteManualEntry, updateManualEntry } from "@/lib/server-tax-store";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const entry = await updateManualEntry(id, await request.json());
    return entry ? NextResponse.json(entry) : NextResponse.json({ error: "Data manual tidak ditemukan." }, { status: 404 });
  } catch { return NextResponse.json({ error: "Data gagal disimpan ke database." }, { status: 500 }); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteManualEntry(id);
    return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Data manual tidak ditemukan." }, { status: 404 });
  } catch { return NextResponse.json({ error: "Data gagal dihapus dari database." }, { status: 500 }); }
}
