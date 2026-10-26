"""Decode the published QR images and check their real app/installation URLs."""
import json,re,subprocess,base64,concurrent.futures
from PIL import Image,ImageDraw
import zxingcpp
origin='https://apps.heavenlykey.org'
def get(url):
 # Use the same Node Fetch client as the deployment probes; Python urllib is rejected by the public edge's bot filter.
 script="const r=await fetch(process.argv[1],{signal:AbortSignal.timeout(25000)});console.log(JSON.stringify({status:r.status,body:Buffer.from(await r.arrayBuffer()).toString('base64')}));"
 result=json.loads(subprocess.check_output(['node','--input-type=module','-e',script,url],text=True));assert result['status']==200,(url,result['status']);return result['status'],base64.b64decode(result['body'])
items=json.loads(get(origin+'/qr/destinations.json')[1])
def check(item):
 svg=get(origin+item['qr'])[1].decode();dim=int(re.search(r'viewBox="0 0 (\d+)',svg)[1]);image=Image.new('RGB',(dim*10,dim*10),'white');draw=ImageDraw.Draw(image)
 for x,y in re.findall(r'M(\d+) (\d+)h1v1h-1z',svg):
  x=int(x)*10;y=int(y)*10;draw.rectangle((x,y,x+9,y+9),fill='black')
 result=zxingcpp.read_barcode(image);assert result and result.text==item['url'],'QR destination mismatch: '+item['id']
 assert get(item['url'])[0]==200,'Unavailable destination: '+item['url']
 return 'PASS live QR decode and destination: '+item['id']
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
 for result in executor.map(check,items):print(result)
