import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as crypto from 'crypto';
import WebSocket from 'ws';

export interface AntigravitySession {
    conversationId: string;
    title: string;
    project: string;
}

export class AntigravityNativeService {
    private static brainPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

    public static getActiveCdpPort(): number {
        try {
            const portFile = path.join(process.env.APPDATA || '', 'Antigravity', 'DevToolsActivePort');
            if (fs.existsSync(portFile)) {
                const line = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
                const port = parseInt(line, 10);
                if (!isNaN(port) && port > 0) return port;
            }
        } catch {}
        return 9222;
    }

    /**
     * Capture screenshot of the active Antigravity window via CDP
     */
    public static async captureScreenshot(): Promise<Buffer | null> {
        const port = this.getActiveCdpPort();
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data);
                        const mainPage = pages.find((p: any) => p.type === 'page' && !p.url.includes('devtools'));
                        if (!mainPage || !mainPage.webSocketDebuggerUrl) {
                            resolve(null);
                            return;
                        }

                        const ws = new WebSocket(mainPage.webSocketDebuggerUrl);
                        let timeoutId = setTimeout(() => {
                            try { ws.close(); } catch {}
                            resolve(null);
                        }, 5000);

                        ws.on('open', () => {
                            ws.send(JSON.stringify({
                                id: 1,
                                method: 'Page.captureScreenshot',
                                params: { format: 'png' }
                            }));
                        });

                        ws.on('message', (msg) => {
                            try {
                                const parsed = JSON.parse(msg.toString());
                                if (parsed.id === 1 && parsed.result?.data) {
                                    clearTimeout(timeoutId);
                                    const buf = Buffer.from(parsed.result.data, 'base64');
                                    ws.close();
                                    resolve(buf);
                                    return;
                                }
                            } catch {}
                            clearTimeout(timeoutId);
                            try { ws.close(); } catch {}
                            resolve(null);
                        });

                        ws.on('error', () => {
                            clearTimeout(timeoutId);
                            resolve(null);
                        });
                    } catch {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.setTimeout(4000, () => {
                req.destroy();
                resolve(null);
            });
        });
    }

    /**
     * Get the latest conversation ID from SQLite database
     */
    public static getLatestConversationFromDb(): string | null {
        try {
            const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
            if (fs.existsSync(dbPath)) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { DatabaseSync } = require('node:sqlite');
                const db = new DatabaseSync(dbPath, { readOnly: true });
                const row: any = db.prepare(`
                    SELECT conversation_id 
                    FROM conversation_summaries 
                    WHERE conversation_id != ''
                    ORDER BY last_modified_time DESC 
                    LIMIT 1
                `).get();
                if (row && row.conversation_id) {
                    return row.conversation_id;
                }
            }
        } catch {}
        return null;
    }

    /**
     * Get the active conversation ID currently open in Antigravity window
     */
    public static async getActiveConversationId(): Promise<string> {
        const port = this.getActiveCdpPort();
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data);
                        const mainPage = pages.find((p: any) => p.type === 'page' && !p.url.includes('devtools'));
                        if (mainPage && mainPage.url) {
                            const match = mainPage.url.match(/\/c\/([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) {
                                resolve(match[1]);
                                return;
                            }
                        }
                    } catch {}
                    const latest = this.getLatestConversationFromDb();
                    resolve(latest || '9755c870-a0a9-4dfb-b394-872024ed02c3');
                });
            });
            req.on('error', () => {
                const latest = this.getLatestConversationFromDb();
                resolve(latest || '9755c870-a0a9-4dfb-b394-872024ed02c3');
            });
            req.setTimeout(2000, () => {
                req.destroy();
                const latest = this.getLatestConversationFromDb();
                resolve(latest || '9755c870-a0a9-4dfb-b394-872024ed02c3');
            });
        });
    }

    /**
     * Map project folder names to their Antigravity internal section UUIDs from database
     */
    public static getProjectIdMap(): Record<string, string> {
        try {
            const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
            if (fs.existsSync(dbPath)) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { DatabaseSync } = require('node:sqlite');
                const db = new DatabaseSync(dbPath, { readOnly: true });
                const rows: any[] = db.prepare("SELECT DISTINCT project_id, workspace_uris FROM conversation_summaries WHERE project_id != '' AND project_id != 'outside-of-project'").all();
                const mapping: Record<string, string> = {};
                for (const r of rows) {
                    if (r.workspace_uris) {
                        try {
                            const uris = JSON.parse(r.workspace_uris);
                            if (Array.isArray(uris) && uris[0]) {
                                const decoded = decodeURIComponent(uris[0].replace('file:///', ''));
                                const name = path.basename(decoded);
                                mapping[name] = r.project_id;
                            }
                        } catch {}
                    }
                }
                return mapping;
            }
        } catch {}
        return {};
    }

    /**
     * Get the active project name from the open conversation in Antigravity
     */
    public static async getActiveProjectName(): Promise<string> {
        try {
            const convoId = await this.getActiveConversationId();
            if (convoId) {
                const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
                if (fs.existsSync(dbPath)) {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const { DatabaseSync } = require('node:sqlite');
                    const db = new DatabaseSync(dbPath, { readOnly: true });
                    const row: any = db.prepare('SELECT project_id, workspace_uris FROM conversation_summaries WHERE conversation_id = ?').get(convoId);
                    if (row) {
                        if (row.project_id === 'outside-of-project' || !row.workspace_uris) {
                            return 'عمومی (بدون پروژه)';
                        }
                        try {
                            const uris = JSON.parse(row.workspace_uris);
                            if (Array.isArray(uris) && uris[0]) {
                                const decoded = decodeURIComponent(uris[0].replace('file:///', ''));
                                return path.basename(decoded);
                            }
                        } catch {}
                    }
                }
            }
        } catch {}
        return 'عمومی (بدون پروژه)';
    }

    /**
     * Get all conversations categorized by their parent project
     * Uses native SQLite database for 100% accurate, fast discovery
     */
    public static async getGroupedSessions(): Promise<Record<string, AntigravitySession[]>> {
        const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
        if (fs.existsSync(dbPath)) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { DatabaseSync } = require('node:sqlite');
                const db = new DatabaseSync(dbPath, { readOnly: true });
                const rows: any[] = db.prepare(`
                    SELECT conversation_id, title, workspace_uris, last_modified_time 
                    FROM conversation_summaries 
                    WHERE conversation_id != ''
                    ORDER BY last_modified_time DESC
                `).all();

                const grouped: Record<string, AntigravitySession[]> = {};
                for (const row of rows) {
                    let projectName = 'عمومی (General)';
                    if (row.workspace_uris) {
                        try {
                            const uris = JSON.parse(row.workspace_uris);
                            if (Array.isArray(uris) && uris.length > 0) {
                                const rawUri = uris[0];
                                const decoded = decodeURIComponent(rawUri.replace('file:///', ''));
                                projectName = path.basename(decoded);
                            }
                        } catch {}
                    }

                    if (!grouped[projectName]) grouped[projectName] = [];
                    grouped[projectName].push({
                        conversationId: row.conversation_id,
                        title: row.title ? row.title.trim() : 'گفتگوی بدون عنوان',
                        project: projectName
                    });
                }

                if (Object.keys(grouped).length > 0) {
                    return grouped;
                }
            } catch (err) {
                // Fallback to CDP or default
            }
        }
        return this.getFallbackGroupedSessions();
    }

    private static getFallbackGroupedSessions(): Record<string, AntigravitySession[]> {
        return {
            '5-  Anti_Telegram': [
                {
                    conversationId: 'abacb241-9cc4-4f00-9c74-00e2dad58e50',
                    title: 'Telegram Remote Control Setup',
                    project: '5-  Anti_Telegram'
                }
            ]
        };
    }

    /**
     * Stop/abort the running task or active execution in Antigravity.
     * Clicks Cancel / Stop execution buttons, dispatches Ctrl+D, and clears queued prompts if any.
     */
    public static async stopTask(): Promise<{ success: boolean; actions: string[] }> {
        const port = this.getActiveCdpPort();
        return new Promise((resolve) => {
            let isResolved = false;
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data);
                        const mainPage = pages.find((p: any) => p.type === 'page' && !p.url.includes('devtools'));
                        if (!mainPage || !mainPage.webSocketDebuggerUrl) {
                            if (!isResolved) {
                                isResolved = true;
                                resolve({ success: false, actions: ['Main Antigravity window not found'] });
                            }
                            return;
                        }

                        const ws = new WebSocket(mainPage.webSocketDebuggerUrl);
                        const timeoutId = setTimeout(() => {
                            if (!isResolved) {
                                isResolved = true;
                                try { ws.close(); } catch {}
                                resolve({ success: true, actions: ['Stop signal dispatched (timeout fallback)'] });
                            }
                        }, 5000);

                        ws.on('open', () => {
                            const stopScript = `(() => {
                                const actions = [];

                                // 1. Click Cancel / Abort button in chat input area (stops active prompt/generation)
                                const cancelBtns = Array.from(document.querySelectorAll('button[aria-label*="Cancel" i], button[data-tooltip-id*="cancel" i], button[aria-label*="Stop generating" i]'));
                                for (const btn of cancelBtns) {
                                    if (!btn.disabled && btn.offsetWidth > 0) {
                                        btn.click();
                                        actions.push('لغو پرامپت چت (Cancel)');
                                    }
                                }

                                // 2. Stop background tool execution at bottom of message (protecting the bot UI daemon from self-terminating)
                                const stopTaskBtns = Array.from(document.querySelectorAll('button[aria-label*="Stop execution" i], button[title*="Stop execution" i], button[aria-label*="Stop task" i]'));
                                for (const btn of stopTaskBtns) {
                                    const card = btn.closest('div');
                                    const text = card ? (card.textContent || '') : '';
                                    if (text.includes('cli.js ui') || text.includes('startWebDashboard') || text.includes('Dashboard Server')) {
                                        continue; // Safeguard: never terminate our own bot service
                                    }
                                    if (!btn.disabled && btn.offsetWidth > 0) {
                                        btn.click();
                                        actions.push('توقف ران تسک آخر پیام (Stop execution)');
                                    }
                                }

                                // 3. Clear any queued messages waiting to execute
                                const queueBtns = Array.from(document.querySelectorAll('button[aria-label*="queued" i], button[data-tooltip-id*="queued" i]'));
                                for (const b of queueBtns) {
                                    if (!b.disabled) {
                                        b.click();
                                        actions.push('حذف پیام صف‌بندی‌شده');
                                    }
                                }

                                return actions;
                            })()`;

                            ws.send(JSON.stringify({
                                id: 10,
                                method: 'Runtime.evaluate',
                                params: { expression: stopScript, returnByValue: true }
                            }));

                            // Send Ctrl+D key combination
                            ws.send(JSON.stringify({
                                method: 'Input.dispatchKeyEvent',
                                params: {
                                    type: 'keyDown',
                                    modifiers: 2, // Control modifier
                                    key: 'd',
                                    code: 'KeyD',
                                    windowsVirtualKeyCode: 68
                                }
                            }));
                            ws.send(JSON.stringify({
                                method: 'Input.dispatchKeyEvent',
                                params: {
                                    type: 'keyUp',
                                    modifiers: 2,
                                    key: 'd',
                                    code: 'KeyD',
                                    windowsVirtualKeyCode: 68
                                }
                            }));

                            // Also send Escape key
                            ws.send(JSON.stringify({
                                method: 'Input.dispatchKeyEvent',
                                params: {
                                    type: 'keyDown',
                                    key: 'Escape',
                                    code: 'Escape',
                                    windowsVirtualKeyCode: 27
                                }
                            }));
                            ws.send(JSON.stringify({
                                method: 'Input.dispatchKeyEvent',
                                params: {
                                    type: 'keyUp',
                                    key: 'Escape',
                                    code: 'Escape',
                                    windowsVirtualKeyCode: 27
                                }
                            }));
                        });

                        ws.on('message', (msg) => {
                            try {
                                const parsed = JSON.parse(msg.toString());
                                if (parsed.id === 10) {
                                    if (!isResolved) {
                                        isResolved = true;
                                        clearTimeout(timeoutId);
                                        const actions = parsed.result?.result?.value || [];
                                        setTimeout(() => {
                                            try { ws.close(); } catch {}
                                        }, 100);
                                        resolve({ success: true, actions });
                                    }
                                }
                            } catch {}
                        });

                        ws.on('error', (err) => {
                            if (!isResolved) {
                                isResolved = true;
                                clearTimeout(timeoutId);
                                resolve({ success: false, actions: [err.message] });
                            }
                        });
                    } catch (e: any) {
                        if (!isResolved) {
                            isResolved = true;
                            resolve({ success: false, actions: [e.message] });
                        }
                    }
                });
            });

            req.on('error', (err) => resolve({ success: false, actions: [err.message] }));
            req.setTimeout(4000, () => {
                req.destroy();
                resolve({ success: false, actions: ['Request timeout'] });
            });
        });
    }

    /**
     * Check if Antigravity is currently running any tasks or if a background task is lingering (e.g. "1 task running")
     */
    public static async getTaskRunningState(): Promise<{
        isRunning: boolean;
        taskCount: number;
        taskPillFound: boolean;
        hasCancelButton: boolean;
        stopBtnsCount: number;
        detail: string;
    }> {
        const port = this.getActiveCdpPort();
        return new Promise((resolve) => {
            let isResolved = false;
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data);
                        const mainPage = pages.find((p: any) => p.type === 'page' && !p.url.includes('devtools'));
                        if (!mainPage || !mainPage.webSocketDebuggerUrl) {
                            if (!isResolved) {
                                isResolved = true;
                                resolve({
                                    isRunning: false,
                                    taskCount: 0,
                                    taskPillFound: false,
                                    hasCancelButton: false,
                                    stopBtnsCount: 0,
                                    detail: 'صفحه Antigravity پیدا نشد.'
                                });
                            }
                            return;
                        }

                        const ws = new WebSocket(mainPage.webSocketDebuggerUrl);
                        const timeoutId = setTimeout(() => {
                            if (!isResolved) {
                                isResolved = true;
                                try { ws.close(); } catch {}
                                resolve({
                                    isRunning: false,
                                    taskCount: 0,
                                    taskPillFound: false,
                                    hasCancelButton: false,
                                    stopBtnsCount: 0,
                                    detail: 'پاسخ پورت CDP زمان‌بر شد.'
                                });
                            }
                        }, 4000);

                        ws.on('open', () => {
                            const checkScript = `(() => {
                                const cancelBtn = document.querySelector('button[data-tooltip-id*="cancel" i], button[aria-label*="Cancel" i]');
                                const hasCancelButton = !!(cancelBtn && !cancelBtn.disabled && cancelBtn.offsetWidth > 0 && cancelBtn.offsetHeight > 0);

                                const stopBtns = Array.from(document.querySelectorAll('button[aria-label*="Stop execution" i], button[title*="Stop execution" i], button[aria-label*="Stop task" i]'))
                                    .filter(b => !b.disabled && b.offsetWidth > 0 && b.offsetHeight > 0 && !b.closest('code, pre, [class*="prose"]'));

                                const stopBtnsCount = stopBtns.length;
                                let taskCount = stopBtnsCount;
                                let taskPillFound = false;

                                const candidates = document.querySelectorAll('[class*="task"], [class*="badge"], [class*="status"], [class*="pill"]');
                                for (const el of candidates) {
                                    if (el.closest('code, pre, [class*="prose"]')) continue;
                                    const text = (el.textContent || '').trim();
                                    const m = text.match(/^(\\d+)\\s+tasks?\\s+running$/i);
                                    if (m) {
                                        taskCount = Math.max(taskCount, parseInt(m[1], 10) || 1);
                                        taskPillFound = true;
                                        break;
                                    }
                                }

                                return {
                                    taskCount,
                                    taskPillFound,
                                    hasCancelButton,
                                    stopBtnsCount,
                                    isRunning: taskPillFound || hasCancelButton || stopBtnsCount > 0
                                };
                            })()`;

                            ws.send(JSON.stringify({
                                id: 20,
                                method: 'Runtime.evaluate',
                                params: { expression: checkScript, returnByValue: true }
                            }));
                        });

                        ws.on('message', (msg) => {
                            try {
                                const parsed = JSON.parse(msg.toString());
                                if (parsed.id === 20) {
                                    if (!isResolved) {
                                        isResolved = true;
                                        clearTimeout(timeoutId);
                                        const val = parsed.result?.result?.value || {};
                                        setTimeout(() => { try { ws.close(); } catch {} }, 50);
                                        resolve({
                                            isRunning: !!val.isRunning,
                                            taskCount: val.taskCount || 0,
                                            taskPillFound: !!val.taskPillFound,
                                            hasCancelButton: !!val.hasCancelButton,
                                            stopBtnsCount: val.stopBtnsCount || 0,
                                            detail: val.isRunning 
                                                ? (val.taskPillFound 
                                                    ? `${val.taskCount} تسک در انتهای پیام در حال اجراست` 
                                                    : 'هوش مصنوعی در حال پردازش یا اجرای تسک است')
                                                : 'همه تسک‌ها ۱۰۰٪ تکمیل شده‌اند'
                                        });
                                    }
                                }
                            } catch {}
                        });

                        ws.on('error', (err) => {
                            if (!isResolved) {
                                isResolved = true;
                                clearTimeout(timeoutId);
                                resolve({
                                    isRunning: false,
                                    taskCount: 0,
                                    taskPillFound: false,
                                    hasCancelButton: false,
                                    stopBtnsCount: 0,
                                    detail: err.message
                                });
                            }
                        });
                    } catch (e: any) {
                        if (!isResolved) {
                            isResolved = true;
                            resolve({
                                isRunning: false,
                                taskCount: 0,
                                taskPillFound: false,
                                hasCancelButton: false,
                                stopBtnsCount: 0,
                                detail: e.message
                            });
                        }
                    }
                });
            });

            req.on('error', (err) => resolve({
                isRunning: false,
                taskCount: 0,
                taskPillFound: false,
                hasCancelButton: false,
                stopBtnsCount: 0,
                detail: err.message
            }));
            req.setTimeout(3500, () => {
                req.destroy();
                resolve({
                    isRunning: false,
                    taskCount: 0,
                    taskPillFound: false,
                    hasCancelButton: false,
                    stopBtnsCount: 0,
                    detail: 'Timeout'
                });
            });
        });
    }

    /**
     * Switch Antigravity conversation by navigating TanStack router or clicking sidebar row
     */
    public static async switchConversation(conversationId: string): Promise<boolean> {
        const port = this.getActiveCdpPort();
        let sectionId: string | null = null;
        try {
            const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
            if (fs.existsSync(dbPath)) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { DatabaseSync } = require('node:sqlite');
                const db = new DatabaseSync(dbPath, { readOnly: true });
                const row: any = db.prepare('SELECT project_id FROM conversation_summaries WHERE conversation_id = ?').get(conversationId);
                if (row && row.project_id) {
                    sectionId = row.project_id;
                }
            }
        } catch {}

        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data);
                        const mainPage = pages.find((p: any) => p.type === 'page' && !p.url.includes('devtools'));
                        if (!mainPage || !mainPage.webSocketDebuggerUrl) {
                            resolve(false);
                            return;
                        }

                        const ws = new WebSocket(mainPage.webSocketDebuggerUrl);
                        let timeoutId = setTimeout(() => {
                            try { ws.close(); } catch {}
                            resolve(false);
                        }, 4000);

                        ws.on('open', () => {
                            const expr = `(() => {
                                const targetId = ${JSON.stringify(conversationId)};
                                const secId = ${JSON.stringify(sectionId || '')};

                                // 1. Preferred method: TanStack Router navigation via React fiber
                                try {
                                    const root = document.querySelector('#root') || document.body.firstElementChild;
                                    const fiberKey = Object.keys(root || {}).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                                    if (fiberKey) {
                                        let node = root[fiberKey];
                                        if (node && node.current) node = node.current;
                                        let depth = 0;
                                        let router = null;
                                        while (node && depth < 60) {
                                            if (node.memoizedProps?.router) {
                                                router = node.memoizedProps.router;
                                                break;
                                            }
                                            node = node.child;
                                            depth++;
                                        }
                                        if (router && typeof router.navigate === 'function') {
                                            const searchObj = secId ? { section: secId } : {};
                                            router.navigate({ to: '/c/' + targetId, search: searchObj });
                                            return { ok: true, method: 'tanstack_router', targetId };
                                        }
                                    }
                                } catch (e) {}

                                // 2. Fallback: DOM click
                                let target = document.querySelector('a[href*="' + targetId + '"]') ||
                                             document.querySelector('[data-sidebar-row-id="' + targetId + '"] a') ||
                                             document.querySelector('[data-cascade-id="' + targetId + '"] a') ||
                                             document.querySelector('[data-sidebar-row-id="' + targetId + '"]') ||
                                             document.querySelector('[data-cascade-id="' + targetId + '"]') ||
                                             document.querySelector('[data-conversation-id="' + targetId + '"]') ||
                                             document.querySelector('[data-testid="conversation-row-sidebar"][data-cascade-id="' + targetId + '"]') ||
                                             document.querySelector('[href*="' + targetId + '"]');

                                if (target) {
                                    const clickable = (target.tagName === 'A' ? target : target.querySelector('a')) || target;
                                    clickable.scrollIntoView({ block: 'nearest', behavior: 'instant' });
                                    clickable.click();
                                    clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                    clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                    clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                    return { ok: true, method: 'dom_click' };
                                }
                                return { ok: false, error: 'target_not_found_in_dom' };
                            })()`;

                            ws.send(JSON.stringify({
                                id: 2,
                                method: 'Runtime.evaluate',
                                params: { expression: expr, returnByValue: true }
                            }));
                        });

                        ws.on('message', (msg) => {
                            try {
                                const parsed = JSON.parse(msg.toString());
                                if (parsed.id === 2) {
                                    clearTimeout(timeoutId);
                                    const val = parsed.result?.result?.value;
                                    setTimeout(() => {
                                        try { ws.close(); } catch {}
                                        resolve(val?.ok === true);
                                    }, 400);
                                    return;
                                }
                            } catch {}
                        });

                        ws.on('error', () => {
                            clearTimeout(timeoutId);
                            resolve(false);
                        });
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.setTimeout(3000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Start a brand new conversation in Antigravity window.
     * Supports both general standalone conversations and project-specific conversations.
     * Navigates TanStack router via React fiber (instant & 100% reliable) with DOM click fallback.
     */
    public static async startNewConversation(projectName?: string): Promise<boolean> {
        const port = this.getActiveCdpPort();
        const isGeneral = !projectName || 
            projectName === '__general__' || 
            projectName.includes('عمومی') || 
            projectName.toLowerCase().includes('general') || 
            projectName.includes('بدون پروژه');

        let targetSectionId: string | null = isGeneral ? 'outside-of-project' : null;
        if (!isGeneral && projectName) {
            const projectMap = this.getProjectIdMap();
            if (projectMap[projectName]) {
                targetSectionId = projectMap[projectName];
            } else {
                const cleanTarget = projectName.trim().toLowerCase();
                for (const [pName, secId] of Object.entries(projectMap)) {
                    const cleanP = pName.trim().toLowerCase();
                    if (cleanP === cleanTarget || cleanP.includes(cleanTarget) || cleanTarget.includes(cleanP)) {
                        targetSectionId = secId;
                        break;
                    }
                }
            }
        }

        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data);
                        const mainPage = pages.find((p: any) => p.type === 'page' && !p.url.includes('devtools'));
                        if (!mainPage || !mainPage.webSocketDebuggerUrl) {
                            resolve(false);
                            return;
                        }

                        const ws = new WebSocket(mainPage.webSocketDebuggerUrl);
                        let timeoutId = setTimeout(() => {
                            try { ws.close(); } catch {}
                            resolve(false);
                        }, 4000);

                        ws.on('open', () => {
                            const expr = `(() => {
                                const isGen = ${JSON.stringify(isGeneral)};
                                const targetSec = ${JSON.stringify(targetSectionId || '')};
                                const targetName = ${JSON.stringify(projectName || '')};

                                // 1. Preferred method: TanStack Router navigation via React fiber
                                try {
                                    const root = document.querySelector('#root') || document.body.firstElementChild;
                                    const fiberKey = Object.keys(root || {}).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                                    if (fiberKey) {
                                        let node = root[fiberKey];
                                        if (node && node.current) node = node.current;
                                        let depth = 0;
                                        let router = null;
                                        while (node && depth < 60) {
                                            if (node.memoizedProps?.router) {
                                                router = node.memoizedProps.router;
                                                break;
                                            }
                                            node = node.child;
                                            depth++;
                                        }
                                        if (router && typeof router.navigate === 'function') {
                                            const searchObj = isGen ? { section: 'outside-of-project' } : (targetSec ? { section: targetSec } : {});
                                            router.navigate({ to: '/', search: searchObj });
                                            return { ok: true, method: 'tanstack_router', search: searchObj };
                                        }
                                    }
                                } catch (e) {}

                                // 2. Fallback: DOM interaction
                                if (isGen) {
                                    const newBtn = document.querySelector('[data-testid="new-conversation-button"]') ||
                                                   document.querySelector('a[href="/"]') ||
                                                   Array.from(document.querySelectorAll('a, button')).find(el => (el.innerText || '').trim().toLowerCase().includes('new conversation'));
                                    if (newBtn) {
                                        newBtn.click();
                                        return { ok: true, method: 'dom_general_btn' };
                                    }
                                } else {
                                    const projectSections = Array.from(document.querySelectorAll('[data-sidebar-section-drop-id]'));
                                    for (const sec of projectSections) {
                                        const dropId = sec.getAttribute('data-sidebar-section-drop-id');
                                        const label = sec.querySelector('[data-project-label]')?.getAttribute('data-project-label') ||
                                                      sec.querySelector('[data-testid="project-header"]')?.innerText ||
                                                      sec.innerText || '';
                                        const cleanLabel = label.trim().toLowerCase();
                                        const cleanTarget = targetName.trim().toLowerCase();
                                        if ((targetSec && dropId === targetSec) || cleanLabel.includes(cleanTarget) || cleanTarget.includes(cleanLabel)) {
                                            const plusBtn = sec.querySelector('a[aria-label="New Conversation in Project"]') || sec.querySelector('a[href*="section="]');
                                            if (plusBtn) {
                                                plusBtn.click();
                                                return { ok: true, method: 'dom_project_plus_btn', dropId };
                                            }
                                        }
                                    }
                                }
                                return { ok: false };
                            })()`;

                            ws.send(JSON.stringify({
                                id: 1,
                                method: 'Runtime.evaluate',
                                params: { expression: expr, returnByValue: true }
                            }));
                        });

                        ws.on('message', (msg) => {
                            try {
                                const parsed = JSON.parse(msg.toString());
                                if (parsed.id === 1) {
                                    clearTimeout(timeoutId);
                                    setTimeout(() => {
                                        try { ws.close(); } catch {}
                                        resolve(true);
                                    }, 400);
                                    return;
                                }
                            } catch {}
                        });

                        ws.on('error', () => {
                            clearTimeout(timeoutId);
                            resolve(false);
                        });
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.setTimeout(3000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Send prompt into the active Antigravity chat input box
     * Uses CDP native Input.insertText + safe single-click dispatch to avoid duplicate prompt submissions
     */
    public static async sendPrompt(promptText: string): Promise<boolean> {
        const port = this.getActiveCdpPort();
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data);
                        const mainPage = pages.find((p: any) => p.type === 'page' && !p.url.includes('devtools'));
                        if (!mainPage || !mainPage.webSocketDebuggerUrl) {
                            resolve(false);
                            return;
                        }

                        const ws = new WebSocket(mainPage.webSocketDebuggerUrl);
                        let timeoutId = setTimeout(() => {
                            try { ws.close(); } catch {}
                            resolve(false);
                        }, 8000);

                        ws.on('open', () => {
                            // Step 1: Focus input element and prepare selection
                            const focusScript = `(() => {
                                const box = document.querySelector('div[aria-label="Message input"]') ||
                                            document.querySelector('div[contenteditable="true"]') ||
                                            document.querySelector('textarea');
                                if (!box) return false;
                                box.focus();
                                return true;
                            })()`;

                            ws.send(JSON.stringify({
                                id: 1,
                                method: 'Runtime.evaluate',
                                params: { expression: focusScript, returnByValue: true }
                            }));
                        });

                        ws.on('message', (msg) => {
                            try {
                                const res = JSON.parse(msg.toString());
                                if (res.id === 1) {
                                    // Step 2: Insert text using CDP native Input.insertText
                                    ws.send(JSON.stringify({
                                        id: 2,
                                        method: 'Input.insertText',
                                        params: { text: promptText }
                                    }));
                                } else if (res.id === 2) {
                                    // Step 3: Trigger single submit via button click
                                    setTimeout(() => {
                                        const clickSendScript = `(() => {
                                            const box = document.querySelector('div[aria-label="Message input"]') || 
                                                        document.querySelector('div[contenteditable="true"]') ||
                                                        document.querySelector('textarea');
                                            if (!box) return { submitted: false, reason: 'no_box' };

                                            let container = box;
                                            while (container && container.querySelectorAll('button').length < 3 && container.parentElement) {
                                                container = container.parentElement;
                                            }
                                            if (!container) return { submitted: false, reason: 'no_container' };

                                            const buttons = Array.from(container.querySelectorAll('button'));
                                            const sendBtn = buttons.find(b => {
                                                const tooltip = (b.getAttribute('data-tooltip-id') || '').toLowerCase();
                                                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                                                if (tooltip.includes('record') || tooltip.includes('cancel')) return false;
                                                if (aria.includes('cancel') || aria.includes('voice')) return false;
                                                if (tooltip.includes('send') || tooltip.includes('submit')) return true;
                                                if (/send|submit|ارسال/i.test(aria)) return true;
                                                return false;
                                            }) || buttons[buttons.length - 1];

                                            if (sendBtn && !sendBtn.disabled) {
                                                sendBtn.click();
                                                return { submitted: true, via: 'button' };
                                            }
                                            return { submitted: false, reason: 'button_unavailable' };
                                        })()`;

                                        ws.send(JSON.stringify({
                                            id: 3,
                                            method: 'Runtime.evaluate',
                                            params: { expression: clickSendScript, returnByValue: true }
                                        }));
                                    }, 200);
                                } else if (res.id === 3) {
                                    const val = res.result?.result?.value;
                                    if (val && val.submitted) {
                                        // Successfully submitted once via button click
                                        setTimeout(() => {
                                            clearTimeout(timeoutId);
                                            try { ws.close(); } catch {}
                                            resolve(true);
                                        }, 400);
                                    } else {
                                        // Fallback: only if button was not clickable, send a single Enter key
                                        ws.send(JSON.stringify({
                                            id: 4,
                                            method: 'Input.dispatchKeyEvent',
                                            params: {
                                                type: 'keyDown',
                                                key: 'Enter',
                                                code: 'Enter',
                                                windowsVirtualKeyCode: 13,
                                                nativeVirtualKeyCode: 13,
                                                text: '\\r',
                                                unmodifiedText: '\\r'
                                            }
                                        }));
                                        ws.send(JSON.stringify({
                                            id: 5,
                                            method: 'Input.dispatchKeyEvent',
                                            params: {
                                                type: 'keyUp',
                                                key: 'Enter',
                                                code: 'Enter',
                                                windowsVirtualKeyCode: 13,
                                                nativeVirtualKeyCode: 13
                                            }
                                        }));
                                        setTimeout(() => {
                                            clearTimeout(timeoutId);
                                            try { ws.close(); } catch {}
                                            resolve(true);
                                        }, 400);
                                    }
                                }
                            } catch {
                                clearTimeout(timeoutId);
                                try { ws.close(); } catch {}
                                resolve(false);
                            }
                        });

                        ws.on('error', () => {
                            clearTimeout(timeoutId);
                            resolve(false);
                        });
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Get the latest completed assistant response from transcript
     */
    public static getLastCompletedResponse(conversationId: string): { step: number; content: string } | null {
        const transPath = path.join(this.brainPath, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
        const transFullPath = path.join(this.brainPath, conversationId, '.system_generated', 'logs', 'transcript_full.jsonl');
        if (!fs.existsSync(transPath)) return null;

        try {
            const lines = fs.readFileSync(transPath, 'utf8').split('\n').filter(Boolean);
            for (let i = lines.length - 1; i >= 0; i--) {
                let parsed: any;
                try { parsed = JSON.parse(lines[i]); } catch { continue; }
                if (
                    parsed.type === 'PLANNER_RESPONSE' &&
                    parsed.status === 'DONE' &&
                    (!parsed.tool_calls || parsed.tool_calls.length === 0)
                ) {
                    let content = parsed.content || '';
                    if (parsed.truncated_fields && parsed.truncated_fields.includes('content') && fs.existsSync(transFullPath)) {
                        try {
                            const fullRaw = fs.readFileSync(transFullPath, 'utf8').split('\n').filter(Boolean);
                            for (let j = fullRaw.length - 1; j >= 0; j--) {
                                try {
                                    const fp = JSON.parse(fullRaw[j]);
                                    if (fp.step_index === parsed.step_index && fp.content) {
                                        content = fp.content;
                                        break;
                                    }
                                } catch {}
                            }
                        } catch {}
                    }
                    if (content && content.trim().length > 0) {
                        return { step: parsed.step_index, content: content.trim() };
                    }
                }
            }
        } catch {}
        return null;
    }

    /**
     * Live watcher for task completion notification
     */
    public static watchConversationCompletion(
        conversationId: string,
        onComplete: (replyContent: string) => void
    ): () => void {
        const transPath = path.join(this.brainPath, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
        const transFullPath = path.join(this.brainPath, conversationId, '.system_generated', 'logs', 'transcript_full.jsonl');

        let isCompleted = false;

        // Record the baseline step_index at the moment the watcher is registered
        let baselineStepIndex = -1;
        if (fs.existsSync(transPath)) {
            try {
                const existing = fs.readFileSync(transPath, 'utf8').split('\n').filter(Boolean);
                for (let i = existing.length - 1; i >= 0; i--) {
                    try {
                        const parsed = JSON.parse(existing[i]);
                        if (typeof parsed.step_index === 'number') {
                            baselineStepIndex = Math.max(baselineStepIndex, parsed.step_index);
                            break;
                        }
                    } catch {}
                }
            } catch {}
        }

        let userPromptStepIndex = -1;

        const checkCompletion = () => {
            if (isCompleted) return;
            if (!fs.existsSync(transPath)) return;

            try {
                const raw = fs.readFileSync(transPath, 'utf8');
                const lines = raw.split('\n').filter(Boolean);
                if (lines.length === 0) return;

                // 1. Detect user prompt step that came after baseline
                for (let i = 0; i < lines.length; i++) {
                    let parsed: any;
                    try {
                        parsed = JSON.parse(lines[i]);
                    } catch {
                        continue;
                    }

                    if (typeof parsed.step_index !== 'number' || parsed.step_index <= baselineStepIndex) {
                        continue;
                    }

                    if (parsed.type === 'USER_INPUT') {
                        userPromptStepIndex = Math.max(userPromptStepIndex, parsed.step_index);
                    }
                }

                // 2. Scan from newest to oldest for completed PLANNER_RESPONSE
                for (let i = lines.length - 1; i >= 0; i--) {
                    let parsed: any;
                    try {
                        parsed = JSON.parse(lines[i]);
                    } catch {
                        continue;
                    }

                    // Must be after baseline
                    if (typeof parsed.step_index !== 'number' || parsed.step_index <= baselineStepIndex) {
                        break;
                    }

                    // Must be after user prompt if detected
                    if (userPromptStepIndex !== -1 && parsed.step_index <= userPromptStepIndex) {
                        break;
                    }

                    // Check if it's the completed final response without ongoing tool_calls
                    if (
                        parsed.type === 'PLANNER_RESPONSE' &&
                        parsed.status === 'DONE' &&
                        (!parsed.tool_calls || parsed.tool_calls.length === 0)
                    ) {
                        let finalContent = parsed.content || '';

                        // If content was truncated in compact transcript, read full content
                        if (parsed.truncated_fields && parsed.truncated_fields.includes('content') && fs.existsSync(transFullPath)) {
                            try {
                                const fullRaw = fs.readFileSync(transFullPath, 'utf8').split('\n').filter(Boolean);
                                for (let j = fullRaw.length - 1; j >= 0; j--) {
                                    try {
                                        const fullParsed = JSON.parse(fullRaw[j]);
                                        if (fullParsed.step_index === parsed.step_index && fullParsed.content) {
                                            finalContent = fullParsed.content;
                                            break;
                                        }
                                    } catch {}
                                }
                            } catch {}
                        }

                        if (finalContent && finalContent.trim().length > 0) {
                            isCompleted = true;
                            clearInterval(interval);
                            onComplete(finalContent);
                            break;
                        }
                    }
                }
            } catch {}
        };

        const interval = setInterval(checkCompletion, 1000);
        return () => {
            isCompleted = true;
            clearInterval(interval);
        };
    }
}
