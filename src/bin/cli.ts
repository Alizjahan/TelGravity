#!/usr/bin/env node
console.log(`[DEBUG] CLI Start: cwd=${process.cwd()}`);
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { version } from '../../package.json';
import { startAction } from './commands/start';
import { doctorAction } from './commands/doctor';
import { setupAction } from './commands/setup';
import { openAction } from './commands/open';
import { ConfigLoader } from '../utils/configLoader';
import { printWelcome } from './welcome';
import { startWebDashboard } from './dashboard';

const program = new Command()
    .name('telgravity')
    .description('TelGravity (Telegram Remote Controller for Antigravity)')
    .version(version)
    .option('--verbose', 'Hiển thị nhật ký cấp độ debug')
    .option('--quiet', 'Chỉ hiển thị lỗi');

program
    .command('start')
    .description('شروع مستقیم ربات تلگرام')
    .action((_opts, cmd) => startAction(cmd.parent.opts(), cmd.parent));

program
    .command('ui')
    .description('اجرای پنل گرافیکی داشبورد ویندوز')
    .action(() => {
        startWebDashboard();
    });

program
    .command('doctor')
    .description('بررسی محیط و وضعیت نیازمندی‌ها')
    .action(doctorAction);

program
    .command('setup')
    .description('ویزارد تنظیمات تعاملی')
    .action(setupAction);

program
    .command('open')
    .description('باز کردن Antigravity با پورت دیباگ CDP')
    .action(openAction);

// Default action when no subcommand is provided
program.action(async () => {
    const hasConfig = ConfigLoader.configExists();
    const hasEnv = fs.existsSync(path.resolve(process.cwd(), '.env'));

    if (!hasConfig && !hasEnv) {
        printWelcome();
        return setupAction();
    } else {
        return startWebDashboard();
    }
});

program.parse(process.argv);
