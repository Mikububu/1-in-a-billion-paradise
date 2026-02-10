import {
    scoreVarna,
    scoreVashya,
    scoreTara,
    scoreYoni,
    scoreGrahaMaitri,
    scoreGana,
    scoreBhakoot,
    scoreNadi,
    computeVedicMatch
} from '../vedic_matchmaking.engine';
import { PersonChart } from '../vedic_matchmaking.types';

// ==========================================
// MINIMAL TEST HARNESS
// ==========================================
let passes = 0;
let fails = 0;

function describe(name: string, fn: () => void) {
    console.log(`\nMetric: ${name}`);
    fn();
}

function it(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passes++;
    } catch (e: any) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${e.message}`);
        fails++;
    }
}

function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, got ${actual}`);
            }
        }
    };
}

// Run summary at exit
process.on('exit', () => {
    console.log(`\nTest Summary: ${passes} Passed, ${fails} Failed`);
    if (fails > 0) process.exitCode = 1;
});

// ==========================================
// TESTS
// ==========================================

// Mock Person Factory
const mockPerson = (sign: string, nakshatra: string): any => ({
    moon_sign: sign,
    moon_nakshatra: nakshatra,
    // Add defaults for other fields if checked
    yoni: 'ashwa',
    gana: 'deva',
    nadi: 'adi',
    moon_sign_lord: 'Mars'
});

describe('Vedic Matchmaking Engine - Pure Computation', () => {

    describe('1. Varna Koota (1 Point)', () => {
        // Hierarchy: Brahmin > Kshatriya > Vaishya > Shudra
        // Groom >= Bride -> 1

        it('should score 1 when Groom is Higher (Brahmin vs Kshatriya)', () => {
            const groom = mockPerson('Cancer', 'Pushya'); // Cancer = Brahmin
            const bride = mockPerson('Aries', 'Ashwini'); // Aries = Kshatriya
            expect(scoreVarna(groom, bride)).toBe(1);
        });

        it('should score 1 when Equal (Brahmin vs Brahmin)', () => {
            const groom = mockPerson('Cancer', 'Pushya');
            const bride = mockPerson('Scorpio', 'Jyeshtha'); // Scorpio = Brahmin
            expect(scoreVarna(groom, bride)).toBe(1);
        });

        it('should score 0 when Groom is Lower (Shudra vs Brahmin)', () => {
            const groom = mockPerson('Gemini', 'Ardra'); // Gemini = Shudra
            const bride = mockPerson('Cancer', 'Pushya'); // Cancer = Brahmin
            expect(scoreVarna(groom, bride)).toBe(0);
        });
    });

    describe('2. Vashya Koota (2 Points)', () => {
        // Aries compatible with Leo? Table: Aries -> [Leo, Scorpio] (Step 246)
        it('should score 2 for compatible pair defined in table (Aries ranges)', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Leo', 'Magha');
            expect(scoreVashya(groom, bride)).toBe(2);
        });

        it('should score 0 for incompatible pair (Leo -> Aries)', () => {
            // Leo table: ['Libra']. Does not include Aries.
            const groom = mockPerson('Leo', 'Magha');
            const bride = mockPerson('Aries', 'Ashwini');
            expect(scoreVashya(groom, bride)).toBe(0);
        });
    });

    describe('3. Tara Koota (3 Points)', () => {
        // Logic: Count Bride to Groom.
        // Ashwini(1) -> Ashwini(1). Dist 1. Janma(1) -> 0 pts.
        it('should score 0 for Janma (Same Nakshatra)', () => {
            const groom = mockPerson('Ashwini', 'Ashwini');
            const bride = mockPerson('Ashwini', 'Ashwini');
            expect(scoreTara(groom, bride)).toBe(0);
        });

        // Groom=Ashwini(1), Bride=Bharani(2).
        // Count Bride->Groom: (1 - 2) + 1 = 0 -> +27 = 27.
        // 27 % 9 = 0 -> 'ParamaMitra' -> 3 pts.
        it('should score 3 for ParamaMitra (Distance 27)', () => {
            const groom = mockPerson('Ashwini', 'Ashwini'); // 1
            const bride = mockPerson('Bharani', 'Bharani'); // 2
            expect(scoreTara(groom, bride)).toBe(3);
        });

        // Groom=Bharani(2), Bride=Ashwini(1).
        // Count Bride->Groom: (2 - 1) + 1 = 2.
        // 2 % 9 = 2 -> 'Sampat' -> 3 pts.
        it('should score 3 for Sampat (Distance 2)', () => {
            const groom = mockPerson('Bharani', 'Bharani');
            const bride = mockPerson('Ashwini', 'Ashwini');
            expect(scoreTara(groom, bride)).toBe(3);
        });

        // Vipat (3) -> 0. Distance 3.
        // Groom=Krittika(3), Bride=Ashwini(1). (3-1)+1 = 3. Vipat.
        it('should score 0 for Vipat (Distance 3)', () => {
            const groom = mockPerson('Krittika', 'Krittika');
            const bride = mockPerson('Ashwini', 'Ashwini');
            expect(scoreTara(groom, bride)).toBe(0);
        });
    });

    describe('4. Yoni Koota (4 Points)', () => {
        // Ashwini (Horse) vs Shatabhisha (Horse) -> Same -> 4
        it('should score 4 for Same Yoni', () => {
            const groom = mockPerson('Aries', 'Ashwini'); // Horse
            const bride = mockPerson('Aquarius', 'Shatabhisha'); // Horse
            expect(scoreYoni(groom, bride)).toBe(4);
        });

        // Ashwini (Horse) vs Bharani (Elephant). Enemy? Matrix says 2.
        it('should score 2 for Horse vs Elephant (Neutral/Enemy mix)', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Aries', 'Bharani');
            expect(scoreYoni(groom, bride)).toBe(2);
        });
    });

    describe('5. Graha Maitri (5 Points)', () => {
        // Aries(Mars) vs Scorpio(Mars). Same Lord.
        it('should score 5 for Same Lord', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Scorpio', 'Jyeshtha');
            expect(scoreGrahaMaitri(groom, bride)).toBe(5);
        });

        // Aries(Mars) vs Leo(Sun).
        // Mars friends: Sun. Sun friends: Mars. Mutual Friends.
        it('should score 5 for Mutual Friends', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Leo', 'Magha');
            expect(scoreGrahaMaitri(groom, bride)).toBe(5);
        });

        // Aries(Mars) vs Capricorn(Saturn).
        // Mars: Saturn is Neutral.
        // Saturn: Mars is Enemy.
        // Neutral + Enemy -> ? (Snippet: Mutual=5, One-sided=3, Neutral=1, Enemy=0)
        // My Logic: If not Friend -> Neutral. So Neutral-Neutral -> 1.
        // Or if I implemented Friend list strict logic:
        // Mars list: Sun, Moon, Jupiter. Saturn NOT in list. -> Neutral.
        // Saturn list: Mercury, Venus. Mars NOT in list. -> Neutral.
        // So Neutral + Neutral = 1.
        it('should score 1 for Neutral-Neutral (Mars-Saturn)', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Capricorn', 'Shravana');
            expect(scoreGrahaMaitri(groom, bride)).toBe(1);
        });
    });

    describe('6. Gana Koota (6 Points)', () => {
        // Ashwini (Deva) vs Mrigashira (Deva) -> 6
        it('should score 6 for Deva-Deva', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Gemini', 'Mrigashira');
            expect(scoreGana(groom, bride)).toBe(6);
        });

        // Deva vs Rakshasa (Ashwini vs Krittika) -> 1
        it('should score 1 for Deva-Rakshasa', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Aries', 'Krittika');
            expect(scoreGana(groom, bride)).toBe(1);
        });

        // Rakshasa vs Deva -> 1 (Symmetric with Deva vs Rakshasa)
        it('should score 1 for Rakshasa-Deva', () => {
            const groom = mockPerson('Aries', 'Krittika');
            const bride = mockPerson('Aries', 'Ashwini');
            expect(scoreGana(groom, bride)).toBe(1);
        });
    });

    describe('7. Bhakoot Koota (7 Points)', () => {
        // Bad distances: 2, 6, 8, 12.
        // Aries(1) vs Aries(1). Dist 1. Good.
        it('should score 7 for Same Sign (1/1)', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Aries', 'Bharani');
            expect(scoreBhakoot(groom, bride)).toBe(7);
        });

        // Aries(1) vs Taurus(2). Dist 2. Bad.
        it('should score 0 for 2/12 relationship', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Taurus', 'Rohini');
            expect(scoreBhakoot(groom, bride)).toBe(0);
        });

        // Aries(1) vs Virgo(6). Dist 6. Bad.
        it('should score 0 for 6/8 relationship', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Virgo', 'Hasta');
            expect(scoreBhakoot(groom, bride)).toBe(0);
        });

        // Aries(1) vs Leo(5). Dist 5. Good (per snippet).
        it('should score 7 for 5/9 relationship', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Leo', 'Magha');
            expect(scoreBhakoot(groom, bride)).toBe(7);
        });
    });

    describe('8. Nadi Koota (8 Points)', () => {
        // Ashwini (Adi) vs Rohini (Adi). Same -> 0.
        it('should score 0 for Same Nadi (Dosha)', () => {
            const groom = mockPerson('Aries', 'Ashwini'); // Adi
            const bride = mockPerson('Taurus', 'Rohini'); // Adi
            expect(scoreNadi(groom, bride)).toBe(0);
        });

        // Ashwini (Adi) vs Bharani (Madhya). Diff -> 8.
        it('should score 8 for Different Nadi', () => {
            const groom = mockPerson('Aries', 'Ashwini');
            const bride = mockPerson('Aries', 'Bharani');
            expect(scoreNadi(groom, bride)).toBe(8);
        });
    });

});
