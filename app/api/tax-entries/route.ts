import { NextResponse } from "next/server";
import { createManualEntry, getDashboardData } from "@/lib/server-tax-store";

export async function GET() {
  try { return NextResponse.json(await getDashboardData()); }
  catch { return NextResponse.json({ error: "Koneksi database gagal." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try { return NextResponse.json(await createManualEntry(await request.json()), { status: 201 }); }
  catch { return NextResponse.json({ error: "Data gagal disimpan ke database." }, { status: 500 }); }
}
