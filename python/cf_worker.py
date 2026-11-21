#!/usr/bin/env python3
"""CLIPFORGE AI processing worker.

Runs locally. It transcribes with faster-whisper, finds highlight windows from audio
energy / speech density / scene changes, then renders vertical MP4 clips with
ffmpeg (facecam-aware framing, karaoke captions, title bar, loudness normalisation).

Progress is emitted on stdout as newline-delimited JSON so the Node job manager can
persist it and show it in the UI.
"""

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse
from pathlib import Path

os.environ.setdefault("HF_HUB_VERBOSITY", "error")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")

import numpy as np

LOW_MEMORY = os.environ.get("RENDER") == "true" or os.environ.get("CLIPFORGE_LOW_MEMORY") == "true"
FAST = LOW_MEMORY or os.environ.get("CLIPFORGE_FAST") == "true"
W, H = (480, 854) if FAST else (1080, 1920)
SW, SH = (960, 540) if FAST else (1920, 1080)
CAP_SIZE = 36 if FAST else 82
TITLE_SIZE = 24 if FAST else 54
FPS = 24 if FAST else 30
FAST_SOURCE_SECONDS = 300
INVIDIOUS_HOSTS = ["yt.chocolatemoo53.com", "inv.nadeko.net", "invidious.nerdvpn.de"]
INVIDIOUS_HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://yt.chocolatemoo53.com/"}
RATE = 16000
STOP = set("the a an and or but if to of in on at for with is are was were be been being this that these those it its as by from we you they i he she our your their my me him her them do does did have has had not no so just about into out up down over then than there here what when where who why how all any some can will would could should now get got go going one two really very much more most".split())
HOT = re.compile(r"\b(wow|haha|lol|lmao|insane|crazy|unreal|amazing|incredible|no way|oh my|let'?s go|clutch|gone|finally|restart|perfect|bruh|what the|holy|nuts|sick|epic|victory|won|win|lose|lost|kill|goal|ace|chrome|funny|fail|wild|omg|damn|fuck|shit|unbelievable|savage|died|dead|crash|explode|explosion|scared|danger|panic)\b", re.I)
PEAK = re.compile(r"\b(insane|crazy|unreal|no way|oh my|holy|lmao|let'?s go|clutch|unbelievable|wild|omg|fuck|shit|crash|explode|died|dead|kill|ace|savage|epic|panic)\b", re.I)


def emit(kind, **data):
    print(json.dumps({"type": kind, **data}, ensure_ascii=False), flush=True)


def progress(stage, value, message, **extra):
    emit("progress", stage=stage, progress=int(max(0, min(100, value))), message=message, **extra)


def log(message):
    emit("log", time=datetime.now(timezone.utc).isoformat(), message=str(message))


class WorkError(Exception):
    pass


def run(cmd, timeout=7200, capture=True, cwd=None, input_bytes=None):
    p = subprocess.run(cmd, stdin=subprocess.PIPE if input_bytes is not None else None,
                       input=input_bytes, stdout=subprocess.PIPE if capture else None,
                       stderr=subprocess.PIPE if capture else None, cwd=cwd, timeout=timeout)
    if p.returncode != 0:
        detail = (p.stderr or b"").decode("utf-8", "replace")[-1800:]
        raise WorkError(f"Command failed ({' '.join(str(c) for c in cmd)[:200]}): {detail}")
    return (p.stdout or b"").decode("utf-8", "replace") if capture else ""


def ytdlp_cookie_candidates():
    candidates = []
    cookie_file = os.environ.get("YT_COOKIES_FILE")
    default_file = Path(__file__).resolve().parent.parent / "storage" / "youtube-cookies.txt"
    if cookie_file and Path(cookie_file).exists():
        candidates.append(["--cookies", cookie_file])
    elif default_file.exists():
        candidates.append(["--cookies", str(default_file)])
    if not FAST:
        browser = os.environ.get("YT_COOKIES_FROM_BROWSER")
        if browser:
            candidates.append(["--cookies-from-browser", browser])
        else:
            candidates.append(["--cookies-from-browser", "chrome"])
            candidates.append(["--cookies-from-browser", "edge"])
    candidates.append([])
    return candidates


def ytdlp_run(args, binary=None, timeout=1800, capture=True):
    binary = binary or os.environ.get("YTDLP", "yt-dlp")
    command = list(args)
    is_youtube = any("youtube.com" in str(a) or "youtu.be" in str(a) for a in command)
    clients = ["android_vr", "android", "tv", "mweb", "web_safari"] if is_youtube else [None]
    last = None
    warned = False
    for client in clients:
        variant = ["--extractor-args", f"youtube:player_client={client}", *command] if client else command
        for flags in ytdlp_cookie_candidates():
            try:
                return run([binary, *flags, *variant], timeout=timeout, capture=capture)
            except WorkError as exc:
                last = exc
                if flags and not warned:
                    warned = True
                    log("Saved YouTube cookies were rejected; trying a public source")
    raise last


def youtube_video_id(url):
    try:
        parsed = urlparse(str(url))
    except Exception:
        return None
    host = (parsed.hostname or "").lower()
    if "youtu.be" in host:
        return parsed.path.strip("/").split("/")[0][:11] or None
    if "youtube.com" in host or "youtube-nocookie.com" in host:
        found = parse_qs(parsed.query).get("v", [""])[0]
        if found:
            return found[:11]
        match = re.match(r"^/(?:live|embed|shorts)/([A-Za-z0-9_-]{11})", parsed.path)
        if match:
            return match.group(1)
    return None


def invidious_info(url):
    video_id = youtube_video_id(url)
    if not video_id:
        return None
    for host in INVIDIOUS_HOSTS:
        try:
            request = urllib.request.Request(
                f"https://{host}/api/v1/videos/{video_id}?local=true",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                data = json.load(response)
            if isinstance(data, dict) and (data.get("adaptiveFormats") or data.get("formatStreams")):
                return data
        except Exception as exc:
            log(f"Public mirror {host} unavailable: {str(exc)[:120]}")
    return None


def download_invidious_source(info, work, limit):
    source_url = info.get("hlsUrl")
    is_hls = bool(source_url)
    if not source_url:
        progressive = sorted(info.get("formatStreams") or [], key=lambda f: int(f.get("bitrate") or 0), reverse=True)
        source_url = progressive[0].get("url") if progressive else None
    if not source_url:
        raise WorkError("The public mirror did not return a usable video stream.")
    host = urlparse(source_url).hostname or INVIDIOUS_HOSTS[0]
    headers = f"User-Agent: Mozilla/5.0\r\nReferer: https://{host}/\r\n"
    output = work / "video.mp4"
    cmd = [os.environ.get("FFMPEG", "ffmpeg"), "-y", "-v", "error", "-nostdin",
           "-headers", headers, "-t", str(limit), "-i", source_url,
           "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy"]
    if is_hls:
        cmd += ["-bsf:a", "aac_adtstoasc"]
    cmd += [str(output)]
    run(cmd, timeout=max(900, limit * 4))
    if not output.exists():
        raise WorkError("The public mirror stream could not be downloaded.")
    return output


def ffprobe(path):
    out = run(["ffprobe", "-v", "error", "-show_entries",
               "format=duration:stream=index,codec_type,width,height,avg_frame_rate",
               "-of", "json", str(path)])
    data = json.loads(out)
    dur = float(data.get("format", {}).get("duration") or 0)
    w = h = 0
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            w, h = int(s.get("width") or 0), int(s.get("height") or 0)
            break
    return {"duration": dur, "width": w, "height": h}


def model_root():
    pref = Path(os.path.expanduser("~")) / ".streamclips" / "models" / "whisper"
    if (pref / "models--Systran--faster-whisper-tiny").exists():
        return pref
    return Path(os.environ.get("MODEL_ROOT", str(Path(__file__).parent / "models")))


def face_model_path():
    p = Path(os.path.expanduser("~")) / ".streamclips" / "models" / "face_yunet.onnx"
    return p if p.exists() else None


def load_audio(path, ffbin="ffmpeg"):
    global FFMPEG
    p = subprocess.run([ffbin, "-v", "error", "-nostdin", "-i", str(path), "-vn", "-ac", "1",
                        "-ar", str(RATE), "-f", "f32le", "pipe:1"], stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise WorkError("Could not decode audio from the source: " + p.stderr.decode("utf-8", "replace")[-1000:])
    samples = np.frombuffer(p.stdout, dtype="<f4").astype(np.float32)
    if samples.size < RATE:
        raise WorkError("The source has no usable audio track. Add an audio stream or use a different file.")
    return samples


def transcribe(samples, language=None, model_size="tiny"):
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise WorkError("faster-whisper is not installed in the Python environment. See README.md.") from exc
    model = WhisperModel(model_size, device="cpu", compute_type="int8", download_root=str(model_root()))
    options = dict(language=language or None, word_timestamps=True,
                   beam_size=1 if model_size == "tiny" else 4,
                   condition_on_previous_text=False)
    try:
        segments, info = model.transcribe(samples, vad_filter=True,
                                          vad_parameters={"min_silence_duration_ms": 400}, **options)
    except Exception as exc:
        if "onnxruntime" not in str(exc).lower():
            raise
        log("Voice-activity filter unavailable; continuing without it")
        segments, info = model.transcribe(samples, vad_filter=False, **options)
    words = []
    for seg in segments:
        for word in seg.words or []:
            text = (word.word or "").strip()
            if text:
                words.append({"s": round(float(word.start), 2), "e": round(float(word.end), 2), "w": text})
    return words, getattr(info, "language", language or "en")


def volume_curve(samples):
    n = len(samples) // RATE
    if not n:
        return np.zeros(1, dtype=np.float32)
    sec = samples[: n * RATE].reshape(n, RATE)
    return (20 * np.log10(np.sqrt(np.mean(sec ** 2, axis=1)) + 1e-5)).astype(np.float32)


def has_speech(samples):
    n = len(samples) // RATE
    if n < 2:
        return False
    rms = np.sqrt(np.mean(samples[: n * RATE].reshape(n, RATE) ** 2, axis=1) + 1e-9)
    voiced = int(np.count_nonzero(rms > 0.012))
    return voiced >= max(2, int(n * 0.02))


def spikes(curve, window=120):
    if len(curve) < 10:
        return np.zeros_like(curve)
    step = 2
    coarse = curve[::step]
    half = max(1, window // step // 2)
    pad = np.pad(coarse, half, mode="edge")
    view = np.lib.stride_tricks.sliding_window_view(pad, 2 * half + 1)
    base = np.repeat(np.percentile(view, 60, axis=1), step)[: len(curve)]
    return np.clip(curve - base, 0, None)


def scene_times(path, ffbin="ffmpeg", duration=0):
    if duration <= 0 or duration > 5400:
        return []
    try:
        text = subprocess.run([ffbin, "-v", "info", "-nostdin", "-i", str(path),
                               "-vf", "fps=1/2,select='gt(scene,0.33)',showinfo", "-an",
                               "-f", "null", "-"], stdout=subprocess.DEVNULL,
                              stderr=subprocess.PIPE, timeout=min(1800, int(duration * 0.5) + 60)).stderr.decode("utf-8", "replace")
        return [float(m) for m in re.findall(r"pts_time:([0-9.]+)", text)]
    except Exception:
        return []


def keywords(text):
    words = re.findall(r"[a-zA-Z][a-zA-Z']{2,}", text.lower())
    return [w for w in words if w not in STOP and len(w) > 2]


def title_for(text, topic):
    match = PEAK.search(text)
    phrase = match.group(0).strip().title() if match else ""
    key = keywords(text)
    freq = {}
    for word in key:
        freq[word] = freq.get(word, 0) + 1
    top = [w for w, _ in sorted(freq.items(), key=lambda kv: -kv[1])[:3]]
    subject = phrase or " ".join(top[:2]).title() or topic.title()
    templates = [
        f"Craziest Moment: {subject}",
        f"Most Insane Moment — {subject}",
        f"They Lost It: {subject}",
        f"Most Watchable Moment: {subject}",
    ]
    index = sum(ord(c) for c in subject) % len(templates)
    return templates[index]


def classify(text):
    low = text.lower()
    if any(k in low for k in ("haha", "lol", "lmao", "funny", "bruh", "fail")):
        return "funny", "Laughter and a big reaction in the audio"
    if any(k in low for k in ("clutch", "kill", "ace", "goal", "win", "won", "victory", "epic")):
        return "skill", "High-energy gameplay or achievement"
    if any(k in low for k in ("wow", "insane", "crazy", "unreal", "no way", "holy", "amazing", "wild", "omg", "unbelievable", "panic")):
        return "reaction", "Strong vocal reaction above the local noise floor"
    if any(k in low for k in ("should", "tip", "how to", "because", "why", "learn")):
        return "tip", "Dense, informative speech"
    return "highlight", "Peak energy and speech density in this window"


def pick_moments(words, curve, scenes, duration, count, topic):
    count = max(3, count)
    length = min(35.0 if FAST else 45.0, max(18.0 if FAST else 22.0, duration / max(1, count) * 0.45))
    if duration < 18:
        length = max(8.0, duration - 1.0)
    energy = spikes(curve)
    n = max(1, int(duration))
    density = np.zeros(n, dtype=np.float32)
    hot_curve = np.zeros(n, dtype=np.float32)
    for w in words:
        s = min(n - 1, max(0, int(w["s"])))
        e = min(n, max(s + 1, int(w["e"]) + 1))
        density[s:e] += 1.0
        if PEAK.search(w["w"]):
            hot_curve[s:e] += 7.0
        elif HOT.search(w["w"]):
            hot_curve[s:e] += 3.5
    for t in scenes:
        i = min(n - 1, max(0, int(t)))
        hot_curve[max(0, i - 2):i + 3] += 2.0
    candidates = []
    max_start = max(0.0, duration - length - 0.25)
    for start in range(0, int(max_start) + 1, 3):
        end = start + length
        i0, i1 = int(start), min(n, int(end))
        if i1 <= i0:
            continue
        window_energy = energy[i0:i1]
        vol = float(np.mean(np.sort(window_energy)[-max(2, (i1 - i0) // 4):]))
        peak = float(np.max(window_energy))
        bursts = float(np.count_nonzero(window_energy > 7.0))
        speech = float(np.mean(density[i0:i1]))
        hot = float(np.sum(hot_curve[i0:i1]))
        score = vol * 2.0 + peak + bursts * 0.4 + hot * 3.0 + speech * 0.7
        if i0 == 0:
            score -= 0.5
        candidates.append({"start": float(start), "score": score, "volume": vol,
                           "peak": peak, "bursts": bursts, "speech": speech, "hot": hot})
    if not candidates:
        return []
    candidates.sort(key=lambda c: (-c["score"], -c["hot"]))
    chosen = []
    for cand in candidates:
        if all(abs(cand["start"] - c["start"]) > length * 0.85 for c in chosen):
            chosen.append(cand)
        if len(chosen) >= count:
            break
    if not chosen:
        chosen = candidates[:1]
    if len(chosen) < count and max_start > 0:
        for i in range(count * 2):
            if len(chosen) >= count:
                break
            start = round(min(max_start, (i + 0.5) * max_start / count), 2)
            if any(abs(start - c["start"]) < 1.0 for c in chosen):
                start = round(min(max_start, start + 1.0), 2)
            if any(abs(start - c["start"]) < 1.0 for c in chosen):
                continue
            chosen.append({"start": start, "score": 0.0, "volume": 0.0,
                           "peak": 0.0, "bursts": 0.0, "speech": 0.0, "hot": 0.0})
    out = []
    for i, cand in enumerate(sorted(chosen, key=lambda c: c["start"])):
        start = cand["start"]
        end = min(duration - 0.1, start + length)
        text = " ".join(w["w"] for w in words if start <= w["s"] < end)
        title = title_for(text, topic)
        kind, reason = classify(text)
        score = int(max(35, min(99, 44 + cand["score"] * 1.3)))
        out.append({"title": f"{i + 1}. {title}", "startTime": round(start, 2),
                    "endTime": round(end, 2), "score": score, "reason": reason,
                    "type": kind, "transcript": text[:1200],
                    "factors": {"energy": round(cand["volume"], 1),
                                "peak": round(cand["peak"], 1),
                                "bursts": round(cand["bursts"], 1),
                                "speech": round(cand["speech"], 1),
                                "hooks": round(cand["hot"], 1)}})
    return out


def face_box(path, ffmpeg_bin, ffprobe_bin):
    """Normalised x,y,w,h of the most prominent face in a frame near the middle."""
    info = ffprobe(path)
    dur = info["duration"]
    at = max(0.0, dur / 2 if dur else 0.0)
    tmp = path.parent / "_face.jpg"
    run([ffmpeg_bin, "-y", "-v", "error", "-nostdin", "-ss", f"{at:.2f}", "-i", str(path),
         "-frames:v", "1", "-vf", "scale=640:-2", str(tmp)])
    try:
        import cv2
        image = cv2.imread(str(tmp))
        if image is None:
            return None
        h0, w0 = image.shape[:2]
        model = face_model_path()
        if model and hasattr(cv2, "FaceDetectorYN_create"):
            det = cv2.FaceDetectorYN_create(str(model), "", (w0, h0), 0.7, 0.3, 5000)
            _, faces = det.detect(image)
            if faces is not None and len(faces):
                face = max(faces, key=lambda f: f[2] * f[3])
                return [float(face[0]) / w0, float(face[1]) / h0,
                        float(face[2]) / w0, float(face[3]) / h0]
        cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        if cascade_path.exists():
            cascade = cv2.CascadeClassifier(str(cascade_path))
            found = cascade.detectMultiScale(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), 1.1, 4)
            if len(found):
                x, y, w, h = max(found, key=lambda f: f[2] * f[3])
                return [float(x) / w0, float(y) / h0, float(w) / w0, float(h) / h0]
    except Exception as exc:
        log(f"face detection unavailable: {exc}")
    finally:
        tmp.unlink(missing_ok=True)
    return None


def ass_color(hex_color):
    h = hex_color.lstrip("#")
    if len(h) != 6:
        h = "FFFFFF"
    return "&H00" + h[4:6] + h[2:4] + h[0:2]


def write_captions(words, start, end, dest, title, cap_color, active_color, font):
    local = [w for w in words if w["e"] > start and w["s"] < end]
    lines = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}",
        "WrapStyle: 2", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Cap,{font},{CAP_SIZE},{ass_color(cap_color)},{ass_color(active_color)},&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,7,2,5,60,60,0,1",
        f"Style: Title,{font},{TITLE_SIZE},{ass_color(cap_color)},{ass_color(cap_color)},&H00000000,&H90000000,-1,0,0,0,100,100,1,0,3,5,0,5,40,40,0,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    def ts(sec):
        sec = max(0.0, sec)
        h = int(sec // 3600)
        m = int(sec // 60 % 60)
        s = sec % 60
        return f"{h}:{m:02d}:{s:05.2f}"

    lines.append(f"Dialogue: 0,{ts(0.3)},{ts(end-start)},Title,,0,0,0,,{{\\pos({W // 2},{int(H * 0.11)})}}{title[:90]}")
    groups = []
    for i in range(0, len(local), 3):
        groups.append(local[i:i + 3])
    for group in groups:
        for idx, word in enumerate(group):
            a = max(0.0, word["s"] - start)
            b = min(end - start, word["e"] - start + 0.35)
            if b - a < 0.15:
                b = a + 0.15
            parts = []
            for j, w in enumerate(group):
                color = active_color if j == idx else cap_color
                text = w["w"].replace("{", "").replace("}", "")
                parts.append("{\\c" + ass_color(color) + "}" + text)
            lines.append(f"Dialogue: 1,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\pos({W // 2},{int(H * 0.82)})\\an5}} " + " ".join(parts))
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")


def plan_graph(face, layout, zoom=1.0, cam=(0.72, 0.0, 0.28, 0.30)):
    """Return (filter_complex, output_label, chosen_layout)."""
    if face and face[2] >= 0.11:
        layout = "crop"
    elif face and (face[1] < 0.55) and (face[0] + face[2] > 0.55):
        layout = layout if layout in ("auto", "stack") else layout
        layout = "stack" if layout == "auto" else layout
    elif layout == "auto":
        layout = "blur"
    if layout not in ("stack", "crop", "blur"):
        layout = "blur"

    normalise = (f"[0:v]scale={SW}:{SH}:force_original_aspect_ratio=increase,crop={SW}:{SH},"
                 "setsar=1")
    if layout == "stack":
        base = normalise + ",split=2[fg][cam]"
        top_h = 365 if FAST else 730
        bottom_h = H - top_h
        fx, fy, fw, fh = cam
        crop_w = max(40, min(SW, int(fw * SW)))
        crop_h = max(30, min(SH, int(fh * SH)))
        cx = max(0, min(SW - crop_w, int(fx * SW)))
        cy = max(0, min(SH - crop_h, int(fy * SH)))
        camchain = (f"[cam]crop={crop_w}:{crop_h}:{cx}:{cy},"
                    f"scale={W}:{top_h}:force_original_aspect_ratio=increase,crop={W}:{top_h},setsar=1[camx]")
        gamechain = (f"[fg]scale={W}:{bottom_h + (110 if FAST else 220)}:force_original_aspect_ratio=increase,"
                     f"crop={W}:{bottom_h},setsar=1[game]")
        merge = "[camx][game]vstack=inputs=2[framed]"
        return ";".join([base, camchain, gamechain, merge]), "framed", layout

    if layout == "crop":
        fx, fy, fw, fh = face or (0.5, 0.4, 0.2, 0.25)
        cx = max(0.0, min(1.0, fx + fw / 2))
        cy = max(0.0, min(1.0, fy + fh / 2))
        cropw = max(100, int(SW / max(1.0, float(zoom))))
        croph = max(100, int(cropw * H / W))
        x = max(0, min(SW - cropw, int(cx * SW - cropw / 2)))
        y = max(0, min(SH - croph, int(cy * SH - croph / 2)))
        chain = (normalise + f",crop={cropw}:{croph}:{x}:{y},"
                 f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[framed]")
        return chain, "framed", layout

    base = normalise + ",split=2[bg][fg]"
    if FAST:
        bg = (f"[bg]scale=108:192:force_original_aspect_ratio=increase,crop=108:192,"
              f"scale={W}:{H}:flags=bicubic,gblur=sigma=4,eq=brightness=-0.12[bgb]")
    else:
        bg = (f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
              f"gblur=sigma=35,eq=brightness=-0.12[bgb]")
    merge = (f"[fg]scale={W}:{H}:force_original_aspect_ratio=decrease,setsar=1[fgs];"
             f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2[framed]")
    return ";".join([base, bg, merge]), "framed", layout


def render_clip(source, pick, work, dest, opts, words):
    start, end = float(pick["startTime"]), float(pick["endTime"])
    length = max(2.0, end - start)
    slug = re.sub(r"[^a-z0-9]+", "-", pick["title"].lower()).strip("-")[:48] or "clip"
    src = work / f"{slug}.src.mp4"
    is_url = source.startswith("http://") or source.startswith("https://")
    ffmpeg = opts["ffmpeg"]
    if is_url:
        if not src.exists():
            fmt = (f"bv*[height<={SH}][vcodec^=avc1]+ba/bv*[height<={SH}]+ba/b[height<={SH}]/bv*+ba/b")
            ytdlp_run(["--no-playlist", "--no-warnings",
                       "--socket-timeout", "15", "--retries", "2", "-f", fmt,
                       "--merge-output-format", "mp4", "--download-sections",
                       f"*{max(0, start - 3):.2f}-{min(end + 3, start + length + 6):.2f}",
                       "-o", str(src), source], timeout=600)
            if not src.exists():
                matches = list(src.parent.glob(src.stem + ".*"))
                if matches:
                    matches[0].rename(src)
        inpoint = min(3.0, start)
        source_input = str(src)
    else:
        inpoint = start
        source_input = source

    face = opts.get("face", "detect")
    if face == "detect":
        face = face_box(Path(source_input), ffmpeg, opts["ffprobe"])
    graph, label, layout = plan_graph(face, pick.get("layout") or opts.get("layout") or "auto",
                                      float(pick.get("zoom", 1.0)),
                                      (float(pick.get("camX", 0.72)), float(pick.get("camY", 0)),
                                       float(pick.get("camW", 0.28)), float(pick.get("camH", 0.3))))
    ass = work / f"{slug}.ass"
    write_captions(words, start, end, ass, pick["title"],
                   pick.get("captionColor", opts.get("captionColor", "#FFFFFF")),
                   pick.get("highlightColor", opts.get("highlightColor", "#FFD400")),
                   pick.get("fontFamily", opts.get("fontFamily", "Arial Black")))
    speed = float(pick.get("playbackSpeed", 1.0) or 1.0)
    filters = f"{graph};[{label}]fps={FPS},setpts=PTS/{speed},ass={ass.name}[vout]"
    if speed != 1.0:
        filters += ";[0:a]atempo=" + str(speed) + "[aspeed]"
        audio_label = "[aspeed]"
    else:
        audio_label = "[0:a]"
    filters += f";{audio_label}loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]"
    audio_out = "[aout]"
    music = opts.get("music")
    if music and Path(music).exists():
        filters += ";[1:a]volume=0.12[bed];[aout][bed]amix=inputs=2:duration=first[amixed]"
        audio_out = "[amixed]"
    cmd = [ffmpeg, "-y", "-v", "error", "-nostdin", "-ss", f"{inpoint:.3f}", "-t", f"{length:.3f}",
           "-i", source_input]
    if music and Path(music).exists():
        cmd += ["-stream_loop", "-1", "-i", str(music)]
    cmd += ["-filter_complex", filters, "-map", "[vout]", "-map", audio_out,
            "-c:v", "libx264", "-preset", "ultrafast" if FAST else "veryfast",
            "-crf", "28" if FAST else "22", "-pix_fmt", "yuv420p",
            "-threads", "2", "-filter_threads", "2",
            "-x264-params", "scenecut=0:aq-mode=0" if FAST else "aq-mode=1",
            "-profile:v", "high", "-r", str(FPS), "-c:a", "aac", "-b:a", "96k" if FAST else "192k",
            "-movflags", "+faststart", str(dest)]
    run(cmd, timeout=3600, cwd=str(work))
    thumb = dest.with_name(dest.stem + ".jpg")
    try:
        run([ffmpeg, "-y", "-v", "error", "-nostdin", "-ss", f"{min(2.0, length / 2):.2f}",
             "-i", str(dest), "-frames:v", "1", "-vf", "scale=270:-2", str(thumb)])
    except WorkError:
        thumb = None
    if src.exists():
        src.unlink(missing_ok=True)
    return {"file": dest.name, "thumb": thumb.name if thumb else None, "look": layout}


def fetch_url_source(url, work, yt_dlp, limit=120, live=False, info=None):
    if info is None:
        try:
            info = json.loads(ytdlp_run(["--no-playlist", "--no-warnings", "--socket-timeout", "15",
                                         "--retries", "2", "-J", url], binary=yt_dlp, timeout=90))
        except Exception:
            info = invidious_info(url) or {}
            if info:
                log("Using a public mirror to inspect the YouTube source")
    if FAST and youtube_video_id(url):
        mirror = invidious_info(url)
        if mirror:
            info = mirror
    live = live or bool((info.get("is_live") or info.get("liveNow")) and not info.get("was_live"))
    mirror_usable = bool(info and (info.get("hlsUrl") or info.get("adaptiveFormats") or info.get("formatStreams")))
    mirror_error = None
    if FAST and mirror_usable:
        try:
            log("Downloading from a public mirror")
            return download_invidious_source(info, work, limit)
        except Exception as exc:
            mirror_error = exc
    out = work / "video.%(ext)s"
    base = ["--no-playlist", "--no-warnings", "--socket-timeout", "15", "--retries", "2",
            "-f", "18/best[height<=720]/best"]
    attempts = []
    if live:
        attempts.append([*base, "--live-from-start", "--download-sections", f"*0-{limit}"])
        attempts.append([*base, "--live-from-start", "--external-downloader", "ffmpeg",
                         "--external-downloader-args", f"ffmpeg_i:-t {limit}"])
    attempts.append([*base, "--download-sections", f"*0-{limit}"])
    attempts.append(base)
    last = None
    for args in attempts:
        try:
            ytdlp_run([*args, "-o", str(out), url], binary=yt_dlp, timeout=900)
            last = None
            break
        except Exception as exc:
            last = exc
    if last is not None:
        if mirror_usable and mirror_error is None:
            try:
                log("Downloading from a public mirror")
                return download_invidious_source(info, work, limit)
            except Exception as exc:
                mirror_error = exc
        detail = str(mirror_error or last)[:400].replace("\n", " ")
        raise WorkError(f"Could not download the source video: {detail}. Try a different public link or retry later.") from last
    files = [p for p in work.glob("video.*") if not p.name.endswith((".part", ".ytdl"))]
    if not files:
        raise WorkError("No video could be downloaded from that URL. Try a different public link or retry later.")
    return files[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--clips", type=int, default=3)
    ap.add_argument("--max-source-seconds", type=int, default=1800)
    ap.add_argument("--topic", default="gaming")
    ap.add_argument("--language", default="auto")
    ap.add_argument("--settings", default="{}")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    ap.add_argument("--ffprobe", default="ffprobe")
    ap.add_argument("--ytdlp", default="yt-dlp")
    ap.add_argument("--rerender", default=None, help="JSON of a single clip to re-render")
    opts = ap.parse_args()
    settings = json.loads(opts.settings)
    os.environ["YTDLP"] = opts.ytdlp
    config = {"ffmpeg": opts.ffmpeg, "ffprobe": opts.ffprobe,
              "captionColor": settings.get("captionColor", "#FFFFFF"),
              "highlightColor": settings.get("highlightColor", "#FFD400"),
              "fontFamily": settings.get("fontFamily", "Arial Black"),
              "layout": settings.get("layout", "auto"),
              "music": settings.get("music"),
              "face": None if FAST else "detect"}
    work = Path(opts.workdir)
    outdir = Path(opts.outdir)
    work.mkdir(parents=True, exist_ok=True)
    outdir.mkdir(parents=True, exist_ok=True)
    source = opts.source
    is_url = source.startswith("http://") or source.startswith("https://")

    try:
        if opts.rerender:
            pick = json.loads(opts.rerender)
            progress("rendering", 55, "Re-rendering clip with your edits")
            words = pick.get("words") or []
            rendered = render_clip(source, pick, work, outdir / (pick.get("file") or "edited.mp4"), config, words)
            progress("finalizing", 95, "Finalizing edited clip")
            emit("done", duration=0, clips=[{**pick, **rendered}])
            return

        if FAST:
            log("Fast mode: shorter source, lighter rendering")
        progress("downloading", 6, "Inspecting the source video")
        analysis_source = source
        source_limit = min(opts.max_source_seconds, FAST_SOURCE_SECONDS) if FAST else opts.max_source_seconds
        if is_url:
            try:
                meta = ytdlp_run(["--no-playlist", "--no-warnings", "--socket-timeout", "15",
                                  "--retries", "2", "-J", source], binary=opts.ytdlp, timeout=90)
                info = json.loads(meta)
            except Exception:
                info = invidious_info(source) or {}
                if info:
                    log("Using a public mirror to inspect the YouTube source")
            is_live = bool((info.get("is_live") or info.get("liveNow")) and not info.get("was_live"))
            if is_live:
                progress("downloading", 10, "Live stream detected - recording the opening segment")
            progress("downloading", 12, f"Downloading the first {source_limit // 60} minute(s) of the stream")
            analysis_source = str(fetch_url_source(source, work, opts.ytdlp, source_limit, is_live, info))
        else:
            if not Path(source).exists():
                raise WorkError(f"Source file is missing: {source}")
        info = ffprobe(analysis_source)
        duration = info["duration"]
        if duration < 5:
            raise WorkError("The source video is too short to make clips from (minimum 5 seconds).")
        log(f"source: {info['width']}x{info['height']}, {duration:.1f}s")
        progress("downloading", 22, f"Decoding {duration / 60:.1f} min of audio")
        samples = load_audio(analysis_source, opts.ffmpeg)
        analysis_samples = samples[:FAST_SOURCE_SECONDS * RATE] if FAST else samples
        analysis_duration = min(duration, len(analysis_samples) / RATE) if FAST else duration
        if FAST and analysis_duration < duration:
            log(f"Fast mode: analyzing first {analysis_duration / 60:.1f} min of the source")
        if FAST and not has_speech(analysis_samples):
            words, language = [], None if opts.language == "auto" else opts.language
            log("Skipped speech-to-text: no speech detected in the analyzed segment")
        else:
            progress("transcribing", 32, "Loading local speech-to-text model")
            words, language = transcribe(analysis_samples, None if opts.language == "auto" else opts.language,
                                         settings.get("scanModel", "tiny"))
            log(f"transcribed {len(words)} words (language: {language})")
        progress("analyzing", 55, "Scoring energy, speech and scene changes")
        scenes = [] if FAST else scene_times(analysis_source, opts.ffmpeg, duration)
        picks = pick_moments(words, volume_curve(analysis_samples), scenes, analysis_duration, opts.clips, opts.topic)
        if not picks:
            raise WorkError("No highlight moments could be found in this video.")
        for pick in picks:
            pick["words"] = [w for w in words if pick["startTime"] - 1 <= w["s"] <= pick["endTime"] + 1]
        emit("moments", clips=[{k: v for k, v in p.items() if k != "words"} for p in picks])
        results = []
        total = len(picks)
        for i, pick in enumerate(picks):
            pct = 62 + int((i / total) * 32)
            progress("rendering", pct, f"Rendering clip {i + 1} of {total}: {pick['title'][:44]}")
            rendered = render_clip(analysis_source, pick, work, outdir / f"{i + 1:02d}-clip.mp4", config,
                                   pick["words"])
            results.append({**pick, **rendered})
        progress("finalizing", 97, "Saving clip metadata")
        emit("done", duration=round(duration, 2), language=language or "auto", clips=results)
    except Exception as exc:
        emit("error", message=str(exc)[:1200])
        sys.exit(1)


if __name__ == "__main__":
    main()
