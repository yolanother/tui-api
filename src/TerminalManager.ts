import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export interface TerminalConfig {
    command: string;
    args?: string[];
    cwd?: string;
    env?: { [key: string]: string };
    cols?: number;
    rows?: number;
}

export class TerminalManager extends EventEmitter {
    private ptyProcess: pty.IPty;
    private buffer: string[] = [];
    private rawBuffer: string[] = [];
    private static readonly RAW_BUFFER_MAX = 256; // max raw chunks to keep for replay
    private cols: number;
    private rows: number;

    constructor(config: TerminalConfig) {
        super();

        let shell = config.command || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
        const args = config.args || [];
        const cwd = config.cwd || process.cwd();
        const env = config.env || process.env;
        this.cols = config.cols || 80;
        this.rows = config.rows || 24;

        // Resolve path to executable to support cross-platform usage (especially Windows)
        shell = this.resolveCommand(shell, env as any);

        try {
            this.ptyProcess = pty.spawn(shell, args, {
                name: 'xterm-color',
                cols: this.cols,
                rows: this.rows,
                cwd,
                env: env as any,
            });
        } catch (err: any) {
            throw new Error(`Failed to launch command '${shell}'. Make sure the executable is in your PATH or use an absolute path. Original error: ${err.message}`);
        }

        this.setupListeners();
    }

    private resolveCommand(command: string, env: { [key: string]: string }): string {
        if (path.isAbsolute(command)) {
            return command;
        }

        const pathEnv = env.PATH || env.Path || process.env.PATH || process.env.Path || '';
        const paths = pathEnv.split(path.delimiter);

        let extensions = [''];
        if (process.platform === 'win32') {
            const pathExt = env.PATHEXT || process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC';
            extensions = extensions.concat(pathExt.split(';'));
        }

        for (const dir of paths) {
            for (const ext of extensions) {
                const fullPath = path.join(dir, command + ext);
                if (fs.existsSync(fullPath)) {
                    // Check if it is a file
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isFile()) {
                            return fullPath;
                        }
                    } catch (e) {
                        // ignore access errors
                    }
                }
            }
        }

        return command;
    }

    private setupListeners() {
        this.ptyProcess.onData((data) => {
            this.updateBuffer(data);
            this.pushRaw(data);
            this.emit('data', data);
        });

        this.ptyProcess.onExit(({ exitCode, signal }) => {
            this.emit('exit', exitCode, signal);
        });
    }

    private updateBuffer(data: string) {
        // Simple line buffering. Full terminal emulation is complex.
        // We'll clean ANSI codes for the screen snapshot.
        // This is a naive implementation; complex TUIs overwrite lines using escape codes.
        // For a real TUI representation, xterm-headless is needed, but install failed.
        // We'll accumulate lines and keep the last N lines.
        // Also strip other control codes if possible

        const cleanData = data.replace(/\x1B\[[0-9;]*[mK]/g, '');

        const lines = cleanData.split(/\r?\n/);
        if (lines.length > 0) {
            if (this.buffer.length > 0) {
                // Append first chunk to last line
                this.buffer[this.buffer.length - 1] += lines[0];
                // Add rest
                for (let i = 1; i < lines.length; i++) {
                    this.buffer.push(lines[i]);
                }
            } else {
                this.buffer.push(...lines);
            }
        }

        // Limit buffer size
        if (this.buffer.length > 1000) {
            this.buffer = this.buffer.slice(this.buffer.length - 1000);
        }
    }

    private pushRaw(data: string) {
        this.rawBuffer.push(data);
        if (this.rawBuffer.length > TerminalManager.RAW_BUFFER_MAX) {
            this.rawBuffer = this.rawBuffer.slice(
                this.rawBuffer.length - TerminalManager.RAW_BUFFER_MAX
            );
        }
    }

    /** Return all cached raw PTY chunks for replay on new WebSocket connections. */
    public getRawReplay(): string {
        return this.rawBuffer.join('');
    }

    public write(data: string) {
        this.ptyProcess.write(data);
    }

    public resize(cols: number, rows: number) {
        this.ptyProcess.resize(cols, rows);
        this.cols = cols;
        this.rows = rows;
    }

    public getScreen(): string[] {
        // Return the last N lines.
        // Best effort.
        // Ideally we'd return a viewport of size rows x cols from the bottom.
        const start = Math.max(0, this.buffer.length - this.rows);
        return this.buffer.slice(start);
    }

    public kill() {
        this.ptyProcess.kill();
    }
}
