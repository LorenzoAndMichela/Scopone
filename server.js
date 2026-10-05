const http=require('http'),fs=require('fs'),{WebSocketServer}=require('ws');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html;charset=utf-8'});r.end(fs.readFileSync(__dirname+'/index.html'))});
const wss=new WebSocketServer({server:srv}),rooms={};
const val=c=>c%10+1,su=c=>c/10|0,cs=c=>'A234567FCR'[c%10]+'♦♥♠♣'[su(c)];
const P={7:21,6:18,1:16,5:15,4:14,3:13,2:12,8:10,9:10,10:10};

function deal(r){
  const d=[...Array(40).keys()].sort(()=>Math.random()-.5);
  r.hands=[0,1,2,3].map(i=>d.slice(i*10,i*10+10));
  r.table=[];r.won=[[],[]];r.scope=[0,0];r.over=false;r.res=null;
  r.first=((r.first??-1)+1)%4;r.turn=r.first;r.lastTeam=0;r.log='Nuova mano';
}
function score(r){
  const p=[0,0],txt=[],w=r.won,n=w.map(x=>x.length),d=w.map(x=>x.filter(c=>su(c)==0).length);
  const pr=x=>[0,1,2,3].reduce((a,s)=>a+Math.max(0,...x.filter(c=>su(c)==s).map(c=>P[val(c)])),0);
  const pm=w.map(pr);
  for(let t=0;t<2;t++){
    const x=[];
    if(n[t]>20)x.push('carte');
    if(d[t]>5)x.push('denari');
    if(w[t].includes(6))x.push('settebello');
    if(pm[t]>pm[1-t])x.push('primiera');
    p[t]=x.length+r.scope[t];
    txt.push(`carte ${n[t]}, denari ${d[t]}, primiera ${pm[t]}, scope ${r.scope[t]}${x.length?' → '+x.join(', '):''} = ${p[t]} pt`);
  }
  r.total[0]+=p[0];r.total[1]+=p[1];r.res=txt;
}
function play(r,s,id,take){
  if(r.over||r.turn!==s||!r.seats.every(Boolean)||!r.hands[s].includes(id))return;
  const t=r.table,v=val(id),same=t.filter(c=>val(c)==v);
  take=[...new Set(take)];
  let ok;
  if(same.length)ok=take.length==1&&same.includes(take[0]);
  else if(take.length)ok=take.every(c=>t.includes(c))&&take.reduce((a,c)=>a+val(c),0)==v;
  else{
    ok=true;
    for(let m=1;m<1<<t.length;m++)if(t.reduce((a,c,i)=>a+(m>>i&1?val(c):0),0)==v){ok=false;break}
  }
  if(!ok)return;
  r.hands[s]=r.hands[s].filter(c=>c!=id);
  const team=s%2;
  r.log=`${r.names[s]} gioca ${cs(id)}`;
  if(take.length){
    r.table=t.filter(c=>!take.includes(c));
    r.won[team].push(id,...take);r.lastTeam=team;
    r.log+=` e prende ${take.map(cs).join(' ')}`;
    if(!r.table.length&&r.hands.some(h=>h.length)){r.scope[team]++;r.log+=' — SCOPA!'}
  }else r.table.push(id);
  r.turn=(s+1)%4;
  if(r.hands.every(h=>!h.length)){r.won[r.lastTeam].push(...r.table);r.table=[];r.over=true;score(r)}
}
function bc(r){
  r.seats.forEach((w,i)=>w&&w.readyState==1&&w.send(JSON.stringify({
    you:i,names:r.names,full:r.seats.every(Boolean),hand:r.hands[i],counts:r.hands.map(h=>h.length),
    table:r.table,turn:r.turn,scope:r.scope,total:r.total,over:r.over,res:r.res,log:r.log
  })));
}
wss.on('connection',ws=>{
  let r,s;
  ws.on('message',m=>{try{
    const o=JSON.parse(m);
    if(o.t=='join'){
      r=rooms[o.room];
      if(!r){r=rooms[o.room]={seats:[null,null,null,null],names:[null,null,null,null],total:[0,0]};deal(r)}
      s=r.names.findIndex((n,i)=>n==o.name&&!r.seats[i]);
      if(s<0)s=r.names.findIndex(n=>n==null);
      if(s<0){ws.send(JSON.stringify({msg:'Tavolo pieno'}));r=null;return}
      r.seats[s]=ws;r.names[s]=o.name;
    }else if(r&&o.t=='play')play(r,s,o.id,o.take||[]);
    else if(r&&o.t=='next'&&r.over)deal(r);
    if(r)bc(r);
  }catch(e){}});
  ws.on('close',()=>{if(r&&r.seats[s]===ws){r.seats[s]=null;bc(r)}});
});
srv.listen(process.env.PORT||3000);
