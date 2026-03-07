"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const I18N_DIR = path_1.default.resolve(__dirname, '../../../src/i18n');
function clean() {
    const files = fs_1.default.readdirSync(I18N_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const filePath = path_1.default.join(I18N_DIR, file);
        let obj = JSON.parse(fs_1.default.readFileSync(filePath, 'utf8'));
        // Requirement 1: Delete "How matching works"
        if ('home.howMatching.button' in obj) {
            delete obj['home.howMatching.button'];
            console.log(`Deleted 'home.howMatching.button' from ${file}`);
        }
        // Requirement 2: English override for "Your 1 in a Billion is still out there"
        if ('home.matching.notFound' in obj) {
            obj['home.matching.notFound'] = 'Your 1 in a Billion is still out there';
            console.log(`Forced English override for 'home.matching.notFound' in ${file}`);
        }
        // Requirement 3: Brand name "1 In A Billion" is never translated
        if ('app.name' in obj)
            obj['app.name'] = '1 In A Billion';
        if ('intro.brand' in obj)
            obj['intro.brand'] = '1 In A Billion';
        if ('pdf.header.brand' in obj)
            obj['pdf.header.brand'] = '1 in a Billion';
        fs_1.default.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
    }
}
clean();
//# sourceMappingURL=clean_translations.js.map