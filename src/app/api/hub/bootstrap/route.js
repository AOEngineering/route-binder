import { NextResponse } from "next/server"
import { resolveTruckByKey } from "@/app/model/truckKeyRegistry"
import { seedStops } from "@/app/model/seedStops"
import { seedInboxItems } from "@/app/model/seedInbox"

function stopRouteNumber(rawStop) {
  const r =
    rawStop?.site?.routeNumber ??
    rawStop?.routeNumber ??
    rawStop?.site?.route_number ??
    ""
  return String(r || "")
}

function allowedRoutesForTruck(truck) {
  const truckId = String(truck?.id || "")
  const list =
    Array.isArray(truck?.routeNumbers) && truck.routeNumbers.length
      ? truck.routeNumbers
      : [truckId]
  return new Set(list.map(v => String(v)))
}

function inboxBelongsToTruck(item, truck) {
  if (!item) return false

  const truckId = String(truck?.id || "")
  const allowed = allowedRoutesForTruck(truck)

  const directTruck = item.truckId ? String(item.truckId) : ""
  if (directTruck) return directTruck === truckId

  const payloadRoute = item.payload?.routeNumber ?? item.routeNumber ?? ""
  const pr = String(payloadRoute || "")
  if (pr) return allowed.has(pr)

  // if inbox item has no routing info, default to visible
  return true
}

export async function GET(req) {
  const key = req.headers.get("xtruckkey") || ""
  const truck = resolveTruckByKey(key)

  if (!truck) {
    return new NextResponse("Key not accepted", { status: 401 })
  }

  const allowed = allowedRoutesForTruck(truck)

  const stopsForTruck = (seedStops || []).filter(s => allowed.has(stopRouteNumber(s)))

  const inboxForTruck = (seedInboxItems || []).filter(it => inboxBelongsToTruck(it, truck))

  return NextResponse.json(
    {
      ok: true,
      truck,
      stops: stopsForTruck,
      inboxItems: inboxForTruck,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  )
}
