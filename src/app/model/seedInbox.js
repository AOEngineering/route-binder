// src/app/model/seedInbox.js

export const seedInboxItems = [
  {
    id: "inbox_1",
    from: "Dispatch",
    receivedAt: "22:41",
    title: "Add stop, sheet attached",
    hint: "New location, accept to inject after your current stop.",
    payload: {
      // site
      routeNumber: "948",
      name: "Lorain Road Plaza",
      address: "25000 Lorain Rd",
      city: "North Olmsted",
      state: "OH",
      zip: "44070",

      // schedule, matches stop schedule fields
      serviceDays: "Mon Fri",
      firstCompletionTime: "4:00 AM",
      timeOpen: "18:00",
      timeClosed: "06:00",

      // keep window for your current parser
      window: "Open 18:00, Close 06:00",

      assist: false,

      // sheet
      sheetImageSrc: "/placeholders/route_sheet_placeholder.jpg",

      specialNotes: "Main entrance gets slick fast, watch the west driveway, keep piles off the ramp.",

      // work, richer structure
      work: {
        plow: { targetInches: 2, notes: "Keep piles away from handicap ramp." },
        salt: { product: "Rock salt", amount: 4, unit: "scoops", performedBy: "you" },
        sidewalk: { product: "Ice melt", amount: 1, unit: "bags", performedBy: "you" },
        satellite: { salt: "" },
      },

      // legacy fields, still used by your current injector
      saltSpec: "Rock salt",
      shovelSpec: "Ice melt",
    },
  },
]
