import { makeStopFromSheet } from "./routeSheetModels"
import { sheetIndex } from "./sheetIndex"

export const seedStops = [
  // Route 948

  // 1, XPO
  makeStopFromSheet({
    id: "stop-948-1",
    order: 10,
    sheetImageSrc: sheetIndex["stop-948-1"],
    routeNumber: "948",

    slangName: "XPO Logistics, Parma",
    address: "12901 Snow Rd",
    city: "Parma",
    state: "OH",
    zip: "44130",

    serviceDays: "Mon Fri, Saturday, Sunday",
    firstCompletionTime: "3:00 AM",
    timeOpen: "4:00 AM",
    timeClosed: "10:00 PM",

    saltProduct: "ECO2",
    saltScoops: 6,

    sidewalkProduct: "Reliable Blue",
    sidewalkBags: 1,

    satelliteSalt: "2 Bags",
    specialNotes: "Do not forget the city sidewalks, 1 inch plow, sidewalks, strategic push, Sunday time closed 11:00 AM",
  }),

  // 2, Dalad
  makeStopFromSheet({
    id: "stop-948-2",
    order: 20,
    sheetImageSrc: sheetIndex["stop-948-2"],
    routeNumber: "948",

    slangName: "Dalad, Clemens",
    address: "29055 Clemens Rd",
    city: "Westlake",
    state: "OH",
    zip: "44145",

    serviceDays: "Mon Fri",
    firstCompletionTime: "6:30 AM",
    timeOpen: "7:00 AM",
    timeClosed: "6:00 PM",

    saltProduct: "ECO2",
    saltScoops: 0.35,

    sidewalkProduct: "Reliable Blue",
    sidewalkBags: 3,

    satelliteSalt: "None",
    specialNotes: "2 inch plow, Co pilot",
  }),

  // 3, United Consumer Financial
  makeStopFromSheet({
    id: "stop-948-3",
    order: 30,
    sheetImageSrc: sheetIndex["stop-948-3"],
    routeNumber: "948",

    slangName: "United Consumer Financial",
    address: "865 Bassett Rd",
    city: "Westlake",
    state: "OH",
    zip: "44145",

    serviceDays: "Mon Fri, Saturday, Sunday",
    firstCompletionTime: "6:30 AM",
    timeOpen: "7:00 AM",
    timeClosed: "12:00 AM",

    saltProduct: "ECO2",
    saltScoops: 0.6,

    sidewalkProduct: "Reliable Blue",
    sidewalkBags: 0.4,

    satelliteSalt: "None",
    specialNotes: "No public walks",
  }),

  // 4, Bay Village Square
  makeStopFromSheet({
    id: "stop-948-4",
    order: 40,
    sheetImageSrc: sheetIndex["stop-948-4"],
    routeNumber: "948",

    slangName: "Bay Village Square",
    address: "27211, 27323 Wolf Rd",
    city: "Bay Village",
    state: "OH",
    zip: "44120",

    serviceDays: "Mon Fri, Saturday, Sunday",
    firstCompletionTime: "7:00 AM",
    timeOpen: "7:00 AM",
    timeClosed: "9:00 PM",

    saltProduct: "ECO2",
    saltScoops: 0.9,

    sidewalkProduct: "Reliable Blue",
    sidewalkBags: 0.5,

    satelliteSalt: "2 Bags",
    specialNotes: "2 inch plow, Co pilot, Only do the sidewalks that are marked in blue and yellow",
  }),

  // 5, Elevate Foot and Ankle
  makeStopFromSheet({
    id: "stop-948-5",
    order: 50,
    sheetImageSrc: sheetIndex["stop-948-5"],
    routeNumber: "948",

    slangName: "Elevate Foot and Ankle",
    address: "2880 Plymouth Ave",
    city: "Rocky River",
    state: "OH",
    zip: "44116",

    serviceDays: "Mon Fri",
    firstCompletionTime: "7:00 AM",
    timeOpen: "8:00 AM",
    timeClosed: "5:00 PM",

    saltProduct: "ECO2",
    saltScoops: 0.2,

    sidewalkProduct: "Reliable Blue",
    sidewalkBags: 0,

    satelliteSalt: "None",
    specialNotes: "",
  }),
]
