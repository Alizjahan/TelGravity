import { Command } from 'commander';
import { LOGO } from '../../utils/logo';
import { acquireLock } from '../../utils/lockfile';
import { startBot } from '../../bot';
import { logger } from '../../utils/logger';
import type { LogLevel } from '../../utils/logger';

function resolveCliLogLevel(cmd: Command | undefined): LogLevel | undefined {
    if (!cmd) return undefined;
    const root = cmd.parent ?? cmd;
    const opts = root.opts();
    if (opts.verbose) return 'debug';
    if (opts.quiet) return 'error';
    return undefined;
}

export async function startAction(
    _opts?: Record<string, unknown>,
    cmd?: Command,
): Promise<void> {
    const cliLevel = resolveCliLogLevel(cmd);
    if (cliLevel) {
        logger.setLogLevel(cliLevel);
    }

    console.log(LOGO);
    acquireLock();

    await startBot().catch((err) => {
        logger.error('Failed to start bot:', err);
        process.exit(1);
    });
}
