const qs = (s) => document.querySelector(s);

const setStatus = (msg) => {
  const el = qs('#status');
  if (el) el.textContent = msg;
};

const sendToActiveTab = (message) => new Promise((resolve) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      resolve({ ok: false, error: 'No active tab' });
      return;
    }
    chrome.tabs.sendMessage(tab.id, message, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message });
      } else {
        resolve(resp || { ok: true });
      }
    });
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = qs('#start');
  const stopBtn = qs('#stop');

  const refresh = async () => {
    const resp = await sendToActiveTab({ type: 'GET_STATUS' });
    if (!resp || !resp.ok) {
      setStatus('このタブでは実行できません。X/Twitter を開いてください。');
      return;
    }
    const { running, stats } = resp;
    setStatus(`状態: ${running ? '実行中' : '待機中'}\n削除:${stats?.deleted ?? 0}  /  失敗:${stats?.failures ?? 0}  /  スキップ:${stats?.skipped ?? 0}`);
  };

  startBtn.addEventListener('click', async () => {
    const max = Number(qs('#max').value) || 50;
    const delayMin = Number(qs('#delayMin').value) || 1200;
    const delayMax = Number(qs('#delayMax').value) || 2200;
    const autoScroll = !!qs('#autoScroll').checked;
    setStatus('開始します…');
    const resp = await sendToActiveTab({
      type: 'START_DELETE',
      max,
      delayMin,
      delayMax,
      autoScroll,
    });
    if (!resp || !resp.ok) {
      setStatus(`開始できません: ${resp?.message || resp?.error || '不明なエラー'}`);
    } else {
      setStatus('実行中…');
      await refresh();
    }
  });

  stopBtn.addEventListener('click', async () => {
    const resp = await sendToActiveTab({ type: 'STOP_DELETE' });
    if (!resp || !resp.ok) {
      setStatus(`停止に失敗: ${resp?.error || '不明なエラー'}`);
    } else {
      setStatus('停止しました');
    }
    await refresh();
  });

  await refresh();
  const timer = setInterval(refresh, 1500);
  window.addEventListener('unload', () => clearInterval(timer));
});

