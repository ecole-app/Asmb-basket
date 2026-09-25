/* ===== 05-animations.js — Moteur d'animation canvas des situations pedagogiques ===== */
// ═══ ANIMATION ENGINE ════════════════════════════════════════════
var SIT_ANIMS={},SIT_DUR={},sitAS={};
function getSA(k){if(!sitAS[k])sitAS[k]={raf:null,running:false,startTs:null};return sitAS[k];}
function injectSitAnim(key){
 var wrap=document.getElementById("anim-"+key);
 if(!wrap||wrap.dataset.built)return;wrap.dataset.built="1";
 var W=320,H=SIT_ANIMS[key].height||240;
 var cv=document.createElement("canvas");cv.id="sc-"+key;cv.width=W;cv.height=H;cv.style.cssText="width:100%;height:auto;display:block;border-radius:8px";
 var ctrl=document.createElement("div");ctrl.style.cssText="display:flex;gap:6px;align-items:center;padding:6px 0";
 var playBtn=document.createElement("button");playBtn.id="sb-"+key;playBtn.className="abtn aplay";playBtn.textContent="▶ Lancer";playBtn.onclick=function(){sitToggle(key);};
 var resetBtn=document.createElement("button");resetBtn.className="abtn areset";resetBtn.textContent="";resetBtn.onclick=function(){sitReset(key);};
 var spd=document.createElement("input");spd.type="range";spd.id="ss-"+key;spd.min="0.5";spd.max="2";spd.step="0.25";spd.value="1";spd.style.cssText="accent-color:var(--ltg);width:65px";
 ctrl.appendChild(playBtn);ctrl.appendChild(resetBtn);ctrl.appendChild(spd);
 wrap.appendChild(cv);wrap.appendChild(ctrl);
 setTimeout(function(){if(cv)SIT_ANIMS[key](cv.getContext("2d"),0);},40);
}
function sitToggle(key){
 var s=getSA(key),btn=document.getElementById("sb-"+key);if(!btn)return;
 if(s.running){s.running=false;cancelAnimationFrame(s.raf);btn.textContent="▶ Reprendre";}
 else{if(["▶ Lancer","▶ Rejouer"].includes(btn.textContent))s.startTs=null;s.running=true;btn.textContent="⏸ Pause";s.raf=requestAnimationFrame(function(ts){if(!s.startTs)s.startTs=ts;sitLoop(key,ts);});}
}
function sitReset(key){
 var s=getSA(key);s.running=false;cancelAnimationFrame(s.raf);s.startTs=null;
 var btn=document.getElementById("sb-"+key);if(btn)btn.textContent="▶ Lancer";
 var cv=document.getElementById("sc-"+key);if(cv)SIT_ANIMS[key](cv.getContext("2d"),0);
}
function sitLoop(key,ts){
 var s=getSA(key);if(!s.running)return;
 if(!s.startTs)s.startTs=ts;
 var spd=parseFloat((document.getElementById("ss-"+key)||{value:"1"}).value);
 var t=Math.min((ts-s.startTs)*spd/SIT_DUR[key],1);
 var cv=document.getElementById("sc-"+key);if(cv)SIT_ANIMS[key](cv.getContext("2d"),t);
 if(t<1){s.raf=requestAnimationFrame(function(ts2){sitLoop(key,ts2);});}
 else{s.running=false;var b=document.getElementById("sb-"+key);if(b)b.textContent="▶ Rejouer";}
}

// ─── Canvas utils ────────────────────────────────────────────────
function bz(t,p0,p1,p2,p3){var u=1-t;return u*u*u*p0+3*u*u*t*p1+3*u*t*t*p2+t*t*t*p3;}
function bz2(t,x0,y0,cx1,cy1,cx2,cy2,x1,y1){return{x:bz(t,x0,cx1,cx2,x1),y:bz(t,y0,cy1,cy2,y1)};}
function lp(a,b,t){return a+(b-a)*t;}
function cl(v,a,b){return Math.max(a,Math.min(b,v));}
function ease(t){return t<.5?2*t*t:-1+(4-2*t)*t;}
function eOut(t){return 1-(1-t)*(1-t);}
function pq(ctx,W,H){
 ctx.fillStyle="#C8924A";ctx.beginPath();ctx.roundRect(0,0,W,H,8);ctx.fill();
 ctx.strokeStyle="rgba(150,90,30,.3)";ctx.lineWidth=1;
 for(var y=0;y<H;y+=16){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=2.5;ctx.beginPath();ctx.roundRect(10,10,W-20,H-20,4);ctx.stroke();
}
function rq(ctx,W,rx,ry,rw,rh,up){
 ctx.fillStyle="rgba(170,100,35,.2)";ctx.fillRect(rx,ry,rw,rh);
 ctx.strokeStyle="rgba(255,255,255,.62)";ctx.lineWidth=1.8;ctx.strokeRect(rx,ry,rw,rh);
 ctx.beginPath();ctx.arc(W/2,up?ry+rh:ry,48,up?0:Math.PI,up?Math.PI:0);ctx.stroke();
}
function pn(ctx,x,y,inv){
 var d=inv?-1:1;ctx.fillStyle="#777";ctx.fillRect(x-14,y,28,d*5);
 ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y+d*16,9,0,Math.PI*2);ctx.stroke();
}
function dfc(ctx,W,H){
 pq(ctx,W,H);ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=1.8;
 ctx.beginPath();ctx.moveTo(10,H/2);ctx.lineTo(W-10,H/2);ctx.stroke();
 ctx.beginPath();ctx.arc(W/2,H/2,36,0,Math.PI*2);ctx.stroke();
 var rw=140,rh=H*.17,rx=(W-rw)/2;
 rq(ctx,W,rx,10,rw,rh,true);pn(ctx,W/2,10,false);
 rq(ctx,W,rx,H-10-rh,rw,rh,false);pn(ctx,W/2,H-10,true);
}
function dhc(ctx,W,H){
 pq(ctx,W,H);var rw=160,rh=H*.48,rx=(W-rw)/2;
 rq(ctx,W,rx,10,rw,rh,true);pn(ctx,W/2,10,false);
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=1.4;
 ctx.beginPath();ctx.moveTo(rx,10+rh);ctx.lineTo(rx+rw,10+rh);ctx.stroke();
}
function pl(ctx,x,y,lb,col,r,a){
 r=r||13;a=a===undefined?1:a;ctx.globalAlpha=a;
 ctx.fillStyle="rgba(0,0,0,.2)";ctx.beginPath();ctx.ellipse(x,y+r+2,r*.6,3.5,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="rgba(255,255,255,.82)";ctx.lineWidth=1.8;ctx.stroke();
 ctx.fillStyle="#fff";ctx.font="bold "+(r<12?8:10)+"px system-ui";
 ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(lb,x,y+1);ctx.globalAlpha=1;
}
function bl(ctx,x,y,r){
 r=r||8;ctx.fillStyle="rgba(0,0,0,.2)";ctx.beginPath();ctx.ellipse(x+1,y+r+2,r*.5,3,0,0,Math.PI*2);ctx.fill();
 var g=ctx.createRadialGradient(x-r*.3,y-r*.3,1,x,y,r);g.addColorStop(0,"#f0a050");g.addColorStop(1,"#d05808");
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="rgba(100,35,0,.4)";ctx.lineWidth=.9;ctx.beginPath();ctx.arc(x,y,r,-.5,.5);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();
}
function fp(ctx,x,y,a){
 ctx.globalAlpha=a;ctx.fillStyle="#C0392B";
 ctx.beginPath();ctx.ellipse(x-9,y+16,5,3,.2,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.ellipse(x+9,y+16,5,3,-.2,0,Math.PI*2);ctx.fill();
 ctx.globalAlpha=1;
}
function gMatch(ctx,t,W,H,full){
 if(full)dfc(ctx,W,H);
 else{pq(ctx,W,H);ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);}
 var AT=[{bx:W/2-62,by:H/2-28},{bx:W/2+48,by:H/2-42},{bx:W/2-18,by:H/2+48},{bx:W/2+58,by:H/2+32}];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(t*Math.PI*2*.7+i*1.2)*50,18,W-18),y:cl(a.by+Math.cos(t*Math.PI*2*.6+i*1.1)*38,18,H-18)};});
 var dp=AT.map(function(a,i){var td=Math.max(0,t-.08);return{x:cl(a.bx+Math.sin(td*Math.PI*2*.7+i*1.2)*50+5,20,W-20),y:cl(a.by+Math.cos(td*Math.PI*2*.6+i*1.1)*38+10,20,H-20)};});
 ap.forEach(function(a,i){var d=dp[i];ctx.strokeStyle="rgba(192,57,43,.1)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(d.x,d.y);ctx.stroke();ctx.setLineDash([]);});
 var bi=Math.floor(t*5)%4,bni=(bi+1)%4,bp=(t*5)%1;
 bl(ctx,lp(ap[bi].x,ap[bni].x,eOut(bp)),lp(ap[bi].y,ap[bni].y,eOut(bp))-Math.sin(bp*Math.PI)*7,7);
 dp.forEach(function(d){pl(ctx,d.x,d.y,"D","#C0392B",11);});
 ap.forEach(function(a){pl(ctx,a.x,a.y,"A","#1A2E5A",11);});
}

// ═══ ANIMATIONS C1 ═══════════════════════════════════════════════
SIT_DUR["1.1-1"]=5000;SIT_ANIMS["1.1-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=240;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 var cols=[52,117,182,247],plotY=[38,78,118,158,198];
 cols.forEach(function(cx){
 plotY.forEach(function(py,i){ctx.fillStyle="#E8670A";ctx.beginPath();ctx.arc(cx+(i%2===0?-12:12),py,5,0,Math.PI*2);ctx.fill();});
 ctx.strokeStyle="rgba(255,255,255,.1)";ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(cx,H-15);ctx.lineTo(cx,20);ctx.stroke();ctx.setLineDash([]);
 });
 cols.forEach(function(cx,ci){
 var tp=((t+(1-ci*0.22))%1),py=lp(220,18,tp),seg=Math.floor(tp*5),xOff=(seg%2===0)?lp(-13,13,(tp*5)%1):lp(13,-13,(tp*5)%1);
 pl(ctx,cx+xOff,py,"A","#1A2E5A",11);bl(ctx,cx+xOff,py-13,6);
 });
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("4 couloirs · dribble slalom",W/2,H-8);
};SIT_ANIMS["1.1-1"].height=240;

SIT_DUR["1.1-2"]=5500;SIT_ANIMS["1.1-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=240;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.strokeRect(22,22,W-44,H-44);ctx.setLineDash([]);
 [{bx:160,by:120},{bx:130,by:70}].forEach(function(d,i){
 pl(ctx,cl(d.bx+Math.sin(t*Math.PI*2*1.8+i*2.1)*65,25,W-25),cl(d.by+Math.cos(t*Math.PI*2*1.5+i*1.8)*45,25,H-25),"R","#C0392B",13);
 });
 [{bx:60,by:80},{bx:185,by:140},{bx:255,by:60},{bx:100,by:180},{bx:235,by:190}].forEach(function(a,i){
 var x=cl(a.bx+Math.sin(t*Math.PI*2*1.3+i*1.1)*55,25,W-25),y=cl(a.by+Math.cos(t*Math.PI*2*1.1+i*0.9)*40,25,H-25);
 pl(ctx,x,y,"A","#1A2E5A",11);bl(ctx,x,y-13,6);
 });
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("R=Requin · A=Dribbleuse",W/2,H-8);
};SIT_ANIMS["1.1-2"].height=240;

SIT_DUR["1.1-3"]=5000;SIT_ANIMS["1.1-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=240;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,8,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-58,14,116,68);ctx.beginPath();ctx.arc(W/2,82,42,0,Math.PI);ctx.stroke();
 var pos=[{x:W/2,y:115},{x:W/2-55,y:98},{x:W/2+55,y:98}],shooter=Math.floor(t*3)%3,phase=(t*3)%1;
 pos.forEach(function(p,i){pl(ctx,p.x,p.y,"T"+(i+1),"#1A2E5A",12);});
 var sp=pos[shooter];
 if(phase<0.5){var pp=phase/0.5;bl(ctx,lp(sp.x,W/2,eOut(pp)),lp(sp.y,27,ease(pp))-Math.sin(pp*Math.PI)*28,8);}
 else{bl(ctx,W/2,27,7);}
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Rotation des tireurs",W/2,H-8);
};SIT_ANIMS["1.1-3"].height=240;

SIT_DUR["1.2-1"]=4500;SIT_ANIMS["1.2-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=200;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.25)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(W/2-70,28,140,144);ctx.setLineDash([]);
 var bx=W/2+Math.sin(t*Math.PI*2)*55,by=72+Math.sin(t*Math.PI*3+1)*15;
 var td=Math.max(0,t-0.08),ax=W/2+Math.sin(td*Math.PI*2)*55,ay=H-72-Math.sin(td*Math.PI*3+1)*15;
 pl(ctx,bx,by,"B","#16A085",13);bl(ctx,bx,by-15,7);
 pl(ctx,ax,ay,"A","#1A2E5A",13);bl(ctx,ax,ay-15,7);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("B mene · A imite en miroir",W/2,H-8);
};SIT_ANIMS["1.2-1"].height=200;

SIT_DUR["1.2-2"]=5000;SIT_ANIMS["1.2-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=220;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(22,15);ctx.lineTo(22,H-15);ctx.stroke();ctx.beginPath();ctx.moveTo(W-22,15);ctx.lineTo(W-22,H-15);ctx.stroke();
 [48,92,136,180].forEach(function(ry,i){
 var tp=((t+(1-i*0.25))%1),going=tp<0.5,progress=going?tp/0.5:(tp-0.5)/0.5,px=going?lp(24,W-24,eOut(progress)):lp(W-24,24,eOut(progress));
 pl(ctx,px,ry,"A","#1A2E5A",11);bl(ctx,px,ry-13,6);
 ctx.fillStyle="rgba(255,165,0,.7)";ctx.font="bold 7px system-ui";ctx.textAlign="center";ctx.fillText(going?(i%2===0?"MD":"MG"):(i%2===0?"MG":"MD"),px,ry+24);
 });
};SIT_ANIMS["1.2-2"].height=220;

SIT_DUR["1.2-3"]=5500;SIT_ANIMS["1.2-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,12,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,25,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,12,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var ax,ay,dx,dy;
 if(t<0.2){ax=W/2;ay=lp(H-25,H/2+15,eOut(t/0.2));dx=W/2;dy=lp(H/2+35,H/2+30,t/0.2);}
 else if(t<0.6){var p=(t-.2)/.4;var pos=bz2(p,W/2,H/2+15,W/2-30,H/2,W/2+25,85,W/2+10,60);ax=pos.x;ay=pos.y;var pd=cl(p-.08,0,1);var dp2=bz2(pd,W/2,H/2+30,W/2-30,H/2+12,W/2+25,100,W/2+10,75);dx=dp2.x;dy=dp2.y;for(var k=1;k<=3;k++){var tp=cl(pd-k*.07,0,1);var f=bz2(tp,W/2,H/2+30,W/2-30,H/2+12,W/2+25,100,W/2+10,75);fp(ctx,f.x,f.y,Math.max(0,.12-k*.04));}ctx.strokeStyle="rgba(255,255,255,.15)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(dx,dy);ctx.stroke();ctx.setLineDash([]);}
 else{var p2=(t-.6)/.4;ax=lp(W/2+10,W/2+5,p2);ay=lp(60,38,eOut(p2));dx=lp(W/2+10,W/2+8,p2);dy=lp(75,52,eOut(p2));}
 if(t<0.9)bl(ctx,ax,ay-13,7);pl(ctx,dx,dy,"D","#C0392B");pl(ctx,ax,ay,"A","#1A2E5A");
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("1c1 · D suit A · Défense individuelle",W/2,H-8);
};SIT_ANIMS["1.2-3"].height=260;

SIT_DUR["1.3-1"]=4500;SIT_ANIMS["1.3-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=200;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(W-30,18,22,H-36);ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=2;ctx.strokeRect(W-30,18,22,H-36);
 ctx.strokeStyle="#E8670A";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W-19,H/2,12,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(W-19,H/2,6,0,Math.PI*2);ctx.stroke();
 pl(ctx,100,H/2+28,"A","#1A2E5A",12);pl(ctx,100,H/2-28,"B","#16A085",12);
 var ph=(t*3)%1,passer=Math.floor(t*3)%2,sy=passer===0?H/2+28:H/2-28,bx,by;
 if(ph<0.45){var p=ph/0.45;bx=lp(100,W-19,eOut(p));by=lp(sy,H/2,p)-Math.sin(p*Math.PI)*8;}
 else{var p2=(ph-.45)/.55;bx=lp(W-19,100,eOut(p2));by=lp(H/2,passer===0?H/2-28:H/2+28,p2);}
 bl(ctx,bx,by,8);
 ctx.fillStyle="rgba(255,165,0,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";
 ctx.fillText(["Passe poitrine","Passe rebond","Passe 1 main"][Math.floor(t*6)%3],W/2-20,H-8);
};SIT_ANIMS["1.3-1"].height=200;

SIT_DUR["1.3-2"]=5500;SIT_ANIMS["1.3-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=220;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 var spd=t*Math.PI*2*0.8,r=72;
 var pos=[0,1,2].map(function(i){return{x:W/2+Math.cos(spd+i*2*Math.PI/3-Math.PI/2)*r,y:H/2+Math.sin(spd+i*2*Math.PI/3-Math.PI/2)*r};});
 for(var i=0;i<3;i++){ctx.strokeStyle="rgba(255,255,255,.15)";ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(pos[i].x,pos[i].y);ctx.lineTo(pos[(i+1)%3].x,pos[(i+1)%3].y);ctx.stroke();ctx.setLineDash([]);}
 var bi=Math.floor(t*3)%3,bni=(bi+1)%3,bp=(t*3)%1;
 var bx=lp(pos[bi].x,pos[bni].x,eOut(bp)),by=lp(pos[bi].y,pos[bni].y,eOut(bp));
 if(bp<0.8){ctx.strokeStyle="rgba(232,103,10,.5)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(pos[bi].x,pos[bi].y);ctx.lineTo(bx,by);ctx.stroke();}
 ["A","B","C"].forEach(function(l,i){pl(ctx,pos[i].x,pos[i].y,l,"#1A2E5A",13);});
 bl(ctx,bx,by,7);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("A→B→C→A · Passe puis deplacement",W/2,H-8);
};SIT_ANIMS["1.3-2"].height=220;

SIT_DUR["1.3-3"]=5000;SIT_ANIMS["1.3-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var a1x,a1y,a2x,a2y,bx,by;
 if(t<0.4){var p=t/0.4;a1x=lp(W/2-55,W/2-28,eOut(p));a1y=lp(H-28,H/2-18,eOut(p));a2x=lp(W/2+55,W/2+28,eOut(p));a2y=lp(H-28,H/2-18,eOut(p));bx=a1x;by=a1y-13;}
 else if(t<0.65){var p2=(t-.4)/.25;a1x=lp(W/2-28,W/2+18,p2);a1y=lp(H/2-18,80,eOut(p2));a2x=lp(W/2+28,W/2-14,p2);a2y=a1y;bx=lp(a1x+8,a2x-8,eOut(p2));by=lp(a1y,a2y,p2)-Math.sin(p2*Math.PI)*10;}
 else if(t<0.85){var p3=(t-.65)/.2;a1x=W/2+18;a1y=80;a2x=lp(W/2-14,W/2,p3);a2y=lp(80,44,eOut(p3));bx=lp(a2x+4,W/2,eOut(p3));by=lp(a2y,27,eOut(p3));}
 else{a1x=W/2+18;a1y=80;a2x=W/2;a2y=44;bx=W/2;by=27;}
 bl(ctx,bx,by,7);pl(ctx,a1x,a1y,"A1","#1A2E5A",12);pl(ctx,a2x,a2y,"A2","#1A2E5A",12);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Passes sans dribble · montee collective",W/2,H-8);
};SIT_ANIMS["1.3-3"].height=260;

SIT_DUR["1.4-1"]=4000;SIT_ANIMS["1.4-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=200;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-12,14,24,4);ctx.strokeStyle="#E8670A";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,22,7,0,Math.PI*2);ctx.stroke();
 pl(ctx,W/2,H-20,"C","#8E44AD",12);
 [55,115,175,235].forEach(function(x,i){
 var ph=(t*2+i*0.25)%1,armA=Math.sin(ph*Math.PI)*(-Math.PI*0.55);
 pl(ctx,x,H/2+10,"A","#1A2E5A",11);
 ctx.strokeStyle="rgba(26,46,90,.8)";ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,H/2-2);ctx.lineTo(x+Math.sin(armA)*28,H/2-2-Math.cos(armA)*28);ctx.stroke();
 if(Math.abs(armA)>0.3){ctx.strokeStyle="rgba(255,165,0,.3)";ctx.lineWidth=1;ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x,H/2-2);ctx.lineTo(W/2,22);ctx.stroke();ctx.setLineDash([]);}
 ctx.fillStyle="rgba(232,103,10,.8)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText(["B","E","E","F"][i],x,H/2+35);
 });
};SIT_ANIMS["1.4-1"].height=200;

SIT_DUR["1.4-2"]=5500;SIT_ANIMS["1.4-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-58,14,116,70);ctx.beginPath();ctx.arc(W/2,84,44,0,Math.PI);ctx.stroke();
 var spots=[{x:W/2-85,y:78},{x:W/2-60,y:118},{x:W/2,y:128},{x:W/2+60,y:118},{x:W/2+85,y:78}];
 var active=Math.floor(t*5*1.2)%5;
 spots.forEach(function(s,i){
 var isA=i===active;ctx.fillStyle=isA?"rgba(232,103,10,.4)":"rgba(255,255,255,.1)";ctx.beginPath();ctx.arc(s.x,s.y,14,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=isA?"#E8670A":"rgba(255,255,255,.3)";ctx.lineWidth=1.5;ctx.stroke();
 ctx.fillStyle=isA?"#fff":"rgba(255,255,255,.5)";ctx.font=(isA?"bold ":"")+"9px system-ui";ctx.textAlign="center";ctx.fillText(i+1,s.x,s.y+3);
 });
 var as=spots[active],sp=(t*5.5)%1;
 pl(ctx,as.x,as.y+24,"A","#1A2E5A",12);
 if(sp<0.45){bl(ctx,lp(as.x,W/2,eOut(sp/0.45)),lp(as.y+10,27,ease(sp/0.45))-Math.sin((sp/0.45)*Math.PI)*25,8);}
 else{pl(ctx,W/2+18,44,"R","#16A085",10);bl(ctx,W/2,27,7);}
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Spot "+(active+1)+"/5 · 2 tirs par spot",W/2,H-8);
};SIT_ANIMS["1.4-2"].height=260;

SIT_DUR["1.4-3"]=5500;SIT_ANIMS["1.4-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-58,14,116,68);ctx.beginPath();ctx.arc(W/2,82,44,0,Math.PI);ctx.stroke();
 var isRight=Math.floor(t*2)%2===0,side=isRight?1:-1,ct=(t*2)%1,startX=W/2+side*80,startY=H-25;
 var ax,ay,bx,by;
 if(ct<0.55){var p=ct/0.55;ax=lp(startX,W/2+side*18,eOut(p));ay=lp(startY,72,eOut(p));bx=ax;by=ay-13;}
 else if(ct<0.78){var p2=(ct-.55)/.23;ax=lp(W/2+side*18,W/2+side*8,p2);ay=lp(72,46,eOut(p2))-Math.sin(p2*Math.PI)*20;bx=lp(ax,W/2+side*36,eOut(p2));by=lp(ay-13,21,eOut(p2));}
 else{var p3=(ct-.78)/.22;ax=W/2+side*8;ay=46;bx=lp(W/2+side*36,W/2,p3);by=lp(21,27,p3);}
 for(var k=1;k<=3;k++){var tp=Math.max(0,ct-k*0.06);ctx.globalAlpha=Math.max(0,.12-k*.04);ctx.fillStyle="#1A2E5A";ctx.beginPath();ctx.arc(lp(startX,W/2+side*18,eOut(tp/0.55)),lp(startY,72,eOut(tp/0.55)),10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
 for(var m=1;m<=2;m++){pl(ctx,startX-side*m*22,startY,"A","#1A2E5A",9,0.5);}
 pl(ctx,W/2-side*18,44,"R","#16A085",10);bl(ctx,bx,by,8);pl(ctx,ax,ay,"A","#1A2E5A");
 ctx.fillStyle="rgba(255,165,0,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText(isRight?"Cote DROIT":"Cote GAUCHE",W/2,H-8);
};SIT_ANIMS["1.4-3"].height=270;

SIT_DUR["1.5-1"]=4500;SIT_ANIMS["1.5-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=220;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(60,H/2);ctx.lineTo(W-60,H/2);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,36,0,Math.PI*2);ctx.stroke();
 var sx=W/2,sy=H/2,dx=sx,dy=sy,ph=t<0.15?0:t<0.45?1:t<0.72?2:3;
 if(t<0.15){dx=sx;dy=sy;}
 else if(t<0.45){var p=(t-.15)/.3;dx=lp(sx,sx-82,ease(p));dy=sy+Math.sin(p*Math.PI*3)*3;}
 else if(t<0.72){var p2=(t-.45)/.27;dx=lp(sx-82,sx+82,ease(p2));dy=sy+Math.sin(p2*Math.PI*3)*3;}
 else{var p3=(t-.72)/.28;if(p3<0.5){dx=lp(sx+82,sx,p3/.5);dy=lp(sy,sy+55,ease(p3/.5));}else{dx=sx;dy=lp(sy+55,sy-35,eOut((p3-.5)/.5));}}
 if(t>0.15&&t<0.72){for(var k=1;k<=5;k++){var tpast=Math.max(0.15,t-k*0.04);var fx,fy;if(tpast<0.45){var pp=(tpast-.15)/.3;fx=lp(sx,sx-82,ease(pp));fy=sy;}else{var pp2=(tpast-.45)/.27;fx=lp(sx-82,sx+82,ease(pp2));fy=sy;}ctx.globalAlpha=Math.max(0,.2-k*.04);ctx.fillStyle="#C0392B";var sd=(k%2===0)?-9:9;ctx.beginPath();ctx.ellipse(fx+sd,fy+14,5,3,.2*(sd>0?1:-1),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
 pl(ctx,dx,dy,"D","#C0392B",14);
 if(t>0.15&&t<0.72){var b=Math.sin(t*Math.PI*10)*4;ctx.fillStyle="rgba(192,57,43,.55)";ctx.beginPath();ctx.ellipse(dx-11,dy+17+b,6,3,.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(dx+11,dy+17-b,6,3,-.2,0,Math.PI*2);ctx.fill();}
 var lbs=["Position base","Glissade gauche","Glissade droite","Retraite+Sprint"];
 ctx.fillStyle="rgba(232,103,10,.8)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText(lbs[ph],W/2,H-8);
};SIT_ANIMS["1.5-1"].height=220;

SIT_DUR["1.5-2"]=4500;SIT_ANIMS["1.5-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=200;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 [[80,75],[200,75],[80,155],[200,155]].forEach(function(pos,i){
 var a=(t*Math.PI*2+i*Math.PI/2);
 ctx.fillStyle="rgba(232,103,10,.6)";ctx.beginPath();ctx.arc(pos[0],pos[1]+16,5,0,Math.PI*2);ctx.fill();
 pl(ctx,pos[0],pos[1],"A","#1A2E5A",11);
 ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pos[0],pos[1]);ctx.lineTo(pos[0]+Math.cos(a)*22,pos[1]+Math.sin(a)*22);ctx.stroke();
 bl(ctx,pos[0]+Math.cos(a)*14,pos[1]+Math.sin(a)*14,6);
 });
 ctx.fillStyle="rgba(255,165,0,.6)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("Pied pivot ancre · Corps qui tourne",W/2,H-8);
};SIT_ANIMS["1.5-2"].height=200;

SIT_DUR["1.5-3"]=5500;SIT_ANIMS["1.5-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.35)";ctx.lineWidth=1;ctx.strokeRect(18,18,W-36,H-36);ctx.beginPath();ctx.arc(W/2,H/2,38,0,Math.PI*2);ctx.stroke();
 var AT=[{bx:W/2-55,by:H/2+20,vx:.8,vy:.6},{bx:W/2+45,by:H/2+30,vx:-.7,vy:.9},{bx:W/2,by:H/2+65,vx:1,vy:-.7}];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(t*Math.PI*2*a.vx+i)*40,22,W-22),y:cl(a.by+Math.cos(t*Math.PI*2*a.vy+i)*30,22,H-36)};});
 var dp=AT.map(function(a,i){var td=Math.max(0,t-.09);return{x:cl(a.bx+Math.sin(td*Math.PI*2*a.vx+i)*40+5,24,W-24),y:cl(a.by+Math.cos(td*Math.PI*2*a.vy+i)*30+12,24,H-38)};});
 ap.forEach(function(a,i){var d=dp[i];ctx.strokeStyle="rgba(192,57,43,.12)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(d.x,d.y);ctx.stroke();ctx.setLineDash([]);});
 var bi=Math.floor(t*5)%3,bni=(bi+1)%3,bp=(t*5)%1;
 bl(ctx,lp(ap[bi].x,ap[bni].x,eOut(bp)),lp(ap[bi].y,ap[bni].y,eOut(bp))-Math.sin(bp*Math.PI)*7,7);
 dp.forEach(function(d){pl(ctx,d.x,d.y,"D","#C0392B",11);});ap.forEach(function(a){pl(ctx,a.x,a.y,"A","#1A2E5A",11);});
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Défense individuelle · Chaque D suit son A",W/2,H-8);
};SIT_ANIMS["1.5-3"].height=260;

// ═══ ANIMATIONS C2 ═══════════════════════════════════════════════
SIT_DUR["2.1-1"]=5500;SIT_ANIMS["2.1-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var ax,ay,bx2,by2,ballx,bally;
 if(t<0.22){ax=W/2-65;ay=H/2+10;bx2=W/2+55;by2=H/2+10;ballx=ax;bally=ay-13;}
 else if(t<0.45){var p=(t-.22)/.23;ax=lp(W/2-65,W/2-28,eOut(p));ay=H/2+10;bx2=W/2+55;by2=H/2+10;ballx=lp(W/2-65,W/2+55,eOut(p));bally=H/2+10-Math.sin(p*Math.PI)*10;if(p<0.85){ctx.strokeStyle="rgba(232,103,10,.5)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(W/2-65,H/2+10);ctx.lineTo(ballx,bally);ctx.stroke();}}
 else if(t<0.72){var p2=(t-.45)/.27;ax=lp(W/2-28,W/2-16,p2);ay=lp(H/2+10,62,eOut(p2));bx2=W/2+55;by2=H/2+10;ballx=bx2;bally=by2-13;ctx.strokeStyle="rgba(26,46,90,.3)";ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(W/2-28,H/2+10);ctx.lineTo(ax,ay);ctx.stroke();ctx.setLineDash([]);if(p2>0.3){ctx.fillStyle="rgba(255,255,255,.65)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("COUPE !",ax-22,ay-12);}}
 else{var p3=(t-.72)/.28;ax=lp(W/2-16,W/2-10,p3);ay=lp(62,34,eOut(p3));bx2=W/2+55;by2=H/2+10;ballx=lp(W/2+55,W/2-13,eOut(p3));bally=lp(H/2+10,34,eOut(p3));if(p3>0.65){var pp=(p3-.65)/.35;ballx=lp(W/2-13,W/2,eOut(pp));bally=lp(34,27,ease(pp))-Math.sin(pp*Math.PI)*15;}}
 pl(ctx,W/2+18,44,"C","#16A085",10);bl(ctx,ballx,bally,8);pl(ctx,bx2,by2,"B","#1A2E5A",13);pl(ctx,ax,ay,"A","#1A2E5A",13);
 ctx.fillStyle="rgba(232,103,10,.8)";ctx.font="bold 8px system-ui";ctx.textAlign="center";
 ctx.fillText(["Depart","Passe A→B","A coupe","Passe retour + Lay-up"][t<0.22?0:t<0.45?1:t<0.72?2:3],W/2,H-8);
};SIT_ANIMS["2.1-1"].height=270;

SIT_DUR["2.1-2"]=5500;SIT_ANIMS["2.1-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var a1x,a1y,a2x,a2y,dx,dy,bx2,by2;
 if(t<0.25){var p=t/0.25;a1x=lp(W/2-75,W/2-55,eOut(p));a1y=lp(H-25,H/2+30,eOut(p));a2x=lp(W/2+75,W/2+55,eOut(p));a2y=a1y;dx=W/2;dy=lp(H/2+5,H/2+50,eOut(p));bx2=a1x;by2=a1y-13;}
 else if(t<0.5){var p2=(t-.25)/.25;a1x=lp(W/2-55,W/2-35,eOut(p2));a1y=lp(H/2+30,H/2+5,eOut(p2));a2x=W/2+55;a2y=H/2+30;dx=lp(W/2,W/2-20,p2);dy=lp(H/2+50,H/2+25,p2);bx2=a1x;by2=a1y-13;}
 else if(t<0.72){var p3=(t-.5)/.22;a1x=W/2-35;a1y=H/2+5;a2x=lp(W/2+55,W/2+38,eOut(p3));a2y=lp(H/2+30,H/2+10,eOut(p3));dx=W/2-20;dy=H/2+25;bx2=lp(W/2-35,W/2+38,eOut(p3));by2=lp(H/2+5,H/2+10,p3)-Math.sin(p3*Math.PI)*10;if(p3>0.3){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("PASSE !",W/2,H/2-8);}}
 else{var p4=(t-.72)/.28;a1x=W/2-35;a1y=H/2+5;a2x=lp(W/2+38,W/2+25,p4);a2y=lp(H/2+10,65,eOut(p4));dx=W/2-20;dy=H/2+25;bx2=lp(W/2+38,W/2,eOut(p4));by2=lp(H/2+10,27,ease(p4))-Math.sin(p4*Math.PI)*18;}
 bl(ctx,bx2,by2,8);pl(ctx,dx,dy,"D","#C0392B");pl(ctx,a2x,a2y,"A2","#1A2E5A",12);pl(ctx,a1x,a1y,"A1","#1A2E5A",12);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Surnombre 2v1 · Decision rapide",W/2,H-8);
};SIT_ANIMS["2.1-2"].height=270;

// C1 1v1 full court pour la defense
SIT_DUR["3.1-1"]=5500;SIT_ANIMS["3.1-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=500;ctx.clearRect(0,0,W,H);dfc(ctx,W,H);
 ctx.strokeStyle="rgba(26,46,90,.18)";ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
 ctx.beginPath();ctx.moveTo(W/2,470);ctx.bezierCurveTo(W/2+5,370,W/2-28,302,W/2-48,218);ctx.bezierCurveTo(W/2-68,165,W/2+38,132,W/2+18,65);ctx.stroke();ctx.setLineDash([]);
 var ax,ay,dx,dy;
 if(t<0.18){ax=W/2;ay=lp(470,418,eOut(t/0.18));dx=W/2;dy=lp(455,438,eOut(t/0.18));}
 else if(t<0.5){var p=(t-.18)/.32;var pos=bz2(p,W/2,418,W/2+5,365,W/2-28,298,W/2-48,218);ax=pos.x;ay=pos.y;var pd=cl(p-.08,0,1);var dp2=bz2(pd,W/2,435,W/2+5,380,W/2-28,314,W/2-48,234);dx=dp2.x;dy=dp2.y;for(var k=1;k<=4;k++){var tp=cl(pd-k*.07,0,1);var f=bz2(tp,W/2,435,W/2+5,380,W/2-28,314,W/2-48,234);fp(ctx,f.x,f.y,Math.max(0,.13-k*.04));}ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(dx,dy);ctx.stroke();ctx.setLineDash([]);}
 else if(t<0.78){var p2=(t-.5)/.28;var pos2=bz2(p2,W/2-48,218,W/2-68,165,W/2+38,132,W/2+18,65);ax=pos2.x;ay=pos2.y;var pd2=cl(p2-.07,0,1);var dp3=bz2(pd2,W/2-48,234,W/2-68,180,W/2+38,148,W/2+18,80);dx=dp3.x;dy=dp3.y;for(var k2=1;k2<=4;k2++){var tp2=cl(pd2-k2*.07,0,1);var f2=bz2(tp2,W/2-48,234,W/2-68,180,W/2+38,148,W/2+18,80);fp(ctx,f2.x,f2.y,Math.max(0,.12-k2*.04));}}
 else{var p3=(t-.78)/.22;ax=lp(W/2+18,W/2+10,p3);ay=lp(65,36,eOut(p3));dx=lp(W/2+18,W/2+12,p3);dy=lp(80,50,eOut(p3));if(p3>0.4){var ba=Math.min(1,(p3-.4)/.3);ctx.strokeStyle="rgba(192,57,43,"+(ba*.85)+")";ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(dx,dy-12);ctx.lineTo(dx-6,dy-36);ctx.stroke();ctx.fillStyle="rgba(192,57,43,"+(ba*.8)+")";ctx.beginPath();ctx.arc(dx-6,dy-40,5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=ba*.6;ctx.fillStyle="#C0392B";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("MAIN HAUTE",dx,dy-50);ctx.globalAlpha=1;}}
 if(t<0.78)bl(ctx,ax,ay-14,8);pl(ctx,dx,dy,"D","#C0392B");pl(ctx,ax,ay,"A","#1A2E5A");
};SIT_ANIMS["3.1-1"].height=500;


// ═══ ANIMATIONS SPÉCIFIQUES C2-C5 ═══════════════════════════════

// 2.1-3 : 3v2 demi-terrain
SIT_DUR["2.1-3"]=5500;SIT_ANIMS["2.1-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var tl=Math.max(0,Math.ceil((1-t)*8));
 ctx.fillStyle=tl<=2?"rgba(192,57,43,.8)":"rgba(255,255,255,.5)";ctx.font="bold "+(tl<=2?14:12)+"px system-ui";ctx.textAlign="right";ctx.fillText(tl+"s",W-18,26);
 var ct=(t*1.4)%1;
 var a1x,a1y,a2x,a2y,a3x,a3y,d1x,d1y,d2x,d2y,bx,by;
 if(ct<0.3){var p=ct/0.3;a1x=W/2;a1y=H/2+22;a2x=lp(W/2-72,W/2-52,eOut(p));a2y=lp(H/2+40,H/2+18,eOut(p));a3x=W/2+62;a3y=H/2+26;d1x=W/2-14;d1y=lp(H/2+55,H/2+32,p);d2x=W/2+22;d2y=H/2+46;bx=a1x;by=a1y-13;}
 else if(ct<0.55){var p2=(ct-.3)/.25;a1x=W/2;a1y=H/2+22;a2x=W/2-52;a2y=H/2+18;a3x=lp(W/2+62,W/2+44,eOut(p2));a3y=lp(H/2+26,H/2+6,eOut(p2));d1x=lp(W/2-14,W/2+6,p2);d1y=H/2+32;d2x=lp(W/2+22,W/2+36,p2);d2y=lp(H/2+46,H/2+28,p2);bx=lp(a2x,a3x,eOut(p2));by=lp(a2y,a3y,p2)-Math.sin(p2*Math.PI)*9;}
 else{var p3=(ct-.55)/.45;a1x=W/2;a1y=H/2+22;a2x=W/2-52;a2y=H/2+18;a3x=lp(W/2+44,W/2+20,eOut(p3));a3y=lp(H/2+6,60,eOut(p3));d1x=W/2+6;d1y=H/2+32;d2x=W/2+36;d2y=H/2+28;bx=a3x;by=a3y-13;}
 [[d1x,d1y,a1x,a1y],[d2x,d2y,a3x,a3y]].forEach(function(v){ctx.strokeStyle="rgba(192,57,43,.15)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(v[0],v[1]);ctx.lineTo(v[2],v[3]);ctx.stroke();ctx.setLineDash([]);});
 bl(ctx,bx,by,8);pl(ctx,d1x,d1y,"D1","#C0392B",11);pl(ctx,d2x,d2y,"D2","#C0392B",11);
 pl(ctx,a2x,a2y,"A2","#1A2E5A",11);pl(ctx,a3x,a3y,"A3","#1A2E5A",11);pl(ctx,a1x,a1y,"A1","#1A2E5A",11);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("3v2 · Surnombre · Tirer en moins de 8s",W/2,H-8);
};SIT_ANIMS["2.1-3"].height=270;

// 2.2-1 : Tag et demarquage
SIT_DUR["2.2-1"]=5000;SIT_ANIMS["2.2-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=240;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.strokeRect(60,30,200,180);ctx.setLineDash([]);
 ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(60,30,200,180);
 var req={x:cl(160+Math.sin(t*Math.PI*2*1.4)*70,64,W-64),y:cl(120+Math.cos(t*Math.PI*2*1.1)*60,34,H-34)};
 var AT=[
 {bx:100,by:80,vx:1.2,vy:.9},{bx:220,by:150,vx:-.8,vy:1.1},
 {bx:130,by:180,vx:1.0,vy:-.7},{bx:240,by:70,vx:-.9,vy:.8}
 ];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(t*Math.PI*2*a.vx+i*1.4)*55,64,W-64),y:cl(a.by+Math.cos(t*Math.PI*2*a.vy+i*1.2)*45,34,H-34)};});
 ap.forEach(function(a){bl(ctx,a.x,a.y-12,6);pl(ctx,a.x,a.y,"A","#1A2E5A",11);});
 pl(ctx,req.x,req.y,"R","#C0392B",13);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("R=Requin (foulard) · A=se demarquent",W/2,H-8);
};SIT_ANIMS["2.2-1"].height=240;

// 2.2-2 : 3v3 sans dribble
SIT_DUR["2.2-2"]=5500;SIT_ANIMS["2.2-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle="rgba(255,100,100,.8)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("SANS DRIBBLE",W/2,H/2-16);
 var AT=[{bx:W/2-55,by:H/2+18,vx:.7,vy:.5},{bx:W/2+45,by:H/2+35,vx:-.6,vy:.8},{bx:W/2,by:H/2+58,vx:.9,vy:-.6}];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(t*Math.PI*2*a.vx+i)*38,18,W-18),y:cl(a.by+Math.cos(t*Math.PI*2*a.vy+i)*28,18,H-18)};});
 var dp=AT.map(function(a,i){var td=Math.max(0,t-.1);return{x:cl(a.bx+Math.sin(td*Math.PI*2*a.vx+i)*38+5,20,W-20),y:cl(a.by+Math.cos(td*Math.PI*2*a.vy+i)*28+10,20,H-20)};});
 var bi=Math.floor(t*5)%3,bni=(bi+1)%3,bp=(t*5)%1;
 bl(ctx,lp(ap[bi].x,ap[bni].x,eOut(bp)),lp(ap[bi].y,ap[bni].y,eOut(bp))-Math.sin(bp*Math.PI)*8,7);
 dp.forEach(function(d){pl(ctx,d.x,d.y,"D","#C0392B",11);});
 ap.forEach(function(a){pl(ctx,a.x,a.y,"A","#1A2E5A",11);});
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("3v3 sans dribble · Pivot + Passe uniquement",W/2,H-8);
};SIT_ANIMS["2.2-2"].height=260;

// 2.2-3 : Match 4v4
SIT_DUR["2.2-3"]=5000;SIT_ANIMS["2.2-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Match 4v4 · Défense individuelle",W/2,H-8);
};SIT_ANIMS["2.2-3"].height=260;

// 2.3-1 : Remontee 3 couloirs
SIT_DUR["2.3-1"]=5500;SIT_ANIMS["2.3-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=480;ctx.clearRect(0,0,W,H);dfc(ctx,W,H);
 var cols=[W/2-95,W/2,W/2+95];
 cols.forEach(function(cx,ci){
 ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=1;ctx.setLineDash([4,4]);
 ctx.beginPath();ctx.moveTo(cx,20);ctx.lineTo(cx,H-20);ctx.stroke();ctx.setLineDash([]);
 var tp=((t+ci*0.18)%1);
 var py=lp(H-40,30,eOut(tp));
 var role=ci===1?"M":"A";
 var col=ci===1?"#E8670A":"#1A2E5A";
 pl(ctx,cx,py,role,col,13);
 if(ci===1)bl(ctx,cx,py-16,8);
 for(var k=1;k<=3;k++){var tpast=Math.max(0,tp-k*.07);var pastY=lp(H-40,30,eOut(tpast));ctx.globalAlpha=Math.max(0,.12-k*.04);ctx.fillStyle=col;ctx.beginPath();ctx.arc(cx,pastY,10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
 });
 if(t>0.55){
 var passT=(t-0.55)/0.45;var mX=W/2,mY=lp(H-40,30,eOut(t%1));
 var targX=W/2+95,targY=lp(H-40,30,eOut(((t+0.36)%1)));
 var bx2=lp(mX,targX,eOut(passT)),by2=lp(mY,targY,passT)-Math.sin(passT*Math.PI)*20;
 if(passT<1)bl(ctx,bx2,by2,8);
 }
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("M=Meneuse · A=Ailieres · 3 couloirs",W/2,H-8);
};SIT_ANIMS["2.3-1"].height=480;

// 2.3-2 : Rebond defensif + contre-attaque
SIT_DUR["2.3-2"]=5500;SIT_ANIMS["2.3-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=480;ctx.clearRect(0,0,W,H);dfc(ctx,W,H);
 if(t<0.2){
 var p=t/0.2;
 ctx.strokeStyle="rgba(255,165,0,.8)";ctx.lineWidth=2;ctx.setLineDash([3,3]);
 var bx2=lp(W/2,W/2-30,p),by2=lp(30,lp(30,90,ease(p)),p);
 ctx.beginPath();ctx.moveTo(W/2,30);ctx.lineTo(bx2,by2);ctx.stroke();ctx.setLineDash([]);
 bl(ctx,bx2,by2,9);
 pl(ctx,W/2-55,H/2+40,"D1","#C0392B",11);pl(ctx,W/2+40,H/2+50,"D2","#C0392B",11);pl(ctx,W/2,H/2+60,"D3","#C0392B",11);
 ctx.fillStyle="rgba(255,165,0,.7)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("COACH TIRE",W/2,H/2+20);
 } else if(t<0.45){
 var p2=(t-.2)/.25;
 var bx3=lp(W/2-30,W/2-52,eOut(p2)),by3=lp(90,H/2+30,eOut(p2));
 bl(ctx,bx3,by3,9);
 pl(ctx,lp(W/2-55,W/2-52,p2),lp(H/2+40,H/2+30,p2),"D1","#C0392B",11);
 pl(ctx,W/2+40,H/2+50,"D2","#C0392B",11);pl(ctx,W/2,H/2+60,"D3","#C0392B",11);
 if(p2>0.5){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("BOXOUT !",W/2-52,H/2+14);}
 } else {
 var p3=(t-.45)/.55;
 var d1x2=lp(W/2-52,W/2-95,eOut(p3)),d1y2=lp(H/2+30,60,eOut(p3));
 var d2x2=lp(W/2+40,W/2,eOut(p3)),d2y2=lp(H/2+50,80,eOut(p3));
 var d3x2=lp(W/2,W/2+95,eOut(p3)),d3y2=lp(H/2+60,70,eOut(p3));
 var bx4=d1x2,by4=d1y2-14;
 if(p3>0.4){var pp=(p3-.4)/.6;bx4=lp(d1x2,d2x2,eOut(pp));by4=lp(d1y2-14,d2y2-14,pp)-Math.sin(pp*Math.PI)*15;}
 bl(ctx,bx4,by4,9);
 pl(ctx,d1x2,d1y2,"D1","#C0392B",11);pl(ctx,d2x2,d2y2,"D2","#C0392B",11);pl(ctx,d3x2,d3y2,"D3","#C0392B",11);
 if(p3>0.3){ctx.fillStyle="rgba(39,174,96,.8)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("CONTRE-ATTAQUE !",W/2,H/2+10);}
 }
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Rebond défensif → Contre-attaque immediate",W/2,H-8);
};SIT_ANIMS["2.3-2"].height=480;

// 2.3-3 : Match contre-attaque valorisee
SIT_DUR["2.3-3"]=5000;SIT_ANIMS["2.3-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 ctx.fillStyle="rgba(39,174,96,.8)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("Panier en -5s = x2",W/2,H-8);
};SIT_ANIMS["2.3-3"].height=260;

// 3.1-2 : 1v1 avec tir - full court
SIT_DUR["3.1-2"]=5500;SIT_ANIMS["3.1-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var ax,ay,dx,dy;
 if(t<0.3){var p=t/0.3;ax=lp(W/2-65,W/2-20,eOut(p));ay=lp(H-30,H/2+25,eOut(p));dx=W/2;dy=lp(H/2+50,H/2+45,p);bl(ctx,ax,ay-13,7);}
 else if(t<0.65){var p2=(t-.3)/.35;ax=lp(W/2-20,W/2-10,p2);ay=lp(H/2+25,80,eOut(p2));dx=lp(W/2,W/2-15,p2);dy=lp(H/2+45,90,eOut(p2));bl(ctx,ax,ay-13,7);
 ctx.strokeStyle="rgba(255,255,255,.2)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(dx,dy);ctx.stroke();ctx.setLineDash([]);}
 else{var p3=(t-.65)/.35;ax=W/2-10;ay=80;dx=W/2-15;dy=90;
 var shootT=p3,bx2=lp(ax,W/2,eOut(shootT)),by2=lp(ay-13,27,ease(shootT))-Math.sin(shootT*Math.PI)*25;
 bl(ctx,bx2,by2,7);
 if(p3>0.5){var ha=Math.min(1,(p3-.5)/.5);ctx.strokeStyle="rgba(192,57,43,"+ha+")";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dx,dy-10);ctx.lineTo(dx-4,dy-30);ctx.stroke();ctx.fillStyle="rgba(192,57,43,"+ha+")";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("MAIN HAUTE",dx-10,dy-36);}
 }
 pl(ctx,dx||W/2,dy||H/2+45,"D","#C0392B");pl(ctx,ax||W/2-65,ay||H-30,"A","#1A2E5A");
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("1v1 · A attaque · D conteste le tir",W/2,H-8);
};SIT_ANIMS["3.1-2"].height=260;

// 3.1-3 : Boxout 2v2
SIT_DUR["3.1-3"]=5000;SIT_ANIMS["3.1-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 if(t<0.3){var p=t/0.3;var bx2=lp(W/2,W/2-25,p),by2=lp(27,lp(27,80,ease(p)),p);bl(ctx,bx2,by2,9);
 ctx.fillStyle="rgba(255,165,0,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("COACH TIRE",W/2,H/2+10);}
 else{var p2=(t-.3)/.7;
 var d1x=W/2-35,d1y=H/2+20,d2x=W/2+32,d2y=H/2+25;
 var a1x=lp(W/2-28,W/2-22,p2),a1y=lp(H/2+35,H/2+22,eOut(p2));
 var a2x=lp(W/2+40,W/2+34,p2),a2y=lp(H/2+40,H/2+26,eOut(p2));
 ctx.strokeStyle="rgba(26,46,90,.3)";ctx.lineWidth=1.5;ctx.setLineDash([2,3]);
 ctx.beginPath();ctx.moveTo(a1x,a1y);ctx.lineTo(d1x,d1y);ctx.stroke();
 ctx.beginPath();ctx.moveTo(a2x,a2y);ctx.lineTo(d2x,d2y);ctx.stroke();ctx.setLineDash([]);
 if(p2>0.4){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("BOXOUT !",W/2,H/2-8);}
 var by3=lp(80,d1y-14,eOut(p2));bl(ctx,lp(W/2-25,d1x,eOut(p2)),by3,8);
 pl(ctx,d1x,d1y,"D1","#C0392B",11);pl(ctx,d2x,d2y,"D2","#C0392B",11);
 pl(ctx,a1x,a1y,"A1","#1A2E5A",11);pl(ctx,a2x,a2y,"A2","#1A2E5A",11);}
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Coach tire · D bloque A · Boxout",W/2,H-8);
};SIT_ANIMS["3.1-3"].height=260;

// 3.2-1 : Sprint retour (full court)
SIT_DUR["3.2-1"]=4500;SIT_ANIMS["3.2-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=480;ctx.clearRect(0,0,W,H);dfc(ctx,W,H);
 var startY=100;var targetY=H-35;
 if(t<0.15){ctx.fillStyle="rgba(255,165,0,.9)";ctx.font="bold 12px system-ui";ctx.textAlign="center";ctx.fillText("SIGNAL !",W/2,H/2);
 ctx.font="bold 28px system-ui";ctx.fillText("",W/2,H/2-30);}
 var positions=[W/2-80,W/2-25,W/2+30,W/2+85];
 positions.forEach(function(px,i){
 var delay=i*0.04;var tp=Math.max(0,Math.min(1,(t-0.15-delay)/0.75));
 var py=lp(startY,targetY,eOut(tp));
 for(var k=1;k<=4;k++){var tpast=Math.max(0,(t-0.15-delay-k*0.05)/0.75);var pastY=lp(startY,targetY,eOut(tpast));ctx.globalAlpha=Math.max(0,.15-k*.04);ctx.fillStyle="#C0392B";ctx.beginPath();ctx.arc(px,pastY,10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
 pl(ctx,px,py,"D","#C0392B",12);
 });
 if(t>0.7){ctx.fillStyle="rgba(39,174,96,.8)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("Position défensive !",W/2,H/2+20);}
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Signal → Sprint retour en 3 secondes",W/2,H-8);
};SIT_ANIMS["3.2-1"].height=480;

// 3.2-2 : Transition 3v3
SIT_DUR["3.2-2"]=5500;SIT_ANIMS["3.2-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var AT=[{bx:W/2-50,by:H/2+25,vx:.8,vy:.6},{bx:W/2+40,by:H/2+40,vx:-.7,vy:.9},{bx:W/2,by:H/2+60,vx:.9,vy:-.7}];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(t*Math.PI*2*a.vx+i)*40,18,W-18),y:cl(a.by+Math.cos(t*Math.PI*2*a.vy+i)*30,18,H-28)};});
 var delay=0.12;
 var dp=AT.map(function(a,i){var td=Math.max(0,t-delay);return{x:cl(a.bx+Math.sin(td*Math.PI*2*a.vx+i)*40+6,20,W-20),y:cl(a.by+Math.cos(td*Math.PI*2*a.vy+i)*30+12,20,H-30)};});
 var bi=Math.floor(t*5)%3,bni=(bi+1)%3,bp=(t*5)%1;
 bl(ctx,lp(ap[bi].x,ap[bni].x,eOut(bp)),lp(ap[bi].y,ap[bni].y,eOut(bp))-Math.sin(bp*Math.PI)*7,7);
 dp.forEach(function(d){pl(ctx,d.x,d.y,"D","#C0392B",11);});
 ap.forEach(function(a){pl(ctx,a.x,a.y,"A","#1A2E5A",11);});
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("3v3 · D reviennent avec 2s de retard",W/2,H-8);
};SIT_ANIMS["3.2-2"].height=260;

// 3.2-3 : Match retour obligatoire
SIT_DUR["3.2-3"]=5000;SIT_ANIMS["3.2-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Après chaque tir : retour défensif obligatoire",W/2,H-8);
};SIT_ANIMS["3.2-3"].height=260;

// 3.3-1 : Contest de tir - fermeture en glissade
SIT_DUR["3.3-1"]=5000;SIT_ANIMS["3.3-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 var pairs=[{ax:W/2-85,ay:130},{ax:W/2+55,ay:118},{ax:W/2-20,ay:150}];
 pairs.forEach(function(p,i){
 var ph=((t*1.5+i*0.33)%1);
 var ax=p.ax,ay=p.ay;
 var dx=ax+12,dy=ay;
 if(ph<0.4){dx=lp(ax+50,ax+12,eOut(ph/0.4));dy=lp(ay,ay,ph/0.4);}
 else if(ph<0.65){var pp=(ph-.4)/.25;dx=ax+12;dy=ay;
 if(pp>0.5){ctx.strokeStyle="rgba(192,57,43,.8)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dx,dy-10);ctx.lineTo(dx-3,dy-32);ctx.stroke();ctx.fillStyle="rgba(192,57,43,.7)";ctx.font="bold 7px system-ui";ctx.textAlign="center";ctx.fillText("MAIN HAUTE",dx-8,dy-36);}
 }
 else{var pp2=(ph-.65)/.35;dx=lp(ax+12,ax+55,p=>pp2);dy=ay;}
 pl(ctx,ax,ay,"A","#1A2E5A",10);pl(ctx,dx||ax+12,dy||ay,"D","#C0392B",10);
 bl(ctx,ax,ay-13,6);
 });
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Fermeture en glissade · Main haute",W/2,H-8);
};SIT_ANIMS["3.3-1"].height=260;

// 3.3-2 : Defense poste bas
SIT_DUR["3.3-2"]=5000;SIT_ANIMS["3.3-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 var postX=W/2-20,postY=110;var passX=W/2-75,passY=140;
 pl(ctx,postX,postY,"A","#1A2E5A",13);
 var angle=t*Math.PI*0.6-0.2;
 var dx=postX+Math.cos(angle)*20,dy=postY+Math.sin(angle)*20;
 pl(ctx,dx,dy,"D","#C0392B",12);
 ctx.strokeStyle="rgba(192,57,43,.5)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dx,dy);ctx.lineTo(passX,passY);ctx.stroke();
 if(t>0.3){ctx.fillStyle="rgba(192,57,43,.8)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("Coupe la ligne de passe",dx,dy-24);}
 pl(ctx,passX,passY,"P","#8E44AD",11);
 bl(ctx,postX+8,postY-14,7);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("D entre A et le panier · Coupe la passe",W/2,H-8);
};SIT_ANIMS["3.3-2"].height=260;

// 3.3-3 : Match 5v5 evaluation
SIT_DUR["3.3-3"]=5000;SIT_ANIMS["3.3-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Match 5v5 · Défense individuelle full court",W/2,H-8);
};SIT_ANIMS["3.3-3"].height=260;

// 4.1-1 : Fixation-passe
SIT_DUR["4.1-1"]=5500;SIT_ANIMS["4.1-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var ax,ay,dx,dy,bx2,by2,cx2,cy2=H/2+30;
 cx2=W/2+62;
 if(t<0.28){var p=t/0.28;ax=lp(W/2-75,W/2-32,eOut(p));ay=H/2+8;dx=lp(W/2-28,W/2-22,p);dy=H/2+35;bx2=ax;by2=ay-13;}
 else if(t<0.52){var p2=(t-.28)/.24;ax=W/2-32;ay=H/2+8;dx=lp(W/2-22,W/2-18,p2);dy=H/2+35;
 bx2=lp(ax,dx,eOut(p2));by2=lp(ay,dy,p2)-Math.sin(p2*Math.PI)*10;
 if(p2>0.4){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("FIXATION !",W/2-22,H/2+12);}
 }
 else if(t<0.75){var p3=(t-.52)/.23;ax=W/2-32;ay=H/2+8;dx=W/2-18;dy=H/2+35;
 bx2=lp(ax,cx2,eOut(p3));by2=lp(ay,cy2,p3)-Math.sin(p3*Math.PI)*12;
 if(p3>0.3){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("PASSE !",W/2+10,H/2-10);}
 }
 else{var p4=(t-.75)/.25;ax=W/2-32;ay=H/2+8;dx=W/2-18;dy=H/2+35;bx2=cx2;by2=cy2;
 var bx3=lp(cx2,W/2,eOut(p4)),by3=lp(cy2,42,ease(p4))-Math.sin(p4*Math.PI)*22;bl(ctx,bx3,by3,7);}
 if(t<0.75)bl(ctx,bx2,by2,7);
 pl(ctx,dx||W/2-18,dy||H/2+35,"D","#C0392B");
 pl(ctx,cx2,cy2,"B","#1A2E5A",12);
 pl(ctx,ax||W/2-75,ay||H/2+8,"A","#1A2E5A");
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("A fixe D → Passe a B demarquee",W/2,H-8);
};SIT_ANIMS["4.1-1"].height=270;

// 4.1-2 : Jeu interieur-exterieur
SIT_DUR["4.1-2"]=5500;SIT_ANIMS["4.1-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var postX=W/2,postY=108;var extX=W/2-70,extY=H/2+15;
 if(t<0.25){var p=t/0.25;bl(ctx,lp(extX,postX,eOut(p)),lp(extY,postY,p)-Math.sin(p*Math.PI)*10,8);if(p>0.5){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("PASSE INTERIEURE",W/2,extY-20);}}
 else if(t<0.55){var p2=(t-.25)/.3;bl(ctx,postX,postY-13,8);
 var coupX=lp(extX,postX-30,eOut(p2)),coupY=lp(extY,postY-30,eOut(p2));
 ctx.strokeStyle="rgba(26,46,90,.4)";ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(extX,extY);ctx.lineTo(coupX,coupY);ctx.stroke();ctx.setLineDash([]);
 pl(ctx,coupX,coupY,"E","#16A085",11);
 if(p2>0.5){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("COUPE !",coupX,coupY-20);}
 }
 else{var p3=(t-.55)/.45;
 var bx2=lp(postX,postX-30,eOut(p3)),by2=lp(postY-13,postY-35,eOut(p3));
 bl(ctx,bx2,by2,8);
 if(p3>0.4){var sp=(p3-.4)/.6;bl(ctx,lp(bx2,postX-30,eOut(sp)),lp(by2,42,ease(sp))-Math.sin(sp*Math.PI)*18,8);}
 pl(ctx,postX-30,postY-30,"E","#16A085",11);
 ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("PASSE AU COUPEUR",W/2,H/2-15);
 }
 pl(ctx,postX,postY,"P","#8E44AD",13);
 pl(ctx,extX,extY,"E","#16A085",11);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("P=Poste · E=Exterieure qui coupe",W/2,H-8);
};SIT_ANIMS["4.1-2"].height=270;

// 4.1-3 : 3v3 decalage par coupe
SIT_DUR["4.1-3"]=5500;SIT_ANIMS["4.1-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var AT=[{bx:W/2-58,by:H/2+18,vx:.6,vy:.5},{bx:W/2+50,by:H/2+28,vx:-.7,vy:.7},{bx:W/2,by:H/2+55,vx:.8,vy:-.6}];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(t*Math.PI*2*a.vx+i)*42,18,W-18),y:cl(a.by+Math.cos(t*Math.PI*2*a.vy+i)*30,18,H-18)};});
 var dp=AT.map(function(a,i){var td=Math.max(0,t-.09);return{x:cl(a.bx+Math.sin(td*Math.PI*2*a.vx+i)*42+5,20,W-20),y:cl(a.by+Math.cos(td*Math.PI*2*a.vy+i)*30+10,20,H-20)};});
 var bi=Math.floor(t*5)%3,bni=(bi+1)%3,bp=(t*5)%1;
 if(bp<0.7){ctx.strokeStyle="rgba(26,46,90,.2)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(ap[bi].x,ap[bi].y);ctx.lineTo(ap[bni].x,ap[bni].y);ctx.stroke();ctx.setLineDash([]);}
 bl(ctx,lp(ap[bi].x,ap[bni].x,eOut(bp)),lp(ap[bi].y,ap[bni].y,eOut(bp))-Math.sin(bp*Math.PI)*7,7);
 dp.forEach(function(d){pl(ctx,d.x,d.y,"D","#C0392B",11);});
 ap.forEach(function(a){pl(ctx,a.x,a.y,"A","#1A2E5A",11);});
 if(t>0.5&&t<0.7){ctx.fillStyle="rgba(39,174,96,.8)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("BONUS si tir après coupe !",W/2,H/2-12);}
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("3v3 · Décalage par coupe",W/2,H-8);
};SIT_ANIMS["4.1-3"].height=260;

// 4.2-1 : Les 5 postes
SIT_DUR["4.2-1"]=6000;SIT_ANIMS["4.2-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var postes=[
 {x:W/2,y:H-30,n:"1",l:"Meneur",c:"#E8670A"},
 {x:W/2-80,y:H/2+20,n:"2",l:"Arriere",c:"#8E44AD"},
 {x:W/2+80,y:H/2+20,n:"3",l:"Ailier",c:"#16A085"},
 {x:W/2-48,y:H/2-20,n:"4",l:"Ailier Fort",c:"#1A2E5A"},
 {x:W/2+48,y:H/2-20,n:"5",l:"Pivot",c:"#C0392B"},
 ];
 var active=Math.floor(t*5)%5;
 postes.forEach(function(p,i){
 var isA=i===active;var scale=isA?1.3:1;
 if(isA){ctx.fillStyle="rgba(255,255,255,.08)";ctx.beginPath();ctx.arc(p.x,p.y,28,0,Math.PI*2);ctx.fill();}
 pl(ctx,p.x,p.y,p.n,isA?p.c:"#555",Math.round(12*scale));
 ctx.fillStyle=isA?p.c:"rgba(255,255,255,.4)";ctx.font=(isA?"bold ":"")+"8px system-ui";ctx.textAlign="center";ctx.fillText(p.l,p.x,p.y+(isA?26:22));
 });
 var from=postes[active],to=postes[(active+1)%5];
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("5 postes · Roles et deplacements",W/2,H-8);
};SIT_ANIMS["4.2-1"].height=270;

// 4.2-2 : 4v4 avec roles
SIT_DUR["4.2-2"]=5000;SIT_ANIMS["4.2-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("4v4 · Chaque joueuse a un role",W/2,H-8);
};SIT_ANIMS["4.2-2"].height=260;

// 4.2-3 : 5v5 pression full court
SIT_DUR["4.2-3"]=5000;SIT_ANIMS["4.2-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=480;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,true);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("5v5 · Pression individuelle full court",W/2,H-8);
};SIT_ANIMS["4.2-3"].height=480;

// 4.3-1 : 3v3 transition alternance
SIT_DUR["4.3-1"]=5500;SIT_ANIMS["4.3-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var phase=t<0.5?0:1;var ct=(t*2)%1;
 var AT=[{bx:W/2-50,by:H/2+(phase?-20:20),vx:.7,vy:.5},{bx:W/2+40,by:H/2+(phase?-30:35),vx:-.6,vy:.8},{bx:W/2,by:H/2+(phase?-55:55),vx:.8,vy:-.7}];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(ct*Math.PI*2*a.vx+i)*35,18,W-18),y:cl(a.by+Math.cos(ct*Math.PI*2*a.vy+i)*25,18,H-18)};});
 var dp=AT.map(function(a,i){var td=Math.max(0,ct-.1);return{x:cl(a.bx+Math.sin(td*Math.PI*2*a.vx+i)*35+5,20,W-20),y:cl(a.by+Math.cos(td*Math.PI*2*a.vy+i)*25+10,20,H-20)};});
 var bi=Math.floor(ct*4)%3,bni=(bi+1)%3,bp=(ct*4)%1;
 bl(ctx,lp(ap[bi].x,ap[bni].x,eOut(bp)),lp(ap[bi].y,ap[bni].y,eOut(bp))-Math.sin(bp*Math.PI)*6,7);
 dp.forEach(function(d){pl(ctx,d.x,d.y,"D","#C0392B",11);});
 ap.forEach(function(a){pl(ctx,a.x,a.y,"A","#1A2E5A",11);});
 ctx.fillStyle=phase?"rgba(192,57,43,.7)":"rgba(39,174,96,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText(phase?"→ D devient A !":"Attaque →",W/2,H/2-(phase?-18:18));
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Transition instantanee après chaque panier",W/2,H-8);
};SIT_ANIMS["4.3-1"].height=260;

// 4.3-2 : Signal de transition
SIT_DUR["4.3-2"]=5000;SIT_ANIMS["4.3-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 if(Math.floor(t*3)%2===0&&t>0.2){ctx.fillStyle="rgba(255,165,0,.9)";ctx.font="bold 14px system-ui";ctx.textAlign="center";ctx.fillText("SIFFLET !",W/2,H/2-20);ctx.font="bold 22px system-ui";ctx.fillText("",W/2,H/2-40);}
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Sifflet → Inversion attaque/défense",W/2,H-8);
};SIT_ANIMS["4.3-2"].height=260;

// 4.3-3 : Match 5v5 evaluation
SIT_DUR["4.3-3"]=5000;SIT_ANIMS["4.3-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Match 5v5 · Transitions notees par coach",W/2,H-8);
};SIT_ANIMS["4.3-3"].height=260;

// 5.1-1 : Derniere action 10 secondes
SIT_DUR["5.1-1"]=5500;SIT_ANIMS["5.1-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=270;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 ctx.fillStyle="#777";ctx.fillRect(W/2-13,14,26,5);ctx.strokeStyle="#E8670A";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(W/2,27,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,14,110,65);ctx.beginPath();ctx.arc(W/2,79,42,0,Math.PI);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();ctx.setLineDash([]);
 var chrono=Math.max(0,Math.round(10-(t*10)));
 var urgent=chrono<=3;
 ctx.fillStyle=urgent?"#C0392B":"rgba(255,255,255,.8)";ctx.font="bold "+(urgent?28:22)+"px system-ui";ctx.textAlign="center";ctx.fillText(chrono+"s",W/2,H-20);
 if(urgent){ctx.globalAlpha=0.3+Math.sin(t*Math.PI*8)*0.3;ctx.strokeStyle="#C0392B";ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(10,10,W-20,H-20,10);ctx.stroke();ctx.globalAlpha=1;}
 var AT=[{bx:W/2-62,by:H/2+22},{bx:W/2+48,by:H/2+30},{bx:W/2-15,by:H/2+50},{bx:W/2+68,by:H/2+48},{bx:W/2-48,by:H/2+60}];
 var ap=AT.map(function(a,i){return{x:cl(a.bx+Math.sin(t*Math.PI*2*.8+i*1.2)*28,18,W-18),y:cl(a.by+Math.cos(t*Math.PI*2*.7+i*1.1)*20,18,H-38)};});
 var dp=AT.map(function(a,i){var td=Math.max(0,t-.08);return{x:cl(a.bx+Math.sin(td*Math.PI*2*.8+i*1.2)*28+5,20,W-20),y:cl(a.by+Math.cos(td*Math.PI*2*.7+i*1.1)*20+8,20,H-40)};});
 var bi=Math.floor(t*4)%5,bni=(bi+1)%5,bp=(t*4)%1;
 bl(ctx,lp(ap[bi].x,ap[bni].x,eOut(bp)),lp(ap[bi].y,ap[bni].y,eOut(bp))-Math.sin(bp*Math.PI)*6,7);
 dp.forEach(function(d){pl(ctx,d.x,d.y,"D","#C0392B",10);});
 ap.forEach(function(a){pl(ctx,a.x,a.y,"A","#1A2E5A",10);});
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Dernière action · Pression maximale",W/2,H/2-12);
};SIT_ANIMS["5.1-1"].height=270;

// 5.1-2 : Remise en jeu rapide
SIT_DUR["5.1-2"]=5000;SIT_ANIMS["5.1-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=480;ctx.clearRect(0,0,W,H);dfc(ctx,W,H);
 var mX=W/2,mY=H-40;
 var p1x=W/2-70,p1y=H-80;
 var p2x=W/2+60,p2y=H-70;
 var p3x=W/2,p3y=H-110;
 if(t<0.2){pl(ctx,mX,mY,"M","#E8670A",13);pl(ctx,p1x,p1y,"A","#1A2E5A",11);pl(ctx,p2x,p2y,"A","#1A2E5A",11);pl(ctx,p3x,p3y,"A","#1A2E5A",11);bl(ctx,mX,mY-15,9);}
 else if(t<0.45){var p=( t-.2)/.25;
 var dp2x=lp(p1x,W/2-40,eOut(p)),dp2y=lp(p1y,H-130,eOut(p));
 ctx.strokeStyle="rgba(26,46,90,.3)";ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(p1x,p1y);ctx.lineTo(dp2x,dp2y);ctx.stroke();ctx.setLineDash([]);
 pl(ctx,mX,mY,"M","#E8670A",13);pl(ctx,dp2x,dp2y,"A","#1A2E5A",11);pl(ctx,p2x,p2y,"A","#1A2E5A",11);pl(ctx,p3x,p3y,"A","#1A2E5A",11);
 bl(ctx,lp(mX,dp2x,eOut(p)),lp(mY-15,dp2y-13,p)-Math.sin(p*Math.PI)*15,9);
 if(p>0.6){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("DECROCHAGE !",dp2x,dp2y-24);}
 }
 else{var p2=(t-.45)/.55;
 var recX=W/2-40,recY=H-130;
 var runX=lp(recX,W/2-30,eOut(p2)),runY=lp(recY,H/2+40,eOut(p2));
 ctx.strokeStyle="rgba(26,46,90,.3)";ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(recX,recY);ctx.lineTo(runX,runY);ctx.stroke();ctx.setLineDash([]);
 pl(ctx,mX,mY,"M","#E8670A",13);pl(ctx,runX,runY,"A","#1A2E5A",11);pl(ctx,p2x,p2y,"A","#1A2E5A",11);pl(ctx,p3x,p3y,"A","#1A2E5A",11);
 bl(ctx,lp(recX,runX,eOut(p2)),lp(recY,runY,p2)-13,9);
 if(p2>0.4){ctx.fillStyle="rgba(39,174,96,.8)";ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.fillText("MONTEE RAPIDE !",W/2,H/2+25);}
 }
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Remise en jeu → Decrochage → Montee rapide",W/2,H-8);
};SIT_ANIMS["5.1-2"].height=480;

// 5.1-3 : Communication a voix haute
SIT_DUR["5.1-3"]=5000;SIT_ANIMS["5.1-3"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);gMatch(ctx,t,W,H,false);
 var coms=["A DROITE !","BALLE !","DEFENSE !","MON HOMME !","AIDE !"];
 var idx=Math.floor(t*8)%5;
 if(Math.floor(t*8)%2===0){ctx.fillStyle="rgba(255,200,0,.85)";ctx.font="bold 10px system-ui";ctx.textAlign="center";ctx.fillText(coms[idx],W/2,H/2-20);}
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Toute action annoncee a voix haute",W/2,H-8);
};SIT_ANIMS["5.1-3"].height=260;

// 5.2-1 : Tournoi 3v3
SIT_DUR["5.2-1"]=5000;SIT_ANIMS["5.2-1"]=function(ctx,t){if(!ctx)return;
 var W=320,H=260;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 // Two half courts side by side
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(W/2,14);ctx.lineTo(W/2,H-14);ctx.stroke();
 // Left court basket
 ctx.fillStyle="#777";ctx.fillRect(30,H/2-3,20,6);ctx.strokeStyle="#E8670A";ctx.lineWidth=2;ctx.beginPath();ctx.arc(50,H/2,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.strokeRect(30,H/2-32,52,64);
 // Right court basket
 ctx.fillStyle="#777";ctx.fillRect(W-50,H/2-3,20,6);ctx.strokeStyle="#E8670A";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W-50,H/2,9,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,.4)";ctx.strokeRect(W-82,H/2-32,52,64);
 // Players left court
 var lAT=[{bx:110,by:H/2-20},{bx:120,by:H/2+20},{bx:140,by:H/2}];
 var lDT=[{bx:80,by:H/2-15},{bx:82,by:H/2+18},{bx:95,by:H/2+2}];
 lAT.forEach(function(a,i){pl(ctx,cl(a.bx+Math.sin(t*Math.PI*2*.6+i)*18,58,W/2-12),cl(a.by+Math.cos(t*Math.PI*2*.5+i)*14,20,H-20),"A","#1A2E5A",10);});
 lDT.forEach(function(d,i){pl(ctx,cl(d.bx+Math.sin(t*Math.PI*2*.5+i)*15,58,W/2-12),cl(d.by+Math.cos(t*Math.PI*2*.6+i)*12,20,H-20),"D","#C0392B",10);});
 // Players right court
 var rAT=[{bx:W/2+30,by:H/2-20},{bx:W/2+20,by:H/2+20},{bx:W/2+12,by:H/2}];
 var rDT=[{bx:W/2+68,by:H/2-15},{bx:W/2+65,by:H/2+18},{bx:W/2+75,by:H/2+2}];
 rAT.forEach(function(a,i){pl(ctx,cl(a.bx+Math.sin(t*Math.PI*2*.7+i)*18,W/2+8,W-58),cl(a.by+Math.cos(t*Math.PI*2*.5+i)*14,20,H-20),"A","#16A085",10);});
 rDT.forEach(function(d,i){pl(ctx,cl(d.bx+Math.sin(t*Math.PI*2*.5+i)*15,W/2+8,W-58),cl(d.by+Math.cos(t*Math.PI*2*.7+i)*12,20,H-20),"D","#8E44AD",10);});
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Tournoi 3v3 · 2 terrains simultanement",W/2,H-8);
};SIT_ANIMS["5.2-1"].height=260;

// 5.2-2 : Bilan individuel stations
SIT_DUR["5.2-2"]=5000;SIT_ANIMS["5.2-2"]=function(ctx,t){if(!ctx)return;
 var W=320,H=240;ctx.clearRect(0,0,W,H);pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(8,8,W-16,H-16,4);ctx.stroke();
 var stations=[
 {x:W/4,y:H/2-20,label:"LF",icon:"",color:"#E8670A"},
 {x:W/2,y:H/2-20,label:"Dribble",icon:"",color:"#27AE60"},
 {x:3*W/4,y:H/2-20,label:"Auto-eval",icon:"",color:"#8E44AD"},
 ];
 var active=Math.floor(t*3*1.5)%3;
 stations.forEach(function(s,i){
 var isA=i===active;
 ctx.fillStyle=isA?"rgba(255,255,255,.12)":"rgba(255,255,255,.04)";ctx.beginPath();ctx.arc(s.x,s.y,30,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=isA?s.color:"rgba(255,255,255,.2)";ctx.lineWidth=isA?2:1;ctx.stroke();
 ctx.font=(isA?"bold ":"")+"18px system-ui";ctx.textAlign="center";ctx.fillText(s.icon,s.x,s.y+6);
 ctx.fillStyle=isA?s.color:"rgba(255,255,255,.4)";ctx.font=(isA?"bold ":"")+"8px system-ui";ctx.fillText(s.label,s.x,s.y+26);
 // Player at active station
 if(isA){pl(ctx,s.x,s.y+52,"A","#1A2E5A",10);}
 });
 ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("Stations tournantes · Bilan de saison",W/2,H-8);
};SIT_ANIMS["5.2-2"].height=240;





