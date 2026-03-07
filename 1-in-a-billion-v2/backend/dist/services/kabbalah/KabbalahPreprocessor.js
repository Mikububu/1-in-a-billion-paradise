"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kabbalahPreprocessor = exports.KabbalahPreprocessor = void 0;
const HebrewCalendarService_1 = require("./HebrewCalendarService");
const GematriaService_1 = require("./GematriaService");
const luxon_1 = require("luxon");
class KabbalahPreprocessor {
    /**
     * Preprocess all data for a Kabbalah reading
     */
    async preprocess(params) {
        const { birthDate, birthTime, timezone, firstName, surname, lifeEvents } = params;
        // 1. Hebrew Date
        const hDate = await HebrewCalendarService_1.hebrewCalendarService.getHebrewDate(`${birthDate}T${birthTime}`, timezone);
        // 2. Time Context
        const dt = luxon_1.DateTime.fromISO(`${birthDate}T${birthTime}`, { zone: timezone });
        const timeContext = HebrewCalendarService_1.hebrewCalendarService.getTimeContext(dt.hour);
        // 3. Names & Gematria
        const firstNameInfo = GematriaService_1.gematriaService.processName(firstName);
        const surnameInfo = GematriaService_1.gematriaService.processName(surname);
        return {
            hebrewDate: hDate,
            birthTimeContext: timeContext,
            fullName: {
                firstName: firstNameInfo,
                surname: surnameInfo,
                totalGematria: firstNameInfo.gematria + surnameInfo.gematria,
            },
            lifeEvents: lifeEvents ? {
                rawText: lifeEvents,
            } : undefined,
        };
    }
}
exports.KabbalahPreprocessor = KabbalahPreprocessor;
exports.kabbalahPreprocessor = new KabbalahPreprocessor();
//# sourceMappingURL=KabbalahPreprocessor.js.map