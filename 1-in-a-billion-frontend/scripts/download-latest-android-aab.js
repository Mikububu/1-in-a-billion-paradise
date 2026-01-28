const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const BUILD_URL = 'https://expo.dev/artifacts/eas/mHci1qpzQReDHtuKJYnhkQ.aab';
const DEST_PATH = '/Users/michaelperinwogenburg/Desktop/In-A-Billion-Play-Store.aab';
const SESSION_ID = 'debug-session';
const RUN_ID = 'run1';

function logEvent({ hypothesisId, location, message, data }) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      runId: RUN_ID,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function downloadFile(url, destPath) {
  logEvent({
    hypothesisId: 'H1',
    location: 'download-latest-android-aab.js:20',
    message: 'Download start',
    data: { url, destPath },
  });

  const fileStream = fs.createWriteStream(destPath);
  const request = https.get(new URL(url), (response) => {
    logEvent({
      hypothesisId: 'H1',
      location: 'download-latest-android-aab.js:29',
      message: 'Response received',
      data: {
        statusCode: response.statusCode,
        contentLength: response.headers['content-length'] || null,
        contentType: response.headers['content-type'] || null,
        location: response.headers.location || null,
      },
    });

    if (response.statusCode !== 200) {
      logEvent({
        hypothesisId: 'H2',
        location: 'download-latest-android-aab.js:41',
        message: 'Non-200 response',
        data: { statusCode: response.statusCode },
      });
      fileStream.close();
      fs.unlink(destPath, () => {});
      return;
    }

    let bytesWritten = 0;
    response.on('data', (chunk) => {
      bytesWritten += chunk.length;
      if (bytesWritten < 1024 * 1024) {
        logEvent({
          hypothesisId: 'H3',
          location: 'download-latest-android-aab.js:56',
          message: 'First chunk received',
          data: { bytesWritten },
        });
      }
    });

    response.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      const stats = fs.statSync(destPath);
      logEvent({
        hypothesisId: 'H4',
        location: 'download-latest-android-aab.js:70',
        message: 'Download finished',
        data: { bytesWritten, fileSize: stats.size },
      });
    });
  });

  request.on('error', (error) => {
    logEvent({
      hypothesisId: 'H5',
      location: 'download-latest-android-aab.js:80',
      message: 'Request error',
      data: { error: String(error) },
    });
    fileStream.close();
    fs.unlink(destPath, () => {});
  });
}

downloadFile(BUILD_URL, DEST_PATH);
