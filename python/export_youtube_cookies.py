import argparse
import asyncio
import json
import sys
from pathlib import Path
from urllib.request import urlopen

import websockets

ALLOWED_DOMAINS = ("youtube.com", "google.com", "gstatic.com", "googleusercontent.com", "ytimg.com", "googleapis.com")


def is_relevant(domain):
    host = domain.lstrip(".").lower()
    return any(host == suffix or host.endswith("." + suffix) for suffix in ALLOWED_DOMAINS)


async def read_cookies(port):
    with urlopen(f"http://127.0.0.1:{port}/json/version", timeout=8) as response:
        version = json.load(response)
    endpoint = version.get("webSocketDebuggerUrl")
    if not endpoint:
        raise RuntimeError("Chrome debugging endpoint is unavailable")
    async with websockets.connect(endpoint, max_size=None) as socket:
        await socket.send(json.dumps({"id": 1, "method": "Storage.getCookies"}))
        while True:
            message = json.loads(await socket.recv())
            if message.get("id") != 1:
                continue
            if "error" in message:
                raise RuntimeError(message["error"].get("message", "Chrome rejected the cookie request"))
            return message.get("result", {}).get("cookies", [])


def write_netscape(cookies, destination):
    lines = ["# Netscape HTTP Cookie File"]
    count = 0
    for cookie in cookies:
        domain = str(cookie.get("domain") or "")
        name = str(cookie.get("name") or "")
        value = str(cookie.get("value") or "")
        if not domain or not name or not is_relevant(domain):
            continue
        include = "TRUE" if (not cookie.get("hostOnly") or domain.startswith(".")) else "FALSE"
        path = str(cookie.get("path") or "/")
        secure = "TRUE" if cookie.get("secure") else "FALSE"
        expiry = int(cookie.get("expires") or 0)
        if expiry < 0:
            expiry = 0
        lines.append("\t".join([domain, include, path, secure, str(expiry), name, value]))
        count += 1
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=9222)
    parser.add_argument("--output", default=str(Path(__file__).resolve().parent.parent / "storage" / "youtube-cookies.txt"))
    args = parser.parse_args()
    cookies = asyncio.run(read_cookies(args.port))
    count = write_netscape(cookies, Path(args.output))
    if not count:
        raise RuntimeError("No YouTube or Google cookies found. Sign in inside the CLIPFORGE Chrome window first.")
    print(f"Exported {count} cookies to {args.output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Cookie export failed: {exc}", file=sys.stderr)
        sys.exit(1)
