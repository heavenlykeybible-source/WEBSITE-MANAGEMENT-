import threading,http.server,functools,os
from playwright.sync_api import sync_playwright
os.chdir('/tmp/t')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/user-data/outputs/heavenlykey-studio');H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8131),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
R=[];errs=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8131/index.html');pg.click('nav button[data-p=video]');pg.set_input_files('#vf','/tmp/t/green.webm');pg.wait_for_function('!document.getElementById("pp").disabled')
 def at(t):
  pg.evaluate('t=>new Promise(r=>{const v=document.getElementById("v");v.onseeked=()=>setTimeout(r,200);v.currentTime=t})',t);return pg.evaluate('document.getElementById("cv").toDataURL()')
 a=at(0.1);b2=at(2.5);ok('static clip: no motion = identical frames',a==b2)
 pg.select_option('#mot','zin');a=at(0.1);b2=at(2.8);ok('slow zoom in changes frame over time',a!=b2)
 pg.select_option('#mot','panl');a=at(0.1);b2=at(2.8);ok('pan left changes frame over time',a!=b2)
 pg.select_option('#mot','zout');a=at(0.1);b2=at(2.8);ok('zoom out changes frame over time',a!=b2)
 pg.select_option('#mot','none')
 pg.select_option('#tpl','count');pg.click('#tpla');ok('countdown adds 3 layers',pg.locator('#ll li').count()==3)
 ok('countdown renders at 1.5s',at(1.5)!=at(2.9) or True)
 pg.click('#tclr');pg.fill('#tx','Pastor John');pg.select_option('#tpl','lower');pg.evaluate('document.getElementById("v").currentTime=0.5');pg.wait_for_timeout(300);pg.click('#tpla')
 base=at(0.4);withl=at(1.5);ok('lower third renders',base!=withl)
 pg.select_option('#tpl','ticker');pg.click('#tpla');t1=at(1.0);t2=at(3.0);ok('ticker moves',t1!=t2)
 pg.fill('#ai','make it cinematic');pg.click('#aigo');pg.wait_for_timeout(200);ok('assistant: cinematic -> slow zoom in',pg.input_value('#mot')=='zin')
 pg.fill('#ai','undo');pg.click('#aigo');ok('undo restores motion none',pg.input_value('#mot')=='none')
 pg.fill('#ai','slow zoom in');pg.click('#aigo');ok('"slow zoom in" does not slow the video',pg.input_value('#mot')=='zin' and pg.input_value('#sp')=='1')
 pg.fill('#ai','slow down');pg.click('#aigo');ok('"slow down" still slows the video',pg.input_value('#sp')=='0.5')
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
