import { NextResponse } from "next/server";
import { createUploadBatch, getDashboardData } from "@/lib/server-tax-store";

export async function GET() {
  try { return NextResponse.json((await getDashboardData()).upload_batches); }
  catch (error) { console.error("[api] Database read failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Koneksi database gagal." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await createUploadBatch(body.batch, body.entries), { status: 201 });
  } catch (error) { console.error("[api] Upload save failed", error); return NextResponse.json({ error: `Gagal menyimpan upload: ${error instanceof Error ? error.message : "Data berhasil diparse tetapi gagal tersimpan."}` }, { status: 500 }); }
}
