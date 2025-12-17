import { makeStopFromSheet } from "./routeSheetModels"
import { sheetIndex } from "./sheetIndex"
// deploy test
export const seedStops = [
  makeStopFromSheet({
    id: "stop-1",
    order: 1,
    sheetImageSrc: sheetIndex["stop-1"],

    routeNumber: 900,
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
    specialNotes: "1 inch plow, Co pilot"
  })
]
// demo