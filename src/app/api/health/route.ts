export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight probe for Railway / load balancers — no DB or auth. */
export async function GET(): Promise<Response> {
  return Response.json({ ok: true });
}
