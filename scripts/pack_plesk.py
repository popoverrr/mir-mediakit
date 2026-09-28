#!/usr/bin/env python3
"""
Упаковка dist/ для выкладки на Plesk (mir-mediakit.asia, корень домена httpdocs).

    npm run build                      # MIR_SITE по умолчанию https://mir-mediakit.asia, base = /
    python scripts/pack_plesk.py       # deploy/mir-site-<дата>.zip — всё, кроме media/
    python scripts/pack_plesk.py --media   # + deploy/mir-media-N.zip (media/ частями до 28 МБ)

В Plesk: File Manager → httpdocs → Upload → архив → Extract (с заменой файлов).
Медиа меняются редко: если ролики не менялись, достаточно архива сайта.
"""
import argparse
import datetime
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = ROOT / "deploy"
LIMIT = 28 * 1024 * 1024  # лимит загрузки в File Manager у хостинга


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--media", action="store_true", help="упаковать и media/ (частями)")
    args = ap.parse_args()
    if not (DIST / "index.html").exists():
        print("Нет dist/ — сначала npm run build")
        return 1
    index = (DIST / "index.html").read_text(encoding="utf-8")
    if 'href="https://mir-mediakit.asia/"' not in index:
        print("Внимание: canonical в dist не https://mir-mediakit.asia/ — собрано не для домена?")
    OUT.mkdir(exist_ok=True)
    stamp = datetime.date.today().isoformat()
    files = [p for p in DIST.rglob("*") if p.is_file()]
    site = [p for p in files if p.relative_to(DIST).parts[0] != "media"]
    site_zip = OUT / f"mir-site-{stamp}.zip"
    with zipfile.ZipFile(site_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for p in site:
            z.write(p, p.relative_to(DIST).as_posix())
    print(f"{site_zip.relative_to(ROOT)}: {len(site)} файлов, {site_zip.stat().st_size // 1024} КБ")
    if args.media:
        media = sorted((p for p in files if p.relative_to(DIST).parts[0] == "media"), key=lambda p: p.stat().st_size, reverse=True)
        parts: list[list[Path]] = []
        sizes: list[int] = []
        for p in media:  # раскладка «первый подходящий»
            s = p.stat().st_size
            for i, total in enumerate(sizes):
                if total + s <= LIMIT:
                    parts[i].append(p)
                    sizes[i] += s
                    break
            else:
                parts.append([p])
                sizes.append(s)
        for i, group in enumerate(parts, 1):
            mz = OUT / f"mir-media-{stamp}-{i}.zip"
            with zipfile.ZipFile(mz, "w", zipfile.ZIP_STORED) as z:
                for p in group:
                    z.write(p, p.relative_to(DIST).as_posix())
            print(f"{mz.relative_to(ROOT)}: {len(group)} файлов, {mz.stat().st_size // 1024 // 1024} МБ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
