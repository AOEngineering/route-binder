export default function RoutePage({ params }) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="p-4">
        <h1 className="text-xl">Route {params.id}</h1>
      </div>
    </main>
  )
}
