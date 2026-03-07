"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hebrewCalendarService = exports.HebrewCalendarService = void 0;
const luxon_1 = require("luxon");
// @hebcal/core is ESM-only. Our backend compiles to CJS for Fly/Node compatibility.
// TypeScript will downlevel `import()` into `require()` under CJS output, which breaks ESM-only packages.
// This helper forces a *runtime* dynamic import that survives the TS compile step.
async function importHebcalCore() {
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('m', 'return import(m)');
    return dynamicImport('@hebcal/core');
}
class HebrewCalendarService {
    /**
     * Convert Gregorian date to Hebrew date info
     */
    async getHebrewDate(date, timezone = 'UTC') {
        const { HDate, HebrewCalendar } = await importHebcalCore();
        const dt = typeof date === 'string' ? luxon_1.DateTime.fromISO(date, { zone: timezone }) : luxon_1.DateTime.fromJSDate(date, { zone: timezone });
        const hdate = new HDate(dt.toJSDate());
        // Get holidays/special days
        const options = {
            start: hdate,
            end: hdate,
            isHebrewYear: true,
        };
        const events = HebrewCalendar.calendar(options);
        const specialDay = events.length > 0 ? events.map((e) => e.render('en')).join(', ') : undefined;
        return {
            day: hdate.getDate(),
            month: hdate.getMonthName(),
            year: hdate.getFullYear(),
            weekday: dt.weekdayLong || 'Unknown',
            specialDay,
        };
    }
    /**
     * Get sacred context for a time of day
     */
    getTimeContext(hour) {
        if (hour >= 5 && hour < 12)
            return { normalized: 'morning' };
        if (hour >= 12 && hour < 17)
            return { normalized: 'afternoon' };
        if (hour >= 17 && hour < 21)
            return { normalized: 'evening' };
        return { normalized: 'night', sacredContext: hour >= 0 && hour < 4 ? 'midnight watch' : undefined };
    }
}
exports.HebrewCalendarService = HebrewCalendarService;
exports.hebrewCalendarService = new HebrewCalendarService();
//# sourceMappingURL=HebrewCalendarService.js.map