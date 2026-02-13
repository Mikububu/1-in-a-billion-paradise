import AsyncStorage from '@react-native-async-storage/async-storage';

const RECEIPTS_KEY = '@deep_reading_job_receipts';
// Modern cache policy:
// - keep recent receipts for operational UX continuity
// - cap absolute count as a safety guard against unbounded growth
export const JOB_BUFFER_MAX = 200;
export const JOB_BUFFER_RETENTION_DAYS = 90;

export type JobReceipt = {
    jobId: string;
    productType?: string;
    productName?: string;
    personName?: string;
    partnerName?: string;
    readingType?: string;
    createdAt: string;
};

const normalizeReceipts = (input: unknown): JobReceipt[] => {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const out: JobReceipt[] = [];

    for (const raw of input) {
        const row = raw as Partial<JobReceipt> | null;
        const jobId = typeof row?.jobId === 'string' ? row.jobId.trim() : '';
        if (!jobId || seen.has(jobId)) continue;
        seen.add(jobId);
        out.push({
            jobId,
            productType: typeof row?.productType === 'string' ? row.productType : undefined,
            productName: typeof row?.productName === 'string' ? row.productName : undefined,
            personName: typeof row?.personName === 'string' ? row.personName : undefined,
            partnerName: typeof row?.partnerName === 'string' ? row.partnerName : undefined,
            readingType: typeof row?.readingType === 'string' ? row.readingType : undefined,
            createdAt: typeof row?.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
        });
    }

    out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return out;
};

const applyRetentionWindow = (receipts: JobReceipt[]): JobReceipt[] => {
    const cutoff = Date.now() - (JOB_BUFFER_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    return receipts.filter((row) => {
        const created = Date.parse(row.createdAt);
        if (!Number.isFinite(created)) return true;
        return created >= cutoff;
    });
};

const persistWithCap = async (candidate: JobReceipt[]): Promise<JobReceipt[]> => {
    const normalized = normalizeReceipts(candidate);
    const retained = applyRetentionWindow(normalized).slice(0, JOB_BUFFER_MAX);
    await AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(retained));
    return retained;
};

export async function getJobReceipts(): Promise<JobReceipt[]> {
    try {
        const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return applyRetentionWindow(normalizeReceipts(parsed));
    } catch {
        return [];
    }
}

export async function addJobToBuffer(receipt: JobReceipt): Promise<void> {
    if (!receipt?.jobId) return;
    const existing = await getJobReceipts();
    const next = [receipt, ...existing.filter((r) => r.jobId !== receipt.jobId)];
    await persistWithCap(next);
}

export async function enforceJobBufferCap(): Promise<void> {
    const existing = await getJobReceipts();
    if (existing.length <= JOB_BUFFER_MAX) return;
    await persistWithCap(existing);
}
