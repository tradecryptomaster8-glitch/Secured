#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import datetime
from urllib.parse import urlparse

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')
LOG_FILE = os.path.join(BASE_DIR, 'access.log')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, fmt, *args):
        with open(LOG_FILE, 'a') as f:
            f.write("%s - - [%s] %s\n" % (
                self.client_address[0],
                self.log_date_time_string(),
                fmt % args
            ))

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path == '/data.json':
            try:
                with open(DATA_FILE, 'r') as f:
                    data = json.load(f)
            except Exception:
                data = []
            self._send_json(data)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/save':
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            payload = json.loads(body)

            entry = {
                'id': datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S%f'),
                'time': datetime.datetime.utcnow().isoformat() + 'Z',
                'ip': self.client_address[0],
                'user_agent': self.headers.get('User-Agent', ''),
                'site': payload.get('site', 'unknown'),
                'category': payload.get('category', 'unknown'),
                'type': payload.get('type', 'DATA'),
                'data': payload.get('data', {}),
                'page': payload.get('page', ''),
            }

            try:
                with open(DATA_FILE, 'r') as f:
                    db = json.load(f)
            except Exception:
                db = []
            db.insert(0, entry)
            db = db[:2000]
            with open(DATA_FILE, 'w') as f:
                json.dump(db, f, indent=2)

            self._send_json({'ok': True, 'id': entry['id']})
        except Exception as e:
            self._send_json({'ok': False, 'error': str(e)}, 400)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    with ThreadedServer(('0.0.0.0', PORT), Handler) as httpd:
        print(f"🚀 Server running on http://0.0.0.0:{PORT}")
        print(f"📊 Data saved to: {DATA_FILE}")
        print(f"🌐 Control panel: http://localhost:{PORT}/control.html")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Stopped")
