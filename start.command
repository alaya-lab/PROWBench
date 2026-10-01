#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'Python 3 is required. Install Python 3, then open start.command again.'
  exit 1
fi
exec python3 -u - "$@" <<'PY'
import argparse
import errno
import functools
import http.server
import os
import re
import webbrowser
from pathlib import Path

class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Serve browser byte-range requests so native video controls can seek."""

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        self.byte_range = None
        requested = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not requested or not os.path.isfile(path):
            return super().send_head()
        try:
            source = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        info = os.fstat(source.fileno())
        size = info.st_size
        modified = self.date_time_string(info.st_mtime)
        if self.headers.get("If-Range") not in (None, modified):
            source.close()
            return super().send_head()
        match = re.fullmatch(r"bytes=([0-9]*)-([0-9]*)", requested.strip())
        start, end = 0, -1
        if match and any(match.groups()):
            first, last = match.groups()
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            elif int(last) > 0:
                start, end = max(0, size - int(last)), size - 1
        if start >= size or end < start:
            source.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        self.byte_range = (start, end)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Last-Modified", modified)
        self.end_headers()
        source.seek(start)
        return source

    def copyfile(self, source, output):
        if self.byte_range is None:
            return super().copyfile(source, output)
        remaining = self.byte_range[1] - self.byte_range[0] + 1
        while remaining > 0:
            data = source.read(min(64 * 1024, remaining))
            if not data:
                break
            output.write(data)
            remaining -= len(data)

parser = argparse.ArgumentParser(description="Start the standalone PROWBench website.")
parser.add_argument("--port", type=int, default=8767)
parser.add_argument("--no-browser", action="store_true")
args = parser.parse_args()
handler = functools.partial(RangeRequestHandler, directory=str(Path.cwd()))
try:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler)
except OSError as error:
    if error.errno != errno.EADDRINUSE:
        raise
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
url = f"http://127.0.0.1:{server.server_port}/"
print(f"PROWBench: {url}", flush=True)
print("Keep this window open. Press Ctrl+C to stop the website.", flush=True)
if not args.no_browser:
    webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nWebsite stopped.")
finally:
    server.server_close()
PY
