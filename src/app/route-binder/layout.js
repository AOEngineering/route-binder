import { RouteBinderProvider } from "@/components/route-binder/route-binder-context"

export default function RouteBinderLayout({ children }) {
  return <RouteBinderProvider>{children}</RouteBinderProvider>
}
