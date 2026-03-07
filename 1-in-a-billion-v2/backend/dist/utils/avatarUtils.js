"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalFilePath = exports.isLocalFileUrl = exports.getAvatarFileUrl = exports.getFallbackAvatarPath = void 0;
const path_1 = __importDefault(require("path"));
const getFallbackAvatarPath = (id) => {
    // Assets are inside backend/assets/ (copied into Docker at /app/assets/).
    // Do NOT use '../assets' — that resolves outside the container.
    const assetsDir = path_1.default.resolve(process.cwd(), 'assets/images/faceless avatar');
    if (!id) {
        return path_1.default.join(assetsDir, 'anonym.avatar.001.jpg');
    }
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;
    const avatarNumber = `00${index + 1}`;
    return path_1.default.join(assetsDir, `anonym.avatar.${avatarNumber}.jpg`);
};
exports.getFallbackAvatarPath = getFallbackAvatarPath;
const getAvatarFileUrl = (id) => {
    return `file://${(0, exports.getFallbackAvatarPath)(id)}`;
};
exports.getAvatarFileUrl = getAvatarFileUrl;
const isLocalFileUrl = (url) => {
    return url.startsWith('file://');
};
exports.isLocalFileUrl = isLocalFileUrl;
const getLocalFilePath = (url) => {
    return url.replace('file://', '');
};
exports.getLocalFilePath = getLocalFilePath;
//# sourceMappingURL=avatarUtils.js.map