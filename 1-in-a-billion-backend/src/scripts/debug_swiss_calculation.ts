
import { swissEngine } from '../services/swissEphemeris';
import { DateTime } from 'luxon';

async function run() {
    const payload = {
        birthDate: '1968-08-23',
        birthTime: '13:45',
        timezone: 'Europe/Vienna',
        latitude: 46.6103,
        longitude: 13.8558,
        relationshipIntensity: 5,
        relationshipMode: 'sensual' as any,
        primaryLanguage: 'en',
    };

    console.log('--- Luxon Time Check ---');
    const dt = DateTime.fromISO(`${payload.birthDate}T${payload.birthTime}`, { zone: payload.timezone });
    console.log(`Input: ${payload.birthDate} ${payload.birthTime} ${payload.timezone}`);
    console.log(`Luxon Date: ${dt.toString()}`);
    console.log(`Offset: ${dt.offset} minutes (${dt.offset / 60} hours)`);
    console.log(`UTC: ${dt.toUTC().toString()}`);

    console.log('\n--- Swiss Ephemeris Calculation ---');
    try {
        const result = await swissEngine.computePlacements(payload);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Calculation Failed:', error);
    }
}

run();
