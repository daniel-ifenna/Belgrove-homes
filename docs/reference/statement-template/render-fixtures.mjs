import fs from 'fs';
import { renderStatementHtml } from '/mnt/user-data/outputs/statement-template/statement-html.mjs';
const qrSvg = fs.readFileSync('/home/claude/qr.svg','utf8');
const stampB64 = fs.readFileSync('/home/claude/stamp_b64.txt','utf8');
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><g fill="#E8A53A" transform="skewX(-14) translate(9 0)"><rect x="8" y="0" width="20" height="18" rx="3"/><rect x="16" y="22" width="22" height="20" rx="3"/><rect x="-6" y="22" width="18" height="20" rx="3"/></g></svg>`;
const assets = { logoSrc: 'data:image/svg+xml;base64,'+Buffer.from(logoSvg).toString('base64'), stampSrc:'data:image/png;base64,'+stampB64, qrSvg, fontFamily: "'FreeSans'" };
const money = n => (n<0?'-':'')+'₦'+Math.abs(n).toLocaleString('en-US');
const cell = n => n==null ? '-' : (n<0?'-':'')+Math.abs(n).toLocaleString('en-US');
const fmt = { money, cell };
const company = { name:'BELGROVE HOMES AND PROPERTIES LIMITED', addressLine:'Suite 25, Lebrex Plaza, 47 Ajose Adeogun St, Utako, Abuja 900108, Federal Capital Territory', website:'www.belgrovehomes.com', email:'info@belgrovehomes.com', phone:'+234 8103760063' };
const base = { company, accountRef:'TXN-2026-62831', generatedOn:'12-10-2026', asOf:'12-10-2026', client:{name:'Valentine Nzube Onweluzo', phone:'+2348163736226', email:'valentinenzonweluzo93@gmail.com'}, property:{estate:'Sunrise Estate', unitType:'5-Bedroom Fully-Detached Duplex + BQ', sku:'SUN-P1-500SQM', plots:1}, layoutVersion:'stmt-v1' };
function ledger(price, pays){ let bal=price; const rows=[{date:'09-08-2026',line1:'Contract price',line2:'Sunrise Estate, SUN-P1-500SQM',charge:price,balance:bal}];
  for(const p of pays){ bal-=p.amt; rows.push({date:p.date,line1:'Payment received, Bank Transfer',line2:[p.ref&&('Ref '+p.ref),p.rc&&('Receipt '+p.rc)].filter(Boolean).join(' · ')||undefined,payment:p.amt,balance:bal}); }
  const paid=pays.reduce((a,p)=>a+p.amt,0); return { rows, totals:{charges:price,payments:paid}, summary:{contractPrice:price,totalPaid:paid,outstanding:bal}, closing:{balance:bal,settled:bal===0,credit:bal<0} } }
const pays4=[{date:'09-08-2026',amt:3000000,ref:'262220980712',rc:'RCT-2026-79860'},{date:'12-08-2026',amt:3000000,ref:'262240986795',rc:'RCT-2026-31207'},{date:'19-08-2026',amt:3000000,ref:'2623210148410',rc:'RCT-2026-83436'},{date:'24-09-2026',amt:3000000,rc:'RCT-2026-45918'}];
const issued = {...base, isDraft:false, number:'STM-2026-00014', ...ledger(18500000,pays4)};
const draft = {...base, isDraft:true, ...ledger(18500000,pays4)};
const many = Array.from({length:40},(_,i)=>({date:`${String(1+(i%28)).padStart(2,'0')}-${String(9+Math.floor(i/28)).padStart(2,'0')}-2026`,amt:200000,ref:'26'+(2200000000+i*7919),rc:'RCT-2026-'+(10000+i*13)}));
const big = {...base, isDraft:false, number:'STM-2026-00015', ...ledger(18500000,many)};
const bad = {...draft, dataCheckErrors:['Contract date not set: charge dated after the first payment.','Payment 12-08-2026 date not matched to the bank statement.']};
for (const [n,m] of Object.entries({issued,draft,big,bad})) fs.writeFileSync(`${n}.html`, renderStatementHtml(m, assets, fmt));
fs.writeFileSync('/mnt/user-data/outputs/statement-template/fixture-62831.json', JSON.stringify(issued,null,2));
console.log('ok');
