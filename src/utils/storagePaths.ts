import * as path from 'path';
import * as fs from 'fs';

export const STORAGE_ROOT_NAME = 'Archie file Send&Receive';

/**
 * Get the main storage root directory.
 * Path: <project-root>/Archie file Send&Receive
 */
export function getStorageRootDir(): string {
    const dir = path.join(process.cwd(), STORAGE_ROOT_NAME);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function getReceiveRootDir(): string {
    const dir = path.join(getStorageRootDir(), 'Receive');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function getSendRootDir(): string {
    const dir = path.join(getStorageRootDir(), 'Send');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

// === Receive Subdirectories (فایل‌های دریافتی از کاربر) ===

/**
 * Directory for received images/photos from user.
 * Path: Archie file Send&Receive/Receive/Images
 */
export function getReceivedImagesDir(): string {
    const dir = path.join(getReceiveRootDir(), 'Images');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
export const getReceivedPhotosDir = getReceivedImagesDir;

/**
 * Directory for received voice messages from user.
 * Path: Archie file Send&Receive/Receive/Voices
 */
export function getReceivedVoicesDir(): string {
    const dir = path.join(getReceiveRootDir(), 'Voices');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Directory for received PDF files from user.
 * Path: Archie file Send&Receive/Receive/PDF
 */
export function getReceivedPdfDir(): string {
    const dir = path.join(getReceiveRootDir(), 'PDF');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Directory for received documents from user (code, txt, docx, etc.).
 * Path: Archie file Send&Receive/Receive/Documents
 */
export function getReceivedDocumentsDir(): string {
    const dir = path.join(getReceiveRootDir(), 'Documents');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

// === Send Subdirectories (فایل‌های ارسالی سیستم/ربات برای کاربر) ===

/**
 * Directory for sent screenshots.
 * Path: Archie file Send&Receive/Send/Screenshots
 */
export function getSentScreenshotsDir(): string {
    const dir = path.join(getSendRootDir(), 'Screenshots');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Directory for sent images and generated charts.
 * Path: Archie file Send&Receive/Send/Images
 */
export function getSentImagesDir(): string {
    const dir = path.join(getSendRootDir(), 'Images');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Directory for sent PDF reports and docs.
 * Path: Archie file Send&Receive/Send/PDF
 */
export function getSentPdfDir(): string {
    const dir = path.join(getSendRootDir(), 'PDF');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Directory for sent documents and exported files.
 * Path: Archie file Send&Receive/Send/Documents
 */
export function getSentDocumentsDir(): string {
    const dir = path.join(getSendRootDir(), 'Documents');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Ensure all storage directories are initialized.
 */
export function ensureAllStorageDirsExist(): void {
    getReceivedImagesDir();
    getReceivedVoicesDir();
    getReceivedPdfDir();
    getReceivedDocumentsDir();
    getSentScreenshotsDir();
    getSentImagesDir();
    getSentPdfDir();
    getSentDocumentsDir();
}
