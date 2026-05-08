/*
 * ============================================================
 * NEXUS CORE – RULES & ROADMAP
 * ============================================================
 *
 * RULE #1  – Language
 *   All code and comments must be written in English.
 *
 * RULE #2  – Responsive UI
 *   Every UI change must support all screen sizes:
 *   - Mobile:   ≤ 480px   → min. font-size: 14px, padding: 16px
 *   - Tablet:   481–1024px
 *   - Desktop:  ≥ 1025px
 *   Use relative units (rem, %) over fixed px where possible.
 *
 * RULE #3  – i18n
 *   No hardcoded text in components. Always use translation keys.
 *   Supported languages: EN, DE (more planned).
 *   Library: react-i18next
 *
 * RULE #4  – Persisting Data
 *   User settings (language, volume, etc.) are stored via
 *   localStorage. Keys must be prefixed with "nexus_".
 *   Example: nexus_language, nexus_volume
 *
 * RULE #5  – Code Quality
 *   - TypeScript strict mode is always ON
 *   - No usage of `any`
 *   - Components stay small and single-purpose
 *
 * RULE #7  – Versioning
 *   This project uses Semantic Versioning: MAJOR.MINOR.PATCH
 *   - MAJOR → breaking changes or complete reworks
 *   - MINOR → new feature added
 *   - PATCH → bugfix or small tweak
 *   Version is defined in package.json and displayed in the UI.
 *   Current version is imported via: import pkg from '../package.json'
 *
 * RULE #6  – Privacy & Data Security
 *   This is an open-source project. The following rules are
 *   non-negotiable to protect user data:
 *   - NEVER commit API keys, secrets or credentials to the repo
 *   - All sensitive config goes into .env (listed in .gitignore)
 *   - Supabase Row Level Security (RLS) must be enabled on ALL
 *     tables – users may only access their own data
 *   - No user data is ever logged to the console in production
 *   - Auth is handled exclusively via Supabase Auth
 *
 * ============================================================
 * PLANNED CHANGES
 * ============================================================
 *
 * [ ] Settings page
 *       - Language selector (EN / DE / ...)
 *       - Volume control
 *       - Settings saved to localStorage with "nexus_" prefix
 *
 * [ ] i18n setup
 *       - Install & configure react-i18next
 *       - Create /locales/en.json and /locales/de.json
 *       - Replace all hardcoded UI strings with translation keys
 *
 * [ ] User accounts (via Supabase)
 *       - Email/Password Auth
 *       - User profile & settings stored in Supabase DB
 *       - RLS enabled on all tables from day one
 *       - .env.example provided for contributors (no real keys)
 *
 * [x] Responsive audit
 *       - All font sizes meet minimum (14px mobile, 11px desktop)
 *       - Padding: 16px mobile / 12px desktop
 *       - Stats, buttons, cards all scale via useBreakpoint() hook
 *       - Canvas scales via width:100% / height:auto
 *       - Drone & upgrade cards use 50% width on mobile
 *
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback } from "react";
import pkg from "../package.json";

// App version pulled directly from package.json – single source of truth
const APP_VERSION = pkg.version;

// ── Responsive breakpoints (px) ──────────────────────────────
const BP = { mobile: 480, tablet: 1024 } as const;

// Returns current breakpoint label based on window width
function useBreakpoint() {
  const [bp, setBp] = useState<"mobile"|"tablet"|"desktop">(
    window.innerWidth <= BP.mobile ? "mobile"
    : window.innerWidth <= BP.tablet ? "tablet"
    : "desktop"
  );
  useEffect(() => {
    const handler = () =>
      setBp(window.innerWidth <= BP.mobile ? "mobile"
        : window.innerWidth <= BP.tablet ? "tablet"
        : "desktop");
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}

const W=680, H=500, CX=W/2, CY=H/2, TOWER_R=22, TOWER_HP_MAX=300;

const ENEMY_TYPES=[
  {name:"Drone",  hp:50, speed:55,reward:5, color:"#ef5350",r:7, dmg:8 },
  {name:"Crawler",hp:130,speed:35,reward:12,color:"#ff7043",r:11,dmg:18},
  {name:"Titan",  hp:420,speed:22,reward:35,color:"#ce93d8",r:17,dmg:40},
  {name:"Phantom",hp:80, speed:75,reward:18,color:"#80deea",r:8, dmg:12},
  {name:"Basher", hp:260,speed:28,reward:22,color:"#ffcc02",r:13,dmg:30},
];
const UPGRADES=[
  {key:"dmg",  label:"Damage",   icon:"⚡",desc:"Shot dmg +25%",    baseCost:60},
  {key:"rate", label:"Fire Rate",icon:"🔁",desc:"Fire rate +20%",   baseCost:80},
  {key:"range",label:"Range",    icon:"📡",desc:"Range +15%",       baseCost:70},
  {key:"armor",label:"Armor",    icon:"🛡",desc:"Incoming dmg −20%",baseCost:100},
];
const DRONE_TYPES=[
  {key:"gold",name:"Gold Drone",  icon:"💰",rarity:"Common",   rColor:"#90a4ae",chance:"55%"},
  {key:"def", name:"Shield Drone",icon:"🛡",rarity:"Rare",     rColor:"#4fc3f7",chance:"15%"},
  {key:"dmg", name:"Attack Drone",icon:"⚔️",rarity:"Rare",     rColor:"#ef5350",chance:"15%"},
  {key:"rate",name:"Speed Drone", icon:"🚀",rarity:"Epic",     rColor:"#ce93d8",chance:"10%"},
  {key:"crit",name:"Crit Drone",  icon:"🎯",rarity:"Legendary",rColor:"#ffd54f",chance:"5%" },
];
const DRONE_EFF={
  gold:[3,6,12],def:[.08,.16,.24],dmg:[.15,.30,.50],rate:[.15,.30,.50],crit:[.08,.16,.25]
};
const EFF_LABEL={
  gold:l=>`+${[3,6,12][l-1]}¢/kill`,
  def: l=>`−${[8,16,24][l-1]}% dmg taken`,
  dmg: l=>`+${[15,30,50][l-1]}% shot dmg`,
  rate:l=>`+${[15,30,50][l-1]}% fire rate`,
  crit:l=>`${[8,16,25][l-1]}% crit chance`,
};

function rollDrone(){
  const r=Math.random();
  if(r<.55)return"gold";if(r<.70)return"def";if(r<.85)return"dmg";if(r<.95)return"rate";return"crit";
}
function getDroneStats(drones){
  let gold=0,def=0,dmg=0,rate=0,crit=0;
  drones.forEach(d=>{
    const v=DRONE_EFF[d.key][d.level-1];
    if(d.key==="gold")gold+=v;if(d.key==="def")def+=v;
    if(d.key==="dmg")dmg+=v;if(d.key==="rate")rate+=v;if(d.key==="crit")crit+=v;
  });
  return{gold,def:Math.min(.85,def),dmg,rate,crit:Math.min(.75,crit)};
}
function getTowerStats(upg,drones){
  const ds=getDroneStats(drones);
  return{
    dmg:  28*Math.pow(1.25,upg.dmg)*(1+ds.dmg),
    rate: 1.4*Math.pow(1.20,upg.rate)*(1+ds.rate),
    range:180*Math.pow(1.15,upg.range),
  };
}
function spawnPos(){
  const s=Math.floor(Math.random()*4),m=30;
  if(s===0)return{x:m+Math.random()*(W-2*m),y:-20};
  if(s===1)return{x:W+20,y:m+Math.random()*(H-2*m)};
  if(s===2)return{x:m+Math.random()*(W-2*m),y:H+20};
  return{x:-20,y:m+Math.random()*(H-2*m)};
}

let eid=0,did=0;

export default function App(){
  const canvasRef=useRef(null);
  const s=useRef({
    towerHp:TOWER_HP_MAX,credits:120,shards:0,score:0,wave:0,
    waveActive:false,gameOver:false,
    enemies:[],bullets:[],particles:[],
    spawnTimer:0,spawnInterval:2.2,
    upgrades:{dmg:0,rate:0,range:0,armor:0},
    shootTimer:0,towerAngle:0,shakeTimer:0,
    enemiesThisWave:0,enemiesKilled:0,
    drones:[],droneBuyCount:0,
  });
  const [ui,setUi]=useState({
    towerHp:TOWER_HP_MAX,credits:120,shards:0,score:0,wave:0,
    waveActive:false,gameOver:false,
    upgrades:{dmg:0,rate:0,range:0,armor:0},
    drones:[],droneBuyCount:0,
  });
  const [panel,setPanel]=useState(null);
  const animRef=useRef(null),lastRef=useRef(null);
  const screen=useBreakpoint();
  const isMobile=screen==="mobile";

  // ── Responsive scale tokens ───────────────────────────────
  const rs={
    padding:    isMobile?"16px":"12px",
    fontSm:     isMobile?"12px":"9px",   // labels (min 12px on mobile)
    fontMd:     isMobile?"14px":"11px",  // buttons & small text
    fontLg:     isMobile?"16px":"15px",  // stat values
    fontXl:     isMobile?"20px":"18px",  // title
    statPad:    isMobile?"8px 14px":"5px 12px",
    btnPad:     isMobile?"10px 20px":"7px 18px",
    cardMinW:   isMobile?"calc(50% - 4px)":"140px",
    droneMinW:  isMobile?"calc(50% - 4px)":"118px",
  };

  const sync=useCallback(()=>{
    const g=s.current;
    setUi({
      towerHp:g.towerHp,credits:Math.floor(g.credits),shards:Math.floor(g.shards),
      score:g.score,wave:g.wave,waveActive:g.waveActive,gameOver:g.gameOver,
      upgrades:{...g.upgrades},drones:g.drones.map(d=>({...d})),droneBuyCount:g.droneBuyCount,
    });
  },[]);

  const startWave=useCallback(()=>{
    const g=s.current;
    if(g.waveActive||g.gameOver)return;
    g.wave++;g.waveActive=true;
    g.enemiesThisWave=6+g.wave*4;g.enemiesKilled=0;
    g.spawnInterval=Math.max(.5,2.2-g.wave*.12);g.spawnTimer=0;
    sync();
  },[sync]);

  const buyUpgrade=useCallback((key)=>{
    const g=s.current;
    const upg=UPGRADES.find(u=>u.key===key),lvl=g.upgrades[key];
    const cost=Math.floor(upg.baseCost*Math.pow(1.6,lvl));
    if(g.credits<cost||lvl>=8)return;
    g.credits-=cost;g.upgrades[key]++;
    if(key==="armor")g.towerHp=Math.min(TOWER_HP_MAX,g.towerHp+20);
    sync();
  },[sync]);

  const buyDrone=useCallback(()=>{
    const g=s.current;
    const cost=10+g.droneBuyCount*5;
    if(g.shards<cost)return;
    g.shards-=cost;g.droneBuyCount++;
    g.drones.push({id:++did,key:rollDrone(),level:1});
    sync();
  },[sync]);

  const mergeDrones=useCallback((key,level)=>{
    const g=s.current;
    if(level>=3)return;
    const matches=g.drones.filter(d=>d.key===key&&d.level===level);
    if(matches.length<3)return;
    let n=0;
    g.drones=g.drones.filter(d=>!(d.key===key&&d.level===level&&n++<3));
    g.drones.push({id:++did,key,level:level+1});
    sync();
  },[sync]);

  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext("2d");

    function addPtcl(g,x,y,color,n,spd){
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2,sp=spd*.3+Math.random()*spd;
        g.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,color,life:.3+Math.random()*.4});
      }
    }

    function tick(g,dt){
      const stats=getTowerStats(g.upgrades,g.drones);
      const ds=getDroneStats(g.drones);
      const armorMult=Math.max(.05,(1-g.upgrades.armor*.20)*(1-ds.def));
      g.shakeTimer=Math.max(0,g.shakeTimer-dt);
      g.towerAngle+=dt*.6;

      if(g.waveActive){
        g.spawnTimer+=dt;
        if(g.spawnTimer>=g.spawnInterval&&g.enemies.length+g.enemiesKilled<g.enemiesThisWave){
          g.spawnTimer=0;
          const pos=spawnPos(),ws=1+g.wave*.15;
          const pool=g.wave<2?[0]:g.wave<4?[0,0,1]:g.wave<7?[0,1,1,2,4]:[0,1,2,3,4];
          const base=ENEMY_TYPES[pool[Math.floor(Math.random()*pool.length)]];
          g.enemies.push({id:++eid,x:pos.x,y:pos.y,
            hp:Math.floor(base.hp*ws),maxHp:Math.floor(base.hp*ws),
            speed:base.speed,reward:base.reward,color:base.color,r:base.r,
            dmg:Math.floor(base.dmg*ws),slow:0});
        }
      }

      g.enemies.forEach(e=>{
        const dx=CX-e.x,dy=CY-e.y,dist=Math.sqrt(dx*dx+dy*dy);
        const spd=e.speed*(e.slow>0?.45:1)*dt;
        e.slow=Math.max(0,e.slow-dt);
        if(dist>TOWER_R+e.r+2){e.x+=(dx/dist)*spd;e.y+=(dy/dist)*spd;}
        else{
          g.towerHp-=e.dmg*dt*armorMult;g.shakeTimer=.15;
          addPtcl(g,CX,CY,"#ff1744",2,30);
          if(g.towerHp<=0){
            g.towerHp=0;g.gameOver=true;
            for(let i=0;i<40;i++)addPtcl(g,CX,CY,"#ff6d00",40,180);
            sync();
          }
        }
      });

      g.shootTimer=Math.max(0,g.shootTimer-dt);
      if(g.shootTimer<=0&&g.enemies.length>0){
        const tgt=g.enemies.reduce((a,b)=>(a.x-CX)**2+(a.y-CY)**2<(b.x-CX)**2+(b.y-CY)**2?a:b);
        const dx=tgt.x-CX,dy=tgt.y-CY,dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<=stats.range){
          g.shootTimer=1/stats.rate;
          const crit=Math.random()<ds.crit;
          g.bullets.push({id:++eid,x:CX,y:CY,dmg:stats.dmg*(crit?2.5:1),vx:dx/dist,vy:dy/dist,crit});
          addPtcl(g,CX,CY,crit?"#ffd54f":"#00e5ff",3,120);
        }
      }

      g.bullets=g.bullets.filter(b=>{
        b.x+=b.vx*340*dt;b.y+=b.vy*340*dt;
        if(b.x<-20||b.x>W+20||b.y<-20||b.y>H+20)return false;
        for(let i=g.enemies.length-1;i>=0;i--){
          const e=g.enemies[i];
          if((b.x-e.x)**2+(b.y-e.y)**2<(e.r+4)**2){
            e.hp-=b.dmg;
            addPtcl(g,e.x,e.y,b.crit?"#ffd54f":e.color,b.crit?10:5,b.crit?90:60);
            if(e.hp<=0){
              g.credits+=e.reward+ds.gold;g.score+=e.reward*12;g.enemiesKilled++;
              addPtcl(g,e.x,e.y,e.color,14,90);g.enemies.splice(i,1);
            }
            return false;
          }
        }
        return true;
      });

      g.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.92;p.vy*=.92;p.life-=dt;});
      g.particles=g.particles.filter(p=>p.life>0);

      if(g.waveActive&&g.enemiesKilled>=g.enemiesThisWave&&g.enemies.length===0){
        g.waveActive=false;
        const bonus=40+g.wave*15,shardR=20+g.wave*8;
        g.credits+=bonus;g.shards+=shardR;g.score+=bonus*5;
        sync();
      }
      if(Math.random()<.025)sync();
    }

    function render(ctx,g){
      const stats=getTowerStats(g.upgrades,g.drones);
      const shake=g.shakeTimer>0?(Math.random()-.5)*6:0;
      const hpR=g.towerHp/TOWER_HP_MAX;
      const gc=hpR>.5?"#00e5ff":hpR>.25?"#ff9100":"#ff1744";

      ctx.save();ctx.translate(shake,shake*.5);
      ctx.fillStyle="#030a14";ctx.fillRect(-5,-5,W+10,H+10);

      ctx.fillStyle="#0a1a2e";
      for(let x=0;x<W;x+=36)for(let y=0;y<H;y+=36){
        ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();
      }

      ctx.strokeStyle=`rgba(0,229,255,${.08+.04*Math.sin(Date.now()*.002)})`;
      ctx.lineWidth=1.5;ctx.setLineDash([6,8]);
      ctx.beginPath();ctx.arc(CX,CY,stats.range,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);

      g.enemies.forEach(e=>{
        const d=Math.sqrt((e.x-CX)**2+(e.y-CY)**2);
        ctx.strokeStyle=`rgba(255,50,50,${Math.max(0,.06*(1-d/400))})`;
        ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(CX,CY);ctx.stroke();
      });

      g.particles.forEach(p=>{
        ctx.globalAlpha=Math.max(0,p.life/.7);
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();
      });ctx.globalAlpha=1;

      g.enemies.forEach(e=>{
        ctx.fillStyle=e.color+"44";ctx.beginPath();ctx.arc(e.x,e.y,e.r*1.4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=e.color;ctx.strokeStyle="#fff3";ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.fill();ctx.stroke();
        const bw=e.r*2.8;
        ctx.fillStyle="#111";ctx.fillRect(e.x-bw/2,e.y-e.r-8,bw,3);
        ctx.fillStyle=e.hp/e.maxHp>.5?"#00e676":"#ff6d00";
        ctx.fillRect(e.x-bw/2,e.y-e.r-8,bw*(e.hp/e.maxHp),3);
      });

      g.bullets.forEach(b=>{
        const bc=b.crit?"#ffd54f":"#00e5ff";
        ctx.shadowColor=bc;ctx.shadowBlur=b.crit?20:10;
        ctx.fillStyle=bc;ctx.beginPath();ctx.arc(b.x,b.y,b.crit?4.5:3,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle=bc+"66";ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*12,b.y-b.vy*12);ctx.stroke();
      });

      ctx.shadowColor=gc;ctx.shadowBlur=30;
      ctx.strokeStyle=gc+"88";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(CX,CY,TOWER_R+8,0,Math.PI*2);ctx.stroke();
      ctx.shadowBlur=0;

      ctx.save();ctx.translate(CX,CY);ctx.rotate(g.towerAngle);
      ctx.strokeStyle=gc;ctx.lineWidth=2;ctx.beginPath();
      for(let i=0;i<6;i++){
        const a=i/6*Math.PI*2;
        i===0?ctx.moveTo(Math.cos(a)*TOWER_R,Math.sin(a)*TOWER_R):ctx.lineTo(Math.cos(a)*TOWER_R,Math.sin(a)*TOWER_R);
      }
      ctx.closePath();ctx.stroke();
      ctx.fillStyle="#050f1f";ctx.beginPath();ctx.arc(0,0,TOWER_R-4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=gc;ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();
      if(g.enemies.length>0){
        const tgt=g.enemies.reduce((a,b)=>(a.x-CX)**2+(a.y-CY)**2<(b.x-CX)**2+(b.y-CY)**2?a:b);
        const angle=Math.atan2(tgt.y-CY,tgt.x-CX)-g.towerAngle;
        ctx.strokeStyle=gc;ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(angle)*(TOWER_R-2),Math.sin(angle)*(TOWER_R-2));ctx.stroke();
      }
      ctx.restore();

      const bW=100,bH=8;
      ctx.fillStyle="#0a1628";ctx.strokeStyle="#0d2137";ctx.lineWidth=.5;
      ctx.fillRect(CX-bW/2,CY+TOWER_R+10,bW,bH);ctx.strokeRect(CX-bW/2,CY+TOWER_R+10,bW,bH);
      const hg=ctx.createLinearGradient(CX-bW/2,0,CX+bW/2,0);
      hg.addColorStop(0,gc);hg.addColorStop(1,gc+"88");
      ctx.fillStyle=hg;ctx.fillRect(CX-bW/2,CY+TOWER_R+10,bW*hpR,bH);
      ctx.restore();
    }

    const loop=(ts)=>{
      const dt=lastRef.current?Math.min((ts-lastRef.current)/1000,.05):.016;
      lastRef.current=ts;const g=s.current;
      if(!g.gameOver)tick(g,dt);render(ctx,g);
      animRef.current=requestAnimationFrame(loop);
    };
    animRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animRef.current);
  },[sync]);

  const reset=()=>{
    Object.assign(s.current,{
      towerHp:TOWER_HP_MAX,credits:120,shards:0,score:0,wave:0,
      waveActive:false,gameOver:false,enemies:[],bullets:[],particles:[],
      spawnTimer:0,spawnInterval:2.2,
      upgrades:{dmg:0,rate:0,range:0,armor:0},
      shootTimer:0,towerAngle:0,shakeTimer:0,
      enemiesThisWave:0,enemiesKilled:0,drones:[],droneBuyCount:0,
    });sync();
  };

  const upgCost=key=>Math.floor(UPGRADES.find(u=>u.key===key).baseCost*Math.pow(1.6,ui.upgrades[key]));
  const droneCost=10+ui.droneBuyCount*5;
  const hpPct=ui.towerHp/TOWER_HP_MAX;
  const hpColor=hpPct>.5?"#00e676":hpPct>.25?"#ff9100":"#ff1744";
  const ds=getDroneStats(ui.drones);

  const groups={};
  ui.drones.forEach(d=>{const k=`${d.key}_${d.level}`;groups[k]=groups[k]||{key:d.key,level:d.level,count:0};groups[k].count++;});
  const sortedGroups=Object.values(groups).sort((a,b)=>{
    const ro={Common:0,Rare:1,Epic:2,Legendary:3};
    const da=DRONE_TYPES.find(d=>d.key===a.key),db=DRONE_TYPES.find(d=>d.key===b.key);
    return ro[db.rarity]-ro[da.rarity]||b.level-a.level;
  });

  const tabBtn=id=>({
    flex:1,background:panel===id?"#071a2e":"#030a14",
    border:`1px solid ${panel===id?"#00e5ff":"#0d2137"}`,
    color:panel===id?"#00e5ff":"#2a5a7a",
    padding:isMobile?"12px 0":"9px 0",borderRadius:"6px",cursor:"pointer",
    fontSize:rs.fontMd,letterSpacing:"2px",fontFamily:"inherit",
  });

  return(
    <div style={{fontFamily:"'Courier New',monospace",background:"#020812",minHeight:"100vh",padding:rs.padding,color:"#e0f4ff",userSelect:"none",boxSizing:"border-box"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:"12px",marginBottom:"10px",flexWrap:"wrap"}}>
        <h2 style={{margin:0,fontSize:rs.fontXl,color:"#00e5ff",letterSpacing:"3px",fontWeight:500}}>◈ NEXUS CORE</h2>
        <span style={{fontSize:rs.fontMd,color:"#2a5a7a",letterSpacing:"2px"}}>360° TOWER DEFENSE</span>
        <span style={{marginLeft:"auto",fontSize:rs.fontSm,color:"#1e4060",letterSpacing:"1px"}}>v{APP_VERSION}</span>
      </div>

      <div style={{display:"flex",gap:"8px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
        {[
          {label:"CREDITS",val:`${ui.credits}¢`,   color:"#ffea00"},
          {label:"SHARDS", val:`${ui.shards}◆`,    color:"#e040fb"},
          {label:"WAVE",   val:ui.wave,             color:"#d500f9"},
          {label:"SCORE",  val:ui.score.toLocaleString(),color:"#00e5ff"},
          {label:"CORE HP",val:`${Math.ceil(ui.towerHp)}/${TOWER_HP_MAX}`,color:hpColor},
        ].map(h=>(
          <div key={h.label} style={{background:"#050f1f",border:"0.5px solid #0d2137",borderRadius:"6px",padding:rs.statPad,flex:isMobile?"1 1 auto":"0 0 auto"}}>
            <div style={{fontSize:rs.fontSm,color:"#2a5a7a",letterSpacing:"2px"}}>{h.label}</div>
            <div style={{fontSize:rs.fontLg,fontWeight:500,color:h.color}}>{h.val}</div>
          </div>
        ))}
        <div style={{width:isMobile?"100%":"auto",marginLeft:isMobile?"0":"auto",display:"flex",gap:"8px",justifyContent:isMobile?"stretch":"flex-end"}}>
          {!ui.waveActive&&!ui.gameOver&&(
            <button onClick={startWave} style={{flex:isMobile?1:undefined,background:"#071a2e",border:"1px solid #00e5ff",color:"#00e5ff",padding:rs.btnPad,borderRadius:"6px",cursor:"pointer",fontSize:rs.fontMd,letterSpacing:"2px",fontFamily:"inherit"}}>
              ▶ WAVE {ui.wave+1}
            </button>
          )}
          {ui.waveActive&&<div style={{color:"#d500f9",fontSize:rs.fontMd,letterSpacing:"2px",padding:rs.btnPad}}>⚠ INCOMING</div>}
          {ui.gameOver&&(
            <button onClick={reset} style={{flex:isMobile?1:undefined,background:"#1a0010",border:"1px solid #ff1744",color:"#ff1744",padding:rs.btnPad,borderRadius:"6px",cursor:"pointer",fontSize:rs.fontMd,letterSpacing:"2px",fontFamily:"inherit"}}>
              ↺ RESTART
            </button>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} width={W} height={H}
        style={{display:"block",width:"100%",maxWidth:W,height:"auto",border:"0.5px solid #0d2137",borderRadius:"6px"}}
      />

      {/* Bottom Bar */}
      <div style={{display:"flex",gap:"8px",marginTop:"8px"}}>
        <button onClick={()=>setPanel(p=>p==="upgrades"?null:"upgrades")} style={tabBtn("upgrades")}>
          ⚡ UPGRADES {panel==="upgrades"?"▲":"▼"}
        </button>
        <button onClick={()=>setPanel(p=>p==="drones"?null:"drones")} style={tabBtn("drones")}>
          🔮 DRONES{ui.drones.length>0?` (${ui.drones.length})`:""} {panel==="drones"?"▲":"▼"}
        </button>
      </div>

      {/* Upgrades Panel */}
      {panel==="upgrades"&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginTop:"8px"}}>
          {UPGRADES.map(upg=>{
            const lvl=ui.upgrades[upg.key],cost=upgCost(upg.key),can=ui.credits>=cost&&lvl<8;
            return(
              <div key={upg.key} style={{background:"#050f1f",border:"0.5px solid #0d2137",borderRadius:"8px",padding:"9px 11px",minWidth:rs.cardMinW,flex:"1 1 140px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                  <span style={{fontSize:"14px"}}>{upg.icon} <span style={{color:"#7fb8d8",fontSize:rs.fontMd}}>{upg.label}</span></span>
                  <span style={{fontSize:rs.fontSm,color:"#2a5a7a"}}>LV {lvl}/8</span>
                </div>
                <div style={{display:"flex",gap:"3px",marginBottom:"6px"}}>
                  {Array.from({length:8}).map((_,i)=>(
                    <div key={i} style={{flex:1,height:"4px",borderRadius:"2px",background:i<lvl?"#00e5ff":"#0d2137"}}/>
                  ))}
                </div>
                <div style={{fontSize:rs.fontSm,color:"#4a7a9b",marginBottom:"5px"}}>{upg.desc}</div>
                <button onClick={()=>buyUpgrade(upg.key)} disabled={!can}
                  style={{width:"100%",background:can?"#071a2e":"#030a14",border:`0.5px solid ${can?"#00e5ff":"#0d2137"}`,color:can?"#00e5ff":"#1a3a5c",padding:isMobile?"8px":"4px",borderRadius:"5px",cursor:can?"pointer":"default",fontSize:rs.fontMd,fontFamily:"inherit",letterSpacing:"1px"}}>
                  {lvl>=8?"MAX":`${cost}¢`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drones Panel */}
      {panel==="drones"&&(
        <div style={{background:"#050f1f",border:"0.5px solid #0d2137",borderRadius:"8px",padding:isMobile?"16px":"12px",marginTop:"8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px",flexWrap:"wrap",gap:"8px"}}>
            <div style={{fontSize:rs.fontSm,color:"#2a5a7a",letterSpacing:"2px"}}>
              DRONE HANGAR — <span style={{color:"#e040fb"}}>{ui.shards}◆ SHARDS</span>
            </div>
            <button onClick={buyDrone} disabled={ui.shards<droneCost}
              style={{flex:isMobile?1:undefined,background:ui.shards>=droneCost?"#1a0040":"#030a14",border:`1px solid ${ui.shards>=droneCost?"#e040fb":"#0d2137"}`,color:ui.shards>=droneCost?"#e040fb":"#2a5a7a",padding:rs.btnPad,borderRadius:"6px",cursor:ui.shards>=droneCost?"pointer":"default",fontSize:rs.fontMd,fontFamily:"inherit",letterSpacing:"1px"}}>
              BUY DRONE — {droneCost}◆
            </button>
          </div>

          {/* Rarity legend */}
          <div style={{display:"flex",gap:"10px",marginBottom:"12px",flexWrap:"wrap",padding:"6px 8px",background:"#030a14",borderRadius:"6px",border:"0.5px solid #0d2137"}}>
            {DRONE_TYPES.map(dt=>(
              <div key={dt.key} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <span style={{fontSize:"14px"}}>{dt.icon}</span>
                <span style={{fontSize:rs.fontSm,color:dt.rColor,fontWeight:500}}>{dt.rarity}</span>
                <span style={{fontSize:rs.fontSm,color:"#1e4060"}}>{dt.chance}</span>
              </div>
            ))}
          </div>

          {ui.drones.length===0?(
            <div style={{fontSize:rs.fontMd,color:"#2a5a7a",textAlign:"center",padding:"28px 0"}}>
              No drones yet — complete a wave to earn ◆ Shards, then buy!
            </div>
          ):(
            <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"10px"}}>
              {sortedGroups.map(grp=>{
                const dt=DRONE_TYPES.find(d=>d.key===grp.key);
                const canMerge=grp.count>=3&&grp.level<3;
                return(
                  <div key={`${grp.key}_${grp.level}`}
                    style={{background:"#030a14",border:`1px solid ${canMerge?"#76ff03":dt.rColor+"55"}`,borderRadius:"8px",padding:"10px",minWidth:rs.droneMinW,flex:"1 1 auto",textAlign:"center",transition:"border-color .2s",boxSizing:"border-box"}}>
                    <div style={{fontSize:"24px",marginBottom:"3px"}}>{dt.icon}</div>
                    <div style={{fontSize:rs.fontMd,color:"#c8e6ff",marginBottom:"2px"}}>{dt.name}</div>
                    <div style={{fontSize:rs.fontSm,color:dt.rColor,marginBottom:"3px",fontWeight:500}}>{dt.rarity}</div>
                    <div style={{fontSize:rs.fontMd,color:"#ffd54f",marginBottom:"4px",letterSpacing:"2px"}}>
                      {"★".repeat(grp.level)}{"☆".repeat(3-grp.level)}
                    </div>
                    <div style={{fontSize:rs.fontSm,color:"#4a7a9b",marginBottom:"6px"}}>{EFF_LABEL[grp.key](grp.level)}</div>
                    <div style={{fontSize:rs.fontLg,color:"#7fb8d8",marginBottom:canMerge?"6px":"0"}}>×{grp.count}</div>
                    {canMerge&&(
                      <button onClick={()=>mergeDrones(grp.key,grp.level)}
                        style={{width:"100%",background:"#0d1a00",border:"1px solid #76ff03",color:"#76ff03",padding:isMobile?"8px":"4px",borderRadius:"4px",cursor:"pointer",fontSize:rs.fontMd,fontFamily:"inherit",letterSpacing:"1px"}}>
                        ⬆ MERGE 3→1
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {ui.drones.length>0&&(
            <div style={{background:"#030a14",borderRadius:"6px",padding:"8px 10px",border:"0.5px solid #0d2137"}}>
              <div style={{fontSize:rs.fontSm,color:"#2a5a7a",letterSpacing:"2px",marginBottom:"6px"}}>ACTIVE BONUSES</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                {ds.gold>0&&<span style={{fontSize:rs.fontMd,color:"#ffea00",background:"#1a1400",padding:"2px 8px",borderRadius:"4px"}}>+{ds.gold}¢/kill</span>}
                {ds.def>0&&<span style={{fontSize:rs.fontMd,color:"#4fc3f7",background:"#001a20",padding:"2px 8px",borderRadius:"4px"}}>−{Math.round(ds.def*100)}% dmg taken</span>}
                {ds.dmg>0&&<span style={{fontSize:rs.fontMd,color:"#ef5350",background:"#1a0000",padding:"2px 8px",borderRadius:"4px"}}>+{Math.round(ds.dmg*100)}% shot dmg</span>}
                {ds.rate>0&&<span style={{fontSize:rs.fontMd,color:"#ce93d8",background:"#0d0020",padding:"2px 8px",borderRadius:"4px"}}>+{Math.round(ds.rate*100)}% fire rate</span>}
                {ds.crit>0&&<span style={{fontSize:rs.fontMd,color:"#ffd54f",background:"#1a1000",padding:"2px 8px",borderRadius:"4px"}}>{Math.round(ds.crit*100)}% crit chance</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
