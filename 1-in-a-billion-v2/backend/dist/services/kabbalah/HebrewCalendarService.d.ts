export interface HebrewDateInfo {
    day: number;
    month: string;
    year: number;
    weekday: string;
    specialDay?: string;
}
export declare class HebrewCalendarService {
    /**
     * Convert Gregorian date to Hebrew date info
     */
    getHebrewDate(date: Date | string, timezone?: string): Promise<HebrewDateInfo>;
    /**
     * Get sacred context for a time of day
     */
    getTimeContext(hour: number): {
        normalized: string;
        sacredContext?: string;
    };
}
export declare const hebrewCalendarService: HebrewCalendarService;
//# sourceMappingURL=HebrewCalendarService.d.ts.map