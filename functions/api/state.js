// Cloudflare Pages Function — served at  /api/state
//
// Shared storage for both players' picks, backed by a Cloudflare KV namespace.
// Bind a KV namespace to this project with the binding name  PICKS.
//
//   GET  /api/state            -> { playerNames, picks: [p0, p1] }
//   POST /api/state  body:
//        { slot: 0|1, picks: {...} }   -> saves one player's picks
//        { names: ["A","B"] }          -> saves the shared display names
//
// Each player only ever writes their own slot, so concurrent edits by the two
// players can't overwrite each other.

export async function onRequest(context) {
    const { request, env } = context;
    const kv = env.PICKS;

    if (!kv) return json({ error: "KV namespace 'PICKS' not bound" }, 500);

    if (request.method === "GET") {
        const [p0, p1, names] = await Promise.all([
            kv.get("picks:0"),
            kv.get("picks:1"),
            kv.get("names"),
        ]);
        return json({
            playerNames: names ? safeParse(names) : null,
            picks: [safeParse(p0), safeParse(p1)],
        });
    }

    if (request.method === "POST") {
        let body;
        try { body = await request.json(); }
        catch { return json({ error: "invalid JSON body" }, 400); }

        if (Array.isArray(body.names)) {
            await kv.put("names", JSON.stringify(body.names.slice(0, 2)));
            return json({ ok: true });
        }

        if (body.slot === 0 || body.slot === 1) {
            if (!body.picks || typeof body.picks !== "object") {
                return json({ error: "missing picks object" }, 400);
            }
            await kv.put(`picks:${body.slot}`, JSON.stringify(body.picks));
            return json({ ok: true });
        }

        return json({ error: "nothing to save" }, 400);
    }

    return json({ error: "method not allowed" }, 405);
}

function safeParse(s) {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
}

function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
        },
    });
}