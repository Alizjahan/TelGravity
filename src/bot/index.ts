import { Bot, Context, InlineKeyboard } from 'grammy';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AntigravityNativeService } from '../services/antigravityNativeService';
import { handleScreenshot } from '../ui/screenshotUi';
import { PROJECT_SELECT_ID } from '../ui/projectListUi';
import { WorkspaceService } from '../services/workspaceService';
import { loadConfig } from '../utils/config';
import { escapeHtml, formatForTelegram, splitTelegramHtml } from '../utils/telegramFormatter';
import { logger } from '../utils/logger';
import { 
    getReceivedImagesDir, 
    getReceivedVoicesDir, 
    getReceivedPdfDir, 
    getReceivedDocumentsDir, 
    ensureAllStorageDirsExist 
} from '../utils/storagePaths';
import * as path from 'path';
import * as fs from 'fs';

function createProxyAgent(proxyUrl?: string): any {
    if (!proxyUrl) return undefined;
    const trimmed = proxyUrl.trim();
    if (trimmed.startsWith('socks5://') || trimmed.startsWith('socks4://')) {
        return new SocksProxyAgent(trimmed, { timeout: 60000 });
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return new HttpsProxyAgent(trimmed, { timeout: 60000 });
    }
    return undefined;
}

// User language preference (default: 'en')
const USER_LANG_FILE = path.join(process.cwd(), 'user_languages.json');
const userLanguageMap = new Map<string, 'fa' | 'en'>();

function loadUserLanguages() {
    try {
        if (fs.existsSync(USER_LANG_FILE)) {
            const data = JSON.parse(fs.readFileSync(USER_LANG_FILE, 'utf8'));
            for (const [k, v] of Object.entries(data)) {
                if (v === 'fa' || v === 'en') {
                    userLanguageMap.set(k, v);
                }
            }
        }
    } catch {}
}

function saveUserLanguages() {
    try {
        const obj: Record<string, string> = {};
        for (const [k, v] of userLanguageMap.entries()) {
            obj[k] = v;
        }
        fs.writeFileSync(USER_LANG_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch {}
}

loadUserLanguages();

function getUserLang(userId?: number | string): 'fa' | 'en' {
    if (!userId) return 'en';
    return userLanguageMap.get(String(userId)) || 'en';
}
function setUserLang(userId: number | string, lang: 'fa' | 'en') {
    userLanguageMap.set(String(userId), lang);
    saveUserLanguages();
}

// Track active conversation & project selection
const userSelectedProject = new Map<string, string>();
const userActiveConvo = new Map<string, string>();
const userActiveConvoTitle = new Map<string, string>();
const userWatchers = new Map<string, () => void>();
const userLastDeliveredStep = new Map<string, number>();

/**
 * Deliver markdown responses to Telegram formatted as HTML, chunked safely to 3500 chars
 * while preserving opened/closed HTML tags, with fallback to plain text if HTML parsing fails.
 */
async function sendChunkedTelegramReply(
    sendFn: (text: string, options?: any) => Promise<any>,
    headerTitle: string,
    rawMarkdown: string
): Promise<void> {
    const formatted = formatForTelegram(rawMarkdown);
    const chunks = splitTelegramHtml(formatted, 3500);

    for (let i = 0; i < chunks.length; i++) {
        let msg = '';
        if (chunks.length === 1) {
            msg = headerTitle ? `${headerTitle}\n\n${chunks[0]}` : chunks[0];
        } else {
            const prefix = i === 0
                ? `${headerTitle} (بخش ۱ از ${chunks.length}):\n\n`
                : `📄 <b>(بخش ${i + 1} از ${chunks.length}):</b>\n\n`;
            msg = prefix + chunks[i];
        }

        try {
            await sendFn(msg, { parse_mode: 'HTML' });
        } catch (err) {
            logger.warn('[Bot] HTML send failed, falling back to plain text:', err);
            const plain = msg
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');
            try {
                await sendFn(plain);
            } catch (fallbackErr) {
                logger.error('[Bot] Plain text fallback also failed:', fallbackErr);
            }
        }
    }
}

export const startBot = async () => {
    ensureAllStorageDirsExist();
    const config = loadConfig();
    const workspaceService = new WorkspaceService(config.workspaceBaseDir);

    const proxyAgent = createProxyAgent(config.proxyUrl);
    if (proxyAgent) {
        logger.info(`[Bot] Using proxy for Telegram: ${config.proxyUrl}`);
    }

    const bot = new Bot(config.telegramBotToken, proxyAgent ? {
        client: {
            baseFetchConfig: { agent: proxyAgent, compress: true },
        },
    } : undefined);

    // Auth Middleware
    bot.use(async (ctx, next) => {
        const userId = String(ctx.from?.id ?? '');
        if (config.allowedUserIds.length > 0 && !config.allowedUserIds.includes(userId)) {
            if (ctx.callbackQuery) {
                await ctx.answerCallbackQuery({ text: 'Access Denied.' });
            } else {
                await ctx.reply(`⛔ <b>Access Denied</b>\n\nUser ID: <code>${userId}</code>`, { parse_mode: 'HTML' });
            }
            return;
        }
        await next();
    });

    const replyHtml = async (ctx: Context, text: string, keyboard?: InlineKeyboard) => {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    };

    // /start command
    bot.command('start', async (ctx) => {
        const userId = String(ctx.from?.id ?? '');
        const lang = getUserLang(userId);
        const isFa = lang === 'fa';

        const keyboard = new InlineKeyboard()
            .text(isFa ? '➕ گفتگوی جدید (New Chat)' : '➕ New Chat', 'start_new_chat')
            .text(isFa ? '📁 انتخاب پروژه' : '📁 Select Project', 'menu_projects').row()
            .text(isFa ? '📊 وضعیت سیستم و تسک‌ها' : '📊 System & Tasks Status', 'check_task_status')
            .text(isFa ? '⏹ لغو ران / توقف' : '⏹ Stop Task', 'stop_task').row()
            .text(isFa ? '📸 اسکرین‌شات از آنتی‌گرویتی' : '📸 Screenshot of Antigravity', 'menu_screenshot')
            .text(isFa ? '🌐 تغییر زبان' : '🌐 Language', 'menu_lang').row()
            .text(isFa ? '📖 راهنمای کامل دستورات' : '📖 User Guide & Help', 'menu_help');

        const activeProject = userSelectedProject.get(userId) || '5-  Anti_Telegram';
        const activeChatTitle = userActiveConvoTitle.get(userId) || (isFa ? 'گفتگوی فعال' : 'Active Conversation');

        const isGeneral = activeProject.includes('عمومی') || activeProject.toLowerCase().includes('general');
        const startLocFa = isGeneral
            ? `\u200F• موقعیت مکانی حال حاضر شما: در حالت عمومی (بدون پروژه)\n`
            : `\u200F• موقعیت مکانی حال حاضر شما در پروژه «${escapeHtml(activeProject)}» است.\n`;
        const startLocEn = isGeneral
            ? `• Your current active location: General (No Project)\n`
            : `• Your current active location is in project "${escapeHtml(activeProject)}".\n`;

        const textFa = `\u200F👋 <b>سلام! ربات تلگرام TelGravity (Telegram Remote Controller for Antigravity) آماده است.</b>\n\n` +
            `\u200F🎯 <b>وضعیت اتصال:</b>\n` +
            `${startLocFa}` +
            `\u200F• عنوان گفتگوی فعال: <code>${escapeHtml(activeChatTitle)}</code>\n\n` +
            `\u200F🚀 <b>امکانات و کارهای قابل انجام:</b>\n` +
            `\u200F• ارسال متن یا پیام صوتی برای شروع پردازش\n` +
            `\u200F• ارسال تصویر، سند یا کد به همراه توضیحات\n` +
            `\u200F• ساخت گفتگوی جدید در هر پروژه یا حالت عمومی با /new\n` +
            `\u200F• مشاهده و انتخاب پروژه‌ها با دستور /project یا دکمه زیر\n` +
            `\u200F• توقف فوری و لغو پردازش‌های فعال با دستور /stop\n` +
            `\u200F• تصویربرداری زنده از پنجره برنامه با دستور /screenshot\n` +
            `\u200F• راهنمای کامل دستورات با ارسال دستور /help\n` +
            `\u200F• تغییر زبان کاری در هر زمان با دستور /lang\n` +
            `\u200F• دریافت خودکار اعلان و نتیجه کامل پس از پایان کار`;

        const textEn = `👋 <b>TelGravity (Telegram Remote Controller for Antigravity) is Ready.</b>\n\n` +
            `🎯 <b>Connection Status:</b>\n` +
            `${startLocEn}` +
            `💬 Connected Chat: <code>${escapeHtml(activeChatTitle)}</code>\n\n` +
            `🚀 <b>What you can do:</b>\n` +
            `• Send text or voice note to interact with Antigravity\n` +
            `• Send photos with captions (bug reports, diagrams, code snaps)\n` +
            `• Start new chats in any project or General mode with /new\n` +
            `• Select projects & chats with /project or buttons below\n` +
            `• Stop stuck processing runs anytime with /stop\n` +
            `• Capture live Antigravity window screenshots via /screenshot\n` +
            `• View complete user guide anytime with /help\n` +
            `• Switch language anytime with /lang or the 🌐 Language button\n` +
            `• Receive full notification updates once processing completes`;

        await replyHtml(ctx, isFa ? textFa : textEn, keyboard);
    });

    // Helper: Show all projects and let user pick one to view its chats
    const sendProjectsList = async (ctx: Context, isEdit: boolean = false) => {
        const userId = String(ctx.from?.id ?? '');
        const lang = getUserLang(userId);
        const isFa = lang === 'fa';

        const grouped = await AntigravityNativeService.getGroupedSessions();

        const projectMap = new Map<string, number>();
        for (const [pName, sessions] of Object.entries(grouped)) {
            if (sessions && sessions.length > 0) {
                projectMap.set(pName, sessions.length);
            }
        }

        const keyboard = new InlineKeyboard();

        // Put General / No Project button first if present, with globe emoji and exact requested text
        let genKey = '';
        let genCount = 0;
        for (const [pName, count] of projectMap.entries()) {
            if (pName.includes('عمومی') || pName.toLowerCase().includes('general') || pName.includes('بدون پروژه')) {
                genKey = pName;
                genCount = count;
                break;
            }
        }

        if (genKey) {
            const genLabel = isFa 
                ? `🌐 گفتگوی عمومی / جنرال (بدون پروژه) (${genCount})`
                : `🌐 General Chat (No Project) (${genCount})`;
            keyboard.text(genLabel, `spf:${genKey.slice(0, 45)}`).row();
        }

        for (const [pName, count] of projectMap.entries()) {
            if (pName === genKey) continue;
            const label = pName.length > 34 ? pName.substring(0, 31) + '...' : pName;
            keyboard.text(`📁 ${label} (${count})`, `spf:${pName.slice(0, 45)}`).row();
        }

        const titleText = isFa
            ? '📁 <b>انتخاب پروژه برای مشاهده چت‌ها:</b>\nپروژه مورد نظر خود را انتخاب کنید تا گفتگوهای آن نمایش داده شود:'
            : '📁 <b>Select Project to View Chats:</b>\nSelect a project to view its conversations:';

        if (isEdit && ctx.callbackQuery) {
            await ctx.editMessageText(titleText, {
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });
            await ctx.answerCallbackQuery().catch(() => {});
        } else {
            await replyHtml(ctx, titleText, keyboard);
        }
    };

    // Helper: Render full interactive help message
    const renderHelpMessage = (userId: string) => {
        const isFa = getUserLang(userId) === 'fa';

        const kb = new InlineKeyboard()
            .text(isFa ? '📁 انتخاب پروژه' : '📁 Select Project', 'menu_projects')
            .text(isFa ? '📸 اسکرین‌شات' : '📸 Screenshot', 'menu_screenshot').row()
            .text(isFa ? '🌐 تغییر زبان (Language)' : '🌐 Language', 'menu_lang');

        const textFa = `\u200F📖 <b>راهنمای کامل ربات تلگرام TelGravity (Telegram Remote Controller for Antigravity)</b>\n\n` +
            `\u200F🎯 <b>درباره این سیستم:</b>\n` +
            `\u200Fاین ربات یک رابط امن، هوشمند و زنده برای هدایت دستیار <b>آنتی‌گرویتی</b> است تا بتوانید پروژه‌های خود را از راه دور کنترل و مدیریت کنید.\n\n` +
            `\u200F⚡️ <b>فهرست دستورات ربات:</b>\n` +
            `\u200F• دستور /start : باز کردن منوی اصلی و مشاهده وضعیت سیستم\n` +
            `\u200F• دستور /help : نمایش متن راهنما و فهرست کامل فرامین\n` +
            `\u200F• دستور /new : باز کردن یک گفتگوی تازه در برنامه\n` +
            `\u200F• دستور /project : فهرست پروژه‌ها و جابجایی بین گفتگوها\n` +
            `\u200F• دستور /status : بررسی وضعیت تسک‌های در حال اجرا و پورت اتصال\n` +
            `\u200F• دستور /stop : توقف فوری و لغو پردازش‌های معلق یا گیرکرده\n` +
            `\u200F• دستور /screenshot : تصویربرداری زنده و باکیفیت از پنجره برنامه\n` +
            `\u200F• دستور /last : بازخوانی آخرین خروجی ثبت‌شده دستیار\n` +
            `\u200F• دستور /lang : تغییر زبان کاری ربات بین فارسی و انگلیسی\n` +
            `\u200F• دستور /ping : سنجش زمان تاخیر و سرعت ارتباط با سرور\n\n` +
            `\u200F🚀 <b>روش‌های تعامل و ارسال فایل:</b>\n` +
            `\u200F• پیام متنی: پیام شما مستقیم در پنجره برنامه درج شده و پس از اتمام پردازش، نتیجه کامل ارسال می‌شود.\n` +
            `\u200F• پیام صوتی: با ضبط صدا صحبت کنید تا به طور خودکار دریافت و اجرا شود.\n` +
            `\u200F• ارسال تصویر: تصاویر کد یا طراحی را همراه با توضیحات بفرستید تا بررسی شوند.\n` +
            `\u200F• آرشیو فایل‌ها: تمامی فایل‌های ارسالی و دریافتی در پوشه آرشیو پروژه در کامپیوتر ذخیره می‌گردند.`;

        const textEn = `📖 <b>TelGravity (Telegram Remote Controller for Antigravity) — Complete User Guide</b>\n\n` +
            `🎯 <b>Overview:</b>\n` +
            `This bot serves as a secure, real-time remote bridge for your <b>Google Antigravity</b> coding workspace, letting you control projects and monitor runs from anywhere via Telegram.\n\n` +
            `⚡️ <b>Commands Reference:</b>\n` +
            `• <code>/start</code> : Open the main control panel & status menu\n` +
            `• <code>/help</code> : Display this complete reference guide\n` +
            `• <code>/new</code> : Start a fresh conversation in Antigravity\n` +
            `• <code>/project</code> : Browse & switch projects and conversations\n` +
            `• <code>/status</code> : Check active background tasks, lingering runs & port\n` +
            `• <code>/stop</code> : Instantly abort running or stuck AI tasks\n` +
            `• <code>/screenshot</code> : Capture a crystal-clear screenshot of Antigravity\n` +
            `• <code>/last</code> : Retrieve the latest completed assistant response\n` +
            `• <code>/lang</code> : Switch bot language (English / Persian)\n` +
            `• <code>/ping</code> : Test connection latency and response time\n\n` +
            `🚀 <b>Interactive Capabilities:</b>\n` +
            `• <b>Text Messages:</b> Send instructions directly to the Antigravity prompt; output is delivered upon completion.\n` +
            `• <b>Voice Notes:</b> Send voice messages to prompt the assistant naturally.\n` +
            `• <b>Photos & Diagrams:</b> Send screenshots or diagrams with optional captions.\n` +
            `• <b>File Archiving:</b> All exchanged media is preserved in <code>Archie file Send&Receive</code>.`;

        return { text: isFa ? textFa : textEn, keyboard: kb };
    };

    // /help and /guide command
    bot.command(['help', 'guide'], async (ctx) => {
        const userId = String(ctx.from?.id ?? '');
        const res = renderHelpMessage(userId);
        await replyHtml(ctx, res.text, res.keyboard);
    });

    // /lang command
    bot.command('lang', async (ctx) => {
        const keyboard = new InlineKeyboard()
            .text('🇮🇷 فارسی (Persian)', 'set_lang_fa')
            .text('🇬🇧 English', 'set_lang_en');
        await ctx.reply('🌐 لطفاً زبان را انتخاب کنید / Choose language:', { reply_markup: keyboard });
    });

    // /screenshot command
    bot.command('screenshot', async (ctx) => {
        const lang = getUserLang(ctx.from?.id);
        const waitMsg = await ctx.reply(lang === 'fa' ? '📸 در حال تهیه اسکرین‌شات از آنتی‌گرویتی...' : '📸 Capturing Antigravity screenshot...');
        await handleScreenshot(
            async (photo, caption) => {
                await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});
                await ctx.replyWithPhoto(photo, { caption, parse_mode: 'HTML' });
            },
            async (txt) => {
                await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, txt);
            },
            null,
            lang === 'fa',
        );
    });

    // Helper: Ask user where the new conversation should be created (Project or General)
    const promptNewChatDestination = async (ctx: Context, isEdit: boolean = false) => {
        const userId = String(ctx.from?.id ?? '');
        const lang = getUserLang(userId);
        const isFa = lang === 'fa';

        const grouped = await AntigravityNativeService.getGroupedSessions();

        const projectMap = new Map<string, number>();
        for (const [pName, sessions] of Object.entries(grouped)) {
            if (
                !pName.includes('عمومی') && 
                !pName.toLowerCase().includes('general') && 
                !pName.includes('بدون پروژه') &&
                sessions && sessions.length > 0
            ) {
                projectMap.set(pName, sessions.length);
            }
        }

        const keyboard = new InlineKeyboard();
        // Option 1: General / No project
        keyboard.text(
            isFa ? '🌐 گفتگوی عمومی / جنرال (بدون پروژه)' : '🌐 General Chat (No Project)', 
            'newchat_to:__general__'
        ).row();

        // Existing projects (only those with at least 1 chat)
        for (const [pName, count] of projectMap.entries()) {
            if (count <= 0) continue;
            const label = pName.length > 32 ? pName.substring(0, 29) + '...' : pName;
            keyboard.text(`📁 ${label} (${count})`, `newchat_to:${pName.slice(0, 45)}`).row();
        }

        // Cancel button
        keyboard.text(isFa ? '❌ لغو' : '❌ Cancel', 'cancel_new_chat');

        const titleText = isFa
            ? `\u200F✨ <b>انتخاب محل ساخت گفتگوی جدید:</b>\n\n` +
              `\u200Fلطفاً مشخص فرمایید چت جدید در کدام پروژه یا به عنوان گفتگوی عمومی (بدون پروژه) ایجاد شود:`
            : `✨ <b>New Conversation Destination:</b>\n\n` +
              `Where should the new chat be created? Select a project or choose General (No Project):`;

        if (isEdit && ctx.callbackQuery) {
            await ctx.editMessageText(titleText, {
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });
            await ctx.answerCallbackQuery().catch(() => {});
        } else {
            await replyHtml(ctx, titleText, keyboard);
        }
    };

    // /new and /newchat command: Prompt for conversation destination
    bot.command(['new', 'newchat'], async (ctx) => {
        await promptNewChatDestination(ctx, false);
    });

    // Unified /projects command (with aliases: project, chats, chat)
    bot.command(['projects', 'project', 'chats', 'chat'], async (ctx) => {
        await sendProjectsList(ctx, false);
    });

    // Helper: Render full system and task running status
    const renderTaskStatus = async (userId: string) => {
        const isFa = getUserLang(userId) === 'fa';
        const detectedProj = await AntigravityNativeService.getActiveProjectName();
        const p = userSelectedProject.get(userId) || detectedProj;
        const activeConvoId = await AntigravityNativeService.getActiveConversationId();
        const convoTitle = userActiveConvoTitle.get(userId) || (isFa ? 'گفتگوی فعال' : 'Active Conversation');
        const port = AntigravityNativeService.getActiveCdpPort();

        const state = await AntigravityNativeService.getTaskRunningState();

        let statusText = '';
        const kb = new InlineKeyboard();

        if (state.isRunning) {
            const taskMsg = state.taskPillFound 
                ? (isFa ? `🔴 <b>تسک در حال اجرا در انتهای پیام:</b> <code>${state.taskCount} تسک فعال</code>` : `🔴 <b>Running task detected:</b> <code>${state.taskCount} active task(s)</code>`)
                : (state.hasCancelButton 
                    ? (isFa ? `🟡 <b>هوش مصنوعی در حال پردازش یا پاسخ‌دهی است...</b>` : `🟡 <b>AI model is processing or generating response...</b>`)
                    : (isFa ? `🔴 <b>${state.stopBtnsCount} تسک در حال اجرا در پس‌زمینه</b>` : `🔴 <b>${state.stopBtnsCount} background task(s) running</b>`));

            const isGeneral = p.includes('عمومی') || p.toLowerCase().includes('general');
            const locTextFa = isGeneral 
                ? `\u200F📍 موقعیت مکانی حال حاضر شما: در حالت عمومی (بدون پروژه)`
                : `\u200F📍 موقعیت مکانی حال حاضر شما در پروژه «${escapeHtml(p)}» است.`;
            const locTextEn = isGeneral
                ? `📍 Your current active location: General (No Project)`
                : `📍 Your current active location is in project "${escapeHtml(p)}".`;

            statusText = isFa
                ? `\u200F⚠️ <b>پردازش تسک قبلی هنوز کامل پایان نیافته است!</b>\n\n` +
                  `\u200F${taskMsg}\n` +
                  `${locTextFa}\n` +
                  `\u200F💬 گفتگوی فعال: <code>${escapeHtml(convoTitle)}</code>\n` +
                  `\u200F🆔 پورت ارتباطی: <code>${port}</code>\n\n` +
                  `\u200F💡 <i>اگر پاسخ متنی ربات آمده ولی ران تسک در انتهای پیام برنامه باقی مانده، می‌توانید با دکمه زیر فوراً آن را متوقف و لغو کنید:</i>`
                : `⚠️ <b>Previous task is not fully finished!</b>\n\n` +
                  `${taskMsg}\n` +
                  `${locTextEn}\n` +
                  `💬 Active Chat: <code>${escapeHtml(convoTitle)}</code>\n` +
                  `🆔 CDP Port: <code>${port}</code>\n\n` +
                  `💡 <i>Click below to stop the lingering task:</i>`;

            kb.text(isFa ? '⏹ لغو و بستن ران تسک آخر پیام' : '⏹ Stop Stuck Task', 'stop_task').row();
            kb.text(isFa ? '🔄 بررسی مجدد وضعیت' : '🔄 Refresh Status', 'check_task_status');
        } else {
            const isGeneral = p.includes('عمومی') || p.toLowerCase().includes('general');
            const locTextFa = isGeneral 
                ? `\u200F📍 موقعیت مکانی حال حاضر شما: در حالت عمومی (بدون پروژه)`
                : `\u200F📍 موقعیت مکانی حال حاضر شما در پروژه «${escapeHtml(p)}» است.`;
            const locTextEn = isGeneral
                ? `📍 Your current active location: General (No Project)`
                : `📍 Your current active location is in project "${escapeHtml(p)}".`;

            statusText = isFa
                ? `\u200F✅ <b>پردازش تسک قبلی ۱۰۰٪ به پایان رسیده است!</b>\n\n` +
                  `\u200F🟢 وضعیت سیستم: <b>کاملاً آزاد و آماده پردازش (Idle)</b>\n` +
                  `${locTextFa}\n` +
                  `\u200F💬 گفتگوی متصل: <code>${escapeHtml(convoTitle)}</code>\n` +
                  `\u200F🆔 پورت ارتباطی: <code>${port}</code>\n\n` +
                  `\u200Fهیچ تسک گیرکرده یا معلقی در انتهای پیام وجود ندارد و می‌توانید دستور جدید بفرستید.`
                : `✅ <b>Previous task is 100% completed!</b>\n\n` +
                  `🟢 Antigravity Status: <b>Idle and Ready</b>\n` +
                  `${locTextEn}\n` +
                  `💬 Connected Chat: <code>${escapeHtml(convoTitle)}</code>\n` +
                  `🆔 CDP Port: <code>${port}</code>\n\n` +
                  `No active or stuck tasks. You can send new prompts anytime.`;

            kb.text(isFa ? '🔄 بررسی مجدد' : '🔄 Refresh', 'check_task_status')
              .text(isFa ? '📁 لیست پروژه‌ها' : '📁 Projects', 'menu_projects');
        }

        return { text: statusText, keyboard: kb };
    };

    // /status and /tasks command
    bot.command(['status', 'tasks', 'task'], async (ctx) => {
        const userId = String(ctx.from?.id ?? '');
        const res = await renderTaskStatus(userId);
        await replyHtml(ctx, res.text, res.keyboard);
    });

    // /last command: Fetch latest completed response immediately
    bot.command('last', async (ctx) => {
        const userId = String(ctx.from?.id ?? '');
        const isFa = getUserLang(userId) === 'fa';
        const activeConvoId = await AntigravityNativeService.getActiveConversationId();
        const latest = AntigravityNativeService.getLastCompletedResponse(activeConvoId);

        if (!latest || !latest.content) {
            await ctx.reply(isFa ? '⚠️ هنوز پاسخی در این گفتگو ثبت نشده است.' : '⚠️ No completed response found.');
            return;
        }

        const title = isFa ? '🔔 <b>آخرین پاسخ ثبت‌شده دستیار Antigravity:</b>' : '🔔 <b>Latest Antigravity Assistant Response:</b>';
        await sendChunkedTelegramReply(
            (text, options) => ctx.reply(text, options),
            title,
            latest.content
        );
    });

    // /ping command
    bot.command('ping', async (ctx) => {
        const userId = String(ctx.from?.id ?? '');
        const isFa = getUserLang(userId) === 'fa';
        const start = Date.now();
        const m = await ctx.reply('🏓 Pong!');
        const lat = Date.now() - start;
        const msg = isFa ? `🏓 Pong! تاخیر: <b>${lat}ms</b>` : `🏓 Pong! Latency: <b>${lat}ms</b>`;
        await ctx.api.editMessageText(ctx.chat!.id, m.message_id, msg, { parse_mode: 'HTML' });
    });

    // /stop command: Abort running tasks or prompt execution in Antigravity
    bot.command(['stop', 'abort', 'cancel'], async (ctx) => {
        const userId = String(ctx.from?.id ?? '');
        const lang = getUserLang(userId);
        const isFa = lang === 'fa';

        const waitMsg = await ctx.reply(
            isFa ? '⏳ <b>در حال توقف تسک‌ها و لغو اجرای Antigravity...</b>' : '⏳ <b>Stopping Antigravity tasks...</b>',
            { parse_mode: 'HTML' }
        );

        if (userWatchers.has(userId)) {
            userWatchers.get(userId)!();
            userWatchers.delete(userId);
        }

        const res = await AntigravityNativeService.stopTask();
        const actionDetails = res.actions.length > 0 
            ? (isFa ? `\n📌 <i>اقدامات: ${escapeHtml(res.actions.join(', '))}</i>` : `\n📌 <i>Actions: ${escapeHtml(res.actions.join(', '))}</i>`) 
            : '';

        await ctx.api.editMessageText(
            ctx.chat!.id,
            waitMsg.message_id,
            isFa
                ? `🛑 <b>پردازش و تسک‌های فعال با موفقیت متوقف شدند!</b>\n\nتسک‌های پس‌زمینه و اجرای مدل لغو گردید و صف پیام‌ها پاک شد.${actionDetails}\n\nاکنون می‌توانید پیام یا دستور جدیدی ارسال نمایید.`
                : `🛑 <b>Tasks and execution stopped successfully!</b>\n\nActive tasks and queued messages have been cancelled.${actionDetails}\n\nYou can now send a new command.`,
            { parse_mode: 'HTML' }
        );
    });

    // Callback queries
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        const userId = String(ctx.from?.id ?? '');
        const lang = getUserLang(userId);
        const isFa = lang === 'fa';

        if (data === 'stop_task') {
            await ctx.answerCallbackQuery({ text: isFa ? 'در حال ارسال دستور توقف...' : 'Stopping task...' }).catch(() => {});
            
            if (userWatchers.has(userId)) {
                userWatchers.get(userId)!();
                userWatchers.delete(userId);
            }

            const res = await AntigravityNativeService.stopTask();
            const actionDetails = res.actions.length > 0 
                ? (isFa ? `\n📌 <i>اقدامات: ${escapeHtml(res.actions.join(', '))}</i>` : `\n📌 <i>Actions: ${escapeHtml(res.actions.join(', '))}</i>`) 
                : '';
            const finishKb = new InlineKeyboard()
                .text(isFa ? '📊 بررسی مجدد وضعیت تسک‌ها' : '📊 Check Task Status', 'check_task_status');

            try {
                await ctx.editMessageText(
                    isFa
                        ? `🛑 <b>پردازش و ران تسک‌های فعال متوقف شدند!</b>\n\nتسک‌های پس‌زمینه و ران انتهای پیام لغو گردید و صف پیام‌ها پاک شد.${actionDetails}\n\nاکنون می‌توانید پیام یا دستور جدیدی ارسال فرمایید.`
                        : `🛑 <b>Tasks and execution stopped!</b>\n\nActive tasks have been cancelled.${actionDetails}\n\nYou can now send a new prompt.`,
                    { parse_mode: 'HTML', reply_markup: finishKb }
                );
            } catch {
                await ctx.reply(
                    isFa
                        ? `🛑 <b>پردازش با موفقیت متوقف شد!</b>\n\nاکنون می‌توانید پیام جدید ارسال فرمایید.`
                        : `🛑 <b>Execution stopped!</b>`,
                    { parse_mode: 'HTML', reply_markup: finishKb }
                );
            }
            return;
        }

        if (data === 'check_task_status') {
            await ctx.answerCallbackQuery({ text: isFa ? 'در حال استعلام وضعیت تسک‌ها...' : 'Checking task status...' }).catch(() => {});
            const res = await renderTaskStatus(userId);
            try {
                await ctx.editMessageText(res.text, { parse_mode: 'HTML', reply_markup: res.keyboard });
            } catch {
                await ctx.reply(res.text, { parse_mode: 'HTML', reply_markup: res.keyboard });
            }
            return;
        }

        if (data === 'start_new_chat') {
            await promptNewChatDestination(ctx, true);
            return;
        }

        if (data.startsWith('newchat_to:')) {
            const targetProj = data.replace('newchat_to:', '');
            userActiveConvo.delete(userId);
            userActiveConvoTitle.delete(userId);

            await AntigravityNativeService.startNewConversation(targetProj);

            if (targetProj === '__general__') {
                userSelectedProject.set(userId, isFa ? 'عمومی (بدون پروژه)' : 'General (No Project)');
                userActiveConvoTitle.set(userId, isFa ? 'گفتگوی عمومی' : 'General Chat');
                await ctx.answerCallbackQuery({ text: isFa ? 'گفتگوی عمومی باز شد' : 'General chat opened' }).catch(() => {});
                
                const replyText = isFa
                    ? `\u200F✨ <b>گفتگوی جدید در حالت عمومی (بدون پروژه) با موفقیت ایجاد شد!</b>\n\n` +
                      `\u200F📍 موقعیت مکانی حال حاضر شما: در حالت عمومی (بدون پروژه)\n` +
                      `\u200Fهر پیامی که ارسال فرمایید در این چت عمومی اجرا خواهد شد.`
                    : `✨ <b>New General conversation created (No Project)!</b>\n\n` +
                      `📍 Your current active location: General (No Project)\n` +
                      `Send prompts or voice notes to interact.`;

                try {
                    await ctx.editMessageText(replyText, { parse_mode: 'HTML' });
                } catch {
                    await ctx.reply(replyText, { parse_mode: 'HTML' });
                }
            } else {
                userSelectedProject.set(userId, targetProj);
                userActiveConvoTitle.set(userId, isFa ? `گفتگوی جدید در ${targetProj}` : `New chat in ${targetProj}`);
                await ctx.answerCallbackQuery({ text: isFa ? `پروژه: ${targetProj}` : `Project: ${targetProj}` }).catch(() => {});

                const replyText = isFa
                    ? `\u200F✨ <b>گفتگوی جدید با موفقیت ایجاد شد!</b>\n\n` +
                      `\u200F📍 موقعیت مکانی حال حاضر شما در پروژه «${escapeHtml(targetProj)}» است.\n` +
                      `\u200Fهر پیامی که ارسال فرمایید در این پروژه اجرا خواهد شد.`
                    : `✨ <b>New conversation created successfully!</b>\n\n` +
                      `📍 Your current active location is in project "${escapeHtml(targetProj)}".\n` +
                      `Send prompts or voice notes to interact.`;

                try {
                    await ctx.editMessageText(replyText, { parse_mode: 'HTML' });
                } catch {
                    await ctx.reply(replyText, { parse_mode: 'HTML' });
                }
            }
            return;
        }

        if (data === 'cancel_new_chat') {
            await ctx.answerCallbackQuery({ text: isFa ? 'لغو شد' : 'Cancelled' }).catch(() => {});
            try {
                await ctx.editMessageText(isFa ? '❌ عملیات ساخت گفتگوی جدید لغو شد.' : '❌ New conversation cancelled.');
            } catch {}
            return;
        }

        if (data === 'menu_projects' || data === 'menu_chats' || data === 'show_all_project_chats') {
            await sendProjectsList(ctx, true);
            return;
        }

        if (data === 'menu_screenshot') {
            await ctx.answerCallbackQuery();
            const waitMsg = await ctx.reply(isFa ? '📸 در حال تهیه اسکرین‌شات از آنتی‌گرویتی...' : '📸 Capturing Antigravity screenshot...');
            await handleScreenshot(
                async (photo, caption) => {
                    await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});
                    await ctx.replyWithPhoto(photo, { caption, parse_mode: 'HTML' });
                },
                async (txt) => {
                    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, txt);
                },
                null,
                isFa,
            );
            return;
        }

        if (data === 'menu_help') {
            await ctx.answerCallbackQuery();
            const res = renderHelpMessage(userId);
            await ctx.reply(res.text, { parse_mode: 'HTML', reply_markup: res.keyboard });
            return;
        }

        if (data === 'menu_lang') {
            const keyboard = new InlineKeyboard()
                .text('🇮🇷 فارسی (Persian)', 'set_lang_fa')
                .text('🇬🇧 English', 'set_lang_en');
            await ctx.editMessageText('🌐 زبان را انتخاب کنید / Choose language:', { reply_markup: keyboard });
            await ctx.answerCallbackQuery();
            return;
        }

        if (data === 'set_lang_fa' || data === 'set_lang_en') {
            const chosen = data === 'set_lang_fa' ? 'fa' : 'en';
            setUserLang(userId, chosen);
            await ctx.editMessageText(chosen === 'fa' ? '✅ زبان فارسی انتخاب شد.' : '✅ English selected.');
            await ctx.answerCallbackQuery({ text: 'Saved' });
            return;
        }

        if (data.startsWith('spf:') || data.startsWith(`${PROJECT_SELECT_ID}:`)) {
            const pName = data.startsWith('spf:')
                ? data.replace('spf:', '')
                : data.replace(`${PROJECT_SELECT_ID}:`, '');
            userSelectedProject.set(userId, pName);
            const isGen = pName.includes('عمومی') || pName.toLowerCase().includes('general') || pName.includes('بدون پروژه');
            const alertText = isFa 
                ? (isGen ? 'گفتگوهای عمومی انتخاب شد' : `پروژه انتخاب شد: ${pName}`) 
                : (isGen ? 'General chats selected' : `Selected: ${pName}`);
            await ctx.answerCallbackQuery({ text: alertText }).catch(() => {});
            
            const grouped = await AntigravityNativeService.getGroupedSessions();
            let chats = grouped[pName];
            if (!chats) {
                const keys = Object.keys(grouped);
                const foundKey = keys.find(k => k.startsWith(pName) || k.toLowerCase() === pName.toLowerCase());
                if (foundKey) chats = grouped[foundKey];
            }
            chats = chats || [];

            const keyboard = new InlineKeyboard();
            if (chats.length > 0) {
                for (const s of chats) {
                    const label = s.title.length > 36 ? s.title.substring(0, 33) + '...' : s.title;
                    keyboard.text(`💬 ${label}`, `sc:${s.conversationId}`).row();
                }
            }
            keyboard.text(isFa ? '🔙 بازگشت به لیست پروژه‌ها' : '🔙 Back to Projects', 'show_all_project_chats').row();

            const headerName = isGen 
                ? (isFa ? 'گفتگوهای عمومی (بدون پروژه)' : 'General Chats (No Project)') 
                : (isFa ? `پروژه [${escapeHtml(pName)}]` : `Project [${escapeHtml(pName)}]`);

            const msgText = chats.length > 0
                ? `<b>💬 ${headerName}:</b>\n` + (isFa ? 'برای اتصال و چت، روی هر گفتگو کلیک کنید:' : 'Click a chat to connect:')
                : (isFa
                    ? `در ${headerName} هنوز گفتگویی ثبت نشده است.\nمی‌توانید متنی بفرستید تا گفتگوی جدیدی آغاز شود.`
                    : `No chats found in ${headerName}.`);

            await ctx.editMessageText(msgText, {
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });
            return;
        }

        if (data.startsWith('sc:')) {
            const convoId = data.replace('sc:', '');
            userActiveConvo.set(userId, convoId);

            const grouped = await AntigravityNativeService.getGroupedSessions();
            let title = isFa ? 'گفتگوی انتخابی' : 'Selected Chat';
            let currentProj = userSelectedProject.get(userId) || '';
            for (const [proj, list] of Object.entries(grouped)) {
                const found = list.find(x => x.conversationId === convoId);
                if (found) {
                    title = found.title;
                    if (!currentProj) currentProj = proj;
                    break;
                }
            }
            if (currentProj) userSelectedProject.set(userId, currentProj);
            userActiveConvoTitle.set(userId, title);
            await AntigravityNativeService.switchConversation(convoId);

            const keyboard = new InlineKeyboard()
                .text(isFa ? '📁 بازگشت به لیست پروژه‌ها' : '📁 Back to Projects', 'show_all_project_chats');

            await ctx.editMessageText(isFa
                ? `✅ <b>به گفتگوی «${escapeHtml(title)}» متصل شدید!</b>\n` +
                  `📁 پروژه: <code>${escapeHtml(currentProj)}</code>\n\n` +
                  `از الان هر متن، عکس یا صوتی بفرستید در این گفتگو تحویل داده می‌شود و به محض پایان کار هوش مصنوعی، <b>نتیجه کامل برایتان نوتیف خواهد شد.</b>`
                : `✅ <b>Connected to "${escapeHtml(title)}"!</b>\n` +
                  `📁 Project: <code>${escapeHtml(currentProj)}</code>\n\n` +
                  `Send prompts to interact. Output will be sent once finished.`,
                { parse_mode: 'HTML', reply_markup: keyboard }
            );
            await ctx.answerCallbackQuery({ text: isFa ? 'متصل شدید' : 'Connected' }).catch(() => {});
            return;
        }
    });

    // Helper: Dispatch prompt and setup completion watcher
    const dispatchUserPrompt = async (ctx: Context, promptText: string) => {
        const userId = String(ctx.from?.id ?? '');
        const lang = getUserLang(userId);
        const isFa = lang === 'fa';
        
        logger.info(`[Bot] Incoming prompt from ${userId}: "${promptText.slice(0, 50)}..."`);

        // Prioritize the conversation explicitly chosen by the user in Telegram
        let targetConvoId = userActiveConvo.get(userId) || '';

        if (targetConvoId) {
            // Ensure Antigravity window is focused and switched to the user's chosen conversation
            const activeNow = await AntigravityNativeService.getActiveConversationId();
            if (activeNow !== targetConvoId) {
                logger.info(`[Bot] Active conversation (${activeNow}) != chosen conversation (${targetConvoId}). Switching...`);
                await AntigravityNativeService.switchConversation(targetConvoId);
                await new Promise(r => setTimeout(r, 600));
            }
        }

        // Determine actual active conversation where CDP input typing will physically occur
        const actualActiveConvo = await AntigravityNativeService.getActiveConversationId();
        const deliveryConvoId = actualActiveConvo || targetConvoId;
        if (deliveryConvoId) {
            userActiveConvo.set(userId, deliveryConvoId);
        }
        logger.info(`[Bot] Delivering to conversation: ${deliveryConvoId}`);

        const waitMsg = await ctx.reply(isFa 
            ? '⏳ <b>در حال ارسال به Antigravity...</b>' 
            : '⏳ <b>Dispatching to Antigravity...</b>', 
            { parse_mode: 'HTML' }
        );

        if (userWatchers.has(userId)) {
            userWatchers.get(userId)!();
            userWatchers.delete(userId);
        }

        const unwatch = AntigravityNativeService.watchConversationCompletion(deliveryConvoId, async (fullReply) => {
            try {
                logger.info(`[Bot] Output received for ${userId} (${fullReply.length} chars). Sending...`);
                // Mark step as delivered to prevent duplicate notification from background watcher
                const latest = AntigravityNativeService.getLastCompletedResponse(deliveryConvoId);
                if (latest) {
                    userLastDeliveredStep.set(`${userId}:${deliveryConvoId}`, latest.step);
                }

                const title = isFa ? '🔔 <b>خروجی نهایی دستیار Antigravity:</b>' : '🔔 <b>Antigravity Assistant Output:</b>';
                await sendChunkedTelegramReply(
                    (text, options) => ctx.reply(text, options),
                    title,
                    fullReply
                );
                logger.info(`[Bot] Output delivered successfully to ${userId}`);
            } catch (err) {
                logger.error('[Bot] Failed to send completion message:', err);
            }
        });
        userWatchers.set(userId, unwatch);

        const ok = await AntigravityNativeService.sendPrompt(promptText);
        logger.info(`[Bot] sendPrompt returned: ${ok}`);
        if (ok) {
            const stopKeyboard = new InlineKeyboard()
                .text(isFa ? '⏹ توقف پردازش / لغو تسک' : '⏹ Stop / Abort Task', 'stop_task');

            await ctx.api.editMessageText(
                ctx.chat!.id,
                waitMsg.message_id,
                isFa 
                    ? `🚀 <b>دستور شما با موفقیت ارسال شد!</b>\n\nهوش مصنوعی در حال پردازش است. پس از پایان کار، پاسخ کامل برایتان ارسال خواهد شد.\n\n💡 <i>اگر مدل روی تسک‌ها گیر کرد، می‌توانید با دکمه زیر یا دستور /stop آن را لغو کنید:</i>`
                    : `🚀 <b>Prompt delivered!</b>\nOutput will be sent once finished.\n\n💡 <i>If tasks get stuck, click below or send /stop to abort:</i>`,
                { parse_mode: 'HTML', reply_markup: stopKeyboard }
            );
        } else {
            await ctx.api.editMessageText(
                ctx.chat!.id,
                waitMsg.message_id,
                isFa ? `⚠️ خطا در ارسال به ورودی Antigravity.` : `⚠️ Error sending to Antigravity input.`
            );
        }
    };

    // Text messages
    bot.on('message:text', async (ctx) => {
        const rawText = ctx.message.text.trim();
        const userId = String(ctx.from?.id ?? '');
        const lang = getUserLang(userId);
        const isFa = lang === 'fa';

        if (rawText.startsWith('/')) return;

        await dispatchUserPrompt(ctx, rawText);
    });

    // Photo & Document handler: download image, pdf, or documents and forward prompt with caption
    bot.on(['message:photo', 'message:document'], async (ctx) => {
        const isDoc = !!ctx.message.document;
        let fileId: string | undefined;
        let fileName: string | undefined;
        let category: 'image' | 'pdf' | 'document' = 'image';

        if (isDoc) {
            const doc = ctx.message.document!;
            const mime = doc.mime_type?.toLowerCase() || '';
            const name = doc.file_name?.toLowerCase() || '';
            fileId = doc.file_id;
            fileName = doc.file_name || `doc_${Date.now()}`;

            if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif|svg)$/i.test(name)) {
                category = 'image';
            } else if (mime === 'application/pdf' || name.endsWith('.pdf')) {
                category = 'pdf';
            } else {
                category = 'document';
            }
        } else if (ctx.message.photo) {
            const photos = ctx.message.photo;
            const largest = photos[photos.length - 1];
            fileId = largest.file_id;
            category = 'image';
        }

        if (!fileId) return;

        const caption = ctx.message.caption?.trim() || '';
        const userId = String(ctx.from?.id ?? '');
        const isFa = getUserLang(userId) === 'fa';

        const categoryTitle = isFa 
            ? (category === 'image' ? 'تصویر' : (category === 'pdf' ? 'فایل PDF' : 'فایل سند'))
            : (category === 'image' ? 'photo' : (category === 'pdf' ? 'PDF document' : 'document'));
        const categoryIcon = category === 'image' ? '📸' : (category === 'pdf' ? '📕' : '📄');

        const waitMsg = await ctx.reply(isFa 
            ? (caption 
                ? `⏳ <b>در حال دریافت و ذخیره ${categoryTitle}...</b>\n📝 <b>کپشن:</b> <i>${escapeHtml(caption)}</i>` 
                : `⏳ <b>در حال دریافت و ذخیره ${categoryTitle}...</b>`)
            : (caption
                ? `⏳ <b>Downloading & saving ${categoryTitle}...</b>\n📝 <b>Caption:</b> <i>${escapeHtml(caption)}</i>`
                : `⏳ <b>Downloading & saving ${categoryTitle}...</b>`),
            { parse_mode: 'HTML' }
        );

        try {
            const fileInfo = await bot.api.getFile(fileId);
            const token = config.telegramBotToken;
            const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;

            let targetDir = getReceivedImagesDir();
            if (category === 'pdf') {
                targetDir = getReceivedPdfDir();
            } else if (category === 'document') {
                targetDir = getReceivedDocumentsDir();
            }

            const ext = path.extname(fileInfo.file_path || fileName || '') || (category === 'pdf' ? '.pdf' : '.jpg');
            const safeBaseName = (fileName ? path.basename(fileName, ext) : `${category}_${Date.now()}`)
                .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
            const localFileName = `${safeBaseName}_${Date.now()}${ext}`;
            const localFilePath = path.join(targetDir, localFileName);

            const res = await fetch(fileUrl);
            const arrayBuffer = await res.arrayBuffer();
            fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));

            let promptText = '';
            if (caption) {
                promptText = `${caption}\n\n${categoryIcon} [فایل ${categoryTitle} ارسال‌شده روی کامپیوتر]: ${localFilePath}\n(لطفاً فایل را باز کرده، بررسی نموده و بر اساس توضیحات کاربر اقدام نمایید.)`;
            } else {
                promptText = `${categoryIcon} [کاربر یک ${categoryTitle} از تلگرام ارسال کرده است]\nمسیر فایل روی کامپیوتر: ${localFilePath}\n\nلطفاً فایل را باز کرده، بررسی نموده و پاسخ لازم را ارائه فرمایید.`;
            }

            await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});
            await dispatchUserPrompt(ctx, promptText);
        } catch (e: any) {
            await ctx.api.editMessageText(
                ctx.chat!.id, 
                waitMsg.message_id, 
                isFa ? `❌ خطا در ذخیره و پردازش فایل: ${e.message}` : `❌ Error saving & processing file: ${e.message}`
            );
        }
    });

    // Voice handler: download audio and forward prompt
    bot.on('message:voice', async (ctx) => {
        const voice = ctx.message.voice;
        const userId = String(ctx.from?.id ?? '');
        const isFa = getUserLang(userId) === 'fa';

        const waitMsg = await ctx.reply(isFa 
            ? '🎙 <b>در حال دریافت و ذخیره پیام صوتی...</b>' 
            : '🎙 <b>Downloading voice note...</b>',
            { parse_mode: 'HTML' }
        );

        try {
            const fileInfo = await bot.api.getFile(voice.file_id);
            const token = config.telegramBotToken;
            const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;

            const voicesDir = getReceivedVoicesDir();
            const localFileName = `voice_${Date.now()}.ogg`;
            const localFilePath = path.join(voicesDir, localFileName);

            const res = await fetch(fileUrl);
            const arrayBuffer = await res.arrayBuffer();
            fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));

            const promptText = `🎙 [کاربر یک پیام صوتی (Voice) از تلگرام ارسال کرده است]\nمسیر فایل صوتی روی کامپیوتر: ${localFilePath}\nمدت زمان صدا: ${voice.duration} ثانیه.\nلطفاً پیام صوتی کاربر را بررسی نموده و اقدام مقتضی را به عمل آورید.`;

            await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});
            await dispatchUserPrompt(ctx, promptText);
        } catch (e: any) {
            await ctx.api.editMessageText(
                ctx.chat!.id, 
                waitMsg.message_id, 
                isFa ? `❌ خطا در پردازش صوت: ${e.message}` : `❌ Error processing voice note: ${e.message}`
            );
        }
    });

    bot.catch((err) => {
        logger.error('Bot Error:', err);
    });

    // Auto-delivery loop: Monitors active conversation transcript and delivers completed turns to Telegram
    const initBaseline = async () => {
        try {
            const convoId = await AntigravityNativeService.getActiveConversationId();
            if (convoId) {
                const last = AntigravityNativeService.getLastCompletedResponse(convoId);
                const currentStep = last ? last.step : 0;
                for (const uid of config.allowedUserIds) {
                    userLastDeliveredStep.set(`${uid}:${convoId}`, currentStep);
                }
                logger.info(`[AutoNotify] Initialized baseline step ${currentStep} for convo ${convoId}`);
            }
        } catch {}
    };
    initBaseline();

    setInterval(async () => {
        try {
            if (config.allowedUserIds.length === 0) return;
            const convoId = await AntigravityNativeService.getActiveConversationId();
            if (!convoId) return;

            const latest = AntigravityNativeService.getLastCompletedResponse(convoId);
            if (!latest) return;

            for (const uid of config.allowedUserIds) {
                const stepKey = `${uid}:${convoId}`;
                const lastStep = userLastDeliveredStep.get(stepKey);
                if (lastStep !== undefined && latest.step > lastStep) {
                    userLastDeliveredStep.set(stepKey, latest.step);
                    logger.info(`[AutoNotify] Delivering completed turn (step ${latest.step}) to user ${uid}`);

                    const isFa = getUserLang(uid) === 'fa';
                    const title = isFa ? '🔔 <b>خروجی دستیار Antigravity:</b>' : '🔔 <b>Antigravity Assistant Output:</b>';
                    await sendChunkedTelegramReply(
                        (text, options) => bot.api.sendMessage(uid, text, options),
                        title,
                        latest.content
                    );
                } else if (lastStep === undefined) {
                    userLastDeliveredStep.set(stepKey, latest.step);
                }
            }
        } catch (err) {
            logger.debug('[AutoNotify] Background poll error:', err);
        }
    }, 2000);

    await bot.start({
        onStart: async (botInfo) => {
            logger.info(`Bot running as @${botInfo.username}`);
            // Default bot commands (English)
            await bot.api.setMyCommands([
                { command: 'start', description: 'Main menu & status' },
                { command: 'help', description: 'User guide & commands reference' },
                { command: 'new', description: 'Start a new chat' },
                { command: 'status', description: 'System status & active tasks' },
                { command: 'stop', description: 'Stop/abort current running task' },
                { command: 'last', description: 'Get last assistant response' },
                { command: 'project', description: 'Select project directory' },
                { command: 'screenshot', description: 'Screenshot of Antigravity' },
                { command: 'lang', description: 'Change language (زبان)' },
                { command: 'ping', description: 'Check bot latency' },
            ]).catch(() => {});

            // Persian bot commands
            await bot.api.setMyCommands([
                { command: 'start', description: 'منوی اصلی و وضعیت' },
                { command: 'help', description: 'راهنمای جامع و دستورات ربات' },
                { command: 'new', description: 'شروع گفتگوی جدید (New Chat)' },
                { command: 'status', description: 'وضعیت سیستم، تسک‌ها و لغو ران معلق' },
                { command: 'stop', description: 'توقف و لغو پردازش یا تسک‌های فعال' },
                { command: 'last', description: 'دریافت آخرین خروجی ثبت‌شده' },
                { command: 'project', description: 'انتخاب پروژه' },
                { command: 'screenshot', description: 'اسکرین‌شات از آنتی‌گرویتی' },
                { command: 'lang', description: 'تغییر زبان (Language)' },
                { command: 'ping', description: 'تست سرعت و تاخیر' },
            ], { language_code: 'fa' }).catch(() => {});
        },
    });
};
