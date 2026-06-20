import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  if (!process.env.DASHBOARD_EDIT_PASSWORD || password !== process.env.DASHBOARD_EDIT_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
