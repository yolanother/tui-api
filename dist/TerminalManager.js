"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalManager = void 0;
const pty = __importStar(require("node-pty"));
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class TerminalManager extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.buffer = [];
        let shell = config.command || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
        const args = config.args || [];
        const cwd = config.cwd || process.cwd();
        const env = config.env || process.env;
        this.cols = config.cols || 80;
        this.rows = config.rows || 24;
        // Resolve path to executable to support cross-platform usage (especially Windows)
        shell = this.resolveCommand(shell, env);
        try {
            this.ptyProcess = pty.spawn(shell, args, {
                name: 'xterm-color',
                cols: this.cols,
                rows: this.rows,
                cwd,
                env: env,
            });
        }
        catch (err) {
            throw new Error(`Failed to launch command '${shell}'. Make sure the executable is in your PATH or use an absolute path. Original error: ${err.message}`);
        }
        this.setupListeners();
    }
    resolveCommand(command, env) {
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
                    }
                    catch (e) {
                        // ignore access errors
                    }
                }
            }
        }
        return command;
    }
    setupListeners() {
        this.ptyProcess.onData((data) => {
            this.updateBuffer(data);
            this.emit('data', data);
        });
        this.ptyProcess.onExit(({ exitCode, signal }) => {
            this.emit('exit', exitCode, signal);
        });
    }
    updateBuffer(data) {
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
            }
            else {
                this.buffer.push(...lines);
            }
        }
        // Limit buffer size
        if (this.buffer.length > 1000) {
            this.buffer = this.buffer.slice(this.buffer.length - 1000);
        }
    }
    write(data) {
        this.ptyProcess.write(data);
    }
    resize(cols, rows) {
        this.ptyProcess.resize(cols, rows);
        this.cols = cols;
        this.rows = rows;
    }
    getScreen() {
        // Return the last N lines.
        // Best effort.
        // Ideally we'd return a viewport of size rows x cols from the bottom.
        const start = Math.max(0, this.buffer.length - this.rows);
        return this.buffer.slice(start);
    }
    kill() {
        this.ptyProcess.kill();
    }
}
exports.TerminalManager = TerminalManager;
