"""
prepare-assets.py - 把 assets/ 的原始素材處理成網頁用檔，輸出到 assets/web/

  棋盤  assets/board/board-empty.png  -> assets/web/board.webp   (1536 寬, 有透明度)
  棋子  assets/pieces/<side>/<type>.png -> assets/web/pieces/<side>/<type>.png
        以 alpha >= 250 的範圍裁切、置中到正方形畫布、縮到 384x384
  圖示  apple-touch-icon.png（專案根目錄）-> assets/web/apple-touch-icon.png
        原樣複製；加到主畫面時 iOS 用的圖示

執行：python tools/prepare-assets.py
"""
import shutil
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets"
OUT = SRC / "web"

BOARD_WIDTH = 1536
PIECE_SIZE = 384
SOLID_ALPHA = 250


def prepare_board():
    im = Image.open(SRC / "board" / "board-empty.png").convert("RGBA")
    h = round(im.height * BOARD_WIDTH / im.width)
    im = im.resize((BOARD_WIDTH, h), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / "board.webp", "WEBP", quality=85, method=6)
    print(f"board.webp {im.size}")


def prepare_piece(src: Path, dst: Path):
    im = Image.open(src).convert("RGBA")
    alpha = np.array(im)[..., 3]
    ys, xs = np.where(alpha >= SOLID_ALPHA)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # 把裁切框放大一點，保留柔邊
    pad = 4
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
    crop = im.crop((x0, y0, x1, y1))
    side = max(crop.width, crop.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    canvas = canvas.resize((PIECE_SIZE, PIECE_SIZE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "PNG", optimize=True)
    print(f"{dst.relative_to(ROOT)}  crop=({x0},{y0})-({x1},{y1})")


def copy_touch_icon():
    src = ROOT / "apple-touch-icon.png"
    if not src.exists():
        print("apple-touch-icon.png not found at the project root, skipped")
        return
    im = Image.open(src)
    if im.size != (180, 180):
        print(f"warning: apple-touch-icon.png is {im.size}, iOS expects 180x180")
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, OUT / "apple-touch-icon.png")
    print(f"apple-touch-icon.png {im.size} copied")


def main():
    prepare_board()
    for side in ("red", "black"):
        for src in sorted((SRC / "pieces" / side).glob("*.png")):
            prepare_piece(src, OUT / "pieces" / side / src.name)
    copy_touch_icon()


if __name__ == "__main__":
    main()
