// Print-ready Statement of Account template (HTML + CSS) for Belgrove.
// Usage: html = renderStatementHtml(model, assets, fmt)  then HTML -> PDF with headless Chromium
// (page.pdf({ format:'A4', printBackground:true, preferCSSPageSize:true })).
// All numbers and dates arrive already computed by the ledger service. This file only lays them out.
//
// model:  see docs in opencode-statement-template-build.md, section 2 (StatementModel).
// assets: { logoSrc, stampSrc?, qrSvg?, fontFamily?, fontFaceCss? }
//   fontFamily default "'Noto Sans'". fontFaceCss must @font-face the embedded Noto Sans files
//   (Regular, Medium, SemiBold, Bold). Do NOT add fallback families in production.
// fmt:    { money(n) -> "₦6,500,000" or "-₦3,000,000" (summary, closing line),
//           cell(n)  -> "6,500,000" / "-3,000,000" inside table cells (column labels carry the ₦), "-" when n is undefined }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderStatementHtml(model, assets, fmt) {
  const m = model;
  const draft = !!m.isDraft;
  const fontFamily = assets.fontFamily || "'Noto Sans'";
  const anchorFooter = !draft && m.rows.length <= 6;       // short statements: pin footer to page bottom
  const discount = m.rows.some((r) => r.line1 === 'Discount');
  const firstLabel = discount ? 'AMOUNT PAYABLE (AFTER DISCOUNT)' : 'CONTRACT PRICE';

  const rows = m.rows.map((r) => `
      <tr>
        <td class="d">${esc(r.date)}</td>
        <td class="det"><div class="l1">${esc(r.line1)}</div>${r.line2 ? `<div class="l2">${esc(r.line2)}</div>` : ''}</td>
        <td class="n">${fmt.cell(r.charge)}</td>
        <td class="n">${fmt.cell(r.payment)}</td>
        <td class="n">${fmt.cell(r.balance)}</td>
      </tr>`).join('');

  const meta = [
    `<div>ACCOUNT: ${esc(m.accountRef)}</div>`,
    !draft && m.number ? `<div>STATEMENT: ${esc(m.number)}</div>` : '',
    `<div>GENERATED: ${esc(m.generatedOn)}</div>`,
  ].join('');

  const errors = (m.dataCheckErrors && m.dataCheckErrors.length)
    ? `<div class="dc"><b>DATA CHECK FAILED</b><ul>${m.dataCheckErrors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';

  const footer = draft ? `
    <p class="legal">This draft is for internal review and is not an issued statement.</p>` : `
    <section class="foot">
      <div class="auth">
        <div class="lbl">AUTHORIZED BY BELGROVE</div>
        <div class="stampwrap">
          ${assets.stampSrc ? `<img class="stamp" src="${assets.stampSrc}" alt="">` : ''}
          <div class="issued">Date: ${esc(m.generatedOn)}<br>Issued by Belgrove Homes accounts</div>
        </div>
      </div>
      <div class="qr">${assets.qrSvg || ''}<span>SCAN TO VERIFY</span></div>
    </section>
    <p class="legal">This statement lists payments confirmed by Belgrove Homes accounts as at the date shown. Scanning the QR code opens the issued copy of this statement for verification. Property allocation is subject to completion of the agreed payment plan. Keep this statement with your receipts.</p>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Statement of Account ${esc(m.accountRef)}${draft ? ' (DRAFT)' : ''}</title>
<meta name="generator" content="${esc(m.layoutVersion)}">
<style>
${assets.fontFaceCss || ''}
@page { size: A4; margin: 56px 56px 60px 56px;
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px ${fontFamily}; color:#A39A87; }
  ${draft ? `@bottom-left { content: "${esc(m.layoutVersion)} draft"; font: 8px ${fontFamily}; color:#A39A87; }` : ''} }
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:${fontFamily};color:#1C2B20;font-size:11px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{display:flex;flex-direction:column;${anchorFooter ? 'min-height:1003px;' : ''}}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:2px solid #C89B3C}
.brand{display:flex;gap:14px;align-items:center}
.logo{height:44px;width:auto;display:block}
.co{font-weight:700;font-size:15px;letter-spacing:.01em}
.addr{font-size:10.5px;color:#6B6252;margin-top:3px;max-width:380px;line-height:1.4}
.contact{text-align:right;font-size:10.5px;line-height:1.6}
.titlebar{display:flex;justify-content:space-between;align-items:flex-end;margin:24px 0 18px}
.draftlbl{color:#A8402B;font-weight:700;font-size:13px;letter-spacing:.06em}
h1{margin:0;font-size:27px;font-weight:700;line-height:1.15}
.meta{text-align:right;font-size:11px;color:#6B6252;line-height:1.7}
.dc{border:1px solid #A8402B;background:#FBEDE9;color:#A8402B;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:10.5px}
.dc ul{margin:4px 0 0 16px;padding:0}
.client{display:flex;gap:20px;margin-bottom:16px}
.client>div:first-child{flex:1.3}.client>div:last-child{flex:1}
.lbl{font-size:9.5px;letter-spacing:.09em;font-weight:600;color:#6B6252;margin-bottom:5px}
.cname{font-size:15px;font-weight:600;margin-bottom:3px}
.pname{font-size:13px;font-weight:600;margin-bottom:3px}
.small{font-size:11px;color:#6B6252;line-height:1.55}
.summary{display:flex;border:1px solid #E4D8C1;border-radius:6px;margin-bottom:20px;overflow:hidden}
.sum{flex:1;padding:12px 14px;border-right:1px solid #E4D8C1;background:#FDFBF7}
.sum:last-child{border-right:none;background:#16281D;color:#fff}
.sum .lbl{margin-bottom:3px}.sum:last-child .lbl{color:#E8C77A}
.sum .v{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}
col.cd{width:86px}col.cc{width:96px}col.cp{width:96px}col.cb{width:104px}
thead{display:table-header-group}
thead tr{background:#16281D}
thead th{background:transparent;color:#E8C77A;font-size:10.5px;font-weight:600;text-align:left;padding:9px 10px}
thead th.n{text-align:right}
tr{break-inside:avoid;page-break-inside:avoid}
td{padding:9px 10px;border-bottom:1px solid #E4D8C1;vertical-align:top;font-variant-numeric:tabular-nums}
tbody tr:nth-child(even) td{background:#FBF7EF}
td.n{text-align:right;white-space:nowrap}
.det .l1{font-size:11px}.det .l2{font-size:9.5px;color:#6B6252;margin-top:2px;overflow-wrap:anywhere}
tbody tr.tot td{background:#16281D;color:#E8C77A;font-weight:700;border-bottom:none}
.closing{display:flex;justify-content:space-between;align-items:baseline;margin:14px 0 6px;break-inside:avoid}
.closing .a{font-size:14.5px;font-weight:700}
.closing .ok{color:#1F6B3E;font-weight:600;margin-left:8px;font-size:11px}
.spacer{flex:1;min-height:24px}
.foot{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #E4D8C1;padding-top:16px;break-inside:avoid;margin-top:${anchorFooter ? '0' : '28px'}}
.stampwrap{display:flex;align-items:flex-end;gap:14px;margin-top:6px}
.stamp{width:148px;height:auto;display:block}
.issued{font-size:10px;color:#6B6252;line-height:1.6;white-space:nowrap}
.qr{text-align:center}.qr svg{width:104px;height:104px;display:block}
.qr span{display:block;font-size:9px;letter-spacing:.04em;color:#6B6252;margin-top:5px}
.legal{font-size:9px;color:#6B6252;line-height:1.5;margin:14px 0 0}
</style></head><body>
<div class="wrap">
  <header class="hdr">
    <div class="brand">
      <img class="logo" src="${assets.logoSrc}" alt="">
      <div><div class="co">${esc(m.company.name)}</div><div class="addr">${esc(m.company.addressLine)}</div></div>
    </div>
    <div class="contact">${esc(m.company.website)}<br>${esc(m.company.email)}<br>${esc(m.company.phone)}</div>
  </header>
  <div class="titlebar">
    <div>${draft ? '<div class="draftlbl">DRAFT, NOT ISSUED</div>' : ''}<h1>STATEMENT OF ACCOUNT</h1></div>
    <div class="meta">${meta}</div>
  </div>
  ${errors}
  <div class="client">
    <div><div class="lbl">CLIENT</div><div class="cname">${esc(m.client.name)}</div>
      <div class="small">${[m.client.phone, m.client.email].filter(Boolean).map(esc).join('<br>')}</div></div>
    <div><div class="lbl">PROPERTY</div><div class="pname">${esc(m.property.estate)}</div>
      <div class="small">${esc(m.property.unitType)}<br>${esc(m.property.sku)} · ${m.property.plots} plot${m.property.plots === 1 ? '' : 's'}</div></div>
  </div>
  <div class="summary">
    <div class="sum"><div class="lbl">${firstLabel}</div><div class="v">${fmt.money(m.summary.contractPrice)}</div></div>
    <div class="sum"><div class="lbl">TOTAL PAID</div><div class="v">${fmt.money(m.summary.totalPaid)}</div></div>
    <div class="sum"><div class="lbl">OUTSTANDING AS AT ${esc(m.asOf)}</div><div class="v">${fmt.money(m.summary.outstanding)}</div></div>
  </div>
  <table>
    <colgroup><col class="cd"><col><col class="cc"><col class="cp"><col class="cb"></colgroup>
    <thead><tr><th>Date</th><th>Details</th><th class="n">Charges (₦)</th><th class="n">Payments (₦)</th><th class="n">Balance (₦)</th></tr></thead>
    <tbody>${rows}
      <tr class="tot"><td colspan="2">Totals</td><td class="n">${fmt.cell(m.totals.charges || undefined)}</td><td class="n">${fmt.cell(m.totals.payments || undefined)}</td><td></td></tr>
    </tbody>
  </table>
  <div class="closing"><span class="small">${m.closing.credit ? 'Credit balance' : 'Closing balance'} as at ${esc(m.asOf)}${m.closing.settled ? '<span class="ok">Account settled</span>' : ''}</span><span class="a">${fmt.money(m.closing.balance)}</span></div>
  <div class="spacer"></div>
  ${footer}
</div>
</body></html>`;
}
