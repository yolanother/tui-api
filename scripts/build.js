const fs = require('fs');
const path = require('path');

const copyRecursiveSync = function (src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(function (childItemName) {
            copyRecursiveSync(path.join(src, childItemName),
                path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
};

const srcOpenApi = path.join(__dirname, '../src/openapi.yaml');
const destOpenApi = path.join(__dirname, '../dist/openapi.yaml');

if (!fs.existsSync(path.dirname(destOpenApi))) {
    fs.mkdirSync(path.dirname(destOpenApi), { recursive: true });
}

if (fs.existsSync(srcOpenApi)) {
    fs.copyFileSync(srcOpenApi, destOpenApi);
    console.log('Copied openapi.yaml to dist');
}

const srcPublic = path.join(__dirname, '../public');
const destPublic = path.join(__dirname, '../dist/public');

if (fs.existsSync(srcPublic)) {
    copyRecursiveSync(srcPublic, destPublic);
    console.log('Copied public folder to dist');
}
