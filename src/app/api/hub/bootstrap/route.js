import { NextResponse } from "next/server"
import { resolveTruckByKey } from "@/app/model/truckKeyRegistry"
import { seedStops } from "@/app/model/seedStops"
import { seedInboxItems } from "@/app/model/seedInbox"

export async function GET(req) {
  const key = (req.headers.get("xtruckkey") || "").trim()
  const truck = resolveTruckByKey(key)

  if (!truck) {
    return NextResponse.json(
      { ok: false, error: "Key not accepted" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      truck,
      stops: seedStops,
      inboxItems: seedInboxItems,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  )
}
