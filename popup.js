document.addEventListener('DOMContentLoaded', function() {
    const deleteButton = document.getElementById('deleteButton');
    const statusDiv = document.getElementById('status');
    const loadingSpinner = document.getElementById('loadingSpinner');

    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = type;
        statusDiv.style.display = 'block';
        
        // 5秒後に自動クリア（エラー以外）
        if (type !== 'error') {
            setTimeout(() => {
                if (statusDiv.textContent === message) {
                    statusDiv.style.display = 'none';
                }
            }, 5000);
        }
    }

    function setLoading(loading) {
        deleteButton.disabled = loading;
        loadingSpinner.style.display = loading ? 'inline-block' : 'none';
        
        if (loading) {
            deleteButton.textContent = '削除実行中...';
            deleteButton.style.backgroundColor = '#007bff';
        } else {
            deleteButton.textContent = 'すべてのツイートを削除';
            deleteButton.style.backgroundColor = '#dc3545';
        }
    }

    async function checkEnvironment() {
        return new Promise((resolve) => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (!tabs[0]) {
                    resolve({valid: false, error: 'タブが見つかりません'});
                    return;
                }
                
                const tab = tabs[0];
                const isX = tab.url && (tab.url.includes('x.com') || tab.url.includes('twitter.com'));
                const isProfile = tab.url && tab.url.match(/x\.com\/[a-zA-Z0-9_]+\/?$/);
                
                if (!isX) {
                    resolve({valid: false, error: 'X.com/Twitterのページで使用してください'});
                } else if (!isProfile) {
                    resolve({valid: false, error: 'プロフィールページ（https://x.com/ユーザー名）で使用してください'});
                } else {
                    // Content script確認
                    chrome.tabs.sendMessage(tab.id, {action: "ping"}, function(response) {
                        if (chrome.runtime.lastError || !response || !response.pong) {
                            resolve({valid: false, error: '準備不足\n1. ページを更新(F5)\n2. 拡張機能を再読み込み'});
                        } else {
                            const status = response.initialized ? '準備完了' : '初期化中';
                            resolve({valid: true, info: `${status} - @${response.username || 'user'}`});
                        }
                    });
                }
            });
        });
    }

    async function startDeletion() {
        const envCheck = await checkEnvironment();
        
        if (!envCheck.valid) {
            showStatus(envCheck.error, 'error');
            return;
        }
        
        showStatus(envCheck.info, 'success');
        setLoading(true);
        showStatus('ツイート削除を開始しています...\nF12コンソールで詳細を確認してください', 'info');

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) {
                showStatus('エラー: タブが見つかりません', 'error');
                setLoading(false);
                return;
            }
            
            const tabId = tabs[0].id;
            
            // Content scriptに削除開始メッセージ送信
            chrome.tabs.sendMessage(tabId, {action: "startFullDeletion"}, function(response) {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message.includes('Could not establish') ? 
                        'Content scriptエラー: ページを更新してください' : 
                        `通信エラー: ${chrome.runtime.lastError.message}`;
                    showStatus(errorMsg, 'error');
                    setLoading(false);
                    return;
                }
                
                if (response && response.status) {
                    showStatus(response.status, response.type || 'info');
                    if (response.type === 'success' || response.type === 'error') {
                        setLoading(false);
                    } else {
                        // 処理中は60秒後にタイムアウト
                        setTimeout(() => {
                            if (loadingSpinner.style.display === 'inline-block') {
                                showStatus('処理が長時間実行中です\nConsole(F12)で状況を確認してください', 'warning');
                                setLoading(false);
                            }
                        }, 60000);
                    }
                } else {
                    // 応答なし = 処理開始
                    showStatus('削除処理が開始されました\nConsole(F12)で進行状況を確認してください', 'info');
                    
                    // 90秒タイムアウト
                    setTimeout(() => {
                        if (loadingSpinner.style.display === 'inline-block') {
                            showStatus('タイムアウト: 処理が完了していない可能性があります\nConsoleを確認してください', 'warning');
                            setLoading(false);
                        }
                    }, 90000);
                }
            });
        });
    }

    // ボタンクリックイベント
    deleteButton.addEventListener('click', startDeletion);

    // 初期環境チェック（2秒後）
    setTimeout(async () => {
        const check = await checkEnvironment();
        if (check.valid) {
            showStatus(check.info, 'success');
        } else {
            showStatus(check.error, 'error');
        }
    }, 2000);

    console.log('Simple Tweet Deleter初期化完了');
});