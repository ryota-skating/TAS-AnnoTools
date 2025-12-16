# TAS-AnnoTools 外部公開ガイド（Cloudflare Tunnel版）

このドキュメントでは、TAS-AnnoToolsをCloudflare Tunnelを使用して外部に公開する方法を説明します。

## 📋 目次

1. [前提条件](#前提条件)
2. [初期セットアップ](#初期セットアップ)
3. [使用方法](#使用方法)
4. [自動起動設定](#自動起動設定)
5. [トラブルシューティング](#トラブルシューティング)
6. [セキュリティ注意事項](#セキュリティ注意事項)

---

## 前提条件

### 必須ソフトウェア

- **Node.js** (v18以上)
- **npm** (Node.jsに同梱)
- **cloudflared** (Cloudflare Tunnel CLI)
- **PowerShell** 5.1以上（Windows標準搭載）

### 確認済み環境

- ✅ cloudflaredインストール済み
- ✅ Cloudflareアカウント作成済み（`tanaka.ryota@g.sp.m.is.nagoya-u.ac.jp`）

---

## 初期セットアップ

### 1. 依存パッケージのインストール

プロジェクトルートで以下を実行：

```powershell
# バックエンド
cd backend
npm install

# フロントエンド
cd ../frontend
npm install
```

### 2. 環境変数の確認

#### バックエンド（`backend/.env`）

以下の設定が正しいことを確認してください：

```env
# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database Configuration
DATABASE_PATH=./data/annotations.db

# JWT Configuration (⚠️ 本番環境では必ず変更!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

**重要:** `JWT_SECRET` と `DEFAULT_ADMIN_PASSWORD` は本番環境で必ず変更してください！

#### フロントエンド（`frontend/.env`）

```env
# API Base URL
VITE_API_URL=http://localhost:3001/api

# Development settings
VITE_DEBUG=false
```

**注意:** Cloudflare Tunnel起動時に `start-tunnel.ps1` が自動的に更新します。

---

## 使用方法

### 方法1: 一括起動スクリプト（推奨）

すべてのサービス（Backend + Frontend + Tunnel）を一度に起動します。

```powershell
# プロジェクトルートで実行
.\scripts\start-all.ps1
```

これにより、3つのPowerShellウィンドウが開きます：
1. **バックエンドサーバー** (ポート 3001)
2. **フロントエンドサーバー** (ポート 5173)
3. **Cloudflare Tunnel**

**Cloudflare TunnelウィンドウでURLを確認してください。**
例: `https://random-name-1234.trycloudflare.com`

#### 停止方法

```powershell
.\scripts\stop-all.ps1
```

または各ウィンドウで `Ctrl + C` を押す。

---

### 方法2: 個別起動

各サービスを個別に起動したい場合：

#### ステップ1: バックエンド起動

```powershell
cd backend
npm run dev
```

#### ステップ2: フロントエンド起動（別ターミナル）

```powershell
cd frontend
npm run dev
```

#### ステップ3: Cloudflare Tunnel起動（別ターミナル）

```powershell
.\scripts\start-tunnel.ps1
```

トンネルURLが表示されるので、そのURLをブラウザで開いてアクセスします。

#### 停止方法

```powershell
.\scripts\stop-tunnel.ps1
```

---

## 自動起動設定

Windows起動時にCloudflare Tunnelを自動的に起動する設定です。

### インストール

**管理者権限**でPowerShellを開き、以下を実行：

```powershell
# 管理者として実行
.\scripts\install-auto-start.ps1
```

これにより、Windowsタスクスケジューラに以下のタスクが登録されます：

- **タスク名:** `TAS-AnnoTools-Tunnel`
- **トリガー:** ログオン時
- **動作:** `scripts\start-tunnel.ps1` を実行

### 確認方法

1. `Win + R` を押して `taskschd.msc` を実行
2. タスクスケジューラライブラリから `TAS-AnnoTools-Tunnel` を探す
3. タスクが有効になっていることを確認

### 無効化・削除

タスクスケジューラで該当タスクを右クリック → **削除** または **無効化**

---

## アクセス方法

### ローカルアクセス（開発時）

```
http://localhost:5173
```

### 外部アクセス（Cloudflare Tunnel経由）

Cloudflare Tunnelで発行されたURL（例）：

```
https://random-name-1234.trycloudflare.com
```

**注意:** 無料版はランダムURLです。トンネル再起動のたびにURLが変わります。

---

## トラブルシューティング

### 問題1: トンネルURLが取得できない

**症状:**
`start-tunnel.ps1` 実行後、30秒待ってもURLが表示されない。

**解決方法:**
1. ログファイルを確認：
   ```powershell
   Get-Content .\tunnel.log
   ```
2. cloudflaredが正しくインストールされているか確認：
   ```powershell
   cloudflared --version
   ```
3. Cloudflareアカウントにログインしているか確認：
   ```powershell
   cloudflared tunnel login
   ```

---

### 問題2: CORS エラー

**症状:**
フロントエンドからバックエンドAPIへのアクセスがブロックされる。

**解決方法:**
1. `backend/.env` の `CORS_ORIGIN` にトンネルURLが追加されているか確認
2. バックエンドを再起動
3. ブラウザのキャッシュをクリア

---

### 問題3: ポート競合

**症状:**
`Port 3001 is already in use` などのエラー。

**解決方法:**
1. すでに起動しているプロセスを停止：
   ```powershell
   .\scripts\stop-all.ps1
   ```
2. それでも解決しない場合、ポートを使用しているプロセスを確認：
   ```powershell
   netstat -ano | findstr :3001
   ```
3. プロセスIDを確認して強制終了：
   ```powershell
   Stop-Process -Id <PID> -Force
   ```

---

### 問題4: トンネルが勝手に切断される

**症状:**
Cloudflare Tunnelが数時間で切断される。

**原因:**
無料版の制限またはネットワークの不安定性。

**解決方法:**
1. トンネルを再起動：
   ```powershell
   .\scripts\start-tunnel.ps1
   ```
2. 自動再接続スクリプトを使用（今後実装予定）
3. 有料版の検討（固定URL + 安定接続）

---

## セキュリティ注意事項

### 🔒 必須セキュリティ設定

#### 1. JWT秘密鍵の変更

`backend/.env` の以下を変更してください：

```env
JWT_SECRET=<32文字以上のランダムな文字列>
```

生成方法（PowerShell）：
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

#### 2. 管理者パスワードの変更

```env
DEFAULT_ADMIN_PASSWORD=<強力なパスワード>
```

#### 3. HTTPS接続の確認

Cloudflare Tunnelは自動的にHTTPSを提供しますが、以下を確認してください：

- ✅ トンネルURLが `https://` で始まる
- ✅ ブラウザに鍵マークが表示される

#### 4. ログの定期確認

不審なアクセスがないか定期的に確認：

```powershell
Get-Content .\backend\logs\combined.log | Select-String "failed"
```

---

## 制限事項

### 無料版（ランダムURL）の制限

1. **URLが固定されない**
   - トンネル再起動のたびに新しいランダムURLが発行される
   - ユーザーには毎回新しいURLを伝える必要がある

2. **自動再接続なし**
   - ネットワーク切断時に手動で再起動が必要

3. **トラフィック制限**
   - 無料版は帯域制限がある可能性（公式ドキュメント要確認）

### 対策

- **固定URLが必要な場合**: Cloudflareの有料プラン（月額 $5-10）
- **カスタムドメイン**: 独自ドメイン + Cloudflare Tunnelの組み合わせ

---

## よくある質問（FAQ）

### Q1: 無料版でどのくらい使える？

A: 3人程度の同時アクセスであれば問題なく動作します。無料版に明確な制限は公表されていませんが、大量のトラフィックには不向きです。

### Q2: トンネルURLを固定したい

A: Cloudflareの有料プラン（Teams）に加入し、Named Tunnelを作成してください。月額 $5-10 程度です。

### Q3: バックエンドとフロントエンドを別々のトンネルにすべき？

A: いいえ、Viteのプロキシ機能を使用しているため、フロントエンド（ポート5173）のみをトンネル経由で公開すれば十分です。

### Q4: セキュリティは大丈夫？

A: Cloudflare Tunnelは以下の点で安全です：
- ✅ 自動HTTPS暗号化
- ✅ ポート開放不要（ファイアウォールを開けない）
- ✅ DDoS保護

ただし、アプリケーション側のセキュリティ（認証・JWT・CORS）は別途確認が必要です。

---

## サポート

問題が解決しない場合は、以下を確認してください：

1. **ログファイル**
   - `tunnel.log`
   - `backend/logs/combined.log`

2. **Cloudflare公式ドキュメント**
   - https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

3. **GitHub Issues**
   - プロジェクトのIssueに報告

---

## 更新履歴

- **2025-10-26**: 初版作成（Cloudflare Tunnel対応）

