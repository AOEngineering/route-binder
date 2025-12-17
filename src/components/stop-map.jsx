"use client"

import "leaflet/dist/leaflet.css"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import { useEffect, useMemo } from "react"

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function isValidGeo(lat, lon) {
  const la = Number(lat)
  const lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false
  if (Math.abs(la) <= 1 && Math.abs(lo) <= 1) return false
  return true
}

function Recenter({ lat, lon, zoom = 15 }) {
  const map = useMap()

  useEffect(() => {
    if (!isValidGeo(lat, lon)) return
    map.setView([Number(lat), Number(lon)], zoom, { animate: false })
  }, [lat, lon, zoom, map])

  return null
}

export default function StopMap({ lat, lon, label, height = 240 }) {
  const ok = isValidGeo(lat, lon)

  const center = useMemo(() => {
    if (!ok) return [41.4993, -81.6944]
    return [Number(lat), Number(lon)]
  }, [ok, lat, lon])

  if (!ok) {
    return (
      <div className="h-[220px] w-full overflow-hidden border border-zinc-200 bg-white p-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        No coordinates yet, press Locate.
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" style={{ height }}>
      <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <Recenter lat={lat} lon={lon} zoom={15} />
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={center} icon={icon}>
          <Popup>{label || "Stop"}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
