# 要件定義書（TAS データセット作成ツール）

## 1. 目的・スコープ

* **目的**：フレーム厳密な区間選択＋ラベル付与を最小遅延で行い、TAS 用アノテーション（**フレーム番号ベース**）を生成・管理。
* **対象ユーザ**：研究室内外の共同研究者（同時最大 3 名）。
* **動画特性**：1本あたり約3分、H.264/MP4（fMP4/faststart 済）。
* **公開方針**：HTTPS インターネット公開、**軽量認証**（ID/PW or OAuth）。

---

## 2. 全体アーキテクチャ（高速化重視）

* **ブラウザ要件**：Google Chrome（最新版）。
* **フロント**：React + TypeScript / WebCodecs / OffscreenCanvas / Web Worker（UI とデコードを分離）。
* **配信**：Nginx（HTTP Range 対応、`sendfile` 有効、TLS/HTTP/2）。動画は**Nginxから直配信**、API は別 upstream。
* **バックエンド**：Node.js（Fastify もしくは Express）REST + WebSocket（進捗など即時通知）。
* **DB**：SQLite（最小）→ 将来 PostgreSQL へ移行可能。
* **TLS**：Let’s Encrypt（certbot）または Caddy 自動更新。
* **同一オリジン**：`https://annotator.lab-univ.ac.jp/`（アプリ）／`/videos/*.mp4`（動画）で配信し CORS 無し。

---

## 3. 機能要件（FR）

### 3.1 再生・フレーム制御（WebCodecs モード標準）

* \[FR-1] **WebCodecs** でデコーダを初期化し、**1 フレーム単位**でのステップ（advance/rewind）が可能。
* \[FR-2] キーバインド：←/→ で ±1 フレーム、Space 再生/停止、Shift+←/→ で選択範囲伸縮、Home/End で先頭/末尾。
* \[FR-3] **`requestVideoFrameCallback` 連携**（fallback 用 `<video>` 再生時）。
* \[FR-4] **表示フレーム = 現在フレーム番号** を常時 HUD 表示（`currentFrameIndex` 由来・整数）。
* \[FR-5] 任意速度再生（0.25x〜2x）でも**フレーム落ち無し**で UI 同期。

### 3.2 セグメント選択・編集・タイムライン

* \[FR-6] Shift で選択開始→離して確定、完了後にラベル入力。
* \[FR-7] タイムライン（Canvas）上でセグメントのクリック選択／ドラッグで境界調整／Delete で削除。
* \[FR-8] **ズーム（Wheel）、パン（Drag）**、ヒートマップ風の密度表示（任意）。
* \[FR-9] ハイライトフレーム（例：全体 4000f なら 400f ごと）を**10枚**表示、ズーム位置に応じて**動的差し替え**。
* \[FR-10] ハイライトサムネイルはクリックでジャンプ、Hover で拡大プレビュー（100ms 内表示）。

### 3.3 ラベル管理／保存／エクスポート

* \[FR-11] ラベルセットのロード／追加編集（Admin のみ）、色・説明・ホットキー設定。
* \[FR-12] 保存単位：`video_id, start, end, label, annotator_id, created_at, updated_at`（**フレーム番号**）。
* \[FR-13] ローカル自動保存（IndexedDB）＋ サーバ保存（バージョン番号付与）。
* \[FR-14] エクスポート：JSON/CSV（フレーム番号ベース）。インポート：JSON。
* \[FR-15] 複数動画対応、進捗（アノテ率）表示。

### 3.4 認証・権限

* \[FR-16] ログイン（ID/PW or Google/GitHub OAuth）。
* \[FR-17] 権限ロール：Admin/Annotator/Viewer。

---

## 4. 非機能要件（NFR）

### 4.1 性能（Chrome・ローカル/学外混在）

* \[PR-1] **フレームステップ入力 → 画面更新**：平均 **≤ 50 ms**（p95 ≤ 100 ms）。
* \[PR-2] ズーム/パン再描画：**16.7–33 ms**/フレーム（60–30fps 体感）。
* \[PR-3] 初回再生可（最初のフレーム描画）まで **≤ 1000 ms**（fMP4 + Range 前提）。
* \[PR-4] サムネイル生成（幅 60–100px）：**1枚 ≤ 120 ms**、同時生成は **最大2枚**（スロットリング）。
* \[PR-5] 同時 3 クライアント接続時も \[PR-1] を満たす。
* \[PR-6] サムネイル LRU キャッシュ：**最大 200 枚**（メモリ上限 50MB 目安）。

### 4.2 信頼性・整合性

* \[QR-1] FPS を動画メタに保持（固定）し、**`1/fps` 刻みのみ**許容。
* \[QR-2] セグメントの重複/交差は保存時にバリデーションで拒否。
* \[QR-3] 保存時に動画の `hash/size/mtime` を記録、差し替え検出。

### 4.3 セキュリティ

* \[SR-1] HTTPS（TLS1.2+）、HSTS 推奨。
* \[SR-2] 認証失敗 5 回で 10 分ロック。
* \[SR-3] CSRF（SameSite=Lax/Strict）、XSS（CSP + エスケープ）対策。
* \[SR-4] **動画ディレクトリのリスティング禁止**、推測困難な ID 付与。
* \[SR-5] アクセスログ最小化（個人情報・署名 URL 長期保存しない）。

### 4.4 可用性・運用

* \[OP-1] 稼働：平日 9–20 時、計画停止のみ。
* \[OP-2] ログ：リクエスト ID・ユーザ ID・重要イベントは構造化出力（JSON Lines）。
* \[OP-3] バックアップ：DB/アノテ JSON を日次スナップショット（7世代）。

---

## 5. 技術方式（最速スタック）

### 5.1 動画フォーマット・配信

* 入力を **H.264/MP4** に統一、**fMP4 + faststart**。

  * 例：

    ```bash
    ffmpeg -i in.mp4 -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p \
      -movflags +faststart -c:a aac -b:a 128k out.mp4
    ```
* **Nginx** 直配信（Range 有効、`sendfile on; tcp_nopush on;`）。
* HTTP/2 有効（ヘッダ圧縮・多重化）。
* 可能なら **キーフレーム間隔を短縮**（例：`-g 30`）しシーク体感を改善（サイズ増は許容範囲で調整）。

### 5.2 フロント（Chrome 専用最適化）

* **WebCodecs**：`VideoDecoder` + `VideoFrame` を使用、**ワーカー内でデコード**。
* **OffscreenCanvas**：描画はワーカー側で実施、UI スレッドは入力と状態管理に専念。
* **SharedArrayBuffer**（COOP/COEP 設定時）：デコード済みフレームの転送を低オーバーヘッドで共有（任意）。
* **タイムライン**：Canvas の仮想描画（可視領域のみレンダリング、ズーム・パンは transform＋再サンプリング）。
* **サムネイル**：

  * デコード済みフレームから低解像度で生成（ワーカー内 `ImageBitmap` → `OffscreenCanvas` → `convertToBlob`）。
  * **LRU キャッシュ**（メモリ）＋ **IndexedDB** 永続キャッシュ（キー：`video_id@frame`）。
  * スクロール/ズーム中は**スロットリング**（150ms 停止検知後にバッチ生成）。
* **フォールバック**：WebCodecs 非対応時のみ `<video>` + `currentTime` + `requestVideoFrameCallback` で限定動作（Chrome 限定運用なので通常は不要）。

### 5.3 バックエンド API（最小）

```
GET  /api/videos                 # id, title, fps, duration_frames, hash
POST /api/videos                 # 動画登録（メタ情報）
GET  /api/annotations/:vid      # 最新版取得
POST /api/annotations/:vid      # 保存（version 付与、差分または全置換）
GET  /api/labels/:project       # ラベルセット取得
POST /api/labels/:project       # ラベル更新（Admin）
GET  /api/me                    # 認証ユーザ情報
POST /api/login                 # 認証（フォーム or OAuth）
WS   /ws/progress               # 進捗・排他通知（任意）
```

### 5.4 データモデル

* **videos**：`id, title, path, fps, duration_frames, hash, created_at`
* **annotations**：`id, video_id, version, payload_json, updated_by, updated_at`
* **labels**：`project, version, items_json`
* **users**：`id, name, email, role, password_hash|oauth_sub`

### 5.5 ヘッダ・CSP・COOP/COEP

* COOP/COEP を有効化（SharedArrayBuffer 利用時）：

  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
* CSP 最小例：`default-src 'self'; img-src 'self' blob: data:; media-src 'self';` など。

---

## 6. 受け入れ基準（要点）

### 6.1 機能

* \[AT-1] ←/→ で厳密に ±1 フレーム移動（UI 表示フレームが整数で進む）。
* \[AT-2] Shift 範囲選択 → ラベル確定 → タイムラインに反映。
* \[AT-3] タイムライン境界ドラッグで 1 フレーム単位に更新。
* \[AT-4] ハイライト 10 枚がズーム位置に応じて動的変化、クリックでジャンプ。
* \[AT-5] 保存→再読込で一致（整合性、重複・交差なし）。

### 6.2 性能

* \[PT-1] フレームステップ平均 ≤ 50ms（p95 ≤ 100ms）。
* \[PT-2] ズーム/パンのフレーム時間 ≤ 33ms。
* \[PT-3] 初回フレーム描画 ≤ 1000ms。
* \[PT-4] 同時 3 クライアントでも \[PT-1] 満たす。

### 6.3 セキュリティ・運用

* \[ST-1] HTTP→HTTPS 強制、HSTS。
* \[ST-2] 未認証アクセスはログインへ。
* \[ST-3] 動画ディレクトリのリスティング不可。
* \[ST-4] 失敗ログイン 5 回で 10 分ロック。
* \[ST-5] バックアップの世代管理（7 世代）。

---

## 7. 実装計画（高速重視の順序）

1. **配信基盤**：Nginx（HTTPS/HTTP2、Range、sendfile）、動画を fMP4+faststart に整備。
2. **MVP 再生**：WebCodecs で単一動画のデコード→表示（オフスクリーン描画）。
3. **フレーム制御**：±1 フレームステップ、HUD 表示、プレイバック（0.25–2x）。
4. **タイムライン**：Canvas 仮想描画、ズーム/パン、セグメント編集。
5. **サムネイル**：ワーカー内生成、LRU/IndexedDB キャッシュ、10枚ハイライト。
6. **保存系**：IndexedDB 自動保存＋サーバ保存、エクスポート/インポート。
7. **認証**：フォーム or OAuth、ロール制御。
8. **最終調整**：COOP/COEP（SAB 有効化）、CSP、ログ、バックアップ。

---

## 8. チューニング要点（具体）

* **Nginx**：`sendfile on; tcp_nopush on; tcp_nodelay on; keepalive_timeout 65;`
* **HTTP/2**：有効化（多重化で初回リソース配信を安定）。
* **動画**：`-g`（GOP 長）短縮でシーク体感改善、`-preset veryfast` でデコード負荷低減。
* **UI**：レイアウトは GPU 合成が効く transform を使用（`translate/scale`）。
* **ワーカー**：デコード・サムネ生成はワーカー、UI スレッドは操作と描画命令のみ。
* **キャッシュ**：サムネは LRU、ズーム中は連続生成禁止、停止後 150ms でまとめて生成。
* **計測**：`PerformanceObserver` / `console.time` で操作遅延・描画時間を継続測定し閾値を超えたら警告。

---

## 9. リスクと回避

* **非対応環境**：Chrome 限定運用。ポリシーとして明示。
* **フレーム厳密性**：WebCodecs 利用で解消（fallback の `<video>` は「参考表示」のみ）。
* **学外帯域**：回線が細いユーザ向けに「低ビットレート版」を併置（選択式）。
* **GPU 差**：負荷が高い GPU 環境では自動でデコード並列度/サムネ同時生成数を絞る。
