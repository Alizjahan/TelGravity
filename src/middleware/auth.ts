/**
 * @deprecated Not used by the bot (grammy middleware handles auth).
 * Kept for backwards compatibility with tests.
 */
export const withAuth = (userId: string, allowedUserIds: string[], next: () => void): void => {
    if (allowedUserIds.includes(userId)) {
        next();
    }
};
