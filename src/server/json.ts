import { NextResponse } from "next/server";

export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, string | number | boolean | null>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
