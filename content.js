(function () {
  const STATE = {
    running: false,
    options: { max: 50, autoScroll: true, delayMin: 1200, delayMax: 2200 },
    stats: { deleted: 0, skipped: 0, failures: 0 },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  const log = (...args) => console.log("[TweetDeleter]", ...args);

  const waitFor = async (fnOrSelector, timeout = 2000, interval = 50) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      let v = null;
      if (typeof fnOrSelector === "string") {
        v = document.querySelector(fnOrSelector);
        if (v && visible(v)) return v;
      } else {
        v = fnOrSelector();
        if (v) return v;
      }
      await sleep(interval);
    }
    return null;
  };

  const findTweets = () => {
    const nodes = Array.from(
      document.querySelectorAll('article[data-testid="tweet"], article[role="article"]')
    );
    return nodes.filter((el) => !el.dataset.tdProcessed && visible(el) && el.querySelector('a[href*="/status/"]'));
  };

  const markProcessed = (el, flag) => {
    if (!el) return;
    if (flag) el.dataset.tdProcessed = "1";
    else delete el.dataset.tdProcessed;
  };

  const findMoreButton = (tweet) => {
    const sels = [
      '[data-testid="caret"]',
      'button[aria-label*="More"]',
      'div[aria-label*="More"]',
      'button[aria-label*="さらに表示"]',
      'div[aria-label*="さらに表示"]',
      'button[aria-label*="詳細"]',
      'div[aria-label*="詳細"]',
      'div[role="button"][aria-haspopup="menu"]'
    ];
    for (const s of sels) {
      const b = tweet.querySelector(s);
      if (b && visible(b)) return b;
    }
    return null;
  };

  const openMenu = async (tweet) => {
    const btn = findMoreButton(tweet);
    if (!btn) return null;
    const menusBefore = document.querySelectorAll('[role="menu"]').length;
    btn.click();
    const menu = await waitFor(() => {
      const all = Array.from(document.querySelectorAll('[role="menu"]')).filter(visible);
      if (!all.length) return null;
      if (all.length > menusBefore) return all[all.length - 1];
      return all[all.length - 1];
    }, 2000);
    return menu;
  };

  const getDeleteMenuItem = (menu) => {
    const items = Array.from(menu.querySelectorAll('[role="menuitem"],button,a,div[role="button"]'));
    let item = items.find((el) => ((el.dataset && el.dataset.testid) || "").toLowerCase().includes("delete"));
    if (item) return item;
    const matchText = (el) => {
      const t = (el.innerText || "").trim().toLowerCase();
      return t.includes("delete") || t.includes("削除");
    };
    item = items.find(matchText);
    return item || null;
  };

  const confirmDeleteDialog = async () => {
    const dialog = await waitFor(() => {
      const ds = Array.from(document.querySelectorAll('[role="dialog"], div[aria-modal="true"]')).filter(visible);
      return ds[ds.length - 1] || null;
    }, 2500);
    if (!dialog) return false;
    const buttons = Array.from(dialog.querySelectorAll('button, div[role="button"]'));
    let btn = buttons.find((el) => ((el.dataset && el.dataset.testid) || "").toLowerCase().includes("confirm"));
    if (!btn) {
      btn = buttons.find((el) => {
        const t = (el.innerText || "").trim().toLowerCase();
        return t.includes("delete") || t.includes("削除");
      });
    }
    if (!btn) return false;
    btn.click();
    return true;
  };

  const deleteOneVisible = async () => {
    const tweets = findTweets();
    if (!tweets.length) return false;
    for (const tw of tweets) {
      markProcessed(tw, true);
      try {
        const menu = await openMenu(tw);
        if (!menu) {
          STATE.stats.skipped++;
          continue;
        }
        const del = getDeleteMenuItem(menu);
        if (!del) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          STATE.stats.skipped++;
          continue;
        }
        del.click();
        const confirmed = await confirmDeleteDialog();
        if (!confirmed) {
          STATE.stats.failures++;
          continue;
        }
        const gone = await waitFor(() => !document.body.contains(tw), 5000, 50);
        if (gone) {
          STATE.stats.deleted++;
          return true;
        }
        markProcessed(tw, false);
        STATE.stats.failures++;
      } catch (e) {
        console.error(e);
        STATE.stats.failures++;
      }
    }
    return false;
  };

  const scrollIfNeeded = () => {
    window.scrollBy({ top: Math.max(400, window.innerHeight * 0.8), behavior: 'smooth' });
  };

  const run = async () => {
    const { max, delayMin, delayMax, autoScroll } = STATE.options;
    let done = 0;
    while (STATE.running && done < max) {
      const ok = await deleteOneVisible();
      if (ok) {
        done++;
        await sleep(rand(delayMin, delayMax));
      } else {
        if (!autoScroll) break;
        scrollIfNeeded();
        await sleep(1000);
      }
    }
    STATE.running = false;
    log("Finished", JSON.stringify(STATE.stats));
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'START_DELETE') {
      if (STATE.running) {
        sendResponse({ ok: false, message: 'already running', running: true, stats: STATE.stats });
        return true;
      }
      STATE.options = {
        max: Math.max(1, Number(msg.max) || 50),
        autoScroll: !!msg.autoScroll,
        delayMin: Math.max(300, Number(msg.delayMin) || 1200),
        delayMax: Math.max(Number(msg.delayMin) || 1200, Number(msg.delayMax) || 2200),
      };
      STATE.stats = { deleted: 0, skipped: 0, failures: 0 };
      STATE.running = true;
      run();
      sendResponse({ ok: true, running: true });
      return true;
    }
    if (msg.type === 'STOP_DELETE') {
      STATE.running = false;
      sendResponse({ ok: true, running: false });
      return true;
    }
    if (msg.type === 'GET_STATUS') {
      sendResponse({ ok: true, running: STATE.running, stats: STATE.stats });
      return true;
    }
  });

  window.tweetDeleter = { STATE };
})();

