import { hebrewCalendarService, HebrewDateInfo } from './HebrewCalendarService';
import { gematriaService, GematriaInfo } from './GematriaService';
import { DateTime } from 'luxon';

export interface KabbalahPayload {
  hebrewDate: HebrewDateInfo;
  birthTimeContext: {
    normalized: string;
    sacredContext?: string;
  };
  fullName: {
    firstName: GematriaInfo;
    surname: GematriaInfo;
    totalGematria: number;
  };
  lifeEvents?: {
    rawText: string;
    // Note: Advanced extraction could be added later
  };
}

export class KabbalahPreprocessor {
  /**
   * Preprocess all data for a Kabbalah reading
   */
  async preprocess(params: {
    birthDate: string;
    birthTime: string;
    timezone: string;
    firstName: string;
    surname: string;
    lifeEvents?: string;
  }): Promise<KabbalahPayload> {
    const { birthDate, birthTime, timezone, firstName, surname, lifeEvents } = params;
    
    // 1. Hebrew Date
    const hDate = hebrewCalendarService.getHebrewDate(`${birthDate}T${birthTime}`, timezone);
    
    // 2. Time Context
    const dt = DateTime.fromISO(`${birthDate}T${birthTime}`, { zone: timezone });
    const timeContext = hebrewCalendarService.getTimeContext(dt.hour);
    
    // 3. Names & Gematria
    const firstNameInfo = gematriaService.processName(firstName);
    const surnameInfo = gematriaService.processName(surname);
    
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

export const kabbalahPreprocessor = new KabbalahPreprocessor();
