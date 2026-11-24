// ===== 事前調査（査察の下準備） =====
// 点検結果報告書・届出の状況などを入力し、査察で指摘が見込まれる事項と根拠法令を事前に把握する。
function preOf(o){
  o.pre = o.pre || {};
  const p = o.pre;
  p.ext = p.ext || []; p.hose = p.hose || []; p.defects = p.defects || []; p.equip = p.equip || {};
  return p;
}
const addYears = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return `${y + n}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const ymd = iso => iso ? wareki(iso) : '';

// 予想される指摘を計算する。kind: ng=指摘見込み、chk=現地で要確認
function preFindings(o){
  const p = preOf(o), ref = p.planDate || today(), refY = +ref.slice(0, 4);
  const j = judge(o), tok = !!USE[o.use]?.tok, out = [];
  const add = (kind, text, basis, why, key) => out.push({ kind, text, basis, why, key });

  // 防火管理
  if (has(j, '防火管理者の選任・消防計画')) {
    if (p.fm === 'none') add('ng', '防火管理者を選任し、防火管理者選任（解任）届出書を提出すること', '消防法8条1項・2項', '防火管理者の選任届出なし', 'fm');
    if (p.plan === 'none') add('ng', '消防計画を作成し、届け出ること', '消防法8条1項、規則3条1項', '消防計画の届出なし', 'plan');
    if (p.plan === 'old') add('chk', '消防計画の内容が現況（用途・管理体制）と合っているか確認', '消防法8条1項、規則3条', '消防計画の届出が古い', 'plan2');
    if (tok && p.drill === 'none') add('ng', '消火訓練及び避難訓練を年2回以上実施すること', '規則3条10項', '訓練の実施（通報）記録なし', 'drill');
  }
  // 消防用設備等の点検報告
  if (!p.report) add('chk', '消防用設備等の点検結果報告の提出状況を確認', '消防法17条の3の3', '点検結果報告書の提出日が未入力', 'rep0');
  else {
    const per = tok ? 1 : 3, due = addYears(p.report, per);
    if (ref > due) add('ng', '消防用設備等を定期に点検し、その結果を報告すること', '消防法17条の3の3、規則31条の6第3項', `前回報告 ${ymd(p.report)}、報告期間（${tok ? '特定用途：1年に1回' : '非特定用途：3年に1回'}）を経過（${ymd(due)}）`, 'rep');
  }
  // 防火対象物定期点検報告
  if (has(j, '防火対象物定期点検報告')) {
    if (!p.fpReport) add('chk', '防火対象物定期点検報告の提出状況を確認', '消防法8条の2の2', '防火対象物点検報告の提出日が未入力', 'fp0');
    else if (ref > addYears(p.fpReport, 1)) add('ng', '防火対象物点検資格者に点検させ、その結果を報告すること', '消防法8条の2の2', `前回報告 ${ymd(p.fpReport)} から1年を経過`, 'fp');
  }
  // 設備の設置状況
  for (const r of j) {
    if (r.cat === '防火管理等' || r.status === 'no') continue;
    if (p.equip[r.name] === 'none') add(r.status === 'req' ? 'ng' : 'chk', `${r.name}を技術上の基準に従って設置すること`, `消防法17条1項、${r.basis}`, `設置義務：${r.reason}${publicationTargets(o, j).includes(r.name) ? '（公表制度の対象）' : ''}`, 'eq:' + r.name);
  }
  // 消火器
  p.ext.forEach((e, i) => {
    const y = +e.year; if (!y) return;
    const label = `消火器${e.place ? '（' + e.place + '）' : ''} ${y}年製${e.count ? ' ' + e.count + '本' : ''}`;
    if (y <= 2011 && e.std !== 'new') add(e.std === 'old' ? 'ng' : 'chk', e.std === 'old' ? '旧規格の消火器を新規格の消火器に取り替えること' : '旧規格の消火器でないか（銘板の型式番号・表示）を確認',
      '消防法17条1項、消火器の技術上の規格を定める省令の一部を改正する省令（平成22年総務省令第111号）附則', `${label}：旧規格品は令和3年12月31日で設置の経過措置が終了`, 'ex:' + i);
    if (refY - y >= 10) {
      const last = e.test;
      if (!last) add('ng', '製造年から10年を経過した消火器について耐圧性能点検を実施すること', '消防法17条の3の3、点検基準（昭和50年消防庁告示第14号）', `${label}：製造から${refY - y}年、耐圧性能点検の実施記録なし`, 'ext:' + i);
      else if (ref > addYears(last, 3)) add('ng', '消火器の耐圧性能点検を実施すること（前回から3年経過）', '消防法17条の3の3、点検基準（昭和50年消防庁告示第14号）', `${label}：前回耐圧点検 ${ymd(last)} から3年を経過`, 'ext:' + i);
    }
  });
  // 消防用ホース（製造年の末日から10年経過後に耐圧性能点検、以後3年ごと）
  p.hose.forEach((h, i) => {
    const y = +h.year; if (!y) return;
    const label = `${h.kind || '消防用ホース'} ${y}年製${h.count ? ' ' + h.count + '本' : ''}`;
    const due = `${y + 10}-12-31`;
    if (ref > due) {
      if (!h.test) add('ng', '製造年の末日から10年を経過した消防用ホースについて耐圧性能点検を実施すること', '消防法17条の3の3、点検基準（昭和50年消防庁告示第14号）', `${label}：${ymd(due)}を経過、耐圧性能点検の実施記録なし`, 'hose:' + i);
      else if (ref > addYears(h.test, 3)) add('ng', '消防用ホースの耐圧性能点検を実施すること（前回から3年経過）', '消防法17条の3の3、点検基準（昭和50年消防庁告示第14号）', `${label}：前回耐圧点検 ${ymd(h.test)} から3年を経過`, 'hose:' + i);
    }
  });
  // 連結送水管（設置後10年経過で配管の耐圧性能点検、以後3年ごと）
  if (p.rsYear && refY - +p.rsYear >= 10) {
    if (!p.rsTest) add('ng', '連結送水管の配管の耐圧性能点検を実施すること', '消防法17条の3の3、点検基準（昭和50年消防庁告示第14号）', `${p.rsYear}年設置、設置から10年を経過し耐圧性能点検の記録なし`, 'rs');
    else if (ref > addYears(p.rsTest, 3)) add('ng', '連結送水管の配管の耐圧性能点検を実施すること（前回から3年経過）', '消防法17条の3の3、点検基準（昭和50年消防庁告示第14号）', `前回 ${ymd(p.rsTest)} から3年を経過`, 'rs');
  }
  // 点検結果報告書の不良事項
  p.defects.forEach((d, i) => {
    if (!d.text && !d.equip) return;
    add('ng', `${d.equip || '消防用設備等'}の不良箇所（${d.text || '点検票の不良事項'}）を改修すること`, '消防法17条1項', '点検結果報告書で不良とされた事項', 'df:' + i);
  });
  // 前回査察の未改修指摘
  S.inspections.filter(i => i.objId === o.id).forEach(i => (i.findings || []).forEach((f, k) => {
    if (f.status === 'done' || !f.text) return;
    if (f.from && f.from.startsWith('pre:') && out.some(x => 'pre:' + x.key === f.from)) return; // 事前調査から引き継いだものは二重に出さない
    add('ng', f.text, f.basis || '', `前回査察（${ymd(i.date)}）の指摘が${f.status === 'plan' ? '改修計画のまま' : '未改修'}`, `prev:${i.id}:${k}`);
  }));
  return out;
}

const SEL = (path, val, opts) => `<select data-pre="${path}">${opts.map(([v, l]) => `<option value="${v}" ${(val || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
const PIN = (path, val, type = 'text', ph = '') => `<input type="${type}" data-pre="${path}" value="${esc(val ?? '')}" ${type === 'number' ? 'inputmode="numeric"' : ''} placeholder="${ph}">`;

function vPre(){
  const o = S.objects.find(x => x.id === V.id); if (!o) return vList();
  const p = preOf(o), j = judge(o), tok = !!USE[o.use]?.tok;
  const eq = j.filter(r => r.cat !== '防火管理等' && r.status !== 'no');
  return `<div class="bar"><button class="btn ghost" data-act="open" data-id="${o.id}">‹ ${esc(o.name || '')}</button><h1>事前調査</h1></div>
  <div id="preResult">${preResultHTML(o)}</div>
  <section class="card"><h2>査察の予定</h2>
    <label class="f"><span>査察予定日（経過年数の基準日）</span>${PIN('planDate', p.planDate || today(), 'date')}</label>
  </section>
  ${has(j, '防火管理者の選任・消防計画') ? `<section class="card"><h2>防火管理</h2>
    <div class="g2"><label class="f"><span>防火管理者選任届</span>${SEL('fm', p.fm, [['', '未確認'], ['ok', '届出あり'], ['none', '届出なし']])}</label>
    <label class="f"><span>消防計画</span>${SEL('plan', p.plan, [['', '未確認'], ['ok', '届出あり'], ['old', '届出が古い'], ['none', '届出なし']])}</label>
    ${tok ? `<label class="f"><span>訓練（前年の通報記録）</span>${SEL('drill', p.drill, [['', '未確認'], ['ok', '年2回以上あり'], ['none', 'なし・不足']])}</label>` : ''}</div>
  </section>` : ''}
  <section class="card"><h2>点検結果の報告</h2>
    <div class="g2"><label class="f"><span>消防用設備等 点検結果報告書の提出日（直近）</span>${PIN('report', p.report, 'date')}<small>報告は${tok ? '特定用途のため1年' : '非特定用途のため3年'}に1回</small></label>
    ${has(j, '防火対象物定期点検報告') ? `<label class="f"><span>防火対象物点検報告の提出日（直近）</span>${PIN('fpReport', p.fpReport, 'date')}</label>` : ''}</div>
  </section>
  ${eq.length ? `<section class="card"><h2>設備の設置状況</h2><p class="note">点検結果報告書に記載のない設備は「未設置」にしてください。</p>
    ${eq.map(r => `<div class="pre-eq"><span>${esc(r.name)}${r.status === 'chk' ? '<small>（要確認の設備）</small>' : ''}</span>${SEL('equip.' + r.name, p.equip[r.name], [['', '未確認'], ['ok', '設置あり'], ['none', '未設置']])}</div>`).join('')}
  </section>` : ''}
  <section class="card"><h2>消火器</h2>
    <p class="note">製造年ごとにまとめて入力できます。製造から10年を経過したものは耐圧性能点検（以後3年ごと）、平成23年（2011年）以前製造は旧規格品の可能性を確認します。</p>
    ${p.ext.map((e, i) => `<div class="pre-row"><div class="g3">
      <label class="f"><span>製造年（西暦）</span>${PIN(`ext.${i}.year`, e.year, 'number', '2015')}</label>
      <label class="f"><span>本数</span>${PIN(`ext.${i}.count`, e.count, 'number')}</label>
      <label class="f"><span>規格</span>${SEL(`ext.${i}.std`, e.std, [['', '不明'], ['new', '新規格'], ['old', '旧規格']])}</label></div>
      <div class="g2"><label class="f"><span>直近の耐圧性能点検日</span>${PIN(`ext.${i}.test`, e.test, 'date')}</label>
      <label class="f"><span>設置場所・メモ</span>${PIN(`ext.${i}.place`, e.place, 'text', '1階厨房 など')}</label></div>
      <button class="btn ghost sm" data-act="predel" data-k="ext" data-i="${i}">この行を削除</button></div>`).join('')}
    <button class="btn" data-act="preadd" data-k="ext">＋ 消火器を追加</button>
  </section>
  <section class="card"><h2>消防用ホース</h2>
    <p class="note">製造年の末日から10年を経過したものは耐圧性能点検（以後3年ごと）が必要です。</p>
    ${p.hose.map((h, i) => `<div class="pre-row"><div class="g3">
      <label class="f"><span>種別</span>${SEL(`hose.${i}.kind`, h.kind, [['屋内消火栓ホース', '屋内消火栓'], ['屋外消火栓ホース', '屋外消火栓'], ['連結送水管ホース', '連結送水管']])}</label>
      <label class="f"><span>製造年（西暦）</span>${PIN(`hose.${i}.year`, h.year, 'number', '2012')}</label>
      <label class="f"><span>本数</span>${PIN(`hose.${i}.count`, h.count, 'number')}</label></div>
      <label class="f"><span>直近の耐圧性能点検日</span>${PIN(`hose.${i}.test`, h.test, 'date')}</label>
      <button class="btn ghost sm" data-act="predel" data-k="hose" data-i="${i}">この行を削除</button></div>`).join('')}
    <button class="btn" data-act="preadd" data-k="hose">＋ ホースを追加</button>
  </section>
  ${eq.some(r => r.name === '連結送水管') || p.rsYear ? `<section class="card"><h2>連結送水管</h2><div class="g2">
    <label class="f"><span>設置年（西暦）</span>${PIN('rsYear', p.rsYear, 'number')}</label>
    <label class="f"><span>直近の配管耐圧性能点検日</span>${PIN('rsTest', p.rsTest, 'date')}</label></div></section>` : ''}
  <section class="card"><h2>点検結果報告書の不良事項</h2>
    <p class="note">点検票で「不良」とされた項目を書き写してください。指摘事項（維持管理）になります。</p>
    ${p.defects.map((d, i) => `<div class="pre-row"><div class="g2">
      <label class="f"><span>設備</span>${PIN(`defects.${i}.equip`, d.equip, 'text', '自動火災報知設備')}</label>
      <label class="f"><span>不良の内容</span>${PIN(`defects.${i}.text`, d.text, 'text', '2階事務室 感知器未警戒')}</label></div>
      <button class="btn ghost sm" data-act="predel" data-k="defects" data-i="${i}">この行を削除</button></div>`).join('')}
    <button class="btn" data-act="preadd" data-k="defects">＋ 不良事項を追加</button>
  </section>
  <section class="card"><h2>メモ</h2><textarea rows="3" data-pre="memo">${esc(p.memo || '')}</textarea></section>`;
}
function preResultHTML(o){
  const fs = preFindings(o), ng = fs.filter(f => f.kind === 'ng'), ck = fs.filter(f => f.kind === 'chk');
  const row = f => `<div class="pre-f is-${f.kind}"><b class="st ${f.kind === 'ng' ? 'req' : 'chk'}">${f.kind === 'ng' ? '指摘' : '要確認'}</b><div><div class="t">${esc(f.text)}</div><div class="s">${esc(f.why)}</div>${f.basis ? `<button class="law" data-act="lawq" data-q="${esc(f.basis)}">${esc(f.basis)}</button>` : ''}</div></div>`;
  return `<section class="card pre-sum"><h2>予想される指摘</h2>
    <div class="pre-count"><span><b class="num">${ng.length}</b>件 指摘見込み</span><span><b class="num">${ck.length}</b>件 現地で要確認</span></div>
    ${fs.length ? ng.concat(ck).map(row).join('') : '<p class="s">入力した内容からは、指摘が見込まれる事項はありません。下の欄に点検結果報告書などの内容を入れてください。</p>'}
    ${ng.length ? `<div class="row"><button class="btn pri" data-act="prestart" data-id="${o.id}">指摘見込み${ng.length}件を入れて査察を開始</button></div>` : ''}
  </section>`;
}
function preSet(o, path, val){
  const p = preOf(o), keys = path.split('.');
  p.touched = true;
  let t = p;
  // equip.<設備名> は設備名に「.」を含まないので2段で扱う
  if (keys[0] === 'equip') { p.equip[keys.slice(1).join('.')] = val; return; }
  for (let k = 0; k < keys.length - 1; k++) t = t[keys[k]];
  t[keys.at(-1)] = val;
}
// 入力のたびに（少し遅らせて）結果を更新。内容が同じなら書き換えない
// （書き換えると、入力欄から「査察を開始」ボタンへ指を移したときにボタンが作り直されて押せなくなるため）
let preT;
function preRefresh(){
  const o = S.objects.find(x => x.id === V.id); const box = document.getElementById('preResult');
  if (!o || !box) return;
  const html = preResultHTML(o);
  if (box._html !== html) { box.innerHTML = html; box._html = html; }
}
function preStart(o){
  const ng = preFindings(o).filter(f => f.kind === 'ng');
  const dl = new Date(); dl.setDate(dl.getDate() + 30);
  const i = { id: uid(), objId: o.id, date: preOf(o).planDate || today(), kind: '定期査察', inspectors: S.settings.inspector || '', witness: '', results: {}, memo: '',
    findings: ng.map(f => ({ from: 'pre:' + f.key, text: f.text, basis: f.basis, deadline: dl.toISOString().slice(0, 10), status: 'open', note: f.why })) };
  S.inspections.push(i); o.updated = Date.now(); save(); go('inspect', { insp: i.id });
}
