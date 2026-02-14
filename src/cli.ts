#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { TerminalManager } from './TerminalManager';
import { createServer } from './server';
import path from 'path';

const program = new Command();

program
    .name('tui-api')
    .description('Wrap any TUI app in a REST API and WebSocket')
    .version('1.0.0')
    .option('-c, --command <command>', 'Command to run', 'bash')
    .option('-a, --args <args...>', 'Arguments for the command')
    .option('-d, --cwd <cwd>', 'Working directory', process.cwd())
    .option('-p, --port <port>', 'Port to run the API on', '3000')
    .option('--width <width>', 'Initial terminal width', '80')
    .option('--height <height>', 'Initial terminal height', '24')
    .action((options) => {
        const port = parseInt(options.port, 10);
        const cols = parseInt(options.width, 10);
        const rows = parseInt(options.height, 10);

        console.log(chalk.green(`Starting TUI API for command: ${options.command}`));

        const terminal = new TerminalManager({
            command: options.command,
            args: options.args || [],
            cwd: options.cwd,
            cols,
            rows,
        });

        const server = createServer(terminal);

        server.listen(port, () => {
            console.log(chalk.blue(`SERVER LISTENING ON PORT ${port}`));
            console.log(chalk.gray(`Swagger Docs: http://localhost:${port}/api/docs`));
            console.log(chalk.gray(`WebSocket: ws://localhost:${port}`));
        });

        terminal.on('exit', (code) => {
            console.log(chalk.yellow(`Process exited with code ${code}`));
            process.exit(code);
        });
    });

program.parse(process.argv);
