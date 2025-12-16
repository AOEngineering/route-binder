"use client"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { RouteBinderProvider } from "../components/route-binder/route-binder-context"
import { AppSidebar } from "../components/app-sidebar"
export default function Providers({ defaultOpen, children }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <RouteBinderProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <SidebarTrigger />
              <div className="text-sm text-slate-600">Route Binder</div>
            </div>
            {children}
          </div>
        </SidebarInset>
      </RouteBinderProvider>
    </SidebarProvider>
  )
}
