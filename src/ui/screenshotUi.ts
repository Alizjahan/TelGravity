import * as fs from 'fs';
import * as path from 'path';
import { InputFile } from 'grammy';
import { CdpService } from '../services/cdpService';
import { ScreenshotService } from '../services/screenshotService';
import { AntigravityNativeService } from '../services/antigravityNativeService';
import { getSentScreenshotsDir } from '../utils/storagePaths';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const screenshotDesktop = require('screenshot-desktop');

/**
 * Capture a screenshot and send it via Telegram.
 * Prioritizes native Antigravity window capture via CDP; falls back to Desktop screen capture.
 * Automatically persists all sent screenshots into "Archie file Send&Receive/Send/Screenshots".
 */
export async function handleScreenshot(
    sendPhoto: (input: InputFile, caption?: string) => Promise<void>,
    sendText: (text: string) => Promise<void>,
    cdp: CdpService | null = null,
    isPersian: boolean = true,
): Promise<void> {
    const saveDir = getSentScreenshotsDir();

    // 1. Try Antigravity Native CDP screenshot (fast, crystal clear, works even if minimized/locked)
    try {
        const nativeBuf = await AntigravityNativeService.captureScreenshot();
        if (nativeBuf && nativeBuf.length > 0) {
            const fileName = `screenshot_${Date.now()}.png`;
            const filePath = path.join(saveDir, fileName);
            fs.writeFileSync(filePath, nativeBuf);

            const caption = isPersian 
                ? '📸 <b>اسکرین‌شات از پنجره و محیط Antigravity</b>' 
                : '📸 <b>Live Antigravity Workspace Screenshot</b>';
            await sendPhoto(new InputFile(filePath, fileName), caption);
            return;
        }
    } catch {}

    // 2. Try CDP Service if passed
    if (cdp) {
        try {
            const screenshot = new ScreenshotService({ cdpService: cdp });
            const result = await screenshot.capture({ format: 'png' });
            if (result.success && result.buffer) {
                const fileName = `screenshot_${Date.now()}.png`;
                const filePath = path.join(saveDir, fileName);
                fs.writeFileSync(filePath, result.buffer);

                const caption = isPersian 
                    ? '📸 <b>اسکرین‌شات از پنجره Antigravity</b>' 
                    : '📸 <b>Antigravity Screenshot</b>';
                await sendPhoto(new InputFile(filePath, fileName), caption);
                return;
            }
        } catch {}
    }

    // 3. Direct desktop screen capture fallback
    try {
        const imgBuffer = await screenshotDesktop({ format: 'png' });
        if (imgBuffer && imgBuffer.length > 0) {
            const fileName = `desktop_${Date.now()}.png`;
            const filePath = path.join(saveDir, fileName);
            fs.writeFileSync(filePath, imgBuffer);

            const caption = isPersian 
                ? '📸 <b>اسکرین‌شات از پنجره Antigravity (دسکتاپ)</b>' 
                : '📸 <b>Live Desktop Screen Capture</b>';
            await sendPhoto(new InputFile(filePath, fileName), caption);
            return;
        }
    } catch (err: any) {
        const errorMsg = isPersian 
            ? `❌ خطا در تهیه اسکرین‌شات از آنتی‌گرویتی: ${err.message}` 
            : `❌ Screenshot failed: ${err.message}`;
        await sendText(errorMsg);
    }
}
