# Vanguard

Nginx の `auth_request` でリソースの前に認証を挟み、[Cloudflare Access](https://www.cloudflare.com/zero-trust/products/access/) のような「未ログインならログイン画面へ遷移する」流れを実現するアプリケーションです。
  
## 構成

| パッケージ | 役割 |
|------------|------|
| **apps/web** | React（Vite）+ TanStack Router。ログイン UI。開発時は `http://localhost:3000`、ビルド成果物は `base: /_auth` 前提で配信されます。 |
| **apps/auth** | Hono（Node）。`/_auth/api` でセッション検証など。本番では `apps/web/dist` を同じプロセスから静的配信します。 |
| **docker/nginx** | `auth_request` で `/_auth/api/verify` を呼び、401 のとき `/_auth?next=...` へリダイレクトするフロント用 Nginx 設定の例。 |

フローはおおよそ次のとおりです。

1. ユーザーが保護パス（例: `/`）にアクセスする。
2. Nginx が内部リクエストで `/_auth/api/verify` を実行する。
3. 認証 NG なら 401 → `error_page` で `/_auth?next=元のパス` へ 302。
4. ログイン後、もともとアクセスしようとしていたパスへ移動する。

## 必要環境

- **Node.js**（各アプリが想定するバージョン）
- **pnpm** 10.30 以上（ルート `package.json` の `packageManager` 参照）

## セットアップ

```bash
pnpm install
```

### 環境変数

- **auth（API・DB・Redis）**  
  `apps/auth/.env.example` を `apps/auth/.env` にコピーし、`DB_FILE_NAME` と `REDIS_URL` を環境に合わせて設定してください。
- **フロント（ブランド表示など）**  
  `apps/web/.env.example` を参考に `apps/web/.env` を作成してください（`VITE_*` はビルド時に埋め込まれます）。

## ローカル開発

ルートで次を実行すると、Turbo 経由で **web**（既定ポート 3000）と **auth**（3001）の開発用プロセスが起動します。

```bash
pnpm dev
```

- フロントは Vite が `/_auth/api` を `http://localhost:3001` にプロキシします。
- ブラウザでログイン UI を試す場合は Vite の URL（`http://localhost:3000` など）を開いてください。

## 本番ビルド・起動

1. ビルド: `pnpm run build`
2. `NODE_ENV=production` で auth を起動（ルートの `pnpm start` は auth の本番起動を想定）

本番では auth プロセスが `apps/web/dist` を `/_auth` 配下で配信します。

## Docker（Nginx + auth + Redis）

```bash
docker compose up --build
```

- Nginx はポート **80** で待ち受けます。
- compose 内のコメントどおり、`host.docker.internal` 経由でホストの Node に届ける構成の場合、**WSL2 と Windows で Node をどこで動かすか**によって到達性が変わります。同じ WSL 上で `pnpm dev` を動かすか、Docker Desktop のネットワーク設定に合わせてください。
