import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export type Language = 'fa' | 'en' | 'ja' | 'vi';

let currentLanguage: Language = 'en';
let translations: Record<string, Record<string, string>> = {};

export function initI18n(lang: Language = 'en') {
    currentLanguage = lang;
    loadTranslations();
}

function loadTranslations() {
    try {
        const faPath = path.join(__dirname, '../../locales/fa.json');
        const enPath = path.join(__dirname, '../../locales/en.json');
        const jaPath = path.join(__dirname, '../../locales/ja.json');
        const viPath = path.join(__dirname, '../../locales/vi.json');

        translations['fa'] = fs.existsSync(faPath) ? JSON.parse(fs.readFileSync(faPath, 'utf8')) : {};
        translations['en'] = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : {};
        translations['ja'] = fs.existsSync(jaPath) ? JSON.parse(fs.readFileSync(jaPath, 'utf8')) : {};
        translations['vi'] = fs.existsSync(viPath) ? JSON.parse(fs.readFileSync(viPath, 'utf8')) : {};
    } catch (error) {
        logger.error('Failed to load translations:', error);
    }
}

export function t(key: string, variables?: Record<string, any>): string {
    const langDict = translations[currentLanguage] || translations['en'] || translations['fa'];
    let text = langDict?.[key] || translations['en']?.[key] || translations['fa']?.[key] || key;

    if (variables) {
        for (const [vKey, vValue] of Object.entries(variables)) {
            text = text.replaceAll(`{{${vKey}}}`, String(vValue));
        }
    }

    return text;
}
