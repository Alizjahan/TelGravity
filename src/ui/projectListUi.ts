import { InlineKeyboard } from 'grammy';
import { escapeHtml } from '../utils/telegramFormatter';

export const PROJECT_SELECT_ID = 'project_select';
export const WORKSPACE_SELECT_ID = 'workspace_select';
export const PROJECT_PAGE_PREFIX = 'project_page';
export const PROJECT_NEW_ID = 'project_new_btn';
export const ITEMS_PER_PAGE = 20;

export function parseProjectPageId(customId: string): number {
    if (!customId.startsWith(`${PROJECT_PAGE_PREFIX}:`)) return NaN;
    return parseInt(customId.slice(PROJECT_PAGE_PREFIX.length + 1), 10);
}

export function isProjectSelectId(customId: string): boolean {
    return (
        customId === PROJECT_SELECT_ID ||
        customId === WORKSPACE_SELECT_ID ||
        customId.startsWith(`${PROJECT_SELECT_ID}:`)
    );
}

export function buildProjectListUI(
    workspaces: string[],
    page: number = 0,
    lang: 'fa' | 'en' = 'fa',
): { text: string; keyboard: InlineKeyboard } {
    const isFa = lang === 'fa';
    const totalPages = Math.max(1, Math.ceil(workspaces.length / ITEMS_PER_PAGE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));

    const start = safePage * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, workspaces.length);
    const pageItems = workspaces.slice(start, end);

    const lines = pageItems.map((ws, i) =>
        `📁 <b>${start + i + 1}.</b> ${escapeHtml(ws)}`,
    );

    let text = isFa 
        ? `<b>📁 لیست پروژه‌های موجود:</b>\n\n` +
          `برای کار روی هر پروژه، روی دکمه آن کلیک کنید:\n\n` +
          (lines.length ? lines.join('\n') : '<i>هیچ پروژه‌ای یافت نشد.</i>')
        : `<b>📁 Available Projects:</b>\n\n` +
          `Select a project to switch into:\n\n` +
          (lines.length ? lines.join('\n') : '<i>No projects found.</i>');

    if (totalPages > 1) {
        text += isFa 
            ? `\n\n<i>صفحه ${safePage + 1} از ${totalPages} (${workspaces.length} پروژه)</i>`
            : `\n\n<i>Page ${safePage + 1} of ${totalPages} (${workspaces.length} projects)</i>`;
    }

    const keyboard = new InlineKeyboard();

    for (const ws of pageItems) {
        const label = ws.length > 36 ? ws.substring(0, 33) + '...' : ws;
        keyboard.text(label, `${PROJECT_SELECT_ID}:${ws}`).row();
    }

    if (totalPages > 1) {
        if (safePage > 0) {
            keyboard.text(isFa ? `◀ قبلی` : `◀ Prev`, `${PROJECT_PAGE_PREFIX}:${safePage - 1}`);
        }
        if (safePage < totalPages - 1) {
            keyboard.text(isFa ? `بعدی ▶` : `Next ▶`, `${PROJECT_PAGE_PREFIX}:${safePage + 1}`);
        }
        keyboard.row();
    }

    return { text, keyboard };
}
