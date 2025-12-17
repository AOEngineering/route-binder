
"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { TruckKeyGate } from "@/components/route-binder/truck-key-gate"

const TRUCK_KEY_STORAGE = "routebinder_truck_key_v1"

function clearRouteBinderStorage() {
  try {
    const prefixes = [
      "routebinder_state_v1_",
      "routebinder_export_v1_",
      "routebinder_last_export_v1_",
    ]

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k === TRUCK_KEY_STORAGE || prefixes.some(p => k.startsWith(p))) {
        localStorage.removeItem(k)
      }
    }
  } catch {}
}


function stateStorageKey(truckId) {
  return `routebinder_state_v1_${truckId || "unknown"}`
}

function exportStorageKey(truckId, doneAtTs) {
  return `routebinder_export_v1_${truckId || "unknown"}_${doneAtTs || "na"}`
}

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

function normalizeStop(stop, idx = 0) {
  const s = stop || {}
  const geo = s.site?.geo || {}

  const routeNumberRaw = s.site?.routeNumber ?? s.routeNumber ?? ""

  return {
    id: String(s.id || `stop_${idx + 1}`),
    order: Number.isFinite(s.order) ? s.order : (idx + 1) * 10,

    meta: {
      injected: Boolean(s.meta?.injected),
      assist: Boolean(s.meta?.assist),
    },

    sheet: {
      imageSrc: s.sheet?.imageSrc || "",
      legend: Array.isArray(s.sheet?.legend) ? s.sheet.legend : [],
    },

    site: {
      routeNumber: String(routeNumberRaw || ""),
      slangName: s.site?.slangName || s.slangName || "",
      address: s.site?.address || s.address || "",
      city: s.site?.city || s.city || "",
      state: s.site?.state || s.state || "OH",
      zip: s.site?.zip || s.zip || "",
      geo: {
        lat: Number.isFinite(geo.lat) ? geo.lat : null,
        lon: Number.isFinite(geo.lon) ? geo.lon : null,
        label: geo.label || "",
        source: geo.source || "",
      },
    },

    schedule: {
      serviceDays: s.schedule?.serviceDays || s.serviceDays || "",
      firstCompletionTime: s.schedule?.firstCompletionTime || s.firstCompletionTime || "",
      timeOpen: s.schedule?.timeOpen || s.timeOpen || "",
      timeClosed: s.schedule?.timeClosed || s.timeClosed || "",
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

function parseWindow(windowStr) {
  const s = String(windowStr || "")
  const mOpen = s.match(/Open\s*([0-9]{1,2}:[0-9]{2})/i)
  const mClose = s.match(/Close\s*([0-9]{1,2}:[0-9]{2})/i)
  return {
    timeOpen: mOpen ? mOpen[1] : "",
    timeClosed: mClose ? mClose[1] : "",
  }
}

function normalizeInboxItem(raw, idx = 0) {
  const r = raw || {}
  const payload = r.payload || {}

  return {
    id: String(r.id || `inbox_${idx + 1}`),
    from: r.from || "",
    receivedAt: r.receivedAt || "",
    title: r.title || "Inbox",
    hint: r.hint || "",
    payload,
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

function renumberOrders(sortedList) {
  return sortedList.map((s, idx) => ({ ...s, order: (idx + 1) * 10 }))
}

function loadStoredState(truckId) {
  try {
    const raw = localStorage.getItem(stateStorageKey(truckId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

function saveStoredState(truckId, next) {
  try {
    localStorage.setItem(stateStorageKey(truckId), JSON.stringify(next))
  } catch {}
}

function allowedRoutesForTruck(truckObj) {
  const id = String(truckObj?.id || "")
  const routes = Array.isArray(truckObj?.routeNumbers) && truckObj.routeNumbers.length ? truckObj.routeNumbers : [id]
  return new Set(routes.map(v => String(v)))
}

function yyyyMmDdFromTs(ts) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

function csvEscape(v) {
  const s = v === null || v === undefined ? "" : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toStopExportRow(s) {
  const geo = s.site?.geo || {}
  const checks = s.checks || {}
  const work = s.work || {}
  const salt = work.salt || {}
  const sidewalk = work.sidewalk || {}
  const plow = work.plow || {}

  return {
    id: s.id,
    order: s.order,
    routeNumber: s.site?.routeNumber || "",
    name: s.site?.slangName || "",
    address: s.site?.address || "",
    city: s.site?.city || "",
    state: s.site?.state || "",
    zip: s.site?.zip || "",
    lat: Number.isFinite(Number(geo.lat)) ? Number(geo.lat) : "",
    lon: Number.isFinite(Number(geo.lon)) ? Number(geo.lon) : "",
    geoLabel: geo.label || "",
    geoSource: geo.source || "",

    timeOpen: s.schedule?.timeOpen || "",
    timeClosed: s.schedule?.timeClosed || "",
    serviceDays: s.schedule?.serviceDays || "",
    firstCompletionTime: s.schedule?.firstCompletionTime || "",

    arrivedAt: s.progress?.arrivedAt || "",
    arrivedAtTs: Number.isFinite(s.progress?.arrivedAtTs) ? s.progress.arrivedAtTs : "",
    completeAt: s.progress?.completeAt || "",
    completeAtTs: Number.isFinite(s.progress?.completeAtTs) ? s.progress.completeAtTs : "",
    durationSec: Number.isFinite(s.progress?.durationSec) ? s.progress.durationSec : 0,

    injected: Boolean(s.meta?.injected),
    assist: Boolean(s.meta?.assist),

    plowTargetInches: Number.isFinite(plow.targetInches) ? plow.targetInches : "",
    plowNotes: plow.notes || "",

    saltProduct: salt.product || "",
    saltAmount: Number.isFinite(salt.amount) ? salt.amount : "",
    saltUnit: salt.unit || "",
    saltPerformedBy: salt.performedBy || "",

    sidewalkProduct: sidewalk.product || "",
    sidewalkAmount: Number.isFinite(sidewalk.amount) ? sidewalk.amount : "",
    sidewalkUnit: sidewalk.unit || "",
    sidewalkPerformedBy: sidewalk.performedBy || "",

    satelliteSalt: work?.satellite?.salt || "",

    plowDone: Boolean(checks.plowDone),
    saltDone: Boolean(checks.saltDone),
    sidewalkDone: Boolean(checks.sidewalkDone),
    satelliteChecked: Boolean(checks.satelliteChecked),
    photoCaptured: Boolean(checks.photoCaptured),

    specialNotes: s.specialNotes || "",
    notes: s.notes || "",
    sheetImageSrc: s.sheet?.imageSrc || "",
  }
}

function makeCsv(rows) {
  if (!rows?.length) return ""
  const cols = Object.keys(rows[0])
  const head = cols.map(csvEscape).join(",")
  const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(",")).join("\n")
  return `${head}\n${body}\n`
}

function downloadTextFile(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {}
}

const RouteBinderContext = createContext(null)

export function RouteBinderProvider({ children }) {
  const [hydrated, setHydrated] = useState(false)

  const [truckKey, setTruckKey] = useState(null)
  const [truck, setTruck] = useState("")
  const [routeName, setRouteName] = useState("")
  const [routeLabel, setRouteLabel] = useState("")

  const [boot, setBoot] = useState({ busy: false, error: "", needsKey: false })

  const [mode, setMode] = useState("work")
  const [queueFilter, setQueueFilter] = useState("all")
  const [tick, setTick] = useState(0)

  const [stops, setStops] = useState([])
  const [activeStopId, setActiveStopId] = useState(null)

  const [inboxItems, setInboxItems] = useState([])
  const [routeDoneAtTs, setRouteDoneAtTs] = useState(null)

  function purgeAllState() {
    setTruck("")
    setRouteName("")
    setRouteLabel("")
    setMode("work")
    setQueueFilter("all")
    setStops([])
    setInboxItems([])
    setActiveStopId(null)
    setRouteDoneAtTs(null)
  }

  async function bootstrapWithKey(k, opts = {}) {
    const silent = Boolean(opts.silent)
    const forceFresh = Boolean(opts.forceFresh)

    setBoot({ busy: true, error: "", needsKey: false })

    setStops([])
    setInboxItems([])
    setActiveStopId(null)
    setRouteDoneAtTs(null)

    try {
      const r = await fetch("/api/hub/bootstrap", {
        headers: { xtruckkey: k },
        cache: "no-store",
      })

      if (!r.ok) {
        const txt = await r.text().catch(() => "")
        throw new Error(txt || "Invalid truck key")
      }

      const j = await r.json()

      const nextTruck = j?.truck || {}
      const nextTruckId = String(nextTruck?.id || "")
      if (!nextTruckId) throw new Error("Missing truck id")

      setTruck(nextTruckId)
      setRouteName(nextTruck?.routeName || `Route ${nextTruckId}`)
      setRouteLabel(nextTruck?.routeLabel || "")

      const allowed = allowedRoutesForTruck(nextTruck)

      const hubStopsRaw = Array.isArray(j?.stops) ? j.stops : []
      const hubInboxRaw = Array.isArray(j?.inboxItems) ? j.inboxItems : []

      const hubStopsNorm = hubStopsRaw.map((s, i) => normalizeStop(s, i)).filter(s => allowed.has(String(s.site.routeNumber || "")))
      const hubInboxNorm = hubInboxRaw.map((it, i) => normalizeInboxItem(it, i))

      const stored = forceFresh ? null : loadStoredState(nextTruckId)

      const storedOk =
        stored &&
        stored.truckId === nextTruckId &&
        stored.boundKey === k &&
        Array.isArray(stored.stops) &&
        stored.stops.length

      if (storedOk) {
        const storedStops = stored.stops
          .map((s, i) => normalizeStop(s, i))
          .filter(s => allowed.has(String(s.site.routeNumber || "")))

        if (storedStops.length) {
          setMode(typeof stored.mode === "string" ? stored.mode : "work")
          setQueueFilter(typeof stored.queueFilter === "string" ? stored.queueFilter : "all")

          setStops(storedStops)
          setInboxItems((stored.inboxItems || []).map((it, i) => normalizeInboxItem(it, i)))

          setActiveStopId(typeof stored.activeStopId === "string" ? stored.activeStopId : null)
          setRouteDoneAtTs(Number.isFinite(stored.routeDoneAtTs) ? stored.routeDoneAtTs : null)
        } else {
          setMode("work")
          setQueueFilter("all")
          setStops(hubStopsNorm)
          setInboxItems(hubInboxNorm)
          setActiveStopId(null)
          setRouteDoneAtTs(null)
        }
      } else {
        setMode("work")
        setQueueFilter("all")
        setStops(hubStopsNorm)
        setInboxItems(hubInboxNorm)
        setActiveStopId(null)
        setRouteDoneAtTs(null)
      }

      setBoot({ busy: false, error: "", needsKey: false })
      return true
    } catch (e) {
      try {
        localStorage.removeItem(TRUCK_KEY_STORAGE)
      } catch {}

      setTruckKey(null)
      purgeAllState()

      setBoot({
        busy: false,
        error: silent ? "" : "Invalid truck key",
        needsKey: true,
      })

      return false
    }
  }

  async function bindTruckKey(k) {
    const key = String(k || "").trim()
    if (!key) return

    try {
      localStorage.setItem(TRUCK_KEY_STORAGE, key)
    } catch {}

    setTruckKey(key)
    await bootstrapWithKey(key, { silent: false })
  }

  function resetTruckKey() {
  clearRouteBinderStorage()
  setTruckKey(null)
  purgeAllState()
  setBoot({ busy: false, error: "", needsKey: true })
}
// PUSH #5

  async function startFreshRun() {
    if (!truck || !truckKey) return
    try {
      localStorage.removeItem(stateStorageKey(truck))
    } catch {}
    await bootstrapWithKey(truckKey, { silent: true, forceFresh: true })
  }

  useEffect(() => {
    let k = null
    try {
      k = localStorage.getItem(TRUCK_KEY_STORAGE)
    } catch {
      k = null
    }

    if (!k) {
      purgeAllState()
      setBoot({ busy: false, error: "", needsKey: true })
      setHydrated(true)
      return
    }

    setTruckKey(k)
    bootstrapWithKey(k, { silent: true }).finally(() => setHydrated(true))
  }, [])

  const sortedStops = useMemo(() => stops.slice().sort((a, b) => a.order - b.order), [stops])

  useEffect(() => {
    if (!sortedStops.length) return
    setActiveStopId(prev => {
      if (prev && sortedStops.some(s => s.id === prev)) return prev
      return sortedStops[0].id
    })
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

  const pendingInboxCount = useMemo(() => inboxItems.length, [inboxItems])

  useEffect(() => {
    if (!hydrated) return
    if (!truck) return

    saveStoredState(truck, {
      version: 1,
      savedAtTs: Date.now(),

      truckId: truck,
      boundKey: truckKey,

      mode,
      queueFilter,
      activeStopId,
      routeDoneAtTs,
      stops,
      inboxItems,
    })
  }, [hydrated, truck, truckKey, mode, queueFilter, activeStopId, routeDoneAtTs, stops, inboxItems])

  function clearRouteDone() {
    setRouteDoneAtTs(null)
  }

  function selectStop(id) {
    setActiveStopId(id)
    setMode("work")
    clearRouteDone()
  }

  function updateStop(id, patch) {
    setStops(prev =>
      prev.map((s, idx) => {
        if (s.id !== id) return s
        const merged = { ...s, ...patch }
        const next = normalizeStop(merged, idx)

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
          next.site.geo = { ...s.site.geo, ...next.site.geo, ...geoPatch }
          next.site.geo.lat = Number.isFinite(next.site.geo.lat) ? next.site.geo.lat : null
          next.site.geo.lon = Number.isFinite(next.site.geo.lon) ? next.site.geo.lon : null
        }

        return normalizeStop(next, idx)
      })
    )
  }

  function markArrived(id) {
    setStops(prev =>
      prev.map(s => {
        if (s.id !== id) return s
        if (s.progress.arrivedAtTs) return s
        return { ...s, progress: { ...s.progress, arrivedAt: nowTime(), arrivedAtTs: Date.now() } }
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
        return { ...s, progress: { ...s.progress, completeAt: nowTime(), completeAtTs: end, durationSec: dur } }
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

    if (nextStop) {
      setActiveStopId(nextStop.id)
      clearRouteDone()
      return
    }

    setRouteDoneAtTs(Date.now())
  }

  async function geocodeActiveStop() {
    if (!activeStop) return
    const addr = [activeStop.site.address, activeStop.site.city, activeStop.site.state, activeStop.site.zip]
      .filter(Boolean)
      .join(", ")
    if (!addr) return

    const r = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}`)
    const j = await r.json()
    if (!j?.ok) return

    updateStop(activeStop.id, {
      site: { geo: { lat: Number(j.lat), lon: Number(j.lon), label: j.label || addr, source: "nominatim" } },
    })
  }

  const queueStops = useMemo(() => {
    if (queueFilter === "pending") return sortedStops.filter(s => !s?.progress?.completeAtTs)
    if (queueFilter === "complete") return sortedStops.filter(s => Boolean(s?.progress?.completeAtTs))
    return sortedStops
  }, [sortedStops, queueFilter])

  function rejectInboxItem(inboxId) {
    setInboxItems(prev => prev.filter(it => it.id !== inboxId))
  }

function acceptInboxItemToRoute(inboxId) {
  const item = inboxItems.find(i => i.id === inboxId)
  if (!item) return

  const p = item.payload || {}

  const w = parseWindow(p.window || "")
  const timeOpen = p.timeOpen || p.schedule?.timeOpen || w.timeOpen
  const timeClosed = p.timeClosed || p.schedule?.timeClosed || w.timeClosed

  const serviceDays = p.serviceDays || p.schedule?.serviceDays || ""
  const firstCompletionTime = p.firstCompletionTime || p.schedule?.firstCompletionTime || ""

  const routeNumber =
    p.routeNumber ||
    p.site?.routeNumber ||
    String(truck || "")

  const slangName =
    p.slangName ||
    p.site?.slangName ||
    p.name ||
    item.title ||
    "Injected stop"

  const address = p.address || p.site?.address || ""
  const city = p.city || p.site?.city || ""
  const state = p.state || p.site?.state || "OH"
  const zip = p.zip || p.site?.zip || ""

  const sheetImageSrc = p.sheetImageSrc || p.sheet?.imageSrc || ""
  const sheetLegend = Array.isArray(p.sheet?.legend) ? p.sheet.legend : []

  const plowTargetInches = Number.isFinite(Number(p.work?.plow?.targetInches)) ? Number(p.work.plow.targetInches) : null
  const plowNotes = p.work?.plow?.notes || ""

  const saltProduct = p.work?.salt?.product || p.saltSpec || ""
  const saltAmount = Number.isFinite(Number(p.work?.salt?.amount)) ? Number(p.work.salt.amount) : null
  const saltUnit = p.work?.salt?.unit || "scoops"
  const saltPerformedBy = p.work?.salt?.performedBy || "you"

  const sidewalkProduct = p.work?.sidewalk?.product || p.shovelSpec || ""
  const sidewalkAmount = Number.isFinite(Number(p.work?.sidewalk?.amount)) ? Number(p.work.sidewalk.amount) : null
  const sidewalkUnit = p.work?.sidewalk?.unit || "bags"
  const sidewalkPerformedBy = p.work?.sidewalk?.performedBy || "you"

  const satelliteSalt = p.work?.satellite?.salt || ""

  const newStopId = `stop_injected_${Date.now()}_${Math.floor(Math.random() * 10000)}`

  const newStop = normalizeStop(
    {
      id: newStopId,
      order: 9999,
      meta: { injected: true, assist: Boolean(p.assist) },

      sheet: { imageSrc: sheetImageSrc, legend: sheetLegend },

      site: {
        routeNumber: String(routeNumber || ""),
        slangName,
        address,
        city,
        state,
        zip,
        geo: { lat: null, lon: null, label: "", source: "" },
      },

      schedule: {
        serviceDays,
        firstCompletionTime,
        timeOpen,
        timeClosed,
      },

      work: {
        plow: { targetInches: plowTargetInches, notes: plowNotes },
        salt: { product: saltProduct, amount: saltAmount, unit: saltUnit, performedBy: saltPerformedBy },
        sidewalk: { product: sidewalkProduct, amount: sidewalkAmount, unit: sidewalkUnit, performedBy: sidewalkPerformedBy },
        satellite: { salt: satelliteSalt },
      },

      specialNotes: p.specialNotes || "",
    },
    999
  )

  setStops(prev => {
    const list = prev.slice().sort((a, b) => a.order - b.order)
    const idx = list.findIndex(s => s.id === activeStopId)
    const insertAt = idx >= 0 ? idx + 1 : list.length
    list.splice(insertAt, 0, newStop)
    return renumberOrders(list)
  })

  setInboxItems(prev => prev.filter(it => it.id !== inboxId))
  clearRouteDone()
}


  const routeSummary = useMemo(() => {
    if (!sortedStops.length) return null

    const completedStops = sortedStops.filter(s => Boolean(s?.progress?.completeAtTs))
    const arrivedStops = sortedStops.filter(s => Boolean(s?.progress?.arrivedAtTs))

    const firstArriveTs = arrivedStops.length
      ? Math.min(...arrivedStops.map(s => Number(s.progress.arrivedAtTs)).filter(Number.isFinite))
      : null

    const lastCompleteTs = completedStops.length
      ? Math.max(...completedStops.map(s => Number(s.progress.completeAtTs)).filter(Number.isFinite))
      : null

    const endTs = Number.isFinite(routeDoneAtTs) ? routeDoneAtTs : lastCompleteTs
    const startTs = firstArriveTs

    const onSiteSec = completedStops.reduce((acc, s) => acc + (Number(s.progress.durationSec) || 0), 0)

    const routeSpanSec =
      Number.isFinite(startTs) && Number.isFinite(endTs) && endTs >= startTs
        ? Math.floor((endTs - startTs) / 1000)
        : 0

    const injectedCount = sortedStops.filter(s => Boolean(s?.meta?.injected)).length
    const assistCount = sortedStops.filter(s => Boolean(s?.meta?.assist)).length

    const saltStops = sortedStops.filter(s => requiresSalt(s)).length
    const sidewalkStops = sortedStops.filter(s => requiresSidewalk(s)).length

    const saltTotal = sortedStops.reduce((acc, s) => {
      const n = s?.work?.salt?.amount
      if (!Number.isFinite(n)) return acc
      return acc + n
    }, 0)

    const sidewalkTotal = sortedStops.reduce((acc, s) => {
      const n = s?.work?.sidewalk?.amount
      if (!Number.isFinite(n)) return acc
      return acc + n
    }, 0)

    const allComplete = sortedStops.length > 0 && sortedStops.every(s => Boolean(s?.progress?.completeAtTs))

    return {
      truck,
      routeName,
      routeLabel,

      allComplete,
      totalStops: sortedStops.length,
      completedStops: completedStops.length,

      startedAtTs: Number.isFinite(startTs) ? startTs : null,
      endedAtTs: Number.isFinite(endTs) ? endTs : null,

      routeSpanSec,
      onSiteSec,

      injectedCount,
      assistCount,

      saltStops,
      sidewalkStops,
      saltTotal,
      sidewalkTotal,

      inboxRemaining: inboxItems.length,
    }
  }, [sortedStops, routeDoneAtTs, truck, routeName, routeLabel, inboxItems.length])

  function buildRouteExportPayload() {
    const now = Date.now()
    const summary = routeSummary
    const rows = sortedStops.map(toStopExportRow)

    const startedAtTs = summary?.startedAtTs ?? null
    const endedAtTs = summary?.endedAtTs ?? null

    return {
      version: 1,
      exportedAtTs: now,

      truckId: truck,
      routeName,
      routeLabel,

      routeDoneAtTs: Number.isFinite(routeDoneAtTs) ? routeDoneAtTs : null,
      startedAtTs,
      endedAtTs,

      summary: summary || null,

      inboxRemaining: inboxItems.map(it => ({
        id: it.id,
        from: it.from,
        receivedAt: it.receivedAt,
        title: it.title,
        hint: it.hint,
        payload: it.payload || {},
      })),

      stops: rows,
    }
  }

  function saveExportSnapshot(payload) {
    const doneTs = Number.isFinite(routeDoneAtTs) ? routeDoneAtTs : Date.now()
    try {
      localStorage.setItem(exportStorageKey(truck, doneTs), JSON.stringify(payload))
      localStorage.setItem(`routebinder_last_export_v1_${truck}`, JSON.stringify({ doneTs }))
    } catch {}
  }

  function exportRouteJson() {
    if (!truck) return
    const payload = buildRouteExportPayload()
    saveExportSnapshot(payload)

    const tsForName =
      payload.startedAtTs || payload.endedAtTs || payload.routeDoneAtTs || payload.exportedAtTs || Date.now()

    const datePart = yyyyMmDdFromTs(tsForName)
    const namePart = payload.routeName ? String(payload.routeName).replace(/\s+/g, "_") : `route_${truck}`
    const filename = `${namePart}_${truck}_${datePart}.json`

    downloadTextFile(filename, JSON.stringify(payload, null, 2), "application/json")
  }

  function exportRouteCsv() {
    if (!truck) return
    const payload = buildRouteExportPayload()
    saveExportSnapshot(payload)

    const rows = Array.isArray(payload.stops) ? payload.stops : []
    const csv = makeCsv(rows)

    const tsForName =
      payload.startedAtTs || payload.endedAtTs || payload.routeDoneAtTs || payload.exportedAtTs || Date.now()

    const datePart = yyyyMmDdFromTs(tsForName)
    const namePart = payload.routeName ? String(payload.routeName).replace(/\s+/g, "_") : `route_${truck}`
    const filename = `${namePart}_${truck}_${datePart}.csv`

    downloadTextFile(filename, csv, "text/csv")
  }

  const value = {
    truck,
    routeName,
    routeLabel,
    truckKey,

    bindTruckKey,
    resetTruckKey,

    startFreshRun,

    mode,
    setMode,

    queueFilter,
    setQueueFilter,

    stops,
    setStops,

    inboxItems,
    setInboxItems,
    pendingInboxCount,

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

    acceptInboxItemToRoute,
    rejectInboxItem,

    routeDoneAtTs,
    clearRouteDone,

    routeSummary,
    exportRouteJson,
    exportRouteCsv,
  }

  if (!hydrated || boot.needsKey || !truck) {
    return (
      <TruckKeyGate
        busy={boot.busy}
        error={boot.error}
        onSubmit={bindTruckKey}
        onReset={resetTruckKey}
      />
    )
  }

  return <RouteBinderContext.Provider value={value}>{children}</RouteBinderContext.Provider>
}

export function useRouteBinder() {
  const ctx = useContext(RouteBinderContext)
  if (!ctx) throw new Error("useRouteBinder must be used inside RouteBinderProvider")
  return ctx
}
