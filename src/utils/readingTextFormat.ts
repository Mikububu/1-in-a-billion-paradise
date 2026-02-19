export type ReadingBlock =
    | { kind: 'heading'; text: string }
    | { kind: 'paragraph'; text: string };

const normalizeHeading = (line: string) => line.replace(/^#{1,6}\s+/, '').trim();

const isAllCapsHeading = (line: string) => /^[A-Z0-9][A-Z0-9\s\-\&\(\)\/\:\.]+$/.test(line);

const isNumberedHeading = (line: string) =>
    /^((\d+|[IVXLCDM]+)[\.\)]\s+).{2,72}$/i.test(line);

const isTitleCaseHeading = (line: string) => {
    if (line.length > 72) return false;
    if (/[.!?]$/.test(line)) return false;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 10) return false;

    const alphaWords = words.filter((word) => /[A-Za-z]/.test(word));
    if (alphaWords.length === 0) return false;

    const titleishCount = alphaWords.filter((word) => /^[A-Z][a-zA-Z'\-]*$/.test(word)).length;
    return titleishCount / alphaWords.length >= 0.7;
};

const isHeadingLine = (line: string) => {
    const value = normalizeHeading(line.trim());
    if (!value) return false;
    if (value.length > 80) return false;
    if (isAllCapsHeading(value)) return true;
    if (isNumberedHeading(value)) return true;
    return isTitleCaseHeading(value);
};

export const splitIntoBlocks = (raw: string): ReadingBlock[] => {
    const text = (raw || '').replace(/\r\n/g, '\n').trim();
    if (!text) return [];

    const blocks: ReadingBlock[] = [];
    const lines = text.split('\n');
    let paragraphLines: string[] = [];

    const flushParagraph = () => {
        const merged = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
        if (merged) {
            blocks.push({ kind: 'paragraph', text: merged });
        }
        paragraphLines = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            flushParagraph();
            continue;
        }

        if (isHeadingLine(trimmed)) {
            flushParagraph();
            blocks.push({ kind: 'heading', text: normalizeHeading(trimmed) });
            continue;
        }

        paragraphLines.push(trimmed);
    }

    flushParagraph();
    return blocks;
};
