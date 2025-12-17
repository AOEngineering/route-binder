import { NextResponse } from "next/server"

function buildCandidates(raw) {
  const q = String(raw || "").trim()
  if (!q) return []

  const candidates = [q]

  const cleaned = q.replace(/\s+/g, " ").trim()
  if (cleaned && cleaned !== q) candidates.push(cleaned)

  // If the address starts with "27211, 27323 Wolf Rd ..."
  const m = cleaned.match(/^(\d+)\s*,\s*(\d+)\s+(.+)$/)
  if (m) {
    const a = m[1]
    const b = m[2]
    const rest = m[3]
    candidates.push(`${a} ${rest}`)
    candidates.push(`${b} ${rest}`)
  }

  // Remove a stray comma between numbers
  const noNumberComma = cleaned.replace(/(\d)\s*,\s*(\d)/g, "$1 $2")
  if (noNumberComma && noNumberComma !== cleaned) candidates.push(noNumberComma)

  // De comma the whole thing as a fallback
  const noCommas = cleaned.replace(/,\s*/g, " ")
  if (noCommas && noCommas !== cleaned) candidates.push(noCommas)

  // Dedup, keep order
  const seen = new Set()
  return candidates.filter(s => {
    if (!s) return false
    const k = s.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "route-binder/1.0 (hello@aoengineering.io)",
        "Accept": "application/json",
      },
      cache: "no-store",
    })
    const j = await r.json().catch(() => null)
    return { ok: r.ok, status: r.status, json: j }
  } finally {
    clearTimeout(t)
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const qRaw = searchParams.get("q") || ""
  const candidates = buildCandidates(qRaw)

  if (!candidates.length) {
    return NextResponse.json({ ok: false, error: "Missing query" }, { status: 200 })
  }

  for (const q of candidates) {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=` +
      encodeURIComponent(q)

    try {
      const out = await fetchJson(url, 9000)
      const arr = Array.isArray(out.json) ? out.json : []
      const hit = arr[0]
      const lat = Number(hit?.lat)
      const lon = Number(hit?.lon)

      if (Number.isFinite(lat) && Number.isFinite(lon) && !(Math.abs(lat) <= 1 && Math.abs(lon) <= 1)) {
        return NextResponse.json(
          {
            ok: true,
            lat,
            lon,
            label: hit?.display_name || q,
            queryUsed: q,
          },
          { status: 200 }
        )
      }
    } catch (e) {
      // keep trying candidates
    }
  }

  return NextResponse.json(
    { ok: false, error: "No results", queryTried: candidates[0] || "" },
    { status: 200 }
  )
}
