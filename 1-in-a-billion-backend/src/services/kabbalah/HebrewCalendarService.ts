import { HDate, HebrewCalendar, Event } from '@hebcal/core';
import { DateTime } from 'luxon';

export interface HebrewDateInfo {
  day: number;
  month: string;
  year: number;
  weekday: string;
  specialDay?: string;
}

export class HebrewCalendarService {
  /**
   * Convert Gregorian date to Hebrew date info
   */
  getHebrewDate(date: Date | string, timezone: string = 'UTC'): HebrewDateInfo {
    const dt = typeof date === 'string' ? DateTime.fromISO(date, { zone: timezone }) : DateTime.fromJSDate(date, { zone: timezone });
    
    const hdate = new HDate(dt.toJSDate());
    
    // Get holidays/special days
    const options = {
      start: hdate,
      end: hdate,
      isHebrewYear: true,
    };
    const events = HebrewCalendar.calendar(options);
    const specialDay = events.length > 0 ? events.map(e => e.render('en')).join(', ') : undefined;

    return {
      day: hdate.getDate(),
      month: hdate.getMonthName(),
      year: hdate.getFullYear(),
      weekday: dt.weekdayLong,
      specialDay,
    };
  }

  /**
   * Get sacred context for a time of day
   */
  getTimeContext(hour: number): { normalized: string; sacredContext?: string } {
    if (hour >= 5 && hour < 12) return { normalized: 'morning' };
    if (hour >= 12 && hour < 17) return { normalized: 'afternoon' };
    if (hour >= 17 && hour < 21) return { normalized: 'evening' };
    return { normalized: 'night', sacredContext: hour >= 0 && hour < 4 ? 'midnight watch' : undefined };
  }
}

export const hebrewCalendarService = new HebrewCalendarService();
