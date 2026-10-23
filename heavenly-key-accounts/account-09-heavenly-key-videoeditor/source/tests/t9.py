import threading,http.server,functools,os
from playwright.sync_api import sync_playwright
os.chdir('/tmp/t')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/user-data/outputs/heavenlykey-studio');H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8130),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
R=[];errs=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':1100,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8130/index.html');pg.wait_for_timeout(500)
 ok('nav and home logos load',pg.evaluate('[...document.images].filter(i=>i.src.includes("logo")).every(i=>i.naturalWidth>0)'))
 ok('favicon linked',pg.evaluate('!!document.querySelector("link[rel=icon]")'))
 pg.screenshot(path='home.png')
 pg.click('nav button[data-p=video]');pg.set_input_files('#vf','/tmp/t/green.webm');pg.wait_for_function('!document.getElementById("pp").disabled')
 pg.evaluate('document.getElementById("v").currentTime=1');pg.click('#ohk');pg.wait_for_function('OV&&OV.naturalWidth');pg.wait_for_timeout(500)
 ok('canvas not tainted by logo (export-safe)',pg.evaluate('()=>{try{document.getElementById("cv").toDataURL();return true}catch(e){return false}}'))
 c=pg.evaluate('()=>[...document.getElementById("cv").getContext("2d").getImageData(1200,40,1,1).data]')
 print('px',c)
 pg.screenshot(path='editor.png',clip={'x':200,'y':80,'width':880,'height':520})
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
