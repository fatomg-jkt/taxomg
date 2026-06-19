import { NextResponse } from "next/server";
import { createUploadBatch, getDashboardData } from "@/lib/server-tax-store";

export async function GET() {
  try { return NextResponse.json((await getDashboardData()).upload_batches); }
  catch (error) { console.error("[api] Static file read", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Mode file statis aktif." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    void body;
    return NextResponse.json(await createUploadBatch(), { status: 201 });
  } catch (error) { console.error("[api] Upload save failed", error); return NextResponse.json({ error: `Gagal menyimpan upload: ${error instanceof Error ? error.message : "Mode file statis aktif. Download JSON Data untuk menyimpan hasil normalisasi."}` }, { status: 500 }); }
}
