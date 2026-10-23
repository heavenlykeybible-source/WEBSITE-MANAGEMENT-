from playwright.sync_api import sync_playwright
R=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8125/');pg.click('nav button[data-p=video]');pg.set_input_files('#vf','/tmp/t/test.webm');pg.wait_for_function('!document.getElementById("pp").disabled')
 pg.click('#autocap');pg.wait_for_function('document.getElementById("vm").innerText.includes("Sign in first")',timeout=15000);ok('auto-captions asks to sign in',True)
 pg.click('nav button[data-p=acct]');pg.fill('#em','cap@test.com');pg.fill('#pw','a long password 1');pg.click('#rg');pg.wait_for_selector('#dash:not([hidden])')
 pg.click('nav button[data-p=video]');pg.click('#autocap');pg.wait_for_function('document.getElementById("vm").innerText.includes("captions added")',timeout=20000)
 t=pg.inner_text('#ll');ok('captions created with correct text and timing',pg.locator('#ll li').count()==1 and 'hello brave new world' in t and '0.50s' in t,t)
 pg.evaluate('()=>{document.getElementById("v").currentTime=1.0}');pg.wait_for_timeout(500)
 ok('caption renders on canvas',pg.evaluate('()=>{const c=document.getElementById("cv"),d=c.getContext("2d").getImageData(0,Math.floor(c.height*.8),c.width,Math.floor(c.height*.15)).data;let w=0;for(let i=0;i<d.length;i+=4)if(d[i]>245&&d[i+1]>245&&d[i+2]>245)w++;return w>200}'))
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
