const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = 3002;
const SERVER_PATH = path.resolve(__dirname, '../dist/cli.js');
const NODE_PATH = 'C:\\Program Files\\nodejs\\node.exe';

console.log('Starting TUI API Server...');

// Use shell: false to avoid quoting issues with complex args.
// We spawn `node.exe` directly.
const args = [
    SERVER_PATH,
    '--port', PORT.toString(),
    '--command', NODE_PATH,
    '--args', '-e', 'setInterval(() => console.log("tick"), 1000)'
];

const serverProcess = spawn(NODE_PATH, args, {
    stdio: 'inherit',
    shell: false
});

setTimeout(async () => {
    console.log('Connecting to WebSocket...');
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    ws.on('open', () => {
        console.log('WebSocket Connected');
    });

    ws.on('message', (data) => {
        console.log('WS Data Received (length):', data.toString().length);
        console.log('Snippet:', data.toString().trim());
    });

    ws.on('error', (e) => {
        console.error('WS Error:', e.message);
    });

    // Test REST API
    try {
        console.log('Testing GET /api/screen');
        const screenRes = await fetch(`http://localhost:${PORT}/api/screen`);
        if (screenRes.ok) {
            const screenData = await screenRes.json();
            console.log('Screen Content Sample (last 3 lines):', screenData.slice(-3));
        } else {
            console.error('GET /api/screen failed:', screenRes.status);
        }

        console.log('Testing POST /api/input');
        const inputRes = await fetch(`http://localhost:${PORT}/api/input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: 'hello' })
        });
        console.log('Input sent response:', inputRes.status);

        console.log('Testing POST /api/key');
        const keyRes = await fetch(`http://localhost:${PORT}/api/key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'enter' })
        });
        console.log('Key sent response:', keyRes.status);
        if (keyRes.ok) {
            const json = await keyRes.json();
            console.log('Key response sequence:', json.sequence);
        }
    } catch (err) {
        console.error('API Error:', err);
    }

    // Allow some time for WS data
    setTimeout(() => {
        console.log('Stopping server...');
        serverProcess.kill();
        process.exit(0);
    }, 5000);

}, 4000);
