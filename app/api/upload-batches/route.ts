import { NextResponse } from "next/server";
import { createUploadBatch, getDashboardData } from "@/lib/server-tax-store";

export async function GET() {
  try { return NextResponse.json((await getDashboardData()).upload_batches); }
  catch { return NextResponse.json({ error: "Koneksi database gagal." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await createUploadBatch(body.batch, body.entries), { status: 201 });
  } catch { return NextResponse.json({ error: "Data berhasil diparse tetapi gagal tersimpan." }, { status: 500 }); }
}
