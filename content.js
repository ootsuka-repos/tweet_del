"use strict";

// グローバル変数
var tweets_to_delete = [];
var stop_signal = false;
let isExtensionMode = true;
let delete_options = {
    "from_archive": false,
    "unretweet": false,
    "do_not_remove_pinned_tweet": false,
    "delete_message_with_url_only": false,
    "delete_specific_ids_only": [],
    "match_any_keywords": [""],
    "tweets_to_ignore": [],
    "old_tweets": false,
    "after_date": new Date('1900-01-01'),
    "before_date": new Date('2100-01-01')
};

// 認証情報
var authorization = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
var ua = navigator.userAgentData ? navigator.userAgentData.brands.map(brand => `"${brand.brand}";v="${brand.version}"`).join(', ') : '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
var client_tid = "ext_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
var client_uuid = "ext_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
var csrf_token = "";
var random_resource = "uYU5M2i12UhDvDTzN6hZPg";
var random_resource_old_tweets = "H8OOoI-5ZE4NxgRr8lfyWg";
var language_code = navigator.language ? navigator.language.split("-")[0] : "ja";
var user_id = "";
var username = window.location.pathname.split('/')[1] || "user";

// 初期化状態
let isInitialized = false;

// ユーティリティ関数
function getCookie(name) {
    try {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    } catch (e) {
        console.warn("Cookie取得エラー:", e);
    }
    return "";
}

function buildAcceptLanguageString() {
    const languages = navigator.languages || [navigator.language || "ja"];
    if (!languages || languages.length === 0) {
        return "ja,en;q=0.9,en-US;q=0.8";
    }
    let q = 1;
    const decrement = 0.1;
    return languages.slice(0, 3).map(lang => {
        if (q < 1) {
            const result = `${lang};q=${q.toFixed(1)}`;
            q -= decrement;
            return result;
        }
        q -= decrement;
        return lang;
    }).join(',');
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 認証情報初期化
async function initializeAuth() {
    if (isInitialized) {
        console.log("✅ 認証情報既に初期化済み");
        return { success: true };
    }
    
    console.log("🔄 認証情報初期化開始");
    
    try {
        // Cookieから基本情報取得
        csrf_token = getCookie("ct0") || "";
        const twid = getCookie("twid");
        
        if (twid && twid.startsWith("u%3D")) {
            user_id = twid.substring(5);
            console.log("✅ user_id取得:", user_id.substring(0, 8) + "...");
        } else {
            console.error("❌ twid cookieなし。ログインしてください");
            return { success: false, error: "ログイン情報がありません" };
        }
        
        if (!csrf_token) {
            console.error("❌ CSRFトークン取得失敗");
            return { success: false, error: "CSRFトークン取得失敗" };
        }
        
        // ユーザー名設定
        if (!username || username === "user") {
            username = window.location.pathname.split('/')[1] || user_id.substring(0, 8);
        }
        
        console.log("✅ 認証情報設定完了:", {
            userId: user_id.substring(0, 8) + "...",
            username: username,
            csrf: csrf_token.substring(0, 10) + "..."
        });
        
        isInitialized = true;
        return { success: true };
        
    } catch (error) {
        console.error("❌ 認証初期化エラー:", error);
        return { success: false, error: error.message };
    }
}

// Content script通信
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    console.log("🔌 Chrome拡張機能モード検出");
    
    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        console.log("📨 メッセージ受信:", request.action);
        
        if (request.action === "ping") {
            const initResult = await initializeAuth();
            sendResponse({
                pong: true,
                initialized: isInitialized,
                authStatus: initResult.success ? 'OK' : initResult.error,
                userId: user_id || '未取得',
                username: username || '未取得'
            });
            return true;
        }
        
        if (request.action === "startFullDeletion") {
            const initResult = await initializeAuth();
            if (!initResult.success) {
                sendResponse({ status: `認証エラー: ${initResult.error}`, type: "error" });
                return true;
            }
            
            try {
                console.log("🗑️ 全削除開始");
                const result = await startFullDeletion();
                sendResponse(result);
            } catch (error) {
                console.error("❌ 全削除エラー:", error);
                sendResponse({ status: `エラー: ${error.message}`, type: "error" });
            }
            return true;
        }
    });
    
    // ページ読み込み時初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            console.log("📱 Content script読み込み完了");
            await initializeAuth();
        });
    } else {
        initializeAuth().then(result => {
            if (result.success) {
                console.log("✅ 即時初期化成功");
            }
        });
    }
    
    console.log("=== Tweet Deleter (拡張機能モード) ===");
    console.log("準備完了。メッセージ待機中...");
    
} else {
    console.log("🌐 スタンドアロンモード");
    // 元のスクリプトとして実行（省略）
}

// 全削除メイン関数
async function startFullDeletion() {
    if (!isInitialized || !user_id || !csrf_token) {
        throw new Error("認証情報が不足しています");
    }
    
    console.log("🚀 全ツイート削除開始");
    console.log("ユーザー:", username);
    console.log("User ID:", user_id);
    
    tweets_to_delete = [];
    stop_signal = false;
    let next = null;
    let totalDeleted = 0;
    let iteration = 0;
    const maxIterations = 100;
    
    try {
        while (next !== "finished" && !stop_signal && iteration < maxIterations) {
            iteration++;
            console.log(`\n🔄 ループ ${iteration}/${maxIterations}`);
            
            try {
                const entries = await fetch_tweets(next);
                next = await log_tweets(entries);
                
                console.log(`📊 検出: ${tweets_to_delete.length}件`);
                
                if (tweets_to_delete.length > 0) {
                    console.log("🗑️ 削除実行中...");
                    const deleted = await delete_tweets(tweets_to_delete);
                    totalDeleted += deleted;
                    tweets_to_delete = [];
                    console.log(`✅ ループ${iteration}: +${deleted}件 (累計: ${totalDeleted})`);
                }
                
                // 次のループ前に待機
                await sleep(2000);
                
            } catch (fetchError) {
                console.error(`❌ ループ${iteration}エラー:`, fetchError.message);
                
                if (fetchError.message.includes("認証") || fetchError.message.includes("Cookie")) {
                    throw fetchError; // 致命的エラー
                }
                
                // 一時的エラーはスキップ
                console.log("⚠️ 一時エラー。次ループへ...");
                await sleep(5000);
                continue;
            }
        }
        
        if (iteration >= maxIterations) {
            console.log("⚠️ 最大ループ回数に達しました");
        }
        
        console.log(`\n🎉 削除完了!`);
        console.log(`📈 総削除数: ${totalDeleted}件`);
        console.log(`🔄 ループ数: ${iteration}回`);
        
        return {
            status: `削除完了: ${totalDeleted}件のツイートを削除しました`,
            type: "success",
            count: totalDeleted,
            iterations: iteration
        };
        
    } catch (error) {
        console.error("💥 致命的エラー:", error.message);
        return {
            status: `エラー: ${error.message}`,
            type: "error"
        };
    }
}

// API関数
async function fetch_tweets(cursor, retry = 0) {
    if (retry > 3) {
        throw new Error("最大リトライ回数超過");
    }
    
    let count = "20";
    let final_cursor = cursor ? `%22cursor%22%3A%22${cursor}%22%2C` : "";
    let resource = delete_options.old_tweets ? random_resource_old_tweets : random_resource;
    let endpoint = delete_options.old_tweets ? "UserTweets" : "UserTweetsAndReplies";
    
    const base_url = `https://x.com/i/api/graphql/${resource}/${endpoint}`;
    
    let variable = "";
    let feature = "";
    
    if (!delete_options.old_tweets) {
        variable = `?variables=%7B%22userId%22%3A%22${user_id}%22%2C%22count%22%3A${count}%2C${final_cursor}%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D`;
        feature = `&features=%7B%22rweb_lists_timeline_redesign_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;
    } else {
        variable = `?variables=%7B%22userId%22%3A%22${user_id}%22%2C%22count%22%3A${count}%2C${final_cursor}%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D`;
        feature = `&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;
    }
    
    const final_url = `${base_url}${variable}${feature}`;
    
    console.log(`🌐 APIリクエスト: ${final_url.substring(0, 80)}...`);
    
    const response = await fetch(final_url, {
        method: "GET",
        headers: {
            "accept": "*/*",
            "accept-language": buildAcceptLanguageString(),
            "authorization": authorization,
            "content-type": "application/json",
            "sec-ch-ua": ua,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-client-transaction-id": client_tid,
            "x-client-uuid": client_uuid,
            "x-csrf-token": csrf_token,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": language_code
        },
        referrer: `https://x.com/${username}`,
        referrerPolicy: "strict-origin-when-cross-origin",
        credentials: "include"
    });
    
    if (!response.ok) {
        console.error(`❌ APIエラー (${response.status}):`, response.statusText);
        
        if (response.status === 429) {
            console.log("⏳ レート制限検出。60秒待機...");
            await sleep(60000);
            return fetch_tweets(cursor, retry + 1);
        }
        
        if (retry >= 3) {
            throw new Error(`APIリクエスト失敗 (ステータス: ${response.status})`);
        }
        
        console.log(`🔄 リトライ ${retry + 1}/3 (${(retry + 1) * 10}秒後)`);
        await sleep(10000 * (retry + 1));
        return fetch_tweets(cursor, retry + 1);
    }
    
    const data = await response.json();
    console.log("📥 API応答受信");
    
    // データ構造解析
    let entries = data?.data?.user?.result?.timeline_v2?.timeline?.instructions || [];
    
    if (!entries.length) {
        console.warn("⚠️ instructionsが見つかりません。代替パスを試行");
        // 代替パス
        entries = data?.data?.timeline?.instructions || 
                 data?.instructions || 
                 data?.timeline?.instructions || [];
    }
    
    // TimelineAddEntries展開
    for (let item of entries) {
        if (item?.type === "TimelineAddEntries" && Array.isArray(item.entries)) {
            entries = item.entries;
            console.log("📂 TimelineAddEntries展開:", entries.length, "エントリ");
            break;
        }
    }
    
    console.log(`✅ ツイート取得成功: ${entries.length}エントリ`);
    return entries;
}

async function log_tweets(entries) {
    let tweetCount = 0;
    let cursor = null;
    
    for (let item of entries) {
        const entryId = item.entryId;
        if (entryId?.startsWith("tweet-") || entryId?.startsWith("profile-conversation")) {
            findTweetIds(item);
            tweetCount++;
        } else if (entryId?.startsWith("cursor-bottom") && entries.length > 2) {
            cursor = item.content?.value;
            if (cursor) {
                console.log("📍 次のカーソル取得");
            }
        }
    }
    
    console.log(`📊 ${tweetCount}件のツイートを検出`);
    return cursor || "finished";
}

// フィルタ関数
function check_filter(tweet) {
    // 無視リストチェック
    if (tweet?.legacy?.id_str) {
        const id = tweet.legacy.id_str;
        if (delete_options.tweets_to_ignore.includes(id) || 
            delete_options.tweets_to_ignore.some(ignoreId => parseInt(ignoreId) == id)) {
            console.log("⏭️ 無視リストに該当:", id.substring(0, 10) + "...");
            return false;
        }
    }
    
    // 日付フィルター
    if (tweet?.legacy?.created_at) {
        const tweetDate = new Date(tweet.legacy.created_at);
        tweetDate.setHours(0, 0, 0, 0);
        
        if (tweetDate < delete_options.after_date) {
            stop_signal = true;
            console.log("📅 日付範囲外（古すぎ）:", tweetDate.toISOString().split('T')[0]);
            return false;
        }
        
        if (tweetDate >= delete_options.before_date) {
            console.log("📅 日付範囲外（新しすぎ）:", tweetDate.toISOString().split('T')[0]);
            return false;
        }
    }
    
    return true;
}

function check_tweet_owner(obj, uid) {
    // リツイートはスキップ
    if (obj?.legacy?.retweeted === true && !delete_options.unretweet) {
        return false;
    }
    
    // 所有者判定
    return obj?.user_id_str === uid || 
           obj?.legacy?.user_id_str === uid ||
           obj?.result?.legacy?.user_id_str === uid;
}

function tweetFound(obj) {
    const text = obj?.legacy?.full_text || obj?.full_text || "（テキストなし）";
    const preview = text.length > 40 ? text.substring(0, 40) + "..." : text;
    const id = obj?.legacy?.id_str || obj?.id_str || "不明";
    console.log(`📝 ${preview} [${id.substring(0, 8)}...]`);
}

// ツイートID抽出
function findTweetIds(obj) {
    function recurse(currentObj) {
        if (typeof currentObj !== 'object' || currentObj === null) return;
        
        // ピン留め保護
        if (delete_options.do_not_remove_pinned_tweet && 
            currentObj.__type === "TimelinePinEntry") {
            return;
        }
        
        // TweetWithVisibilityResults
        if (currentObj.__typename === 'TweetWithVisibilityResults' && currentObj.tweet) {
            const tweet = currentObj.tweet;
            if (check_tweet_owner(tweet, user_id) && check_filter(tweet)) {
                const tweetId = tweet.id_str || tweet.legacy?.id_str;
                if (tweetId && !tweets_to_delete.includes(tweetId)) {
                    tweets_to_delete.push(tweetId);
                    tweetFound(tweet);
                }
                return; // 再帰不要
            }
        }
        
        // 通常Tweet
        if (currentObj.__typename === 'Tweet') {
            if (check_tweet_owner(currentObj, user_id) && check_filter(currentObj)) {
                const tweetId = currentObj.id_str || currentObj.legacy?.id_str;
                if (tweetId && !tweets_to_delete.includes(tweetId)) {
                    tweets_to_delete.push(tweetId);
                    tweetFound(currentObj);
                }
                return;
            }
        }
        
        // 再帰探索
        Object.values(currentObj).forEach(value => {
            if (typeof value === 'object' && value !== null) {
                recurse(value);
            }
        });
    }
    
    recurse(obj);
}

// 削除実行
async function delete_tweets(id_list) {
    if (!id_list || id_list.length === 0) {
        console.log("⚠️ 削除対象なし");
        return 0;
    }
    
    const delete_resource = "VaenaVgh5q5ih7kvyVjgtg";
    const total = id_list.length;
    let success = 0;
    let failed = 0;
    let retryCount = 0;
    
    console.log(`🗑️ 削除開始: ${total}件`);
    
    for (let i = 0; i < total; i++) {
        const tweetId = id_list[i].toString().trim();
        
        if (!/^\d{15,20}$/.test(tweetId)) {
            console.log(`⏭️ 無効IDスキップ [${i+1}/${total}]: ${tweetId.substring(0,8)}`);
            failed++;
            continue;
        }
        
        console.log(`[${i+1}/${total}] 削除: ${tweetId.substring(0,8)}...`);
        
        try {
            const response = await fetch(`https://x.com/i/api/graphql/${delete_resource}/DeleteTweet`, {
                method: "POST",
                headers: {
                    "accept": "*/*",
                    "accept-language": buildAcceptLanguageString(),
                    "authorization": authorization,
                    "content-type": "application/json",
                    "sec-ch-ua": ua,
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-client-transaction-id": client_tid,
                    "x-client-uuid": client_uuid,
                    "x-csrf-token": csrf_token,
                    "x-twitter-active-user": "yes",
                    "x-twitter-auth-type": "OAuth2Session",
                    "x-twitter-client-language": language_code
                },
                referrer: `https://x.com/${username}`,
                referrerPolicy: "strict-origin-when-cross-origin",
                body: JSON.stringify({
                    variables: { tweet_id: tweetId, dark_request: false },
                    queryId: delete_resource
                }),
                credentials: "include"
            });
            
            if (response.ok) {
                console.log(`  ✅ 成功`);
                success++;
            } else {
                console.log(`  ❌ 失敗 (${response.status})`);
                
                if (response.status === 429) {
                    console.log("  ⏳ レート制限。15秒待機...");
                    await sleep(15000);
                    i--; // 再試行
                    continue;
                }
                
                failed++;
                if (retryCount < 2) {
                    console.log(`  🔄 リトライ (${(retryCount+1)*3}秒後)`);
                    await sleep(3000 * (retryCount + 1));
                    i--;
                    retryCount++;
                }
            }
            
        } catch (error) {
            console.log(`  💥 例外: ${error.message}`);
            failed++;
        }
        
        // 間隔調整
        if (i < total - 1) {
            await sleep(1200);
        }
    }
    
    console.log(`\n📊 結果:`);
    console.log(`  成功: ${success}件`);
    console.log(`  失敗: ${failed}件`);
    console.log(`  成功率: ${total > 0 ? Math.round(success/total*100) : 0}%`);
    
    return success;
}

// 全削除メイン関数
async function startFullDeletion() {
    console.log("🗑️ 全ツイート削除開始");
    
    // 認証確認
    const initResult = await initializeAuth();
    if (!initResult.success) {
        throw new Error(initResult.error || "認証エラー");
    }
    
    if (!user_id || !csrf_token) {
        throw new Error("認証情報不足");
    }
    
    tweets_to_delete = [];
    stop_signal = false;
    let next = null;
    let totalDeleted = 0;
    let iteration = 0;
    const maxIterations = 50;
    
    try {
        while (next !== "finished" && !stop_signal && iteration < maxIterations) {
            iteration++;
            console.log(`\n🔄 取得ループ ${iteration}/${maxIterations}`);
            
            const entries = await fetch_tweets(next);
            next = await log_tweets(entries);
            
            if (tweets_to_delete.length > 0) {
                console.log(`🗑️ 削除実行: ${tweets_to_delete.length}件`);
                const deleted = await delete_tweets(tweets_to_delete);
                totalDeleted += deleted;
                tweets_to_delete = [];
                console.log(`✅ ループ${iteration}: +${deleted}件 (累計: ${totalDeleted})`);
            } else {
                console.log(`ℹ️ ループ${iteration}: 削除対象なし`);
            }
            
            await sleep(2500); // API負荷軽減
        }
        
        console.log(`\n🎉 全削除完了!`);
        console.log(`📊 総削除数: ${totalDeleted}件 (${iteration}ループ)`);
        
        return {
            status: `成功: ${totalDeleted}件削除完了`,
            type: "success",
            count: totalDeleted
        };
        
    } catch (error) {
        console.error("💥 削除エラー:", error.message);
        return {
            status: `エラー: ${error.message}`,
            type: "error"
        };
    }
}

// 公開API（手動テスト用）
window.startFullDeletion = startFullDeletion;
window.tweets_to_delete = tweets_to_delete;
window.user_id = user_id;
window.delete_options = delete_options;

console.log("=== Tweet Deleter 拡張機能 ===");
console.log("状態: 読み込み完了");
console.log("モード: 全自動削除");
console.log("待機中... (popupからのメッセージを待機)");