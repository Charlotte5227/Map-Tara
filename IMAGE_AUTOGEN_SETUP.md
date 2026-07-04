# GitHub Pages運用での画像自動生成手順

この構成は、公開はGitHub Pagesのまま維持し、重い画像生成だけをGitHub Actionsに任せます。

## 1. 追加済みファイル

- .github/workflows/render-map-image.yml
- scripts/render-map-image.mjs
- package.json

## 2. 初回セットアップ

1. 変更をmainブランチへpushする。
2. GitHubのActionsタブで「Render Map Image」ワークフローが有効になっていることを確認する。
3. 必要であれば、Actionsタブからworkflow_dispatchで手動実行する。

手動実行時は以下を指定できます。

- ラベル表示 (show/hide/keep)
- 番号表示 (show/hide/keep)
- 地形図・気候図・地域図・大陸図の表示 (show/hide/keep)
- 各背景レイヤー透明度 (0.0-1.0)

## 3. 画像生成のトリガー

以下のファイル更新で自動実行されます。

- map-data.json
- time-config.json
- history/**
- map.svg
- viewer.js
- index.html
- style.css

## 4. 生成物

- 生成先: generated/map-latest.png
- ActionsのArtifactsにも map-latest として保存

ワークフローは画像差分がある場合のみ自動コミットします。

## 5. ローカル検証

1. 依存をインストール

   npm install

2. Chromiumを導入

   npx playwright install chromium

3. ローカルサーバー起動

   python -m http.server 4173 --bind 127.0.0.1

4. 別ターミナルで生成実行

   MAP_RENDER_BASE_URL=http://127.0.0.1:4173/index.html MAP_RENDER_OUT=generated/map-latest.png npm run render:image

   透明度や表示状態を指定する例:

   MAP_RENDER_LABELS=show MAP_RENDER_NUMBERS=hide MAP_RENDER_BG_TOPO=show MAP_RENDER_BG_TOPO_OPACITY=0.35 MAP_RENDER_BG_CLIMATE=show MAP_RENDER_BG_CLIMATE_OPACITY=0.4 MAP_RENDER_BG_REGION=hide MAP_RENDER_BG_CONTINENT=hide MAP_RENDER_BASE_URL=http://127.0.0.1:4173/index.html MAP_RENDER_OUT=generated/map-latest.png npm run render:image

Windows PowerShellではnpm.cmd / npx.cmdを使用してください。

PowerShellでの環境変数指定例:

   $env:MAP_RENDER_LABELS = "show"
   $env:MAP_RENDER_NUMBERS = "hide"
   $env:MAP_RENDER_BG_TOPO = "show"
   $env:MAP_RENDER_BG_TOPO_OPACITY = "0.35"
   $env:MAP_RENDER_BG_CLIMATE = "show"
   $env:MAP_RENDER_BG_CLIMATE_OPACITY = "0.4"
   $env:MAP_RENDER_BASE_URL = "http://127.0.0.1:4173/index.html"
   $env:MAP_RENDER_OUT = "generated/map-latest.png"
   npm.cmd run render:image

## 6. 運用上のポイント

1. GitHub Pagesは静的配信に専念させる。
2. 画像化はActions側で行う。
3. クライアント側の「画像を保存」機能は、ローカル補助用途として残す。
