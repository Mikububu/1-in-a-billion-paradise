import path from 'path';

export const getFallbackAvatarPath = (id: string | null | undefined): string => {
    const assetsDir = path.resolve(process.cwd(), '../assets/images/faceless avatar');

    if (!id) {
        return path.join(assetsDir, 'anonym.avatar.001.jpg');
    }

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;

    const avatarNumber = `00${index + 1}`;
    return path.join(assetsDir, `anonym.avatar.${avatarNumber}.jpg`);
};

export const getAvatarFileUrl = (id: string | null | undefined): string => {
    return `file://${getFallbackAvatarPath(id)}`;
};

export const isLocalFileUrl = (url: string): boolean => {
    return url.startsWith('file://');
};

export const getLocalFilePath = (url: string): string => {
    return url.replace('file://', '');
};
