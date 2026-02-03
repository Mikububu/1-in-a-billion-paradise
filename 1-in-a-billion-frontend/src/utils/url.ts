export const toAbsoluteUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    // If we had a base API url, we would prepend it here.
    // For now, assume relative paths might be local files or handle gracefully.
    return path;
};
