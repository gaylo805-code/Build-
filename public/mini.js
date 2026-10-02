/* ============ MINI GAMES LIBRARY (100 games, static, localStorage HS) ============ */
(function(){
"use strict";
const W=420,H=560;
const cv=document.getElementById('miniCanvas'),ctx=cv.getContext('2d');
let G=null,last=0,raf=0;
// ---------- helpers ----------
function R(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function T(t,x,y,s,c,align){ctx.fillStyle=c||'#fff';ctx.font='bold '+s+'px monospace';ctx.textAlign=align||'center';ctx.fillText(t,x,y);ctx.textAlign='left';}
function BG(c1,c2){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,c1||'#0a0620');g.addColorStop(1,c2||'#160a30');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
function HUD(sc,extra){T(sc,12,30,20,'#0ff','left');if(extra)T(extra,12,54,14,'#8af','left');}
function hsGet(id){return +(localStorage.getItem('mh_'+id)||0);}
function hsSet(id,sc){const o=hsGet(id);if(sc>o){localStorage.setItem('mh_'+id,sc);return true;}return false;}
function endCommon(S){
  ctx.fillStyle='rgba(2,2,14,.85)';ctx.fillRect(0,0,W,H);
  T('HẾT GIỜ!',W/2,H/2-60,36,'#f0f');
  T('Điểm: '+S.score,W/2,H/2-10,24,'#fff');
  const isNew=hsSet(S.id,S.score);
  T(isNew?'★ KỶ LỤC MỚI! ★':'Kỷ lục: '+hsGet(S.id),W/2,H/2+30,18,isNew?'#ff0':'#7df');
  T('Chạm / SPACE để chơi lại',W/2,H/2+80,14,'#8af');
}
function die(S){if(S.over)return;S.over=true;S.newBest=hsSet(S.id,S.score);
  if(window.__miniEnd)window.__miniEnd(S.id,S.score);}
function liveLost(S){S.lives--;if(S.lives<=0)die(S);}
// buttons (tap zones) helper
function Buttons(S,list){S.btns=list;} // {x,y,w,h,label,fn}
function drawBtns(S){for(const b of (S.btns||[])){ctx.fillStyle=b.c||'#182040';ctx.strokeStyle='#0ff';ctx.lineWidth=1.5;
  R(b.x,b.y,b.w,b.h,10);ctx.fill();ctx.stroke();T(b.label,b.x+b.w/2,b.y+b.h/2+7,20,'#fff');}}
function tapBtns(S,x,y){for(const b of (S.btns||[])){if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+H*0){b.fn();return true;}}return false;}
function fmtT(fr){return Math.ceil(fr/60)+'s';}
/* ================= ENGINES ================= */
const E={};
// --- TAP clicker ---
E.tap={create(c){return{id:c.id,score:0,t:15*60,over:false,
  update(){if(this.over)return;if(--this.t<=0)die(this);},
  draw(){BG();HUD(this.score,'⏱ '+fmtT(this.t));
    const p=1+Math.sin(Date.now()/150)*.08;
    ctx.font=(64*p)+'px serif';ctx.textAlign='center';ctx.fillText(c.e,W/2,H/2);ctx.textAlign='left';
    T(c.verb||'BẤM LIÊN TỤC!',W/2,H/2+90,18,'#8af');
    if(this.over)endCommon(this);},
  onTap(){if(this.over)openMini(c.id);else{this.score+=c.step||1;}}};}};
// --- REACT ---
E.react={create(c){return{id:c.id,score:0,round:0,phase:'wait',wt:60,t0:0,over:false,
  update(){if(this.over)return;if(this.phase==='wait'&&--this.wt<=0){this.phase='go';this.t0=Date.now();}},
  press(){if(this.over){openMini(c.id);return;}
    if(this.phase==='wait'){this.score=0;die(this);}
    else{this.score+=Math.max(1,1000-(Date.now()-this.t0));this.round++;
      if(this.round>=5)die(this);else{this.phase='wait';this.wt=40+Math.random()*120|0;}}},
  draw(){ctx.fillStyle=this.phase==='go'?'#063':'#300';ctx.fillRect(0,0,W,H);
    T(this.phase==='go'?'BẤM!':c.e||'CHỜ...',W/2,H/2,44,this.phase==='go'?'#0f6':'#f66');
    T('Vòng '+(this.round+1)+'/5',W/2,H/2+50,18,'#fff');HUD(this.score);
    if(this.over)endCommon(this);},
  onTap(){this.press();},onKey(k){if(k==='Space')this.press();}};}};
// --- AIM (bia / whack lưới / invaders hàng) ---
E.aim={create(c){return{id:c.id,score:0,t:(c.time||30)*60,ammo:c.ammo||999,targets:[],cd:0,over:false,
  update(){const S=this;if(S.over)return;if(--S.t<=0){die(S);return;}
    if(--S.cd<=0){S.cd=c.gap||40;
      if(c.mode==='grid')S.targets.push({x:(Math.random()*3|0),y:(Math.random()*3|0),life:70});
      else if(c.mode==='row')S.targets.push({x:Math.random()*(W-60)+30,y:120,vy:1.2,life:400});
      else S.targets.push({x:40+Math.random()*(W-80),y:120+Math.random()*(H-260),r:12+Math.random()*16,life:180});}
    for(let i=S.targets.length-1;i>=0;i--){const t=S.targets[i];
      if(c.mode==='row')t.y+=t.vy;
      if(--t.life<=0)S.targets.splice(i,1);}},
  shoot(x,y){const S=this;if(S.over){openMini(c.id);return;}
    if(S.ammo<=0)return;S.ammo--;
    for(let i=S.targets.length-1;i>=0;i--){const t=S.targets[i];let hit=false;
      if(c.mode==='grid'){const gx=60+t.x*105,gy=140+t.y*105;hit=x>gx&&x<gx+90&&y>gy&&y<gy+90;}
      else hit=Math.hypot(t.x-x,t.y-y)<(t.r||34);
      if(hit){S.targets.splice(i,1);S.score+=(c.mode==='grid'?15:10);return;}}},
  draw(){const S=this;BG();HUD(S.score,'⏱ '+fmtT(S.t)+'  Đạn:'+S.ammo);
    if(c.mode==='grid')for(let i=0;i<3;i++)for(let j=0;j<3;j++){
      const has=S.targets.some(t=>t.x===i&&t.y===j);
      ctx.fillStyle=has?'#f80':'#1a1c33';R(60+i*105,140+j*105,90,90,12);ctx.fill();
      if(has){ctx.font='52px serif';ctx.textAlign='center';ctx.fillText(c.e,105+i*105,205+j*105);ctx.textAlign='left';}}
    else for(const t of S.targets){ctx.font='44px serif';ctx.textAlign='center';ctx.fillText(c.e,t.x,t.y);ctx.textAlign='left';}
    if(S.over)endCommon(S);},
  onTap(x,y){this.shoot(x,y);},onKey(k){if(k==='Space')this.shoot(W/2,H/2);}};}};
// --- DODGE ---
E.dodge={create(c){return{id:c.id,px:W/2,items:[],score:0,t:0,cd:30,over:false,
  update(){const S=this;if(S.over)return;S.t++;S.score=S.t/10|0;
    let m=0;if(KEY.ArrowLeft||KEY.KeyA)m--;if(KEY.ArrowRight||KEY.KeyD)m++;S.px=Math.min(W-20,Math.max(20,S.px+m*6));
    if(--S.cd<=0){S.cd=Math.max(14,34-S.t*.02);S.items.push({x:Math.random()*W,y:-20,vy:3+Math.random()*2+S.t*.002});}
    for(let i=S.items.length-1;i>=0;i--){const it=S.items[i];it.y+=it.vy;
      if(it.y>H+20){S.items.splice(i,1);continue;}
      if(Math.abs(it.x-S.px)<24&&Math.abs(it.y-(H-90))<24)die(S);}},
  draw(){BG();for(const it of this.items){ctx.font='30px serif';ctx.textAlign='center';ctx.fillText(c.e,it.x,it.y);ctx.textAlign='left';}
    ctx.font='40px serif';ctx.textAlign='center';ctx.fillText(c.p,this.px,H-70);ctx.textAlign='left';
    HUD(this.score|0);if(this.over)endCommon(this);},
  onTap(){if(this.over)openMini(c.id);},onKey(){if(this.over)openMini(c.id);}};}};
// --- CATCH ---
E.catch={create(c){return{id:c.id,px:W/2,items:[],score:0,lives:3,cd:40,t:0,over:false,
  update(){const S=this;if(S.over)return;S.t++;
    let m=0;if(KEY.ArrowLeft||KEY.KeyA)m--;if(KEY.ArrowRight||KEY.KeyD)m++;S.px=Math.min(W-30,Math.max(30,S.px+m*7));
    if(--S.cd<=0){S.cd=Math.max(24,46-S.t*.03);S.items.push({x:20+Math.random()*(W-40),y:-20,vy:2.5+Math.random()*2,bad:Math.random()<(c.bad||.25)});}
    for(let i=S.items.length-1;i>=0;i--){const it=S.items[i];it.y+=it.vy;
      if(it.y>H-100&&it.y<H-60&&Math.abs(it.x-S.px)<44){S.items.splice(i,1);
        if(it.bad)liveLost(S);else S.score+=c.step||5;continue;}
      if(it.y>H+20)S.items.splice(i,1);}},
  draw(){BG();for(const it of this.items){ctx.font='30px serif';ctx.textAlign='center';ctx.fillText(it.bad?c.badE:c.e,it.x,it.y);ctx.textAlign='left';}
    ctx.font='46px serif';ctx.textAlign='center';ctx.fillText(c.p,this.px,H-70);ctx.textAlign='left';
    HUD(this.score,'♥'.repeat(Math.max(0,this.lives)));if(this.over)endCommon(this);},
  onTap(){if(this.over)openMini(c.id);}};}};
// --- JUMP runner ---
E.jump={create(c){return{id:c.id,py:H-110,vy:0,on:true,obs:[],score:0,t:0,cd:80,spd:5,over:false,
  doJump(){if(this.over){openMini(c.id);return;}if(this.on){this.vy=-12;this.on=false;}},
  update(){const S=this;if(S.over)return;S.t++;S.score=S.t/10|0;S.spd=Math.min(11,5+S.t*.004);
    S.vy+=.65;S.py+=S.vy;if(S.py>=H-110){S.py=H-110;S.vy=0;S.on=true;}
    if(--S.cd<=0){S.cd=Math.max(50,95-S.spd*4)+Math.random()*25|0;S.obs.push({x:W+20});}
    for(let i=S.obs.length-1;i>=0;i--){const o=S.obs[i];o.x-=S.spd;
      if(o.x<-30){S.obs.splice(i,1);continue;}
      if(Math.abs(o.x-90)<28&&S.py>H-160)die(S);}},
  draw(){BG('#080418','#1a0530');ctx.strokeStyle='#0ff';ctx.beginPath();ctx.moveTo(0,H-80);ctx.lineTo(W,H-80);ctx.stroke();
    for(const o of this.obs){ctx.font='36px serif';ctx.textAlign='center';ctx.fillText(c.e,o.x,H-72);ctx.textAlign='left';}
    ctx.font='44px serif';ctx.textAlign='center';ctx.fillText(c.p,90,this.py+10);ctx.textAlign='left';
    HUD(this.score|0);if(this.over)endCommon(this);},
  onTap(){this.doJump();},onKey(k){if(k==='Space')this.doJump();}};}};
// --- STACK ---
E.stack={create(c){let bl=[{x:40,w:340}];
  return{id:c.id,b:bl,bx:0,bw:340,dir:3,y:H-80,score:0,over:false,
  drop(){const S=this;if(S.over){openMini(c.id);return;}
    const p=S.b[S.b.length-1];
    const nx=Math.max(S.bx,p.x),nw=Math.min(S.bx+S.bw,p.x+p.w)-nx;
    if(nw<12){die(S);return;}
    S.b.push({x:nx,w:nw});S.score++;S.bw=nw;S.y-=26;
    S.dir=S.dir>0?-(3+S.score*.2):(3+S.score*.2);if(S.y<140){S.b.shift();S.y+=26;}},
  update(){if(!this.over){this.bx+=this.dir;if(this.bx<0||this.bx+this.bw>W)this.dir*=-1;}},
  draw(){BG();const S=this;
    S.b.forEach((b,i)=>{ctx.fillStyle=['#0ff','#f0f','#ff0','#0f6'][i%4];ctx.fillRect(b.x,H-100-(S.b.length-1-i)*26,b.w,24);});
    if(!S.over){ctx.fillStyle='#fff';ctx.fillRect(S.bx,S.y,S.bw,24);}
    HUD(S.score,'SPACE/CHẠM ĐỂ THẢ');if(S.over)endCommon(S);},
  onTap(){this.drop();},onKey(k){if(k==='Space')this.drop();}};}};
// --- SIMON ---
E.simon={create(c){const seq=[];const cols=['#0f6','#f33','#ff0','#08f'];
  function nx(){seq.push(Math.random()*4|0);}
  nx();
  return{id:c.id,seq,idx:0,lock:true,fl:-1,ft:0,show:0,score:0,over:false,
  hit(i){const S=this;if(S.over){openMini(c.id);return;}if(S.lock||S.fl>=0)return;
    if(i===S.seq[S.idx]){S.idx++;if(S.idx>=S.seq.length){S.score=S.seq.length*10;S.lock=true;S.show=0;setTimeout(()=>nx(),350);}}
    else die(S);},
  update(){const S=this;if(S.over)return;
    if(S.lock){S.show++;if(S.show%36===0){const k=(S.show/36|0)-1;
      if(k<S.seq.length){S.fl=S.seq[k];S.ft=16;}else{S.lock=false;S.fl=-1;}}
      if(S.ft>0&&--S.ft===0)S.fl=-1;}},
  draw(){BG();const S=this;const L=['▲','◀','▼','▶'];
    for(let i=0;i<4;i++){ctx.fillStyle=S.fl===i?cols[i]:'#1a1c33';
      R(35+i*92,H/2-45,80,80,10);ctx.fill();
      T(L[i],75+i*92,H/2+12,28,S.fl===i?'#001':'#567');}
    HUD(S.score,S.lock?'XEM...':'LẶP LẠI!');if(S.over)endCommon(S);},
  onTap(x,y){for(let i=0;i<4;i++)if(x>35+i*92&&x<115+i*92&&y>H/2-45&&y<H/2+35)this.hit(i);},
  onKey(k){const m={ArrowUp:0,ArrowLeft:1,ArrowDown:2,ArrowRight:3};if(k in m)this.hit(m[k]);}};}};
// --- MEMORY ---
E.memory={create(c){const n=c.pairs||6;
  const v=[];for(let i=1;i<=n;i++){v.push(i,i);}v.sort(()=>Math.random()-.5);
  const cols=n<=6?3:4;
  return{id:c.id,v,open:[],done:0,moves:0,lock:0,over:false,cols,
  get score(){return Math.max(0,300-this.moves*10);},
  pick(i){const S=this;if(S.over){openMini(c.id);return;}
    if(S.lock>0||S.open.includes(i)||S.v[i]===0)return;
    S.open.push(i);
    if(S.open.length===2){S.moves++;
      if(S.v[S.open[0]]===S.v[S.open[1]]){S.v[S.open[0]]=S.v[S.open[1]]=0;S.done+=2;S.open=[];
        if(S.done>=S.v.length)die(S);}else S.lock=35;}},
  update(){if(this.lock>0&&--this.lock===0)this.open=[];},
  draw(){BG();const S=this;T(c.e+'  Lật cặp giống nhau',W/2,70,18,'#8af');
    for(let i=0;i<S.v.length;i++){const x=30+(i%S.cols)*((W-60)/S.cols),y=110+(i/S.cols|0)*110,w=(W-60)/S.cols-10;
      const sh=S.open.includes(i)||S.v[i]===0;
      ctx.fillStyle=S.v[i]===0?'#0a2a12':sh?'#0ff':'#1a1c33';R(x,y,w,95,10);ctx.fill();
      T(sh||S.v[i]===0?(S.v[i]||'✓'):(i+1),x+w/2,y+60,30,S.v[i]===0?'#0f6':sh?'#001':'#567');}
    HUD(S.score,'Lượt: '+S.moves);if(S.over)endCommon(S);},
  onTap(x,y){const S=this;for(let i=0;i<S.v.length;i++){const xx=30+(i%S.cols)*((W-60)/S.cols),yy=110+(i/S.cols|0)*110,w=(W-60)/S.cols-10;
    if(x>xx&&x<xx+w&&y>yy&&y<yy+95)S.pick(i);}}};}};
// --- PONG wall ---
E.pongw={create(c){return{id:c.id,px:W/2,b:{x:W/2,y:H/2,vx:3.5,vy:-4},score:0,over:false,
  update(){const S=this;if(S.over)return;
    let m=0;if(KEY.ArrowLeft||KEY.KeyA)m--;if(KEY.ArrowRight||KEY.KeyD)m++;S.px=Math.min(W-50,Math.max(50,S.px+m*7));
    const b=S.b;b.x+=b.vx;b.y+=b.vy;
    if(b.x<10||b.x>W-10)b.vx*=-1;
    if(b.y<70)b.vy*=-1;
    if(b.vy>0&&b.y>H-70&&b.y<H-40&&Math.abs(b.x-S.px)<55){b.vy=-(Math.abs(b.vy)+.15);b.vx+=(b.x-S.px)*.05;S.score+=5;}
    if(b.y>H+10)die(S);},
  draw(){BG();ctx.fillStyle='#0ff';ctx.fillRect(this.px-50,H-60,100,12);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.b.x,this.b.y,9,0,7);ctx.fill();
    HUD(this.score);if(this.over)endCommon(this);},
  onTap(){if(this.over)openMini(c.id);}};}};
// --- BREAK micro ---
E.breakm={create(c){const br=[];for(let i=0;i<8;i++)br.push({x:14+i*49,on:true});
  return{id:c.id,br,px:W/2,b:{x:W/2,y:H-100,vx:3,vy:-4.2},go:false,score:0,over:false,
  update(){const S=this;if(S.over||!S.go){if(!S.go&&!S.over)S.b.x=S.px;return;}
    let m=0;if(KEY.ArrowLeft||KEY.KeyA)m--;if(KEY.ArrowRight||KEY.KeyD)m++;S.px=Math.min(W-50,Math.max(50,S.px+m*7));
    const b=S.b;b.x+=b.vx;b.y+=b.vy;
    if(b.x<10||b.x>W-10)b.vx*=-1;if(b.y<70)b.vy*=-1;
    if(b.vy>0&&b.y>H-70&&Math.abs(b.x-S.px)<55){b.vy=-Math.abs(b.vy);}
    for(const r of S.br)if(r.on&&b.x>r.x&&b.x<r.x+44&&b.y>110&&b.y<140){r.on=false;b.vy*=-1;S.score+=10;}
    if(b.y>H+20)die(S);
    if(S.br.every(r=>!r.on)){S.br.forEach(r=>r.on=true);S.score+=30;}},
  draw(){BG();const S=this;
    S.br.forEach((r,i)=>{if(r.on){ctx.fillStyle=['#f0f','#ff0','#0f6'][i%3];ctx.fillRect(r.x,110,44,24);}});
    ctx.fillStyle='#0ff';ctx.fillRect(S.px-50,H-60,100,12);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(S.b.x,S.b.y,8,0,7);ctx.fill();
    HUD(S.score,S.go?'':'SPACE/CHẠM ĐỂ PHÁT BÓNG');if(S.over)endCommon(S);},
  onTap(){if(this.over)openMini(c.id);else this.go=true;},
  onKey(k){if(k==='Space'){if(this.over)openMini(c.id);else this.go=true;}}};}};
// --- SNAKE micro ---
E.snake={create(c){return{id:c.id,sn:[{x:5,y:7},{x:4,y:7}],d:{x:1,y:0},nd:{x:1,y:0},f:{x:12,y:7},score:0,fr:0,over:false,
  update(){const S=this;if(S.over)return;S.fr++;
    if(S.fr%8)return;S.d=S.nd;
    const h={x:(S.sn[0].x+S.d.x+21)%21,y:(S.sn[0].y+S.d.y+25)%25};
    if(S.sn.some(s=>s.x===h.x&&s.y===h.y)){die(S);return;}
    S.sn.unshift(h);
    if(h.x===S.f.x&&h.y===S.f.y){S.score+=10;S.f={x:Math.random()*21|0,y:4+(Math.random()*20|0)};}
    else S.sn.pop();},
  draw(){BG();const cs=20;
    ctx.fillStyle='#ff0';ctx.beginPath();ctx.arc(this.f.x*cs+10,this.f.y*cs+10-0+0,7,0,7);ctx.fill();
    this.sn.forEach((s2,i)=>{ctx.fillStyle=i===0?'#aff':'#0c6';ctx.fillRect(s2.x*cs+2,(s2.y)*cs+2-0,cs-4,cs-4);});
    HUD(this.score);if(this.over)endCommon(this);},
  onTap(){if(this.over)openMini(c.id);},
  onKey(k){const S=this;
    if(S.over){openMini(c.id);return;}
    if(k==='ArrowUp')S.nd={x:0,y:-1};if(k==='ArrowDown')S.nd={x:0,y:1};
    if(k==='ArrowLeft')S.nd={x:-1,y:0};if(k==='ArrowRight')S.nd={x:1,y:0};}};}};
// --- MAZE ---
E.maze={create(c){const lv=c.lv||0;
  const maps=[["#####","#S #","# # #","#  E#","#####"],["#######","#S#  #","# # ##","#   E#","#######"]];
  const mp=maps[lv%maps.length];let p={x:1,y:1};
  return{id:c.id,mp,p,score:100,over:false,
  mv(dx,dy){const S=this;if(S.over)return;
    const nx=S.p.x+dx,ny=S.p.y+dy;
    if(S.mp[ny]&&S.mp[ny][nx]&&S.mp[ny][nx]!=='#'){S.p={x:nx,y:ny};S.score=Math.max(10,S.score-1);
      if(S.mp[ny][nx]==='E'){S.score+=50;die(S);}}},
  draw(){BG();const S=this,cs=44,ox=(W-S.mp[0].length*cs)/2,oy=140;
    for(let y=0;y<S.mp.length;y++)for(let x=0;x<S.mp[y].length;x++){
      const ch=S.mp[y][x];
      ctx.fillStyle=ch==='#'?'#234':'#0a0c22';
      ctx.fillRect(ox+x*cs,oy+y*cs,cs-2,cs-2);}
    T('🏁',ox+(S.mp[0].length-1)*cs+cs/2,oy+3*cs,30);
    ctx.font='30px serif';ctx.textAlign='center';ctx.fillText('🐭',ox+S.p.x*cs+cs/2,oy+S.p.y*cs+34);ctx.textAlign='left';
    T('Đưa chuột tới 🏁',W/2,100,18,'#8af');HUD(S.score);if(S.over)endCommon(S);},
  update(){},
  onTap(){if(this.over)openMini(c.id);},
  onKey(k){if(this.over){openMini(c.id);return;}
    if(k==='ArrowUp')this.mv(0,-1);if(k==='ArrowDown')this.mv(0,1);
    if(k==='ArrowLeft')this.mv(-1,0);if(k==='ArrowRight')this.mv(1,0);}};}};
// --- RACER mini ---
E.racer1={create(c){const LX=[90,210,330];
  return{id:c.id,lane:1,x:LX[1],cars:[],t:0,cd:55,score:0,over:false,
  update(){const S=this;if(S.over)return;S.t++;S.score=S.t/10|0;
    S.x+=(LX[S.lane]-S.x)*.25;
    if(--S.cd<=0){S.cd=Math.max(30,62-S.t*.03);let l=Math.random()*3|0;if(l===S.lane)l=(l+1)%3;S.cars.push({x:LX[l],y:-70});}
    for(let i=S.cars.length-1;i>=0;i--){const o=S.cars[i];o.y+=5+S.t*.004;
      if(o.y>H+60){S.cars.splice(i,1);continue;}
      if(Math.abs(o.x-S.x)<50&&Math.abs(o.y-(H-140))<70)die(S);}},
  draw(){ctx.fillStyle='#111';ctx.fillRect(0,0,W,H);ctx.fillStyle='#1c1c28';ctx.fillRect(40,0,W-80,H);
    ctx.strokeStyle='#ff0';ctx.setLineDash([20,20]);ctx.beginPath();
    ctx.moveTo(150,0);ctx.lineTo(150,H);ctx.moveTo(270,0);ctx.lineTo(270,H);ctx.stroke();ctx.setLineDash([]);
    for(const o of this.cars){ctx.fillStyle=c.c2;ctx.fillRect(o.x-24,o.y-35,48,70);}
    ctx.fillStyle=c.c1;ctx.fillRect(this.x-24,H-175,48,70);
    HUD(this.score|0);if(this.over)endCommon(this);},
  onTap(){if(this.over)openMini(c.id);},
  onKey(k){if(this.over){openMini(c.id);return;}
    if(k==='ArrowLeft')this.lane=Math.max(0,this.lane-1);
    if(k==='ArrowRight')this.lane=Math.min(2,this.lane+1);}};}};
// --- SLOTS ---
E.slots={create(c){return{id:c.id,r:['❓','❓','❓'],score:0,spin:0,over:false,rounds:0,
  update(){if(this.spin>0){this.r=this.r.map(()=>c.pool[Math.random()*c.pool.length|0]);if(--this.spin===0){
    this.rounds++;
    if(this.r[0]===this.r[1]&&this.r[1]===this.r[2])this.score+=100;
    else if(this.r[0]===this.r[1]||this.r[1]===this.r[2]||this.r[0]===this.r[2])this.score+=20;
    if(this.rounds>=5)die(this);}}},
  draw(){BG('#140410','#2a0a20');HUD(this.score,'Lượt '+this.rounds+'/5');
    for(let i=0;i<3;i++){ctx.fillStyle='#fff';R(45+i*115,200,100,100,14);ctx.fill();
      ctx.font='56px serif';ctx.textAlign='center';ctx.fillText(this.r[i],95+i*115,270);ctx.textAlign='left';}
    T(this.spin>0?'...':'CHẠM / SPACE ĐỂ QUAY',W/2,380,18,'#8af');
    if(this.over)endCommon(this);},
  go(){if(this.over)openMini(c.id);else if(this.spin===0)this.spin=15;},
  onTap(){this.go();},onKey(k){if(k==='Space')this.go();}};}};
// --- RPS ---
E.rps={create(c){const EM=['✊','✋','✌'];
  return{id:c.id,score:0,round:0,msg:'Chọn 1!',pc:'?',me:'?',over:false,
  pick(i){const S=this;if(S.over){openMini(c.id);return;}
    const p=Math.random()*3|0;S.me=EM[i];S.pc=EM[p];S.round++;
    const w=(i-p+3)%3;
    if(w===1){S.score+=20;S.msg='Thắng!';}else if(w===2){S.msg='Thua!';}else S.msg='Hòa!';
    if(S.round>=5)die(S);},
  update(){},draw(){BG();const EM2=['✊','✋','✌'];
    for(let i=0;i<3;i++){ctx.fillStyle='#182040';ctx.strokeStyle='#0ff';R(40+i*120,320,100,100,12);ctx.fill();ctx.stroke();
      ctx.font='52px serif';ctx.textAlign='center';ctx.fillText(EM2[i],90+i*120,390);ctx.textAlign='left';}
    T('BẠN '+this.me+'  —  '+this.pc+' MÁY',W/2,150,24,'#fff');
    T(this.msg,W/2,200,22,'#ff0');HUD(this.score,'Ván '+this.round+'/5');
    if(this.over)endCommon(this);},
  onTap(x,y){for(let i=0;i<3;i++)if(x>40+i*120&&x<140+i*120&&y>320&&y<420)this.pick(i);},
  onKey(){}};}},
// draw RPS buttons in player generic? handled via onTap zones; draw them:
// --- TIC TAC TOE vs AI ---
E.ttt={create(c){return{id:c.id,b:Array(9).fill(''),turn:'X',over:false,score:0,msg:'Bạn là X',
  win(b){const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const l of L)if(b[l[0]]&&b[l[0]]===b[l[1]]&&b[l[1]]===b[l[2]])return b[l[0]];return b.every(x=>x)?'H':null;},
  end(w){const S=this;S.over=true;
    S.score=w==='X'?100:w==='H'?30:0;S.msg=w==='X'?'🎉 Bạn thắng!':w==='H'?'Hòa!':'Máy thắng!';
    S.newBest=hsSet(S.id,S.score);if(window.__miniEnd)window.__miniEnd(S.id,S.score);},
  pick(i){const S=this;if(S.over){openMini(c.id);return;}
    if(S.b[i]||S.turn!=='X')return;S.b[i]='X';
    let w=S.win(S.b);if(w)return S.end(w);
    const e=S.b.map((x,j)=>x?'':j).filter(x=>x!=='');
    S.b[e[Math.random()*e.length|0]]='O';
    w=S.win(S.b);if(w)return S.end(w);},
  update(){},
  draw(){BG();T(this.msg,W/2,90,22,'#ff0');
    for(let i=0;i<9;i++){const x=75+(i%3)*95,y=130+(i/3|0)*95;
      ctx.fillStyle='#1a1c33';R(x,y,85,85,10);ctx.fill();
      T(this.b[i],x+42,y+62,44,this.b[i]==='X'?'#0ff':'#f0f');}
    HUD(this.score);if(this.over){ctx.fillStyle='rgba(2,2,14,.7)';ctx.fillRect(0,0,W,H);
      T(this.msg,W/2,H/2-20,30,'#fff');T('Kỷ lục: '+hsGet(this.id),W/2,H/2+20,18,'#7df');
      T('Chạm để chơi lại',W/2,H/2+60,14,'#8af');}},
  onTap(x,y){if(this.over){openMini(c.id);return;}
    for(let i=0;i<9;i++){const xx=75+(i%3)*95,yy=130+(i/3|0)*95;
      if(x>xx&&x<xx+85&&y>yy&&y<yy+85)this.pick(i);}},
  onKey(){}};}};
// --- CUPS (theo dõi bóng) ---
E.cups={create(c){return{id:c.id,pos:1,shown:0,score:0,round:0,phase:'show',over:false,pick:-1,
  update(){const S=this;if(S.over)return;
    if(S.phase==='show'&&++S.shown>70){S.phase='swap';S.shown=0;S.swaps=8+Math.min(10,S.round);}
    else if(S.phase==='swap'){S.shown++;
      if(S.shown%12===0){const a=Math.random()*3|0;let b=Math.random()*3|0;if(a===b)b=(b+1)%3;
        if(S.pos===a)S.pos=b;else if(S.pos===b)S.pos=a;
        if(--S.swaps<=0)S.phase='pick';}}},
  draw(){BG();HUD(this.score,'Ván '+this.round);
    T(this.phase==='pick'?'Bóng ở cốc nào?':'👁 Nhìn kỹ bóng...',W/2,120,20,'#8af');
    for(let i=0;i<3;i++){const x=60+i*115;
      if(this.phase==='show'&&i===this.pos){ctx.font='40px serif';ctx.textAlign='center';ctx.fillText('⚽',x+45,300);ctx.textAlign='left';}
      ctx.font='64px serif';ctx.textAlign='center';ctx.fillText('🥛',x+45,330);ctx.textAlign='left';
      if(this.phase==='done'&&i===this.pos){ctx.font='40px serif';ctx.textAlign='center';ctx.fillText('⚽',x+45,300);ctx.textAlign='left';}
      if(this.pick===i){ctx.strokeStyle=this.pick===this.pos?'#0f6':'#f33';ctx.lineWidth=3;R(x,250,95,95,12);ctx.stroke();ctx.lineWidth=1;}}
    if(this.over)endCommon(this);},
  onTap(x){const S=this;if(S.over){openMini(c.id);return;}
    if(S.phase!=='pick')return;
    const i=Math.min(2,Math.max(0,((x-60)/115)|0));S.pick=i;S.phase='done';S.round++;
    if(i===S.pos){S.score+=30;}
    setTimeout(()=>{if(S.over||S.phase!=='done')return;S.pos=Math.random()*3|0;S.phase='show';S.shown=0;S.pick=-1;},900);
    if(S.round>=5)setTimeout(()=>{if(!S.over)die(S);},950);},
  onKey(){}};}};
// --- FLASH (nhớ số) ---
E.flash={create(c){const n=c.digits||3;
  return{id:c.id,num:(''+(Math.random()*Math.pow(10,n)|0)).padStart(n,'0'),show:150,cur:'',score:0,round:0,over:false,
  update(){const S=this;if(S.over)return;if(S.show>0)S.show--;},
  draw(){BG();HUD(this.score,'Ván '+this.round+'/5');
    if(this.show>0){T(this.num,W/2,H/2-40,64,'#ff0');T('NHỚ SỐ NÀY!',W/2,H/2+20,20,'#8af');}
    else{T(this.cur||'_'.repeat(this.num.length),W/2,H/2-40,56,'#0ff');
      T('Gõ lại số vừa thấy',W/2,H/2+20,18,'#8af');
      for(let i=0;i<10;i++){const x=25+(i%5)*76,y=H-160+(i/5|0)*70;
        ctx.fillStyle='#182040';ctx.strokeStyle='#0ff';R(x,y,68,60,8);ctx.fill();ctx.stroke();T(i,x+34,y+40,22,'#fff');}}
    if(this.over)endCommon(this);},
  press(d){const S=this;if(S.over){openMini(c.id);return;}if(S.show>0)return;
    S.cur+=d;
    if(S.cur.length>=S.num.length){S.round++;
      if(S.cur===S.num)S.score+=50;
      const n2=S.num.length;S.num=(''+(Math.random()*Math.pow(10,n2)|0)).padStart(n2,'0');
      S.cur='';S.show=150;
      if(S.round>=5)die(S);}},
  onTap(x,y){for(let i=0;i<10;i++){const xx=25+(i%5)*76,yy=H-160+(i/5|0)*70;
    if(x>xx&&x<xx+68&&y>yy&&y<yy+60)this.press(i);}},
  onKey(k){if(k.startsWith('Digit'))this.press(+k.slice(5));}};}};
// --- STROOP ---
E.stroop={create(c){const C=[['XANH','#0f6'],['ĐỎ','#f33'],['VÀNG','#ff0'],['XANH DƯƠNG','#08f']];
  return{id:c.id,score:0,t:30*60,word:0,col:0,over:false,
  next(){this.word=Math.random()*4|0;this.col=Math.random()*4|0;},
  pick(i){const S=this;if(S.over){openMini(c.id);return;}
    if(i===S.col)S.score+=10;else S.score=Math.max(0,S.score-5);
    S.next();},
  update(){if(!this.over&&--this.t<=0)die(this);},
  draw(){BG();HUD(this.score,'⏱ '+fmtT(this.t));
    T('MÀU MỰC LÀ GÌ?',W/2,150,22,'#fff');
    const S=this;ctx.fillStyle=C[S.col][1];ctx.font='bold 52px monospace';ctx.textAlign='center';
    ctx.fillText(C[S.word][0],W/2,240);ctx.textAlign='left';
    for(let i=0;i<4;i++){ctx.fillStyle=C[i][1];R(30,300+i*60,360,48,10);ctx.fill();
      T(C[i][0],W/2,332+i*60,22,'#001');}
    if(S.over)endCommon(S);},
  onTap(x,y){for(let i=0;i<4;i++)if(y>300+i*60&&y<348+i*60&&x>30&&x<390)this.pick(i);},
  onKey(){}};}};
// --- QUIZ ---
E.quiz={create(c){const qs=[...c.q].sort(()=>Math.random()-.5).slice(0,c.n||8);
  return{id:c.id,qs,i:0,score:0,over:false,
  pick(k){const S=this;if(S.over){openMini(c.id);return;}
    if(k===S.qs[S.i].a)S.score+=c.step||10;S.i++;
    if(S.i>=S.qs.length)die(S);},
  update(){},
  draw(){BG();const S=this;if(S.i>=S.qs.length){if(S.over)endCommon(S);return;}
    const q=S.qs[S.i];HUD(S.score,'Câu '+(S.i+1)+'/'+S.qs.length);
    T(q.q,W/2,130,19,'#fff');
    q.o.forEach((o,k)=>{ctx.fillStyle='#182040';ctx.strokeStyle='#0ff';R(30,180+k*70,360,56,10);ctx.fill();ctx.stroke();
      T(o,W/2,216+k*70,17,'#fff');});
    if(S.over)endCommon(S);},
  onTap(x,y){const S=this;for(let k=0;k<4;k++)if(y>180+k*70&&y<236+k*70&&x>30&&x<390)this.pick(k);},
  onKey(k){const m={Digit1:0,Digit2:1,Digit3:2,Digit4:3};if(k in m)this.pick(m[k]);}};}};
// --- MATH drill ---
E.math={create(c){
  function mk(){let a,b,op;const t=c.ops[Math.random()*c.ops.length|0];
    if(t==='+'){a=2+Math.random()*c.max|0;b=2+Math.random()*c.max|0;}
    if(t==='−'){a=2+Math.random()*c.max|0;b=2+Math.random()*a|0;}
    if(t==='×'){a=2+Math.random()*9|0;b=2+Math.random()*9|0;}
    if(t==='÷'){b=2+Math.random()*9|0;const r=2+Math.random()*9|0;a=b*r;}
    const ans=t==='+'?a+b:t==='−'?a-b:t==='×'?a*b:a/b;
    const set=new Set([ans]);while(set.size<4)set.add(ans+(Math.random()*11-5|0));
    return{q:a+' '+t+' '+b+' = ?',o:[...set].sort(()=>Math.random()-.5),a:[...set].indexOf(ans)};}
  return{id:c.id,mk,cur:mk(),n:0,score:0,over:false,
  pick(k){const S=this;if(S.over){openMini(c.id);return;}
    if(k===S.cur.a)S.score+=10;S.n++;
    if(S.n>=(c.n||10))die(S);else S.cur=S.mk();},
  update(){},
  draw(){BG('#0a1a0a','#0a2a12');HUD(this.score,'Câu '+Math.min(this.n+1,c.n||10)+'/'+(c.n||10));
    T(this.cur.q,W/2,150,40,'#ff0');
    this.cur.o.forEach((o,k)=>{ctx.fillStyle='#182040';ctx.strokeStyle='#0f6';R(30,210+k*70,360,56,10);ctx.fill();ctx.stroke();
      T(o,W/2,246+k*70,24,'#fff');});
    if(this.over)endCommon(this);},
  onTap(x,y){for(let k=0;k<4;k++)if(y>210+k*70&&y<266+k*70&&x>30&&x<390)this.pick(k);},
  onKey(k){const m={Digit1:0,Digit2:1,Digit3:2,Digit4:3};if(k in m)this.pick(m[k]);}};}};
// --- GUESS ---
E.guess={create(c){const num=1+Math.random()*c.max|0;
  return{id:c.id,num,lo:1,hi:c.max,msg:'Đoán '+1+'-'+c.max,cur:'',tries:0,over:false,
  go(n){const S=this;if(S.over)return;S.tries++;
    if(n===S.num){die(S);}
    else if(n<S.num){S.lo=Math.max(S.lo,n+1);S.msg=n+' nhỏ quá!';}
    else{S.hi=Math.min(S.hi,n-1);S.msg=n+' lớn quá!';}
    S.score=Math.max(10,(c.base||200)-S.tries*15);},
  get score(){return this._sc||0;},set score(v){this._sc=v;},
  update(){},
  draw(){BG();HUD(this._sc||0,'Lượt: '+this.tries);
    T(this.num&&this.over?'🎉 '+this.num:'?',W/2,180,60,'#f0f');
    T(this.msg,W/2,250,18,'#fff');T(this.cur||'_',W/2,320,44,'#0ff');
    T('Gõ số + ENTER',W/2,370,15,'#8af');
    for(let i=1;i<=9;i++){const x=40+((i-1)%3)*115,y=400+((i-1)/3|0)*55;
      ctx.fillStyle='#182040';ctx.strokeStyle='#0ff';R(x,y,105,48,8);ctx.fill();ctx.stroke();T(i,x+52,y+33,20,'#fff');}
    ctx.fillStyle='#182040';ctx.strokeStyle='#0ff';R(155,565-55+55,105,0,0);
    if(this.over)endCommon(this);},
  press(d){if(this.over){openMini(c.id);return;}this.cur+=d;if(this.cur.length>3)this.cur=this.cur.slice(-3);},
  onTap(x,y){for(let i=1;i<=9;i++){const xx=40+((i-1)%3)*115,yy=400+((i-1)/3|0)*55;
    if(x>xx&&x<xx+105&&y>yy&&y<yy+48)this.press(i);}},
  onKey(k){if(this.over){openMini(c.id);return;}
    if(k.startsWith('Digit'))this.press(+k.slice(5));
    if(k==='Backspace')this.cur=this.cur.slice(0,-1);
    if(k==='Enter'&&this.cur!==''){this.go(+this.cur);this.cur='';}}};}};
// --- SCRAMBLE (xếp chữ bằng cách chạm) ---
E.scramble={create(c){const w=c.words[Math.random()*c.words.length|0];
  const pool=w.split('').sort(()=>Math.random()-.5);
  return{id:c.id,w,pool,cur:'',used:Array(pool.length).fill(false),score:0,round:0,over:false,hint:w.length+' chữ — '+c.hint,
  tap(i){const S=this;if(S.over){openMini(c.id);return;}
    if(S.used[i])return;S.used[i]=true;S.cur+=S.pool[i];
    if(S.cur.length>=S.w.length){S.round++;
      if(S.cur===S.w)S.score+=30;
      const w2=c.words[Math.random()*c.words.length|0];
      S.w=w2;S.pool=w2.split('').sort(()=>Math.random()-.5);S.used=Array(S.pool.length).fill(false);S.cur='';
      if(S.round>=5)die(S);}},
  reset(){this.used=Array(this.pool.length).fill(false);this.cur='';},
  update(){},
  draw(){BG('#141002','#2a1c05');HUD(this.score,'Từ '+this.round+'/5  •  '+this.hint);
    T(this.cur||'?',W/2,150,40,'#ff0');
    this.pool.forEach((ch,i)=>{const x=25+(i%6)*66,y=230+(i/6|0)*70;
      ctx.fillStyle=this.used[i]?'#333':'#ffa';R(x,y,58,60,10);ctx.fill();
      if(!this.used[i])T(ch,x+29,y+42,26,'#520');});
    ctx.fillStyle='#182040';ctx.strokeStyle='#f33';R(130,470,160,50,10);ctx.fill();ctx.stroke();
    T('↩ XÓA',W/2,503,20,'#fff');
    if(this.over)endCommon(this);},
  onTap(x,y){if(x>130&&x<290&&y>470&&y<520){this.reset();return;}
    this.pool.forEach((ch,i)=>{const xx=25+(i%6)*66,yy=230+(i/6|0)*70;
      if(x>xx&&x<xx+58&&y>yy&&y<yy+60)this.tap(i);});},
  onKey(){}};}};
// --- HANGMAN ---
E.hang={create(c){const w=c.words[Math.random()*c.words.length|0];
  return{id:c.id,w,ok:new Set(),bad:0,over:false,score:0,
  disp(){return this.w.split('').map(ch=>this.ok.has(ch)?ch:'_').join(' ');},
  gl(ch){const S=this;if(S.over){openMini(c.id);return;}
    if(S.ok.has(ch)||S.badCh&&S.badCh.has(ch))return;
    if(S.w.includes(ch))S.ok.add(ch);else{(S.badCh=S.badCh||new Set()).add(ch);S.bad++;}
    if(!S.disp().includes('_')){S.score=100-S.bad*10;die(S);}
    if(S.bad>=6)die(S);},
  update(){},
  draw(){BG();HUD(this.score,'Sai: '+this.bad+'/6  •  '+c.hint);
    T(this.disp(),W/2,150,34,'#ff0');
    T('😵'.slice(0,0)+'🤠'.repeat(0)+['🙂','😐','😟','😨','😱','💀'][this.bad],W/2,210,52,'#fff');
    const AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for(let i=0;i<26;i++){const x=18+(i%7)*56,y=260+(i/7|0)*58;
      const used=this.ok.has(AZ[i])||(this.badCh&&this.badCh.has(AZ[i]));
      ctx.fillStyle=used?'#333':'#182040';ctx.strokeStyle='#0ff';R(x,y,50,52,8);ctx.fill();ctx.stroke();
      T(AZ[i],x+25,y+35,20,used?'#555':'#fff');}
    if(this.over)endCommon(this);},
  onTap(x,y){const AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for(let i=0;i<26;i++){const xx=18+(i%7)*56,yy=260+(i/7|0)*58;
      if(x>xx&&x<xx+50&&y>yy&&y<yy+52)this.gl(AZ[i]);}},
  onKey(k){if(k.startsWith('Key'))this.gl(k.slice(3));}};}};
// --- SEQ (dãy số) ---
E.seq={create(c){
  function mk(){const t=Math.random();
    let s,st;
    if(t<.3){st=2+Math.random()*8|0;const d=1+Math.random()*9|0;s=[st,st+d,st+2*d,st+3*d,st+4*d];}
    else if(t<.6){st=2+Math.random()*5|0;s=[st,st*2,st*4,st*8,st*16];}
    else{st=1+Math.random()*20|0;s=[st,st+1,st+3,st+6,st+10];}
    const ans=s[4];const set=new Set([ans]);while(set.size<4)set.add(ans+(Math.random()*11-5|0));
    const o=[...set].sort(()=>Math.random()-.5);
    return{q:s.slice(0,4).join(', ')+', ?',o,a:o.indexOf(ans)};}
  return{id:c.id,mk,cur:mk(),n:0,score:0,over:false,
  pick(k){const S=this;if(S.over){openMini(c.id);return;}
    if(k===S.cur.a)S.score+=15;S.n++;
    if(S.n>=8)die(S);else S.cur=S.mk();},
  update(){},
  draw(){BG('#0a0a1a','#1a0a2a');HUD(this.score,'Câu '+(this.n+1)+'/8');
    T('Số tiếp theo?',W/2,130,20,'#8af');T(this.cur.q,W/2,190,30,'#ff0');
    this.cur.o.forEach((o,k)=>{ctx.fillStyle='#182040';ctx.strokeStyle='#f0f';R(30,240+k*70,360,56,10);ctx.fill();ctx.stroke();
      T(o,W/2,276+k*70,24,'#fff');});
    if(this.over)endCommon(this);},
  onTap(x,y){for(let k=0;k<4;k++)if(y>240+k*70&&y<296+k*70&&x>30&&x<390)this.pick(k);},
  onKey(k){const m={Digit1:0,Digit2:1,Digit3:2,Digit4:3};if(k in m)this.pick(m[k]);}};}};
// --- SUDOKU 4x4 ---
E.sudoku={create(c){
  const sols=[[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]],[[4,3,2,1],[2,1,4,3],[1,4,3,2],[3,2,1,4]]];
  const sol=sols[c.v%2];const g=sol.map(r=>r.slice());
  let holes=6;while(holes>0){const x=Math.random()*4|0,y=Math.random()*4|0;if(g[y][x]!==0){g[y][x]=0;holes--;}}
  return{id:c.id,g,sol,sel:null,lives:3,over:false,score:0,
  num(n){const S=this;if(!S.sel||S.over)return;const[y,x]=S.sel;
    if(S.g[y][x]!==0)return;
    if(S.sol[y][x]===n){S.g[y][x]=n;S.score+=20;
      if(S.g.every((r,yy)=>r.every((v,xx)=>v===S.sol[yy][xx]))){S.score+=100;die(S);}}
    else liveLost(S);},
  update(){},
  draw(){BG();HUD(this.score,'♥'.repeat(Math.max(0,this.lives)));
    T('SUDOKU 4×4',W/2,90,22,'#0ff');
    for(let y=0;y<4;y++)for(let x=0;x<4;x++){const X=60+x*78,Y=130+y*78;
      ctx.fillStyle=this.sel&&this.sel[0]===y&&this.sel[1]===x?'#2a4a6a':'#1a1c33';
      R(X,Y,72,72,8);ctx.fill();ctx.strokeStyle='#0ff';ctx.stroke();
      if(this.g[y][x])T(this.g[y][x],X+36,Y+50,32,this.g[y][x]?'#fff':'#0f6');}
    for(let n=1;n<=4;n++){ctx.fillStyle='#182040';ctx.strokeStyle='#0f6';R(45+(n-1)*85,470,75,55,10);ctx.fill();ctx.stroke();
      T(n,82+(n-1)*85,507,26,'#fff');}
    if(this.over)endCommon(this);},
  onTap(x,y){const S=this;if(S.over){openMini(c.id);return;}
    for(let yy=0;yy<4;yy++)for(let xx=0;xx<4;xx++){const X=60+xx*78,Y=130+yy*78;
      if(x>X&&x<X+72&&y>Y&&y<Y+72&&S.g[yy][xx]===0){S.sel=[yy,xx];return;}}
    for(let n=1;n<=4;n++)if(x>45+(n-1)*85&&x<120+(n-1)*85&&y>470&&y<525)S.num(n);},
  onKey(){}};}};
// --- MINES ---
E.mines={create(c){const N=6,M=c.mines||5;
  const b=Array.from({length:N},()=>Array(N).fill(0));
  let pl=0;while(pl<M){const x=Math.random()*N|0,y=Math.random()*N|0;if(!b[y][x]){b[y][x]=9;pl++;}}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!b[y][x]){
    let n2=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
      if(b[y+dy]&&b[y+dy][x+dx]===9)n2++;b[y][x]=n2;}
  return{id:c.id,b,rev:Array.from({length:N},()=>Array(N).fill(false)),flag:false,over:false,score:0,
  open(x,y){const S=this;if(S.over||S.rev[y][x])return;
    S.rev[y][x]=true;
    if(S.b[y][x]===9){die(S);return;}
    S.score+=5;
    if(S.b[y][x]===0)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy;
      if(b[ny]&&b[ny][nx]!==undefined&&!S.rev[ny][nx]&&S.b[ny][nx]!==9)S.open(nx,ny);}
    if(S.rev.flat().filter(Boolean).length>=N*N-M){S.score+=100;die(S);}},
  update(){},
  draw(){BG();HUD(this.score,'💣 '+M+'  •  '+(this.flag?'🚩 ĐẶT CỜ':'👆 MỞ Ô'));
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const X=45+x*55,Y=120+y*55;
      ctx.fillStyle=this.rev[y][x]?'#0a2a12':'#1a1c33';R(X,Y,50,50,8);ctx.fill();ctx.strokeStyle='#0ff';ctx.stroke();
      if(this.rev[y][x]){T(this.b[y][x]===9?'💣':this.b[y][x]||'',X+25,Y+36,22,this.b[y][x]===9?'#f33':'#0f6');}}
    ctx.fillStyle='#182040';ctx.strokeStyle='#ff0';R(130,470,160,50,10);ctx.fill();ctx.stroke();
    T(this.flag?'🚩 CỜ':'👆 MỞ',W/2,503,20,'#fff');
    if(this.over){ctx.fillStyle='rgba(2,2,14,.7)';ctx.fillRect(0,0,W,H);
      T(this.rev.flat().filter(Boolean).length>=N*N-M?'🎉 THẮNG!':'💥 BÙM!',W/2,H/2-20,34,'#ff0');
      const nb=hsSet(this.id,this.score);T(nb?'★ KỶ LỤC MỚI! ★':'Kỷ lục: '+hsGet(this.id),W/2,H/2+20,18,nb?'#ff0':'#7df');
      T('Chạm để chơi lại',W/2,H/2+60,14,'#8af');}},
  onTap(x,y){const S=this;if(S.over){openMini(c.id);return;}
    if(x>130&&x<290&&y>470&&y<520){S.flag=!S.flag;return;}
    for(let yy=0;yy<N;yy++)for(let xx=0;xx<N;xx++){const X=45+xx*55,Y=120+yy*55;
      if(x>X&&x<X+50&&y>Y&&y<Y+50&&!S.rev[yy][xx]){if(!S.flag)S.open(xx,yy);}}},
  onKey(){}};}};
// --- SLIDE 8-puzzle ---
E.slide={create(c){let v=[1,2,3,4,5,6,7,8,0];
  do{v.sort(()=>Math.random()-.5);}while(!solv(v));
  function solv(a){let inv=0;for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)if(a[i]&&a[j]&&a[i]>a[j])inv++;return inv%2===0;}
  return{id:c.id,v,moves:0,over:false,score:500,
  mv(i){const S=this;if(S.over)return;const z=S.v.indexOf(0);
    const zx=z%3,zy=z/3|0,ix=i%3,iy=i/3|0;
    if(Math.abs(zx-ix)+Math.abs(zy-iy)===1){S.v[z]=S.v[i];S.v[i]=0;S.moves++;S.score=Math.max(10,500-S.moves*10);
      if(S.v.every((x,k)=>x===(k+1)%9))die(S);}},
  update(){},
  draw(){BG();HUD(this.score,'Bước: '+this.moves);
    T('Xếp 1→8',W/2,90,22,'#0ff');
    for(let i=0;i<9;i++){const x=75+(i%3)*95,y=130+(i/3|0)*95;
      if(this.v[i]===0)continue;
      ctx.fillStyle='#182040';ctx.strokeStyle='#0ff';R(x,y,85,85,10);ctx.fill();ctx.stroke();
      T(this.v[i],x+42,y+62,44,'#fff');}
    if(this.over)endCommon(this);},
  onTap(x,y){if(this.over){openMini(c.id);return;}
    for(let i=0;i<9;i++){const xx=75+(i%3)*95,yy=130+(i/3|0)*95;
      if(x>xx&&x<xx+85&&y>yy&&y<yy+85)this.mv(i);}},
  onKey(){}};}};
// --- ODD one out ---
E.odd={create(c){
  function mk(){let a=Math.random()*c.pool.length|0,b;do{b=Math.random()*c.pool.length|0;}while(b===a);
    return{a,b,pos:Math.random()*9|0};}
  return{id:c.id,cur:mk(),score:0,t:30*60,over:false,
  pick(i){const S=this;if(S.over){openMini(c.id);return;}
    if(i===S.cur.pos){S.score+=15;S.cur=mk();}else S.score=Math.max(0,S.score-5);},
  update(){if(!this.over&&--this.t<=0)die(this);},
  draw(){BG();HUD(this.score,'⏱ '+fmtT(this.t));
    T('Tìm hình KHÁC!',W/2,100,22,'#8af');
    for(let i=0;i<9;i++){const x=60+(i%3)*105,y=150+(i/3|0)*105;
      ctx.fillStyle='#1a1c33';R(x,y,90,90,12);ctx.fill();
      ctx.font='52px serif';ctx.textAlign='center';
      ctx.fillText(i===this.cur.pos?c.pool[this.cur.b]:c.pool[this.cur.a],x+45,y+65);ctx.textAlign='left';}
    if(this.over)endCommon(this);},
  onTap(x,y){for(let i=0;i<9;i++){const xx=60+(i%3)*105,yy=150+(i/3|0)*105;
    if(x>xx&&x<xx+90&&y>yy&&y<yy+90)this.pick(i);}},
  onKey(){}};}};
// ================= 100 GAME DEFS =================
const QB_TOAN=[{q:'12 + 15 = ?',o:['27','26','28','25'],a:0},{q:'7 × 8 = ?',o:['54','56','48','64'],a:1},{q:'100 − 45 = ?',o:['55','54','65','45'],a:0},{q:'9² = ?',o:['81','72','90','18'],a:0},{q:'1/2 + 1/4 = ?',o:['3/4','1/4','2/4','1/2'],a:0},{q:'15% của 200?',o:['30','25','35','20'],a:0},{q:'Chu vi vuông cạnh 5?',o:['20','25','10','15'],a:0},{q:'2³ + 1 = ?',o:['9','8','7','10'],a:0}];
const QB_GEO=[{q:'Thủ đô Việt Nam?',o:['Hà Nội','TP.HCM','Huế','Đà Nẵng'],a:0},{q:'Sông dài nhất VN?',o:['Mê Kông','Hồng','Đồng Nai','Cả'],a:0},{q:'Biển Đông phía nào VN?',o:['Đông','Tây','Nam','Bắc'],a:0},{q:'Tỉnh rộng nhất VN?',o:['Nghệ An','Gia Lai','Sơn La','Đắk Lắk'],a:0},{q:'Đảo lớn nhất VN?',o:['Phú Quốc','Cát Bà','Côn Đảo','Lý Sơn'],a:0},{q:'Đỉnh cao nhất VN?',o:['Fansipan','Bạch Mộc','Pusilung','Ngọc Linh'],a:0},{q:'VN có bao nhiêu tỉnh/thành (2024)?',o:['63','64','58','61'],a:0},{q:'Vịnh đẹp nổi tiếng miền Bắc?',o:['Hạ Long','Lan Hạ','Bái Tử Long','Cả 3'],a:3}];
const QB_KH=[{q:'Nước sôi ở mấy độ C?',o:['100','90','80','120'],a:0},{q:'Hành tinh gần Mặt Trời nhất?',o:['Thủy tinh','Kim tinh','Trái Đất','Hỏa tinh'],a:0},{q:'Khí ta hít thở chủ yếu?',o:['Nitơ','Oxy','CO2','Heli'],a:0},{q:'1 ngày có mấy giờ?',o:['24','12','36','48'],a:0},{q:'Cầu vồng có mấy màu chính?',o:['7','6','5','8'],a:0},{q:'Xương nhiều nhất ở đâu?',o:['Tay','Chân','Tai','Sống'],a:0},{q:'Tốc độ ánh sáng?',o:['300.000 km/s','150.000 km/s','30.000 km/s','3.000 km/s'],a:0},{q:'Khủng long tuyệt chủng khi nào?',o:['66tr năm','100tr năm','200tr năm','10tr năm'],a:0}];
const QB_ANH=[{q:'"Cat" nghĩa là?',o:['Con mèo','Con chó','Con chim','Con cá'],a:0},{q:'"Red" là màu?',o:['Đỏ','Xanh','Vàng','Trắng'],a:0},{q:'Số 5 tiếng Anh?',o:['Five','Four','Six','Seven'],a:0},{q:'"Thank you" nghĩa là?',o:['Cảm ơn','Xin chào','Tạm biệt','Xin lỗi'],a:0},{q:'"Book" nghĩa là?',o:['Sách','Bút','Bàn','Ghế'],a:0},{q:'"Dog" nghĩa là?',o:['Con chó','Con mèo','Con gà','Con vịt'],a:0},{q:'"One + One"?',o:['Two','Three','Four','Five'],a:0},{q:'"Good morning"?',o:['Chào buổi sáng','Chào buổi tối','Chúc ngủ ngon','Tạm biệt'],a:0}];
const QB_MIX=[{q:'2 + 3 × 2 = ?',o:['8','10','12','6'],a:0},{q:'Thủ đô Nhật Bản?',o:['Tokyo','Osaka','Kyoto','Seoul'],a:0},{q:'50 − 8 × 2?',o:['34','84','42','24'],a:0},{q:'Ai vẽ Mona Lisa?',o:['Da Vinci','Picasso','Van Gogh','Rembrandt'],a:0},{q:'7 + 7 ÷ 7?',o:['8','2','7','14'],a:0},{q:'Đại dương lớn nhất?',o:['T.Bình Dương','Ấn Độ','Đại Tây Dương','Bắc Băng'],a:0},{q:'12 × 12?',o:['144','124','132','142'],a:0},{q:'Năm nhuận có mấy ngày?',o:['366','365','364','367'],a:0}];
const QB_TF=[{q:'Mặt Trời mọc đằng Đông',o:['Đúng','Sai'],a:0},{q:'Cá heo là cá',o:['Sai','Đúng'],a:0},{q:'1 + 1 = 3',o:['Sai','Đúng'],a:0},{q:'Nước đóng băng ở 0°C',o:['Đúng','Sai'],a:0},{q:'Chim cánh cụt biết bay',o:['Sai','Đúng'],a:0},{q:'VN ở châu Á',o:['Đúng','Sai'],a:0},{q:'Tháng 2 luôn có 28 ngày',o:['Sai','Đúng'],a:0},{q:'Oxy giúp cháy',o:['Đúng','Sai'],a:0}];
const W_DV=['MEO','CHO','GA','LON','VOI','HO','G AU'.replace(' ','')];
const W_TC=['XOAI','CAM','BUOI','MIT','TAO','NHO','DUA'];
const W_NN=['BACSI','GIAOVIEN','CONGAN','NONGDAN','KYSU','LUATSU'];
const W_DV2=['BAN','GHE','DEN','QUAT','TU','GIUONG','GHE'];
const W_HD=['CHAY','NHAY','BOI','HAT','MUA','VE','DOC'];
const H_DV=['CONMEO','CONCHO','CONGA','CONLON','CONVOI','CONHO','CONGAAU'.replace(' ','')];
const H_TC=['QUAXOAI','QUACAM','QUABUOI','QUAMIT','QUATAO','QUANHO'];
const H_NN=['BACSI','GIAOVIEN','CONGAN','KYSU','NHASI','DAS I'.replace(' ','')];

const QB_LS=[{q:'Vua đầu tiên của VN?',o:['Hùng Vương','An Dương Vương','Lý Nam Đế','Ngô Quyền'],a:0},{q:'Chiến thắng Bạch Đằng 938?',o:['Ngô Quyền','Trần Hưng Đạo','Lê Lợi','Quang Trung'],a:0},{q:'Kinh đô nhà Nguyễn?',o:['Huế','Hà Nội','Thăng Long','Phú Xuân cũ'],a:0},{q:'Khởi nghĩa Lam Sơn do ai?',o:['Lê Lợi','Nguyễn Trãi','Trần Hưng Đạo','Lý Thường Kiệt'],a:0},{q:'Điện Biên Phủ năm nào?',o:['1954','1945','1975','1968'],a:0},{q:'Giải phóng miền Nam?',o:['30/4/1975','2/9/1945','7/5/1954','1/5/1975'],a:0},{q:'Lý Thường Kiệt nổi tiếng với?',o:['Nam quốc sơn hà','Hịch tướng sĩ','Bình Ngô đại cáo','Chiếu dời đô'],a:0},{q:'Chiếu dời đô của ai?',o:['Lý Công Uẩn','Lý Nhân Tông','Trần Thái Tông','Lê Thánh Tông'],a:0}];
const QB_TT=[{q:'World Cup mấy năm 1 lần?',o:['4','2','3','5'],a:0},{q:'Môn thể thao vua?',o:['Bóng đá','Bóng rổ','Tennis','Bơi'],a:0},{q:'Olympic 2024 ở đâu?',o:['Paris','Tokyo','London','Bắc Kinh'],a:0},{q:'Sân Mỹ Đình ở đâu?',o:['Hà Nội','TP.HCM','Đà Nẵng','Hải Phòng'],a:0},{q:'V-League là giải gì?',o:['Bóng đá VN','Bóng chuyền','Cầu lông','Bóng rổ'],a:0},{q:'Cầu lông dùng gì?',o:['Vợt + cầu','Vợt + bóng','Gậy + bóng','Tay không'],a:0},{q:'Bơi mấy kiểu chính?',o:['4','3','5','6'],a:0},{q:'Marathon dài bao nhiêu km?',o:['42','21','10','50'],a:0}];
const QB_NHAC=[{q:'Nhạc cụ có phím?',o:['Piano','Guitar','Trống','Sáo'],a:0},{q:'Nhạc cụ gảy dây?',o:['Guitar','Trống','Kèn','Sáo'],a:0},{q:'Dàn nhạc giao hưởng thiếu gì?',o:['Không thiếu gì','Thiếu trống','Thiếu đàn','Thiếu kèn'],a:0},{q:'Bolero xuất xứ từ?',o:['Cuba','Mỹ','Pháp','Nhật'],a:0},{q:'Quan họ quê ở đâu?',o:['Bắc Ninh','Hà Nội','Huế','Nam Định'],a:0},{q:'Ca trù được UNESCO công nhận?',o:['Có','Không'],a:0},{q:'Nhạc rock dùng nhiều?',o:['Guitar điện','Sáo','Đàn tranh','Đàn bầu'],a:0},{q:'Rap chú trọng gì?',o:['Lời + nhịp','Giai điệu','Hòa âm','Nhạc cụ'],a:0}];
const QB_CN=[{q:'CPU là gì?',o:['Bộ xử lý','Màn hình','Ổ cứng','Chuột'],a:0},{q:'RAM dùng để?',o:['Nhớ tạm','Lưu lâu dài','Hiển thị','Mạng'],a:0},{q:'Ai sáng lập Microsoft?',o:['Bill Gates','Steve Jobs','Elon Musk','Mark'],a:0},{q:'iPhone của hãng nào?',o:['Apple','Samsung','Xiaomi','Oppo'],a:0},{q:'WWW là gì?',o:['Mạng toàn cầu','Máy tính','Phần mềm','Virus'],a:0},{q:'USB dùng để?',o:['Truyền dữ liệu','Nấu ăn','Nghe nhạc','Chụp ảnh'],a:0},{q:'AI là gì?',o:['Trí tuệ nhân tạo','Máy giặt','Tủ lạnh','Xe đạp'],a:0},{q:'Hệ điều hành của PC phổ biến?',o:['Windows','iOS','Android','Linux'],a:0}];
const W_RAU=['RAUMUONG','RAUDEN','CAICHUA'.replace('CHUA','NGOT'),'BAPCAI','SUPLO','MONGTOI','RAUCAN'];
const W_NUOC=['TRADA','CAPHE','NUOCAM','SUADA','TRASUA','NUCDUA','COCA'];
const W_MON=['PHO','COMTAM','BUNBO','BANHMI','CHAGIO','GOICUON','MITOM'];
const W_BIEN=['CAMAP','CAVOI','MUC','TOM','CUA','SO','NGAO'];
const H_TRUONG=['THOCAP1'.replace('CAP1','TIEUHOC'),'TRUNGHOC','DAIHOC','GIAOVIEN','HOCSINH','THUVIEN'];
const H_HOA=['HOAHONG','HOAMAI','HOADAO','HOALAN','HOASEN','HOACUC'];
const CATS={puzzle:'🧩 Puzzle',arcade:'👾 Arcade',brain:'🧠 Trí tuệ',action:'⚡ Hành động',word:'🔤 Chữ & Số'};
function g_(id,cat,eng,icon,name,desc,cfg){return Object.assign({id,cat,eng,icon,name,desc},cfg||{});}
const GAMES=[
/* ---- PUZZLE 20 ---- */
g_('pz-mem1','puzzle','memory','🃏','Lật Thẻ Số','Nhớ vị trí cặp số giống nhau',{pairs:6,e:'🔢'}),
g_('pz-mem2','puzzle','memory','🎴','Lật Thẻ 8 Cặp','Thử thách trí nhớ 8 cặp',{pairs:8,e:'🧠'}),
g_('pz-sim1','puzzle','simon','🔴','Simon Màu','Lặp lại dãy màu phát sáng'),
g_('pz-sim2','puzzle','simon','🟢','Simon Tốc Độ','Dãy màu ngày càng dài'),
g_('pz-sud1','puzzle','sudoku','🔢','Sudoku 4×4','Điền số 1-4 đúng luật',{v:0}),
g_('pz-sud2','puzzle','sudoku','🧮','Sudoku Cao Cấp','Màn sudoku khó hơn',{v:1}),
g_('pz-min1','puzzle','mines','💣','Dò Mìn 6×6','Mở ô an toàn, tránh 5 quả mìn',{mines:5}),
g_('pz-min2','puzzle','mines','🧨','Dò Mìn Khó','8 quả mìn rình rập',{mines:8}),
g_('pz-sli1','puzzle','slide','🧩','Xếp Hình 8','Trượt ô xếp 1→8'),
g_('pz-sli2','puzzle','slide','🔀','Xếp Hình Tốc Độ','Xếp nhanh ít bước nhất'),
g_('pz-odd1','puzzle','odd','👀','Tìm Hình Khác','Phát hiện kẻ lạc loài',{pool:['🐶','🐱','🐭','🐹','🐰']}),
g_('pz-odd2','puzzle','odd','🍎','Tìm Quả Khác','Tinh mắt tìm điểm khác',{pool:['🍎','🍊','🍋','🍇','🍉']}),
g_('pz-odd3','puzzle','odd','⚽','Tìm Bóng Khác','Phản xạ thị giác',{pool:['⚽','🏀','🏈','🎾','🏐']}),
g_('pz-stk1','puzzle','stack','🗼','Xây Tháp','Thả gạch đúng nhịp'),
g_('pz-stk2','puzzle','stack','🏗️','Tháp Chọc Trời','Gạch rơi ngày càng nhanh'),
g_('pz-maz1','puzzle','maze','🐭','Mê Cung Chuột','Dẫn chuột tới phô mai',{lv:0}),
g_('pz-maz2','puzzle','maze','🧀','Mê Cung Khó','Mê cung xoắn não',{lv:1}),
g_('pz-cup1','puzzle','cups','🥛','Úp Cốc','Theo dõi bóng dưới cốc'),
g_('pz-fla1','puzzle','flash','🔢','Nhớ Số 3 Chữ Số','Nhìn 3 giây rồi gõ lại',{digits:3}),
g_('pz-fla2','puzzle','flash','🔟','Nhớ Số 4 Chữ Số','Thử thách bộ nhớ',{digits:4}),
/* ---- ARCADE 20 ---- */
g_('ac-tap1','arcade','tap','⭐','Bấm Sao','Bấm càng nhanh càng nhiều',{e:'⭐',step:1,verb:'BẤM SAO!'}),
g_('ac-tap2','arcade','tap','⚽','Sút Bóng','Tap liên tục sút bóng',{e:'⚽',step:1}),
g_('ac-tap3','arcade','tap','🪙','Đào Coin','Đào coin trong 15 giây',{e:'🪙',step:2}),
g_('ac-tap4','arcade','tap','👾','Diệt Quái','Bấm diệt quái vật',{e:'👾',step:1}),
g_('ac-tap5','arcade','tap','❤️','Thu Thập Tim','Gom tim tốc độ',{e:'❤️',step:1}),
g_('ac-rea1','arcade','react','🚦','Phản Xạ','Đợi xanh rồi bấm ngay',{e:'CHỜ...'}),
g_('ac-rea2','arcade','react','⚡','Phản Xạ Tốc Độ','5 vòng cân não',{e:'SẴN SÀNG?'}),
g_('ac-aim1','arcade','aim','🎯','Bắn Bia','Bắn trúng bia tròn',{e:'🎯',time:30}),
g_('ac-aim2','arcade','aim','🎈','Bắn Bóng Bay','Bắn bóng bay bay',{e:'🎈',time:30}),
g_('ac-aim3','arcade','aim','🦆','Săn Vịt','Bắn vịt trời',{e:'🦆',time:35,ammo:30}),
g_('ac-aim4','arcade','aim','🛸','Bắn UFO','Hạ đĩa bay',{e:'🛸',time:35,ammo:30}),
g_('ac-wh1','arcade','aim','🐹','Đập Chuột','Chuột hiện ô nào đập ô đó',{e:'🐹',mode:'grid',time:30}),
g_('ac-wh2','arcade','aim','🦔','Đập Nhím','Nhanh tay lẹ mắt',{e:'🦔',mode:'grid',time:25,gap:32}),
g_('ac-inv1','arcade','aim','👾','Invaders','Bắn đội quân đổ bộ',{e:'👾',mode:'row',time:40,ammo:40}),
g_('ac-inv2','arcade','aim','🤖','Robot Tấn Công','Chặn robot rơi',{e:'🤖',mode:'row',time:40,ammo:40}),
g_('ac-pon1','arcade','pongw','🏓','Bóng Bàn Tường','Đỡ bóng nảy tường'),
g_('ac-pon2','arcade','pongw','🎾','Tennis Tường','Bóng ngày càng nhanh'),
g_('ac-brk1','arcade','breakm','🧱','Phá Gạch Mini','Hứng bóng phá gạch'),
g_('ac-sna1','arcade','snake','🐍','Rắn Mini','Rắn ăn mồi cổ điển'),
g_('ac-slo1','arcade','slots','🎰','Quay Slot','3 hình giống nhau ăn lớn',{pool:['🍒','🍋','⭐','💎','7️⃣']}),
/* ---- TRÍ TUỆ 20 ---- */
g_('br-q1','brain','quiz','➗','Đố Toán','8 câu toán nhanh',{q:QB_TOAN}),
g_('br-q2','brain','quiz','🗺️','Đố Địa Lý','Hiểu biết đất nước',{q:QB_GEO}),
g_('br-q3','brain','quiz','🔬','Đố Khoa Học','Kiến thức tự nhiên',{q:QB_KH}),
g_('br-q4','brain','quiz','🔤','Tiếng Anh Vui','Từ vựng cơ bản',{q:QB_ANH}),
g_('br-q5','brain','quiz','🎲','Tổng Hợp','Đố vui tổng hợp',{q:QB_MIX}),
g_('br-tf1','brain','quiz','✅','Đúng Hay Sai','Phán đoán nhanh',{q:QB_TF,n:6,step:15}),
g_('br-tf2','brain','quiz','❓','Thật Hay Đùa','Chọn đúng/sai',{q:QB_TF,n:8,step:12}),
g_('br-ttt1','brain','ttt','⭕','Caro 3×3','Xếp 3 X thắng máy'),
g_('br-ttt2','brain','ttt','❌','Caro Tốc Độ','Đấu trí với máy'),
g_('br-rps1','brain','rps','✊','Oẳn Tù Tì','Kéo-búa-bao 5 ván'),
g_('br-rps2','brain','rps','🎮','Oẳn Tù Tì Pro','Đọc vị máy'),
g_('br-st1','brain','stroop','🎨','Màu Đánh Lừa','Đọc MÀU mực, đừng đọc chữ'),
g_('br-st2','brain','stroop','🌈','Thử Thách Màu','Não xử lý màu sắc'),
g_('br-cup1','brain','cups','🥛','Mắt Thần','Trí nhớ thị giác'),
g_('br-cup2','brain','cups','👁️','Theo Dõi Bóng','Tốc độ tráo tăng dần'),
g_('br-fl1','brain','flash','🧠','Nhớ Số Nhanh','Ghi nhớ dãy số',{digits:3}),
g_('br-fl2','brain','flash','💡','Siêu Trí Nhớ','Số dài hơn, khó hơn',{digits:5}),
g_('br-sim1','brain','simon','🔵','Simon Trí Tuệ','Dãy màu siêu dài'),
g_('br-mem1','brain','memory','🃏','Trí Nhớ Thép','6 cặp thẻ',{pairs:6,e:'🧠'}),
g_('br-odd1','brain','stroop','🟡','Tập Trung','Rèn khả năng tập trung'),
/* ---- HÀNH ĐỘNG NHẸ 20 ---- */
g_('hd-do1','action','dodge','☄️','Né Thiên Thạch','Lướt né đá rơi',{e:'☄️',p:'🚀'}),
g_('hd-do2','action','dodge','🌧️','Né Mưa Axit','Tránh giọt axit',{e:'💧',p:'☂️'}),
g_('hd-do3','action','dodge','🔥','Né Lửa','Lửa rơi ngày càng nhanh',{e:'🔥',p:'🧑‍🚒'}),
g_('hd-do4','action','dodge','⚡','Né Sét','Sét đánh liên hồi',{e:'⚡',p:'🏃'}),
g_('hd-ca1','action','catch','🧺','Hứng Táo','Hứng táo, né đá',{e:'🍎',badE:'🪨',p:'🧺'}),
g_('hd-ca2','action','catch','⭐','Hứng Sao','Sao rơi đầy trời',{e:'⭐',badE:'💣',p:'🧺'}),
g_('hd-ca3','action','catch','💎','Hứng Kim Cương','Kim cương quý giá',{e:'💎',badE:'🧨',p:'🧺'}),
g_('hd-ca4','action','catch','🍬','Hứng Kẹo','Kẹo ngọt rơi',{e:'🍬',badE:'☠️',p:'🧺'}),
g_('hd-ju1','action','jump','🦘','Nhảy Vượt Rào','Nhảy qua chướng ngại',{e:'🌵',p:'🦘'}),
g_('hd-ju2','action','jump','🐇','Thỏ Nhảy','Thỏ chạy vượt rào',{e:'🪵',p:'🐇'}),
g_('hd-ju3','action','jump','🏃','Chạy Vượt Chướng Ngại','Tốc độ tăng dần',{e:'🚧',p:'🏃'}),
g_('hd-wh1','action','aim','🔨','Đập Chuột Tốc Độ','Luyện phản xạ tay',{e:'🐭',mode:'grid',time:30}),
g_('hd-wh2','action','aim','🐸','Đập Ếch','Ếch nhảy lung tung',{e:'🐸',mode:'grid',time:30}),
g_('hd-inv1','action','aim','🚀','Phòng Thủ Tên Lửa','Bắn tên lửa rơi',{e:'🚀',mode:'row',time:40,ammo:50}),
g_('hd-inv2','action','aim','🪂','Bắn Dù','Hạ lính dù',{e:'🪂',mode:'row',time:40,ammo:50}),
g_('hd-ra1','action','racer1','🏎️','Đua Xe Mini','Chuyển làn né xe',{c1:'#0ff',c2:'#f0f'}),
g_('hd-ra2','action','racer1','🚗','Tay Đua Phố','Phố đông kẹt xe',{c1:'#ff0',c2:'#0f6'}),
g_('hd-stk1','action','stack','🎯','Thả Gạch Chuẩn','Căn thời gian thả'),
g_('hd-rea1','action','react','💨','Phản Xạ Chớp','Bấm khi đèn xanh',{e:'SẴN SÀNG'}),
g_('hd-slo1','action','slots','🍒','Slot May Mắn','Quay trúng ăn điểm',{pool:['🍒','🍒','🍋','⭐','🔔']}),
/* ---- CHỮ & SỐ 20 ---- */
g_('wd-m1','word','math','➕','Cộng Nhanh','Phép cộng tốc độ',{ops:['+'],max:50}),
g_('wd-m2','word','math','➖','Trừ Nhanh','Phép trừ nhanh',{ops:['−'],max:50}),
g_('wd-m3','word','math','✖️','Bảng Cửu Chương','Nhân chia cơ bản',{ops:['×','÷']}),
g_('wd-m4','word','math','🧮','Tính Nhẩm','Cộng trừ hỗn hợp',{ops:['+','−'],max:99}),
g_('wd-m5','word','math','🏆','Vua Tính Nhẩm','Mọi phép tính',{ops:['+','−','×','÷'],max:99}),
g_('wd-g1','word','guess','🔢','Đoán Số 1-50','Suy luận khoảng số',{max:50,base:150}),
g_('wd-g2','word','guess','🎯','Đoán Số 1-100','Thử thách suy luận',{max:100,base:200}),
g_('wd-g3','word','guess','🏅','Đoán Số 1-200','Cao thủ suy luận',{max:200,base:300}),
g_('wd-s1','word','scramble','🐾','Xếp Chữ Con Vật','Sắp xếp chữ cái',{words:W_DV,hint:'con vật'}),
g_('wd-s2','word','scramble','🍎','Xếp Chữ Trái Cây','Đoán tên trái cây',{words:W_TC,hint:'trái cây'}),
g_('wd-s3','word','scramble','👷','Xếp Chữ Nghề Nghiệp','Đoán nghề nghiệp',{words:W_NN,hint:'nghề nghiệp'}),
g_('wd-s4','word','scramble','🪑','Xếp Chữ Đồ Vật','Đồ dùng quanh ta',{words:W_DV2,hint:'đồ vật'}),
g_('wd-s5','word','scramble','🏃','Xếp Chữ Hành Động','Động từ quen thuộc',{words:W_HD,hint:'hành động'}),
g_('wd-h1','word','hang','🐶','Treo Cổ Con Vật','Đoán chữ cái',{words:H_DV,hint:'con vật'}),
g_('wd-h2','word','hang','🍊','Treo Cổ Trái Cây','6 mạng đoán chữ',{words:H_TC,hint:'trái cây'}),
g_('wd-h3','word','hang','💼','Treo Cổ Nghề Nghiệp','Đoán nghề nào',{words:H_NN,hint:'nghề nghiệp'}),
g_('wd-q1','word','seq','🔢','Dãy Số Tiếp Theo','Tìm quy luật dãy số'),
g_('wd-q2','word','seq','🧩','Quy Luật Số','Cấp số cộng/nhân'),
g_('wd-tf1','word','quiz','📝','Đố Nhanh','Hỏi nhanh đáp gọn',{q:QB_TF,n:8,step:12}),
g_('wd-fl1','word','flash','📱','Nhớ Số Điện Thoại','Nhớ dãy 5 số',{digits:5}),
/* ---- PUZZLE +20 ---- */
g_('pz2-mem1','puzzle','memory','🐣','Lật Thẻ Dễ','Mới chơi bắt đầu đây',{pairs:2,e:'🌟'}),
g_('pz2-mem2','puzzle','memory','🐤','Lật Thẻ 3 Cặp','Rèn trí nhớ cơ bản',{pairs:3,e:'🌟'}),
g_('pz2-mem3','puzzle','memory','🦊','Lật Thẻ 4 Cặp','Khó hơn một chút',{pairs:4,e:'🔢'}),
g_('pz2-mem4','puzzle','memory','🐼','Lật Thẻ 5 Cặp','Thử thách vừa sức',{pairs:5,e:'🔢'}),
g_('pz2-sim1','puzzle','simon','🟡','Simon Vàng','Dãy màu vàng chói'),
g_('pz2-sim2','puzzle','simon','🟣','Simon Tím','Màu tím bí ẩn'),
g_('pz2-sud1','puzzle','sudoku','4️⃣','Sudoku Mới','Bàn cờ mới',{v:2}),
g_('pz2-sud2','puzzle','sudoku','5️⃣','Sudoku Luyện Tập','Luyện mỗi ngày',{v:3}),
g_('pz2-min1','puzzle','mines','😱','Dò Mìn Dễ','Chỉ 3 quả mìn',{mines:3}),
g_('pz2-min2','puzzle','mines','☠️','Dò Mìn Địa Ngục','10 quả mìn!',{mines:10}),
g_('pz2-sli1','puzzle','slide','1️⃣','Xếp Số Vui','Xếp hình thư giãn'),
g_('pz2-sli2','puzzle','slide','2️⃣','Xếp Số Pro','Kỷ lục ít bước'),
g_('pz2-odd1','puzzle','odd','🐝','Tìm Ong Khác','Ong lạc giữa bướm',{pool:['🦋','🐝','🐞','🐜','🪲']}),
g_('pz2-odd2','puzzle','odd','🚗','Tìm Xe Khác','Xe nào khác biệt',{pool:['🚗','🚕','🚙','🚌','🚎']}),
g_('pz2-odd3','puzzle','odd','🌸','Tìm Hoa Khác','Hoa lạ giữa vườn',{pool:['🌸','🌺','🌻','🌷','🌹']}),
g_('pz2-odd4','puzzle','odd','🐠','Tìm Cá Khác','Cá lạ trong đàn',{pool:['🐠','🐟','🐡','🦈','🐙']}),
g_('pz2-stk1','puzzle','stack','🧱','Thợ Xây','Xây nhà cao tầng'),
g_('pz2-stk2','puzzle','stack','🏯','Lâu Đài','Xây lâu đài trên mây'),
g_('pz2-maz1','puzzle','maze','🐁','Chuột Tìm Đường','Mê cung mới',{lv:2}),
g_('pz2-maz2','puzzle','maze','🧀','Săn Phô Mai','Phô mai cuối đường',{lv:3}),
/* ---- ARCADE +20 ---- */
g_('ac2-tap1','arcade','tap','🍩','Bấm Bánh Donut','Ngọt ngào liên tục',{e:'🍩',step:1}),
g_('ac2-tap2','arcade','tap','🚀','Phóng Tên Lửa','Tap để phóng',{e:'🚀',step:2}),
g_('ac2-tap3','arcade','tap','🐳','Cá Voi','Bấm cá voi xanh',{e:'🐳',step:1}),
g_('ac2-tap4','arcade','tap','🎸','Gảy Đàn','Rock hết mình',{e:'🎸',step:1}),
g_('ac2-tap5','arcade','tap','🍕','Ăn Pizza','Ăn càng nhanh càng tốt',{e:'🍕',step:1}),
g_('ac2-rea1','arcade','react','🥁','Trống Lệnh','Nghe hiệu lệnh bấm',{e:'NGHE...'}),
g_('ac2-rea2','arcade','react','🏁','Xuất Phát','Đèn xanh là chạy',{e:'VÀO VỊ TRÍ'}),
g_('ac2-aim1','arcade','aim','🍩','Bắn Donut','Ngắm trúng vòng ngọt',{e:'🍩',time:30}),
g_('ac2-aim2','arcade','aim','👻','Bắn Ma','Ma hiện bắn ngay',{e:'👻',time:30}),
g_('ac2-aim3','arcade','aim','🦟','Đập Muỗi','Muỗi bay vo ve',{e:'🦟',time:25,ammo:40}),
g_('ac2-aim4','arcade','aim','🦅','Bắn Đại Bàng','Chim bay trên trời',{e:'🦅',time:35,ammo:25}),
g_('ac2-wh1','arcade','aim','🐀','Đập Chuột Cống','Chuột chạy lung tung',{e:'🐀',mode:'grid',time:30}),
g_('ac2-wh2','arcade','aim','🦎','Đập Tắc Kè','Tắc kè đổi màu',{e:'🦎',mode:'grid',time:25,gap:32}),
g_('ac2-inv1','arcade','aim','🛩️','Phòng Không','Bắn máy bay địch',{e:'🛩️',mode:'row',time:40,ammo:40}),
g_('ac2-inv2','arcade','aim','🦇','Đuổi Dơi','Dơi bay đầy trời',{e:'🦇',mode:'row',time:40,ammo:40}),
g_('ac2-pon1','arcade','pongw','🏸','Cầu Lông Tường','Đánh cầu nảy tường'),
g_('ac2-pon2','arcade','pongw','⚾','Bóng Chày Tường','Ném bóng chuẩn'),
g_('ac2-brk1','arcade','breakm','🪟','Đập Kính','Phá ô kính màu'),
g_('ac2-slo1','arcade','slots','💎','Slot Kim Cương','Quay trúng kim cương',{pool:['💎','⭐','🍒','🔔','💰']}),
g_('ac2-brk2','arcade','breakm','🪞','Gương Vỡ','Hứng bóng phá gương'),
/* ---- TRÍ TUỆ +20 ---- */
g_('br2-q1','brain','quiz','🏛️','Đố Lịch Sử','Hào khí dân tộc',{q:QB_LS}),
g_('br2-q2','brain','quiz','⚽','Đố Thể Thao','Sân cỏ tri thức',{q:QB_TT}),
g_('br2-q3','brain','quiz','🎵','Đố Âm Nhạc','Giai điệu tri thức',{q:QB_NHAC}),
g_('br2-q4','brain','quiz','💻','Đố Công Nghệ','Thời đại số',{q:QB_CN}),
g_('br2-tf1','brain','quiz','🧪','Khoa Học Đúng Sai','Niềm tin hay sự thật',{q:QB_KH,n:6,step:15}),
g_('br2-tf2','brain','quiz','🌍','Địa Lý Đúng Sai','Khám phá thế giới',{q:QB_GEO,n:6,step:15}),
g_('br2-ttt1','brain','ttt','🏆','Caro Vô Địch','Đánh bại máy khó'),
g_('br2-rps1','brain','rps','🥷','Oẳn Tù Tì Ninja','Nhanh như ninja'),
g_('br2-st1','brain','stroop','🔥','Màu Tốc Độ','Đọc màu siêu nhanh'),
g_('br2-cup1','brain','cups','🎩','Ảo Thuật Cốc','Mắt không rời bóng'),
g_('br2-cup2','brain','cups','🃏','Cốc Ma Thuật','Tráo đổi chóng mặt'),
g_('br2-fl1','brain','flash','📞','Nhớ Số 4 Chữ Số','Như nhớ SĐT',{digits:4}),
g_('br2-fl2','brain','flash','🔐','Nhớ Mật Mã','Mật mã 6 số',{digits:6}),
g_('br2-sim1','brain','simon','🌟','Simon Siêu Cấp','Dãy cực dài'),
g_('br2-mem1','brain','memory','🦉','Trí Nhớ Cú Mèo','4 cặp thẻ đêm',{pairs:4,e:'🦉'}),
g_('br2-mem2','brain','memory','🐘','Trí Nhớ Voi','Nhớ như voi',{pairs:8,e:'🐘'}),
g_('br2-sq1','brain','seq','➗','Tìm Số Còn Thiếu','Logic dãy số'),
g_('br2-sq2','brain','seq','✖️','Cấp Số Nhân','Nhân đôi mỗi bước'),
g_('br2-od1','brain','odd','🔍','Thám Tử Thị Giác','Tìm điểm bất thường',{pool:['🔍','🔎','👓','🕵️','💡']}),
g_('br2-od2','brain','odd','💡','Bóng Đèn Khác','Bóng nào sáng khác',{pool:['💡','🔦','🕯️','🏮','💈']}),
/* ---- HÀNH ĐỘNG +20 ---- */
g_('hd2-do1','action','dodge','❄️','Né Tuyết','Bão tuyết trắng xóa',{e:'❄️',p:'⛷️'}),
g_('hd2-do2','action','dodge','🍂','Né Lá Rơi','Lá rơi mùa thu',{e:'🍂',p:'🧺'}),
g_('hd2-do3','action','dodge','💩','Né Bẩn','Tránh bãi bẩn',{e:'💩',p:'🚶'}),
g_('hd2-do4','action','dodge','🎾','Né Bóng Tennis','Bóng bay vèo vèo',{e:'🎾',p:'🏃'}),
g_('hd2-ca1','action','catch','🥭','Hứng Xoài','Xoài chín rơi',{e:'🥭',badE:'🪨',p:'🧺'}),
g_('hd2-ca2','action','catch','🍇','Hứng Nho','Chùm nho ngọt',{e:'🍇',badE:'💣',p:'🧺'}),
g_('hd2-ca3','action','catch','🥥','Hứng Dừa','Dừa rơi cẩn thận',{e:'🥥',badE:'🧨',p:'🧺'}),
g_('hd2-ca4','action','catch','🍒','Hứng Cherry','Cherry đỏ mọng',{e:'🍒',badE:'☠️',p:'🧺'}),
g_('hd2-ju1','action','jump','🐸','Ếch Nhảy','Ếch vượt suối',{e:'🪨',p:'🐸'}),
g_('hd2-ju2','action','jump','🐎','Ngựa Phi','Phi nước đại',{e:'🪵',p:'🐎'}),
g_('hd2-ju3','action','jump','🦄','Kỳ Lân Bay','Kỳ lân vượt mây',{e:'☁️',p:'🦄'}),
g_('hd2-wh1','action','aim','🐛','Đập Sâu','Sâu chui lên',{e:'🐛',mode:'grid',time:30}),
g_('hd2-wh2','action','aim','🦀','Bắt Cua','Cua bò ngang',{e:'🦀',mode:'grid',time:30}),
g_('hd2-inv1','action','aim','🎈','Bắn Bóng Rơi','Bóng rơi từ trời',{e:'🎈',mode:'row',time:40,ammo:50}),
g_('hd2-inv2','action','aim','🍃','Chặn Lá Độc','Lá độc bay',{e:'🍃',mode:'row',time:40,ammo:50}),
g_('hd2-ra1','action','racer1','🚕','Taxi Tốc Độ','Taxi luồn lách',{c1:'#ff0',c2:'#f33'}),
g_('hd2-ra2','action','racer1','🚓','Cảnh Sát Rượt Đuổi','Truy bắt tội phạm',{c1:'#08f',c2:'#111'}),
g_('hd2-stk1','action','stack','📚','Xếp Sách','Xếp sách ngay ngắn'),
g_('hd2-slo1','action','slots','🔔','Slot Thần Tài','Quay lấy hên',{pool:['🔔','💰','🍒','⭐','🍋']}),
g_('hd2-rea1','action','react','🏹','Bắn Cung','Buông dây đúng lúc',{e:'CĂNG DÂY...'}),
/* ---- CHỮ & SỐ +20 ---- */
g_('wd2-m1','word','math','🟰','Cộng Trong 20','Nền tảng vững chắc',{ops:['+'],max:20}),
g_('wd2-m2','word','math','🔟','Trừ Trong 20','Trừ nhanh như chớp',{ops:['−'],max:20}),
g_('wd2-m3','word','math','✖️','Nhân 2 Chữ Số','Nâng cao cửu chương',{ops:['×']}),
g_('wd2-m4','word','math','➗','Chia Hết','Chia không dư',{ops:['÷']}),
g_('wd2-g1','word','guess','1️⃣','Đoán Số 1-30','Làm quen suy luận',{max:30,base:100}),
g_('wd2-g2','word','guess','5️⃣','Đoán Số 1-500','Thử thách lớn',{max:500,base:400}),
g_('wd2-s1','word','scramble','🥬','Xếp Chữ Rau Củ','Rau xanh mỗi ngày',{words:W_RAU,hint:'rau củ'}),
g_('wd2-s2','word','scramble','🥤','Xếp Chữ Đồ Uống','Giải khát ngày hè',{words:W_NUOC,hint:'đồ uống'}),
g_('wd2-s3','word','scramble','🍜','Xếp Chữ Món Ăn','Đặc sản quê hương',{words:W_MON,hint:'món ăn'}),
g_('wd2-s4','word','scramble','🐟','Xếp Chữ Hải Sản','Quà từ biển cả',{words:W_BIEN,hint:'hải sản'}),
g_('wd2-h1','word','hang','🏫','Treo Cổ Trường Học','Chuyện học đường',{words:H_TRUONG,hint:'trường học'}),
g_('wd2-h2','word','hang','🌷','Treo Cổ Loài Hoa','Vườn hoa chữ',{words:H_HOA,hint:'loài hoa'}),
g_('wd2-h3','word','hang','🐱','Treo Cổ Thú Cưng','Boss quanh ta',{words:H_DV,hint:'con vật'}),
g_('wd2-q1','word','seq','📈','Dãy Số Tăng Dần','Cộng dồn liên tiếp'),
g_('wd2-q2','word','seq','📉','Dãy Số Bí Ẩn','Quy luật ẩn giấu'),
g_('wd2-q3','word','seq','🎲','Số May Mắn','Đoán số tiếp theo'),
g_('wd2-tf1','word','quiz','🧮','Toán Đúng Sai','Phán đoán phép tính',{q:QB_TOAN,n:6,step:15}),
g_('wd2-tf2','word','quiz','💻','Công Nghệ Đúng Sai','Hiểu biết số',{q:QB_CN,n:6,step:15}),
g_('wd2-fl1','word','flash','☎️','Nhớ 2 Số','Khởi động trí nhớ',{digits:2}),
g_('wd2-fl2','word','flash','📟','Nhớ 6 Số','Siêu trí nhớ',{digits:6}),
];

// ================= PLAYER =================
const KEY={};
window.addEventListener('keydown',e=>{KEY[e.code]=true;if(G&&G.onKey&&(e.code==='Space'||e.code.startsWith('Arrow')))e.preventDefault();});
window.addEventListener('keyup',e=>{KEY[e.code]=false;});
cv.addEventListener('pointerdown',e=>{
  const r=cv.getBoundingClientRect();
  const x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
  if(G&&G.onTap)G.onTap(x,y);
});
function openMini(id){
  const def=GAMES.find(g=>g.id===id);if(!def)return;
  document.getElementById('miniModal').classList.remove('hidden');
  document.getElementById('miniTitle').textContent=def.icon+' '+def.name;
  G=E[def.eng].create(def);
  cancelAnimationFrame(raf);last=performance.now();
  const loop=t=>{raf=requestAnimationFrame(loop);
    if(!G)return;G.update();G.draw();};
  raf=requestAnimationFrame(loop);
}
function closeMini(){cancelAnimationFrame(raf);G=null;
  document.getElementById('miniModal').classList.add('hidden');
  if(window.__miniRefresh)window.__miniRefresh();}
function miniKey(code){if(G&&G.onKey)G.onKey(code);}
window.addEventListener('keydown',e=>{if(G&&(e.code==='Space'||e.code.startsWith('Arrow')||e.code.startsWith('Digit')||e.code.startsWith('Key')||e.code==='Enter'||e.code==='Backspace'))miniKey(e.code);});
// modal dpad
document.querySelectorAll('#miniPad [data-k]').forEach(b=>{
  const k=b.getAttribute('data-k');
  const dn=e=>{e.preventDefault();KEY[k]=true;miniKey(k);};
  const up=e=>{e.preventDefault();KEY[k]=false;};
  b.addEventListener('pointerdown',dn);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);
});
document.getElementById('miniClose').onclick=closeMini;
document.getElementById('miniRestart').onclick=()=>{if(G)openMini(G.id);};
// ================= LIBRARY UI =================
let curCat='puzzle';
function renderMiniTabs(){
  const t=document.getElementById('miniTabs');t.innerHTML='';
  for(const k in CATS){const b=document.createElement('button');
    b.className='mtab'+(k===curCat?' on':'');b.textContent=CATS[k]+' ('+GAMES.filter(g=>g.cat===k).length+')';
    b.onclick=()=>{curCat=k;renderMiniTabs();renderMiniGrid();};t.appendChild(b);}
}
function renderMiniGrid(){
  const gr=document.getElementById('miniGrid');gr.innerHTML='';
  for(const g of GAMES.filter(x=>x.cat===curCat)){
    const d=document.createElement('div');d.className='mcard';
    d.innerHTML='<div class="mico">'+g.icon+'</div><div class="mname">'+g.name+'</div><div class="mdesc">'+g.desc+'</div><div class="mhs">★ '+(hsGet(g.id))+'</div>';
    const b=document.createElement('button');b.className='play mplay';b.textContent='▶ CHƠI';
    b.onclick=()=>openMini(g.id);
    d.appendChild(b);gr.appendChild(d);}
}
window.__miniRefresh=renderMiniGrid;
window.openMini=openMini;
window.MG={GAMES,CATS,renderMiniTabs,renderMiniGrid,hsGet};
renderMiniTabs();renderMiniGrid();
})();
