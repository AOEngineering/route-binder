"use client"
// Test date
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { seedStops } from "@/app/model/seedStops"
import { seedInboxItems } from "@/app/model/seedInbox"

function nowTime() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function safePercent(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalizeStop(stop) {
  const s = stop || {}
  const geo = s.site?.geo || {}

  return {
    id: String(s.id || `stop_${Date.now()}`),
    order: Number.isFinite(s.order) ? s.order : 9999,

    meta: {
      injected: Boolean(s.meta?.injected),
      assist: Boolean(s.meta?.assist),
    },

    sheet: {
      imageSrc: s.sheet?.imageSrc || "",
      legend: Array.isArray(s.sheet?.legend) ? s.sheet.legend : [],
    },

    site: {
      routeNumber: String(s.site?.routeNumber || ""),
      slangName: s.site?.slangName || "",
      address: s.site?.address || "",
      city: s.site?.city || "",
      state: s.site?.state || "OH",
      zip: s.site?.zip || "",
      geo: {
        lat: Number.isFinite(geo.lat) ? geo.lat : null,
        lon: Number.isFinite(geo.lon) ? geo.lon : null,
        label: geo.label || "",
        source: geo.source || "",
      },
    },

    schedule: {
      serviceDays: s.schedule?.serviceDays || "",
      firstCompletionTime: s.schedule?.firstCompletionTime || "",
      timeOpen: s.schedule?.timeOpen || "",
      timeClosed: s.schedule?.timeClosed || "",
    },

    work: {
      plow: {
        targetInches: Number.isFinite(s.work?.plow?.targetInches) ? s.work.plow.targetInches : null,
        notes: s.work?.plow?.notes || "",
      },
      salt: {
        product: s.work?.salt?.product || "",
        amount: Number.isFinite(s.work?.salt?.amount) ? s.work.salt.amount : null,
        unit: s.work?.salt?.unit || "scoops",
        performedBy: s.work?.salt?.performedBy || "you",
      },
      sidewalk: {
        product: s.work?.sidewalk?.product || "",
        amount: Number.isFinite(s.work?.sidewalk?.amount) ? s.work.sidewalk.amount : null,
        unit: s.work?.sidewalk?.unit || "bags",
        performedBy: s.work?.sidewalk?.performedBy || "you",
      },
      satellite: { salt: s.work?.satellite?.salt || "" },
    },

    specialNotes: s.specialNotes || "",

    progress: {
      arrivedAt: s.progress?.arrivedAt || null,
      arrivedAtTs: Number.isFinite(s.progress?.arrivedAtTs) ? s.progress.arrivedAtTs : null,
      completeAt: s.progress?.completeAt || null,
      completeAtTs: Number.isFinite(s.progress?.completeAtTs) ? s.progress.completeAtTs : null,
      durationSec: Number.isFinite(s.progress?.durationSec) ? s.progress.durationSec : 0,
    },

    checks: {
      plowDone: Boolean(s.checks?.plowDone),
      saltDone: Boolean(s.checks?.saltDone),
      sidewalkDone: Boolean(s.checks?.sidewalkDone),
      satelliteChecked: Boolean(s.checks?.satelliteChecked),
      photoCaptured: Boolean(s.checks?.photoCaptured),
    },

    notes: s.notes || "",
  }
}

function requiresSalt(stop) {
  const n = stop?.work?.salt?.amount
  if (!Number.isFinite(n)) return false
  return n > 0
}

function requiresSidewalk(stop) {
  const n = stop?.work?.sidewalk?.amount
  if (!Number.isFinite(n)) return false
  return n > 0
}

const RouteBinderContext = createContext(null)

export function RouteBinderProvider({ children }) {
  const [truck] = useState("948")
  const [routeName] = useState("Route 948")
  const [routeLabel] = useState("West Side Commercial")

  const [mode, setMode] = useState("work")
  const [queueFilter, setQueueFilter] = useState("all")
  const [tick, setTick] = useState(0)

  const [stops, setStops] = useState(() => seedStops.map(normalizeStop))
  const [activeStopId, setActiveStopId] = useState(null)

  const [inboxItems, setInboxItems] = useState(() => seedInboxItems)

  const sortedStops = useMemo(() => stops.slice().sort((a, b) => a.order - b.order), [stops])

  useEffect(() => {
    if (!sortedStops.length) return
    setActiveStopId(prev => prev ?? sortedStops[0].id)
  }, [sortedStops])

  const activeStop = useMemo(() => {
    return sortedStops.find(s => s.id === activeStopId) || sortedStops[0] || null
  }, [sortedStops, activeStopId])

  const activeIndex = useMemo(() => sortedStops.findIndex(s => s.id === activeStopId), [sortedStops, activeStopId])
  const nextStop = useMemo(() => sortedStops[activeIndex + 1] || null, [sortedStops, activeIndex])
  const prevStop = useMemo(() => sortedStops[activeIndex - 1] || null, [sortedStops, activeIndex])

  const stats = useMemo(() => {
    const total = sortedStops.length
    const complete = sortedStops.filter(s => Boolean(s?.progress?.completeAtTs)).length
    const pending = total - complete
    return { total, complete, pending }
  }, [sortedStops])

  const progress = safePercent((stats.complete / Math.max(1, stats.total)) * 100)

  const activeElapsed = useMemo(() => {
    if (!activeStop?.progress?.arrivedAtTs) return 0
    if (activeStop?.progress?.completeAtTs) return activeStop?.progress?.durationSec || 0
    return Math.floor((Date.now() - activeStop.progress.arrivedAtTs) / 1000)
  }, [activeStop, tick])

  useEffect(() => {
    if (!activeStop?.progress?.arrivedAtTs) return
    if (activeStop?.progress?.completeAtTs) return
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [activeStop?.progress?.arrivedAtTs, activeStop?.progress?.completeAtTs])

  function selectStop(id) {
    setActiveStopId(id)
    setMode("work")
  }

  function updateStop(id, patch) {
    setStops(prev =>
      prev.map(s => {
        if (s.id !== id) return s
        const merged = { ...s, ...patch }

        const next = normalizeStop(merged)

        next.meta = { ...s.meta, ...(patch.meta || {}) }
        next.sheet = { ...s.sheet, ...(patch.sheet || {}) }
        next.site = { ...s.site, ...(patch.site || {}) }
        next.schedule = { ...s.schedule, ...(patch.schedule || {}) }

        next.work = {
          ...s.work,
          ...(patch.work || {}),
          plow: { ...s.work.plow, ...(patch.work?.plow || {}) },
          salt: { ...s.work.salt, ...(patch.work?.salt || {}) },
          sidewalk: { ...s.work.sidewalk, ...(patch.work?.sidewalk || {}) },
          satellite: { ...s.work.satellite, ...(patch.work?.satellite || {}) },
        }

        next.progress = { ...s.progress, ...(patch.progress || {}) }
        next.checks = { ...s.checks, ...(patch.checks || {}) }

        const geoPatch = patch.site?.geo
        if (geoPatch) {
          next.site.geo = {
            ...s.site.geo,
            ...next.site.geo,
            ...geoPatch,
          }
          next.site.geo.lat = Number.isFinite(next.site.geo.lat) ? next.site.geo.lat : null
          next.site.geo.lon = Number.isFinite(next.site.geo.lon) ? next.site.geo.lon : null
        }

        return normalizeStop(next)
      })
    )
  }

  function markArrived(id) {
    setStops(prev =>
      prev.map(s => {
        if (s.id !== id) return s
        if (s.progress.arrivedAtTs) return s
        return {
          ...s,
          progress: { ...s.progress, arrivedAt: nowTime(), arrivedAtTs: Date.now() },
        }
      })
    )
  }

  function canComplete(stop) {
    if (!stop?.progress?.arrivedAtTs) return false
    if (stop?.progress?.completeAtTs) return false

    const checks = stop.checks || {}
    if (!checks.plowDone) return false
    if (requiresSalt(stop) && !checks.saltDone) return false
    if (requiresSidewalk(stop) && !checks.sidewalkDone) return false

    return true
  }

  function markComplete(id) {
    setStops(prev =>
      prev.map(s => {
        if (s.id !== id) return s
        if (!canComplete(s)) return s

        const end = Date.now()
        const dur = Math.floor((end - s.progress.arrivedAtTs) / 1000)
        return {
          ...s,
          progress: { ...s.progress, completeAt: nowTime(), completeAtTs: end, durationSec: dur },
        }
      })
    )
  }

  function undoComplete(id) {
    setStops(prev =>
      prev.map(s => {
        if (s.id !== id) return s
        return { ...s, progress: { ...s.progress, completeAt: null, completeAtTs: null, durationSec: 0 } }
      })
    )
  }

  function goPrev() {
    if (prevStop) setActiveStopId(prevStop.id)
  }

  function goNextLocked() {
    if (!activeStop?.progress?.completeAtTs) return
    if (nextStop) setActiveStopId(nextStop.id)
  }

  async function geocodeActiveStop() {
    if (!activeStop) return
    const addr = [activeStop.site.address, activeStop.site.city, activeStop.site.state, activeStop.site.zip].filter(Boolean).join(", ")
    if (!addr) return

    const r = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}`)
    const j = await r.json()
    if (!j?.ok) return

    updateStop(activeStop.id, {
      site: {
        geo: {
          lat: Number(j.lat),
          lon: Number(j.lon),
          label: j.label || addr,
          source: "nominatim",
        },
      },
    })
  }

  const queueStops = useMemo(() => {
    if (queueFilter === "pending") return sortedStops.filter(s => !s?.progress?.completeAtTs)
    if (queueFilter === "complete") return sortedStops.filter(s => Boolean(s?.progress?.completeAtTs))
    return sortedStops
  }, [sortedStops, queueFilter])

  const value = {
    truck,
    routeName,
    routeLabel,

    mode,
    setMode,

    queueFilter,
    setQueueFilter,

    stops,
    setStops,

    inboxItems,
    setInboxItems,

    sortedStops,
    queueStops,

    activeStopId,
    setActiveStopId,

    activeStop,
    nextStop,
    prevStop,

    stats,
    progress,
    activeElapsed,

    selectStop,
    updateStop,

    markArrived,
    canComplete,
    markComplete,
    undoComplete,

    goPrev,
    goNextLocked,

    geocodeActiveStop,
  }

  return <RouteBinderContext.Provider value={value}>{children}</RouteBinderContext.Provider>
}

export function useRouteBinder() {
  const ctx = useContext(RouteBinderContext)
  if (!ctx) throw new Error("useRouteBinder must be used inside RouteBinderProvider")
  return ctx
}
