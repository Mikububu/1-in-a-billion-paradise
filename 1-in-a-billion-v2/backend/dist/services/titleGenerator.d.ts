/**
 * Generate dramatic, evocative titles for readings and songs
 * Uses separate LLM call to create compelling titles that capture essence
 */
export declare function generateDramaticTitles(params: {
    system: string;
    personName: string;
    textExcerpt: string;
    docType: 'person1' | 'person2' | 'overlay' | 'verdict';
    spiceLevel?: number;
}): Promise<{
    readingTitle: string;
    songTitle: string;
}>;
//# sourceMappingURL=titleGenerator.d.ts.map