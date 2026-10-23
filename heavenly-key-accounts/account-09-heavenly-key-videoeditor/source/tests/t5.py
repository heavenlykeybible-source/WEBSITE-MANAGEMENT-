import subprocess,json,threading,http.server,functools,os
from playwright.sync_api import sync_playwright
os.chdir('/tmp/t')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/user-data/outputs/heavenlykey-studio');H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8126),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
R=[];errs=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(accept_downloads=True);pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8126/index.html');pg.click('nav button[data-p=video]')
 pg.set_input_files('#sqf',['/tmp/t/test.webm','/tmp/t/clip2.webm']);pg.wait_for_function('document.querySelectorAll("#sql li").length==2',timeout=8000)
 ok('two clips added to sequence',True,pg.inner_text('#vm'))
 pg.evaluate('()=>{const e=document.getElementById("sqtr");e.value=1;e.dispatchEvent(new Event("input"))}')
 tot=pg.evaluate('SQ.total');ok('total = 4+3-1 = 6s with 1s crossfade',abs(tot-6)<.05,str(tot))
 def at(t):
  pg.evaluate('t=>{sqT=t;sqPlay=false}',t);pg.wait_for_timeout(900);return pg.evaluate('document.getElementById("cv").toDataURL()')
 a=at(1.0);m=at(3.5);c=at(5.2)
 ok('clip 1 and clip 2 frames differ',a!=c);ok('crossfade frame differs from both',m!=a and m!=c)
 pg.evaluate('()=>{const b=document.querySelectorAll("#sql li button");[...b].find(x=>x.textContent==="Down").click()}')
 ok('Down reorders clips',pg.evaluate('SQ[0].name')=='clip2.webm')
 pg.evaluate('()=>{const b=document.querySelectorAll("#sql li button");[...b].find(x=>x.textContent==="Up"&&!x.disabled)}')
 pg.evaluate('()=>{const b=[...document.querySelectorAll("#sql li button")].filter(x=>x.textContent==="Up");b[1].click()}')
 ok('Up restores order',pg.evaluate('SQ[0].name')=='test.webm')
 pg.fill('#tx','SEQ TEXT');pg.fill('#ts','0');pg.fill('#te','6');pg.select_option('#tst','box');pg.click('#tadd')
 with pg.expect_download(timeout=40000) as d:pg.click('#vexp')
 d.value.save_as('seq.webm')
 pr=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json','seq.webm']))
 kinds=[s['codec_type'] for s in pr['streams']];du=float(pr['format'].get('duration',0))
 ok('sequence export has video+audio',('video' in kinds and 'audio' in kinds),str(kinds))
 ok('export duration about 6s',5.5<du<7.0,str(du))
 subprocess.run(['ffmpeg','-loglevel','error','-y','-ss','5','-i','seq.webm','-frames:v','1','sq5.png']);ok('late frame extractable',os.path.exists('sq5.png'))
 pg.evaluate('()=>{const b=[...document.querySelectorAll("#sql li button")].filter(x=>x.textContent==="Remove");b[0].click()}');ok('Remove clip',pg.evaluate('SQ.length')==1)
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
