# Chinese Chess

給小朋友玩的中國象棋網頁：https://max8568.github.io/chinese-chess/

- 雙人對戰或對電腦（三級難度），可選紅或黑
- 拖曳或點選走棋，點棋子顯示可走位置
- 悔棋、提示、落子音效

## 開發

    npm install
    npm run dev      # 本機預覽
    npm test         # 規則引擎與電腦對手的單元測試
    npm run build    # 輸出到 dist/

素材處理：`python tools/prepare-assets.py`（需要 Pillow、numpy），會把 `assets/` 的原圖處理成 `assets/web/` 的網頁用檔。
棋盤交叉點座標在 `src/assets/boardGeometry.ts`，換棋盤圖時改這裡。

設計文件：`docs/superpowers/specs/2026-09-04-chinese-chess-design.md`
