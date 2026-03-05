import axios from 'axios';
import * as tar from 'tar-stream';
import fs from 'fs';

const key = 'sk-api-pQhWTy35aIo9ET9UfKAKWfiftzwVN7M12Amj-YqmT6UWGxzokSs5Dy6vMO2FGgSkU7laijedfow0bE72faVg1zWrRBUUkORKbyS2IQF9i27hf5qmfIkXJYk';

async function testDownload() {
    try {
        const fileId = "373150649913635"; // The file ID from the Success response
        console.log("Retrieving download url for file_id:", fileId);
        const retrieveRes = await axios.get(`https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        const downloadUrl = retrieveRes.data.file?.download_url;
        console.log("Download URL:", downloadUrl);
        if (!downloadUrl) return;

        const res = await axios.get(downloadUrl, { responseType: 'stream' });
        const extract = tar.extract();

        let found = false;
        extract.on('entry', (header, stream, next) => {
            console.log("Tar entry:", header.name, "size:", header.size);
            if (header.name.endsWith('.mp3')) {
                const chunks: Buffer[] = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => {
                    found = true;
                    const buf = Buffer.concat(chunks);
                    console.log("MP3 Size extracted:", buf.length);
                    next();
                });
            } else {
                stream.on('end', () => next());
                stream.resume();
            }
        });

        extract.on('finish', () => {
            console.log("Tar extraction finished. Found MP3:", found);
        });

        res.data.pipe(extract);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
testDownload();
