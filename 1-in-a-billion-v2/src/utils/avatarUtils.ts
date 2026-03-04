export const getFallbackAvatar = (id: string | undefined | null) => {
    if (!id) {
        return require('../../assets/images/faceless avatar/anonym.avatar.001.jpg');
    }

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;

    switch (index) {
        case 0: return require('../../assets/images/faceless avatar/anonym.avatar.001.jpg');
        case 1: return require('../../assets/images/faceless avatar/anonym.avatar.002.jpg');
        case 2: return require('../../assets/images/faceless avatar/anonym.avatar.003.jpg');
        case 3: return require('../../assets/images/faceless avatar/anonym.avatar.004.jpg');
        case 4: return require('../../assets/images/faceless avatar/anonym.avatar.005.jpg');
        default: return require('../../assets/images/faceless avatar/anonym.avatar.006.jpg');
    }
};

export const getPersonImageSource = (
    person: { id?: string | null, portraitUrl?: string | null, originalPhotoUrl?: string | null } | null | undefined,
    fallbackId?: string | null
) => {
    if (person?.portraitUrl) return { uri: person.portraitUrl };
    if (person?.originalPhotoUrl) return { uri: person.originalPhotoUrl };
    return getFallbackAvatar(person?.id || fallbackId);
};
