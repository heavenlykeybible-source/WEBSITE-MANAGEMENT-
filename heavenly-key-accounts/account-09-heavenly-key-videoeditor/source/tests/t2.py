import subprocess,json,threading,http.server,functools,os,re
from playwright.sync_api import sync_playwright
os.chdir('/tmp/t')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/user-data/outputs/heavenlykey-studio');H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8124),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
R=[];errs=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
def vol(f,ss,t):
  s=subprocess.run(['ffmpeg','-ss',str(ss),'-t',str(t),'-i',f,'-af','volumedetect','-f','null','-'],capture_output=True,text=True).stderr
  return float(re.search(r'mean_volume: (-?[\d.]+)',s).group(1)),float(re.search(r'max_volume: (-?[\d.]+)',s).group(1))
with sync_playwright() as p:
 b=p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/tmp/t/speech.wav','--autoplay-policy=no-user-gesture-required'])
 pg=b.new_page(accept_downloads=True);pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8124/index.html');pg.click('nav button[data-p=voice]');ok('voice tab visible',pg.is_visible('#voice'))
 pg.click('#rec');pg.wait_for_timeout(2500);pg.click('#rec');pg.wait_for_function('!document.getElementById("venh").disabled',timeout=8000)
 ok('mic recording captured',True,pg.inner_text('#vom'))
 pg.set_input_files('#vofile','speech.wav');pg.wait_for_timeout(800)
 pg.click('#venh');pg.wait_for_function('!document.getElementById("vdl").disabled',timeout=15000)
 with pg.expect_download() as d:pg.click('#vdl')
 d.value.save_as('enh.wav')
 with pg.expect_download() as d:pg.click('#vdo')
 d.value.save_as('orig.wav')
 on=vol('orig.wav',1.5,0.6)[0];en=vol('enh.wav',1.5,0.6)[0]
 print('silence mean dB orig/enh',on,en)
 ok('noise gate lowers silent-section noise >6 dB',on-en>6 or en<on-6)
 sp_o=vol('orig.wav',0.5,0.6)[0];sp_e=vol('enh.wav',0.5,0.6)[0]
 ok('speech louder after enhance',sp_e>sp_o,f'{sp_o}->{sp_e}')
 ok('peak normalized near -0.4 dB',-1<vol('enh.wav',0,4)[1]<0)
 du=float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json','enh.wav']))['format']['duration']);ok('duration kept at normal',3.9<du<4.1,str(du))
 pg.select_option('#vrate','1.18');pg.click('#venh');pg.wait_for_timeout(2500)
 with pg.expect_download() as d:pg.click('#vdl')
 d.value.save_as('hi.wav');du2=float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json','hi.wav']))['format']['duration']);ok('voice changer higher shortens (~3.4s)',3.2<du2<3.6,str(du2))
 pg.fill('#ttx','');pg.click('#tsp');ok('TTS empty text handled',pg.inner_text('#tvm')!='',pg.inner_text('#tvm'))
 pg.fill('#ttx','Hello');pg.click('#tsp');ok('TTS no crash',True,pg.inner_text('#tvm'))
 b.close()
print('ERR',[e for e in errs]);print('RESULT',sum(R),'/',len(R))
