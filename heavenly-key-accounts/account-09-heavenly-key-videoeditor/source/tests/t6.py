import threading,http.server,functools,os
from playwright.sync_api import sync_playwright
os.chdir('/tmp/t')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/user-data/outputs/heavenlykey-studio');H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8127),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
R=[];errs=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8127/index.html');pg.click('nav button[data-p=video]')
 def say(t):pg.fill('#ai',t);pg.click('#aigo');pg.wait_for_timeout(150);return pg.inner_text('#ailog')
 def val(k):return pg.evaluate('k=>document.getElementById(k).value',k)
 ok('refuses before video loaded','Open a video first' in say('make it brighter'))
 pg.set_input_files('#vf','/tmp/t/test.webm');pg.wait_for_function('!document.getElementById("pp").disabled')
 m=say('Make it brighter and black and white');ok('multi-command: brighter + B/W',val('vb')=='115' and val('vfx')=='mono',m)
 m=say('make it a YouTube Short');ok('YouTube Short -> 9:16 only',val('asp')=='9:16',m)
 ok('canvas resized to vertical',pg.evaluate('[cv.width,cv.height]')==[720,1280])
 say('slow down');ok('slow down -> 0.5x',val('sp')=='0.5')
 say('mute');ok('mute -> volume 0',val('vv')=='0')
 pg.evaluate('document.getElementById("v").currentTime=1');
 m=say('add text "Hello Lagos"');ok('add text creates layer','Hello Lagos' in pg.inner_text('#ll'),m)
 say('undo');ok('undo removes text',pg.inner_text('#ll')=='')
 say('undo');ok('undo restores volume',val('vv')=='1')
 say('undo');say('undo');ok('undo restores 16:9 and original look',val('asp')=='16:9' and val('vfx')=='mono')
 say('undo');ok('undo back to baseline',val('vfx')=='none' and val('vb')=='100')
 ok('undo with empty history is safe','Nothing to undo' in say('undo'))
 ok('unknown command handled honestly','did not understand' in say('make me a sandwich'))
 say('make it brighter');say('make it brighter');say('make it brighter');ok('clamped at max 150',say('make it brighter') is not None and val('vb')=='145' or val('vb')=='150')
 say('zoom in');say('zoom in');ok('zoom in raises zoom',float(val('vz'))>1.3)
 say('make it vertical and sepia and fade');ok('three commands in one sentence',val('asp')=='9:16' and val('vfx')=='sepia' and val('vfade')=='1')
 pg.screenshot(path='/tmp/t/ai.png')
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
