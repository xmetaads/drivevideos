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

                // [THAY ĐỔI] Ép buộc một tên file cố định theo nhu cầu của bạn ở đây
                // Bạn có thể thay đổi giá trị chuỗi này thành bất kỳ tên nào bạn muốn hệ thống xuất ra
                const forcedFilename = "downloaded_archive.dat";

                // Khởi tạo DecompressionStream để giải nén các chunk dữ liệu ngay khi chúng đổ về
                const ds = new DecompressionStream('gzip');
                const decompressedStream = response.body.pipeThrough(ds);

                // Cấu hình Header đúng chuẩn StreamSaver để kích hoạt trình tải xuống của Browser
                const headers = new Headers({
                    'Content-Type': 'application/octet-stream; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(forcedFilename)}"`,
                    'Cache-Control': 'no-store',
                    'X-Content-Type-Options': 'nosniff'
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