/**
 * Telegram text formatter — HTML-based formatting for Telegram messages.
 * Formats text for Telegram HTML parse mode.
 */

const UI_CHROME_LITERALS = new Set([
    'analyzed', 'analyzing', 'reading', 'writing', 'running',
    'searching', 'planning', 'thinking', 'thinking...', 'processing',
    'loading', 'executing', 'testing', 'debugging', 'read', 'wrote',
    'ran', 'good', 'bad', 'good bad', 'show details',
    'json', 'css', 'html', 'xml', 'yaml', 'toml', 'sql', 'graphql',
]);

const UI_CHROME_REGEXES: RegExp[] = [
    /^[+-]\d+$/,
    /^\d+\s*chars?$/i,
    /^line\s+\d+/i,
    /^col\s+\d+/i,
    /^tool call:/i,
    /^tool result:/i,
    /^calling tool\b/i,
    /^tool response\b/i,
    /^mcp\b/i,
    /^thought for\s*<?\d+/i,
    /^show details$/i,
    /^[a-z0-9._-]+\s*\/\s*[a-z0-9._-]+$/i,
    /^full output written to\b/i,
    /^output\.[a-z0-9._-]+(?:#l\d+(?:-\d+)?)?$/i,
    /^\s*\{\s*$/,
    /^\s*\}\s*$/,
    /^\s*"[^"]*"\s*:\s*/,
];

function isUiChromeLine(line: string): boolean {
    const trimmed = (line || '').trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (UI_CHROME_LITERALS.has(lower)) return true;
    for (const re of UI_CHROME_REGEXES) {
        if (re.test(trimmed)) return true;
    }
    return false;
}

const FILE_REF_REGEX = /(?<![`/\\])(\b[a-zA-Z][\w.-]*(?:\/[\w.-]+)+(?::\d+(?:-\d+)?)?)\s?(?!`)/g;

/**
 * Escape special HTML characters for Telegram HTML parse mode.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Format text for Telegram HTML display.
 * Converts Markdown syntax to Telegram HTML, wraps table/tree lines in <pre>,
 * and file references in <code>.
 */
export function formatForTelegram(text: string): string {
    if (!text) return '';
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    // Token storage for multiline blocks (code blocks, tables, trees, blockquotes)
    const blockTokens = new Map<string, string>();
    let blockCounter = 0;
    const makeBlockToken = (html: string): string => {
        const token = `\uFFF0BLOCK${blockCounter++}\uFFF1`;
        blockTokens.set(token, html);
        return token;
    };

    const processedLines: string[] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];

    let inTableOrTree = false;
    let tableOrTreeLines: string[] = [];

    const flushTableOrTree = () => {
        if (tableOrTreeLines.length > 0) {
            const block = '<pre>' + tableOrTreeLines.map(l => escapeHtml(l)).join('\n') + '</pre>';
            processedLines.push(makeBlockToken(block));
            tableOrTreeLines = [];
        }
        inTableOrTree = false;
    };

    let inBlockquote = false;
    let isExpandableQuote = false;
    let blockquoteLines: string[] = [];

    const flushBlockquote = () => {
        if (blockquoteLines.length > 0) {
            const inner = blockquoteLines.join('\n');
            const block = isExpandableQuote
                ? `<blockquote expandable>${inner}</blockquote>`
                : `<blockquote>${inner}</blockquote>`;
            processedLines.push(makeBlockToken(block));
            blockquoteLines = [];
        }
        inBlockquote = false;
        isExpandableQuote = false;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. Code block delimiter: ``` or ```lang
        if (trimmed.startsWith('```')) {
            flushTableOrTree();
            if (inBlockquote) flushBlockquote();

            if (inCodeBlock) {
                // End code block
                const escapedCode = codeBlockLines.map(l => escapeHtml(l)).join('\n');
                const block = codeBlockLang
                    ? `<pre><code class="language-${escapeHtml(codeBlockLang)}">${escapedCode}</code></pre>`
                    : `<pre>${escapedCode}</pre>`;
                processedLines.push(makeBlockToken(block));
                codeBlockLines = [];
                inCodeBlock = false;
                codeBlockLang = '';
            } else {
                inCodeBlock = true;
                codeBlockLang = trimmed.slice(3).trim();
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockLines.push(line);
            continue;
        }

        // 2. Table or ASCII Tree detection (excluding Telegram spoilers ||...||)
        const isTableLine = !trimmed.startsWith('||') && (
            (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) ||
            /^\|[\s\-:]+\|/.test(trimmed)
        );
        const isTreeLine = /[├└│┌┐┘┤┬┴┼]/.test(line) ||
            /^\s*[│├└]\s*──/.test(line) ||
            /^\s*\|.*──/.test(line);

        if (isTableLine || isTreeLine) {
            if (inBlockquote) flushBlockquote();
            inTableOrTree = true;
            tableOrTreeLines.push(line);
            continue;
        } else if (inTableOrTree) {
            flushTableOrTree();
        }

        // 3. Blockquotes: > quote or **> expandable quote
        const isExpandableStart = trimmed.startsWith('**>');
        const isStandardQuote = trimmed.startsWith('>');
        if ((isExpandableStart || isStandardQuote) && !isTableLine && !isTreeLine) {
            if (inTableOrTree) flushTableOrTree();
            inBlockquote = true;
            if (isExpandableStart) isExpandableQuote = true;
            const quoteContent = trimmed
                .replace(/^\*\*>\s?/, '')
                .replace(/^>\s?/, '')
                .replace(/\|\|$/, '');
            blockquoteLines.push(formatLineContent(quoteContent));
            continue;
        } else if (inBlockquote) {
            flushBlockquote();
        }

        // 4. Horizontal divider: --- or *** or ___
        if (/^(?:---+|\*\*\*+|___+)\s*$/.test(trimmed)) {
            processedLines.push('───────────────────────');
            continue;
        }

        // 5. Headings: # Heading
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            processedLines.push(`<b>${formatLineContent(headingMatch[2].trim())}</b>`);
            continue;
        }

        // 6. List bullets: * item, - item, + item -> • item
        const bulletMatch = line.match(/^([ \t]*)[*\-+]([ \t]+)(.+)$/);
        if (bulletMatch) {
            processedLines.push(`${bulletMatch[1]}• ${formatLineContent(bulletMatch[3])}`);
            continue;
        }

        // 7. Regular line
        processedLines.push(formatLineContent(line));
    }

    if (inCodeBlock && codeBlockLines.length > 0) {
        const escapedCode = codeBlockLines.map(l => escapeHtml(l)).join('\n');
        processedLines.push(makeBlockToken(`<pre>${escapedCode}</pre>`));
    }
    if (inTableOrTree && tableOrTreeLines.length > 0) {
        flushTableOrTree();
    }
    if (inBlockquote && blockquoteLines.length > 0) {
        flushBlockquote();
    }

    // Force RTL paragraph direction in Telegram for any line containing Persian/Arabic text
    const RLM = '\u200F';
    const rtlProcessedLines = processedLines.map((l) => {
        // Skip block placeholders, dividers, or pure whitespace
        if (l.startsWith('\uFFF0BLOCK') || l.startsWith('───────────────────────') || !l.trim()) {
            return l;
        }
        // If the line contains Persian/Arabic characters, force RTL direction
        if (/[\u0600-\u06FF]/.test(l) && !l.startsWith(RLM)) {
            return RLM + l;
        }
        return l;
    });

    let result = rtlProcessedLines.join('\n');

    // Restore block tokens
    for (const [token, html] of blockTokens.entries()) {
        result = result.replace(token, html);
    }

    return validateAndBalanceTags(result);
}

/**
 * Format inline markdown within a single line while protecting inline code from tag corruption.
 */
function formatLineContent(text: string): string {
    if (!text) return '';

    // Step 0: Convert common LaTeX math symbols and arrows into clean Unicode characters
    let working = text
        .replace(/\\rightarrow|\\to/g, '→')
        .replace(/\\leftarrow/g, '←')
        .replace(/\\Rightarrow/g, '⇒')
        .replace(/\\Leftarrow/g, '⇐')
        .replace(/\\leftrightarrow/g, '↔')
        .replace(/\\pm/g, '±')
        .replace(/\\le(q)?\b/g, '≤')
        .replace(/\\ge(q)?\b/g, '≥')
        .replace(/\\neq/g, '≠')
        .replace(/\\times/g, '×')
        .replace(/\\approx/g, '≈')
        .replace(/\$([^\$\n]+)\$/g, '$1'); // strip math $ delimiters

    // Step 1: Protect inline code `...` with Unicode placeholders
    const inlineTokens = new Map<string, string>();
    let inlineCounter = 0;
    working = working.replace(/`([^`\n]+)`/g, (_m, code) => {
        const token = `\uFFF0INL${inlineCounter++}\uFFF1`;
        inlineTokens.set(token, `<code>${escapeHtml(code)}</code>`);
        return token;
    });

    // Step 1.5: Protect valid Telegram HTML tags (e.g. <u>, </u>, <s>, </s>, <b>, <i>)
    const validTagRegex = /<\/?(b|strong|i|em|u|ins|s|strike|del|span(?:\s+class="tg-spoiler")?|code|pre|blockquote(?:\s+expandable)?)>/gi;
    working = working.replace(validTagRegex, (tag) => {
        const token = `\uFFF0TAG${inlineCounter++}\uFFF1`;
        inlineTokens.set(token, tag);
        return token;
    });

    // Step 2: Escape HTML for non-code/non-tag text
    let escaped = escapeHtml(working);

    // Step 3: Links: [title](url)
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

    // Step 4: Spoilers: ||text||
    escaped = escaped.replace(/\|\|(.+?)\|\|/g, '<span class="tg-spoiler">$1</span>');

    // Step 5: Bold + Italic: ***text*** or ___text___
    escaped = escaped.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<b><i>$1</i></b>');
    escaped = escaped.replace(/___([^_\n]+?)___/g, '<b><i>$1</i></b>');

    // Step 6: Bold: **text**
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

    // Step 7: Underline: __text__ (per Telegram MarkdownV2 spec)
    escaped = escaped.replace(/__(.+?)__/g, '<u>$1</u>');

    // Step 8: Italic: *text* or _text_
    escaped = escaped.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '<i>$1</i>');
    escaped = escaped.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '<i>$1</i>');

    // Step 9: Strikethrough: ~~text~~ or ~text~
    escaped = escaped.replace(/~~(.+?)~~/g, '<s>$1</s>');
    escaped = escaped.replace(/(?<!\w)~([^~\n]+?)~(?!\w)/g, '<s>$1</s>');

    // Step 10: Restore inline code and valid HTML tokens
    for (const [token, html] of inlineTokens.entries()) {
        escaped = escaped.replace(token, html);
    }

    return escaped;
}

/**
 * Validates and ensures all HTML tags are strictly balanced and properly nested for Telegram.
 * If tags are mismatched or invalid, safely strips formatting tags to prevent Telegram API rejection.
 */
export function validateAndBalanceTags(html: string): string {
    const validTags = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'blockquote', 'span']);
    const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s[^>]*)?>/g;
    const stack: { tag: string; name: string }[] = [];
    let match: RegExpExecArray | null;
    let isCorrupted = false;

    while ((match = tagRegex.exec(html)) !== null) {
        const full = match[0];
        const name = match[1].toLowerCase();
        if (!validTags.has(name)) continue;
        if (full.endsWith('/>')) continue;

        if (full.startsWith('</')) {
            if (stack.length === 0 || stack[stack.length - 1].name !== name) {
                isCorrupted = true;
                break;
            }
            stack.pop();
        } else {
            stack.push({ tag: full, name });
        }
    }

    if (isCorrupted) {
        return html.replace(/<\/?(b|strong|i|em|u|ins|s|strike|del|span)>/gi, '');
    }

    if (stack.length > 0) {
        let suffix = '';
        for (let i = stack.length - 1; i >= 0; i--) {
            suffix += `</${stack[i].name}>`;
        }
        return html + suffix;
    }

    return html;
}

function wrapFileReferences(line: string): string {
    return line.replace(FILE_REF_REGEX, '<code>$1</code>');
}

function isMcpFormatLine(line: string): boolean {
    return /^[a-z0-9._-]+\s*\/\s*[a-z0-9._-]+$/i.test(line);
}

function isActivityLogLine(line: string): boolean {
    const trimmed = (line || '').trim();
    if (!trimmed) return false;
    return /^(?:analy[sz]ing|reading|writing|running|searching|planning|thinking|processing|loading|executing|testing|debugging|analyzed|read|wrote|ran)\s+.+/i.test(trimmed)
        && trimmed.length <= 220;
}

export function splitOutputAndLogs(rawText: string): { output: string; logs: string } {
    const normalized = (rawText || '').replace(/\r/g, '');
    if (!normalized.trim()) {
        return { output: '', logs: '' };
    }

    const lines = normalized.split('\n');
    type LineClass = 'output' | 'chrome' | 'blank' | 'code';
    const classes: LineClass[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
        const trimmed = (line || '').trim();
        if (trimmed.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            classes.push('code');
            continue;
        }
        if (inCodeBlock) { classes.push('code'); continue; }
        if (!trimmed) { classes.push('blank'); continue; }
        if (isUiChromeLine(trimmed) || isActivityLogLine(trimmed)) {
            classes.push('chrome');
        } else {
            classes.push('output');
        }
    }

    const hasMcpCalls = lines.some(
        (l, i) => classes[i] === 'chrome' && isMcpFormatLine(l.trim()),
    );

    if (!hasMcpCalls) {
        const outputLines: string[] = [];
        const logLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (classes[i] === 'chrome') {
                logLines.push(lines[i].trim());
            } else {
                outputLines.push(lines[i]);
            }
        }
        return {
            output: collapseBlankLines(outputLines.join('\n')),
            logs: collapseBlankLines(logLines.join('\n')),
        };
    }

    let lastOutputEnd = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (classes[i] === 'output' || classes[i] === 'code') {
            lastOutputEnd = i;
            break;
        }
    }

    if (lastOutputEnd === -1) {
        const logLines = lines.filter((_, i) => classes[i] === 'chrome').map((l) => l.trim());
        return { output: '', logs: collapseBlankLines(logLines.join('\n')) };
    }

    let lastOutputStart = lastOutputEnd;
    for (let i = lastOutputEnd - 1; i >= 0; i--) {
        if (classes[i] === 'blank' || classes[i] === 'chrome') break;
        if (classes[i] === 'output' || classes[i] === 'code') lastOutputStart = i;
    }

    const outputLines: string[] = [];
    const logLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (i >= lastOutputStart && i <= lastOutputEnd) {
            if (classes[i] !== 'chrome') outputLines.push(lines[i]);
            else logLines.push(lines[i].trim());
        } else if (classes[i] === 'chrome' || classes[i] === 'output') {
            logLines.push(lines[i].trim());
        }
    }

    return {
        output: collapseBlankLines(outputLines.join('\n')),
        logs: collapseBlankLines(logLines.join('\n')),
    };
}

function collapseBlankLines(text: string): string {
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function separateOutputForDelivery(options: {
    rawText: string;
    domSource: 'dom-structured' | 'legacy-fallback';
    domOutputText?: string;
    domActivityLines?: string[];
}): { source: string; output: string; logs: string } {
    const { rawText, domSource, domOutputText, domActivityLines } = options;

    if (domSource === 'dom-structured' && domOutputText !== undefined) {
        return {
            source: 'dom-structured',
            output: domOutputText,
            logs: (domActivityLines ?? []).join('\n'),
        };
    }

    const separated = splitOutputAndLogs(rawText);
    return { source: 'legacy-fallback', output: separated.output, logs: separated.logs };
}

/**
 * Split an HTML-formatted string into multiple Telegram-safe chunks.
 * Respects HTML tag boundaries — unclosed tags at chunk end are closed
 * and reopened at the start of the next chunk.
 *
 * Supported tags: <pre>, <code>, <b>, <i>, <pre><code ...>
 */
export function splitTelegramHtml(html: string, maxLen: number = 4096): string[] {
    if (html.length <= maxLen) return [html];

    const lines = html.split('\n');
    const chunks: string[] = [];
    let current = '';
    const openTags: string[] = [];  // stack of currently open tags (raw opening tags)

    const closingFor = (tag: string): string => {
        const name = tag.match(/^<(\w+)/)?.[1];
        return name ? `</${name}>` : '';
    };

    const flush = () => {
        if (!current) return;
        // Close any open tags at chunk end
        let suffix = '';
        for (let i = openTags.length - 1; i >= 0; i--) {
            suffix += closingFor(openTags[i]);
        }
        chunks.push(current + suffix);
        // Reopen tags at next chunk start
        current = openTags.join('');
    };

    const trackTags = (line: string) => {
        // Track opening and closing HTML tags
        const tagRegex = /<\/?(\w+)(?:\s[^>]*)?\s*\/?>/g;
        let match;
        while ((match = tagRegex.exec(line)) !== null) {
            const full = match[0];
            if (full.endsWith('/>')) continue;  // self-closing
            const tagName = match[1].toLowerCase();
            if (tagName === 'br') continue;  // void element
            if (full.startsWith('</')) {
                // Closing tag: pop matching open tag
                for (let i = openTags.length - 1; i >= 0; i--) {
                    const openName = openTags[i].match(/^<(\w+)/)?.[1]?.toLowerCase();
                    if (openName === tagName) {
                        openTags.splice(i, 1);
                        break;
                    }
                }
            } else {
                openTags.push(full);
            }
        }
    };

    for (const line of lines) {
        const candidate = current ? `${current}\n${line}` : line;
        // Calculate how much space closing tags would need
        let closingLen = 0;
        for (let i = openTags.length - 1; i >= 0; i--) {
            closingLen += closingFor(openTags[i]).length;
        }

        // Also account for closing tags that would be needed after adding this line
        const tempTags = [...openTags];
        const tempTagRegex = /<\/?(\w+)(?:\s[^>]*)?\s*\/?>/g;
        let m;
        while ((m = tempTagRegex.exec(line)) !== null) {
            const full = m[0];
            if (full.endsWith('/>')) continue;
            const tagName = m[1].toLowerCase();
            if (tagName === 'br') continue;
            if (full.startsWith('</')) {
                for (let j = tempTags.length - 1; j >= 0; j--) {
                    const openName = tempTags[j].match(/^<(\w+)/)?.[1]?.toLowerCase();
                    if (openName === tagName) { tempTags.splice(j, 1); break; }
                }
            } else {
                tempTags.push(full);
            }
        }
        let newClosingLen = 0;
        for (let i = tempTags.length - 1; i >= 0; i--) {
            newClosingLen += closingFor(tempTags[i]).length;
        }

        if (candidate.length + newClosingLen <= maxLen) {
            current = candidate;
            trackTags(line);
            continue;
        }

        // Current chunk is full — flush it
        if (current) {
            flush();
        }

        // If this single line fits in a fresh chunk
        const reopenLen = openTags.join('').length;
        if (reopenLen + line.length + newClosingLen <= maxLen) {
            current = openTags.join('') + line;
            trackTags(line);
            continue;
        }

        // Hard-split a very long line
        let available = maxLen - reopenLen - newClosingLen;
        if (available <= 0) {
            // Edge case: tag overhead alone exceeds limit — just push the line as-is
            current = openTags.join('') + line;
            trackTags(line);
            flush();
            continue;
        }
        let cursor = 0;
        while (cursor < line.length) {
            const slice = line.slice(cursor, cursor + available);
            current = openTags.join('') + slice;
            trackTags(slice);
            cursor += available;
            if (cursor < line.length) {
                flush();
                // Recalculate available space since openTags may have changed
                let updatedClosingLen = 0;
                for (let i = openTags.length - 1; i >= 0; i--) {
                    updatedClosingLen += closingFor(openTags[i]).length;
                }
                available = maxLen - openTags.join('').length - updatedClosingLen;
                if (available <= 0) available = 1; // prevent infinite loop
            }
        }
    }

    // Flush remaining
    if (current) {
        let suffix = '';
        for (let i = openTags.length - 1; i >= 0; i--) {
            suffix += closingFor(openTags[i]);
        }
        chunks.push(current + suffix);
    }

    return chunks.length > 0 ? chunks : [html];
}

export function sanitizeActivityLines(raw: string): string {
    const lines = (raw || '')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const kept = lines.filter((line) => !isUiChromeLine(line));
    return Array.from(new Set(kept)).join('\n');
}
