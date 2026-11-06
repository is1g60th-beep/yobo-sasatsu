// ===== 保存 =====
const KEY = 'ibi-sasatsu-v1';
let storageOK = true;
let S = { objects: [], inspections: [], settings: { org: '揖斐郡消防組合', station: '', chief: '', inspector: '' } };
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) { storageOK = false; }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; } catch (e) { storageOK = false; } }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = s => document.querySelector(s);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
function wareki(iso){
  if (!iso) return '令和　年　月　日';
  const [y, m, d] = iso.split('-').map(Number);
  const r = y - 2018; return `令和${r === 1 ? '元' : r}年${m}月${d}日`;
}
const z2h = s => String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');

// ===== 画面状態 =====
let V = { view: 'list', id: null, insp: null, tab: 'list', showNo: false, lawQ: '', lawF: 'all', docKind: '3' };
function go(view, extra){ Object.assign(V, { view }, extra || {}); render(); window.scrollTo(0, 0); }

const LT = JSON.parse(document.getElementById('localtexts').textContent);

function render(){
  const nav = { list: 'list', edit: 'list', detail: 'list', inspect: 'list', doc: 'list', laws: 'laws', guide: 'guide', settings: 'settings' }[V.view];
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.go === nav));
  const f = { list: vList, edit: vEdit, detail: vDetail, inspect: vInspect, doc: vDoc, laws: vLaws, guide: vGuide, settings: vSettings }[V.view];
  $('#view').innerHTML = (storageOK ? '' : '<div class="warn">この端末のブラウザでは保存領域が使えません。設定 → バックアップで記録を書き出してください。</div>') + f();
  if (V.view === 'edit') bindEdit();
}

// ===== 対象物一覧 =====
function vList(){
  return `<div class="bar"><h1>査察対象物</h1><button class="btn pri" data-act="new">＋ 新規登録</button></div>
  <input class="search" type="search" placeholder="名称・所在地で検索" value="${esc(V.q || '')}" data-input="q">
  <div id="res-q">${listResults()}</div>`;
}
function listResults(){
  const q = (V.q || '').trim();
  const list = S.objects.filter(o => !q || (o.name + o.addr + o.owner).includes(q)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return `${list.length ? list.map(o => {
    const j = judge(o), c = sasatsuClass(o, j);
    const ins = S.inspections.filter(i => i.objId === o.id).sort((a, b) => b.date.localeCompare(a.date));
    const open = ins.flatMap(i => i.findings || []).filter(f => f.status !== 'done').length;
    return `<button class="card obj" data-act="open" data-id="${o.id}">
      <div class="t">${esc(o.name || '（名称未設定）')}</div>
      <div class="s">${esc(USE[o.use]?.label || '')} ${esc(USE[o.use]?.name || '')}</div>
      <div class="chips"><span class="chip k${c.k}">${c.label}</span>${ins[0] ? `<span class="chip">前回 ${wareki(ins[0].date)}</span>` : '<span class="chip">査察記録なし</span>'}${open ? `<span class="chip ng">未改修 ${open}件</span>` : ''}</div>
    </button>`; }).join('') : `<div class="empty">${q ? '該当する対象物がありません。' : '「＋ 新規登録」から用途・規模を入力すると、設置が必要な消防用設備等と査察区分を判定します。'}</div>`}`;
}

// ===== 対象物編集 =====
const F = (label, name, o, type = 'number', hint = '', attrs = '') => `<label class="f"><span>${label}</span><input type="${type}" name="${name}" value="${esc(o[name] ?? '')}" ${type === 'number' ? 'inputmode="decimal" min="0"' : ''} ${attrs}>${hint ? `<small>${hint}</small>` : ''}</label>`;
const CB = (label, name, o, hint = '') => `<label class="cb"><input type="checkbox" name="${name}" ${o[name] ? 'checked' : ''}><span>${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`;
function useOptions(sel, singleOnly){
  return (singleOnly ? SINGLE_USES : USES).map(u => `<option value="${u[0]}" ${u[0] === sel ? 'selected' : ''}>${u[1]} ${u[2]}</option>`).join('');
}
function vEdit(){
  const o = V.id ? S.objects.find(x => x.id === V.id) : { use: '15', struct: 'other', comps: [] };
  V.draft = JSON.parse(JSON.stringify(o));
  const d = V.draft;
  return `<div class="bar"><button class="btn ghost" data-act="${V.id ? 'open' : 'home'}" data-id="${V.id || ''}">‹ 戻る</button><h1>${V.id ? '対象物の編集' : '対象物の登録'}</h1></div>
  <form id="ef" onsubmit="return false">
  <section class="card"><h2>基本情報</h2>
    ${F('名称', 'name', d, 'text')}${F('所在地', 'addr', d, 'text')}
    ${F('関係者（所有者・管理者）', 'owner', d, 'text', '通知書の宛名になります')}${F('防火管理者', 'fm', d, 'text')}
    <label class="f"><span>用途（令別表第一）</span><select name="use">${useOptions(d.use)}</select></label>
    <div id="comps" class="${is(d.use, '16-i', '16-ro') ? '' : 'hide'}">
      <h3>複合用途の内訳（用途部分ごとに判定・令9条）</h3>
      <div id="complist">${(d.comps || []).map((c, i) => compRow(c, i)).join('')}</div>
      <button class="btn" data-act="addcomp" type="button">＋ 用途部分を追加</button>
    </div>
  </section>
  <section class="card"><h2>規模</h2>
    <div class="g2">${F('延べ面積（㎡）', 'area', d)}${F('収容人員（人）', 'cap', d)}
    ${F('地上階数', 'floorsAbove', d)}${F('地階数', 'floorsBelow', d)}
    ${F('1階＋2階の床面積（㎡）', 'f12', d, 'number', '屋外消火栓・消防用水')}${F('地階の床面積合計（㎡）', 'basementArea', d, 'number', 'ガス漏れ・連結散水')}
    ${F('地階・無窓階の最大床面積（㎡）', 'bwMax', d)}${F('地階・無窓階の収容人員', 'bwCap', d)}
    ${F('3階以上の階の最大床面積（㎡）', 'f3Max', d, 'number', '3〜10階')}${F('4階以上の階の最大床面積（㎡）', 'f4Max', d, 'number', '4〜10階')}
    ${F('2階以上・地階で最大の階の収容人員', 'floorCapMax', d, 'number', '避難器具')}${F('敷地面積（㎡）', 'site', d, 'number', '消防用水')}</div>
    ${CB('無窓階がある', 'windowless', d)}${CB('高さ31m超（高層建築物）', 'h31', d)}
    ${CB('特定一階段等防火対象物', 'oneStair', d, '特定用途が地階又は3階以上にあり、屋内階段が1のもの')}
    ${CB('管理権原が分かれている', 'multiOwner', d, '統括防火管理の判定')}
  </section>
  <section class="card"><h2>構造</h2>
    <label class="f"><span>主要構造部</span><select name="struct">
      <option value="taika" ${d.struct === 'taika' ? 'selected' : ''}>耐火構造（耐火建築物）</option>
      <option value="juntaika" ${d.struct === 'juntaika' ? 'selected' : ''}>準耐火建築物</option>
      <option value="other" ${d.struct === 'other' ? 'selected' : ''}>その他</option></select></label>
    ${CB('壁・天井の室内仕上げが難燃材料', 'naiso', d, '屋内消火栓の倍読み（令11条2項）')}
    ${CB('ラスモルタル造（鉄網入りの壁・床・天井）', 'lath', d, '漏電火災警報器')}
    ${F('契約電流容量（A）', 'amp', d)}
  </section>
  <section class="card"><h2>用途・設備の状況</h2>
    ${CB('(3)項で火を使用する設備・器具がある', 'fireEquip', d)}
    ${CB('(6)項ハで入居・宿泊させる', 'stay', d)}
    ${CB('少量危険物・指定可燃物を貯蔵・取り扱う', 'danger', d)}
    ${CB('危険物製造所等・高圧ガス関係施設等がある', 'hazFacility', d, '査察区分 第3種')}
    ${CB('温泉の採取設備がある', 'onsen', d)}
    ${CB('(14)項 ラック式倉庫（天井高10m超）', 'rack', d)}
    <div class="g2">${F('舞台部の床面積（㎡）', 'stage', d, 'number', '(1)項')}
    <label class="cb"><input type="checkbox" name="stageLow" ${d.stageLow ? 'checked' : ''}><span>舞台が地階・無窓階・4階以上</span></label>
    <label class="f"><span>駐車部分の位置</span><select name="parkLoc">
      <option value="">なし</option><option value="b2" ${d.parkLoc === 'b2' ? 'selected' : ''}>地階・2階以上</option>
      <option value="f1" ${d.parkLoc === 'f1' ? 'selected' : ''}>1階</option><option value="roof" ${d.parkLoc === 'roof' ? 'selected' : ''}>屋上</option></select></label>
    ${F('駐車部分の床面積（㎡）', 'parkArea', d)}${F('機械式駐車の収容台数', 'parkMech', d)}
    ${F('電気設備室の床面積（㎡）', 'elec', d, 'number', '発電機・変圧器等')}${F('ボイラー室等の床面積（㎡）', 'boiler', d, 'number', '多量の火気を使用')}
    ${F('通信機器室の床面積（㎡）', 'comm', d)}</div>
  </section>
  <section class="card"><h2>メモ</h2><textarea name="memo" rows="3">${esc(d.memo || '')}</textarea></section>
  <div class="sticky"><button class="btn pri wide" data-act="saveobj" type="button">保存して判定</button></div>
  </form>`;
}
function compRow(c, i){
  return `<div class="comp" data-i="${i}"><select data-comp="use">${useOptions(c.use, true)}</select><input type="number" inputmode="decimal" placeholder="床面積㎡" data-comp="area" value="${esc(c.area ?? '')}"><button class="btn ghost sm" data-act="delcomp" data-i="${i}" type="button">削除</button></div>`;
}
function readForm(){
  const f = $('#ef'), d = V.draft;
  f.querySelectorAll('input[name],select[name],textarea[name]').forEach(el => {
    d[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  });
  d.comps = [...f.querySelectorAll('.comp')].map(r => ({ use: r.querySelector('[data-comp=use]').value, area: r.querySelector('[data-comp=area]').value }));
}
function bindEdit(){
  $('#ef select[name=use]').addEventListener('change', e => $('#comps').classList.toggle('hide', !is(e.target.value, '16-i', '16-ro')));
}

// ===== 対象物詳細・判定 =====
function vDetail(){
  const o = S.objects.find(x => x.id === V.id); if (!o) return vList();
  const j = judge(o), c = sasatsuClass(o, j), pub = publicationTargets(o, j);
  const cats = [...new Set(j.map(r => r.cat))];
  const ins = S.inspections.filter(i => i.objId === o.id).sort((a, b) => b.date.localeCompare(a.date));
  const badge = s => s === 'req' ? '<b class="st req">必要</b>' : s === 'chk' ? '<b class="st chk">要確認</b>' : '<b class="st no">不要</b>';
  return `<div class="bar"><button class="btn ghost" data-act="home">‹ 一覧</button><h1>${esc(o.name || '（名称未設定）')}</h1></div>
  <section class="card">
    <div class="s">${esc(o.addr || '')}</div>
    <div class="s">${esc(USE[o.use]?.label)} ${esc(USE[o.use]?.name)}${USE[o.use]?.tok ? '（特定防火対象物）' : ''}</div>
    <div class="s">延べ ${esc(o.area || 0)}㎡ ／ 地上${esc(o.floorsAbove || 0)}階・地下${esc(o.floorsBelow || 0)}階 ／ 収容 ${esc(o.cap || 0)}人</div>
    <div class="cls k${c.k}"><b>${c.label}</b><span>定期査察 ${c.freq}・主体 ${c.by}</span><small>揖斐郡消防組合火災予防査察規程 別表第1・第2</small></div>
    ${pub.length ? `<div class="warn">公表制度の対象：${pub.join('・')}が未設置と認められた場合、結果通知から14日経過後も同一違反があれば組合ホームページで公表（条例47条の2、規則15条・16条）</div>` : ''}
    <div class="row"><button class="btn pri" data-act="newinsp" data-id="${o.id}">査察を開始</button><button class="btn" data-act="edit" data-id="${o.id}">編集</button></div>
  </section>
  <section class="card"><h2>査察記録</h2>
    ${ins.length ? ins.map(i => { const op = (i.findings || []).filter(f => f.status !== 'done').length, n = (i.findings || []).length;
      return `<button class="li" data-act="openinsp" data-id="${i.id}"><span>${wareki(i.date)} ${esc(i.kind || '')}</span><span>${n ? `指摘${n}件${op ? `<b class="ng">（未改修${op}）</b>` : '（改修済）'}` : '指摘なし'}</span></button>`; }).join('') : '<div class="s">まだ記録がありません</div>'}
  </section>
  <section class="card"><h2>設置義務等の判定</h2>
    <p class="note">入力値からの目安です。令8区画、令32条特例、既存遡及（法17条の2の5）、特例基準（特定共同住宅・特定小規模施設等）は反映していません。条文で確認してください。${is(o.use, '16-i', '16-ro') ? '<br>複合用途：用途部分ごとの延べ面積で判定し、階・収容人員の条件は建物全体の値で判定しています。' : ''}</p>
    <label class="cb inline"><input type="checkbox" data-act="toggleNo" ${V.showNo ? 'checked' : ''}><span>「不要」も表示</span></label>
    ${cats.map(cat => { const rs = j.filter(r => r.cat === cat && (V.showNo || r.status !== 'no')); if (!rs.length) return '';
      return `<h3>${cat}</h3>` + rs.map(r => `<div class="jr ${r.status}">${badge(r.status)}<div><div class="t">${esc(r.name)}</div><div class="s">${esc(r.reason)}</div><button class="law" data-act="lawq" data-q="${esc(r.basis)}">${esc(r.basis)}</button>${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}</div></div>`).join(''); }).join('')}
  </section>
  <button class="btn danger wide" data-act="delobj" data-id="${o.id}">この対象物を削除</button>`;
}

// ===== 査察（チェックリスト） =====
function vInspect(){
  const i = S.inspections.find(x => x.id === V.insp); if (!i) return vList();
  const o = S.objects.find(x => x.id === i.objId) || {};
  const items = buildChecklist(o);
  const cats = [...new Set(items.map(c => c.cat))];
  const done = items.filter(c => i.results[c.id]).length, ng = items.filter(c => i.results[c.id] === 'ng').length;
  return `<div class="bar"><button class="btn ghost" data-act="open" data-id="${o.id}">‹ ${esc(o.name || '')}</button><h1>立入検査</h1></div>
  <section class="card"><div class="g2">
    <label class="f"><span>検査日</span><input type="date" value="${esc(i.date)}" data-ins="date"></label>
    <label class="f"><span>査察の区分</span><select data-ins="kind">${['定期査察','臨時査察','特別査察'].map(k => `<option ${i.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label class="f"><span>査察員</span><input value="${esc(i.inspectors || '')}" data-ins="inspectors"></label>
    <label class="f"><span>立会者</span><input value="${esc(i.witness || '')}" data-ins="witness"></label></div>
    <div class="prog"><div style="width:${items.length ? done / items.length * 100 : 0}%"></div></div>
    <div class="s">${done}/${items.length} 項目確認 ・ 不備 ${ng}件</div>
  </section>
  ${cats.map(cat => `<section class="card"><h2>${cat}</h2>${items.filter(c => c.cat === cat).map(c => {
    const r = i.results[c.id] || '';
    return `<div class="ck ${r}"><div class="t">${esc(c.text)}${c.cond ? `<small>（${c.cond}）</small>` : ''}</div>
      <button class="law" data-act="lawq" data-q="${esc(c.basis)}">${esc(c.basis)}</button>
      <div class="seg">${[['ok','適'],['ng','不備'],['na','該当なし']].map(([v, l]) => `<button class="${r === v ? 'on ' + v : ''}" data-act="res" data-c="${esc(c.id)}" data-v="${v}">${l}</button>`).join('')}</div>
    </div>`; }).join('')}</section>`).join('')}
  <section class="card"><h2>指摘事項（不備欠陥事項）</h2>
    <p class="note">「不備」にした項目は自動で追加されます。文言・期限は編集できます。</p>
    ${(i.findings || []).map((f, k) => `<div class="fd">
      <div class="fdh"><b>${k + 1}</b><select data-fd="status" data-k="${k}">${[['open','未改修'],['plan','改修計画あり'],['done','改修済']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn ghost sm" data-act="delfd" data-k="${k}">削除</button></div>
      <textarea rows="2" data-fd="text" data-k="${k}">${esc(f.text)}</textarea>
      <div class="g2"><label class="f"><span>根拠法令</span><input value="${esc(f.basis)}" data-fd="basis" data-k="${k}"></label>
      <label class="f"><span>改修期限</span><input type="date" value="${esc(f.deadline || '')}" data-fd="deadline" data-k="${k}"></label></div>
    </div>`).join('') || '<div class="s">指摘事項はありません</div>'}
    <button class="btn" data-act="addfd">＋ 指摘事項を追加</button>
  </section>
  <section class="card"><h2>特記事項</h2><textarea rows="3" data-ins="memo">${esc(i.memo || '')}</textarea></section>
  <section class="card"><h2>書類の作成</h2>
    <div class="row wrap"><button class="btn pri" data-act="doc" data-k="3">様式第3号 立入検査結果通知書</button>
    <button class="btn" data-act="doc" data-k="4">様式第4号 改修（計画）報告書</button>
    <button class="btn" data-act="doc" data-k="5">様式第5号 勧告書</button></div>
  </section>
  <button class="btn danger wide" data-act="delinsp">この査察記録を削除</button>`;
}
function setResult(cid, v){
  const i = S.inspections.find(x => x.id === V.insp), o = S.objects.find(x => x.id === i.objId);
  const prev = i.results[cid];
  i.results[cid] = prev === v ? '' : v;
  const item = buildChecklist(o).find(c => c.id === cid);
  i.findings = i.findings || [];
  const idx = i.findings.findIndex(f => f.from === cid);
  if (i.results[cid] === 'ng' && idx < 0 && item) {
    const dl = new Date(); dl.setDate(dl.getDate() + 30);
    i.findings.push({ from: cid, text: item.fix || item.text, basis: item.basis, deadline: dl.toISOString().slice(0, 10), status: 'open' });
  } else if (i.results[cid] !== 'ng' && idx >= 0) i.findings.splice(idx, 1);
  save();
}

// ===== 書類 =====
function docData(){
  const i = S.inspections.find(x => x.id === V.insp), o = S.objects.find(x => x.id === i.objId) || {};
  return { i, o, st: S.settings, fs: (i.findings || []) };
}
function docHTML(kind){
  const { i, o, st, fs } = docData();
  const issuer = `${esc(st.org)}${st.station ? ' ' + esc(st.station) : ''}<br>${esc(st.chief || '消防署長')}`;
  const objTable = `<table class="dt"><tr><th>名称</th><td>${esc(o.name)}</td></tr><tr><th>所在地</th><td>${esc(o.addr)}</td></tr><tr><th>用途</th><td>${esc(USE[o.use]?.label)} ${esc(USE[o.use]?.name)}</td></tr></table>`;
  const fTable = (withPlan) => `<table class="dt list"><tr><th>番号</th><th>${withPlan ? '指摘事項' : '不備欠陥事項'}</th><th>根拠法令</th><th>${withPlan ? '改修（予定）年月日・改修内容' : '改修期限'}</th></tr>
    ${fs.length ? fs.map((f, k) => `<tr><td>${k + 1}</td><td>${esc(f.text)}</td><td>${esc(f.basis)}</td><td>${withPlan ? (f.status === 'done' ? '改修済' : '') : wareki(f.deadline)}</td></tr>`).join('') : '<tr><td colspan="4">なし</td></tr>'}</table>`;
  const maxDl = fs.map(f => f.deadline).filter(Boolean).sort().pop();
  if (kind === '3') return `<div class="paper"><div class="r">${wareki(i.date)}</div><div class="frm">様式第3号（第13条関係）</div>
    <h2 class="c">立入検査結果通知書</h2>
    <p>${esc(o.owner || '関係者')}　様</p><p class="r">${issuer}</p>
    <p>${wareki(i.date)}に消防法第4条第1項の規定に基づき実施した立入検査の結果、下記の不備欠陥事項が認められましたので通知します。</p>
    <p>これらの事項については速やかに改修し、改修（計画）報告書により${maxDl ? wareki(maxDl) : '　　年　月　日'}までに報告してください。</p>
    <p class="c">記</p><p>1　防火対象物</p>${objTable}<p>2　不備欠陥事項</p>${fTable(false)}
    <p>3　立会者　${esc(i.witness || '')}　　　査察員　${esc(i.inspectors || '')}</p>${i.memo ? `<p>4　特記事項　${esc(i.memo)}</p>` : ''}</div>`;
  if (kind === '4') return `<div class="paper"><div class="frm">様式第4号（第13条関係）</div><div class="r">　　年　　月　　日</div>
    <h2 class="c">改修（計画）報告書</h2><p>${esc(st.org)} ${esc(st.chief || '消防署長')}　様</p>
    <p class="r">報告者　住所<br>氏名　${esc(o.owner || '')}</p>
    <p>${wareki(i.date)}付けで通知のあった立入検査結果について、下記のとおり改修（計画）したので報告します。</p>
    <p class="c">記</p><p>1　防火対象物</p>${objTable}<p>2　改修（計画）の内容</p>${fTable(true)}</div>`;
  return `<div class="paper"><div class="frm">様式第5号（第14条関係）</div><div class="r">　　年　　月　　日</div>
    <h2 class="c">勧　告　書</h2><p>${esc(o.owner || '関係者')}　様</p><p class="r">${issuer}</p>
    <p>${wareki(i.date)}に実施した立入検査において通知した下記の不備欠陥事項は、現在も改善されていないため、速やかに改修するよう勧告します。</p>
    <p>なお、改修したときは改修（計画）報告書により報告してください。改善されない場合は、消防法に基づく警告、命令等の措置をとることがあります。</p>
    <p class="c">記</p><p>1　防火対象物</p>${objTable}<p>2　勧告事項</p>${fTable(false).replace('不備欠陥事項', '勧告事項')}
    <p class="r small">受領印（　　　　　）</p></div>`;
}
function docText(kind){
  const tmp = document.createElement('div'); tmp.innerHTML = docHTML(kind).replace(/<br>/g, '\n').replace(/<\/(p|h2|tr|div)>/g, '\n').replace(/<\/t[hd]>/g, '\t');
  return tmp.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
function vDoc(){
  const names = { '3': '様式第3号 立入検査結果通知書', '4': '様式第4号 改修（計画）報告書', '5': '様式第5号 勧告書' };
  return `<div class="bar"><button class="btn ghost" data-act="backinsp">‹ 査察記録</button><h1>${names[V.docKind]}</h1></div>
  <p class="note">査察規程の様式の欄構成（PDFに様式図面がないため）は推定です。組合の正式様式に合わせて文言を確認してください。</p>
  <div class="row wrap"><button class="btn" data-act="copydoc">文面をコピー</button>${DL ? '<button class="btn pri" data-act="dldoc">印刷用ファイルを保存</button>' : ''}</div>
  <div id="docmsg" class="s"></div>
  ${docHTML(V.docKind)}`;
}
const PAPER_CSS = `body{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;margin:0}.paper{width:180mm;margin:10mm auto;font-size:11pt;line-height:1.7}.c{text-align:center}.r{text-align:right}.frm{font-size:9pt}.small{font-size:9pt}h2{font-size:15pt;letter-spacing:.3em}.dt{width:100%;border-collapse:collapse;margin:4px 0 10px}.dt th,.dt td{border:1px solid #000;padding:4px 6px;vertical-align:top;text-align:left}.dt th{background:#f2f2f2;white-space:nowrap}.list td:first-child{text-align:center;width:2.5em}@page{size:A4;margin:12mm}`;

// ===== 条文検索 =====
function lawResults(q, filt){
  const nq = z2h(q).replace(/\s+/g, ' ').trim();
  const terms = nq ? nq.split(' ') : [];
  const out = [];
  const hit = s => { const t = z2h(s); return terms.every(w => t.includes(w)); };
  if (filt === 'all' || filt === 'nat') for (const n of NATIONAL) {
    const txt = `${n[0]} ${n[1]} ${n[2]} ${n[3]}`;
    if (!terms.length || hit(txt) || hit(`${n[0] === '消防法施行令' ? '令' : n[0] === '消防法施行規則' ? '規則' : '消防法'}${n[1]}`)) out.push({ kind: 'nat', title: /^別表/.test(n[1]) ? `${n[0]} ${n[1]}` : `${n[0]} 第${n[1].replace('〜', '〜第')}`, head: n[2], text: n[3], url: EGOV[n[0]], law: n[0], art: n[1] });
  }
  if (filt === 'all' || filt === 'loc') for (const a of LT.arts) {
    const doc = LT.docs.find(d => d.key === a.d);
    const short = { kayojo: '条例', kayoki: '規則', kayosaki: '査察規程', kiseki: '危険物規制規則', sotsuyo: '遠隔移報要綱', boukahyouji: '表示制度要綱' }[a.d];
    const txt = `${doc.title} ${short}${a.a.replace(/^第/, '')} ${a.h} ${a.t}`;
    if (!terms.length ? a.d === 'kayosaki' : hit(txt)) out.push({ kind: 'loc', title: `${doc.title} ${a.a}`, head: a.h, text: a.t, url: doc.url });
  }
  if (filt === 'all' || filt === 'kok') for (const k of KOKUJI) if (!terms.length || hit(k[0])) out.push({ kind: 'kok', title: '告示', head: k[0], text: '', url: k[1] });
  return out;
}
function vLaws(){
  return `<div class="bar"><h1>条文検索</h1></div>
  <input class="search" type="search" placeholder="例：避難口 / 厨房 / 令21条 / 条例23条" value="${esc(V.lawQ || '')}" data-input="lawQ">
  <div class="chips f">${[['all','すべて'],['nat','消防法令（要旨）'],['loc','揖斐郡 条例・規程（全文）'],['kok','告示']].map(([k, l]) => `<button class="chip ${V.lawF === k ? 'on' : ''}" data-act="lawf" data-k="${k}">${l}</button>`).join('')}</div>
  <div id="res-lawQ">${lawResultsHTML()}</div>`;
}
function lawResultsHTML(){
  const q = V.lawQ || '';
  const rs = lawResults(q, V.lawF);
  const lim = 60;
  return `<div class="s">${rs.length}件${rs.length > lim ? `（先頭${lim}件を表示）` : ''}${!q ? ' ・ キーワードを入れて検索（未入力時は査察規程を表示）' : ''}</div>
  ${rs.slice(0, lim).map((r, k) => `<details class="card law-r ${r.kind}" ${k === 0 && V.autoOpen ? 'open' : ''}><summary><span class="tag">${{ nat: '法令', loc: '揖斐郡', kok: '告示' }[r.kind]}</span><b>${esc(r.title)}</b> ${esc(r.head)}</summary>
    ${r.text ? `<div class="lt">${hl(esc(r.text), q)}</div>` : ''}<a href="${esc(r.url)}" target="_blank" rel="noopener">${r.kind === 'nat' ? 'e-Gov 法令検索で正文を見る' : r.kind === 'loc' ? '原本PDF（fd-ibi.jp）' : '告示を開く'} ↗</a>${r.kind === 'nat' ? `<div class="note">要旨（正文ではありません）</div>${artNo(r.art) ? `<button class="btn sm egov" data-act="egov" data-law="${esc(r.law)}" data-art="${esc(r.art)}">この条の正文を表示</button><div class="egov-out"></div>` : ''}` : ''}</details>`).join('')}`;
}
function hl(html, q){
  const ts = z2h(q).trim().split(/\s+/).filter(Boolean); if (!ts.length) return html;
  let h = z2h(html);
  for (const t of ts) { const e = esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); h = h.replace(new RegExp(e, 'g'), m => `<mark>${m}</mark>`); }
  return h;
}

// ===== e-Gov 法令API から条文の正文を取得 =====
const EGOV_ID = { '消防法': '323AC1000000186', '消防法施行令': '336CO0000000037', '消防法施行規則': '336M50000008006' };
const EGOV_NUM = { '消防法': '昭和二十三年法律第百八十六号', '消防法施行令': '昭和三十六年政令第三十七号', '消防法施行規則': '昭和三十六年自治省令第六号' };
const artCache = {};
// '8条の2の4' → '8_2_4'（範囲や別表は対象外）
function artNo(a){ const m = String(a || '').match(/^(\d+)条((?:の\d+)*)$/); return m ? m[1] + m[2].replace(/の/g, '_') : null; }
function kanjiNum(n){
  n = +n; const d = '〇一二三四五六七八九';
  if (n < 10) return d[n];
  let out = '';
  const h = Math.floor(n / 100), t = Math.floor(n % 100 / 10), o = n % 10;
  if (h) out += (h > 1 ? d[h] : '') + '百';
  if (t) out += (t > 1 ? d[t] : '') + '十';
  if (o) out += d[o];
  return out;
}
// '8条の2の4' → '第八条の二の四'
function artKanji(a){ const m = String(a || '').match(/^(\d+)条((?:の\d+)*)$/); return m ? '第' + kanjiNum(m[1]) + '条' + m[2].replace(/\d+/g, kanjiNum) : null; }
function xmlArticleText(art){
  const out = [];
  const txt = el => el ? el.textContent.replace(/\s+/g, '') : '';
  const cap = art.querySelector(':scope > ArticleCaption'), tit = art.querySelector(':scope > ArticleTitle');
  if (cap) out.push(txt(cap));
  art.querySelectorAll(':scope > Paragraph').forEach((p, i) => {
    const num = txt(p.querySelector(':scope > ParagraphNum'));
    const sen = txt(p.querySelector(':scope > ParagraphSentence'));
    out.push(i === 0 ? `${txt(tit)}　${sen}` : `${num}　${sen}`);
    p.querySelectorAll('Item, Subitem1, Subitem2, Subitem3').forEach(it => {
      const depth = { Item: 1, Subitem1: 2, Subitem2: 3, Subitem3: 4 }[it.tagName] || 1;
      const t = it.querySelector(':scope > ItemTitle, :scope > Subitem1Title, :scope > Subitem2Title, :scope > Subitem3Title');
      const ss = it.querySelector(':scope > ItemSentence, :scope > Subitem1Sentence, :scope > Subitem2Sentence, :scope > Subitem3Sentence');
      out.push('　'.repeat(depth) + `${txt(t)}　${txt(ss)}`);
    });
  });
  return out.join('\n');
}
async function fetchArticle(law, art){
  const key = law + art; if (artCache[key]) return artCache[key];
  // 仕様書の例は「第十一条」形式。算用数字形式も順に試す
  // 法令は法令番号（確実）→法令ID、条は「第十一条」形式→算用数字形式の順に試す
  const arts = [artKanji(art), artNo(art)].filter(Boolean);
  const cands = [];
  for (const a of arts) cands.push(`lawNum=${encodeURIComponent(EGOV_NUM[law])};article=${encodeURIComponent(a)}`);
  cands.push(`lawId=${EGOV_ID[law]};article=${encodeURIComponent(arts[0])}`);
  let last;
  for (const c of cands) {
    let res;
    try { res = await fetch(`https://laws.e-gov.go.jp/api/1/articles;${c}`); }
    catch (e) { e.net = true; throw e; } // 通信自体ができない場合は他の形式も無駄なので中止
    try {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
      const code = xml.querySelector('Result > Code');
      if (code && code.textContent.trim() !== '0') throw new Error(xml.querySelector('Result > Message')?.textContent || 'not found');
      const a = xml.querySelector('Article');
      if (!a) throw new Error('not found');
      return (artCache[key] = xmlArticleText(a));
    } catch (e) { last = e; }
  }
  throw last;
}
function showArticle(b){
  const box = b.nextElementSibling, law = b.dataset.law, art = b.dataset.art;
  box.innerHTML = '<div class="s">e-Gov から取得中…</div>';
  fetchArticle(law, art).then(t => {
    box.innerHTML = `<div class="lt egov-t">${esc(t)}</div><div class="note">出典：e-Gov 法令検索（法令API）・現行の条文</div>`;
    b.remove();
  }).catch(e => {
    box.innerHTML = `<div class="warn">正文を取得できませんでした。${e && e.net ? '通信できませんでした（電波状況、または Claude 上で開いている場合は外部通信が制限されています）。' : 'e-Gov から条文が返りませんでした。'}上の「e-Gov 法令検索で正文を見る」から「第${esc(art)}」を探してください。<br><small>詳細：${esc(e && e.message || '')}</small></div>`;
  });
}

// ===== 違反処理の流れ =====
function vGuide(){
  const steps = [
    ['立入検査（査察）', '関係者・防火管理者等の立会いを求めて実施し、終了時に結果と改善事項を具体的に説明・指導する。', '消防法4条、査察規程10条・11条'],
    ['立入検査結果通知書の交付', '不備欠陥事項を認めたときは様式第3号を交付し、写しで消防長に報告。必要に応じて提出期限を定めて改修（計画）報告書（様式第4号）を提出させる。', '査察規程13条'],
    ['公表（該当する場合）', '特定用途で屋内消火栓・SP・自火報の設置義務があるのに未設置の場合、通知日から14日経過後も同一違反があれば是正確認まで組合ホームページで公表。事前に関係者へ通知。', '条例47条の2、規則15条・16条'],
    ['勧告書の交付', '不備欠陥事項が改善されない場合等に様式第5号を交付し、写しに受領印を徴して保管。再度改修（計画）報告書を提出させ、経過を確認・指導する。', '査察規程14条'],
    ['違反処理（警告・命令等）', '勧告を無視し状態が継続する場合や違反が重大な場合は、警告、命令その他関係法令に規定する違反処理へ移行する。', '査察規程15条'],
    ['命令の例', '改修等命令（法5条）、使用禁止等命令（法5条の2）、物件除去等命令（法5条の3）、防火管理者選任命令・措置命令（法8条3項・4項）、統括防火管理（法8条の2第5項・6項）、消防用設備等の設置維持命令（法17条の4）。命令時は標識の設置等により公示（法5条3項、規則2条の2、平成14年総務省告示568号）。', '消防法'],
  ];
  return `<div class="bar"><h1>査察と違反処理の流れ</h1></div>
  <section class="card"><h2>査察区分と回数（査察規程 別表第1・第2）</h2>
  <table class="mini"><tr><th>区分</th><th>範囲</th><th>回数</th></tr>
  <tr><td>第1種</td><td>特定防火対象物で甲種防火対象物又は自火報の設置義務規模以上</td><td>1年に1回以上</td></tr>
  <tr><td>第2種</td><td>非特定で甲種防火対象物又は自火報の設置義務規模以上</td><td>1年に1回以上</td></tr>
  <tr><td>第3種</td><td>危険物製造所等、高圧ガス関係施設等</td><td>1年に1回以上</td></tr>
  <tr><td>第4種</td><td>乙種防火対象物、消火器具の設置義務規模以上、少量危険物取扱所等、消防長指定</td><td>2年に1回以上</td></tr>
  <tr><td>第5種</td><td>その他すべて</td><td>消防長が別に定める</td></tr></table>
  <p class="note">第1・2種で結果良好かつ支障がないと認めるものは2年に1回以上に変更可。臨時・特別査察は定期査察とみなすことができる。</p></section>
  <section class="card"><h2>不備から違反処理まで</h2>${steps.map((s, k) => `<div class="step"><b>${k + 1}</b><div><div class="t">${s[0]}</div><div class="s">${s[1]}</div><button class="law" data-act="lawq" data-q="${esc(s[2])}">${s[2]}</button></div></div>`).join('')}</section>`;
}

// ===== 設定 =====
function vSettings(){
  const st = S.settings;
  return `<div class="bar"><h1>設定</h1></div>
  <section class="card"><h2>通知書の発出者</h2>
    <label class="f"><span>組織名</span><input data-set="org" value="${esc(st.org)}"></label>
    <label class="f"><span>消防署名</span><input data-set="station" value="${esc(st.station)}" placeholder="例：○○消防署"></label>
    <label class="f"><span>発出者（職・氏名）</span><input data-set="chief" value="${esc(st.chief)}" placeholder="例：消防署長　○○ ○○"></label>
    <label class="f"><span>査察員（既定）</span><input data-set="inspector" value="${esc(st.inspector)}"></label>
  </section>
  <section class="card"><h2>バックアップ</h2>
    <p class="note">記録はこの端末のブラウザ内だけに保存されます。ブラウザのデータ消去で消えるため、定期的に書き出してください。</p>
    <div class="row wrap">${DL ? '<button class="btn pri" data-act="export">ファイルに書き出す</button>' : ''}<button class="btn" data-act="copyjson">データをコピー</button>
    <label class="btn">ファイルから読み込む<input type="file" accept=".json,application/json" data-act="import" hidden></label></div>
    <textarea rows="3" placeholder="コピーしたデータを貼り付けて「貼り付けから復元」" id="pasteJson"></textarea>
    <button class="btn" data-act="pasteimport">貼り付けから復元</button>
    <div id="setmsg" class="s"></div>
    <div class="s">対象物 ${S.objects.length}件 ・ 査察記録 ${S.inspections.length}件</div>
  </section>
  <section class="card"><h2>出典</h2>
    <p class="s">揖斐郡消防組合 火災予防条例・火災予防規則・火災予防査察規程・危険物規制規則・遠隔移報要綱・表示制度要綱（fd-ibi.jp 掲載PDF）、消防法・同施行令・同施行規則（e-Gov 法令検索）、消防庁告示一覧（fdma.go.jp）。</p>
    <p class="note">設置義務の判定は主要な基準を簡略化した目安です。最終判断は必ず条文・運用基準で行ってください。</p>
  </section>`;
}

// ===== ダイアログ =====
function confirmBox(msg, ok){
  const d = document.createElement('div'); d.className = 'modal';
  d.innerHTML = `<div class="box"><p>${esc(msg)}</p><div class="row"><button class="btn" data-x="no">キャンセル</button><button class="btn danger" data-x="yes">削除する</button></div></div>`;
  d.addEventListener('click', e => { const x = e.target.dataset.x; if (x) { d.remove(); if (x === 'yes') ok(); } });
  document.body.appendChild(d);
}
function msg(sel, t){ const el = $(sel); if (el) el.textContent = t; }

// ===== イベント =====
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-go]'); if (!b) return;
  if (b.dataset.go) { go(b.dataset.go); return; }
  const a = b.dataset.act, id = b.dataset.id;
  if (b.tagName === 'INPUT' && b.type === 'checkbox' && a !== 'toggleNo') return;
  switch (a) {
    case 'home': go('list'); break;
    case 'new': go('edit', { id: null }); break;
    case 'edit': go('edit', { id }); break;
    case 'open': go('detail', { id }); break;
    case 'toggleNo': V.showNo = b.checked; render(); break;
    case 'addcomp': readForm(); V.draft.comps.push({ use: '3-ro', area: '' }); $('#complist').insertAdjacentHTML('beforeend', compRow(V.draft.comps.at(-1), V.draft.comps.length - 1)); break;
    case 'delcomp': b.closest('.comp').remove(); break;
    case 'saveobj': {
      readForm(); const d = V.draft; d.updated = Date.now();
      if (!d.id) { d.id = uid(); S.objects.push(d); } else S.objects[S.objects.findIndex(x => x.id === d.id)] = d;
      save(); go('detail', { id: d.id }); break;
    }
    case 'delobj': confirmBox('この対象物と査察記録を削除します。', () => { S.objects = S.objects.filter(o => o.id !== id); S.inspections = S.inspections.filter(i => i.objId !== id); save(); go('list'); }); break;
    case 'newinsp': {
      const i = { id: uid(), objId: id, date: today(), kind: '定期査察', inspectors: S.settings.inspector || '', witness: '', results: {}, findings: [], memo: '' };
      S.inspections.push(i); const o = S.objects.find(x => x.id === id); if (o) o.updated = Date.now(); save(); go('inspect', { insp: i.id }); break;
    }
    case 'openinsp': go('inspect', { insp: id }); break;
    case 'backinsp': go('inspect'); break;
    case 'res': setResult(b.dataset.c, b.dataset.v); { const y = window.scrollY; render(); window.scrollTo(0, y); } break;
    case 'addfd': { const i = S.inspections.find(x => x.id === V.insp); i.findings.push({ text: '', basis: '', deadline: '', status: 'open' }); save(); const y = window.scrollY; render(); window.scrollTo(0, y); break; }
    case 'delfd': { const i = S.inspections.find(x => x.id === V.insp); const f = i.findings.splice(+b.dataset.k, 1)[0]; if (f && f.from) delete i.results[f.from]; save(); const y = window.scrollY; render(); window.scrollTo(0, y); break; }
    case 'delinsp': confirmBox('この査察記録を削除します。', () => { const i = S.inspections.find(x => x.id === V.insp); S.inspections = S.inspections.filter(x => x.id !== V.insp); save(); go('detail', { id: i.objId }); }); break;
    case 'doc': go('doc', { docKind: b.dataset.k }); break;
    case 'copydoc': navigator.clipboard.writeText(docText(V.docKind)).then(() => msg('#docmsg', 'コピーしました'), () => msg('#docmsg', 'コピーできませんでした')); break;
    case 'dldoc': {
      const { o, i } = docData();
      const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>様式第${V.docKind}号</title><style>${PAPER_CSS}</style></head><body>${docHTML(V.docKind)}</body></html>`;
      DL.save({ filename: `様式第${V.docKind}号_${(o.name || '対象物').replace(/[\\/:*?"<>|]/g, '')}_${i.date}.html`, data: html }).then(() => msg('#docmsg', '保存しました。ブラウザで開いて印刷できます。'), () => msg('#docmsg', '保存されませんでした'));
      break;
    }
    case 'lawq': {
      go('laws', { lawQ: lawQuery(b.dataset.q), lawF: 'all', autoOpen: true });
      // 根拠条文が消防法令なら、その条の正文をすぐ取得して表示
      const eb = document.querySelector('details[open] [data-act=egov]'); if (eb) showArticle(eb);
      break;
    }
    case 'egov': showArticle(b); break;
    case 'lawf': V.lawF = b.dataset.k; render(); break;
    case 'export': DL.save({ filename: `査察記録バックアップ_${today()}.json`, data: JSON.stringify(S, null, 1) }).then(() => msg('#setmsg', '書き出しました'), () => msg('#setmsg', '書き出されませんでした')); break;
    case 'copyjson': navigator.clipboard.writeText(JSON.stringify(S)).then(() => msg('#setmsg', 'コピーしました'), () => msg('#setmsg', 'コピーできませんでした')); break;
    case 'pasteimport': importJSON($('#pasteJson').value); break;
  }
});
function lawQuery(basis){
  // 「消防法8条の2の4、条例40条」→ 最初の参照をキーワードに
  const first = basis.split(/[、,]/)[0].trim();
  let m;
  if ((m = first.match(/^条例(\d+条(?:の\d+)*)/))) return '条例' + m[1];
  if ((m = first.match(/^(?:消防法)?令(\d+条(?:の\d+)*)/))) return '令' + m[1];
  if ((m = first.match(/^規則(\d+条(?:の\d+)*)/))) return '規則' + m[1];
  if ((m = first.match(/^消防法(\d+条(?:の\d+)*)/))) return '消防法' + m[1];
  if ((m = first.match(/^査察規程(\d+条)/))) return '査察規程' + m[1];
  return first.replace(/[（(].*$/, '');
}
function importJSON(txt){
  try { const d = JSON.parse(txt); if (!Array.isArray(d.objects)) throw 0; S = Object.assign({ objects: [], inspections: [], settings: S.settings }, d); save(); msg('#setmsg', `復元しました（対象物 ${S.objects.length}件）`); }
  catch (e) { msg('#setmsg', '読み込めませんでした。バックアップのデータか確認してください。'); }
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.act === 'import' && t.files[0]) { t.files[0].text().then(importJSON); return; }
  if (t.dataset.ins !== undefined) { const i = S.inspections.find(x => x.id === V.insp); i[t.dataset.ins] = t.value; save(); if (t.dataset.ins === 'date') render(); }
  if (t.dataset.fd !== undefined) { const i = S.inspections.find(x => x.id === V.insp); i.findings[+t.dataset.k][t.dataset.fd] = t.value; save(); if (t.dataset.fd === 'status') render(); }
  if (t.dataset.set !== undefined) { S.settings[t.dataset.set] = t.value; save(); }
});
let qt, composing = false;
// 日本語入力（IME）の変換中は検索しない。確定したら結果だけを書き換える
function searchUpdate(t){
  V[t.dataset.input] = t.value; V.autoOpen = false;
  clearTimeout(qt);
  qt = setTimeout(() => {
    const box = document.getElementById('res-' + t.dataset.input);
    if (box) box.innerHTML = t.dataset.input === 'q' ? listResults() : lawResultsHTML();
  }, 300);
}
document.addEventListener('compositionstart', e => { if (e.target.dataset && e.target.dataset.input) composing = true; });
document.addEventListener('compositionend', e => { if (e.target.dataset && e.target.dataset.input) { composing = false; searchUpdate(e.target); } });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.input) { if (e.isComposing || composing) return; searchUpdate(t); }
  if (t.dataset.ins === 'inspectors' || t.dataset.ins === 'witness' || t.dataset.ins === 'memo') { const i = S.inspections.find(x => x.id === V.insp); i[t.dataset.ins] = t.value; save(); }
  if (t.dataset.fd === 'text' || t.dataset.fd === 'basis') { const i = S.inspections.find(x => x.id === V.insp); i.findings[+t.dataset.k][t.dataset.fd] = t.value; save(); }
});

let DL = null;
render();
// 通常のWebページ（GitHub Pages 等）ではブラウザのダウンロードを使う
if (!window.claude) DL = { save: ({ filename, data }) => new Promise(res => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: filename.endsWith('.json') ? 'application/json' : 'text/html' }));
  a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); res();
}) };
if (window.claude && claude.use) claude.use('downloads').then(d => { if (d) { DL = d; if (['settings', 'doc'].includes(V.view)) render(); } }).catch(() => {});
