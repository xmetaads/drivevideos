export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing target URL', { status: 400 });
  }

  try {
    // Gọi thẳng tới GitHub, Edge Runtime sẽ tự động bám theo (follow) các Redirect (301/302)
    const githubResponse = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'follow'
    });

    // Bắt lấy luồng dữ liệu (Stream) từ GitHub
    const body = githubResponse.body;
    
    // Tạo bộ Response mới để tiêm Header CORS
    const newResponse = new Response(body, {
      status: githubResponse.status,
      headers: new Headers(githubResponse.headers)
    });
    
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    newResponse.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

    return newResponse;
  } catch (err) {
    return new Response('Proxy Error: ' + err.message, { status: 500 });
  }
}