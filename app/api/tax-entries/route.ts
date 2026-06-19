import { NextResponse } from "next/server";
import { createManualEntry, getDashboardData } from "@/lib/server-tax-store";

export async function GET() {
  try { return NextResponse.json(await getDashboardData()); }
  catch (error) { console.error("[api] Static file read", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Mode file statis aktif." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try { return NextResponse.json(await createManualEntry(await request.json()), { status: 201 }); }
  catch (error) { console.error("[api] Static file save", error); return NextResponse.json({ error: `Gagal menyimpan data: ${error instanceof Error ? error.message : "Mode file statis aktif. Data sementara tersimpan di browser."}` }, { status: 500 }); }
}
