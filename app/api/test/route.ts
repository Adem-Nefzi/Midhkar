export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return new Response(JSON.stringify({ ok: true, message: "test endpoint works" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}