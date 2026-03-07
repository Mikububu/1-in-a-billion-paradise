import { OutputLanguage } from '../config/languages';
export type AudioPersonMeta = {
    name?: string;
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    timezone?: string;
};
export declare function buildLocalizedSpokenIntro(options: {
    system?: string;
    docType: 'person1' | 'person2' | 'overlay' | 'verdict';
    person1?: AudioPersonMeta;
    person2?: AudioPersonMeta;
    language: OutputLanguage;
}): string;
//# sourceMappingURL=spokenIntro.d.ts.map