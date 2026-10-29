'use strict';
const {app,BrowserWindow,session,dialog,Menu}=require('electron');
const {ministryURL}=require('./policy.cjs');
const START='https://apps.heavenlykey.org/experience.html';
let window;
app.enableSandbox();
function createWindow(){
 window=new BrowserWindow({width:1200,height:850,minWidth:360,minHeight:500,title:'Heavenly Key',backgroundColor:'#fffbe6',
  webPreferences:{nodeIntegration:false,nodeIntegrationInWorker:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false}});
 const contents=window.webContents;
 contents.on('will-navigate',(event,url)=>{if(!ministryURL(url))event.preventDefault();});
 contents.on('will-redirect',(event,url)=>{if(!ministryURL(url))event.preventDefault();});
 contents.setWindowOpenHandler(({url})=>{if(ministryURL(url))window.loadURL(url).catch(()=>{});return {action:'deny'};});
 contents.on('will-attach-webview',event=>event.preventDefault());
 contents.on('did-fail-load',async (_event,code,_description,_url,isMainFrame)=>{
  if(!isMainFrame||code===-3)return;
  const answer=await dialog.showMessageBox(window,{type:'info',title:'Connection unavailable',message:'The online resource could not load. Check your connection.',buttons:['Retry','Close'],defaultId:0,cancelId:1});
  if(answer.response===0&&!window.isDestroyed())window.loadURL(START).catch(()=>{});
 });
 window.loadURL(START).catch(()=>{});
}
app.whenReady().then(()=>{
 const s=session.defaultSession;
 // Remote pages never receive filesystem, notification or capture privileges silently.
 s.setPermissionRequestHandler(async (contents,permission,callback,details)=>{
  if(contents!==window?.webContents||permission!=='media'||!ministryURL(details.requestingUrl)){callback(false);return;}
  let answer;try { answer=await dialog.showMessageBox(window,{type:'question',title:'Camera or microphone permission',message:'Allow this Heavenly Key page to use your camera or microphone?',detail:'Only allow this when you started a meeting or recording.',buttons:['Deny','Allow'],defaultId:0,cancelId:0}); } catch { callback(false);return; }
  callback(answer.response===1);
 });
 s.on('will-download',(event)=>{event.preventDefault();dialog.showMessageBox(window,{type:'info',message:'For file downloads, use the official website in your browser.'}).catch(()=>{});});
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(process.platform==='darwin'?[{role:'appMenu'}]:[]),
  {label:'Navigate',submenu:[{label:'Home',click:()=>window.loadURL(START)},{role:'reload'},{label:'Back',click:()=>{if(window.webContents.navigationHistory.canGoBack())window.webContents.navigationHistory.goBack();}}]},
  {role:'editMenu'},{role:'viewMenu'}
 ]));
 createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('certificate-error',(event,_contents,_url,_error,_certificate,callback)=>{event.preventDefault();callback(false);});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
