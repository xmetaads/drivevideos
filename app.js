(() => {
  'use strict';

  const config = window.DOWNLOAD_CONFIG;
  const downloadButtons = [...document.querySelectorAll('[data-download]')];
  const cancelButton = document.getElementById('cancelButton');
  const statusText = document.getElementById('statusText');
  const byteText = document.getElementById('byteText');
  const messageText = document.getElementById('messageText');
  const progressTrack = document.getElementById('progressTrack');
  const progressBar = document.getElementById('progressBar');

  const state = {
    active: false,
    abortController: null,
    writable: null,
    compressedBytes: 0,
    outputBytes: 0,
    compressedTotal: null
  };

  function formatBytes(value) {
    if (!Number.isFinite(value) || value < 0) return 'unknown';
    if (value < 1024) return `${value} B`;

    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = -1;

    do {
      size /= 1024;
      unitIndex += 1;
    } while (size >= 1024 && unitIndex < units.length - 1);

    return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
  }

  function renderConfiguration() {
    if (!config) {
      setMessage('Missing DOWNLOAD_CONFIG in config.js.', 'error');
      setDownloadEnabled(false);
      return;
    }

    const source = new URL(config.sourceUrl);
    const productLabel = `${config.productName} ${config.version}`;

    document.title = `${productLabel} — Installer download`;
    document.getElementById('headerFilename').textContent = config.filename;
    document.getElementById('productTitle').textContent = productLabel;
    document.getElementById('sourceHost').textContent = source.hostname;
    document.getElementById('detailFilename').textContent = config.filename;
    document.getElementById('detailPublisher').textContent = config.publisher;
    document.getElementById('detailSource').textContent = config.sourceUrl;
    document.getElementById('detailSha').textContent = config.sha256;
  }

  function validateConfiguration() {
    if (!config || typeof config !== 'object') {
      throw new Error('Download configuration is missing.');
    }

    const source = new URL(config.sourceUrl);

    if (source.protocol !== 'https:') {
      throw new Error('The installer source must use HTTPS.');
    }

    if (!/^[^\\/:*?"<>|]+\.exe$/i.test(config.filename)) {
      throw new Error('The public filename must be a valid .exe filename.');
    }

    if (config.sourceEncoding !== 'gzip') {
      throw new Error('This build expects a raw gzip source package.');
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      throw new Error('StreamSaver requires HTTPS in production.');
    }

    if (!window.streamSaver) {
      throw new Error('StreamSaver assets are unavailable. Run npm install before deployment.');
    }

    if (typeof WritableStream !== 'function' || typeof TransformStream !== 'function') {
      throw new Error('This browser does not support the required Web Streams APIs.');
    }

    if (typeof DecompressionStream !== 'function') {
      throw new Error('This browser cannot decompress gzip streams.');
    }
  }

  function setDownloadEnabled(enabled) {
    for (const button of downloadButtons) {
      button.disabled = !enabled;
    }
  }

  function setMessage(message, tone = '') {
    messageText.textContent = message;
    messageText.className = `message-text${tone ? ` ${tone}` : ''}`;
  }

  function setStatus(status) {
    statusText.textContent = status;
  }

  function resetProgress() {
    state.compressedBytes = 0;
    state.outputBytes = 0;
    state.compressedTotal = null;
    progressTrack.classList.remove('indeterminate');
    progressTrack.setAttribute('aria-valuenow', '0');
    progressBar.style.width = '0%';
    byteText.textContent = 'No data transferred';
  }

  function updateProgress() {
    const compressed = formatBytes(state.compressedBytes);
    const written = formatBytes(state.outputBytes);

    if (state.compressedTotal) {
      const percentage = Math.min(100, (state.compressedBytes / state.compressedTotal) * 100);
      progressTrack.classList.remove('indeterminate');
      progressTrack.setAttribute('aria-valuenow', percentage.toFixed(1));
      progressBar.style.width = `${percentage}%`;
      byteText.textContent = `${compressed} / ${formatBytes(state.compressedTotal)} received • ${written} written`;
    } else {
      progressTrack.classList.add('indeterminate');
      progressTrack.removeAttribute('aria-valuenow');
      byteText.textContent = `${compressed} received • ${written} written`;
    }
  }

  function createTransferCounter() {
    return new TransformStream({
      transform(chunk, controller) {
        if (!(chunk instanceof Uint8Array)) {
          throw new TypeError('The source returned a non-binary stream chunk.');
        }

        state.compressedBytes += chunk.byteLength;
        updateProgress();
        controller.enqueue(chunk);
      }
    });
  }

  function createGzipGuard() {
    let validated = false;
    let bufferedChunks = [];
    let bufferedBytes = 0;

    return new TransformStream({
      transform(chunk, controller) {
        if (validated) {
          controller.enqueue(chunk);
          return;
        }

        bufferedChunks.push(chunk);
        bufferedBytes += chunk.byteLength;

        if (bufferedBytes < 2) return;

        let firstByte;
        let secondByte;
        let position = 0;

        for (const bufferedChunk of bufferedChunks) {
          for (const byte of bufferedChunk) {
            if (position === 0) firstByte = byte;
            if (position === 1) secondByte = byte;
            position += 1;
            if (position === 2) break;
          }
          if (position === 2) break;
        }

        if (firstByte !== 0x1f || secondByte !== 0x8b) {
          throw new Error('The source is not a valid raw gzip package.');
        }

        validated = true;

        for (const bufferedChunk of bufferedChunks) {
          controller.enqueue(bufferedChunk);
        }

        bufferedChunks = [];
      },
      flush() {
        if (!validated) {
          throw new Error('The source gzip package is empty or truncated.');
        }
      }
    });
  }

  function createOutputCounter() {
    return new TransformStream({
      transform(chunk, controller) {
        if (!(chunk instanceof Uint8Array)) {
          throw new TypeError('The decompressor returned a non-binary stream chunk.');
        }

        state.outputBytes += chunk.byteLength;
        updateProgress();
        controller.enqueue(chunk);
      }
    });
  }

  function explainError(error) {
    if (error?.name === 'AbortError') {
      return 'Download canceled. Delete any incomplete file created by the browser.';
    }

    if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
      return 'The S3 request was blocked before an HTTP response was available. Check the bucket CORS rule, DNS, TLS, and browser network controls.';
    }

    return error?.message || 'The download failed for an unknown reason.';
  }

  function finishSession() {
    state.active = false;
    state.abortController = null;
    state.writable = null;
    setDownloadEnabled(true);
    cancelButton.hidden = true;
  }

  async function startDownload(event) {
    const hasActiveUserGesture =
      event.isTrusted &&
      (!navigator.userActivation || navigator.userActivation.isActive);

    if (!hasActiveUserGesture) {
      setMessage('Download ignored because it was not initiated by a real user action.', 'warning');
      return;
    }

    if (state.active) return;

    let writable;

    try {
      validateConfiguration();

      window.streamSaver.mitm = new URL(
        './vendor/streamsaver/2.0.6/mitm.html',
        window.location.href
      ).href;
      window.streamSaver.WritableStream = window.WritableStream;
      window.streamSaver.TransformStream = window.TransformStream;

      const streamOptions = Number.isSafeInteger(config.outputSizeBytes) && config.outputSizeBytes > 0
        ? { size: config.outputSizeBytes }
        : undefined;

      // Keep this synchronous and directly inside the trusted click handler.
      writable = window.streamSaver.createWriteStream(config.filename, streamOptions);
    } catch (error) {
      setStatus('Unavailable');
      setMessage(explainError(error), 'error');
      return;
    }

    state.active = true;
    state.writable = writable;
    state.abortController = new AbortController();
    resetProgress();
    setDownloadEnabled(false);
    cancelButton.hidden = false;
    setStatus('Connecting');
    setMessage('Connecting to the published S3 source…');

    try {
      const response = await fetch(config.sourceUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        signal: state.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Source returned HTTP ${response.status} ${response.statusText}.`);
      }

      if (!response.body) {
        throw new Error('The source response does not contain a readable body.');
      }

      const contentEncoding = response.headers.get('Content-Encoding');

      if (contentEncoding && contentEncoding.toLowerCase() !== 'identity') {
        throw new Error(
          'The source uses HTTP Content-Encoding. Store the .gz object as raw application/gzip to prevent double decompression.'
        );
      }

      const contentLength = Number.parseInt(response.headers.get('Content-Length') || '', 10);
      state.compressedTotal = Number.isSafeInteger(contentLength) && contentLength > 0
        ? contentLength
        : null;

      setStatus('Downloading and writing');
      setMessage('Receiving the gzip package, validating it, and writing the decompressed installer…');
      updateProgress();

      await response.body
        .pipeThrough(createTransferCounter())
        .pipeThrough(createGzipGuard())
        .pipeThrough(new DecompressionStream('gzip'))
        .pipeThrough(createOutputCounter())
        .pipeTo(writable, { signal: state.abortController.signal });

      progressTrack.classList.remove('indeterminate');
      progressTrack.setAttribute('aria-valuenow', '100');
      progressBar.style.width = '100%';
      setStatus('Complete');
      setMessage(
        `Download completed after writing ${formatBytes(state.outputBytes)}. Verify the publisher and checksum before running the installer.`,
        'success'
      );
    } catch (error) {
      try {
        await writable.abort(error);
      } catch {
        // The pipeline may already have aborted the destination.
      }

      const canceled = error?.name === 'AbortError';
      setStatus(canceled ? 'Canceled' : 'Failed');
      setMessage(explainError(error), canceled ? 'warning' : 'error');
    } finally {
      finishSession();
    }
  }

  function cancelDownload(event) {
    if (!event.isTrusted || !state.active) return;
    state.abortController?.abort(new DOMException('Canceled by the user.', 'AbortError'));
  }

  for (const button of downloadButtons) {
    button.addEventListener('click', startDownload);
  }

  cancelButton.addEventListener('click', cancelDownload);

  window.addEventListener('beforeunload', (event) => {
    if (!state.active) return;
    event.preventDefault();
    event.returnValue = '';
  });

  window.addEventListener('pagehide', () => {
    if (state.active) {
      state.abortController?.abort(new DOMException('Page closed.', 'AbortError'));
    }
  });

  try {
    renderConfiguration();
    validateConfiguration();
    setStatus('Ready');
  } catch (error) {
    setStatus('Configuration required');
    setMessage(explainError(error), 'warning');
  }
})();
