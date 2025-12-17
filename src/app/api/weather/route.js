import { NextResponse } from "next/server"

function isValidGeo(lat, lon) {
  const la = Number(lat)
  const lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false
  if (Math.abs(la) <= 1 && Math.abs(lo) <= 1) return false
  return true
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const r = await fetch(url, { signal: controller.signal, cache: "no-store" })
    const j = await r.json().catch(() => null)
    return { ok: r.ok, status: r.status, json: j }
  } finally {
    clearTimeout(t)
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get("lat"))
  const lon = Number(searchParams.get("lon"))

  if (!isValidGeo(lat, lon)) {
    return NextResponse.json({ ok: false, error: "Invalid coordinates" }, { status: 200 })
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,snowfall&timezone=auto`

  try {
    const out = await fetchJson(url, 10000)
    if (!out.ok || !out.json) {
      return NextResponse.json({ ok: false, error: "Weather unavailable" }, { status: 200 })
    }

    const c = out.json?.current || null
    return NextResponse.json(
      {
        ok: true,
        data: {
          current: c
            ? {
                temperature_2m: c.temperature_2m,
                weather_code: c.weather_code,
                wind_speed_10m: c.wind_speed_10m,
                wind_direction_10m: c.wind_direction_10m,
                precipitation: c.precipitation,
                snowfall: c.snowfall,
              }
            : null,
        },
      },
      { status: 200 }
    )
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Weather timeout" }, { status: 200 })
  }
}
