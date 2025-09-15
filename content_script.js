const deleteAllTweets = async () => {
  const processed = new Set();
  let totalProcessed = 0;
  
  const selectors = {
    tweet: '[data-testid="tweet"]',
    caret: '[data-testid="caret"]',
    menuItem: '[role="menuitem"]',
    deleteConfirm: '[data-testid="confirmationSheetConfirm"]',
    unretweet: '[data-testid="unretweet"]',
    unretweetConfirm: '[data-testid="unretweetConfirm"]',
    modal: '[role="dialog"]'
  };

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  const getVisibleButtons = () =>
    Array.from(document.querySelectorAll(`${selectors.tweet} ${selectors.caret}`))
      .filter(b => !processed.has(b) && 
                   b.offsetParent !== null && 
                   !b.disabled && 
                   b.getBoundingClientRect().top >= -200 && 
                   b.getBoundingClientRect().bottom <= window.innerHeight + 200);

  const closeModals = async () => {
    const modals = document.querySelectorAll(selectors.modal);
    for (const modal of modals) {
      if (modal.style.display !== 'none') {
        // ESCキー送信のみ（高速）
        modal.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'Escape', 
          code: 'Escape', 
          keyCode: 27,
          bubbles: true
        }));
        await delay(10);
      }
    }
  };

  const attemptDelete = async button => {
    try {
      if (!button.offsetParent || button.disabled || !document.body.contains(button)) {
        return false;
      }

      processed.add(button);
      
      await closeModals();
      await delay(10);

      button.focus();
      button.click();
      await delay(30); // メニュー表示待ち（短縮）

      // 即時メニュー検索（遅延なし）
      const menuItems = document.querySelectorAll(selectors.menuItem);
      
      // Deleteオプション（超高速検索）
      const deleteTexts = ['Delete', '削除', 'Supprimer', 'Löschen', 'Eliminar'];
      const deleteOption = Array.from(menuItems).find(item => 
        deleteTexts.some(text => item.textContent.trim().includes(text))
      );

      if (deleteOption && deleteOption.offsetParent !== null) {
        deleteOption.click();
        await delay(30); // 確認ダイアログ表示待ち（短縮）

        const confirm = document.querySelector(selectors.deleteConfirm);
        if (confirm && confirm.offsetParent !== null) {
          confirm.click();
          await delay(300); // 削除完了待ち（最小限）
          totalProcessed++;
          return true;
        }
      }

      // Unretweet（即時実行・高速）
      const tweet = button.closest(selectors.tweet);
      if (tweet) {
        const unretweetBtn = tweet.querySelector(selectors.unretweet);
        if (unretweetBtn && unretweetBtn.offsetParent !== null) {
          unretweetBtn.click();
          await delay(30);

          const unretweetConfirm = document.querySelector(selectors.unretweetConfirm);
          if (unretweetConfirm && unretweetConfirm.offsetParent !== null) {
            unretweetConfirm.click();
            await delay(300);
            totalProcessed++;
            return true;
          }
        }
      }

      // メニューを閉じる（高速）
      document.body.click();
      await delay(10);
      
    } catch (err) {
      // 最小限のエラーハンドリング
      document.body.click();
      await delay(10);
    }
    
    return false;
  };

  const isComplete = () => {
    const buttons = getVisibleButtons();
    const tweets = document.querySelectorAll(selectors.tweet);
    return buttons.length === 0 && tweets.length <= 1; // より厳格な完了条件
  };

  // 開始ボタンを非表示にする
  const startButton = document.getElementById('tweet-deleter-start');
  if (startButton) {
    startButton.style.display = 'none';
    startButton.textContent = '⚡ 超高速実行中...';
  }

  console.log('⚡ 超高速削除開始！（極限最適化版）');
  console.log('5並列処理 + 最小遅延で画面内ツイートを削除します');
  
  let batchCount = 0;
  const maxBatches = 1000; // 安全停止条件
  
  while (!isComplete() && batchCount < maxBatches) {
    batchCount++;
    const buttons = getVisibleButtons();
    
    if (buttons.length === 0) {
      await delay(50); // 再チェック間隔（短縮）
      continue;
    }

    console.log(`⚡ バッチ ${batchCount}: ${buttons.length}件超高速処理（累計: ${totalProcessed}件）`);
    
    // 超並列処理（最大5つ同時）
    const processBatch = async () => {
      // 並列処理（5つ同時）
      const parallelPromises = [];
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const button = buttons[i];
        parallelPromises.push(
          attemptDelete(button).then(success => {
            if (success) totalProcessed++;
          })
        );
      }
      
      await Promise.all(parallelPromises);
      
      // 残りを高速逐次処理（超短間隔）
      for (let i = 5; i < buttons.length; i++) {
        const button = buttons[i];
        await attemptDelete(button).then(success => {
          if (success) totalProcessed++;
        });
        await delay(10); // 超短間隔
      }
    };
    
    await processBatch();
    
    // 高速進行状況ログ（10件ごと）
    if (totalProcessed % 10 === 0 && totalProcessed > 0) {
      console.log(`⚡ 高速進行中: ${totalProcessed}件削除完了`);
    }
    
    await delay(20); // バッチ間待機（短縮）
  }

  console.log('=== 超高速処理完了 ===');
  console.log(`✅ 総削除件数: ${totalProcessed}件`);
  console.log(`⏱️ 処理時間: ${batchCount}バッチ`);
  console.log('📋 画面内の全ツイートを処理しました');
  console.log('🔄 次のバッチのために手動でページをスクロールしてください');
  
  // ボタンを再表示（次の実行用）
  if (startButton) {
    startButton.style.display = 'block';
    startButton.innerHTML = `⚡ 再実行（${totalProcessed}件完了）`;
    startButton.style.background = 'linear-gradient(45deg, #4ecdc4, #44a08d)';
  }
  
  // 高速完了通知
  setTimeout(() => {
    console.log('\n⚡ 超高速モードでの最適化：');
    console.log('• 5並列同時処理');
    console.log('• 最小遅延（10-30ms）');
    console.log('• 画面範囲拡張（±200px）');
    console.log('\n🔄 次のステップ：');
    console.log('1. ページを下にスクロール');
    console.log('2. 「再実行」ボタンをクリック');
    console.log('3. またはF5で更新');
  }, 1000); // 通知も高速化
};

// 開始ボタンの作成とイベントリスナー設定（高速版）
const createStartButton = () => {
  // 既存のボタンがあれば削除
  const existingButton = document.getElementById('tweet-deleter-start');
  if (existingButton) {
    existingButton.remove();
  }

  // 新しいボタンを作成（高速表示）
  const button = document.createElement('button');
  button.id = 'tweet-deleter-start';
  button.innerHTML = '⚡ 超高速ツイート削除';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 99999;
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 25px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 180px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // 高速ホバー効果
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)';
    button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
  });

  // クリックイベント（即時実行）
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteAllTweets();
  });

  // ページに追加
  document.body.appendChild(button);

  console.log('⚡ 超高速削除ボタンを表示しました。クリックで即時実行！');
};

// ページ読み込み完了後にボタンを作成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createStartButton);
} else {
  createStartButton();
}

// 高速SPA対応（MutationObserver最適化）
let currentUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    // 遅延を短縮（500ms→200ms）
    setTimeout(createStartButton, 200);
  }
});
observer.observe(document.body, { 
  subtree: true, 
  childList: true,
  attributes: false 
});

// メモリリーク防止
window.addEventListener('beforeunload', () => {
  observer.disconnect();
});