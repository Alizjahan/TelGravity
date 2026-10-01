import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { AntigravityNativeService } from '../services/antigravityNativeService';

process.on('uncaughtException', (err) => {
    console.error('[Dashboard Uncaught Exception]', err);
});
process.on('unhandledRejection', (err) => {
    console.error('[Dashboard Unhandled Rejection]', err);
});

let botProcess: ChildProcess | null = null;
let botLogs: string[] = [];
let detectedBotUsername = 'teeeeeest_aliz_bot';
const MAX_LOGS = 200;

function addLog(msg: string) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    botLogs.push(`[${timestamp}] ${msg}`);
    if (botLogs.length > MAX_LOGS) botLogs.shift();

    // Try to detect bot username from logs
    const match = msg.match(/Bot running as @([a-zA-Z0-9_]+)/i);
    if (match && match[1]) {
        detectedBotUsername = match[1];
    }
}

export function startBotProcess() {
    if (botProcess && !botProcess.killed) return;
    addLog('در حال راه‌اندازی ربات تلگرام...');
    const cliPath = path.resolve(__dirname, 'cli.js');
    botProcess = spawn(process.execPath, [cliPath, 'start'], {
        cwd: process.cwd(),
        env: { ...process.env },
    });

    botProcess.stdout?.on('data', (d) => {
        const text = d.toString().trim();
        if (text) addLog(text);
    });

    botProcess.stderr?.on('data', (d) => {
        const text = d.toString().trim();
        if (text) addLog(`[خطا] ${text}`);
    });

    botProcess.on('exit', (code) => {
        addLog(`ربات متوقف شد (کد خروج: ${code})`);
        botProcess = null;
    });
}

export function stopBotProcess() {
    if (botProcess && !botProcess.killed) {
        botProcess.kill();
        botProcess = null;
        addLog('سرویس ربات توسط کاربر متوقف شد.');
    }
}

const PERSIAN_RTL_SKILL_CONTENT = `---
name: persian-rtl-formatter
description: >-
  Ensures all Persian and mixed Persian-English outputs are strictly formatted for proper RTL (Right-to-Left)
  display in Telegram, chat apps, and markdown readers. Enforces that mixed lines, list items, and bullet points
  always begin with a Persian word or phrasing, preventing awkward LTR left-alignment or misaligned bullets.
---

# Persian RTL Formatter Skill (اسکیل راست‌چین‌سازی خروجی‌های فارسی تلگرام)

این اسکیل تضمین می‌کند که تمامی خروجی‌ها و پاسخ‌های متنی فارسی یا ترکیبی (فارسی + انگلیسی) در تلگرام و تمام محیط‌های راست‌چین (RTL) به صورت کاملاً یکدست، زیبا و راست‌چین نمایش داده شوند.

---

## 🎯 قانون طلایی: شروع تمام خطوط با واژگان فارسی

در موتور پردازش متن تلگرام (الگوریتم دوجهته یونیکد BiDi)، جهت کل سطر و موقعیت بولت‌پوینت (\`• \`) بر اساس **اولین کاراکتر پرقدرت خط** تعیین می‌شود:
- اگر خط یا لیست با کلمه انگلیسی شروع شود (مثل \`• Bold و Italic واقعی\`)، تلگرام جهت آن خط را چپ‌چین (LTR) در نظر گرفته و علامت بولت را در سمت چپ قرار می‌دهد که ظاهر متن را ناهماهنگ و زشت می‌کند.
- اگر خط یا لیست با کلمه فارسی شروع شود (مثل \`• حالت‌های Bold و Italic واقعی\`)، تلگرام جهت خط را کاملاً راست‌چین (RTL) کرده و علامت بولت در سمت راست قرار می‌گیرد.

---

## ✍️ الگوهای صحیح نگارش در خروجی:

### ۱. تبدیل مستقیم واژگان انگلیسی آغازین:
- ❌ \`• Bold: متن ضخیم\`
- ✅ \`• حالت Bold: متن ضخیم\` یا \`• فرمت Bold: متن ضخیم\`

- ❌ \`• Underline: متن زیرخط‌دار\`
- ✅ \`• ویژگی Underline: متن زیرخط‌دار\`

- ❌ \`• React یک کتابخانه فرانت‌اند است\`
- ✅ \`• فریم‌ورک React یک کتابخانه فرانت‌اند است\`

### ۲. دستورات و ابزارهای فنی:
- ❌ \`• npm install را اجرا کنید\`
- ✅ \`• دستور npm install را اجرا کنید\`

- ❌ \`• API Key را از بات‌فادر دریافت نمایید\`
- ✅ \`• کلید API Key را از بات‌فادر دریافت نمایید\`

- ❌ \`• Dockerfile را بسازید\`
- ✅ \`• فایل Dockerfile را بسازید\`

### ۳. اصطلاحات اختصاری:
- ❌ \`• HTML برای ساختار صفحات وب استفاده می‌شود\`
- ✅ \`• زبان HTML برای ساختار صفحات وب استفاده می‌شود\`

### ۴. قرار دادن معادل انگلیسی در پرانتز (بهترین ساختار):
- ❌ \`• Strikethrough (خط‌خورده) و Underline (زیرخط)\`
- ✅ \`• خط‌خورده (Strikethrough) و زیرخط‌دار (Underline)\`
`;

export function installPersianRtlSkill(): { success: boolean; path?: string; error?: string } {
    try {
        const userHome = process.env.USERPROFILE || process.env.HOME || '';
        const targetGlobalDir = path.join(userHome, '.gemini', 'config', 'skills', 'persian-rtl-formatter');
        fs.mkdirSync(targetGlobalDir, { recursive: true });
        fs.writeFileSync(path.join(targetGlobalDir, 'SKILL.md'), PERSIAN_RTL_SKILL_CONTENT, 'utf8');

        const targetLocalDir = path.join(process.cwd(), 'skills', 'persian-rtl-formatter');
        fs.mkdirSync(targetLocalDir, { recursive: true });
        fs.writeFileSync(path.join(targetLocalDir, 'SKILL.md'), PERSIAN_RTL_SKILL_CONTENT, 'utf8');

        return { success: true, path: targetGlobalDir };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export function startWebDashboard(port: number = 3888) {
    const server = http.createServer((req, res) => {
        const url = req.url || '/';

        // 1. Serve Kalameh & Fonts from /font directory
        if (url.startsWith('/font/')) {
            const fontName = path.basename(url);
            const fontPath = path.join(process.cwd(), 'font', fontName);
            if (fs.existsSync(fontPath)) {
                const ext = path.extname(fontName).toLowerCase();
                const mimeType = ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : 'font/ttf';
                res.writeHead(200, {
                    'Content-Type': mimeType,
                    'Cache-Control': 'public, max-age=31536000'
                });
                fs.createReadStream(fontPath).pipe(res);
                return;
            }
        }

        // 2. Serve Assets (Images, guides) from /assets directory
        if (url === '/favicon.ico') {
            const icoPath = path.join(process.cwd(), 'assets', 'app.ico');
            if (fs.existsSync(icoPath)) {
                res.writeHead(200, { 'Content-Type': 'image/x-icon' });
                fs.createReadStream(icoPath).pipe(res);
                return;
            }
        }

        if (url.startsWith('/assets/')) {
            const cleanUrl = url.split('?')[0];
            const fileName = path.basename(cleanUrl);
            const filePath = path.join(process.cwd(), 'assets', fileName);
            if (fs.existsSync(filePath)) {
                const ext = path.extname(fileName).toLowerCase();
                const mimeType = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : ext === '.ico' ? 'image/x-icon' : 'application/octet-stream';
                res.writeHead(200, {
                    'Content-Type': mimeType,
                    'Cache-Control': 'public, max-age=86400'
                });
                fs.createReadStream(filePath).pipe(res);
                return;
            }
        }

        // 2. Status API
        if (url === '/api/status') {
            const isRunning = botProcess !== null && !botProcess.killed;
            let currentToken = '';
            let currentWorkspace = process.cwd();
            let allowedUsers = '';
            try {
                const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
                const tokenMatch = envContent.match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
                if (tokenMatch) currentToken = tokenMatch[1].trim();
                const wsMatch = envContent.match(/WORKSPACE_BASE_DIR=([^\r\n]+)/);
                if (wsMatch) currentWorkspace = wsMatch[1].trim();
                const usersMatch = envContent.match(/ALLOWED_USER_IDS=([^\r\n]+)/);
                if (usersMatch) allowedUsers = usersMatch[1].trim();
            } catch {}

            const cdpPort = AntigravityNativeService.getActiveCdpPort();

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ 
                isRunning, 
                logs: botLogs, 
                token: currentToken, 
                workspace: currentWorkspace,
                allowedUsers,
                cdpPort,
                botUsername: detectedBotUsername
            }));
            return;
        }

        // 3. Start Bot API
        if (url === '/api/start' && req.method === 'POST') {
            startBotProcess();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 4. Stop Bot API
        if (url === '/api/stop' && req.method === 'POST') {
            stopBotProcess();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 5. Restart Bot API
        if (url === '/api/restart' && req.method === 'POST') {
            stopBotProcess();
            setTimeout(() => startBotProcess(), 800);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 6. Clear Logs API
        if (url === '/api/clear-logs' && req.method === 'POST') {
            botLogs = [];
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // Abort Antigravity Task API
        if (url === '/api/abort-task' && req.method === 'POST') {
            AntigravityNativeService.stopTask().then(result => {
                const actStr = result.actions.length > 0 ? result.actions.join(', ') : 'سیگنال توقف ارسال شد';
                addLog(`دستور توقف تسک‌های Antigravity ارسال شد: ${actStr}`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, result }));
            }).catch(err => {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            });
            return;
        }

        // 7. Save Config API
        if (url === '/api/save-config' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    const newToken = (parsed.token || '').trim();
                    const newWorkspace = (parsed.workspace || '').trim();
                    const newAllowedUsers = (parsed.allowedUsers || '').trim();

                    if (!newToken) {
                        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ ok: false, error: 'توکن نمی‌تواند خالی باشد.' }));
                        return;
                    }

                    const envPath = path.join(process.cwd(), '.env');
                    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

                    if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
                        envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=[^\r\n]*/, `TELEGRAM_BOT_TOKEN=${newToken}`);
                    } else {
                        envContent = `TELEGRAM_BOT_TOKEN=${newToken}\n` + envContent;
                    }

                    if (newWorkspace) {
                        if (envContent.includes('WORKSPACE_BASE_DIR=')) {
                            envContent = envContent.replace(/WORKSPACE_BASE_DIR=[^\r\n]*/, `WORKSPACE_BASE_DIR=${newWorkspace}`);
                        } else {
                            envContent += `\nWORKSPACE_BASE_DIR=${newWorkspace}`;
                        }
                    }

                    if (newAllowedUsers) {
                        if (envContent.includes('ALLOWED_USER_IDS=')) {
                            envContent = envContent.replace(/ALLOWED_USER_IDS=[^\r\n]*/, `ALLOWED_USER_IDS=${newAllowedUsers}`);
                        } else {
                            envContent += `\nALLOWED_USER_IDS=${newAllowedUsers}`;
                        }
                    }

                    fs.writeFileSync(envPath, envContent, 'utf8');
                    addLog(`تنظیمات ذخیره شد. راه‌اندازی مجدد ربات...`);

                    stopBotProcess();
                    setTimeout(() => startBotProcess(), 1000);

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (e: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ ok: false, error: e.message }));
                }
            });
            return;
        }

        // 8. Install Dependencies API
        if (url === '/api/install-deps' && req.method === 'POST') {
            addLog('شروع فرآیند نصب پیش‌نیازها و کامپایل...');
            // Automatically install Persian RTL skill by default
            const rSkill = installPersianRtlSkill();
            if (rSkill.success) {
                addLog('[مهارت] اسکیل راست‌چین تلگرام (persian-rtl-formatter) به صورت پیش‌فرض در Antigravity نصب شد.');
            }
            const installProc = spawn('npm.cmd', ['install'], { cwd: process.cwd(), shell: true });
            installProc.on('error', (err) => addLog(`[خطا] خطا در اجرای npm install: ${err.message}`));
            installProc.stdout?.on('data', d => addLog(`[نصب] ${d.toString().trim()}`));
            installProc.stderr?.on('data', d => addLog(`[نصب] ${d.toString().trim()}`));
            installProc.on('exit', (code) => {
                if (code === 0) {
                    addLog('[موفق] نصب کتابخانه‌ها پایان یافت. در حال ساخت dist...');
                    const buildProc = spawn('npm.cmd', ['run', 'build'], { cwd: process.cwd(), shell: true });
                    buildProc.on('error', (err) => addLog(`[خطا] خطا در کامپایل کدها: ${err.message}`));
                    buildProc.on('exit', (bCode) => {
                        if (bCode === 0) {
                            addLog('[پایان] تمام پیش‌نیازها و کدهای پروژه با موفقیت کامپایل شدند!');
                        } else {
                            addLog(`[خطا] خطا در کامپایل کدها (کد ${bCode})`);
                        }
                    });
                } else {
                    addLog(`[خطا] خطا در اجرای npm install (کد ${code})`);
                }
            });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 9. Install Persian RTL Skill API
        if (url === '/api/install-rtl-skill' && req.method === 'POST') {
            const resSkill = installPersianRtlSkill();
            if (resSkill.success) {
                addLog(`[مهارت] اسکیل راست‌چین تلگرام (persian-rtl-formatter) با موفقیت نصب شد:\n${resSkill.path}`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, path: resSkill.path }));
            } else {
                addLog(`[خطا] خطا در نصب اسکیل: ${resSkill.error}`);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: resSkill.error }));
            }
            return;
        }

        const I18N_DATA = {
            fa: {
                brandSubtitle: 'کنترل و مانیتورینگ هوشمند دستیار Antigravity از طریق تلگرام',
                guideTopBtn: 'راهنمای راه‌اندازی',
                statusChecking: 'در حال بررسی...',
                statusOnline: 'آنلاین و آماده دریافت',
                statusOffline: 'سرویس متوقف است',
                metricStatusLabel: 'وضعیت سرویس',
                metricStatusWaiting: 'در انتظار',
                metricRunning: 'در حال اجرا',
                metricStopped: 'متوقف',
                metricBotLabel: 'ربات متصل',
                metricWorkspaceLabel: 'شناسایی پروژه‌ها',
                metricWorkspaceVal: 'خودکار (Native)',
                metricPortLabel: 'پورت CDP',
                quickControlsTitle: 'کنترل سریع و عملیات',
                prerequisitesTitle: 'نصب پیش‌نیازها',
                btnPrereq1: 'پیش‌نیاز اول: npm install',
                btnPrereq2: 'پیش‌نیاز دوم: اسکیل راست‌چین پیام‌های ارسالی توسط تلگرام',
                btnStart: 'شروع سرویس ربات',
                btnStop: 'خاموش کردن ربات تلگرام',
                btnRestart: 'راه‌اندازی مجدد ربات',
                btnAbort: 'توقف پردازش / تسک Antigravity',
                btnTelegram: 'باز کردن چت در تلگرام',
                btnInstall: 'نصب پیش‌نیازها (npm install)',
                btnInstallSkill: 'نصب اسکیل راست‌چین تلگرام',
                settingsTitle: 'تنظیمات و احراز هویت',
                btnSave: 'ذخیره تغییرات',
                labelToken: 'توکن ربات تلگرام (Telegram Bot Token)',
                hintToken: 'از <span class="bidi-ltr">@BotFather</span>',
                placeholderToken: '123456789:ABCdefGhIJKlmNoPQRstuVWXyz...',
                labelAllowedUsers: 'شناسه عددی کاربر تلگرام مجاز (ALLOWED_USER_IDS)',
                hintAllowedUsers: 'از <span class="bidi-ltr">@userinfobot</span>',
                placeholderAllowedUsers: '999999999',
                labelWorkspace: 'پوشه پایه پروژه‌ها (WORKSPACE_BASE_DIR)',
                placeholderWorkspace: 'd:\\UNI-c\\MyProject',
                terminalTitle: 'Console Output — Antigravity Runtime',
                btnCopyLogs: 'کپی لاگ',
                btnClearLogs: 'پاک‌کردن',
                logsLoading: 'در حال بارگذاری لاگ‌ها...',
                modalTitle: 'راهنمای راه‌اندازی و مدیریت ربات تلگرام',
                modalSubtitle: 'اتصال سریع، هوشمند و کاملاً امن به دستیار Antigravity در ۵ مرحله ساده و آرشیو فایل‌ها',
                modalCloseTitle: 'بستن (Esc)',
                step0Badge: '۰',
                step0Title: 'مرحله صفرم: نصب پیش‌نیازهای اولیه سیستم (Prerequisites)',
                step0Body: `<p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.8; margin-bottom: 12px;">پیش از اتصال و راه‌اندازی ربات، حتماً دو پیش‌نیاز زیر را یک‌بار راه‌اندازی و نصب نمایید:</p>
<div style="display: flex; flex-direction: column; gap: 12px;">
    <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(244, 63, 94, 0.3); padding: 12px 16px; border-radius: 10px;">
        <div style="font-weight: 700; color: #f43f5e; font-size: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            <span>پیش‌نیاز اول: نصب پکیج‌ها و کتابخانه‌ها (Dependencies)</span>
        </div>
        <div style="font-size: 13px; color: #94a3b8; line-height: 1.7; margin-bottom: 8px;">نصب تمام وابستگی‌های سیستمی و کامپایل پروژه TypeScript با دستور <code>npm install</code>.</div>
        <button class="btn btn-prereq-1" style="padding: 6px 14px; font-size: 12.5px;" onclick="installDeps()">
            <svg class="btn-svg" viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            <span>اجرای نصب پیش‌نیاز اول (npm install)</span>
        </button>
    </div>
    <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(168, 85, 247, 0.3); padding: 12px 16px; border-radius: 10px;">
        <div style="font-weight: 700; color: #c084fc; font-size: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>پیش‌نیاز دوم: اسکیل راست‌چین پیام‌های تلگرام (Persian RTL Skill)</span>
        </div>
        <div style="font-size: 13px; color: #94a3b8; line-height: 1.7; margin-bottom: 8px;">ثبت اسکیل <code>persian-rtl-formatter</code> در Antigravity تا پیام‌ها و لیست‌های فارسی و دوزبانه در تلگرام کاملاً راست‌چین و منظم بمانند.</div>
        <button class="btn btn-prereq-2" style="padding: 6px 14px; font-size: 12.5px;" onclick="installRtlSkill()">
            <svg class="btn-svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>اجرای نصب پیش‌نیاز دوم (نصب اسکیل)</span>
        </button>
        <div style="margin-top: 12px; background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.35); padding: 10px 14px; border-radius: 8px;">
            <div style="font-weight: 700; color: #38bdf8; font-size: 12.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <svg class="step-subcard-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.7 3.5 6h7c2-1.3 3.5-3.5 3.5-6a7 7 0 0 0-7-7z"/></svg>
                <span>اگر حوصله دانلود و نصب اسکیل رو ندارید:</span>
            </div>
            <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.7; margin-bottom: 8px;">
                کافیه این پرامپت رو همیشه اول چتتون با Antigravity بهش بدین همین و بس!!
            </div>
            <pre class="copy-cmd" title="برای کپی کلیک کنید" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.12); padding: 10px 12px; border-radius: 8px; font-size: 12px; color: #e2e8f0; line-height: 1.7; white-space: pre-wrap; font-family: inherit; cursor: pointer; margin: 0;">قانون راست‌چین تلگرام: در تمامی خروجی‌های فارسی یا دوزبانه، تمام خطوط و بولت‌پوینت‌ها را حتماً با یک واژه یا عبارت فارسی آغاز کن (مثلاً به جای «• Bold: متن» بنویس «• حالت Bold: متن» یا «• ویژگی Bold: متن»). از شروع مستقیم خطوط با کلمات انگلیسی یا پرانتز خودداری کن تا خروجی در تلگرام کاملاً راست‌چین و منظم باشد.</pre>
        </div>
    </div>
</div>`,
                step1Badge: '۱',
                step1Title: 'مرحله اول: دریافت توکن اختصاصی ربات (Bot Token) از BotFather',
                step1Body: `<p>۱. وارد ربات رسمی <a class="step-link bidi-ltr" href="https://t.me/BotFather" target="_blank">@BotFather</a> در تلگرام شوید.</p>
<p>۲. دستور <code class="copy-cmd" title="کلیک برای کپی">/newbot</code> را ارسال کنید.</p>
<p>۳. ابتدا یک نام دلخواه برای ربات (مثلاً <code class="bidi-ltr">Antigravity Remote</code>) و سپس یک یوزرنیم انگلیسی که حتماً به <code class="bidi-ltr">bot</code> ختم شود (مانند <code class="bidi-ltr">my_antigravity_bot</code>) انتخاب کنید.</p>
<p>۴. کدی که شبیه به <code class="bidi-ltr">123456789:ABCdefGhI...</code> به شما داده می‌شود همان <strong>توکن ربات</strong> است. آن را کپی کرده و در فیلد <strong>«توکن ربات تلگرام»</strong> در داشبورد وارد کنید.</p>
<div style="margin-top: 14px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.14); max-width: 480px; box-shadow: 0 8px 25px rgba(0,0,0,0.6);">
    <a href="/assets/botfather-guide-fa.png?v=3" target="_blank" title="مشاهده تصویر بزرگ راهنما">
        <img src="/assets/botfather-guide-fa.png?v=3" alt="راهنمای تصویری دریافت توکن و API Key از BotFather" style="width: 100%; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
    </a>
</div>`,
                step2Badge: '۲',
                step2Title: 'مرحله دوم: دریافت شناسه عددی تلگرام (Allowed User ID)',
                step2Body: `<p>جهت حفظ امنیت کامل سیستم و کدها، ربات فقط به اکانت تلگرام شما پاسخ می‌دهد و بقیه افراد مسدود خواهند بود.</p>
<p>۱. وارد ربات رسمی <a class="step-link bidi-ltr" href="https://t.me/userinfobot" target="_blank">@userinfobot</a> شوید و دکمه Start را بزنید.</p>
<p>۲. عدد چندرقمی روبروی عبارت <strong class="bidi-ltr" style="color: #94a3b8;">Id:</strong> (مثال: <code class="copy-cmd bidi-ltr" title="کلیک برای کپی">999999999</code>) را کپی کرده و در فیلد <strong>«شناسه عددی کاربر تلگرام مجاز»</strong> قرار دهید.</p>
<div style="margin-top: 14px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.14); max-width: 480px; box-shadow: 0 8px 25px rgba(0,0,0,0.6);">
    <a href="/assets/userid-guide-fa.png" target="_blank" title="مشاهده تصویر بزرگ راهنما">
        <img src="/assets/userid-guide-fa.png" alt="راهنمای تصویری دریافت شناسه عددی تلگرام" style="width: 100%; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
    </a>
</div>`,
                step3Badge: '۳',
                step3Title: 'مرحله سوم: کشف خودکار پروژه‌ها و گفتگوها (Auto-Discovery)',
                step3Body: `<p>نیازی به وارد کردن دستی آدرس پوشه پروژه‌ها نیست! ربات به صورت کاملاً خودکار تمامی پروژه‌ها و گفتگوهای فعال شما را مستقیماً از داخل محیط Antigravity شناسایی کرده و در اختیارتان می‌گذارد.</p>`,
                step4Badge: '۴',
                step4Title: 'مرحله چهارم: ذخیره، استارت سرویس و تست در تلگرام',
                step4Body: `<p>۱. روی دکمه سبز <strong>«ذخیره تغییرات»</strong> کلیک کنید.</p>
<p>۲. دکمه آبی <strong>«شروع سرویس ربات»</strong> را بزنید تا وضعیت بالا به <span style="color:#34d399;font-weight:700;">آنلاین و آماده دریافت</span> تبدیل شود.</p>
<p>۳. وارد تلگرام خود شوید و به ربات پیام <code class="copy-cmd" title="کلیک برای کپی">/start</code> را بفرستید!</p>
<div style="margin-top: 12px; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 12px; border-right: 3px solid #38bdf8;">
    <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px;">امکانات و دستورات مهم ربات:</div>
    <ul style="padding-right: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.8;">
        <li><code class="copy-cmd" title="کلیک برای کپی">/start</code> : باز کردن منوی شیشه‌ای کنترل، فهرست پروژه‌ها و گفتگوها</li>
        <li><code class="copy-cmd" title="کلیک برای کپی">/screenshot</code> : دریافت اسکرین‌شات زنده و فوری از صفحه Antigravity</li>
        <li><code class="copy-cmd" title="کلیک برای کپی">/last</code> : بازیابی آخرین پاسخ هوش مصنوعی در صورت قطعی موقت تلگرام</li>
        <li><strong>ارسال ویس (Voice)</strong> : ارسال پیام صوتی برای اجرای مستقیم دستورات با صدا</li>
        <li><strong>ارسال عکس (Photo)</strong> : ارسال تصویر باگ، کد یا طراحی به همراه توضیحات (کپشن)</li>
    </ul>
</div>`,
                step5Badge: '۵',
                step5Title: 'مرحله پنجم: آرشیو و ذخیره‌سازی خودکار فایل‌ها (Archie file Send&Receive)',
                step5Body: `<!-- Section 1 -->
<div style="margin-bottom: 16px; background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
    <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <span>۱. اصلاح نام پوشه‌ها و منطق تفکیک جریان (Send و Receive):</span>
    </div>
    <ul style="padding-right: 20px; font-size: 13.5px; color: #cbd5e1; line-height: 1.9;">
        <li><strong style="color: #67e8f9;">Receive (دریافتی):</strong> فایل‌هایی که کاربر برای ربات / Antigravity می‌فرستد.</li>
        <li><strong style="color: #60a5fa;">Send (ارسالی):</strong> فایل‌هایی که ربات / Antigravity برای کاربر به تلگرام می‌فرستد.</li>
        <li>تمام فایل‌های رد و بدل شده بدون از دست رفتن داده‌ها در این دایرکتوری به صورت خودکار بایگانی می‌شوند.</li>
    </ul>
</div>

<!-- Section 2: Flowchart and Tree -->
<div style="margin-bottom: 16px; background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
    <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>۲. ساختار جدید پوشه‌ها (پوشه‌های Images، PDF، Documents و ...):</span>
    </div>
    <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 12px; line-height: 1.8;">هم در سمت <strong>Receive</strong> و هم در سمت <strong>Send</strong> پوشه‌بندی‌ها به تفکیک دقیق نوع فایل ایجاد و مدیریت می‌شوند:</p>

<div class="archive-flowchart-card">
    <div class="flowchart-header">
        <span class="flowchart-title">
            <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            فلوچارت گردش و تفکیک فایل‌های ورودی و خروجی
        </span>
    </div>

    <!-- Main Hub Parent Banner -->
    <div class="flow-root-banner">
        <div class="flow-root-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>پوشه اصلی ریشه پروژه (Project Root)</span>
        </div>
        <div class="flow-root-title">Archie file Send&Receive/</div>
        <div class="flow-root-desc">تفکیک کامل ورودی‌ها (Receive) و خروجی‌ها (Send) با ذخیره‌سازی خودکار</div>
    </div>

    <!-- Symmetrical 2-Column Grid (Side-by-Side) -->
    <div class="flow-columns-grid">
        <!-- Inbound Card (Receive) -->
        <div class="flow-card flow-in">
            <div class="flow-badge">
                <svg class="flow-badge-svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                دریافتی از کاربر (Receive)
            </div>
            <div class="flow-items">
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <div>
                        <div class="flow-name">Images/</div>
                        <div class="flow-desc">عکس‌ها و اسکرین‌شات‌های ارسالی شما</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#a78bfa"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    <div>
                        <div class="flow-name">Voices/</div>
                        <div class="flow-desc">ویس‌ها و پیام‌های صوتی ضبط‌شده شما</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#f43f5e"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <div>
                        <div class="flow-name">PDF/</div>
                        <div class="flow-desc">کتاب‌ها، مقالات و فایل‌های PDF ارسالی شما</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#34d399"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>
                    <div>
                        <div class="flow-name">Documents/</div>
                        <div class="flow-desc">فایل‌های کد، فایل‌های متنی و اسناد ضمیمه</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Outbound Card (Send) -->
        <div class="flow-card flow-out">
            <div class="flow-badge">
                <svg class="flow-badge-svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                ارسالی به تلگرام (Send)
            </div>
            <div class="flow-items">
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#fbbf24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <div>
                        <div class="flow-name">Screenshots/</div>
                        <div class="flow-desc">اسکرین‌شات‌های زنده ثبت شده از Antigravity</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <div>
                        <div class="flow-name">Images/</div>
                        <div class="flow-desc">تصاویر و چارت‌های تولیدشده توسط دستیار</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#f43f5e"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <div>
                        <div class="flow-name">PDF/</div>
                        <div class="flow-desc">گزارش‌ها و مستندات خروجی PDF</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#34d399"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>
                    <div>
                        <div class="flow-name">Documents/</div>
                        <div class="flow-desc">فایل‌های کد، لاگ‌ها و اسناد تحویلی به تلگرام</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Tree Directory View -->
    <div class="folder-tree-box">
        <div class="tree-title">
            <span style="display: flex; align-items: center; gap: 6px;">
                <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>ساختار درختی پوشه آرشیو (Directory Tree)</span>
            </span>
            <span class="tree-tag">بایگانی هوشمند</span>
        </div>
        <pre class="tree-code"><svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Archie file Send&Receive/
├── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Receive/               <span class="tree-comment"># فایل‌های ارسال‌شده از شما در تلگرام به ربات</span>
│   ├── <svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Images/            <span class="tree-comment"># عکس‌ها، اسکرین‌شات‌ها و تصاویر ارسالی</span>
│   ├── <svg class="tree-svg" stroke="#a78bfa" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Voices/            <span class="tree-comment"># ویس‌ها و پیام‌های صوتی ضبط‌شده شما</span>
│   ├── <svg class="tree-svg" stroke="#f43f5e" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF/               <span class="tree-comment"># کتاب‌ها، مقالات و فایل‌های پی‌دی‌اف</span>
│   └── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg> Documents/         <span class="tree-comment"># فایل‌های کد، اسناد متنی و ضمیمه‌ها</span>
└── <svg class="tree-svg" stroke="#fbbf24" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Send/                  <span class="tree-comment"># فایل‌های ارسال‌شده از ربات به تلگرام</span>
    ├── <svg class="tree-svg" stroke="#fbbf24" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Screenshots/       <span class="tree-comment"># اسکرین‌شات‌های زنده و مستقیم از صفحه</span>
    ├── <svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Images/            <span class="tree-comment"># تصاویر و چارت‌های تولیدشده توسط سیستم</span>
    ├── <svg class="tree-svg" stroke="#f43f5e" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF/               <span class="tree-comment"># گزارش‌ها و مستندات خروجی پی‌دی‌اف</span>
    └── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg> Documents/         <span class="tree-comment"># کدهای نهایی، لاگ‌ها و فایل‌های تحویلی</span></pre>
    </div>
</div>
</div>

<!-- Section 3 -->
<div style="background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
    <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span>۳. ارتقای هوشمند هندلر ربات:</span>
    </div>
    <ul style="padding-right: 20px; font-size: 13.5px; color: #cbd5e1; line-height: 1.9;">
        <li>ربات تلگرام اکنون فایل‌های ورودی را دسته‌بندی و تفکیک می‌کند:</li>
        <li>اگر عکس یا تصویر بفرستید ← در <code>Receive/Images/</code> ذخیره می‌شود.</li>
        <li>اگر فایل پی‌دی‌اف بفرستید ← در <code>Receive/PDF/</code> ذخیره می‌شود.</li>
        <li>اگر فایل متنی، کد، زیپ یا سند بفرستید ← در <code>Receive/Documents/</code> ذخیره می‌شود.</li>
        <li>اگر ویس بفرستید ← در <code>Receive/Voices/</code> ذخیره می‌شود.</li>
    </ul>
</div>`,
                btnGoToSettings: 'رفتن به بخش تنظیمات',
                btnCloseModal: 'بستن راهنما',
                alertTokenMissing: 'لطفاً توکن ربات تلگرام را وارد کنید.',
                alertSaveSuccess: 'تنظیمات با موفقیت ذخیره و ربات ری‌استارت شد.',
                alertSaveError: 'خطا در ذخیره: ',
                confirmStop: 'آیا از خاموش کردن و قطع اتصال ربات تلگرام مطمئن هستید؟',
                confirmAbort: 'آیا از متوقف کردن تسک‌های فعال و لغو اجرای مدل در Antigravity مطمئن هستید؟',
                alertAbortSuccess: 'تسک‌های فعال Antigravity با موفقیت متوقف شدند.',
                alertAbortError: 'خطا: ',
                alertNetworkError: 'خطا در برقراری ارتباط با سرور',
                alertLogsCleared: 'لاگ‌ها پاک شدند.',
                alertLogsCopied: 'لاگ‌ها در کلیپ‌بورد کپی شدند.',
                confirmInstall: 'آیا از نصب پیش‌نیازها و کامپایل اطمینان دارید؟',
                alertInstallStarted: 'فرآیند نصب آغاز شد؛ خروجی را در ترمینال پایین دنبال کنید.',
                alertSkillInstalled: '✅ اسکیل راست‌چین تلگرام (persian-rtl-formatter) با موفقیت در پوشه مهارت‌های Antigravity نصب شد!',
                alertSkillError: 'خطا در نصب اسکیل: '
            },
            en: {
                brandSubtitle: 'Intelligent control & monitoring of Antigravity assistant via Telegram',
                guideTopBtn: 'Setup Guide',
                statusChecking: 'Checking status...',
                statusOnline: 'Online & Ready',
                statusOffline: 'Service Stopped',
                metricStatusLabel: 'Service Status',
                metricStatusWaiting: 'Waiting',
                metricRunning: 'Running',
                metricStopped: 'Stopped',
                metricBotLabel: 'Connected Bot',
                metricWorkspaceLabel: 'Project Discovery',
                metricWorkspaceVal: 'Auto (Native)',
                metricPortLabel: 'CDP Port',
                quickControlsTitle: 'Quick Controls & Operations',
                prerequisitesTitle: 'Install Prerequisites',
                btnPrereq1: 'Prerequisite 1: npm install',
                btnPrereq2: 'Prerequisite 2: Telegram RTL Messages Skill',
                btnStart: 'Start Bot Service',
                btnStop: 'Stop Telegram Bot',
                btnRestart: 'Restart Bot Service',
                btnAbort: 'Abort Antigravity Task / Model',
                btnTelegram: 'Open Chat in Telegram',
                btnInstall: 'Install Dependencies (npm install)',
                btnInstallSkill: 'Install Telegram RTL Skill',
                settingsTitle: 'Settings & Authentication',
                btnSave: 'Save Changes',
                labelToken: 'Telegram Bot Token',
                hintToken: 'from @BotFather',
                placeholderToken: '123456789:ABCdefGhIJKlmNoPQRstuVWXyz...',
                labelAllowedUsers: 'Allowed Telegram User ID (ALLOWED_USER_IDS)',
                hintAllowedUsers: 'from @userinfobot',
                placeholderAllowedUsers: '999999999',
                labelWorkspace: 'Base Workspace Directory (WORKSPACE_BASE_DIR)',
                placeholderWorkspace: 'd:\\UNI-c\\MyProject',
                terminalTitle: 'Console Output — Antigravity Runtime',
                btnCopyLogs: 'Copy Logs',
                btnClearLogs: 'Clear',
                logsLoading: 'Loading logs...',
                modalTitle: 'Setup & Management Guide',
                modalSubtitle: 'Fast, intelligent, and secure connection to Antigravity assistant in 5 simple steps',
                modalCloseTitle: 'Close (Esc)',
                step0Badge: '0',
                step0Title: 'Step 0: Initial System Prerequisites',
                step0Body: `<p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.8; margin-bottom: 12px;">Before connecting and launching the bot, make sure to initialize and install the two essential prerequisites below:</p>
<div style="display: flex; flex-direction: column; gap: 12px;">
    <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(244, 63, 94, 0.3); padding: 12px 16px; border-radius: 10px;">
        <div style="font-weight: 700; color: #f43f5e; font-size: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            <span>Prerequisite 1: Install Packages & Dependencies</span>
        </div>
        <div style="font-size: 13px; color: #94a3b8; line-height: 1.7; margin-bottom: 8px;">Install all project libraries and compile TypeScript using <code>npm install</code>.</div>
        <button class="btn btn-prereq-1" style="padding: 6px 14px; font-size: 12.5px;" onclick="installDeps()">
            <svg class="btn-svg" viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            <span>Run Prerequisite 1 (npm install)</span>
        </button>
    </div>
    <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(168, 85, 247, 0.3); padding: 12px 16px; border-radius: 10px;">
        <div style="font-weight: 700; color: #c084fc; font-size: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>Prerequisite 2: Telegram RTL Formatting Skill</span>
        </div>
        <div style="font-size: 13px; color: #94a3b8; line-height: 1.7; margin-bottom: 8px;">Installs the <code>persian-rtl-formatter</code> skill into Antigravity to maintain clean right-to-left layout for bilingual Telegram messages.</div>
        <button class="btn btn-prereq-2" style="padding: 6px 14px; font-size: 12.5px;" onclick="installRtlSkill()">
            <svg class="btn-svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>Run Prerequisite 2 (Install Skill)</span>
        </button>
        <div style="margin-top: 12px; background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.35); padding: 10px 14px; border-radius: 8px;">
            <div style="font-weight: 700; color: #38bdf8; font-size: 12.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <svg class="step-subcard-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.7 3.5 6h7c2-1.3 3.5-3.5 3.5-6a7 7 0 0 0-7-7z"/></svg>
                <span>Don't want to download or install the skill?</span>
            </div>
            <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.7; margin-bottom: 8px;">
                Simply send this prompt at the beginning of your chat with Antigravity, that's all!!
            </div>
            <pre class="copy-cmd" title="Click to copy" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.12); padding: 10px 12px; border-radius: 8px; font-size: 12px; color: #e2e8f0; line-height: 1.7; white-space: pre-wrap; font-family: inherit; cursor: pointer; margin: 0;">Telegram RTL Rule: In all Persian or bilingual outputs, always start every line and bullet point with a Persian word or phrasing (e.g. instead of '• Bold: text', write '• حالت Bold: text'). Avoid starting lines with English words or parentheses so that Telegram maintains clean RTL alignment.</pre>
        </div>
    </div>
</div>`,
                step1Badge: '1',
                step1Title: 'Step 1: Get Dedicated Bot Token from @BotFather',
                step1Body: `<p>1. Open the official <a class="step-link bidi-ltr" href="https://t.me/BotFather" target="_blank">@BotFather</a> in Telegram.</p>
<p>2. Send the command <code class="copy-cmd" title="Click to copy">/newbot</code>.</p>
<p>3. Choose a friendly display name (e.g. <code class="bidi-ltr">Antigravity Remote</code>) and an English username ending in <code class="bidi-ltr">bot</code> (e.g. <code class="bidi-ltr">my_antigravity_bot</code>).</p>
<p>4. The string given to you like <code class="bidi-ltr">123456789:ABCdefGhI...</code> is your <strong>Bot Token</strong>. Copy it and paste into the <strong>"Telegram Bot Token"</strong> field on the dashboard.</p>
<div style="margin-top: 14px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.14); max-width: 480px; box-shadow: 0 8px 25px rgba(0,0,0,0.6);">
    <a href="/assets/botfather-guide-en.png?v=3" target="_blank" title="View Full Image">
        <img src="/assets/botfather-guide-en.png?v=3" alt="BotFather Step-by-Step API Key Guide" style="width: 100%; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
    </a>
</div>`,
                step2Badge: '2',
                step2Title: 'Step 2: Get Numeric Telegram ID (Allowed User ID)',
                step2Body: `<p>For the complete security of your computer and code, the bot only responds to your verified Telegram account; unauthorized users will be blocked.</p>
<p>1. Open the official <a class="step-link bidi-ltr" href="https://t.me/userinfobot" target="_blank">@userinfobot</a> and click Start.</p>
<p>2. Copy the numeric digits next to <strong class="bidi-ltr" style="color: #94a3b8;">Id:</strong> (e.g. <code class="copy-cmd bidi-ltr" title="Click to copy">999999999</code>) and paste into <strong>"Allowed Telegram User ID"</strong>.</p>
<div style="margin-top: 14px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.14); max-width: 480px; box-shadow: 0 8px 25px rgba(0,0,0,0.6);">
    <a href="/assets/userid-guide-en.jpg" target="_blank" title="View Full Image">
        <img src="/assets/userid-guide-en.jpg" alt="How to Get Your Numeric Telegram User ID" style="width: 100%; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
    </a>
</div>`,
                step3Badge: '3',
                step3Title: 'Step 3: Smart Auto-Discovery of Projects',
                step3Body: `<p>No manual directory configuration needed! The bot automatically discovers all your active projects and conversations directly from the Antigravity runtime environment.</p>`,
                step4Badge: '4',
                step4Title: 'Step 4: Save, Start Service & Test in Telegram',
                step4Body: `<p>1. Click the green <strong>"Save Changes"</strong> button.</p>
<p>2. Click the blue <strong>"Start Bot Service"</strong> button until the status above turns to <span style="color:#34d399;font-weight:700;">Online & Ready</span>.</p>
<p>3. Open Telegram and send <code class="copy-cmd" title="Click to copy">/start</code> to your bot!</p>
<div style="margin-top: 12px; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 12px; border-left: 3px solid #38bdf8;">
    <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px;">Key Bot Features & Commands:</div>
    <ul style="padding-left: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.8;">
        <li><code class="copy-cmd" title="Click to copy">/start</code> : Open interactive control menu, project list, and active chats</li>
        <li><code class="copy-cmd" title="Click to copy">/screenshot</code> : Instant live screenshot capture from Antigravity</li>
        <li><code class="copy-cmd" title="Click to copy">/last</code> : Retrieve last AI response in case of network interruption</li>
        <li><strong>Voice Messages</strong> : Send audio notes to run voice-driven instructions</li>
        <li><strong>Photos & Snaps</strong> : Send bug screenshots, code snaps or diagrams with captions</li>
    </ul>
</div>`,
                step5Badge: '5',
                step5Title: 'Step 5: Automated File Archiving (Archie file Send&Receive)',
                step5Body: `<!-- Section 1 -->
<div style="margin-bottom: 16px; background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
    <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <span>1. Standardized Folder Naming & Flow Logic (Send & Receive):</span>
    </div>
    <ul style="padding-left: 20px; font-size: 13.5px; color: #cbd5e1; line-height: 1.9;">
        <li><strong style="color: #67e8f9;">Receive (Inbound):</strong> Files sent by you to the bot / Antigravity.</li>
        <li><strong style="color: #60a5fa;">Send (Outbound):</strong> Files sent by the bot / Antigravity to you on Telegram.</li>
        <li>All exchanged files are automatically archived without data loss in this directory.</li>
    </ul>
</div>

<!-- Section 2: Flowchart and Tree -->
<div style="margin-bottom: 16px; background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
    <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>2. Organized Folder Structure (Images, PDF, Documents, etc.):</span>
    </div>
    <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 12px; line-height: 1.8;">Both <strong>Receive</strong> and <strong>Send</strong> sides are categorized by specific file types:</p>

<div class="archive-flowchart-card">
    <div class="flowchart-header">
        <span class="flowchart-title">
            <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Inbound & Outbound File Flow & Routing
        </span>
    </div>

    <!-- Main Hub Parent Banner -->
    <div class="flow-root-banner">
        <div class="flow-root-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>Project Root Directory</span>
        </div>
        <div class="flow-root-title">Archie file Send&Receive/</div>
        <div class="flow-root-desc">Full segregation of Inbound (Receive) and Outbound (Send) with automated archiving</div>
    </div>

    <!-- Symmetrical 2-Column Grid (Side-by-Side) -->
    <div class="flow-columns-grid">
        <!-- Inbound Card (Receive) -->
        <div class="flow-card flow-in">
            <div class="flow-badge">
                <svg class="flow-badge-svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Received from User (Receive)
            </div>
            <div class="flow-items">
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <div>
                        <div class="flow-name">Images/</div>
                        <div class="flow-desc">Photos & bug screenshots sent by you</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#a78bfa"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    <div>
                        <div class="flow-name">Voices/</div>
                        <div class="flow-desc">Voice notes & audio recordings</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#f43f5e"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <div>
                        <div class="flow-name">PDF/</div>
                        <div class="flow-desc">E-books, papers & PDF documents</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#34d399"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>
                    <div>
                        <div class="flow-name">Documents/</div>
                        <div class="flow-desc">Code files, texts & attachments</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Outbound Card (Send) -->
        <div class="flow-card flow-out">
            <div class="flow-badge">
                <svg class="flow-badge-svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Sent to Telegram (Send)
            </div>
            <div class="flow-items">
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#fbbf24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <div>
                        <div class="flow-name">Screenshots/</div>
                        <div class="flow-desc">Live screenshots from Antigravity</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <div>
                        <div class="flow-name">Images/</div>
                        <div class="flow-desc">Images & charts generated by AI</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#f43f5e"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <div>
                        <div class="flow-name">PDF/</div>
                        <div class="flow-desc">Generated PDF reports & documents</div>
                    </div>
                </div>
                <div class="flow-node">
                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#34d399"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>
                    <div>
                        <div class="flow-name">Documents/</div>
                        <div class="flow-desc">Code deliverables & text output</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Tree Directory View -->
    <div class="folder-tree-box">
        <div class="tree-title">
            <span style="display: flex; align-items: center; gap: 6px;">
                <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Archive Directory Tree</span>
            </span>
            <span class="tree-tag">Smart Archive</span>
        </div>
        <pre class="tree-code"><svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Archie file Send&Receive/
├── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Receive/               <span class="tree-comment"># Files sent from Telegram to the bot</span>
│   ├── <svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Images/            <span class="tree-comment"># Images, bug screenshots and user photos</span>
│   ├── <svg class="tree-svg" stroke="#a78bfa" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Voices/            <span class="tree-comment"># Voice messages and audio recordings</span>
│   ├── <svg class="tree-svg" stroke="#f43f5e" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF/               <span class="tree-comment"># PDF documents and books sent by user</span>
│   └── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg> Documents/         <span class="tree-comment"># Code files, text files and attachments</span>
└── <svg class="tree-svg" stroke="#fbbf24" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Send/                  <span class="tree-comment"># Files sent from bot/system to Telegram</span>
    ├── <svg class="tree-svg" stroke="#fbbf24" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Screenshots/       <span class="tree-comment"># Live screenshots from Antigravity</span>
    ├── <svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Images/            <span class="tree-comment"># Images and charts generated by AI</span>
    ├── <svg class="tree-svg" stroke="#f43f5e" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF/               <span class="tree-comment"># Exported PDF reports and docs</span>
    └── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg> Documents/         <span class="tree-comment"># Code deliverables, logs and text output</span></pre>
    </div>
</div>
</div>

<!-- Section 3 -->
<div style="background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
    <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span>3. Smart File Router:</span>
    </div>
    <ul style="padding-left: 20px; font-size: 13.5px; color: #cbd5e1; line-height: 1.9;">
        <li>The Telegram bot automatically categorizes inbound files:</li>
        <li>Send photo or screenshot &larr; Saved in <code>Receive/Images/</code></li>
        <li>Send PDF document or book &larr; Saved in <code>Receive/PDF/</code></li>
        <li>Send source code, zip or text &larr; Saved in <code>Receive/Documents/</code></li>
        <li>Send voice message or audio &larr; Saved in <code>Receive/Voices/</code></li>
    </ul>
</div>`,
                btnGoToSettings: 'Go to Settings',
                btnCloseModal: 'Close Guide',
                alertTokenMissing: 'Please enter your Telegram Bot Token.',
                alertSaveSuccess: 'Settings saved successfully. Bot restarted.',
                alertSaveError: 'Error saving: ',
                confirmStop: 'Are you sure you want to stop and disconnect the Telegram bot?',
                confirmAbort: 'Are you sure you want to abort active Antigravity tasks and model execution?',
                alertAbortSuccess: 'Active Antigravity tasks were successfully aborted.',
                alertAbortError: 'Error: ',
                alertNetworkError: 'Server communication error',
                alertLogsCleared: 'Logs cleared.',
                alertLogsCopied: 'Logs copied to clipboard.',
                confirmInstall: 'Are you sure you want to install dependencies and recompile?',
                alertInstallStarted: 'Dependency installation started; track output in the console below.',
                alertSkillInstalled: '✅ Telegram RTL skill (persian-rtl-formatter) was successfully installed in Antigravity skills directory!',
                alertSkillError: 'Error installing skill: '
            }
        };

        // Modern Professional Dashboard HTML
        const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TelGravity (Telegram Remote Controller for Antigravity)</title>
    <link rel="icon" type="image/png" href="/assets/logo.png?v=4">
    <link rel="shortcut icon" href="/assets/app.ico?v=4">
    <style>
        @font-face {
            font-family: 'Kalameh';
            src: url('/font/KalamehWeb-Light.woff') format('woff'),
                 url('/font/Kalameh-Light.ttf') format('truetype');
            font-weight: 300;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'Kalameh';
            src: url('/font/KalamehWeb-Regular.woff') format('woff'),
                 url('/font/Kalameh-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'Kalameh';
            src: url('/font/KalamehWeb-Medium.woff') format('woff'),
                 url('/font/Kalameh-Medium.ttf') format('truetype');
            font-weight: 500;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'Kalameh';
            src: url('/font/KalamehWeb-SemiBold.woff') format('woff'),
                 url('/font/Kalameh-SemiBold.ttf') format('truetype');
            font-weight: 600;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'Kalameh';
            src: url('/font/KalamehWeb-Bold.woff') format('woff'),
                 url('/font/Kalameh-Bold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'Kalameh';
            src: url('/font/KalamehWeb-ExtraBold.woff') format('woff'),
                 url('/font/Kalameh-ExtraBold.ttf') format('truetype');
            font-weight: 800;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'Kalameh';
            src: url('/font/KalamehWeb-Black.woff') format('woff'),
                 url('/font/Kalameh-Black.ttf') format('truetype');
            font-weight: 900;
            font-style: normal;
            font-display: swap;
        }

        :root {
            --bg-base: #090d16;
            --bg-radial: radial-gradient(circle at 50% 0%, #172554 0%, #090d16 70%);
            --card-surface: rgba(15, 23, 42, 0.72);
            --card-surface-hover: rgba(30, 41, 59, 0.82);
            --card-border: rgba(255, 255, 255, 0.08);
            --card-border-glow: rgba(56, 189, 248, 0.25);
            --text-heading: #f8fafc;
            --text-body: #cbd5e1;
            --text-muted: #64748b;
            --accent-cyan: #06b6d4;
            --accent-blue: #3b82f6;
            --accent-emerald: #10b981;
            --accent-rose: #f43f5e;
            --accent-amber: #f59e0b;
        }

        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Kalameh', sans-serif !important;
            -webkit-font-smoothing: antialiased;
        }

        html, body, button, input, optgroup, select, textarea, div, span, p, a, label, h1, h2, h3, h4, h5, h6 {
            font-family: 'Kalameh', sans-serif !important;
        }

        button, input, select, textarea {
            font-family: 'Kalameh', sans-serif !important;
        }

        .terminal-body, .terminal-body *, .tree-code, .tree-code * {
            font-family: 'Consolas', 'Courier New', monospace !important;
        }

        body {
            background-color: var(--bg-base);
            background-image: var(--bg-radial);
            background-attachment: fixed;
            color: var(--text-body);
            min-height: 100vh;
            padding: 32px 20px;
            display: flex;
            justify-content: center;
        }

        .wrapper {
            width: 100%;
            max-width: 960px;
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Top Header */
        .app-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding: 16px 24px;
            background: var(--card-surface);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 20px;
            border: 1px solid var(--card-border);
            box-shadow: 0 12px 35px -10px rgba(0, 0, 0, 0.6);
            gap: 16px;
        }

        .brand-area {
            display: flex;
            align-items: center;
            gap: 14px;
            min-width: 0;
            flex-shrink: 1;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: nowrap;
            flex-shrink: 0;
            white-space: nowrap;
        }

        .brand-icon {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            background: radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.25), rgba(15, 23, 42, 0.9));
            border: 1px solid rgba(56, 189, 248, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 25px rgba(56, 189, 248, 0.35);
            padding: 4px;
            transition: all 0.3s ease;
            overflow: hidden;
            flex-shrink: 0;
        }

        .brand-icon img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.6));
        }

        .brand-icon:hover {
            transform: scale(1.06) rotate(3deg);
            box-shadow: 0 0 32px rgba(56, 189, 248, 0.6);
        }

        .brand-title {
            font-size: 22px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .brand-title .badge-pill {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            background: rgba(56, 189, 248, 0.15);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .brand-subtitle {
            font-size: 12.5px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        /* Top Header Guide & Language Buttons */
        .btn-lang-toggle {
            cursor: pointer;
            border: 1px solid rgba(168, 85, 247, 0.45);
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.2));
            color: #c084fc;
            padding: 7px 14px;
            border-radius: 20px;
            font-size: 12.5px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            flex-shrink: 0;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 0 15px rgba(168, 85, 247, 0.15);
            outline: none;
        }

        .btn-lang-toggle:hover {
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(59, 130, 246, 0.35));
            border-color: rgba(168, 85, 247, 0.85);
            color: #ffffff;
            transform: translateY(-2px);
            box-shadow: 0 0 25px rgba(168, 85, 247, 0.45);
        }

        .btn-guide-top {
            cursor: pointer;
            border: 1px solid rgba(56, 189, 248, 0.45);
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.18), rgba(99, 102, 241, 0.25));
            color: #38bdf8;
            padding: 7px 16px;
            border-radius: 20px;
            font-size: 12.5px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            white-space: nowrap;
            flex-shrink: 0;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.15);
            outline: none;
        }

        .btn-guide-top:hover {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.35), rgba(99, 102, 241, 0.45));
            border-color: rgba(56, 189, 248, 0.8);
            color: #ffffff;
            transform: translateY(-2px);
            box-shadow: 0 0 25px rgba(56, 189, 248, 0.4);
        }

        /* LTR Styles */
        html[dir="ltr"] .modal-close-btn {
            right: auto;
            left: 24px;
        }
        html[dir="ltr"] .modal-step .step-badge {
            margin-right: 14px;
            margin-left: 0;
        }
        html[dir="ltr"] .toggle-visibility {
            right: auto;
            left: 10px;
        }
        html[dir="ltr"] #tokenInput {
            padding-left: 42px;
            padding-right: 16px;
        }
        html[dir="ltr"] .card-header .card-title svg {
            margin-right: 8px;
            margin-left: 0;
        }
        html[dir="ltr"] .flow-arrow {
            transform: scaleX(1);
        }
        html[dir="rtl"] .flow-arrow {
            transform: scaleX(-1);
        }

        /* Hero Setup Banner */
        .setup-hero-banner {
            cursor: pointer;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.88));
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 20px;
            padding: 16px 22px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 25px rgba(56, 189, 248, 0.12);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            overflow: hidden;
        }

        .setup-hero-banner::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, #38bdf8, #818cf8, transparent);
        }

        .setup-hero-banner:hover {
            transform: translateY(-2px);
            border-color: rgba(56, 189, 248, 0.65);
            box-shadow: 0 14px 40px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(56, 189, 248, 0.25);
        }

        .setup-banner-inner {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .setup-icon-wrapper {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .setup-icon-wrapper img {
            width: 34px;
            height: 34px;
            object-fit: contain;
            filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.8));
        }

        .setup-banner-badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            margin-bottom: 4px;
        }

        .setup-banner-title {
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 2px;
        }

        .setup-banner-subtitle {
            font-size: 12.5px;
            color: var(--text-muted);
        }

        .btn-guide-cta {
            background: linear-gradient(135deg, #0284c7, #6366f1);
            color: #ffffff;
            border: none;
            padding: 9px 18px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4);
            transition: all 0.2s;
        }

        .btn-guide-cta:hover {
            transform: scale(1.04);
            box-shadow: 0 6px 20px rgba(2, 132, 199, 0.6);
        }

        /* Modal Styles */
        .modal-backdrop {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 8, 15, 0.84);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-y: auto;
            animation: fadeIn 0.25s ease;
        }

        .modal-backdrop.active {
            display: flex;
        }

        .modal-card {
            background: #0d1322;
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 24px;
            width: 100%;
            max-width: 820px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 26px 28px;
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(56, 189, 248, 0.2);
            position: relative;
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 22px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .modal-title-area {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .modal-title-area img {
            width: 44px;
            height: 44px;
            object-fit: contain;
            filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.7));
        }

        .modal-title {
            font-size: 19px;
            font-weight: 800;
            color: #ffffff;
        }

        .modal-subtitle {
            font-size: 12.5px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .modal-close-btn {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            width: 36px;
            height: 36px;
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            transition: all 0.2s;
        }

        .modal-close-btn:hover {
            background: rgba(244, 63, 94, 0.2);
            color: #fb7185;
            border-color: rgba(244, 63, 94, 0.4);
        }

        .modal-step {
            background: rgba(15, 23, 42, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 16px;
            padding: 18px 20px;
            margin-bottom: 16px;
            transition: border-color 0.2s;
        }

        .modal-step:hover {
            border-color: rgba(56, 189, 248, 0.35);
        }

        .step-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
        }

        .step-badge {
            background: linear-gradient(135deg, #0284c7, #6366f1);
            color: #ffffff;
            font-weight: 800;
            font-size: 13px;
            width: 28px;
            height: 28px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
        }

        .step-title {
            font-size: 15px;
            font-weight: 700;
            color: #f8fafc;
        }

        .step-body {
            font-size: 13px;
            line-height: 1.7;
            color: #cbd5e1;
            padding-right: 40px;
        }

        .step-body code {
            color: #38bdf8;
            background: transparent;
            border: none;
            padding: 0 2px;
            font-family: 'Consolas', monospace;
            font-size: 13.5px;
            font-weight: 700;
            direction: ltr !important;
            unicode-bidi: isolate !important;
            display: inline-block;
            cursor: pointer;
            transition: color 0.15s ease;
            vertical-align: baseline;
            user-select: all;
        }

        .step-body code:hover {
            color: #7dd3fc;
            text-decoration: underline;
        }

        .step-link, .bidi-ltr {
            direction: ltr !important;
            unicode-bidi: isolate !important;
            display: inline-block;
        }

        .step-link {
            color: #38bdf8;
            text-decoration: none;
            font-weight: 600;
            border-bottom: 1px dashed rgba(56, 189, 248, 0.4);
            transition: all 0.2s;
        }

        .step-link:hover {
            color: #7dd3fc;
            border-bottom-style: solid;
        }

        /* Toast notification for copy */
        .copy-toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(30px);
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid #10b981;
            color: #f8fafc;
            padding: 10px 22px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 600;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7), 0 0 20px rgba(16, 185, 129, 0.35);
            z-index: 100000;
            display: flex;
            align-items: center;
            gap: 10px;
            opacity: 0;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: none;
        }

        .copy-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .modal-footer {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }

        /* Status Badge with Live Glow */
        .live-status {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 7px 15px;
            border-radius: 30px;
            font-size: 12.5px;
            font-weight: 700;
            white-space: nowrap;
            flex-shrink: 0;
            transition: all 0.3s;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }

        .live-online {
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
        }

        .live-online .status-dot {
            background: #10b981;
            box-shadow: 0 0 10px #10b981;
            animation: pulse-dot 1.8s infinite;
        }

        .live-offline {
            background: rgba(244, 63, 94, 0.12);
            color: #fb7185;
            border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .live-offline .status-dot {
            background: #f43f5e;
        }

        @keyframes pulse-dot {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }

        /* System Telemetry & Status Ribbon - Clean Informational Display */
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(20, 30, 48, 0.65));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 8px 25px -10px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            cursor: default;
        }

        .metric-card {
            padding: 14px 18px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            position: relative;
            background: transparent;
            border: none;
            box-shadow: none;
            transition: background 0.2s ease;
        }

        .metric-card + .metric-card {
            border-inline-start: 1px solid rgba(255, 255, 255, 0.08);
        }

        .metric-card:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        .header-svg {
            width: 17px;
            height: 17px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex-shrink: 0;
        }

        .metric-svg {
            width: 15px;
            height: 15px;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex-shrink: 0;
        }

        .status-svg { stroke: #10b981; }
        .bot-svg { stroke: #38bdf8; }
        .folder-svg { stroke: #818cf8; }
        .port-svg { stroke: #c084fc; }

        .metric-label {
            font-size: 11.5px;
            color: #94a3b8;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 7px;
            letter-spacing: 0.2px;
        }

        .metric-val {
            font-size: 15px;
            font-weight: 700;
            color: #f8fafc;
            direction: ltr;
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        html[dir="ltr"] .metric-val {
            text-align: left;
        }

        .metric-val.mono {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13.5px;
        }

        @media (max-width: 768px) {
            .metric-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .metric-card:nth-child(2n+1) {
                border-inline-start: none;
            }
            .metric-card:nth-child(n+3) {
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }
        }

        .section-svg {
            width: 19px;
            height: 19px;
            stroke: var(--accent-cyan);
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex-shrink: 0;
        }

        .btn-svg {
            width: 16px;
            height: 16px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex-shrink: 0;
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn:hover .btn-svg {
            transform: scale(1.18);
        }

        .btn-svg-sm {
            width: 14px;
            height: 14px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex-shrink: 0;
        }

        .flow-svg {
            width: 18px;
            height: 18px;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex-shrink: 0;
        }

        .flow-badge-svg {
            width: 13px;
            height: 13px;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            display: inline-block;
            vertical-align: -1px;
            margin-inline-end: 4px;
        }

        .tree-svg {
            width: 14px;
            height: 14px;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            display: inline-block;
            vertical-align: -2px;
            margin: 0 4px;
            flex-shrink: 0;
            filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.4));
        }

        .terminal-title-area {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* Main Section Cards */
        .panel-card {
            background: var(--card-surface);
            backdrop-filter: blur(16px);
            border: 1px solid var(--card-border);
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .card-title {
            font-size: 16px;
            font-weight: 700;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card-title svg {
            width: 18px;
            height: 18px;
            stroke: var(--accent-cyan);
            stroke-width: 2;
            fill: none;
        }

        /* Buttons & Actions */
        .action-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .btn {
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            text-decoration: none;
            color: #e2e8f0;
            outline: none;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }

        .btn svg {
            width: 15px;
            height: 15px;
            stroke-width: 2;
            flex-shrink: 0;
        }

        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn-start {
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border-color: rgba(16, 185, 129, 0.3);
        }
        .btn-start:hover {
            background: rgba(16, 185, 129, 0.22);
            border-color: rgba(16, 185, 129, 0.55);
            color: #6ee7b7;
            box-shadow: 0 4px 16px rgba(16, 185, 129, 0.2);
        }

        .btn-stop {
            background: rgba(244, 63, 94, 0.1);
            color: #fb7185;
            border-color: rgba(244, 63, 94, 0.25);
        }
        .btn-stop:hover {
            background: rgba(244, 63, 94, 0.2);
            border-color: rgba(244, 63, 94, 0.5);
            color: #fda4af;
            box-shadow: 0 4px 16px rgba(244, 63, 94, 0.2);
        }

        .btn-restart {
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
            border-color: rgba(56, 189, 248, 0.25);
        }
        .btn-restart:hover {
            background: rgba(56, 189, 248, 0.2);
            border-color: rgba(56, 189, 248, 0.5);
            color: #7dd3fc;
            box-shadow: 0 4px 16px rgba(56, 189, 248, 0.2);
        }

        .btn-telegram {
            background: rgba(14, 165, 233, 0.1);
            color: #7dd3fc;
            border-color: rgba(14, 165, 233, 0.25);
        }
        .btn-telegram:hover {
            background: rgba(14, 165, 233, 0.2);
            border-color: rgba(14, 165, 233, 0.5);
            color: #bae6fd;
            box-shadow: 0 4px 16px rgba(14, 165, 233, 0.2);
        }

        .btn-install {
            background: rgba(255, 255, 255, 0.05);
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .btn-install:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.25);
            color: #ffffff;
        }

        .btn-skill {
            background: rgba(168, 85, 247, 0.12);
            color: #c084fc;
            border: 1px solid rgba(168, 85, 247, 0.35);
        }
        .btn-skill:hover {
            background: rgba(168, 85, 247, 0.22);
            border-color: #c084fc;
            color: #ffffff;
            box-shadow: 0 4px 16px rgba(168, 85, 247, 0.3);
        }

        .panel-prerequisites {
            border: 1px solid rgba(244, 63, 94, 0.35);
            background: linear-gradient(180deg, rgba(244, 63, 94, 0.05) 0%, rgba(15, 23, 42, 0.7) 100%);
            box-shadow: 0 4px 20px rgba(244, 63, 94, 0.08);
        }
        .panel-prerequisites .card-header {
            border-bottom: 1px solid rgba(244, 63, 94, 0.2);
        }
        .panel-prerequisites .card-title {
            color: #f43f5e;
            font-weight: 700;
        }
        .panel-prerequisites .card-title .section-svg {
            stroke: #f43f5e;
        }

        .btn-prereq-1 {
            background: rgba(244, 63, 94, 0.12);
            color: #fda4af;
            border: 1px solid rgba(244, 63, 94, 0.35);
        }
        .btn-prereq-1:hover {
            background: rgba(244, 63, 94, 0.22);
            border-color: #f43f5e;
            color: #ffffff;
            box-shadow: 0 4px 16px rgba(244, 63, 94, 0.3);
        }

        .btn-prereq-2 {
            background: rgba(168, 85, 247, 0.12);
            color: #d8b4fe;
            border: 1px solid rgba(168, 85, 247, 0.35);
        }
        .btn-prereq-2:hover {
            background: rgba(168, 85, 247, 0.22);
            border-color: #c084fc;
            color: #ffffff;
            box-shadow: 0 4px 16px rgba(168, 85, 247, 0.3);
        }

        .btn-save {
            background: linear-gradient(135deg, rgba(2, 132, 199, 0.9), rgba(99, 102, 241, 0.9));
            color: #ffffff;
            border: 1px solid rgba(56, 189, 248, 0.35);
            box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);
        }
        .btn-save:hover {
            background: linear-gradient(135deg, #0284c7, #6366f1);
            border-color: rgba(56, 189, 248, 0.6);
            box-shadow: 0 6px 18px rgba(2, 132, 199, 0.45);
        }

        .btn-sm {
            padding: 6px 12px;
            font-size: 12px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.07);
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .btn-sm:hover {
            background: rgba(255, 255, 255, 0.14);
            color: #fff;
        }

        /* Form Inputs */
        .form-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            margin-bottom: 18px;
        }

        .field-label {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-muted);
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
        }

        .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }

        .input-text {
            width: 100%;
            background: rgba(9, 13, 22, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 12px 16px;
            color: #ffffff;
            font-size: 14px;
            direction: ltr;
            text-align: left;
            font-family: 'Consolas', monospace;
            outline: none;
            transition: all 0.2s;
        }

        .input-text:focus {
            border-color: #38bdf8;
            box-shadow: 0 0 16px rgba(56, 189, 248, 0.22);
            background: rgba(9, 13, 22, 0.9);
        }

        .toggle-visibility {
            position: absolute;
            right: 12px;
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
        }

        .toggle-visibility:hover {
            color: #ffffff;
        }

        /* Terminal Logs Box */
        .terminal-container {
            background: #050811;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.7);
        }

        .terminal-bar {
            background: rgba(15, 23, 42, 0.85);
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .terminal-dots {
            display: flex;
            gap: 6px;
        }

        .terminal-dot {
            width: 11px;
            height: 11px;
            border-radius: 50%;
        }

        .dot-red { background: #ef4444; }
        .dot-yellow { background: #f59e0b; }
        .dot-green { background: #10b981; }

        .terminal-title {
            font-size: 12px;
            color: var(--text-muted);
            font-family: 'Consolas', monospace;
        }

        .terminal-actions {
            display: flex;
            gap: 8px;
        }

        .terminal-body {
            height: 270px;
            overflow-y: auto;
            padding: 14px 16px;
            font-family: 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.65;
            color: #94a3b8;
            direction: ltr;
            text-align: left;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }

        .terminal-body::-webkit-scrollbar {
            width: 6px;
        }
        .terminal-body::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 4px;
        }

        .log-entry {
            margin-bottom: 3px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .log-entry.info { color: #38bdf8; }
        .log-entry.error { color: #f43f5e; }
        .log-entry.warn { color: #f59e0b; }

        /* Archive Flowchart & Directory Tree */
        .archive-flowchart-card {
            margin-top: 14px;
            background: rgba(6, 11, 25, 0.75);
            border: 1px solid rgba(56, 189, 248, 0.22);
            border-radius: 16px;
            padding: 18px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        .flowchart-header {
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .flowchart-title {
            font-size: 13.5px;
            font-weight: 700;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .flow-root-banner {
            background: linear-gradient(145deg, rgba(14, 165, 233, 0.12), rgba(99, 102, 241, 0.08));
            border: 1px solid rgba(56, 189, 248, 0.28);
            border-radius: 12px;
            padding: 12px 16px;
            text-align: center;
            margin-bottom: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
        }

        .flow-root-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #38bdf8;
            background: rgba(56, 189, 248, 0.12);
            padding: 3px 10px;
            border-radius: 20px;
            border: 1px solid rgba(56, 189, 248, 0.25);
            margin-bottom: 5px;
        }

        .flow-root-title {
            font-size: 14.5px;
            font-weight: 800;
            color: #ffffff;
            direction: ltr;
            margin-bottom: 3px;
            letter-spacing: 0.3px;
        }

        .flow-root-desc {
            font-size: 11.5px;
            color: #94a3b8;
            line-height: 1.5;
        }

        .flow-columns-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 14px;
        }

        .flow-card {
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: all 0.2s;
        }

        .flow-card:hover {
            border-color: rgba(56, 189, 248, 0.4);
            transform: translateY(-2px);
        }

        .flow-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            align-self: flex-start;
        }

        .flow-in .flow-badge {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .flow-out .flow-badge {
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .flow-items {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .flow-node {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.03);
            padding: 7px 10px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.15s;
        }

        .flow-node:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(56, 189, 248, 0.25);
        }

        .flow-icon {
            font-size: 16px;
            flex-shrink: 0;
        }

        .flow-name {
            font-size: 11.5px;
            font-weight: 700;
            color: #e2e8f0;
            direction: ltr;
            text-align: right;
        }

        .flow-desc {
            font-size: 10.5px;
            color: #94a3b8;
        }

        .folder-tree-box {
            background: #060913;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 12px 16px;
        }

        .tree-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 700;
            color: #94a3b8;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .tree-tag {
            font-size: 10.5px;
            background: rgba(56, 189, 248, 0.12);
            color: #38bdf8;
            padding: 2px 7px;
            border-radius: 4px;
        }

        .tree-code {
            margin: 0;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12.5px;
            line-height: 1.7;
            color: #cbd5e1;
            direction: ltr !important;
            text-align: left !important;
            white-space: pre !important;
            overflow-x: auto;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            user-select: text !important;
        }

        .tree-code code {
            font-family: inherit !important;
            font-size: inherit !important;
            color: inherit !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            display: inline !important;
            cursor: default !important;
            user-select: text !important;
        }

        .tree-code code:hover {
            color: inherit !important;
            text-decoration: none !important;
        }

        .tree-comment {
            color: #64748b;
            font-style: italic;
            font-family: inherit;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <!-- Top Header -->
        <header class="app-header">
            <div class="brand-area">
                <div class="brand-icon">
                    <img src="/assets/logo.png?v=4" alt="Antigravity Remote">
                </div>
                <div>
                    <div class="brand-title">
                        TelGravity <span style="font-size: 13px; opacity: 0.82; font-weight: 500;">(Telegram Remote Controller for Antigravity)</span>
                        <span class="badge-pill">v1.2</span>
                    </div>
                    <div class="brand-subtitle" data-i18n="brandSubtitle">کنترل و مانیتورینگ هوشمند دستیار Antigravity از طریق تلگرام</div>
                </div>
            </div>
            <div class="header-actions">
                <button class="btn-lang-toggle" onclick="toggleLanguage()" id="langToggleBtn" title="Switch Language / تغییر زبان">
                    <svg class="header-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span id="langBtnText">English</span>
                </button>
                <button class="btn-guide-top" onclick="openSetupModal()">
                    <svg class="header-svg" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    <span data-i18n="guideTopBtn">راهنمای راه‌اندازی</span>
                </button>
                <div id="statusBadge" class="live-status live-offline">
                    <span class="status-dot"></span>
                    <span id="statusText" data-i18n="statusChecking">در حال بررسی...</span>
                </div>
            </div>
        </header>

        <!-- System Telemetry & Status Ribbon -->
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-label">
                    <svg class="metric-svg status-svg" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    <span data-i18n="metricStatusLabel">وضعیت سرویس</span>
                </div>
                <div id="metricStatus" class="metric-val" data-i18n="metricStatusWaiting">در انتظار</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">
                    <svg class="metric-svg bot-svg" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/><path d="M12 2v4"/><path d="M9 2h6"/><path d="M12 6a4 4 0 0 0-4 4v1h8v-1a4 4 0 0 0-4-4z"/></svg>
                    <span data-i18n="metricBotLabel">ربات متصل</span>
                </div>
                <div id="metricBot" class="metric-val mono">@...</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">
                    <svg class="metric-svg folder-svg" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    <span data-i18n="metricWorkspaceLabel">شناسایی پروژه‌ها</span>
                </div>
                <div id="metricWorkspace" class="metric-val mono" data-i18n="metricWorkspaceVal">خودکار (Native)</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">
                    <svg class="metric-svg port-svg" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span data-i18n="metricPortLabel">پورت CDP</span>
                </div>
                <div id="metricPort" class="metric-val mono">9222</div>
            </div>
        </div>

        <!-- Prerequisites Card -->
        <div class="panel-card panel-prerequisites">
            <div class="card-header">
                <div class="card-title">
                    <svg class="section-svg" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    <span data-i18n="prerequisitesTitle">نصب پیش‌نیازها</span>
                </div>
            </div>
            <div class="action-row">
                <button class="btn btn-prereq-1" onclick="installDeps()">
                    <svg class="btn-svg" viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    <span data-i18n="btnPrereq1">پیش‌نیاز اول: npm install</span>
                </button>
                <button class="btn btn-prereq-2" onclick="installRtlSkill()">
                    <svg class="btn-svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span data-i18n="btnPrereq2">پیش‌نیاز دوم: اسکیل راست‌چین پیام‌های ارسالی توسط تلگرام</span>
                </button>
            </div>
        </div>

        <!-- Quick Controls -->
        <div class="panel-card">
            <div class="card-header">
                <div class="card-title">
                    <svg class="section-svg" viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                    <span data-i18n="quickControlsTitle">کنترل سریع و عملیات</span>
                </div>
            </div>
            <div class="action-row">
                <button class="btn btn-start" onclick="startBot()">
                    <svg class="btn-svg" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span data-i18n="btnStart">شروع سرویس ربات</span>
                </button>
                <button class="btn btn-stop" onclick="stopBot()">
                    <svg class="btn-svg" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    <span data-i18n="btnStop">خاموش کردن ربات تلگرام</span>
                </button>
                <button class="btn btn-restart" onclick="restartBot()">
                    <svg class="btn-svg" viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    <span data-i18n="btnRestart">راه‌اندازی مجدد ربات</span>
                </button>
                <a id="telegramLink" class="btn btn-telegram" href="https://t.me/teeeeeest_aliz_bot" target="_blank">
                    <svg class="btn-svg" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    <span data-i18n="btnTelegram">باز کردن چت در تلگرام</span>
                </a>
            </div>
        </div>

        <!-- Settings Card -->
        <div class="panel-card" id="settingsPanel">
            <div class="card-header">
                <div class="card-title">
                    <svg class="section-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    <span data-i18n="settingsTitle">تنظیمات و احراز هویت</span>
                </div>
                <button class="btn btn-save" onclick="saveConfig()">
                    <svg class="btn-svg" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    <span data-i18n="btnSave">ذخیره تغییرات</span>
                </button>
            </div>
            <div class="form-grid">
                <div>
                    <div class="field-label">
                        <span data-i18n="labelToken">توکن ربات تلگرام (Telegram Bot Token)</span>
                        <span style="font-size: 11px;" data-i18n="hintToken">از <span class="bidi-ltr">@BotFather</span></span>
                    </div>
                    <div class="input-wrapper">
                        <input type="password" id="tokenInput" class="input-text" data-i18n-ph="placeholderToken" placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz...">
                        <button type="button" class="toggle-visibility" onclick="toggleTokenVisibility()">
                            <svg id="eyeIcon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </div>
                </div>
                <div>
                    <div class="field-label">
                        <span data-i18n="labelAllowedUsers">شناسه عددی کاربر تلگرام مجاز (ALLOWED_USER_IDS)</span>
                        <span style="font-size: 11px;" data-i18n="hintAllowedUsers">از <span class="bidi-ltr">@userinfobot</span></span>
                    </div>
                    <input type="text" id="allowedUsersInput" class="input-text" data-i18n-ph="placeholderAllowedUsers" placeholder="999999999">
                </div>
            </div>
        </div>

        <!-- Terminal Logs -->
        <div class="panel-card">
            <div class="terminal-container">
                <div class="terminal-bar">
                    <div class="terminal-dots">
                        <span class="terminal-dot dot-red"></span>
                        <span class="terminal-dot dot-yellow"></span>
                        <span class="terminal-dot dot-green"></span>
                    </div>
                    <div class="terminal-title-area">
                        <svg class="section-svg" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                        <div class="terminal-title" data-i18n="terminalTitle">Console Output — Antigravity Runtime</div>
                    </div>
                    <div class="terminal-actions">
                        <button class="btn-sm" onclick="copyLogs()">
                            <svg class="btn-svg-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            <span data-i18n="btnCopyLogs">کپی لاگ</span>
                        </button>
                        <button class="btn-sm" onclick="clearLogs()">
                            <svg class="btn-svg-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            <span data-i18n="btnClearLogs">پاک‌کردن</span>
                        </button>
                    </div>
                </div>
                <div id="logsBody" class="terminal-body" data-i18n="logsLoading">در حال بارگذاری لاگ‌ها...</div>
            </div>
        </div>

    </div>

    <!-- Step-by-Step Setup Guide Modal -->
    <div id="setupModal" class="modal-backdrop" onclick="if(event.target === this) closeSetupModal();">
        <div class="modal-card">
            <div class="modal-header">
                <div class="modal-title-area">
                    <img src="/assets/logo.png?v=4" alt="Antigravity Remote">
                    <div>
                        <div class="modal-title" data-i18n="modalTitle">راهنمای راه‌اندازی و مدیریت ربات تلگرام</div>
                        <div class="modal-subtitle" data-i18n="modalSubtitle">اتصال سریع، هوشمند و کاملاً امن به دستیار Antigravity در ۵ مرحله ساده و آرشیو فایل‌ها</div>
                    </div>
                </div>
                <button class="modal-close-btn" onclick="closeSetupModal()" data-i18n-title="modalCloseTitle" title="بستن (Esc)">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <!-- Step 0 -->
            <div class="modal-step" style="border-left-color: #f43f5e;">
                <div class="step-header">
                    <div class="step-badge" style="background: linear-gradient(135deg, #f43f5e, #be123c); box-shadow: 0 0 12px rgba(244, 63, 94, 0.4);" data-i18n="step0Badge">۰</div>
                    <div class="step-title" style="color: #f43f5e;" data-i18n="step0Title">مرحله صفرم: نصب پیش‌نیازهای اولیه سیستم (Prerequisites)</div>
                </div>
                <div class="step-body" data-i18n="step0Body">
                    <p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.8; margin-bottom: 12px;">پیش از راه‌اندازی ربات، حتماً دو پیش‌نیاز زیر را یک‌بار راه‌اندازی و نصب نمایید:</p>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(244, 63, 94, 0.3); padding: 12px 16px; border-radius: 10px;">
                            <div style="font-weight: 700; color: #f43f5e; font-size: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                <span>پیش‌نیاز اول: npm install</span>
                            </div>
                            <div style="font-size: 13px; color: #94a3b8; line-height: 1.7; margin-bottom: 8px;">نصب تمام بسته‌ها و وابستگی‌های مورد نیاز سیستم جهت اجرای ربات و کلاینت تلگرام.</div>
                            <button class="btn btn-prereq-1" style="padding: 6px 14px; font-size: 12.5px;" onclick="installDeps()">
                                <svg class="btn-svg" viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                <span>نصب پیش‌نیاز اول (npm install)</span>
                            </button>
                        </div>
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(168, 85, 247, 0.3); padding: 12px 16px; border-radius: 10px;">
                            <div style="font-weight: 700; color: #c084fc; font-size: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                <span>پیش‌نیاز دوم: اسکیل راست‌چین پیام‌های ارسالی توسط تلگرام</span>
                            </div>
                            <div style="font-size: 13px; color: #94a3b8; line-height: 1.7; margin-bottom: 8px;">افزودن اسکیل فارسی‌سازی و راست‌چین‌سازی هوشمند خروجی‌ها در Antigravity تا پیام‌ها، متون دوزبانه و بولت‌پوینت‌ها در تلگرام کاملاً راست‌چین و بدون بهم‌ریختگی ارسال شوند.</div>
                            <button class="btn btn-prereq-2" style="padding: 6px 14px; font-size: 12.5px;" onclick="installRtlSkill()">
                                <svg class="btn-svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                <span>نصب پیش‌نیاز دوم (اسکیل راست‌چین)</span>
                            </button>
                            <div style="margin-top: 12px; background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.35); padding: 10px 14px; border-radius: 8px;">
                                <div style="font-weight: 700; color: #38bdf8; font-size: 12.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                                    <svg class="step-subcard-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.7 3.5 6h7c2-1.3 3.5-3.5 3.5-6a7 7 0 0 0-7-7z"/></svg>
                                    <span>اگر حوصله دانلود و نصب اسکیل رو ندارید:</span>
                                </div>
                                <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.7; margin-bottom: 8px;">
                                    کافیه این پرامپت رو همیشه اول چتتون با Antigravity بهش بدین همین و بس!!
                                </div>
                                <pre class="copy-cmd" title="برای کپی کلیک کنید" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.12); padding: 10px 12px; border-radius: 8px; font-size: 12px; color: #e2e8f0; line-height: 1.7; white-space: pre-wrap; font-family: inherit; cursor: pointer; margin: 0;">قانون راست‌چین تلگرام: در تمامی خروجی‌های فارسی یا دوزبانه، تمام خطوط و بولت‌پوینت‌ها را حتماً با یک واژه یا عبارت فارسی آغاز کن (مثلاً به جای «• Bold: متن» بنویس «• حالت Bold: متن» یا «• ویژگی Bold: متن»). از شروع مستقیم خطوط با کلمات انگلیسی یا پرانتز خودداری کن تا خروجی در تلگرام کاملاً راست‌چین و منظم باشد.</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 1 -->
            <div class="modal-step">
                <div class="step-header">
                    <div class="step-badge" data-i18n="step1Badge">۱</div>
                    <div class="step-title" data-i18n="step1Title">مرحله اول: دریافت توکن اختصاصی ربات (Bot Token) از BotFather</div>
                </div>
                <div class="step-body" data-i18n="step1Body">
                    <p>۱. وارد ربات رسمی <a class="step-link bidi-ltr" href="https://t.me/BotFather" target="_blank">@BotFather</a> در تلگرام شوید.</p>
                    <p>۲. دستور <code class="copy-cmd" title="کلیک برای کپی">/newbot</code> را ارسال کنید.</p>
                    <p>۳. ابتدا یک نام دلخواه برای ربات (مثلاً <code class="bidi-ltr">Antigravity Remote</code>) و سپس یک یوزرنیم انگلیسی که حتماً به <code class="bidi-ltr">bot</code> ختم شود (مانند <code class="bidi-ltr">my_antigravity_bot</code>) انتخاب کنید.</p>
                    <p>۴. کدی که شبیه به <code class="bidi-ltr">123456789:ABCdefGhI...</code> به شما داده می‌شود همان <strong>توکن ربات</strong> است. آن را کپی کرده و در فیلد <strong>«توکن ربات تلگرام»</strong> در داشبورد وارد کنید.</p>
                    <div style="margin-top: 14px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.14); max-width: 480px; box-shadow: 0 8px 25px rgba(0,0,0,0.6);">
                        <a href="/assets/botfather-guide-fa.png?v=3" target="_blank" title="مشاهده تصویر بزرگ راهنما">
                            <img src="/assets/botfather-guide-fa.png?v=3" alt="راهنمای تصویری دریافت توکن و API Key از BotFather" style="width: 100%; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        </a>
                    </div>
                </div>
            </div>

            <!-- Step 2 -->
            <div class="modal-step">
                <div class="step-header">
                    <div class="step-badge" data-i18n="step2Badge">۲</div>
                    <div class="step-title" data-i18n="step2Title">مرحله دوم: دریافت شناسه عددی تلگرام (Allowed User ID)</div>
                </div>
                <div class="step-body" data-i18n="step2Body">
                    <p>جهت حفظ امنیت کامل سیستم و کدها، ربات فقط به اکانت تلگرام شما پاسخ می‌دهد و بقیه افراد مسدود خواهند بود.</p>
                    <p>۱. وارد ربات رسمی <a class="step-link bidi-ltr" href="https://t.me/userinfobot" target="_blank">@userinfobot</a> شوید و دکمه Start را بزنید.</p>
                    <p>۲. عدد چندرقمی روبروی عبارت <strong class="bidi-ltr" style="color: #94a3b8;">Id:</strong> (مثال: <code class="copy-cmd bidi-ltr" title="کلیک برای کپی">999999999</code>) را کپی کرده و در فیلد <strong>«شناسه عددی کاربر تلگرام مجاز»</strong> قرار دهید.</p>
                    <div style="margin-top: 14px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.14); max-width: 480px; box-shadow: 0 8px 25px rgba(0,0,0,0.6);">
                        <a href="/assets/userid-guide-fa.png" target="_blank" title="مشاهده تصویر بزرگ راهنما">
                            <img src="/assets/userid-guide-fa.png" alt="راهنمای تصویری دریافت شناسه عددی تلگرام" style="width: 100%; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        </a>
                    </div>
                </div>
            </div>

            <!-- Step 3 -->
            <div class="modal-step">
                <div class="step-header">
                    <div class="step-badge" data-i18n="step3Badge">۳</div>
                    <div class="step-title" data-i18n="step3Title">مرحله سوم: مشخص کردن پوشه پروژه‌ها (Workspace Directory)</div>
                </div>
                <div class="step-body" data-i18n="step3Body">
                    <p>آدرس پوشه‌ای از سیستم که پروژه‌ها و کدهای شما در آن ذخیره می‌شوند را در فیلد <strong>«پوشه پایه پروژه‌ها»</strong> وارد کنید تا ربات بتواند پروژه‌های مختلف را فهرست کرده و کارهای شما را مدیریت کند.</p>
                </div>
            </div>

            <!-- Step 4 -->
            <div class="modal-step">
                <div class="step-header">
                    <div class="step-badge" data-i18n="step4Badge">۴</div>
                    <div class="step-title" data-i18n="step4Title">مرحله چهارم: ذخیره، استارت سرویس و تست در تلگرام</div>
                </div>
                <div class="step-body" data-i18n="step4Body">
                    <p>۱. روی دکمه سبز <strong>«ذخیره تغییرات»</strong> کلیک کنید.</p>
                    <p>۲. دکمه آبی <strong>«شروع سرویس ربات»</strong> را بزنید تا وضعیت بالا به <span style="color:#34d399;font-weight:700;">آنلاین و آماده دریافت</span> تبدیل شود.</p>
                    <p>۳. وارد تلگرام خود شوید و به ربات پیام <code class="copy-cmd" title="کلیک برای کپی">/start</code> را بفرستید!</p>
                    <div style="margin-top: 12px; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 12px; border-right: 3px solid #38bdf8;">
                        <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px;">امکانات و دستورات مهم ربات:</div>
                        <ul style="padding-right: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.8;">
                            <li><code class="copy-cmd" title="کلیک برای کپی">/start</code> : باز کردن منوی شیشه‌ای کنترل، فهرست پروژه‌ها و گفتگوها</li>
                            <li><code class="copy-cmd" title="کلیک برای کپی">/screenshot</code> : دریافت اسکرین‌شات زنده و فوری از صفحه Antigravity</li>
                            <li><code class="copy-cmd" title="کلیک برای کپی">/last</code> : بازیابی آخرین پاسخ هوش مصنوعی در صورت قطعی موقت تلگرام</li>
                            <li><strong>ارسال ویس (Voice)</strong> : ارسال پیام صوتی برای اجرای مستقیم دستورات با صدا</li>
                            <li><strong>ارسال عکس (Photo)</strong> : ارسال تصویر باگ، کد یا طراحی به همراه توضیحات (کپشن)</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Step 5 -->
            <div class="modal-step">
                <div class="step-header">
                    <div class="step-badge" data-i18n="step5Badge">۵</div>
                    <div class="step-title" data-i18n="step5Title">مرحله پنجم: آرشیو و ذخیره‌سازی خودکار فایل‌ها (Archie file Send&Receive)</div>
                </div>
                <div class="step-body" data-i18n="step5Body">
                    <!-- Section 1 -->
                    <div style="margin-bottom: 16px; background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
                        <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            <span>۱. اصلاح نام پوشه‌ها و منطق تفکیک جریان (Send و Receive):</span>
                        </div>
                        <ul style="padding-right: 20px; font-size: 13.5px; color: #cbd5e1; line-height: 1.9;">
                            <li><strong style="color: #67e8f9;">Receive (دریافتی):</strong> فایل‌هایی که کاربر برای ربات / Antigravity می‌فرستد.</li>
                            <li><strong style="color: #60a5fa;">Send (ارسالی):</strong> فایل‌هایی که ربات / Antigravity برای کاربر به تلگرام می‌فرستد.</li>
                            <li>تمام فایل‌های رد و بدل شده بدون از دست رفتن داده‌ها در این دایرکتوری به صورت خودکار بایگانی می‌شوند.</li>
                        </ul>
                    </div>

                    <!-- Section 2: Flowchart and Tree -->
                    <div style="margin-bottom: 16px; background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
                        <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            <span>۲. ساختار جدید پوشه‌ها (پوشه‌های Images، PDF، Documents و ...):</span>
                        </div>
                        <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 12px; line-height: 1.8;">هم در سمت <strong>Receive</strong> و هم در سمت <strong>Send</strong> پوشه‌بندی‌ها به تفکیک دقیق نوع فایل ایجاد و مدیریت می‌شوند:</p>

                    <div class="archive-flowchart-card">
                        <div class="flowchart-header">
                            <span class="flowchart-title">
                                <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                فلوچارت گردش و تفکیک فایل‌های ورودی و خروجی
                            </span>
                        </div>

                        <!-- Main Hub Parent Banner -->
                        <div class="flow-root-banner">
                            <div class="flow-root-badge">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                <span>پوشه اصلی ریشه پروژه (Project Root)</span>
                            </div>
                            <div class="flow-root-title">Archie file Send&Receive/</div>
                            <div class="flow-root-desc">تفکیک کامل ورودی‌ها (Receive) و خروجی‌ها (Send) با ذخیره‌سازی خودکار</div>
                        </div>

                        <!-- Symmetrical 2-Column Grid (Side-by-Side) -->
                        <div class="flow-columns-grid">
                            <!-- Inbound Card (Receive) -->
                            <div class="flow-card flow-in">
                                <div class="flow-badge">
                                    <svg class="flow-badge-svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    دریافتی از کاربر (Receive)
                                </div>
                                <div class="flow-items">
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        <div>
                                            <div class="flow-name">Images/</div>
                                            <div class="flow-desc">عکس‌ها و اسکرین‌شات‌های ارسالی شما</div>
                                        </div>
                                    </div>
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#a78bfa"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                        <div>
                                            <div class="flow-name">Voices/</div>
                                            <div class="flow-desc">ویس‌ها و پیام‌های صوتی ضبط‌شده شما</div>
                                        </div>
                                    </div>
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#f43f5e"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                        <div>
                                            <div class="flow-name">PDF/</div>
                                            <div class="flow-desc">کتاب‌ها، مقالات و فایل‌های PDF ارسالی شما</div>
                                        </div>
                                    </div>
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#34d399"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>
                                        <div>
                                            <div class="flow-name">Documents/</div>
                                            <div class="flow-desc">فایل‌های کد، فایل‌های متنی و اسناد ضمیمه</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Outbound Card (Send) -->
                            <div class="flow-card flow-out">
                                <div class="flow-badge">
                                    <svg class="flow-badge-svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    ارسالی به تلگرام (Send)
                                </div>
                                <div class="flow-items">
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#fbbf24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                        <div>
                                            <div class="flow-name">Screenshots/</div>
                                            <div class="flow-desc">اسکرین‌شات‌های زنده ثبت شده از Antigravity</div>
                                        </div>
                                    </div>
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        <div>
                                            <div class="flow-name">Images/</div>
                                            <div class="flow-desc">تصاویر و چارت‌های تولیدشده توسط دستیار</div>
                                        </div>
                                    </div>
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#f43f5e"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                        <div>
                                            <div class="flow-name">PDF/</div>
                                            <div class="flow-desc">گزارش‌ها و مستندات خروجی PDF</div>
                                        </div>
                                    </div>
                                    <div class="flow-node">
                                        <svg class="flow-svg" viewBox="0 0 24 24" stroke="#34d399"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>
                                        <div>
                                            <div class="flow-name">Documents/</div>
                                            <div class="flow-desc">فایل‌های کد، لاگ‌ها و اسناد تحویلی به تلگرام</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tree Directory View -->
                        <div class="folder-tree-box">
                            <div class="tree-title">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <svg class="flow-svg" viewBox="0 0 24 24" stroke="#38bdf8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                    <span>ساختار درختی پوشه آرشیو (Directory Tree)</span>
                                </span>
                                <span class="tree-tag">بایگانی هوشمند</span>
                            </div>
                            <pre class="tree-code"><svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Archie file Send&Receive/
├── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Receive/               <span class="tree-comment"># فایل‌های ارسال‌شده از شما در تلگرام به ربات</span>
│   ├── <svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Images/            <span class="tree-comment"># عکس‌ها، اسکرین‌شات‌ها و تصاویر ارسالی</span>
│   ├── <svg class="tree-svg" stroke="#a78bfa" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Voices/            <span class="tree-comment"># ویس‌ها و پیام‌های صوتی ضبط‌شده شما</span>
│   ├── <svg class="tree-svg" stroke="#f43f5e" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF/               <span class="tree-comment"># کتاب‌ها، مقالات و فایل‌های پی‌دی‌اف</span>
│   └── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg> Documents/         <span class="tree-comment"># فایل‌های کد، اسناد متنی و ضمیمه‌ها</span>
└── <svg class="tree-svg" stroke="#fbbf24" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Send/                  <span class="tree-comment"># فایل‌های ارسال‌شده از ربات به تلگرام</span>
    ├── <svg class="tree-svg" stroke="#fbbf24" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Screenshots/       <span class="tree-comment"># اسکرین‌شات‌های زنده و مستقیم از صفحه</span>
    ├── <svg class="tree-svg" stroke="#38bdf8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Images/            <span class="tree-comment"># تصاویر و چارت‌های تولیدشده توسط سیستم</span>
    ├── <svg class="tree-svg" stroke="#f43f5e" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF/               <span class="tree-comment"># گزارش‌ها و مستندات خروجی پی‌دی‌اف</span>
    └── <svg class="tree-svg" stroke="#34d399" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg> Documents/         <span class="tree-comment"># کدهای نهایی، لاگ‌ها و فایل‌های تحویلی</span></pre>
                        </div>
                    </div>
                    </div>

                    <!-- Section 3 -->
                    <div style="background: rgba(15, 23, 42, 0.65); padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.22);">
                        <div style="font-weight: 700; color: #38bdf8; font-size: 14.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <svg class="step-subcard-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            <span>۳. ارتقای هوشمند هندلر ربات:</span>
                        </div>
                        <ul style="padding-right: 20px; font-size: 13.5px; color: #cbd5e1; line-height: 1.9;">
                            <li>ربات تلگرام اکنون فایل‌های ورودی را دسته‌بندی و تفکیک می‌کند:</li>
                            <li>اگر عکس یا تصویر بفرستید ← در <code>Receive/Images/</code> ذخیره می‌شود.</li>
                            <li>اگر فایل پی‌دی‌اف بفرستید ← در <code>Receive/PDF/</code> ذخیره می‌شود.</li>
                            <li>اگر فایل متنی، کد، زیپ یا سند بفرستید ← در <code>Receive/Documents/</code> ذخیره می‌شود.</li>
                            <li>اگر ویس بفرستید ← در <code>Receive/Voices/</code> ذخیره می‌شود.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn btn-save" onclick="goToSettings()">
                    <svg class="btn-svg" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span data-i18n="btnGoToSettings">رفتن به بخش تنظیمات</span>
                </button>
                <button class="btn-sm" style="padding: 10px 22px; font-size: 14px;" onclick="closeSetupModal()" data-i18n="btnCloseModal">بستن راهنما</button>
            </div>
        </div>
    </div>

    <script>
        let isConfigLoaded = false;
        let isTokenVisible = false;
        let currentLang = localStorage.getItem('antigravity_ui_lang') || 'fa';
        let latestStatusData = null;

        const I18N = ${JSON.stringify(I18N_DATA)};

        function applyLanguage(lang) {
            currentLang = (lang === 'en' ? 'en' : 'fa');
            localStorage.setItem('antigravity_ui_lang', currentLang);
            document.documentElement.lang = currentLang;
            document.documentElement.dir = (currentLang === 'fa' ? 'rtl' : 'ltr');

            const btnText = document.getElementById('langBtnText');
            if (btnText) {
                btnText.textContent = (currentLang === 'fa' ? 'English' : 'فارسی');
            }

            const dict = I18N[currentLang];
            if (!dict) return;

            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (dict[key] !== undefined) {
                    el.innerHTML = dict[key];
                }
            });

            document.querySelectorAll('[data-i18n-ph]').forEach(el => {
                const key = el.getAttribute('data-i18n-ph');
                if (dict[key] !== undefined) {
                    el.placeholder = dict[key];
                }
            });

            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                if (dict[key] !== undefined) {
                    el.title = dict[key];
                }
            });

            if (latestStatusData) {
                renderStatusTexts(latestStatusData);
            }
        }

        function toggleLanguage() {
            const nextLang = (currentLang === 'fa' ? 'en' : 'fa');
            applyLanguage(nextLang);
        }

        function openSetupModal() {
            const m = document.getElementById('setupModal');
            if (m) m.classList.add('active');
        }

        function closeSetupModal() {
            const m = document.getElementById('setupModal');
            if (m) m.classList.remove('active');
        }

        function goToSettings() {
            closeSetupModal();
            const el = document.getElementById('settingsPanel');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => {
                    const inp = document.getElementById('tokenInput');
                    if (inp) inp.focus();
                }, 400);
            }
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSetupModal();
        });

        function renderStatusTexts(data) {
            const badge = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const metricStatus = document.getElementById('metricStatus');
            const dict = I18N[currentLang] || I18N.fa;

            if (data.isRunning) {
                badge.className = 'live-status live-online';
                statusText.textContent = dict.statusOnline;
                metricStatus.textContent = dict.metricRunning;
                metricStatus.style.color = '#34d399';
            } else {
                badge.className = 'live-status live-offline';
                statusText.textContent = dict.statusOffline;
                metricStatus.textContent = dict.metricStopped;
                metricStatus.style.color = '#fb7185';
            }
        }

        async function updateStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                latestStatusData = data;

                renderStatusTexts(data);

                if (data.botUsername) {
                    document.getElementById('metricBot').textContent = '@' + data.botUsername;
                    document.getElementById('telegramLink').href = 'https://t.me/' + data.botUsername;
                }

                const wsElem = document.getElementById('metricWorkspace');
                if (wsElem) {
                    const dict = I18N[currentLang] || I18N.fa;
                    wsElem.textContent = dict.metricWorkspaceVal || 'خودکار (Native)';
                }

                if (data.cdpPort) {
                    document.getElementById('metricPort').textContent = 'Port ' + data.cdpPort;
                }

                if (!isConfigLoaded) {
                    if (data.token) document.getElementById('tokenInput').value = data.token;
                    if (data.allowedUsers) document.getElementById('allowedUsersInput').value = data.allowedUsers;
                    isConfigLoaded = true;

                    // If token is missing, open the guide automatically for first-time onboarding
                    if (!data.token) {
                        openSetupModal();
                    }
                }

                const logsBody = document.getElementById('logsBody');
                if (data.logs && data.logs.length) {
                    const htmlLines = data.logs.map(line => {
                        let cls = 'log-entry';
                        if (line.includes('[INFO]') || line.includes('running') || line.includes('موفقیت')) cls += ' info';
                        else if (line.includes('[خطا]') || line.includes('Error') || line.includes('error')) cls += ' error';
                        else if (line.includes('[WARN]') || line.includes('Stale')) cls += ' warn';
                        return '<div class=\"' + cls + '\">' + escapeHtml(line) + '</div>';
                    }).join('');
                    logsBody.innerHTML = htmlLines;
                    logsBody.scrollTop = logsBody.scrollHeight;
                }
            } catch (err) {}
        }

        function escapeHtml(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function toggleTokenVisibility() {
            const input = document.getElementById('tokenInput');
            isTokenVisible = !isTokenVisible;
            input.type = isTokenVisible ? 'text' : 'password';
        }

        async function saveConfig() {
            const dict = I18N[currentLang] || I18N.fa;
            const token = document.getElementById('tokenInput').value.trim();
            const allowedUsers = document.getElementById('allowedUsersInput').value.trim();
            if (!token) return alert(dict.alertTokenMissing);

            const res = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, allowedUsers })
            });
            const data = await res.json();
            if (data.ok) {
                alert(dict.alertSaveSuccess);
            } else {
                alert(dict.alertSaveError + data.error);
            }
            updateStatus();
        }

        async function startBot() {
            await fetch('/api/start', { method: 'POST' });
            updateStatus();
        }

        async function stopBot() {
            const dict = I18N[currentLang] || I18N.fa;
            if (!confirm(dict.confirmStop)) return;
            await fetch('/api/stop', { method: 'POST' });
            updateStatus();
        }

        async function restartBot() {
            await fetch('/api/restart', { method: 'POST' });
            updateStatus();
        }

        async function abortAntigravityTask() {
            const dict = I18N[currentLang] || I18N.fa;
            if (!confirm(dict.confirmAbort)) return;
            try {
                const res = await fetch('/api/abort-task', { method: 'POST' });
                const data = await res.json();
                if (data.ok) {
                    alert(dict.alertAbortSuccess);
                } else {
                    alert(dict.alertAbortError + (data.error || 'Access Denied'));
                }
            } catch (e) {
                alert(dict.alertNetworkError);
            }
        }

        async function clearLogs() {
            const dict = I18N[currentLang] || I18N.fa;
            await fetch('/api/clear-logs', { method: 'POST' });
            document.getElementById('logsBody').innerHTML = '<div class=\"log-entry\">' + dict.alertLogsCleared + '</div>';
        }

        function copyLogs() {
            const dict = I18N[currentLang] || I18N.fa;
            const text = document.getElementById('logsBody').innerText;
            navigator.clipboard.writeText(text);
            alert(dict.alertLogsCopied);
        }

        async function installDeps() {
            const dict = I18N[currentLang] || I18N.fa;
            if (!confirm(dict.confirmInstall)) return;
            await fetch('/api/install-deps', { method: 'POST' });
            alert(dict.alertInstallStarted);
        }

        async function installRtlSkill() {
            const dict = I18N[currentLang] || I18N.fa;
            try {
                const res = await fetch('/api/install-rtl-skill', { method: 'POST' });
                const data = await res.json();
                if (data.ok) {
                    showCopyToast(dict.alertSkillInstalled);
                } else {
                    alert(dict.alertSkillError + (data.error || ''));
                }
            } catch (err) {
                alert(dict.alertSkillError + err.message);
            }
        }

        // Copy Toast Notification
        function showCopyToast(msg) {
            let t = document.getElementById('copyToast');
            if (!t) {
                t = document.createElement('div');
                t.id = 'copyToast';
                t.className = 'copy-toast';
                document.body.appendChild(t);
            }
            t.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg><span>' + escapeHtml(msg) + '</span>';
            t.classList.add('show');
            clearTimeout(t._hideTimeout);
            t._hideTimeout = setTimeout(() => {
                t.classList.remove('show');
            }, 2200);
        }

        // Global Click-to-Copy Handler for commands and code
        document.addEventListener('click', (e) => {
            const copyCmdEl = e.target.closest('.copy-cmd');
            const codeEl = e.target.closest('code');
            const target = copyCmdEl || codeEl;
            if (!target) return;

            // Never copy inside folder-tree-box or tree-code
            if (target.closest('.folder-tree-box') || target.closest('.tree-code')) return;

            let text = target.textContent.trim();
            if (!text) return;

            const isSlashCmd = text.startsWith('/');
            const isCopyCmd = target.classList.contains('copy-cmd');

            if (isSlashCmd || isCopyCmd) {
                const doCopy = () => {
                    const isFa = (currentLang === 'fa');
                    showCopyToast(isFa ? ('کپی شد: ' + text) : ('Copied: ' + text));
                };

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(doCopy).catch(() => fallbackCopy(text));
                } else {
                    fallbackCopy(text);
                }
            }
        });

        function fallbackCopy(text) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                const isFa = (currentLang === 'fa');
                showCopyToast(isFa ? ('کپی شد: ' + text) : ('Copied: ' + text));
            } catch (err) {}
            document.body.removeChild(ta);
        }

        // Initialize language
        applyLanguage(currentLang);

        setInterval(updateStatus, 1500);
        updateStatus();
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    });

    server.on('error', (err) => {
        console.error('[Dashboard Server Error]', err);
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`[Dashboard] پنل گرافیکی با موفقیت روی آدرس http://127.0.0.1:${port} اجرا شد.`);
        startBotProcess();
    });
}
