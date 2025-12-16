"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useRouteBinder } from "@/components/route-binder/route-binder-context"

function cx(...parts) {
  return parts.filter(Boolean).join(" ")
}

function formatQty(n) {
  if (n === null || n === undefined) return ""
  const v = Number(n)
  if (Number.isNaN(v)) return ""
  const s = v.toFixed(2)
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)))
  const mm = String(Math.floor(s / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  return `${mm}:${ss}`
}

function statusOf(stop) {
  if (stop?.progress?.completeAtTs) return "complete"
  if (stop?.progress?.arrivedAtTs) return "arrived"
  return "pending"
}

function statusPill(status) {
  if (status === "complete") return { label: "Complete", className: "bg-emerald-600 text-white" }
  if (status === "arrived") return { label: "On site", className: "bg-sky-600 text-white" }
  return { label: "Up next", className: "bg-zinc-800 text-white" }
}

function wxLabel(code) {
  const c = Number(code)
  if (!Number.isFinite(c)) return ""
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
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail",
  }
  return map[c] || `Code ${c}`
}

function cToF(c) {
  const v = Number(c)
  if (!Number.isFinite(v)) return null
  return (v * 9) / 5 + 32
}

function Panel({ title, right, children, className }) {
  return (
    <section className={cx("border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
      <div className="p-2">{children}</div>
    </section>
  )
}

function StatTile({ label, value, sub }) {
  const rendered = typeof value === "function" ? value() : value
  return (
    <div className="border border-zinc-200 p-2 dark:border-zinc-800">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{rendered}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  )
}


function TaskRow({ title, detail, done, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cx(
        "w-full border px-2 py-2 text-left transition",
        disabled ? "opacity-60" : "",
        done
          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">{title}</div>
          {detail ? <div className="mt-0.5 text-xs text-zinc-500 truncate">{detail}</div> : null}
        </div>
        <Badge className={done ? "bg-emerald-600 text-white" : "bg-zinc-800 text-white"}>{done ? "Done" : "Tap"}</Badge>
      </div>
    </button>
  )
}

function Segmented({ value, onChange, items }) {
  return (
    <div className="flex border border-zinc-200 dark:border-zinc-800">
      {items.map(it => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cx(
            "px-2 py-1 text-xs font-semibold",
            value === it.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

function stopChipClass(status, active) {
  if (active) return "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
  if (status === "complete") return "bg-emerald-600 text-white"
  if (status === "arrived") return "bg-sky-600 text-white"
  return "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
}

/**
  Sheet viewer overlay, remembers transform per stopId
  Supports pan, wheel zoom, two finger pinch zoom, double tap reset
*/
function SheetOverlay({ open, onClose, src, title, state, setState }) {
  const wrapRef = useRef(null)
  const lastTapRef = useRef(0)
  const pointers = useRef(new Map())
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1, startMid: null })

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const scale = Number.isFinite(state?.scale) ? state.scale : 1
  const x = Number.isFinite(state?.x) ? state.x : 0
  const y = Number.isFinite(state?.y) ? state.y : 0

  function clampScale(s) {
    return Math.max(0.75, Math.min(6, s))
  }

  function reset() {
    setState({ scale: 1, x: 0, y: 0 })
  }

  function onDoubleTapMaybe() {
    const now = Date.now()
    const dt = now - lastTapRef.current
    lastTapRef.current = now
    if (dt < 260) reset()
  }

  function onWheel(e) {
    e.preventDefault()
    const delta = -e.deltaY
    const factor = delta > 0 ? 1.08 : 0.92
    const nextScale = clampScale(scale * factor)
    setState({ scale: nextScale, x, y })
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      pinchRef.current = {
        active: true,
        startDist: dist,
        startScale: scale,
        startMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      }
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1 && !pinchRef.current.active) {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      setState({ scale, x: x + dx, y: y + dy })
      return
    }

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.sqrt(dx * dx + dy * dy)

      const pinch = pinchRef.current
      if (!pinch.active || pinch.startDist <= 0) return

      const ratio = dist / pinch.startDist
      const nextScale = clampScale(pinch.startScale * ratio)
      setState({ scale: nextScale, x, y })
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current.active = false
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/85">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-white">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{title || "Route sheet"}</div>
            <div className="text-xs text-white/70 truncate">{src}</div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setState({ scale: clampScale(scale * 1.15), x, y })}>
              Zoom in
            </Button>
            <Button variant="secondary" onClick={() => setState({ scale: clampScale(scale * 0.87), x, y })}>
              Zoom out
            </Button>
            <Button variant="secondary" onClick={reset}>
              Reset
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="relative flex-1 overflow-hidden"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onDoubleTapMaybe}
        >
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
              transformOrigin: "center center",
              touchAction: "none",
            }}
          >
            <img
              src={src}
              alt={title || "Route sheet"}
              className="max-h-[88vh] max-w-[92vw] select-none"
              draggable={false}
            />
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 text-xs text-white/70">
            Drag to pan, pinch or wheel to zoom, double tap to reset
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RouteBinderPage() {
  const {
    sortedStops,
    activeStopId,
    setActiveStopId,
    updateStop,

    activeElapsed,
    stats,
    progress,

    markArrived,
    markComplete,
    canComplete,
    goNextLocked,
    geocodeActiveStop,
  } = useRouteBinder()

  const active = useMemo(() => {
    if (!sortedStops?.length) return null
    return sortedStops.find(s => s.id === activeStopId) || sortedStops[0]
  }, [sortedStops, activeStopId])

  const activeIndex = useMemo(() => {
    if (!sortedStops?.length || !active) return 0
    return Math.max(0, sortedStops.findIndex(s => s.id === active.id))
  }, [sortedStops, active])

  const total = sortedStops?.length || 0

  const status = statusOf(active)
  const pill = statusPill(status)

  const site = active?.site || {}
  const schedule = active?.schedule || {}
  const work = active?.work || {}
  const checks = active?.checks || {}

  const addrLine = useMemo(() => {
    return [site.address, site.city, site.state, site.zip].filter(Boolean).join(", ")
  }, [site.address, site.city, site.state, site.zip])

  const geo = site?.geo || {}
  const lat = Number(geo.lat)
  const lon = Number(geo.lon)
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lon)

  const [geoState, setGeoState] = useState({ busy: false, error: "" })
  const [wxState, setWxState] = useState({ busy: false, error: "" })
  const [wx, setWx] = useState(null)
  const [tempUnit, setTempUnit] = useState("f") // f or c

  const [mobileMode, setMobileMode] = useState("sheet") // map, sheet, wx
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTransforms, setSheetTransforms] = useState({})

  function patch(p) {
    if (!active?.id) return
    updateStop(active.id, p)
  }

  async function locateStop() {
    const q = addrLine.trim()
    if (!q) return
    setGeoState({ busy: true, error: "" })
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const j = await r.json()
      if (!j?.ok) throw new Error(j?.error || "Geocode failed")

      patch({
        site: {
          ...site,
          geo: {
            lat: Number(j.lat),
            lon: Number(j.lon),
            label: j.label || q,
            source: "nominatim",
          },
        },
      })
    } catch (e) {
      setGeoState({ busy: false, error: String(e?.message || e) })
      return
    }
    setGeoState({ busy: false, error: "" })
  }

  async function loadWeather(forLat, forLon) {
    if (!Number.isFinite(forLat) || !Number.isFinite(forLon)) return
    setWxState({ busy: true, error: "" })
    try {
      const r = await fetch(`/api/weather?lat=${encodeURIComponent(forLat)}&lon=${encodeURIComponent(forLon)}`)
      const j = await r.json()
      if (!j?.ok) throw new Error(j?.error || "Weather failed")
      setWx(j.data || null)
    } catch (e) {
      setWxState({ busy: false, error: String(e?.message || e) })
      return
    }
    setWxState({ busy: false, error: "" })
  }

  useEffect(() => {
    if (!active?.id) return
    setWx(null)
    setWxState({ busy: false, error: "" })
    setGeoState({ busy: false, error: "" })

    const already = Number.isFinite(Number(site?.geo?.lat)) && Number.isFinite(Number(site?.geo?.lon))
    if (!already && addrLine) {
      locateStop()
      return
    }
    if (already) {
      loadWeather(Number(site.geo.lat), Number(site.geo.lon))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  useEffect(() => {
    if (!hasGeo) return
    loadWeather(lat, lon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon])

  async function copyAddress() {
    if (!addrLine) return
    try {
      await navigator.clipboard.writeText(addrLine)
    } catch {}
  }

  const mapsHref = addrLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrLine)}` : ""

  const saltDetail =
    work?.salt?.amount !== null && work?.salt?.product
      ? `${formatQty(work.salt.amount)} ${work.salt.unit} of ${work.salt.product}`
      : work?.salt?.product
        ? `${work.salt.product}`
        : ""

  const sidewalkDetail =
    work?.sidewalk?.amount !== null && work?.sidewalk?.product
      ? `${formatQty(work.sidewalk.amount)} ${work.sidewalk.unit} of ${work.sidewalk.product}`
      : work?.sidewalk?.product
        ? `${work.sidewalk.product}`
        : ""

  const satelliteDetail = work?.satellite?.salt ? `Salt: ${work.satellite.salt}` : ""

  const mapUrl = useMemo(() => {
    if (!hasGeo) return ""
    const d = 0.012
    const left = lon - d
    const right = lon + d
    const top = lat + d
    const bottom = lat - d
    const bbox = [left, bottom, right, top].join(",")
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`
  }, [hasGeo, lat, lon])

  const completed = Boolean(active?.progress?.completeAtTs)
  const arrived = Boolean(active?.progress?.arrivedAtTs)

  const canFinish = Boolean(active && canComplete(active))
  const lockWork = !arrived || completed

  const wxCurrent = wx?.current || null

  const windowBar = useMemo(() => {
    const parts = []
    if (schedule.serviceDays) parts.push(`Days ${schedule.serviceDays}`)
    if (schedule.firstCompletionTime) parts.push(`First ${schedule.firstCompletionTime}`)
    if (schedule.timeOpen) parts.push(`Open ${schedule.timeOpen}`)
    if (schedule.timeClosed) parts.push(`Close ${schedule.timeClosed}`)
    return parts.join(" , ")
  }, [schedule.serviceDays, schedule.firstCompletionTime, schedule.timeOpen, schedule.timeClosed])

  const sheetSrc = active?.sheet?.imageSrc || ""

  const sheetTransform = sheetTransforms[active?.id] || { scale: 1, x: 0, y: 0 }

  function setSheetTransform(next) {
    setSheetTransforms(prev => ({ ...prev, [active.id]: next }))
  }

  if (!active) {
    return (
      <div className="p-3">
        <Panel title="No stops">
          <div className="text-sm text-zinc-500">Seed your route, then this view will come alive.</div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Dense sticky header, one block */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-base font-semibold truncate">{site.slangName || "Unnamed stop"}</div>
              <Badge className={pill.className}>{pill.label}</Badge>
              {active?.meta?.injected ? <Badge variant="secondary" className="px-2 py-1">Injected</Badge> : null}
              {active?.meta?.assist ? <Badge variant="secondary" className="px-2 py-1">Assist</Badge> : null}
              <Badge variant="secondary" className="px-2 py-1">
                Stop {activeIndex + 1} of {total}
              </Badge>
              <Badge variant="secondary" className="px-2 py-1">
                Timer {formatDuration(activeElapsed)}
              </Badge>
            </div>

            <div className="mt-0.5 text-xs text-zinc-500 truncate">
              Route {site.routeNumber || "?"} , {addrLine || "No address"} {windowBar ? `, ${windowBar}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => markArrived(active.id)} disabled={arrived || completed}>
              Arrived
            </Button>
            <Button variant="secondary" onClick={() => markComplete(active.id)} disabled={!canFinish}>
              Complete
            </Button>
            <Button variant="outline" onClick={goNextLocked} disabled={!completed}>
              Next
            </Button>
          </div>
        </div>

        <div className="mt-2">
          <div className="h-2 w-full border border-zinc-200 dark:border-zinc-800">
            <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Route progress {stats.complete} complete , {stats.pending} pending
          </div>
        </div>
      </div>

      <div className="p-2 pb-20">
        <div className="grid grid-cols-12 gap-2">
          {/* Left rail */}
          <div className="col-span-12 lg:col-span-4 grid gap-2">
            <Panel
              title="Actions"
              right={
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={locateStop} disabled={!addrLine || geoState.busy}>
                    {geoState.busy ? "Locating" : "Locate"}
                  </Button>
                  <Button variant="outline" onClick={() => hasGeo && loadWeather(lat, lon)} disabled={!hasGeo || wxState.busy}>
                    {wxState.busy ? "Wx" : "Refresh wx"}
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={copyAddress} disabled={!addrLine}>
                  Copy address
                </Button>
                <Button variant="secondary" asChild disabled={!mapsHref}>
                  <a href={mapsHref} target="_blank" rel="noreferrer">Open maps</a>
                </Button>
              </div>

              {(geoState.error || wxState.error) ? (
                <div className="mt-2 border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {geoState.error || wxState.error}
                </div>
              ) : null}

              <Separator className="my-2" />

              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Open" value={schedule.timeOpen || "?"} />
                <StatTile label="Close" value={schedule.timeClosed || "?"} />
                <StatTile label="Days" value={schedule.serviceDays || "?"} />
                <StatTile label="First" value={schedule.firstCompletionTime || "?"} />
              </div>

              {active.specialNotes ? (
                <>
                  <Separator className="my-2" />
                  <div className="text-xs text-zinc-500">Special</div>
                  <div className="mt-0.5 text-sm">{active.specialNotes}</div>
                </>
              ) : null}
            </Panel>

            <Panel title="Work list">
              <div className="grid gap-2">
                <TaskRow
                  title="Plow"
                  detail={work?.plow?.targetInches ? `${work.plow.targetInches} inch target` : "Use the sheet and site feel"}
                  done={Boolean(checks.plowDone)}
                  disabled={lockWork}
                  onToggle={() => patch({ checks: { ...checks, plowDone: !checks.plowDone } })}
                />

                <TaskRow
                  title="Salt"
                  detail={saltDetail || "No salt instructions"}
                  done={Boolean(checks.saltDone)}
                  disabled={lockWork}
                  onToggle={() => patch({ checks: { ...checks, saltDone: !checks.saltDone } })}
                />

                <TaskRow
                  title="Sidewalk"
                  detail={sidewalkDetail || "No sidewalk instructions"}
                  done={Boolean(checks.sidewalkDone)}
                  disabled={lockWork}
                  onToggle={() => patch({ checks: { ...checks, sidewalkDone: !checks.sidewalkDone } })}
                />

                <TaskRow
                  title="Satellite check"
                  detail={satelliteDetail || "None"}
                  done={Boolean(checks.satelliteChecked)}
                  disabled={lockWork}
                  onToggle={() => patch({ checks: { ...checks, satelliteChecked: !checks.satelliteChecked } })}
                />

                <TaskRow
                  title="Photo"
                  detail="Proof photo if needed"
                  done={Boolean(checks.photoCaptured)}
                  disabled={lockWork}
                  onToggle={() => patch({ checks: { ...checks, photoCaptured: !checks.photoCaptured } })}
                />
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                Work is locked until Arrived, Complete is locked until required items are done.
              </div>
            </Panel>
          </div>

          {/* Right side, tablet shows two panes, phone uses modes */}
          <div className="col-span-12 lg:col-span-8 grid gap-2">
            {/* Phone mode selector */}
            <div className="lg:hidden">
              <Segmented
                value={mobileMode}
                onChange={setMobileMode}
                items={[
                  { value: "sheet", label: "Sheet" },
                  { value: "map", label: "Map" },
                  { value: "wx", label: "Conditions" },
                ]}
              />
            </div>

            {/* Tablet, map and wx side by side */}
            <div className="hidden lg:grid grid-cols-2 gap-2">
              <Panel
                title="Map"
                right={<div className="text-[11px] text-zinc-500">{hasGeo ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "No coords"}</div>}
              >
                <div className="border border-zinc-200 dark:border-zinc-800">
                  {hasGeo ? (
                    <iframe title="map" src={mapUrl} className="h-[32vh] w-full" loading="lazy" />
                  ) : (
                    <div className="p-2 text-sm text-zinc-500">No location yet. Press Locate.</div>
                  )}
                </div>
                {hasGeo && geo.label ? (
                  <div className="mt-1 text-[11px] text-zinc-500 break-words">Label , {geo.label}</div>
                ) : null}
              </Panel>

              <Panel
                title="Conditions"
                right={
                  <div className="flex items-center gap-2">
                    <Segmented
                      value={tempUnit}
                      onChange={setTempUnit}
                      items={[
                        { value: "f", label: "F" },
                        { value: "c", label: "C" },
                      ]}
                    />
                  </div>
                }
              >
                {!hasGeo ? (
                  <div className="text-sm text-zinc-500">Locate the stop to load conditions.</div>
                ) : !wxCurrent ? (
                  <div className="text-sm text-zinc-500">{wxState.busy ? "Loading" : "No data yet"}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <StatTile
                      label="Temp"
                      value={() => {
                        const c = wxCurrent.temperature_2m
                        const f = cToF(c)
                        if (tempUnit === "c") return Number.isFinite(Number(c)) ? `${Math.round(c)}°C` : "?"
                        return Number.isFinite(Number(f)) ? `${Math.round(f)}°F` : "?"
                      }}
                      sub={wxLabel(wxCurrent.weather_code)}
                    />
                    <StatTile
                      label="Wind"
                      value={Number.isFinite(wxCurrent.wind_speed_10m) ? `${Math.round(wxCurrent.wind_speed_10m)} mph` : "?"}
                      sub={Number.isFinite(wxCurrent.wind_direction_10m) ? `${Math.round(wxCurrent.wind_direction_10m)}°` : ""}
                    />
                    <StatTile label="Precip" value={Number.isFinite(wxCurrent.precipitation) ? `${wxCurrent.precipitation} mm` : "?"} />
                    <StatTile label="Snow" value={Number.isFinite(wxCurrent.snowfall) ? `${wxCurrent.snowfall} cm` : "?"} />
                  </div>
                )}
              </Panel>
            </div>

            {/* Phone, show selected panel */}
            <div className="lg:hidden">
              {mobileMode === "map" ? (
                <Panel title="Map" right={<div className="text-[11px] text-zinc-500">{hasGeo ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "No coords"}</div>}>
                  <div className="border border-zinc-200 dark:border-zinc-800">
                    {hasGeo ? (
                      <iframe title="map" src={mapUrl} className="h-[38vh] w-full" loading="lazy" />
                    ) : (
                      <div className="p-2 text-sm text-zinc-500">No location yet. Press Locate.</div>
                    )}
                  </div>
                  {hasGeo && geo.label ? (
                    <div className="mt-1 text-[11px] text-zinc-500 break-words">Label , {geo.label}</div>
                  ) : null}
                </Panel>
              ) : null}

              {mobileMode === "wx" ? (
                <Panel
                  title="Conditions"
                  right={
                    <Segmented
                      value={tempUnit}
                      onChange={setTempUnit}
                      items={[
                        { value: "f", label: "F" },
                        { value: "c", label: "C" },
                      ]}
                    />
                  }
                >
                  {!hasGeo ? (
                    <div className="text-sm text-zinc-500">Locate the stop to load conditions.</div>
                  ) : !wxCurrent ? (
                    <div className="text-sm text-zinc-500">{wxState.busy ? "Loading" : "No data yet"}</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <StatTile
                        label="Temp"
                        value={() => {
                          const c = wxCurrent.temperature_2m
                          const f = cToF(c)
                          if (tempUnit === "c") return Number.isFinite(Number(c)) ? `${Math.round(c)}°C` : "?"
                          return Number.isFinite(Number(f)) ? `${Math.round(f)}°F` : "?"
                        }}
                        sub={wxLabel(wxCurrent.weather_code)}
                      />
                      <StatTile
                        label="Wind"
                        value={Number.isFinite(wxCurrent.wind_speed_10m) ? `${Math.round(wxCurrent.wind_speed_10m)} mph` : "?"}
                        sub={Number.isFinite(wxCurrent.wind_direction_10m) ? `${Math.round(wxCurrent.wind_direction_10m)}°` : ""}
                      />
                      <StatTile label="Precip" value={Number.isFinite(wxCurrent.precipitation) ? `${wxCurrent.precipitation} mm` : "?"} />
                      <StatTile label="Snow" value={Number.isFinite(wxCurrent.snowfall) ? `${wxCurrent.snowfall} cm` : "?"} />
                    </div>
                  )}
                </Panel>
              ) : null}
            </div>

            {/* Sheet always present on tablet, and also present on phone when mode is sheet */}
            {(mobileMode === "sheet" || !mobileMode) ? (
              <Panel
                title="Route sheet"
                right={
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setSheetOpen(true)} disabled={!sheetSrc}>
                      Expand
                    </Button>
                    <Button variant="outline" onClick={geocodeActiveStop}>
                      Fix geo
                    </Button>
                  </div>
                }
                className={cx("lg:block", mobileMode !== "sheet" ? "lg:block" : "")}
              >
                {sheetSrc ? (
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="w-full border border-zinc-200 dark:border-zinc-800"
                  >
                    <Image
                      src={sheetSrc}
                      alt={`${site.slangName || "Stop"} route sheet`}
                      width={1600}
                      height={1000}
                      className="h-auto w-full"
                      priority
                    />
                  </button>
                ) : (
                  <div className="border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
                    No sheet image yet for this stop.
                  </div>
                )}
              </Panel>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom queue strip */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2 overflow-x-auto">
          {sortedStops.map((s, idx) => {
            const st = statusOf(s)
            const isActive = s.id === activeStopId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStopId(s.id)}
                className={cx(
                  "shrink-0 border px-2 py-1 text-xs font-semibold",
                  stopChipClass(st, isActive),
                  "border-zinc-200 dark:border-zinc-800"
                )}
                title={`${idx + 1} , ${s.site?.slangName || s.id}`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      </div>

      <SheetOverlay
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        src={sheetSrc}
        title={site.slangName}
        state={sheetTransform}
        setState={setSheetTransform}
      />
    </div>
  )
}
