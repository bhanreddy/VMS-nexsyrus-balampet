import { scanGeometryScript } from './scanGeometry';

/** Entire editor runs locally; no photo or pixel data is sent to a third party. */
export function buildScannerHtml(dataUri: string): string {
  const source = JSON.stringify(dataUri).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>
  *{box-sizing:border-box} body{margin:0;background:#0f172a;color:#f8fafc;font:14px system-ui,-apple-system,sans-serif;height:100vh;height:100dvh;display:flex;flex-direction:column}
  button,select{font:inherit;color:inherit;background:#243147;border:1px solid #475569;border-radius:12px;min-height:44px;padding:8px 12px;cursor:pointer} button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}button:disabled{opacity:.45;cursor:wait}button.active{background:#155e75;border-color:#67e8f9} .primary{background:#4f46e5;border-color:#818cf8;font-weight:700}
  #stage{flex:1;min-height:150px;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:26px;position:relative} #paper{position:relative;flex-shrink:0}#image{display:block;width:100%;height:100%;object-fit:contain}#outline{position:absolute;inset:0;width:100%;height:100%;pointer-events:none} .corner{position:absolute;width:44px;height:44px;padding:0;transform:translate(-50%,-50%);border:0;background:transparent;touch-action:none;border-radius:50%}.corner:after{content:'';display:block;width:18px;height:18px;background:#fff;border:3px solid #0891b2;border-radius:50%;margin:auto;box-shadow:0 0 0 2px white,0 2px 10px #0009}.corner:focus:after{background:#67e8f9}
  #loupe{display:none;position:absolute;right:12px;top:12px;width:110px;height:110px;border:3px solid #67e8f9;border-radius:18px;background:#fff;pointer-events:none;box-shadow:0 5px 25px #0008}
  #hint{padding:6px 16px;text-align:center;color:#cbd5e1;font-size:12px;min-height:30px}#tools{display:flex;flex-direction:column;flex-shrink:0;padding:12px 16px max(16px,env(safe-area-inset-bottom));background:#162237;border-top:1px solid #334155;max-height:52dvh}#options{overflow:auto;min-height:0}#finish{flex-shrink:0;background:#162237;padding-top:10px}.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.row:last-child{margin:0}.row>button{flex:1;white-space:nowrap}.adjust{display:flex;align-items:center;gap:10px;flex:1;min-width:220px}.adjust label{width:78px;font-size:12px;color:#cbd5e1}.adjust input{flex:1;min-width:60px;accent-color:#67e8f9}.adjust output{width:30px;font-size:12px}.label{color:#94a3b8;font-size:12px}#error{color:#fda4af;white-space:pre-wrap;margin:0 0 8px}#quality{flex:1;min-width:120px}.hidden{display:none!important}
  @media(min-width:750px){#tools{max-height:40dvh;padding-left:max(20px,calc((100vw - 1000px)/2));padding-right:max(20px,calc((100vw - 1000px)/2))}}
  </style></head><body>
  <div id="stage"><div id="paper"><canvas id="image" aria-label="Diary photo with adjustable crop corners"></canvas><svg id="outline" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path id="shade" fill="#02061799" fill-rule="evenodd"/><polygon id="border" fill="none" stroke="#67e8f9" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
  ${['Top left', 'Top right', 'Bottom right', 'Bottom left'].map((name, i) => `<button class="corner" id="corner${i}" aria-label="${name} crop corner. Drag or use arrow keys." title="${name} corner"></button>`).join('')}
  </div><canvas id="loupe" width="180" height="180"></canvas></div>
  <div id="hint" role="status" aria-live="polite">Loading photo…</div>
  <div id="tools"><div id="options"><p id="error" role="alert"></p>
  <div class="row"><button id="left" disabled>↶ Rotate left</button><button id="right" disabled>↷ Rotate right</button><button id="full" disabled>Full page</button><button id="inset" disabled>Inset edges</button><button id="reset" disabled>Reset all</button></div>
  <div class="row" role="group" aria-label="Photo filter"><button data-filter="original" class="active" disabled>Original</button><button data-filter="enhance" disabled>Clear text</button><button data-filter="gray" disabled>Grayscale</button><button data-filter="bw" disabled>Black &amp; white</button></div>
  <div class="row"><div class="adjust"><label for="brightness">Brightness</label><input id="brightness" type="range" min="-60" max="60" value="0" disabled><output id="brightnessValue">0</output></div><div class="adjust"><label for="contrast">Contrast</label><input id="contrast" type="range" min="-60" max="60" value="0" disabled><output id="contrastValue">0</output></div></div>
  </div><div class="row" id="finish"><label for="quality" class="label">Image size</label><select id="quality"><option value="1600">Compact · 1600 px</option><option value="2400" selected>High quality · 2400 px</option><option value="3200">Maximum · 3200 px</option></select><button id="preview" disabled>Preview scan</button><button id="save" class="primary" disabled>Use this photo</button></div>
  </div><script>
  ${scanGeometryScript}
  const $ = id => document.getElementById(id);
  function send(message){const text=JSON.stringify(message);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(text);else window.parent.postMessage(text,'*');}
  let original=null, source=document.createElement('canvas'), points=[], rotation=0, filter='original', preview=false, working=false, loaded=false;
  const display=$('image'), stage=$('stage'), paper=$('paper');
  const corners=[0,1,2,3].map(i=>$('corner'+i));
  const buttons=Array.from(document.querySelectorAll('button,input,select'));
  function defaults(inset=0){return [{x:inset,y:inset},{x:1-inset,y:inset},{x:1-inset,y:1-inset},{x:inset,y:1-inset}];}
  function status(text){$('hint').textContent=text;}
  function fail(error){$('error').textContent=error.message||String(error);}
  function lock(value){working=value;buttons.forEach(b=>b.disabled=value||!loaded);}
  function layout(){if(!display.width)return;const ratio=Math.min(Math.max(40,stage.clientWidth-52)/display.width,Math.max(40,stage.clientHeight-52)/display.height);paper.style.width=(display.width*ratio)+'px';paper.style.height=(display.height*ratio)+'px';}
  function drawCorners(){const polygon=points.map(p=>(p.x*1000)+','+(p.y*1000)).join(' ');$('border').setAttribute('points',polygon);$('shade').setAttribute('d','M0 0H1000V1000H0Z M'+points.map(p=>(p.x*1000)+' '+(p.y*1000)).join('L')+'Z');corners.forEach((el,i)=>{el.style.left=(points[i].x*100)+'%';el.style.top=(points[i].y*100)+'%';});}
  function edit(){preview=false;$('preview').textContent='Preview scan';$('outline').classList.remove('hidden');corners.forEach(el=>el.classList.remove('hidden'));display.width=source.width;display.height=source.height;display.getContext('2d').drawImage(source,0,0);drawCorners();layout();status('Drag the four corners to the page edges. Use arrow keys for fine adjustments.');}
  function orient(){source.width=rotation%2?original.height:original.width;source.height=rotation%2?original.width:original.height;const ctx=source.getContext('2d');ctx.translate(source.width/2,source.height/2);ctx.rotate(rotation*Math.PI/2);ctx.drawImage(original,-original.width/2,-original.height/2);edit();}
  function turn(direction){if(!loaded||working)return;points=points.map(p=>direction>0?{x:1-p.y,y:p.x}:{x:p.y,y:1-p.x});points=direction>0?[points[3],points[0],points[1],points[2]]:[points[1],points[2],points[3],points[0]];rotation=(rotation+direction+4)%4;orient();}
  function moveCorner(index,x,y){const candidate=points.map(p=>({...p}));candidate[index]={x:Math.min(1,Math.max(0,x)),y:Math.min(1,Math.max(0,y))};if(validScanCorners(candidate)){points=candidate;drawCorners();}}
  corners.forEach((el,index)=>{
    el.addEventListener('pointerdown',event=>{if(working||preview)return;event.preventDefault();el.setPointerCapture(event.pointerId);el.dataset.drag='yes';$('loupe').style.display='block';magnify(points[index]);});
    el.addEventListener('pointermove',event=>{if(el.dataset.drag!=='yes')return;const rect=paper.getBoundingClientRect();moveCorner(index,(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);magnify(points[index]);});
    function release(){delete el.dataset.drag;$('loupe').style.display='none';}
    el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
    el.addEventListener('keydown',event=>{const d=event.shiftKey ? .02 : .002;const delta={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[event.key];if(delta){event.preventDefault();moveCorner(index,points[index].x+delta[0],points[index].y+delta[1]);}});
  });
  function magnify(point){const ctx=$('loupe').getContext('2d'),x=point.x*source.width,y=point.y*source.height;ctx.fillStyle='white';ctx.fillRect(0,0,180,180);ctx.drawImage(source,x-45,y-45,90,90,0,0,180,180);ctx.strokeStyle='#0891b2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(90,65);ctx.lineTo(90,115);ctx.moveTo(65,90);ctx.lineTo(115,90);ctx.stroke();}
  // Bilinear resampling with inverse projective mapping preserves diagonal text.
  function render(maxEdge){
    if(!validScanCorners(points))throw Error('Please place all four corners around the page.');
    const size=scanOutputSize(points,source.width,source.height,maxEdge),out=document.createElement('canvas');out.width=size.width;out.height=size.height;
    const ctx=out.getContext('2d'),image=ctx.createImageData(out.width,out.height),dst=image.data,src=source.getContext('2d').getImageData(0,0,source.width,source.height).data,m=scanProjectiveMap(points),sw=source.width,sh=source.height;
    const brightness=Number($('brightness').value)*2.55,contrast=1+Number($('contrast').value)/100,extra=filter==='enhance'?1.3:1;
    for(let y=0;y<out.height;y++){const v=y/(out.height-1);for(let x=0;x<out.width;x++){
      const u=x/(out.width-1),z=m[6]*u+m[7]*v+1,sx=Math.max(0,Math.min(sw-1,(m[0]*u+m[1]*v+m[2])/z*(sw-1))),sy=Math.max(0,Math.min(sh-1,(m[3]*u+m[4]*v+m[5])/z*(sh-1)));
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,a=(iy*sw+ix)*4,b=(iy*sw+Math.min(ix+1,sw-1))*4,c=(Math.min(iy+1,sh-1)*sw+ix)*4,d=(Math.min(iy+1,sh-1)*sw+Math.min(ix+1,sw-1))*4,k=(y*out.width+x)*4;
      for(let channel=0;channel<3;channel++){const value=(src[a+channel]*(1-fx)+src[b+channel]*fx)*(1-fy)+(src[c+channel]*(1-fx)+src[d+channel]*fx)*fy;dst[k+channel]=Math.max(0,Math.min(255,(value-128)*contrast*extra+128+brightness+(filter==='enhance'?12:0)));}
      if(filter==='gray'||filter==='bw'){const l=.299*dst[k]+.587*dst[k+1]+.114*dst[k+2];dst[k]=dst[k+1]=dst[k+2]=l;}dst[k+3]=255;
    }}
    if(filter==='bw'){
      const stride=out.width+1,integral=new Float64Array(stride*(out.height+1)),radius=Math.max(8,Math.round(out.width/40));
      for(let y=0;y<out.height;y++){let sum=0;for(let x=0;x<out.width;x++){sum+=dst[(y*out.width+x)*4];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+sum;}}
      for(let y=0;y<out.height;y++){for(let x=0;x<out.width;x++){const l=Math.max(0,x-radius),r=Math.min(out.width,x+radius+1),t=Math.max(0,y-radius),b=Math.min(out.height,y+radius+1),mean=(integral[b*stride+r]-integral[t*stride+r]-integral[b*stride+l]+integral[t*stride+l])/((r-l)*(b-t)),k=(y*out.width+x)*4,value=dst[k]<mean-12?0:255;dst[k]=dst[k+1]=dst[k+2]=value;}}
    }
    ctx.putImageData(image,0,0);return out;
  }
  async function showPreview(){if(!loaded||working)return;lock(true);status('Preparing scan…');await new Promise(r=>setTimeout(r,30));try{const output=render(1200);display.width=output.width;display.height=output.height;display.getContext('2d').drawImage(output,0,0);preview=true;$('preview').textContent='Adjust corners';$('outline').classList.add('hidden');corners.forEach(el=>el.classList.add('hidden'));layout();status('Scan preview · saved photos use the selected image size.');}catch(error){fail(error);}finally{lock(false);}}
  $('preview').onclick=()=>preview?edit():showPreview();$('left').onclick=()=>turn(-1);$('right').onclick=()=>turn(1);
  $('full').onclick=()=>{points=defaults();edit();};$('inset').onclick=()=>{points=defaults(.06);edit();};
  $('reset').onclick=()=>{rotation=0;points=defaults();filter='original';$('brightness').value=$('contrast').value=0;$('brightnessValue').textContent=$('contrastValue').textContent='0';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));orient();};
  document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));showPreview();});
  ['brightness','contrast'].forEach(id=>{$(id).oninput=()=>{$(id+'Value').textContent=$(id).value;};$(id).onchange=()=>showPreview();});
  $('save').onclick=async()=>{if(!loaded||working)return;lock(true);$('error').textContent='';status('Saving edited photo…');await new Promise(r=>setTimeout(r,30));try{const output=render(Number($('quality').value));send({type:'save',dataUri:output.toDataURL('image/jpeg',.94),width:output.width,height:output.height});lock(false);}catch(error){fail(error);lock(false);}};
  window.addEventListener('resize',layout);new ResizeObserver(layout).observe(stage);
  const photo=new Image();photo.onload=()=>{try{original=document.createElement('canvas');const scale=Math.min(1,3200/Math.max(photo.naturalWidth,photo.naturalHeight));original.width=Math.max(2,Math.round(photo.naturalWidth*scale));original.height=Math.max(2,Math.round(photo.naturalHeight*scale));original.getContext('2d').drawImage(photo,0,0,original.width,original.height);points=defaults();loaded=true;lock(false);orient();}catch(error){fail(error);}};photo.onerror=()=>{status('Photo could not load. Close the editor and choose it again.');};photo.src=${source};
  document.addEventListener('keydown',event=>{if(event.key==='Escape')send({type:'cancel'});});
  </script></body></html>`;
}
