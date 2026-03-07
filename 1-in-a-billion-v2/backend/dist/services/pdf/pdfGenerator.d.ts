/**
 * ⚠️ CRITICAL: ChapterContent must have EXACTLY ONE reading field with content
 *
 * Each PDF should only use ONE of these fields:
 * - person1Reading: For person 1's individual reading ONLY
 * - person2Reading: For person 2's individual reading ONLY
 * - overlayReading: For synastry/compatibility reading ONLY
 * - verdict: For final verdict/summary ONLY
 *
 * NEVER use the same content for multiple fields or multiple PDFs.
 * See: docs/PDF_CONTENT_ROUTING_RULES.md
 */
interface ChapterContent {
    title: string;
    system: string;
    person1Reading?: string;
    person2Reading?: string;
    overlayReading?: string;
    verdict?: string;
}
import { OutputLanguage } from '../../config/languages';
export interface PDFGenerationOptions {
    type: 'single' | 'overlay' | 'nuclear';
    title: string;
    subtitle?: string;
    outputLanguage?: OutputLanguage;
    coverQuote?: string;
    person1: {
        name: string;
        birthDate: string;
        birthTime?: string;
        birthPlace?: string;
        timezone?: string;
        sunSign?: string;
        moonSign?: string;
        risingSign?: string;
        portraitUrl?: string;
    };
    person2?: {
        name: string;
        birthDate: string;
        birthTime?: string;
        birthPlace?: string;
        timezone?: string;
        sunSign?: string;
        moonSign?: string;
        risingSign?: string;
        portraitUrl?: string;
    };
    coupleImageUrl?: string;
    chapters: ChapterContent[];
    chartReferencePage?: string;
    chartReferencePageRight?: string;
    compatibilityAppendix?: string;
    /** Pre-computed compatibility scores from separate LLM scoring call (PDF-only, not in reading text) */
    compatibilityScores?: Array<{
        label: string;
        score: number;
        scoreTen: number;
        note: string;
    }>;
    generatedAt: Date;
    spicyScore?: number;
    safeStableScore?: number;
    compatibilityScore?: number;
    finalVerdict?: string;
    allowInferredHeadlines?: boolean;
}
export declare function generateReadingPDF(options: PDFGenerationOptions): Promise<{
    filePath: string;
    pageCount: number;
}>;
export declare function generateChapterPDF(chapterNumber: number, chapter: ChapterContent, person1: PDFGenerationOptions['person1'], person2?: PDFGenerationOptions['person2'], coupleImageUrl?: string, extras?: {
    chartReferencePage?: string;
    chartReferencePageRight?: string;
    compatibilityScores?: Array<{
        label: string;
        score: number;
        scoreTen: number;
        note: string;
    }>;
    outputLanguage?: OutputLanguage;
}): Promise<{
    filePath: string;
    pageCount: number;
}>;
export {};
//# sourceMappingURL=pdfGenerator.d.ts.map