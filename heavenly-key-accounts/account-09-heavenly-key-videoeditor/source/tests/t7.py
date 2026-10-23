import threading,http.server,functools,os
from playwright.sync_api import sync_playwright
os.chdir('/tmp/t')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/user-data/outputs/heavenlykey-studio');H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8128),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
R=[];errs=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8128/index.html');pg.click('nav button[data-p=video]');pg.set_input_files('#vf','/tmp/t/green.webm');pg.wait_for_function('!document.getElementById("pp").disabled')
 pg.evaluate('document.getElementById("v").currentTime=1');pg.wait_for_timeout(600)
 def px(x,y):return pg.evaluate('([x,y])=>{const c=document.getElementById("cv");return [...c.getContext("2d").getImageData(x,y,1,1).data]}',[x,y])
 c0=px(40,40);ok('off: corner is green',c0[1]>200 and c0[0]<80,str(c0))
 pg.check('#kon');pg.wait_for_timeout(500)
 c1=px(40,40);ok('on: green removed, background blue shows',c1[2]>100 and c1[1]<120,str(c1))
 ct=px(640,360);ok('on: red subject kept',ct[0]>180 and ct[1]<90,str(ct))
 pg.evaluate('()=>{const e=document.getElementById("kbg");e.value="#ff00ff";e.dispatchEvent(new Event("input"))}');pg.wait_for_timeout(500)
 c2=px(40,40);ok('background colour changes',c2[0]>180 and c2[2]>180 and c2[1]<80,str(c2))
 pg.uncheck('#kon');pg.fill('#ai','remove the background');pg.click('#aigo');pg.wait_for_timeout(500)
 ok('assistant turns green screen on',pg.is_checked('#kon'))
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
