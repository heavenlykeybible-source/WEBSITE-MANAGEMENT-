import threading,http.server,functools,os
from playwright.sync_api import sync_playwright
os.chdir('/tmp/t')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/user-data/outputs/heavenlykey-studio');H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8129),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
R=[];errs=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8129/index.html');pg.click('nav button[data-p=video]');pg.set_input_files('#vf','/tmp/t/green.webm');pg.wait_for_function('!document.getElementById("pp").disabled')
 pg.evaluate('document.getElementById("v").currentTime=1');pg.wait_for_timeout(500)
 def px(x,y):return pg.evaluate('([x,y])=>[...document.getElementById("cv").getContext("2d").getImageData(x,y,1,1).data]',[x,y])
 pg.set_input_files('#of','/tmp/t/logo.png');pg.wait_for_function('OV&&OV.naturalWidth');pg.wait_for_timeout(400)
 c=px(1130,650);ok('logo drawn bottom-right',c[0]>230 and c[1]<30 and c[2]>230,str(c))
 pg.select_option('#opo','tl');pg.wait_for_timeout(400);c=px(60,45);ok('logo moves top-left',c[0]>230 and c[1]<30 and c[2]>230,str(c));c2=px(1130,650);ok('old spot restored',c2[1]>200,str(c2))
 pg.evaluate('()=>{const e=document.getElementById("oop");e.value=50}');pg.wait_for_timeout(400);c=px(60,45);ok('opacity blends logo',40<c[1]<200,str(c))
 pg.click('#orm');pg.wait_for_timeout(400);c=px(60,45);ok('remove overlay',c[1]>200,str(c))
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
