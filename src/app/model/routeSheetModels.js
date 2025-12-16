// models/routeSheetModels.js

export function makeStopFromSheet({
  id,
  order,
  sheetImageSrc,
  routeNumber,
  slangName,
  address,
  city,
  state,
  zip,
  serviceDays,
  firstCompletionTime,
  timeOpen,
  timeClosed,
  saltProduct,
  saltScoops,
  sidewalkProduct,
  sidewalkBags,
  satelliteSalt,
  specialNotes
}) {
  return {
    id,
    order,

    sheet: {
      imageSrc: sheetImageSrc || "",
      legend: [
        { key: "noSnow", label: "No snow", note: "Red fill" },
        { key: "snow", label: "Snow", note: "Green fill" },
        { key: "plowHazard", label: "Plow hazard", note: "Yellow fill" },
        { key: "notDone", label: "Not done", note: "X mark" },
        { key: "handicap", label: "Handicap", note: "Blue icon" },
        { key: "vip", label: "VIP", note: "Orange icon" },
        { key: "dumpster", label: "Dumpster", note: "Dumpster icon" }
      ]
    },

    site: {
      routeNumber: String(routeNumber || ""),
      slangName: slangName || "",
      address: address || "",
      city: city || "",
      state: state || "OH",
      zip: zip || ""
    },

    schedule: {
      serviceDays: serviceDays || "",
      firstCompletionTime: firstCompletionTime || "",
      timeOpen: timeOpen || "",
      timeClosed: timeClosed || ""
    },

    work: {
      plow: {
        targetInches: null,
        notes: ""
      },
      salt: {
        product: saltProduct || "",
        amount: typeof saltScoops === "number" ? saltScoops : null,
        unit: "scoops",
        performedBy: "you"
      },
      sidewalk: {
        product: sidewalkProduct || "",
        amount: typeof sidewalkBags === "number" ? sidewalkBags : null,
        unit: "bags",
        performedBy: "you"
      },
      satellite: {
        salt: satelliteSalt || ""
      }
    },

    specialNotes: specialNotes || "",

    progress: {
      arrivedAtTs: null,
      completeAtTs: null,
      durationSec: 0
    },

    checks: {
      plowDone: false,
      saltDone: false,
      sidewalkDone: false,
      satelliteChecked: false,
      photoCaptured: false
    },

    notes: ""
  }
}
