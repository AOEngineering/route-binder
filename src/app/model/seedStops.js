import { makeStopFromSheet } from "./routeSheetModels"
import { sheetIndex } from "./sheetIndex"

export const seedStops = [
  // Route 900
  makeStopFromSheet({
    id: "stop-900-1",
    order: 10,
    sheetImageSrc: sheetIndex["stop-1"],
    routeNumber: "900",

    slangName: "Beckett Gas",
    address: "21819 Royalton Rd",
    city: "Strongsville",
    state: "OH",
    zip: "44149",

    serviceDays: "Mon Fri",
    firstCompletionTime: "4:00 AM",
    timeOpen: "5:00 AM",
    timeClosed: "5:00 PM",

    saltProduct: "ECO2",
    saltScoops: 1.15,

    sidewalkProduct: "Reliable Blue",
    sidewalkBags: 0.8,

    satelliteSalt: "None",
    specialNotes: "1 inch plow, Co pilot",
  }),

  // Route 948
  makeStopFromSheet({
    id: "stop-948-1",
    order: 10,
    sheetImageSrc: sheetIndex["stop-948-1"],
    routeNumber: "948",

    slangName: "Beckett Gas",
    address: "1700 Center Ridge Rd",
    city: "Westlake",
    state: "OH",
    zip: "44145",

    serviceDays: "Mon Fri",
    firstCompletionTime: "4:00 AM",
    timeOpen: "5:00 AM",
    timeClosed: "5:00 PM",

    saltProduct: "ECO2",
    saltScoops: 1.0,

    sidewalkProduct: "Reliable Blue",
    sidewalkBags: 1.0,

    satelliteSalt: "None",
    specialNotes: "",
  }),
]
