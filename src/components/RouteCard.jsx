import Link from "next/link"

export default function RouteCard({
  id,
  name,
  truck,
  totalStops,
  completedStops,
  injectedCount
}) {
  const progress = Math.round((completedStops / totalStops) * 100)

  return (
    <Link href={`/route/${id}`}>
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 shadow-lg active:scale-[0.99] transition">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {name}
            </h2>
            <p className="text-sm text-slate-400">
              Truck {truck}
            </p>
          </div>

          {injectedCount > 0 && (
            <span className="text-xs bg-orange-500 text-black font-semibold px-3 py-1 rounded-full">
              {injectedCount} injected
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm text-slate-300 mb-1">
            <span>
              {completedStops} of {totalStops} complete
            </span>
            <span>{progress}%</span>
          </div>

          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
