#!/usr/bin/env python3
"""The cloud, end to end, with Google stood in for: Save to Drive from one
throwaway headless profile, Load from Drive on a second, fresh one, and the
two towns compared key by key. Google's Drive API is fakedrive.py on
127.0.0.1:8765 and the sign-in popup is a shim that hands back a token, so
only Google's own servers are untested; the seal, the upload, the download,
the passphrase panel, the wrong-passphrase refusal, the confirm and the
reload are all the page's own code. Runs the page from this folder on
http://127.0.0.1:8000, on ports 9301 and 9302, in its own scratch dir.

    tools/cloudtest/drivetest.py                       # snapshots/v8.8.json
    SNAP=path/to/town.json tools/cloudtest/drivetest.py
    MQ_OUT=dir tools/cloudtest/drivetest.py            # where cache/, report.json, B-after-load.png go

`composite.py` builds a town with interiors and locus pictures on top of
the latest live snapshot, for a run that covers everything the seal carries.
Brave (or another Chromium) must be on PATH; the GL flags are the ones the
HANDOFF's headless rig needs. Prints the report and ends with `"ok": true`."""
import base64, json, os, subprocess, sys, tempfile, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, REPO + '/tools')
import cdp
S = os.environ.get('MQ_OUT') or tempfile.mkdtemp(prefix='cloudtest-')
STATIC, DRIVE = 8000, 8765
PASS = 'test-pass-312'
SHIM = r"""(function(){
  var FAKE = 'http://127.0.0.1:8765', G = 'https://www.googleapis.com';
  window.google = {accounts: {oauth2: {
    initTokenClient: function(cfg){ return {requestAccessToken: function(){ setTimeout(function(){ cfg.callback({access_token: 'fake-token', expires_in: 3600}); }, 0); }}; },
    revoke: function(t, cb){ if (cb) cb(); }
  }}};
  var f = window.fetch;
  window.fetch = function(u, o){ if (typeof u === 'string' && u.indexOf(G) === 0) u = FAKE + u.slice(G.length); return f.call(this, u, o); };
  window.__confirms = [];
  window.__notes = [];
  window.confirm = function(m){ window.__confirms.push(m); return true; };
  var _n = null;
  Object.defineProperty(window, 'hqNote', {configurable: true, get: function(){ return _n; }, set: function(v){ _n = function(m, bad){ window.__notes.push((bad ? '!' : '') + m); return v.apply(this, arguments); }; }});
  window.__shim = true;
})();"""
BOOT = "!!(window.__shim && typeof Cloud!=='undefined' && typeof Snap!=='undefined' && typeof Store!=='undefined' && document.readyState==='complete')"
DIGEST = """Snap.dump().then(function(s){
  var h = function(str){ var x = 5381; for (var i = 0; i < str.length; i++) x = ((x * 33) ^ str.charCodeAt(i)) >>> 0; return x.toString(16); };
  var ls = s.localStorage, keys = Object.keys(ls).sort(), o = {};
  keys.forEach(function(k){ o[k] = h(String(ls[k])); });
  var loci = {}; Object.keys(s.loci || {}).sort().forEach(function(k){ loci[k] = h(String(s.loci[k])); });
  return {counts: Snap.counts(s), keys: o, loci: loci, picture: s.picture ? h(s.picture) : null};
})"""

def wait_http(url, t=30):
    end = time.time() + t
    while time.time() < end:
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(0.3)
    raise SystemExit('not up: ' + url)

def poll(pg, expr, t=60, what=''):
    end = time.time() + t
    while time.time() < end:
        try:
            v = pg.js(expr)
            if v: return v
        except Exception: pass
        time.sleep(0.25)
    raise SystemExit('timed out waiting for ' + (what or expr))

def boot(pg): poll(pg, BOOT, what='boot'); time.sleep(0.5)
def origin(pg): return pg.js('performance.timeOrigin')
def wait_reload(pg, t0):
    poll(pg, 'performance.timeOrigin > %r' % t0, what='reload'); boot(pg)

def launch(name, port):
    prof = '%s/cache/%s' % (S, name)
    p = subprocess.Popen(['brave-browser', '--app=http://127.0.0.1:%d/index.html' % STATIC, '--user-data-dir=' + prof,
        '--remote-debugging-port=%d' % port, '--headless=new', '--window-size=1600,1000', '--use-angle=gl', '--enable-gpu',
        '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--disable-features=Translate,BraveRewards'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    wait_http('http://127.0.0.1:%d/json' % port)
    time.sleep(1.5)
    pg = cdp.attach(match='127.0.0.1:%d' % STATIC, port=port)
    pg.call('Page.enable')
    pg.call('Page.addScriptToEvaluateOnNewDocument', source=SHIM)
    t0 = origin(pg)
    pg.call('Page.reload', ignoreCache=True)
    wait_reload(pg, t0)
    return p, pg

def seal_visible(pg): return poll(pg, "(function(){var b=document.getElementById('seal'); return !!b && !b.hidden;})()", t=30, what='passphrase panel')
def type_pass(pg, pw, twice):
    pg.js("(function(){document.getElementById('sealpw').value=%r; %s document.getElementById('sealok').onclick(); return true;})()"
          % (pw, ("document.getElementById('sealpw2').value=%r;" % pw) if twice else ''))
def drive_dump():
    return json.load(urllib.request.urlopen('http://127.0.0.1:%d/_dump' % DRIVE))

def diff(a, b):
    out = []
    for k in sorted(set(a['keys']) | set(b['keys'])):
        if k != 'hq.index' and a['keys'].get(k) != b['keys'].get(k): out.append('key ' + k + ': ' + str(a['keys'].get(k)) + ' vs ' + str(b['keys'].get(k)))
    for k in sorted(set(a['loci']) | set(b['loci'])):
        if a['loci'].get(k) != b['loci'].get(k): out.append('locus ' + k)
    if a['picture'] != b['picture']: out.append('traced picture differs')
    return out

def main():
    report = {}
    procs = []
    try:
        procs.append(subprocess.Popen(['python3', '-m', 'http.server', str(STATIC), '--bind', '127.0.0.1'], cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        procs.append(subprocess.Popen(['python3', HERE + '/fakedrive.py', str(DRIVE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        wait_http('http://127.0.0.1:%d/index.html' % STATIC); wait_http('http://127.0.0.1:%d/_dump' % DRIVE)

        # ── A: a town, linked, saved ──
        pA, A = launch('A', 9301); procs.append(pA)
        snap = open(os.environ.get('SNAP', REPO + '/snapshots/v8.8.json')).read()
        t0 = origin(A)
        assert A.js('Snap.load(' + snap + ', false)') is True
        wait_reload(A, t0)
        dA = A.js(DIGEST); report['A_counts'] = dA['counts']
        report['A_linked'] = A.js('Cloud.link().then(function(){ return Cloud.linked(); })')
        A.js("(window.__saved=null, window.__saveErr=null, Cloud.save().then(function(r){window.__saved=r;}, function(e){window.__saveErr=String(e&&e.message||e);}), true)")
        seal_visible(A); type_pass(A, PASS, True)
        poll(A, 'window.__saved===true || !!window.__saveErr', t=90, what='save')
        report['A_save'] = A.js('({saved: window.__saved, err: window.__saveErr, linked: Cloud.linked(), notes: window.__notes})')
        d = drive_dump(); report['drive_after_save'] = d['files']
        # a second save should PATCH the same file, not make another
        A.js("(window.__saved=null, window.__saveErr=null, Cloud.save().then(function(r){window.__saved=r;}, function(e){window.__saveErr=String(e&&e.message||e);}), true)")
        poll(A, 'window.__saved===true || !!window.__saveErr', t=90, what='second save')
        d = drive_dump(); report['drive_after_second_save'] = d['files']; report['drive_log'] = d['log']
        # the cloud label, if the tune panel builds it
        A.js("(function(){ if (typeof Cloud.block==='function' && !document.getElementById('pcloudlabel')){ var b=document.createElement('div'); b.id='cloudprobe'; document.body.appendChild(b); Cloud.block(b);} return true; })()")
        report['A_label'] = A.js("(document.getElementById('pcloudlabel')||{}).textContent")

        # ── B: a fresh profile, linked, loaded ──
        pB, B = launch('B', 9302); procs.append(pB)
        dB0 = B.js(DIGEST); report['B_before'] = dB0['counts']
        report['B_linked'] = B.js('Cloud.link().then(function(){ return Cloud.linked(); })')
        # a wrong passphrase first
        B.js("(window.__loaded=null, window.__loadErr=null, Cloud.load().then(function(r){window.__loaded=r;}, function(e){window.__loadErr=String(e&&e.message||e);}), true)")
        seal_visible(B); type_pass(B, 'not-the-passphrase', False)
        poll(B, 'window.__loaded!==null || !!window.__loadErr', t=60, what='wrong-pass load')
        report['B_wrong_pass'] = B.js('({loaded: window.__loaded, err: window.__loadErr})')
        # then the right one
        t0 = origin(B)
        B.js("(window.__loaded=null, window.__loadErr=null, Cloud.load().then(function(r){window.__loaded=r;}, function(e){window.__loadErr=String(e&&e.message||e);}), true)")
        seal_visible(B); type_pass(B, PASS, False)
        poll(B, 'window.__loaded===true || !!window.__loadErr', t=60, what='load')
        report['B_load'] = B.js('({loaded: window.__loaded, err: window.__loadErr, confirms: window.__confirms, notes: window.__notes})')
        wait_reload(B, t0)
        dB = B.js(DIGEST); report['B_after'] = dB['counts']; report['B_linked_after'] = B.js('Cloud.linked()')
        report['diff_A_vs_B'] = diff(dA, dB)
        report['B_keys'] = len(dB['keys']); report['A_keys'] = len(dA['keys'])
        time.sleep(2)
        shot = B.call('Page.captureScreenshot', format='png')
        open(S + '/B-after-load.png', 'wb').write(base64.b64decode(shot['result']['data']))
        report['ok'] = (report['A_save']['saved'] is True and report['B_load']['loaded'] is True
                        and not report['diff_A_vs_B'] and 'wrong passphrase' in (report['B_wrong_pass']['err'] or '')
                        and len(report['drive_after_second_save']) == 2)
    finally:
        for p in procs:
            try: p.terminate(); p.wait(timeout=10)
            except Exception:
                try: p.kill()
                except Exception: pass
    json.dump(report, open(S + '/report.json', 'w'), indent=1)
    print(json.dumps(report, indent=1))
    print('written to', S)

main()
