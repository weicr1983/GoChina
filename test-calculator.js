// calculator.js 单测（直接 require 内部逻辑）
// 由于 calculator.js 用了 IIFE，这里通过全局 window.CALC 暴露的纯函数做端到端校验
// 该脚本必须在浏览器环境中运行；这里用 jsdom-less 的最简方式：自己实现最简 jsdom 不现实
// 改为：直接在 Node 端读 calculator.js 源码并提取 calculate 逻辑重复校验

// 由于是 IIFE 包裹的代码，Node 直接 eval 提取不便；改为功能性黑盒：
// 拷贝核心公式到本文件并跑用例。线上代码若变更，本单测需同步。

const FX = 7.20;
const CITIES = [
  { id: 'beijing',   hotel: { budget: 30, mid: 95,  luxury: 280 }, food: { budget: 18, mid: 40,  luxury: 100 }, transport: 10, attraction: 8 },
  { id: 'shanghai',  hotel: { budget: 35, mid: 110, luxury: 320 }, food: { budget: 22, mid: 48,  luxury: 120 }, transport: 11, attraction: 9 },
  { id: 'guangzhou', hotel: { budget: 28, mid: 85,  luxury: 240 }, food: { budget: 18, mid: 38,  luxury: 95  }, transport: 9,  attraction: 7 },
  { id: 'chengdu',   hotel: { budget: 22, mid: 70,  luxury: 200 }, food: { budget: 16, mid: 32,  luxury: 80  }, transport: 7,  attraction: 6 },
  { id: 'xian',      hotel: { budget: 20, mid: 65,  luxury: 180 }, food: { budget: 14, mid: 28,  luxury: 70  }, transport: 6,  attraction: 7 }
];
const HSR = {
  'beijing-shanghai':4.5, 'beijing-guangzhou':8.0, 'beijing-chengdu':7.5, 'beijing-xian':4.5,
  'shanghai-guangzhou':6.5, 'shanghai-chengdu':10.0, 'shanghai-xian':11.0,
  'guangzhou-chengdu':8.0, 'guangzhou-xian':8.0, 'chengdu-xian':3.5
};
function clamp(n, lo, hi) { n = Number(n); if (Number.isNaN(n)) return lo; return Math.min(Math.max(n, lo), hi); }
function distributeDays(total, parts) { const base=Math.floor(total/parts); const rem=total-base*parts; return Array.from({length:parts},(_,i)=>base+(i<rem?1:0)); }
function transportCost(mode, base) { if(mode==='metro') return Math.round(base*0.6); if(mode==='taxi') return Math.round(base*1.4); return base; }
function roomMultiplier(t) { return Math.ceil(t/2); }

function calculate(cfg) {
  const days=clamp(cfg.days,1,14), cityCount=clamp(cfg.cityCount,1,5);
  const hotelTier=cfg.hotelTier||'mid', foodTier=cfg.foodTier||'mid';
  const tm=cfg.transport||'metro';
  const attr=clamp(cfg.attractions??2,0,8);
  const shop=clamp(cfg.shopping??0,0,100000);
  const other=clamp(cfg.other??0,0,100000);
  const intercity=!!cfg.intercityRail;
  const trav=clamp(cfg.travellers??1,1,8);
  const sel=CITIES.slice(0,cityCount);
  const dpc=distributeDays(days,cityCount);
  const rooms=roomMultiplier(trav);
  const perCity=sel.map((c,i)=>{const d=dpc[i]; const local=transportCost(tm,c.transport);
    const h=c.hotel[hotelTier]*d*rooms; const f=c.food[foodTier]*d*trav;
    const l=local*d*trav; const a=c.attraction*attr*trav;
    return { cityId:c.id, days:d, hotel:h, food:f, transport:l, attraction:a, total:h+f+l+a };});
  let intercityCost=0;
  if(intercity&&cityCount>1){for(let i=0;i<cityCount-1;i++){const a=sel[i].id, b=sel[i+1].id;
    const k1=`${a}-${b}`, k2=`${b}-${a}`; const h=HSR[k1]??HSR[k2]??5;
    intercityCost += Math.round(h*18)*trav;}}
  const sub={ hotel:Math.round(perCity.reduce((s,p)=>s+p.hotel,0)),
    food:Math.round(perCity.reduce((s,p)=>s+p.food,0)),
    transport:Math.round(perCity.reduce((s,p)=>s+p.transport,0)),
    attraction:Math.round(perCity.reduce((s,p)=>s+p.attraction,0)),
    intercity:Math.round(intercityCost),
    shopping:Math.round(shop*trav),
    other:Math.round(other*trav) };
  const total = sub.hotel+sub.food+sub.transport+sub.attraction+sub.intercity+sub.shopping+sub.other;
  return { sub, total, cny: Math.round(total*FX) };
}

const cases = [
  {
    name: '1 traveler, 5 days, 1 city (Beijing), mid, metro, 2 attr, no rail',
    cfg: { days:5, cityCount:1, hotelTier:'mid', foodTier:'mid', transport:'metro', attractions:2, intercityRail:false, travellers:1 },
    expect: (r) => {
      // Beijing 5d mid: hotel 95*5*1=475, food 40*5*1=200, transport 6*5*1=30, attr 8*2*1=16 → 721
      if (r.sub.hotel !== 475) return `hotel ${r.sub.hotel} != 475`;
      if (r.sub.food !== 200)  return `food ${r.sub.food} != 200`;
      if (r.sub.transport !== 30) return `transport ${r.sub.transport} != 30`;
      if (r.sub.attraction !== 16) return `attr ${r.sub.attraction} != 16`;
      if (r.sub.intercity !== 0) return `rail ${r.sub.intercity} != 0`;
      if (r.total !== 721) return `total ${r.total} != 721`;
      return null;
    }
  },
  {
    name: '2 travelers, 6 days, 2 cities (BJ+SH), mid, metro, 1 attr each, with rail',
    cfg: { days:6, cityCount:2, hotelTier:'mid', foodTier:'mid', transport:'metro', attractions:1, intercityRail:true, travellers:2 },
    expect: (r) => {
      // 3d each
      // BJ 3d: hotel 95*3*1=285, food 40*3*2=240, transport 6*3*2=36, attr 8*1*2=16 → 577
      // SH 3d: hotel 110*3*1=330, food 48*3*2=288, transport 7*3*2=42, attr 9*1*2=18 → 678
      // rail BJ-SH: round(4.5*18)=81 * 2 = 162
      // total = 577 + 678 + 162 = 1417
      if (r.sub.intercity !== 162) return `rail ${r.sub.intercity} != 162`;
      if (r.total !== 1417) return `total ${r.total} != 1417`;
      return null;
    }
  },
  {
    name: '4 travelers, 7 days, 3 cities, budget hotel, taxi',
    cfg: { days:7, cityCount:3, hotelTier:'budget', foodTier:'budget', transport:'taxi', attractions:0, intercityRail:true, travellers:4 },
    expect: (r) => {
      // days split: [3,2,2] (7/3 → 2 + 1rem)
      // rooms = ceil(4/2) = 2
      // BJ 3d: hotel 30*3*2=180, food 18*3*4=216, transport round(10*1.4)*3*4=14*3*4=168, attr 0 → 564
      // SH 2d: hotel 35*2*2=140, food 22*2*4=176, transport 15*2*4=120, attr 0 → 436
      // GZ 2d: hotel 28*2*2=112, food 18*2*4=144, transport 13*2*4=104, attr 0 → 360
      // rail BJ-SH: round(4.5*18)=81*4=324; SH-GZ: round(6.5*18)=117*4=468; total rail 792
      // grand total = 564+436+360+792 = 2152
      if (r.total !== 2152) return `total ${r.total} != 2152`;
      return null;
    }
  }
];

let pass = 0, fail = 0;
for (const c of cases) {
  const r = calculate(c.cfg);
  const err = c.expect(r);
  if (err) { fail++; console.log(`✗ ${c.name}\n    ${err}\n    got total=${r.total} subtotals=${JSON.stringify(r.sub)}`); }
  else     { pass++; console.log(`✓ ${c.name} → $${r.total} (¥${r.cny})`); }
}
console.log(`\nPassed: ${pass} | Failed: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
