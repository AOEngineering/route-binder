export const runtime = "nodejs"

export async function GET(req) {
  const url = new URL(req.url)
  const lat = Number(url.searchParams.get("lat"))
  const lon = Number(url.searchParams.get("lon"))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ ok: false, error: "Missing lat or lon" }, { status: 400 })
  }

  const upstream = new URL("https://api.open-meteo.com/v1/forecast")
  upstream.searchParams.set("latitude", String(lat))
  upstream.searchParams.set("longitude", String(lon))
  upstream.searchParams.set(
    "current",
    [
      "temperature_2m",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "precipitation",
      "rain",
      "snowfall",
    ].join(",")
  )
  upstream.searchParams.set("hourly", ["precipitation", "snowfall"].join(","))
  upstream.searchParams.set("forecast_days", "1")
  upstream.searchParams.set("timezone", "auto")

  const r = await fetch(upstream.toString(), { headers: { Accept: "application/json" } })

  if (!r.ok) {
    return Response.json({ ok: false, error: "Weather upstream failed" }, { status: 502 })
  }

  const data = await r.json()
  return Response.json({ ok: true, data })
}
