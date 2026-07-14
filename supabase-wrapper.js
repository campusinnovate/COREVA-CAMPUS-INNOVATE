(function() {
  var RETRIES = 3;
  var TIMEOUT_MS = 20000;

  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function isRetryableStatus(status) {
    return [408, 502, 503, 504, 522, 525].indexOf(status) !== -1;
  }

  function friendlyMessage(err) {
    if (!err) return 'Terjadi kesalahan yang tidak diketahui.';
    var msg = (err.message || err.error_description || '').toLowerCase();
    var code = err.status || err.code || 0;
    if (code === 522) return 'Koneksi ke server terputus (522). Silakan coba lagi.';
    if (code === 525) return 'Gagal membuat koneksi aman (525). Silakan coba lagi.';
    if (code === 502) return 'Server sedang sibuk (502). Silakan coba lagi.';
    if (code === 503) return 'Server tidak tersedia (503). Silakan coba lagi.';
    if (code === 504) return 'Server lambat merespons (504). Silakan coba lagi.';
    if (code === 408 || msg.indexOf('timeout') !== -1) return 'Waktu koneksi habis. Periksa koneksi internet Anda.';
    if (msg.indexOf('fetch failed') !== -1 || msg.indexOf('failed to fetch') !== -1 || msg.indexOf('network') !== -1) return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
    if (msg.indexOf('econnrefused') !== -1 || msg.indexOf('enotfound') !== -1) return 'Server tidak dapat dijangkau. Coba lagi nanti.';
    return err.message || err.error_description || 'Terjadi kesalahan jaringan.';
  }

  function isRetryableError(err) {
    if (!err) return false;
    var msg = (err.message || err.error_description || '').toLowerCase();
    var code = err.status || err.code || 0;
    if (isRetryableStatus(code)) return true;
    if (msg.indexOf('timeout') !== -1 || msg.indexOf('timed out') !== -1) return true;
    if (msg.indexOf('fetch failed') !== -1 || msg.indexOf('failed to fetch') !== -1) return true;
    if (msg.indexOf('network') !== -1 || msg.indexOf('econnrefused') !== -1) return true;
    if (msg.indexOf('enotfound') !== -1 || msg.indexOf('connection') !== -1) return true;
    return false;
  }

  var originalFetch = window.fetch.bind(window);

  window.supabaseFetchFn = async function(url, options) {
    var lastErr = null;
    for (var attempt = 1; attempt <= RETRIES; attempt++) {
      var timedOut = false;
      try {
        var response = await Promise.race([
          originalFetch(url, options),
          new Promise(function(_, reject) {
            setTimeout(function() {
              timedOut = true;
              reject(new Error('Request timeout'));
            }, TIMEOUT_MS);
          })
        ]);

        if (response.ok) return response;

        if (isRetryableStatus(response.status)) {
          lastErr = { message: 'HTTP ' + response.status, status: response.status };
          if (attempt < RETRIES) {
            await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
            continue;
          }
          throw new Error(friendlyMessage({ status: response.status }));
        }

        return response;
      } catch (err) {
        lastErr = err;
        if (attempt === RETRIES) break;
        if (timedOut || isRetryableError(err)) {
          await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
          continue;
        }
        throw err;
      }
    }
    throw new Error(friendlyMessage(lastErr));
  };

  // Legacy wrapper for explicit per-call use
  window.supabaseFetch = async function(queryFn, retries) {
    if (retries === undefined) retries = RETRIES;
    var lastError = null;
    for (var attempt = 1; attempt <= retries; attempt++) {
      try {
        var result = await Promise.race([
          queryFn(),
          new Promise(function(_, reject) {
            setTimeout(function() {
              reject({ message: 'Request timeout', status: 408 });
            }, TIMEOUT_MS);
          })
        ]);
        if (result && result.error) {
          if (isRetryableError(result.error)) {
            lastError = result.error;
            if (attempt < retries) {
              await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
              continue;
            }
            result.error.message = friendlyMessage(result.error);
            return result;
          }
          return result;
        }
        return result;
      } catch (err) {
        lastError = err;
        if (attempt === retries || !isRetryableError(err)) {
          return { data: null, error: { message: friendlyMessage(err), status: err.status || 0 } };
        }
        await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
      }
    }
    return { data: null, error: { message: friendlyMessage(lastError), status: (lastError && lastError.status) || 0 } };
  };

})();
