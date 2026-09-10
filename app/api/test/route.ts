export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  console.log("Test endpoint invoked");
  return new Response(JSON.stringify({ ok: true, message: "test endpoint works" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: Request) {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", "Allow": "POST" },
  });
}