from playwright.sync_api import sync_playwright
R=[]
def ok(n,c,d=''):R.append(bool(c));print('PASS' if c else 'FAIL',n,d)
with sync_playwright() as p:
 b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page();errs=[]
 pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('http://127.0.0.1:8125/');pg.click('nav button[data-p=acct]')
 ok('signed-out view shows login',pg.is_visible('#auth') and not pg.is_visible('#dash'))
 pg.fill('#em','me3@test.com');pg.fill('#pw','short');pg.click('#rg');pg.wait_for_timeout(500);ok('short password error shown','10 characters' in pg.inner_text('#am2'))
 pg.fill('#pw','a long password 1');pg.click('#rg');pg.wait_for_selector('#dash:not([hidden])',timeout=8000);ok('register then auto sign-in',True,pg.inner_text('#who'))
 pg.reload();pg.click('nav button[data-p=acct]');pg.wait_for_selector('#dash:not([hidden])',timeout=5000);ok('session persists after reload',True)
 pg.click('nav button[data-p=video]');pg.set_input_files('#vf','/tmp/t/test.webm');pg.wait_for_function('!document.getElementById("pp").disabled')
 pg.fill('#tx','SAVED TEXT');pg.fill('#ts','1');pg.fill('#te','3');pg.click('#tadd');pg.evaluate('()=>{const e=document.getElementById("vsat");e.value=150}')
 pg.click('nav button[data-p=acct]');pg.fill('#pn','Test edit');pg.click('#ps');pg.wait_for_selector('#pl li');ok('project saved and listed','Test edit' in pg.inner_text('#pl'))
 pg.click('nav button[data-p=video]');pg.click('#tclr');pg.evaluate('()=>{document.getElementById("vsat").value=100}')
 pg.click('nav button[data-p=acct]');pg.click('#pl li button:has-text("Open")');pg.wait_for_timeout(600)
 ok('project reopen restores text and look',pg.evaluate('()=>[document.getElementById("ll").innerText.includes("SAVED TEXT"),document.getElementById("vsat").value]')==[True,'150'])
 pg.set_input_files('#mu','/tmp/t/test.webm');pg.wait_for_selector('#ml li');ok('media uploaded and listed','test.webm' in pg.inner_text('#ml'),pg.inner_text('#mst'))
 pg.reload();pg.click('nav button[data-p=acct]');pg.wait_for_selector('#ml li')
 pg.click('#ml li button:has-text("Open in editor")');pg.wait_for_function('document.getElementById("vm").innerText.includes("loaded")',timeout=8000);ok('media opens in editor from R2',True,pg.inner_text('#vm'))
 pg.click('nav button[data-p=acct]');pg.click('#ml li button:has-text("Delete")');pg.wait_for_timeout(500);ok('media delete',pg.locator('#ml li').count()==0)
 pg.click('#lo');pg.wait_for_timeout(600);ok('sign out shows login',pg.is_visible('#auth'))
 pg.fill('#em','me3@test.com');pg.fill('#pw','wrong wrong wrong');pg.click('#li');pg.wait_for_timeout(500);ok('wrong password message','Wrong' in pg.inner_text('#am2'))
 b.close();print('ERR',errs);print('RESULT',sum(R),'/',len(R))
