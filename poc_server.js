import http from 'http';
import zlib from 'zlib';

console.log("Đang tạo tệp tin giả lập...");

// 1. Tạo file gốc 100MB bằng cách ghép 10MB dữ liệu thật và 90MB dữ liệu rỗng (Padding)
// (Mô phỏng chính xác cấu trúc file EV Sign đã được Pump của ngài)
const realData = Buffer.alloc(10 * 1024 * 1024, 0x41); // 10MB 'A'
const nullData = Buffer.alloc(90 * 1024 * 1024, 0x00); // 90MB số 0 (Padding)
const fullPayload = Buffer.concat([realData, nullData]); // Tổng 100MB

// 2. Nén sẵn bằng Gzip (Mô phỏng máy chủ BunnyCDN tự nén)
const compressedPayload = zlib.gzipSync(fullPayload);

console.log(`[+] Dung lượng thật trên đĩa (Original/Pumped): ${(fullPayload.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`[+] Dung lượng truyền qua mạng mạng (Compressed): ${(compressedPayload.length / 1024 / 1024).toFixed(2)} MB`);

// 3. Khởi tạo máy chủ Web
const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <h2 style="font-family: sans-serif;">Kiểm chứng Native HTTP Compression (Không dùng JS)</h2>
            <p>1. Hãy mở F12 -> tab <b>Network</b>.</p>
            <p>2. Bấm vào nút tải xuống dưới đây.</p>
            <p>3. Quan sát cột <b>Transferred</b> (Dữ liệu truyền qua mạng mạng) chỉ tốn ~10MB.</p>
            <p>4. Mở thư mục Download, xem dung lượng thực tế của file <b>POC_Setup.exe</b> sẽ là 100MB nguyên vẹn.</p>
            <br>
            <a href="/download" style="padding: 10px 20px; background: blue; color: white; text-decoration: none; font-weight: bold; border-radius: 5px;">Tải POC_Setup.exe</a>
        `);
    } else if (req.url === '/download') {
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="POC_Setup.exe"',
            'Content-Encoding': 'gzip', // <--- ĐÂY LÀ CHÌA KHÓA PHÉP THUẬT NẰM Ở MÁY CHỦ
            'Content-Length': compressedPayload.length // Báo cáo dung lượng nén cho trình duyệt
        });
        // Gửi khối dữ liệu 10MB xuống mạng
        res.end(compressedPayload);
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3000, () => {
    console.log('====================================');
    console.log('[+] Máy chủ đã sẵn sàng!');
    console.log('[+] Ngài hãy mở trình duyệt và truy cập: http://localhost:3000');
    console.log('====================================');
});