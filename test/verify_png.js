const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 3005;
const SERVER_PATH = path.resolve(__dirname, '../dist/cli.js');
const NODE_PATH = 'C:\\Program Files\\nodejs\\node.exe';

console.log('Starting TUI API Server for PNG Test...');

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
    console.log('Testing GET /api/screenshot with Accept: image/png');

    const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/screenshot',
        method: 'GET',
        headers: {
            'Accept': 'image/png'
        }
    };

    const req = http.request(options, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            // Check PNG Signature: 89 50 4E 47 0D 0A 1A 0A
            if (buffer.length > 8 &&
                buffer[0] === 0x89 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4E &&
                buffer[3] === 0x47) {
                console.log('SUCCESS: Valid PNG signature detected.');
                console.log(`PNG Size: ${buffer.length} bytes`);
            } else {
                console.error('FAILURE: Response is not a valid PNG.');
                console.error('First 8 bytes:', buffer.slice(0, 8));
                console.error(buffer.toString('utf8').substring(0, 100));
            }
            serverProcess.kill();
            process.exit(0);
        });
    });

    req.on('error', (err) => {
        console.error('Error:', err.message);
        serverProcess.kill();
        process.exit(1);
    });

    req.end();

}, 3000);
