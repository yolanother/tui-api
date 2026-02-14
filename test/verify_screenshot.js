const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 3004; // Use different port
const SERVER_PATH = path.resolve(__dirname, '../dist/cli.js');
const NODE_PATH = 'C:\\Program Files\\nodejs\\node.exe';

console.log('Starting TUI API Server for Screenshot Test...');

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

setTimeout(() => {
    console.log('Testing GET /api/screenshot');
    http.get(`http://localhost:${PORT}/api/screenshot`, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (data.trim().startsWith('<svg') && data.includes('</svg>')) {
                console.log('SUCCESS: Valid SVG received.');
            } else {
                console.error('FAILURE: Response is not a valid SVG.');
                console.log(data.substring(0, 100)); // Log usage
            }
            serverProcess.kill();
            process.exit(0);
        });
    }).on('error', (err) => {
        console.error('Error:', err.message);
        serverProcess.kill();
        process.exit(1);
    });
}, 3000);
