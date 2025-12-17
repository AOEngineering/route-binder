"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useRouteBinder } from "@/components/route-binder/route-binder-context"

const StopMap = dynamic(() => import("@/components/stop-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[240px] w-full overflow-hidden border border-zinc-200 bg-white p-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
      Loading map
    </div>
  ),
})


function cx(...parts) {
  return parts.filter(Boolean).join(" ")
}

function isValidGeo(lat, lon) {
  const la = Number(lat)
  const lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false
  if (Math.abs(la) <= 1 && Math.abs(lo) <= 1) return false
  return true
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
        done ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
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
            value === it.value ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
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

function SheetOverlay({ open, onClose, src, title, state, setState }) {
  const lastTapRef = useRef(0)
  const pointers = useRef(new Map())
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 })

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
  const rot = Number.isFinite(state?.rot) ? state.rot : 0

  function clampScale(s) {
    return Math.max(0.75, Math.min(6, s))
  }

  function normalizeRot(v) {
    const n = Number(v) || 0
    return ((n % 360) + 360) % 360
  }

  function reset() {
    setState({ scale: 1, x: 0, y: 0, rot: 0 })
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
    setState({ scale: nextScale, x, y, rot })
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      pinchRef.current = { active: true, startDist: dist, startScale: scale }
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1 && !pinchRef.current.active) {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      setState({ scale, x: x + dx, y: y + dy, rot })
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
      setState({ scale: nextScale, x, y, rot })
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

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setState({ scale: clampScale(scale * 1.15), x, y, rot })}>
              Zoom in
            </Button>
            <Button variant="secondary" onClick={() => setState({ scale: clampScale(scale * 0.87), x, y, rot })}>
              Zoom out
            </Button>
            <Button variant="secondary" onClick={() => setState({ scale, x, y, rot: normalizeRot(rot - 90) })}>
              Rotate left
            </Button>
            <Button variant="secondary" onClick={() => setState({ scale, x, y, rot: normalizeRot(rot + 90) })}>
              Rotate right
            </Button>
            <Button variant="secondary" onClick={reset}>
              Reset
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>

        <div
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
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
              transformOrigin: "center center",
              touchAction: "none",
            }}
          >
            <img src={src} alt={title || "Route sheet"} className="max-h-[88vh] max-w-[92vw] select-none" draggable={false} />
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
    truck,
    routeName,
    routeLabel,

    sortedStops,
    activeStopId,
    selectStop,
    updateStop,

    activeElapsed,
    stats,
    progress,

    markArrived,
    markComplete,
    canComplete,
    goNextLocked,
    geocodeActiveStop,

    mode,
    setMode,

    inboxItems,
    pendingInboxCount,
    acceptInboxItemToRoute,
    rejectInboxItem,

    routeDoneAtTs,
    clearRouteDone,

    exportRouteJson,
    exportRouteCsv,
    startFreshRun,

    nextStop,
    operableStopId,
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
  const hasGeo = isValidGeo(lat, lon)

  const [geoState, setGeoState] = useState({ busy: false, error: "" })
  const [wxState, setWxState] = useState({ busy: false, error: "" })
  const [wx, setWx] = useState(null)
  const [tempUnit, setTempUnit] = useState("f")

  const [mobileMode, setMobileMode] = useState("sheet")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTransforms, setSheetTransforms] = useState({})
  const [sheetDims, setSheetDims] = useState({})

  const [switchState, setSwitchState] = useState({ busy: false, targetId: null, startTs: 0 })
  const [sheetLoading, setSheetLoading] = useState(false)

  const completed = Boolean(active?.progress?.completeAtTs)
  const arrived = Boolean(active?.progress?.arrivedAtTs)

  // Only "view only" for future stops, not for completed history
  const viewOnly = Boolean(active?.id && operableStopId && active.id !== operableStopId && !completed)

  function patch(p) {
    if (!active?.id) return
    updateStop(active.id, p)
  }

  async function locateStop() {
    const q = addrLine.trim()
    if (!q) return
    setGeoState({ busy: true, error: "" })
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      const j = await r.json().catch(() => null)
      if (!j?.ok) throw new Error(j?.error || "Geocode failed")

      const nextLat = Number(j.lat)
      const nextLon = Number(j.lon)
      if (!isValidGeo(nextLat, nextLon)) throw new Error("Bad coordinates")

      patch({
        site: {
          ...site,
          geo: { lat: nextLat, lon: nextLon, label: j.label || q, source: "nominatim" },
        },
      })
    } catch (e) {
      setGeoState({ busy: false, error: String(e?.message || e) })
      return
    }
    setGeoState({ busy: false, error: "" })
  }

  const lastWxKeyRef = useRef("")
  async function loadWeather(forLat, forLon) {
    if (!isValidGeo(forLat, forLon)) return

    const key = `${Number(forLat).toFixed(5)},${Number(forLon).toFixed(5)}`
    if (lastWxKeyRef.current === key) return
    lastWxKeyRef.current = key

    setWxState({ busy: true, error: "" })
    try {
      const r = await fetch(`/api/weather?lat=${encodeURIComponent(forLat)}&lon=${encodeURIComponent(forLon)}`, { cache: "no-store" })
      const j = await r.json().catch(() => null)
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

    setSheetLoading(Boolean(active?.sheet?.imageSrc))

    const already = isValidGeo(site?.geo?.lat, site?.geo?.lon)
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
  }, [hasGeo, lat, lon])

  useEffect(() => {
    if (!switchState.busy) return
    if (!switchState.targetId) return
    if (activeStopId !== switchState.targetId) return
    if (sheetLoading) return

    const elapsed = Date.now() - (switchState.startTs || Date.now())
    const wait = Math.max(0, 250 - elapsed)
    const t = setTimeout(() => setSwitchState({ busy: false, targetId: null, startTs: 0 }), wait)
    return () => clearTimeout(t)
  }, [switchState, activeStopId, sheetLoading])

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

  const canFinish = Boolean(active && canComplete(active))

  // Work edits are still locked until arrived, and after completion
  const lockWork = viewOnly || !arrived || completed

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
  const sheetTransform = sheetTransforms[active?.id] || { scale: 1, x: 0, y: 0, rot: 0 }

  function setSheetTransform(next) {
    if (!active?.id) return
    setSheetTransforms(prev => ({ ...prev, [active.id]: next }))
  }

  function normalizeRot(v) {
    const n = Number(v) || 0
    return ((n % 360) + 360) % 360
  }

  function rotateSheet(deltaDeg) {
    setSheetTransform({ ...sheetTransform, rot: normalizeRot((sheetTransform.rot || 0) + deltaDeg) })
  }

  function resetSheet() {
    setSheetTransform({ scale: 1, x: 0, y: 0, rot: 0 })
  }

  // rotation and perfect fit preview logic
  const sheetRot = Number.isFinite(sheetTransform?.rot) ? sheetTransform.rot : 0
  const quarterTurn = Math.abs(Math.round(sheetRot / 90)) % 2 === 1

  const dims = sheetDims[active?.id] || { w: 1600, h: 1000 }
  const baseW = Number(dims.w) > 0 ? Number(dims.w) : 1600
  const baseH = Number(dims.h) > 0 ? Number(dims.h) : 1000
  const viewportAspect = quarterTurn ? `${baseH} / ${baseW}` : `${baseW} / ${baseH}`

  const isDoneBanner = Boolean(routeDoneAtTs)
  const hasNext = Boolean(nextStop)

  if (!active && mode === "work") {
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
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <div className="text-base font-semibold truncate">
                {mode === "inbox" ? "Inbox" : site.slangName || "Unnamed stop"}
              </div>

              {mode === "work" ? <Badge className={pill.className}>{pill.label}</Badge> : null}

              {mode === "work" && viewOnly ? (
                <Badge variant="secondary" className="px-2 py-1">
                  Viewing only
                </Badge>
              ) : null}

              {mode === "work" && active?.meta?.injected ? <Badge variant="secondary" className="px-2 py-1">Injected</Badge> : null}
              {mode === "work" && active?.meta?.assist ? <Badge variant="secondary" className="px-2 py-1">Assist</Badge> : null}

              {mode === "work" ? (
                <>
                  <Badge variant="secondary" className="px-2 py-1">
                    Stop {activeIndex + 1} of {total}
                  </Badge>
                  <Badge variant="secondary" className="px-2 py-1">
                    Timer {formatDuration(activeElapsed)}
                  </Badge>
                </>
              ) : null}

              {pendingInboxCount > 0 ? (
                <Badge className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  Inbox {pendingInboxCount}
                </Badge>
              ) : null}
            </div>

            {mode === "work" ? (
              <div className="mt-0.5 text-xs text-zinc-500 break-words">
                Route {site.routeNumber || "?"} , {addrLine || "No address"} {windowBar ? `, ${windowBar}` : ""}
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-zinc-500 break-words">
                Accept to inject after your current stop, reject to discard
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center border border-zinc-200 dark:border-zinc-800">
              <Button variant={mode === "work" ? "secondary" : "outline"} onClick={() => setMode("work")} className="rounded-none border-0">
                Work
              </Button>
              <Button variant={mode === "inbox" ? "secondary" : "outline"} onClick={() => setMode("inbox")} className="rounded-none border-0">
                Inbox
              </Button>
            </div>

            {mode === "work" ? (
              <>
                <Separator className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => markArrived(active.id)} disabled={viewOnly || arrived || completed}>
                    Arrived
                  </Button>
                  <Button variant="secondary" onClick={() => markComplete(active.id)} disabled={viewOnly || !canFinish}>
                    Complete
                  </Button>

                  <Button
                    variant="outline"
                    onClick={goNextLocked}
                    disabled={!completed}
                    title={!completed ? "Complete this stop first" : "Next"}
                  >
                    {completed && !hasNext ? "Finish" : "Next"}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {mode === "work" ? (
          <div className="mt-2">
            <div className="h-2 w-full border border-zinc-200 dark:border-zinc-800">
              <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Route progress {stats.complete} complete , {stats.pending} pending
            </div>
          </div>
        ) : null}
      </div>

      {switchState.busy ? (
        <div className="fixed inset-0 z-[55] bg-black/30">
          <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
              <div className="text-sm font-semibold">Loading stop</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="p-2 pb-20">
        {mode === "inbox" ? (
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 xl:col-span-4 grid gap-2">
              <Panel title="Inbox status" right={<div className="text-[11px] text-zinc-500">{pendingInboxCount} pending</div>}>
                <div className="text-sm text-zinc-500">Accept injects a new stop right after your current stop. It does not jump you forward.</div>
              </Panel>
            </div>

            <div className="col-span-12 xl:col-span-8 grid gap-2">
              <Panel title="Items">
                <div className="grid gap-2">
                  {inboxItems?.length ? (
                    inboxItems.map(item => (
                      <div key={item.id} className="border p-2 border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">{item.title || "Inbox"}</div>
                              <Badge className="bg-zinc-800 text-white">New</Badge>
                            </div>

                            <div className="mt-0.5 text-xs text-zinc-500 truncate">
                              {item.from ? `From ${item.from}` : ""}{item.receivedAt ? ` , ${item.receivedAt}` : ""}
                            </div>

                            {item.hint ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{item.hint}</div> : null}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => acceptInboxItemToRoute(item.id)}>
                            Accept, add to route
                          </Button>
                          <Button variant="outline" onClick={() => rejectInboxItem(item.id)}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
                      Inbox is empty.
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        ) : (
          <>
            {isDoneBanner ? (
              <Panel
                title="Work completed"
                right={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={clearRouteDone}>Dismiss</Button>
                    <Button variant="outline" onClick={exportRouteCsv}>Export CSV</Button>
                    <Button variant="secondary" onClick={exportRouteJson}>Export JSON</Button>
                    <Button variant="outline" onClick={startFreshRun}>New run</Button>
                    <Button variant="secondary" onClick={() => setMode("inbox")}>Open inbox</Button>
                  </div>
                }
                className="mb-2"
              >
                <div className="text-sm text-zinc-600 dark:text-zinc-300">Route is complete. Export the run, then start fresh when you are ready.</div>
              </Panel>
            ) : null}

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 xl:col-span-4 grid gap-2">
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

                  {geoState.error || wxState.error ? (
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

                  {active?.specialNotes ? (
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

              <div className="col-span-12 xl:col-span-8 grid gap-2">
                <div className="xl:hidden">
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

                <div className="hidden xl:grid grid-cols-2 gap-2">
                  <Panel title="Map" right={<div className="text-[11px] text-zinc-500">{hasGeo ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "No coords"}</div>}>
                    <StopMap lat={lat} lon={lon} label={geo.label || addrLine} height={260} />
                  </Panel>

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
                </div>

                <div className="xl:hidden">
                  {mobileMode === "map" ? (
                    <Panel title="Map" right={<div className="text-[11px] text-zinc-500">{hasGeo ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "No coords"}</div>}>
                      <StopMap lat={lat} lon={lon} label={geo.label || addrLine} height={320} />
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

                {(mobileMode === "sheet" || !mobileMode) ? (
                  <Panel
                    title="Route sheet"
                    right={
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => rotateSheet(-90)} disabled={!sheetSrc}>
                          Rotate left
                        </Button>
                        <Button variant="outline" onClick={() => rotateSheet(90)} disabled={!sheetSrc}>
                          Rotate right
                        </Button>
                        <Button variant="outline" onClick={resetSheet} disabled={!sheetSrc}>
                          Reset
                        </Button>

                        <Separator className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

                        <Button variant="outline" onClick={() => setSheetOpen(true)} disabled={!sheetSrc}>
                          Expand
                        </Button>
                        <Button variant="outline" onClick={geocodeActiveStop}>
                          Fix geo
                        </Button>
                      </div>
                    }
                    className="xl:block"
                  >
                    {sheetSrc ? (
                      <button
                        type="button"
                        onClick={() => setSheetOpen(true)}
                        className="relative w-full overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        {sheetLoading ? (
                          <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 dark:bg-zinc-950/70">
                            <div className="flex items-center gap-3">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                              <div className="text-sm font-semibold">Loading sheet</div>
                            </div>
                          </div>
                        ) : null}

                        <div
                          className="relative w-full overflow-hidden"
                          style={{
                            aspectRatio: viewportAspect,
                            maxHeight: "70vh",
                          }}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              transform: `rotate(${sheetRot}deg)`,
                              transformOrigin: "center center",
                            }}
                          >
                            <Image
                              key={active?.id || "sheet"}
                              src={sheetSrc}
                              alt={`${site.slangName || "Stop"} route sheet`}
                              fill
                              sizes="100vw"
                              className="object-contain"
                              priority
                              onLoadingComplete={(img) => {
                                if (active?.id && img?.naturalWidth && img?.naturalHeight) {
                                  setSheetDims(prev => ({
                                    ...prev,
                                    [active.id]: { w: img.naturalWidth, h: img.naturalHeight },
                                  }))
                                }
                                setSheetLoading(false)
                              }}
                              onError={() => setSheetLoading(false)}
                            />
                          </div>
                        </div>
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
          </>
        )}
      </div>

      {sortedStops?.length ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 overflow-x-auto">
            {sortedStops.map((s, idx) => {
              const st = statusOf(s)
              const isActive = s.id === activeStopId
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    clearRouteDone()
                    setMode("work")
                    setSheetLoading(true)
                    setSwitchState({ busy: true, targetId: s.id, startTs: Date.now() })
                    selectStop(s.id)
                  }}
                  className={cx("shrink-0 border px-2 py-1 text-xs font-semibold", stopChipClass(st, isActive), "border-zinc-200 dark:border-zinc-800")}
                  title={`${idx + 1} , ${s.site?.slangName || s.id}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

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
