import { NextResponse } from "next/server";
import { createManualEntry, getDashboardData } from "@/lib/server-tax-store";

export async function GET() {
  try { return NextResponse.json(await getDashboardData()); }
  catch (error) { console.error("[api] Static file read fallback", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Mode file statis aktif. Data utama dibaca dari /public/data/tax-data.json." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try { return NextResponse.json(await createManualEntry(await request.json()), { status: 201 }); }
  catch (error) { console.error("[api] Static mode session save fallback", error); return NextResponse.json({ error: `Gagal menyimpan data: ${error instanceof Error ? error.message : "Mode file statis aktif. Gunakan Download Updated JSON untuk menyimpan perubahan sebagai file statis."}` }, { status: 500 }); }
}
