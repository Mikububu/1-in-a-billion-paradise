export const systemLabelForHeadline = (sys?: string) => {
    if (!sys) return 'Astrology';
    const labels: Record<string, string> = {
        western: 'Western Astrology',
        vedic: 'Vedic Astrology',
        human_design: 'Human Design',
        gene_keys: 'Gene Keys',
        kabbalah: 'Kabbalah',
    };
    return labels[sys] || sys;
};

export const systemBlurb = (sys?: string) => {
    return '';
};
