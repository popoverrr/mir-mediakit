#!/usr/bin/env python3
"""
fetch_media.py — скачивает видео/обложки для медиа-кита Мира и готовит их для сайта.

Читает content/mediakit.json, для каждого кейса пробует источники по порядку
(TikTok / Instagram / YouTube Shorts), пока один не скачается, затем:
  * public/media/cases/<slug>.mp4          — ролик для модального плеера (<=720p, H.264, faststart)
  * public/media/cases/<slug>-preview.mp4  — 5-секундное беззвучное превью для карточки
  * public/media/cases/<slug>.webp         — постер
  * public/media/thumbs/yt-<id>.webp       — обложки всех YouTube-зеркал (скачиваются без логина)
  * media-src/stills/<slug>-NN.jpg         — стоп-кадры в полном качестве (кандидаты для фото на сайте)
  * content/media-manifest.json            — что получилось, что нет и почему

Кросс-платформенно (Windows / macOS / Linux). Нужны: Python 3.10+, yt-dlp, ffmpeg.
    python -m pip install -U "yt-dlp[default,curl-cffi]"
    winget install Gyan.FFmpeg        (Windows)   |   brew install ffmpeg   (macOS)

Примеры:
    python scripts/fetch_media.py                      # основной прогон
    python scripts/fetch_media.py --dry-run            # только показать план
    python scripts/fetch_media.py --cookies-from-browser firefox   # если Instagram требует вход
    python scripts/fetch_media.py --cookies secrets/cookies.txt    # cookies.txt (формат Netscape)
    python scripts/fetch_media.py --only fata,arencia --force
    python scripts/fetch_media.py --all-sources        # скачать вообще все ролики (много гигабайт не нужно — обычно не надо)
    python scripts/fetch_media.py --gallery            # + фото из Instagram через gallery-dl (нужны cookies)
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "mediakit.json"
MANIFEST = ROOT / "content" / "media-manifest.json"
SRC_DIR = ROOT / "media-src"              # сырьё, в git не коммитить
PUB = ROOT / "public" / "media"
CASES_OUT = PUB / "cases"
THUMBS_OUT = PUB / "thumbs"
STILLS_OUT = SRC_DIR / "stills"

# Windows: при перенаправлении вывода консоль может быть в cp1251 — не падать на ✓/→/кириллице
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"


# ---------------------------------------------------------------- helpers
def log(msg: str) -> None:
    print(msg, flush=True)


def ytdlp_cmd() -> list[str] | None:
    try:
        import yt_dlp  # noqa: F401
        return [sys.executable, "-m", "yt_dlp"]
    except Exception:
        exe = shutil.which("yt-dlp")
        return [exe] if exe else None


def has_curl_cffi() -> bool:
    try:
        import curl_cffi  # noqa: F401
        return True
    except Exception:
        return False


def run(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)


def ffprobe_duration(path: Path) -> float | None:
    if not shutil.which("ffprobe"):
        return None
    p = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", str(path)], 60)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return None


def http_get(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        if len(data) < 2000:  # заглушка «нет картинки»
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception:
        return False


def to_webp(src: Path, dest: Path, width: int = 720) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    p = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", f"scale='min({width},iw)':-2",
             "-c:v", "libwebp", "-quality", "80", str(dest)], 120)
    return p.returncode == 0 and dest.exists()


# ---------------------------------------------------------------- download
def download(source: dict, workdir: Path, args, ytdlp: list[str]) -> tuple[Path | None, str]:
    """Пробует скачать один источник. Возвращает (путь к видео | None, текст ошибки)."""
    url = source["url"]
    workdir.mkdir(parents=True, exist_ok=True)
    out_tpl = str(workdir / f"{source['platform']}-{source['id']}.%(ext)s")
    base = ytdlp + [
        "--no-playlist", "--no-progress", "--restrict-filenames",
        "-f", "bv*[height<=1920][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
        "--merge-output-format", "mp4",
        "--write-thumbnail", "--convert-thumbnails", "jpg",
        "--retries", "3", "--socket-timeout", "30",
        "-o", out_tpl, "--print", "after_move:filepath",
    ]
    attempts: list[list[str]] = [[]]
    if source["platform"] == "tiktok" and has_curl_cffi():
        attempts.append(["--impersonate", "chrome"])
    if args.cookies:
        attempts.append(["--cookies", args.cookies])
    if args.cookies_from_browser:
        attempts.append(["--cookies-from-browser", args.cookies_from_browser])

    last_err = ""
    for extra in attempts:
        try:
            p = run(base + extra + [url], 900)
        except subprocess.TimeoutExpired:
            last_err = "timeout"
            continue
        if p.returncode == 0:
            lines = [l.strip() for l in p.stdout.splitlines() if l.strip().lower().endswith(".mp4")]
            cand = Path(lines[-1]) if lines else None
            if cand and cand.exists():
                return cand, ""
            found = sorted(workdir.glob(f"{source['platform']}-{source['id']}*.mp4"))
            if found:
                return found[0], ""
        tail = (p.stderr or p.stdout).strip().splitlines()
        last_err = (tail[-1] if tail else "unknown error")[:300]
        time.sleep(1.5)
    return None, last_err


# ---------------------------------------------------------------- transcode
def make_outputs(raw: Path, slug: str, make_stills: bool, n_stills: int) -> dict:
    CASES_OUT.mkdir(parents=True, exist_ok=True)
    video = CASES_OUT / f"{slug}.mp4"
    preview = CASES_OUT / f"{slug}-preview.mp4"
    poster = CASES_OUT / f"{slug}.webp"
    res: dict = {}
    dur = ffprobe_duration(raw) or 0.0
    res["durationSec"] = round(dur, 1) if dur else None

    # основной ролик: до 720 px по ширине, H.264 + AAC, faststart
    p = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
             "-vf", "scale='min(720,iw)':-2", "-c:v", "libx264", "-preset", "slow", "-crf", "26",
             "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2",
             "-movflags", "+faststart", str(video)], 1200)
    if p.returncode == 0:
        res["video"] = f"/media/cases/{video.name}"
    else:
        res.setdefault("errors", []).append("transcode: " + p.stderr.strip()[-200:])

    # превью: 5 секунд без звука, 360 px
    start = 1.0 if dur > 7 else 0.0
    p = run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(start), "-t", "5", "-i", str(raw), "-an",
             "-vf", "scale=360:-2,fps=24", "-c:v", "libx264", "-preset", "slow", "-crf", "30",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(preview)], 600)
    if p.returncode == 0:
        res["preview"] = f"/media/cases/{preview.name}"

    # постер: кадр на ~12% длительности (не чёрный первый кадр)
    t = max(0.5, dur * 0.12) if dur else 1.0
    tmp = SRC_DIR / "tmp" / f"{slug}-poster.jpg"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    p = run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(raw), "-frames:v", "1", "-q:v", "2", str(tmp)], 120)
    if p.returncode == 0 and to_webp(tmp, poster, 720):
        res["poster"] = f"/media/cases/{poster.name}"

    # стоп-кадры в полном разрешении — кандидаты для фото на сайте
    if make_stills and dur:
        STILLS_OUT.mkdir(parents=True, exist_ok=True)
        stills = []
        for i in range(n_stills):
            ts = dur * (i + 0.5) / n_stills
            out = STILLS_OUT / f"{slug}-{i + 1:02d}.jpg"
            p = run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{ts:.2f}", "-i", str(raw), "-frames:v", "1", "-q:v", "2", str(out)], 120)
            if p.returncode == 0 and out.exists():
                stills.append(str(out.relative_to(ROOT)).replace("\\", "/"))
        res["stills"] = stills
    return res


# ---------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cookies-from-browser", help="firefox | edge | chrome | … (для Instagram, если без входа не качается)")
    ap.add_argument("--cookies", help="путь к cookies.txt (Netscape) — например secrets/cookies.txt")
    ap.add_argument("--only", help="slug-и через запятую")
    ap.add_argument("--force", action="store_true", help="перекачать, даже если файлы уже есть")
    ap.add_argument("--all-sources", action="store_true", help="качать все источники кейса, а не первый успешный")
    ap.add_argument("--no-stills", action="store_true")
    ap.add_argument("--stills", type=int, default=8, help="сколько стоп-кадров делать (по умолчанию 8)")
    ap.add_argument("--gallery", action="store_true", help="скачать фото-посты Instagram через gallery-dl")
    ap.add_argument("--try-blocked", action="store_true", help="не пропускать ролики, помеченные как недоступные в регионе")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(CONTENT.read_text(encoding="utf-8"))
    only = set(s.strip() for s in args.only.split(",")) if args.only else None

    jobs: list[dict] = []
    for c in data["cases"]:
        if c.get("showInCases", True) and c["sources"]:
            jobs.append({"slug": c["slug"], "kind": "case", "sources": c["sources"], "stills": False})
    for t in data.get("topContent", []):
        jobs.append({"slug": t["slug"], "kind": "top", "sources": t["sources"], "stills": bool(t.get("stills"))})
    for e in data.get("extraIntegrations", []):
        if e.get("include"):
            jobs.append({"slug": e["slug"], "kind": "extra", "sources": e["sources"], "stills": False})
    if only:
        jobs = [j for j in jobs if j["slug"] in only]

    # порядок источников: сначала те, что обычно качаются без логина (TikTok, YouTube), потом Instagram.
    # Для карточки кейса важен сам ролик, поэтому берём первый успешный.
    prio = {"tiktok": 0, "youtube": 1, "instagram": 2}

    def ordered(sources):
        ok = [s for s in sources if s.get("availability") != "region_blocked_from_KZ" or args.try_blocked]
        blocked = [s for s in sources if s not in ok]
        # внутри платформы — по просмотрам (лучший ролик первым)
        ok.sort(key=lambda s: (prio.get(s["platform"], 9), -(s["stats"].get("views") or 0)))
        return ok + blocked

    yt_ids = sorted({s["id"] for j in jobs for s in j["sources"] if s["platform"] == "youtube"} |
                    {s["id"] for c in data["cases"] for s in c["sources"] if s["platform"] == "youtube"})

    if args.dry_run:
        log(f"Заданий: {len(jobs)}; YouTube-обложек: {len(yt_ids)}")
        for j in jobs:
            order = " → ".join(f"{s['platform']}:{s['id']}" for s in ordered(j["sources"]))
            log(f"  [{j['kind']:5}] {j['slug']:16} {order}")
        return 0

    ytdlp = ytdlp_cmd()
    missing = []
    if not ytdlp:
        missing.append('yt-dlp  →  python -m pip install -U "yt-dlp[default,curl-cffi]"')
    if not shutil.which("ffmpeg"):
        missing.append("ffmpeg  →  winget install Gyan.FFmpeg   (macOS: brew install ffmpeg), затем перезапустить терминал")
    if missing:
        log("Не хватает инструментов:\n  " + "\n  ".join(missing))
        return 2

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"items": {}, "thumbs": {}}
    manifest.setdefault("items", {})
    manifest.setdefault("thumbs", {})

    # 0) аватар и баннер YouTube-канала (без логина) — запасной источник аватарки
    chan_dir = SRC_DIR / "channel"
    if args.force or not any(chan_dir.glob("*")):
        chan_dir.mkdir(parents=True, exist_ok=True)
        yt_channel = next((c["url"] for c in data["channels"] if c["platform"] == "youtube"), None)
        if yt_channel:
            p = run(ytdlp + ["--skip-download", "--write-all-thumbnails", "--playlist-items", "0",
                             "-o", str(chan_dir / "youtube-%(id)s.%(ext)s"), yt_channel], 180)
            log("== аватар/баннер YouTube: " + ("ok" if any(chan_dir.glob("*")) else "не получилось (не критично)"))

    # 1) обложки YouTube — без логина, быстро
    log(f"== YouTube-обложки: {len(yt_ids)}")
    THUMBS_OUT.mkdir(parents=True, exist_ok=True)
    for vid in yt_ids:
        dest = THUMBS_OUT / f"yt-{vid}.webp"
        if dest.exists() and not args.force:
            manifest["thumbs"][vid] = f"/media/thumbs/{dest.name}"
            continue
        tmp = SRC_DIR / "tmp" / f"yt-{vid}.jpg"
        got = any(http_get(f"https://i.ytimg.com/vi/{vid}/{name}", tmp) for name in ("oar2.jpg", "hq720.jpg", "hqdefault.jpg"))
        if got and to_webp(tmp, dest, 720):
            manifest["thumbs"][vid] = f"/media/thumbs/{dest.name}"
        else:
            log(f"   ! нет обложки {vid}")

    # 2) ролики
    ok, fail = [], []
    for j in jobs:
        slug = j["slug"]
        existing = manifest["items"].get(slug, {})
        if existing.get("video") and (ROOT / "public" / existing["video"].lstrip("/")).exists() and not args.force:
            log(f"= {slug}: уже есть")
            ok.append(slug)
            continue
        log(f"== {slug}")
        entry: dict = {"kind": j["kind"], "errors": [], "downloaded": []}
        got_main = False
        for s in ordered(j["sources"]):
            if got_main and not args.all_sources:
                break
            raw, err = download(s, SRC_DIR / "raw" / slug, args, ytdlp)
            tag = f"{s['platform']}:{s['id']}"
            if not raw:
                log(f"   × {tag}: {err}")
                entry["errors"].append(f"{tag}: {err}")
                continue
            log(f"   ✓ {tag}")
            entry["downloaded"].append({"platform": s["platform"], "id": s["id"], "url": s["url"], "raw": str(raw.relative_to(ROOT)).replace('\\', '/')})
            if not got_main:
                outs = make_outputs(raw, slug, j["stills"] and not args.no_stills, args.stills)
                entry.update(outs)
                entry["source"] = {"platform": s["platform"], "id": s["id"], "url": s["url"]}
                got_main = bool(outs.get("video"))
        if not entry["errors"]:
            entry.pop("errors")
        manifest["items"][slug] = entry
        (ok if got_main else fail).append(slug)
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # 3) фото из Instagram (опционально)
    if args.gallery:
        gdl = shutil.which("gallery-dl")
        if not gdl:
            log("gallery-dl не установлен: python -m pip install -U gallery-dl")
        else:
            gal = SRC_DIR / "gallery"
            gal.mkdir(parents=True, exist_ok=True)
            codes = data.get("gallery", {}).get("instagramPhotoPosts", [])
            for code in codes:
                cmd = [gdl, "-D", str(gal / code)]
                if args.cookies:
                    cmd += ["--cookies", args.cookies]
                if args.cookies_from_browser:
                    cmd += ["--cookies-from-browser", args.cookies_from_browser]
                p = run(cmd + [f"https://www.instagram.com/p/{code}/"], 300)
                log(("   ✓ " if p.returncode == 0 else "   × ") + f"gallery {code}" + ("" if p.returncode == 0 else f": {(p.stderr or p.stdout).strip()[-160:]}"))

    manifest["updatedAt"] = time.strftime("%Y-%m-%d %H:%M")
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"\nГотово. Видео есть: {len(ok)}; без видео: {len(fail)}" + (f" → {', '.join(fail)}" if fail else ""))
    log("Для «без видео» сайт должен показать постер YouTube-зеркала / embed / ссылку (см. TZ.md §6.4).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
