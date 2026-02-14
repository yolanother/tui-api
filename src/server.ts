import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { TerminalManager } from './TerminalManager';

export function setupRestEndpoints(app: express.Application, terminal: TerminalManager) {
    // Load Swagger Docs
    try {
        const file = fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8');
        const swaggerDocument = YAML.parse(file);
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    } catch (e) {
        console.warn('Could not load openapi.yaml for swagger docs');
    }

    // Serve static frontend
    // In dev: src/../public
    // In prod: dist/../dist/public (copied)
    // Actually we copy public to dist/public, so path.join(__dirname, 'public') should work if __dirname is dist
    let publicPath = path.join(__dirname, '../public'); // From src relative
    if (!fs.existsSync(publicPath)) {
        publicPath = path.join(__dirname, 'public'); // From dist relative if copied
    }

    if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
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
        } else {
            res.status(400).json({ error: 'Invalid input data' });
        }
    });

    const KEY_MAP: { [key: string]: string } = {
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
            } else {
                res.status(400).json({ error: `Unknown key: ${key}. Supported keys: ${Object.keys(KEY_MAP).join(', ')}` });
            }
        } else {
            res.status(400).json({ error: 'Invalid key data. Body should be { "key": "enter" }' });
        }
    });

    app.post('/api/resize', (req, res) => {
        const { cols, rows } = req.body;
        if (typeof cols === 'number' && typeof rows === 'number') {
            terminal.resize(cols, rows);
            res.json({ success: true });
        } else {
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
        const escapeXml = (unsafe: string) => unsafe.replace(/[<>&'"]/g, c => {
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

export function setupWebSocket(server: http.Server, terminal: TerminalManager) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket) => {
        console.log('Client connected');

        // Send initial screen (optional)
        // const screen = terminal.getScreen();
        // ws.send(screen.join('\r\n')); // Send as initial bulk text?

        const onData = (data: string) => {
            if (ws.readyState === WebSocket.OPEN) {
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

export function createServer(terminal: TerminalManager) {
    const app = express();
    const server = http.createServer(app);

    app.use(cors());
    app.use(bodyParser.json());

    setupRestEndpoints(app, terminal);
    setupWebSocket(server, terminal);

    return server;
}
