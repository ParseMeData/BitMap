"""Minimal Chrome DevTools Protocol client — enough to evaluate JS in the page.

No third-party module is needed and none is installed: this speaks just enough
WebSocket to drive a page. Launch the game with a debugging port first:

    ./play.sh --remote-debugging-port=9222

A throwaway profile is launched on a *different* port and reached with
`attach(port=...)`, so driving one is never quietly driving the live town.
"""
import base64, json, os, socket, struct, urllib.request


def targets(port=9222):
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=10) as r:
        return json.load(r)


class WS:
    def __init__(self, url):
        assert url.startswith('ws://'), url
        hostport, path = url[5:].split('/', 1)
        host, port = hostport.split(':')
        self.s = socket.create_connection((host, int(port)), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\n"
                        f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
                        f"Sec-WebSocket-Key: {key}\r\n"
                        f"Sec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        assert b'101' in buf.split(b'\r\n')[0], buf[:200]
        self.buf = buf.split(b'\r\n\r\n', 1)[1]

    def _read(self, n):
        while len(self.buf) < n:
            d = self.s.recv(1 << 20)
            if not d:
                raise EOFError
            self.buf += d
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text):
        p = text.encode()
        h = bytearray([0x81])
        n = len(p)
        if n < 126:
            h.append(0x80 | n)
        elif n < 65536:
            h.append(0x80 | 126); h += struct.pack('>H', n)
        else:
            h.append(0x80 | 127); h += struct.pack('>Q', n)
        m = os.urandom(4)
        h += m
        self.s.sendall(bytes(h) + bytes(b ^ m[i % 4] for i, b in enumerate(p)))

    def recv(self):
        while True:
            b0, b1 = self._read(2)
            op, n = b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            data = self._read(n)
            if op == 1:
                return data.decode('utf-8', 'replace')
            if op == 8:
                raise EOFError('closed')


class Page:
    def __init__(self, ws_url, url=''):
        self.ws = WS(ws_url)
        self.id = 0
        self.url = url          # which page this turned out to be, so a caller can say so

    def call(self, method, **params):
        self.id += 1
        self.ws.send(json.dumps({'id': self.id, 'method': method, 'params': params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('id') == self.id:
                return m

    def js(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, returnByValue=True,
                      awaitPromise=True, userGesture=True)
        res = r.get('result', {})
        if 'exceptionDetails' in res:
            d = res['exceptionDetails']
            raise RuntimeError((d.get('exception') or {}).get('description') or d.get('text'))
        return res.get('result', {}).get('value')


def attach(match='memory-quest-le', port=9222):
    try:
        listed = targets(port)
    except OSError as e:
        # By far the commonest way this fails is the browser having been started
        # without the flag, and a urllib traceback does not say so.
        raise SystemExit(f'nothing answering on port {port} ({e}). Start the game '
                         f'with --remote-debugging-port={port}.')
    pages = [t for t in listed
             if t.get('type') == 'page' and (match in t.get('url', '')
                                             or match in t.get('title', '').lower())]
    # `P` opens the platformer into the same profile, and both pages match, so
    # taking the first one binds to whichever the browser happens to list first
    # — which for a snapshot restore means writing the town through the runner.
    # The platformer is only attached to when the caller names it.
    if 'platformer' not in match:
        pages = [t for t in pages if 'platformer.html' not in t.get('url', '')]
    if not pages:
        raise SystemExit(f'no page matching {match!r} on port {port}. Is it running '
                         f'with --remote-debugging-port={port}?')
    # The builder can be open as `?wallpaper` or carry a hash, so the query and
    # fragment come off before asking whether this is the builder's own page.
    t = next((t for t in pages
              if t.get('url', '').split('?')[0].split('#')[0].endswith('/index.html')),
             pages[0])
    return Page(t['webSocketDebuggerUrl'], t.get('url', ''))
