export const runtime = "nodejs"

const cache = new Map()

export async function GET(req) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").trim()

  if (!q) {
    return Response.json({ ok: false, error: "Missing q" }, { status: 400 })
  }

  if (cache.has(q)) {
    return Response.json({ ok: true, ...cache.get(q) })
  }

  const upstream = new URL("https://nominatim.openstreetmap.org/search")
  upstream.searchParams.set("format", "json")
  upstream.searchParams.set("limit", "1")
  upstream.searchParams.set("q", q)

  const r = await fetch(upstream.toString(), {
    headers: {
      "User-Agent": "route-binder, local app",
      "Accept": "application/json",
    },
  })

  if (!r.ok) {
    return Response.json({ ok: false, error: "Geocode upstream failed" }, { status: 502 })
  }

  const data = await r.json()
  const hit = Array.isArray(data) && data[0] ? data[0] : null

  if (!hit) {
    return Response.json({ ok: false, error: "No results" }, { status: 404 })
  }

  const payload = {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    label: hit.display_name || q,
  }

  cache.set(q, payload)
  return Response.json({ ok: true, ...payload })
}
