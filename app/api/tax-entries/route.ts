import { NextResponse } from "next/server";
import { createManualEntry, getDashboardData } from "@/lib/server-tax-store";

export async function GET() {
  try { return NextResponse.json(await getDashboardData()); }
  catch (error) { console.error("[api] Database read failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Koneksi database gagal." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try { return NextResponse.json(await createManualEntry(await request.json()), { status: 201 }); }
  catch (error) { console.error("[api] Database save failed", error); return NextResponse.json({ error: `Gagal menyimpan data: ${error instanceof Error ? error.message : "Data gagal disimpan ke database."}` }, { status: 500 }); }
}
