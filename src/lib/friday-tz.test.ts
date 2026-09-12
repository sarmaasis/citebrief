import assert from "node:assert/strict";
import { isLocalFridaySix, localWeekdayAndHour } from "./friday-tz";

// Fixed UTC instant: Friday 2026-09-11 10:30 UTC = 06:30 America/New_York (EDT, UTC-4)
const friMorningEt = new Date("2026-09-11T10:30:00.000Z");
assert.equal(isLocalFridaySix("America/New_York", friMorningEt), true);
assert.equal(isLocalFridaySix("UTC", friMorningEt), false);

const local = localWeekdayAndHour("America/New_York", friMorningEt);
assert.ok(local);
assert.equal(local!.weekday, "Fri");
assert.equal(local!.hour, 6);

// Saturday UTC should not match ET Friday 06
const sat = new Date("2026-09-12T10:30:00.000Z");
assert.equal(isLocalFridaySix("America/New_York", sat), false);

console.log("friday-tz.test.ts: ok");
