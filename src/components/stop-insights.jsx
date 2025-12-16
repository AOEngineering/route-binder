"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const StopMap = dynamic(() => import("./stop-map"), { ssr: false })

function codeLabel(code) {
  const map = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Snow showers",
    95: "Thunderstorm",
  }
  return map[code] || "Weather"
}

function lakeEffectHeuristic({ tempC, snowfallMm, precipMm, windDirDeg }) {
  const cold = Number.isFinite(tempC) && tempC <= 1
  const active = (snowfallMm || 0) > 0 || (precipMm || 0) > 0
  const dir = Number.isFinite(windDirDeg) ? windDirDeg : null

  // For Lake Erie west side, lake effect often shows up with WNW to NNW flow
  const inBand = dir !== null && dir >= 280 && dir <= 360

  if (cold && active && inBand) return { level: "High", note: "Wind favors lake banding" }
  if (cold && active) return { level: "Possible", note: "Cold with precip, watch wind shifts" }
  return { level: "Low", note: "No strong lake signal" }
}

export default function StopInsights({ stop }) {
  const [geo, setGeo] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [loadingWx, setLoadingWx] = useState(false)

  const query = useMemo(() => {
    if (!stop) return ""
    return `${stop.address}, ${stop.city}`
  }, [stop])

  useEffect(() => {
    let alive = true

    async function run() {
      if (!query) return

      setLoadingGeo(true)
      setGeo(null)
      setWeather(null)

      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        const j = await r.json()
        if (!alive) return
        if (!j.ok) return
        setGeo({ lat: j.lat, lon: j.lon, label: j.label })
      } finally {
        if (alive) setLoadingGeo(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [query])

  useEffect(() => {
    let alive = true

    async function run() {
      if (!geo?.lat || !geo?.lon) return

      setLoadingWx(true)
      try {
        const r = await fetch(`/api/weather?lat=${geo.lat}&lon=${geo.lon}`)
        const j = await r.json()
        if (!alive) return
        if (!j.ok) return
        setWeather(j.data)
      } finally {
        if (alive) setLoadingWx(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [geo?.lat, geo?.lon])

  const openMaps = () => {
    const u = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    window.open(u, "_blank", "noopener,noreferrer")
  }

  const current = weather?.current || null
  const lake = lakeEffectHeuristic({
    tempC: current?.temperature_2m,
    snowfallMm: current?.snowfall,
    precipMm: current?.precipitation,
    windDirDeg: current?.wind_direction_10m,
  })

  return (
    <Card className="rounded-none border border-slate-300 bg-white shadow-none">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Map and weather</div>
            <div className="text-xs text-slate-600 truncate">{query}</div>
          </div>
          <Button variant="outline" className="rounded-none border-slate-400" onClick={openMaps}>
            Open maps
          </Button>
        </div>

        <Separator className="bg-slate-200" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-xs text-slate-600">
              {loadingGeo ? "Finding location" : geo ? "Pinned" : "No pin yet"}
            </div>
            {geo && <StopMap lat={geo.lat} lon={geo.lon} label={stop.name} />}
            {!geo && !loadingGeo && (
              <div className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                Could not pin this stop yet, try Open maps.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-600">
                {loadingWx ? "Loading weather" : current ? "Current" : "No weather yet"}
              </div>
              {current && (
                <Badge
                  className={[
                    "rounded-none text-white",
                    lake.level === "High" ? "bg-emerald-600" : lake.level === "Possible" ? "bg-slate-900" : "bg-slate-300 text-slate-700",
                  ].join(" ")}
                >
                  Lake effect {lake.level}
                </Badge>
              )}
            </div>

            {current ? (
              <div className="border border-slate-300 bg-slate-50 p-3 space-y-2">
                <div className="text-sm font-semibold">{codeLabel(current.weather_code)}</div>
                <div className="text-sm">
                  Temp {Math.round(current.temperature_2m)} C
                </div>
                <div className="text-sm">
                  Wind {Math.round(current.wind_speed_10m)} kmh, dir {Math.round(current.wind_direction_10m)} deg
                </div>
                <div className="text-sm">
                  Precip {current.precipitation} mm, snow {current.snowfall} mm
                </div>
                <div className="text-xs text-slate-600">{lake.note}</div>
              </div>
            ) : (
              <div className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                Weather will appear once the stop is pinned.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
