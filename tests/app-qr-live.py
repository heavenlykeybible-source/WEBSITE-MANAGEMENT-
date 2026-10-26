"""Decode the published QR images and check their real app/installation URLs."""
import json,re,urllib.request,concurrent.futures
from PIL import Image,ImageDraw
import zxingcpp
origin='https://apps.heavenlykey.org'
def get(url):
 with urllib.request.urlopen(url,timeout=25) as response:return response.status,response.read()
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
