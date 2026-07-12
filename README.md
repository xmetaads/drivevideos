# DriveVideoSetup transparent downloader

This project keeps the previous dark visual layout while presenting the file honestly as a Windows x64 installer. It uses StreamSaver 2.0.6 only because the current S3 source is gzip-compressed and must be transformed while streaming.

## Setup

1. Run `npm install`. The `prepare` script copies the pinned StreamSaver assets into `vendor/streamsaver/2.0.6/` so the MITM page and service worker are self-hosted.
2. Edit `config.js` and provide the real publisher and SHA-256 value before production use.
3. Serve the directory over HTTPS. `localhost` is accepted for local development.
4. Configure the S3 bucket CORS rule using `s3-cors.example.json`, replacing `https://download.example.com` with the legitimate production origin.

## S3 requirements

- Allow `GET` and `HEAD` from the exact production origin.
- Expose `Content-Length`, `Content-Type`, and `ETag` for progress and diagnostics.
- CORS does not grant object access. The object must still be public or requested through an appropriately scoped presigned URL.
- Ensure the gzip object contains the intended installer and is not double-compressed by another CDN layer.
- Publish an Authenticode-signed installer and a SHA-256 checksum.
- Use a neutral production domain that does not imply affiliation with another company.

## Verification

Run `npm run check`. The check rejects legacy deceptive strings, hidden iframe creation, Edge proxy references, and missing manual-user-gesture protections. Before installing dependencies, `npm run check:source` checks the application source only.

## Production recommendation

When possible, upload the final signed `.exe` directly and set its server-side `Content-Disposition` header. The StreamSaver maintainers recommend native server downloads for files that already live on a server. StreamSaver is retained here for the explicit gzip-to-installer transformation use case.

## Primary references

- StreamSaver: https://github.com/jimmywarting/StreamSaver.js
- Amazon S3 CORS: https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html
