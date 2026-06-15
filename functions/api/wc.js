// Cloudflare Pages Function — served at  /api/wc
//
// Holds your football-data.org API key server-side and proxies three read-only
// resources for the World Cup (competition code "WC"). The browser never sees
// the key. Set the key as an encrypted environment variable named
// FOOTBALL_DATA_KEY in your Pages project settings.
//
//   /api/wc?resource=standings
//   /api/wc?resource=scorers
//   /api/wc?resource=matches

const ALLOWED = {
  standings: "standings",
  scorers: "scorers",
  matches: "matches",
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");

  if (!ALLOWED[resource]) {
    return json({ error: "invalid resource" }, 400);
  }
  if (!env.FOOTBALL_DATA_KEY) {
    return json({ error: "FOOTBALL_DATA_KEY not configured" }, 500);
  }

  const api = `https://api.football-data.org/v4/competitions/WC/${ALLOWED[resource]}`;

  try {
    const upstream = await fetch(api, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_KEY },
      // Cache at the edge for 60s so we stay well under the free 10 req/min limit
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err) {
    return json({ error: "upstream fetch failed", detail: String(err) }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
