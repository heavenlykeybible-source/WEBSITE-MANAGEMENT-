// 24/7 radio playout. Runs on your server with no browser open.
// Needs Node 18+ and FFmpeg. Put audio files (mp3, m4a, aac, wav, flac, ogg) in ./media
// Run: DESTS="rtmp://a.rtmp.youtube.com/live2/KEY,rtmp://live.twitch.tv/app/KEY" BG=cover.jpg node playout.js
// BG can be an image or a looping video (mp4, mov, webm). Without BG a plain dark background is used.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const DIR = process.env.MEDIA || './media', BG = process.env.BG || '';
const DESTS = (process.env.DESTS || '').split(',').map(s => s.trim()).filter(d => /^rtmps?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~\/?&=%+-]*)?$/.test(d));
if (!DESTS.length) { console.error('Set DESTS to one or more rtmp:// or rtmps:// URLs that include the stream key.'); process.exit(1); }

function playlist() {
  const files = fs.readdirSync(DIR).filter(f => /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(f)).sort();
  if (!files.length) { console.error('No audio files found in ' + DIR); process.exit(1); }
  fs.writeFileSync('list.txt', files.map(f => `file '${path.resolve(DIR, f).replace(/'/g, "'\\''")}'`).join('\n'));
  console.log(files.length + ' track(s) loaded');
}
function start() {
  playlist();
  const visual = !BG ? ['-f', 'lavfi', '-i', 'color=c=0x14202e:s=1280x720:r=30']
    : /\.(mp4|mov|webm|mkv)$/i.test(BG) ? ['-stream_loop', '-1', '-i', BG]
    : ['-loop', '1', '-framerate', '30', '-i', BG];
  const args = ['-loglevel', 'warning', ...visual,
    '-re', '-stream_loop', '-1', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '2000k', '-maxrate', '2000k', '-bufsize', '4000k', '-g', '60', '-r', '30',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-map', '0:v', '-map', '1:a', '-f', 'tee', DESTS.map(d => `[f=flv:onfail=ignore]${d}`).join('|')];
  const ff = spawn('ffmpeg', args);
  ff.stderr.on('data', d => process.stderr.write(d));
  ff.on('exit', c => { console.log('FFmpeg stopped (' + c + '). Restarting in 5 seconds.'); setTimeout(start, 5000); });
  process.on('SIGINT', () => { ff.removeAllListeners('exit'); ff.kill('SIGINT'); process.exit(0); });
}
start();
