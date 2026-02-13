import {
    runVedicMatch,
    runVedicRank,
    runVedicScore,
} from './service';
import {
    VedicMatchResponsePayload,
    VedicRankResponsePayload,
    VedicScoreResponsePayload,
} from './contracts';

export type VedicHttpErrorBody = {
    error: string;
};

export type VedicHttpResponse<T> = {
    status: number;
    body: T | VedicHttpErrorBody;
};

function handleRequest<T>(runner: () => T): VedicHttpResponse<T> {
    try {
        return {
            status: 200,
            body: runner(),
        };
    } catch (error: any) {
        return {
            status: 400,
            body: {
                error: typeof error?.message === 'string' ? error.message : 'Invalid request payload',
            },
        };
    }
}

export function handleVedicMatchRequest(payload: unknown): VedicHttpResponse<VedicMatchResponsePayload> {
    return handleRequest(() => runVedicMatch(payload));
}

export function handleVedicScoreRequest(payload: unknown): VedicHttpResponse<VedicScoreResponsePayload> {
    return handleRequest(() => runVedicScore(payload));
}

export function handleVedicRankRequest(payload: unknown): VedicHttpResponse<VedicRankResponsePayload> {
    return handleRequest(() => runVedicRank(payload));
}
