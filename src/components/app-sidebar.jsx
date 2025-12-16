"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { useRouteBinder } from "@/components/route-binder/route-binder-context"

function cx(...parts) {
  return parts.filter(Boolean).join(" ")
}

function statusOf(stop) {
  if (stop.completeAtTs) return "complete"
  if (stop.arrivedAtTs) return "arrived"
  return "pending"
}

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

  const inBand = dir !== null && dir >= 280 && dir <= 360

  if (cold && active && inBand) return { level: "High", note: "Wind favors lake banding" }
  if (cold && active) return { level: "Possible", note: "Cold with precip, watch wind shifts" }
  return { level: "Low", note: "No strong lake signal" }
}

function snowNowBadge(current) {
  if (!current) return { label: "No data", className: "bg-slate-200 text-slate-900" }

  const snow = (current.snowfall || 0) > 0
  const rain = (current.rain || 0) > 0
  const precip = (current.precipitation || 0) > 0
  const code = current.weather_code

  const looksSnow =
    snow ||
    code === 71 ||
    code === 73 ||
    code === 75 ||
    code === 77 ||
    code === 85 ||
    code === 86

  if (looksSnow) return { label: "Snow", className: "bg-slate-900 text-white" }
  if (rain) return { label: "Rain", className: "bg-slate-900 text-white" }
  if (precip) return { label: "Precip", className: "bg-slate-900 text-white" }
  return { label: "Clear", className: "bg-slate-200 text-slate-900" }
}

const geoCache = new Map()
const wxCache = new Map()

function StopHoverCard({ stop, isActive, onSelect }) {
  const [open, setOpen] = useState(false)
  const [geo, setGeo] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [loadingWx, setLoadingWx] = useState(false)

  const query = useMemo(() => `${stop.address}, ${stop.city}`, [stop.address, stop.city])

  useEffect(() => {
    let alive = true

    async function run() {
      if (!open) return

      if (geoCache.has(stop.id)) {
        const g = geoCache.get(stop.id)
        setGeo(g)
      } else {
        setLoadingGeo(true)
        try {
          const r = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
          const j = await r.json()
          if (!alive) return
          if (j.ok) {
            const g = { lat: j.lat, lon: j.lon, label: j.label }
            geoCache.set(stop.id, g)
            setGeo(g)
          }
        } finally {
          if (alive) setLoadingGeo(false)
        }
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [open, stop.id, query])

  useEffect(() => {
    let alive = true

    async function run() {
      if (!open) return
      if (!geo?.lat || !geo?.lon) return

      const key = `${stop.id}:${geo.lat.toFixed(5)},${geo.lon.toFixed(5)}`
      if (wxCache.has(key)) {
        setWeather(wxCache.get(key))
        return
      }

      setLoadingWx(true)
      try {
        const r = await fetch(`/api/weather?lat=${geo.lat}&lon=${geo.lon}`)
        const j = await r.json()
        if (!alive) return
        if (j.ok) {
          wxCache.set(key, j.data)
          setWeather(j.data)
        }
      } finally {
        if (alive) setLoadingWx(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [open, geo?.lat, geo?.lon, stop.id])

  const current = weather?.current || null
  const snow = snowNowBadge(current)
  const lake = lakeEffectHeuristic({
    tempC: current?.temperature_2m,
    snowfallMm: current?.snowfall,
    precipMm: current?.precipitation,
    windDirDeg: current?.wind_direction_10m,
  })

  const lakePill =
    lake.level === "High"
      ? { label: "Lake effect High", className: "bg-emerald-600 text-white" }
      : lake.level === "Possible"
      ? { label: "Lake effect Possible", className: "bg-slate-900 text-white" }
      : { label: "Lake effect Low", className: "bg-slate-200 text-slate-900" }

  const mapSrc = geo
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${geo.lat},${geo.lon}&zoom=15&size=420x220&markers=${geo.lat},${geo.lon},red-pushpin`
    : ""

  return (
    <HoverCard openDelay={200} closeDelay={120} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <div>
          <SidebarMenuButton
            tooltip={`${String(stop.order).padStart(2, "0")} ${stop.name}`}
            onClick={onSelect}
            className={cx(
              "rounded-none",
              isActive ? "bg-slate-900 text-white" : ""
            )}
          >
            <span className="text-xs tabular-nums">{String(stop.order).padStart(2, "0")}</span>
            <span className="ml-2 truncate group-data-[collapsible=icon]:hidden">{stop.name}</span>
          </SidebarMenuButton>
        </div>
      </HoverCardTrigger>

      <HoverCardContent align="start" side="right" className="w-[420px] rounded-none border border-slate-300 p-0">
        <div className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {String(stop.order).padStart(2, "0")} {stop.name}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {stop.address}, {stop.city}
              </div>
              <div className="text-xs text-slate-600 mt-1">{stop.window}</div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge className={cx("rounded-none", snow.className)}>{snow.label}</Badge>
              <Badge className={cx("rounded-none", lakePill.className)}>{lakePill.label}</Badge>
            </div>
          </div>

          <div className="mt-3">
            {loadingGeo && (
              <div className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                Pinning location
              </div>
            )}

            {!loadingGeo && !geo && (
              <div className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                No pin yet for this stop
              </div>
            )}

            {geo && (
              <div className="border border-slate-300 bg-white">
                <img
                  src={mapSrc}
                  alt="Map preview"
                  className="block w-full h-[180px] object-cover"
                />
              </div>
            )}
          </div>

          <div className="mt-3 border border-slate-300 bg-slate-50 p-3">
            {loadingWx && (
              <div className="text-sm text-slate-700">Loading weather</div>
            )}

            {!loadingWx && current && (
              <div className="space-y-1">
                <div className="text-sm font-semibold">{codeLabel(current.weather_code)}</div>
                <div className="text-sm text-slate-700">
                  Temp {Math.round(current.temperature_2m)} C
                </div>
                <div className="text-sm text-slate-700">
                  Wind {Math.round(current.wind_speed_10m)} kmh, dir {Math.round(current.wind_direction_10m)} deg
                </div>
                <div className="text-xs text-slate-600">{lake.note}</div>
              </div>
            )}

            {!loadingWx && !current && (
              <div className="text-sm text-slate-700">
                Weather will appear once pinned
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function AppSidebar() {
  const {
    truck,
    routeName,
    routeLabel,
    stats,
    progress,
    inboxItems,
    queueFilter,
    setQueueFilter,
    queueStops,
    activeStopId,
    selectStop,
    setMode,
  } = useRouteBinder()

  const inboxCount = inboxItems.length

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
                Route Binder
              </div>
              <div className="text-xs text-slate-600 group-data-[collapsible=icon]:hidden">
                Truck {truck}, {routeName}
              </div>
              <div className="mt-2 text-xs text-slate-600 group-data-[collapsible=icon]:hidden">
                {routeLabel}
              </div>
            </div>

            {inboxCount > 0 && (
              <Badge className="rounded-none bg-blue-600 text-white group-data-[collapsible=icon]:hidden">
                Inbox {inboxCount}
              </Badge>
            )}

            {inboxCount > 0 && (
              <div className="hidden group-data-[collapsible=icon]:block">
                <Badge className="rounded-none bg-blue-600 text-white">{inboxCount}</Badge>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs group-data-[collapsible=icon]:hidden">
            <span className="text-slate-600">{stats.complete} of {stats.total}</span>
          </div>

          <div className="mt-2 group-data-[collapsible=icon]:hidden">
            <Progress value={progress} className="h-2 rounded-none bg-slate-200" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Queue
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <div className="px-2 pb-2 grid grid-cols-3 gap-2 group-data-[collapsible=icon]:hidden">
              <Button
                variant="outline"
                className={cx("rounded-none", queueFilter === "all" ? "bg-slate-100" : "")}
                onClick={() => setQueueFilter("all")}
              >
                All
              </Button>
              <Button
                variant="outline"
                className={cx("rounded-none", queueFilter === "pending" ? "bg-slate-100" : "")}
                onClick={() => setQueueFilter("pending")}
              >
                Pending
              </Button>
              <Button
                variant="outline"
                className={cx("rounded-none", queueFilter === "complete" ? "bg-slate-100" : "")}
                onClick={() => setQueueFilter("complete")}
              >
                Done
              </Button>
            </div>

            <SidebarMenu>
              {queueStops.map(s => {
                const isActive = s.id === activeStopId
                return (
                  <SidebarMenuItem key={s.id}>
                    <StopHoverCard
                      stop={s}
                      isActive={isActive}
                      onSelect={() => selectStop(s.id)}
                    />
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="p-2 grid grid-cols-2 gap-2 group-data-[collapsible=icon]:grid-cols-1">
          <Button
            className="rounded-none bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => setMode("work")}
          >
            <span className="group-data-[collapsible=icon]:hidden">Work</span>
            <span className="hidden group-data-[collapsible=icon]:block">W</span>
          </Button>

          <Button
            variant="outline"
            className="rounded-none"
            onClick={() => setMode("inbox")}
          >
            <span className="group-data-[collapsible=icon]:hidden">Inbox</span>
            <span className="hidden group-data-[collapsible=icon]:block">I</span>
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
