#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const TerminalManager_1 = require("./TerminalManager");
const server_1 = require("./server");
const program = new commander_1.Command();
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
    console.log(chalk_1.default.green(`Starting TUI API for command: ${options.command}`));
    const terminal = new TerminalManager_1.TerminalManager({
        command: options.command,
        args: options.args || [],
        cwd: options.cwd,
        cols,
        rows,
    });
    const server = (0, server_1.createServer)(terminal);
    server.listen(port, () => {
        console.log(chalk_1.default.blue(`SERVER LISTENING ON PORT ${port}`));
        console.log(chalk_1.default.gray(`Swagger Docs: http://localhost:${port}/api/docs`));
        console.log(chalk_1.default.gray(`WebSocket: ws://localhost:${port}`));
    });
    terminal.on('exit', (code) => {
        console.log(chalk_1.default.yellow(`Process exited with code ${code}`));
        process.exit(code);
    });
});
program.parse(process.argv);
