import { MatchCard, MatchDetail, ReadingPayload } from '../types';
export declare class MatchEngine {
    getPreview(payload: ReadingPayload): {
        matches: MatchCard[];
        lastUpdated: string;
    };
    getDetail(matchId: string): MatchDetail;
}
export declare const matchEngine: MatchEngine;
//# sourceMappingURL=matchEngine.d.ts.map