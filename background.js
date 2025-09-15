// background service worker for trusted clicks via DevTools Protocol

// Attach → click → detach per request to avoid holding debugger
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  const tabId = sender?.tab?.id;
  if (!tabId) {
    sendResponse?.({ ok: false, error: 'No sender tab' });
    return; // synchronous path
  }

  if (msg.type === 'DEBUGGER_CLICK') {
    const { x, y } = msg;
    if (typeof x !== 'number' || typeof y !== 'number') {
      sendResponse({ ok: false, error: 'Invalid coordinates' });
      return; // sync
    }

    const target = { tabId };
    const version = '1.3';
    const onError = (prefix) => (chrome.runtime.lastError ? (prefix + ': ' + chrome.runtime.lastError.message) : null);

    chrome.debugger.attach(target, version, () => {
      const attachErr = onError('attach failed');
      if (attachErr) {
        sendResponse({ ok: false, error: attachErr });
        return;
      }

      const sendMouse = (type, extra = {}) => new Promise((resolve) => {
        chrome.debugger.sendCommand(
          target,
          'Input.dispatchMouseEvent',
          {
            type,
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            clickCount: 1,
            buttons: 1,
            ...extra,
          },
          () => resolve(onError('sendCommand failed'))
        );
      });

      (async () => {
        let err = await sendMouse('mousePressed');
        if (!err) err = await sendMouse('mouseReleased');

        chrome.debugger.detach(target, () => {
          const detErr = onError('detach failed');
          if (err && detErr) err += '; ' + detErr;
          sendResponse({ ok: !err, error: err || undefined });
        });
      })();
    });

    return true; // async response
  }
});

