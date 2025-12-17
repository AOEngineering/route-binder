import { NextResponse } from "next/server"
import { resolveTruckByKey } from "@/app/model/truckKeyRegistry"
import { seedStops } from "@/app/model/seedStops"
import { seedInboxItems } from "@/app/model/seedInbox"

export async function GET(req) {
  const key = req.headers.get("xtruckkey") || ""
  const truck = resolveTruckByKey(key)

  if (!truck) {
    return new NextResponse("Key not accepted", { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    truck,
    stops: seedStops,
    inboxItems: seedInboxItems,
  })
}
