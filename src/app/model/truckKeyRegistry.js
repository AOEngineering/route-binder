export const truckKeyRegistry = {
  // Truck 948
  RB9488F2K9D7QM3LX: {
    id: "948",
    routeName: "Route 948",
    routeLabel: "West Side Commercial",
    routeNumbers: ["948"],
  },

  // Truck 900
  RB900ZK4P1H8N6R2T: {
    id: "900",
    routeName: "Route 900",
    routeLabel: "South Run",
    routeNumbers: ["900"],
  },
}

export function normalizeTruckKey(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export function resolveTruckByKey(key) {
  const k = normalizeTruckKey(key)
  return truckKeyRegistry[k] || null
}
