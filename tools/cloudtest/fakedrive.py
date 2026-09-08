#!/usr/bin/env python3
"""A stand-in for the four Drive v3 calls cloud.js makes, on 127.0.0.1:8765.
Files live in memory for the life of the process; /_dump lists them."""
import json, re, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

FILES = {}      # id -> {name, mime, parents, content(bytes), modifiedTime, trashed}
LOG = []
SEQ = [0]
def now(): return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
def newid():
    SEQ[0] += 1; return 'fake-%d' % SEQ[0]
def meta(f, id):
    return {'id': id, 'modifiedTime': f['modifiedTime'], 'size': str(len(f['content'])), 'trashed': f['trashed']}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
    def reply(self, code, body, ctype='application/json'):
        if isinstance(body, (dict, list)): body = json.dumps(body).encode()
        self.send_response(code); self.cors()
        self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n) if n else b''
    def authed(self):
        return self.headers.get('Authorization') == 'Bearer fake-token'
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def route(self):
        u = urlparse(self.path); qs = parse_qs(u.query)
        LOG.append(self.command + ' ' + self.path[:160])
        if u.path == '/_dump':
            return self.reply(200, {'files': [dict(meta(f, i), name=f['name'], mime=f['mime']) for i, f in FILES.items()], 'log': LOG})
        if not self.authed():
            return self.reply(401, {'error': {'message': 'Invalid Credentials'}})
        m = re.match(r'^/drive/v3/files/([^/]+)$', u.path)
        if self.command == 'GET' and u.path == '/drive/v3/files':
            q = qs.get('q', [''])[0]
            name = re.search(r"name='([^']*)'", q); name = name.group(1) if name else None
            folder = 'vnd.google-apps.folder' in q
            out = [meta(f, i) for i, f in FILES.items() if not f['trashed'] and (name is None or f['name'] == name)
                   and (f['mime'] == 'application/vnd.google-apps.folder') == folder]
            return self.reply(200, {'files': out})
        if self.command == 'POST' and u.path == '/drive/v3/files':
            j = json.loads(self.body() or b'{}'); id = newid()
            FILES[id] = {'name': j.get('name'), 'mime': j.get('mimeType'), 'parents': j.get('parents', []), 'content': b'', 'modifiedTime': now(), 'trashed': False}
            return self.reply(200, {'id': id})
        if self.command == 'GET' and m:
            f = FILES.get(m.group(1))
            if not f: return self.reply(404, {'error': {'message': 'File not found'}})
            if qs.get('alt') == ['media']: return self.reply(200, f['content'])
            return self.reply(200, meta(f, m.group(1)))
        m2 = re.match(r'^/upload/drive/v3/files/([^/]+)$', u.path)
        if self.command == 'PATCH' and m2:
            f = FILES.get(m2.group(1))
            if not f: return self.reply(404, {'error': {'message': 'File not found'}})
            f['content'] = self.body(); f['modifiedTime'] = now()
            return self.reply(200, meta(f, m2.group(1)))
        if self.command == 'POST' and u.path == '/upload/drive/v3/files':
            ct = self.headers.get('Content-Type', ''); b = re.search(r'boundary=(.+)$', ct)
            if not b: return self.reply(400, {'error': {'message': 'no boundary'}})
            bnd = b.group(1).encode(); parts = self.body().split(b'--' + bnd)
            md, content = {}, b''
            for p in parts:
                if b'\r\n\r\n' not in p: continue
                head, data = p.split(b'\r\n\r\n', 1); data = data.rsplit(b'\r\n', 1)[0]
                if b'name="metadata"' in head: md = json.loads(data)
                elif b'name="file"' in head: content = data
            id = newid()
            FILES[id] = {'name': md.get('name'), 'mime': md.get('mimeType'), 'parents': md.get('parents', []), 'content': content, 'modifiedTime': now(), 'trashed': False}
            return self.reply(200, meta(FILES[id], id))
        return self.reply(404, {'error': {'message': 'no such route ' + self.command + ' ' + u.path}})
    do_GET = do_POST = do_PATCH = route

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print('fake drive on', port, flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
