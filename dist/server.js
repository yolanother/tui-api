"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRestEndpoints = setupRestEndpoints;
exports.setupWebSocket = setupWebSocket;
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
function setupRestEndpoints(app, terminal) {
    // Load Swagger Docs
    try {
        const file = fs_1.default.readFileSync(path_1.default.join(__dirname, 'openapi.yaml'), 'utf8');
        const swaggerDocument = yaml_1.default.parse(file);
        app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
    }
    catch (e) {
        console.warn('Could not load openapi.yaml for swagger docs');
    }
    // Serve static frontend
    // In dev: src/../public
    // In prod: dist/../dist/public (copied)
    // Actually we copy public to dist/public, so path.join(__dirname, 'public') should work if __dirname is dist
    let publicPath = path_1.default.join(__dirname, '../public'); // From src relative
    if (!fs_1.default.existsSync(publicPath)) {
        publicPath = path_1.default.join(__dirname, 'public'); // From dist relative if copied
    }
    if (fs_1.default.existsSync(publicPath)) {
        app.use(express_1.default.static(publicPath));
    }
    // REST Endpoints
    app.get('/api/screen', (req, res) => {
        const screen = terminal.getScreen();
        res.json(screen);
    });
    app.post('/api/input', (req, res) => {
        const { data } = req.body;
        if (typeof data === 'string') {
            terminal.write(data);
            res.json({ success: true });
        }
        else {
            res.status(400).json({ error: 'Invalid input data' });
        }
    });
    const KEY_MAP = {
        'up': '\x1B[A',
        'down': '\x1B[B',
        'right': '\x1B[C',
        'left': '\x1B[D',
        'enter': '\r',
        'tab': '\t',
        'backspace': '\x7F',
        'escape': '\x1B',
        'home': '\x1B[H',
        'end': '\x1B[F',
        'pageup': '\x1B[5~',
        'pagedown': '\x1B[6~',
        'delete': '\x1B[3~',
        'insert': '\x1B[2~'
    };
    app.post('/api/key', (req, res) => {
        const { key } = req.body;
        if (typeof key === 'string') {
            const sequence = KEY_MAP[key.toLowerCase()];
            if (sequence) {
                terminal.write(sequence);
                res.json({ success: true, sequence: JSON.stringify(sequence) });
            }
            else {
                res.status(400).json({ error: `Unknown key: ${key}. Supported keys: ${Object.keys(KEY_MAP).join(', ')}` });
            }
        }
        else {
            res.status(400).json({ error: 'Invalid key data. Body should be { "key": "enter" }' });
        }
    });
    app.post('/api/resize', (req, res) => {
        const { cols, rows } = req.body;
        if (typeof cols === 'number' && typeof rows === 'number') {
            terminal.resize(cols, rows);
            res.json({ success: true });
        }
        else {
            res.status(400).json({ error: 'Invalid cols or rows' });
        }
    });
    app.get('/api/screenshot', (req, res) => {
        const lines = terminal.getScreen();
        // Simple SVG generation
        const lineHeight = 20;
        const charWidth = 10; // Approximate for monospace
        const width = 800; // default view width
        const height = (lines.length * lineHeight) + 20;
        // Escape XML characters
        const escapeXml = (unsafe) => unsafe.replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
            return c;
        });
        let svgContent = '';
        lines.forEach((line, index) => {
            const y = (index + 1) * lineHeight;
            svgContent += `<text x="10" y="${y}" font-family="monospace" font-size="16" fill="white" xml:space="preserve">${escapeXml(line)}</text>\n`;
        });
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background-color: black;">
            ${svgContent}
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    });
}
function setupWebSocket(server, terminal) {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on('connection', (ws) => {
        console.log('Client connected');
        // Send initial screen (optional)
        // const screen = terminal.getScreen();
        // ws.send(screen.join('\r\n')); // Send as initial bulk text?
        const onData = (data) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(data);
            }
        };
        terminal.on('data', onData);
        ws.on('message', (message) => {
            const msg = message.toString();
            terminal.write(msg);
        });
        ws.on('close', () => {
            console.log('Client disconnected');
            terminal.off('data', onData);
        });
    });
    return wss;
}
function createServer(terminal) {
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    app.use((0, cors_1.default)());
    app.use(body_parser_1.default.json());
    setupRestEndpoints(app, terminal);
    setupWebSocket(server, terminal);
    return server;
}
