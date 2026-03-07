/**
 * SINGLE SOURCE OF TRUTH for PDF Layout & Styling
 *
 * Change values here to update ALL PDFs system-wide.
 * No need to hunt through pdfGenerator.ts for magic numbers.
 */
export declare const PDF_CONFIG: {
    readonly pageSize: "A4";
    readonly margins: {
        readonly top: 56;
        readonly bottom: 90;
        readonly left: 56;
        readonly right: 56;
    };
    readonly fonts: {
        readonly title: 24;
        readonly chapterTitle: 18;
        readonly sectionHeading: 14;
        readonly subheading: 12;
        readonly body: 9.5;
        readonly metadata: 9;
        readonly caption: 8;
        readonly footer: 7.5;
    };
    readonly colors: {
        readonly primary: "#1a1a1a";
        readonly secondary: "#666666";
        readonly accent: "#C4A484";
        readonly divider: "#E5E5E5";
        readonly background: "#FFFFFF";
    };
    readonly spacing: {
        readonly paragraphGap: 8;
        readonly sectionGap: 18;
        readonly chapterGap: 26;
        readonly lineHeight: 1.45;
    };
    readonly images: {
        readonly portraitWidth: 100;
        readonly portraitHeight: 100;
        readonly coupleImageWidth: 200;
        readonly coupleImageMaxHeight: 150;
    };
    readonly header: {
        readonly show: true;
        readonly brandFontSize: 14;
        readonly dateFontSize: 9;
        readonly titleFontSize: 13;
        readonly brandColor: "#000000";
        readonly dateColor: "#666666";
        readonly titleColor: "#000000";
        readonly firstPage: {
            readonly showDate: true;
            readonly showBrandCentered: true;
            readonly dateFormat: Intl.DateTimeFormatOptions;
        };
    };
    readonly footer: {
        readonly show: true;
        readonly fontSize: 7.5;
        readonly color: "#666666";
        readonly showPageNumbers: true;
        readonly showGeneratedDate: false;
        readonly content: {
            readonly website: "http://1-in-a-billion.app/";
            readonly publisher: {
                readonly name: "SwiftBuy Solutions LLC";
                readonly address: "Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.";
            };
            readonly poweredBy: "forbidden-yoga.com";
            readonly programIdeaAndConcept: "Michael Wogenburg";
            readonly copyright: "© 1 in a Billion";
        };
    };
    readonly metadata: {
        readonly author: "1 in a Billion";
        readonly creator: "1 in a Billion Reading System";
        readonly producer: "PDFKit";
    };
    readonly version: "1.0";
};
/**
 * Helper to get font size with optional multiplier
 * Usage: fontSize('body') or fontSize('body', 1.2) for 20% larger
 */
export declare function fontSize(key: keyof typeof PDF_CONFIG.fonts, multiplier?: number): number;
/**
 * Helper to get color
 */
export declare function color(key: keyof typeof PDF_CONFIG.colors): string;
//# sourceMappingURL=pdfConfig.d.ts.map