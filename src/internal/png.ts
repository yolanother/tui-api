import * as zlib from 'zlib';

/**
 * Minimal PNG Encoder
 * Encodes raw RGBA data into a PNG buffer.
 */

const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        if (c & 1) {
            c = 0xedb88320 ^ (c >>> 1);
        } else {
            c = c >>> 1;
        }
    }
    CRC_TABLE[n] = c;
}

function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
    }
    return crc ^ 0xffffffff;
}

export function encodePNG(width: number, height: number, rgbaBuffer: Buffer): Buffer {
    // 1. Signature
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // 2. IHDR Chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8); // Bit depth: 8
    ihdrData.writeUInt8(6, 9); // Color type: 6 (Truecolor with Alpha)
    ihdrData.writeUInt8(0, 10); // Compression: 0 (Deflate)
    ihdrData.writeUInt8(0, 11); // Filter: 0 (None)
    ihdrData.writeUInt8(0, 12); // Interlace: 0 (None)

    const ihdrChunk = createChunk('IHDR', ihdrData);

    // 3. IDAT Chunk (Image Data)
    // Add filter byte (0) at start of each scanline
    const scanlineLength = width * 4 + 1;
    const filteredData = Buffer.alloc(calculateScanlineLength(width, height));

    for (let y = 0; y < height; y++) {
        // Filter type 0 (None)
        filteredData[y * scanlineLength] = 0;
        // Copy scanline data
        const srcStart = y * width * 4;
        const destStart = y * scanlineLength + 1;
        rgbaBuffer.copy(filteredData, destStart, srcStart, srcStart + width * 4);
    }

    const compressedData = zlib.deflateSync(filteredData);
    const idatChunk = createChunk('IDAT', compressedData);

    // 4. IEND Chunk
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function calculateScanlineLength(width: number, height: number): number {
    return (width * 4 + 1) * height;
}

function createChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');

    // Calculate CRC over Type + Data
    const crcBuf = Buffer.alloc(4);
    const crcInput = Buffer.concat([typeBuf, data]);
    crcBuf.writeInt32BE(crc32(crcInput), 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
}
