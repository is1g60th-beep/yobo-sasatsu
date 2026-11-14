// ===== 質問（Q&A） =====
// Claude 上で開いたときは sample 機能で Claude が条文を検索して回答する。
// それ以外（GitHub Pages など）は、質問に関係しそうな条文を関連度順に示す。
let SAMPLE = null, qaBusy = false, qaAbort = null;
const SHORT = { kayojo: '条例', kayoki: '規則（組合）', kayosaki: '査察規程', kiseki: '危険物規制規則', sotsuyo: '遠隔移報要綱', boukahyouji: '表示制度要綱' };

// 検索対象：揖斐郡の条例・規程（全文）＋消防法令（要旨）
const CORPUS = [
  ...LT.arts.map((a, i) => {
    const doc = LT.docs.find(d => d.key === a.d);
    return { id: 'L' + i, kind: 'loc', title: `${doc.title} ${z2h(a.a)}`, head: a.h, text: a.t, q: `${SHORT[a.d]}${z2h(a.a).replace(/^第/, '')}` };
  }),
  ...NATIONAL.map((n, i) => ({ id: 'N' + i, kind: 'nat', title: /^別表/.test(n[1]) ? `${n[0]} ${n[1]}` : `${n[0]} 第${n[1].replace('〜', '〜第')}`, head: n[2], text: n[3],
    q: `${n[0] === '消防法施行令' ? '令' : n[0] === '消防法施行規則' ? '規則' : '消防法'}${n[1]}` })),
].map(c => ({ ...c, norm: z2h(`${c.title} ${c.head} ${c.text}`), hnorm: z2h(`${c.title} ${c.head}`) }));

// 日本語は単語の区切りがないので、漢字・カタカナ・数字を含む2文字の組で関連度を測る
function grams(s){
  const out = new Set();
  for (const w of z2h(s).split(/[\s、。・，,（）()「」？?！!]+/)) {
    for (let i = 0; i < w.length - 1; i++) {
      const g = w.slice(i, i + 2);
      if (/[一-龠ァ-ヶー0-9]/.test(g)) out.add(g);
    }
  }
  return [...out];
}
function searchCorpus(query, limit = 8, only){
  const gs = grams(query); if (!gs.length) return [];
  const words = z2h(query).split(/\s+/).filter(w => w.length >= 2);
  return CORPUS.filter(c => !only || c.kind === only).map(c => {
    let sc = 0;
    for (const g of gs) { if (c.norm.includes(g)) sc += 1; if (c.hnorm.includes(g)) sc += 1.5; }
    for (const w of words) if (c.norm.includes(w)) sc += 3;
    if (/附\s*則|別表|様式|冒頭/.test(c.title) || /改正/.test(c.head)) sc *= 0.4; // 附則・別表・改正条文は優先度を下げる
    return { c, sc: sc / Math.sqrt(gs.length) };
  }).filter(x => x.sc > 0.6).sort((a, b) => b.sc - a.sc).slice(0, limit).map(x => x.c);
}

function objContext(o){
  if (!o) return '';
  const j = judge(o).filter(r => r.status !== 'no');
  return `【対象物の情報】名称:${o.name || ''}／用途:${USE[o.use]?.label || ''} ${USE[o.use]?.name || ''}／延べ面積:${o.area || 0}㎡／地上${o.floorsAbove || 0}階・地下${o.floorsBelow || 0}階／収容人員:${o.cap || 0}人／構造:${({ taika: '耐火', juntaika: '準耐火', other: 'その他' })[o.struct] || ''}
アプリの判定（目安）：${j.map(r => `${r.name}（${r.status === 'req' ? '必要' : '要確認'}：${r.reason}／${r.basis}）`).join('、')}
査察区分：${sasatsuClass(o).label}`;
}

function vQA(){
  const hist = (S.qa || []).slice().reverse();
  const objOpts = S.objects.map(o => `<option value="${o.id}" ${V.qaObj === o.id ? 'selected' : ''}>${esc(o.name || '（名称未設定）')}</option>`).join('');
  return `<div class="bar"><h1>質問</h1></div>
  <section class="card"><h2>${SAMPLE ? '条例・法令について質問する' : '質問に関係する条文を探す'}</h2>
    <textarea id="qaIn" rows="3" placeholder="例：厨房の排気ダクトの清掃は条例のどこに書いてある？">${esc(V.qaDraft || '')}</textarea>
    ${S.objects.length ? `<label class="f qa-obj"><span>対象物の情報を添える（任意）</span><select id="qaObj"><option value="">添えない</option>${objOpts}</select></label>` : ''}
    <div class="row">${qaBusy ? '<button class="btn" data-act="qastop">回答を止める</button>' : `<button class="btn pri" data-act="qaask">${SAMPLE ? '質問する' : '条文を探す'}</button>`}</div>
    <p class="note">${SAMPLE
      ? '揖斐郡の条例・規程は本文を、消防法令は要旨をもとに Claude が回答します。回答は参考です。根拠条文の正文を確認してから使ってください。'
      : 'AIによる回答は、Claude 上で開いたアプリでのみ使えます。ここでは質問の言葉から、関係しそうな条文を関連度順に示します。'}</p>
  </section>
  <div id="qaLive"></div>
  ${hist.map((h, k) => qaItem(h, hist.length - 1 - k)).join('')}
  ${hist.length ? '<button class="btn danger wide" data-act="qaclear">質問の履歴を消す</button>' : ''}`;
}
function qaItem(h, idx){
  const o = h.objId ? S.objects.find(x => x.id === h.objId) : null;
  return `<section class="card qa"><div class="qa-q"><b>問</b><div>${esc(h.q)}${o ? `<small>対象物：${esc(o.name)}</small>` : ''}</div></div>
    <div class="qa-a"><b>${h.ai ? '答' : '条'}</b><div>${h.a ? `<div class="qa-text">${esc(h.a)}</div>` : ''}${refList(h.refs, h.ai)}</div></div>
    ${idx != null ? `<div class="qa-meta">${new Date(h.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${h.ai ? '・Claude による回答（参考）' : ''}</div>` : ''}</section>`;
}
function refList(refs, ai){
  if (!refs || !refs.length) return '';
  return `<div class="qa-refs"><span>${ai ? 'Claude が参照した条文' : '関係しそうな条文（関連度順）'}</span>${refs.map(id => { const c = CORPUS.find(x => x.id === id); if (!c) return '';
    return `<button class="law" data-act="qaref" data-q="${esc(c.q)}">${esc(c.title)}${c.head ? ' ' + esc(c.head) : ''}${c.kind === 'nat' ? '（要旨）' : ''}</button>`; }).join('')}</div>`;
}

const QA_RULES = `あなたは揖斐郡消防組合の予防査察（立入検査）を支援するアシスタントです。消防職員の質問に日本語で答えます。
ルール：
- 必ず search_articles で関連条文を探し、必要なら get_article で全文を読んでから答える。検索語を変えて2〜4回検索してよい。
- 回答の根拠は、取得した条文だけにする。条例・規則・査察規程などの揖斐郡の文書は本文、消防法・施行令・施行規則は要旨しか手元にない。要旨しかない法令の細部は「正文で要確認」と明記する。
- 根拠は「火災予防条例第23条」「消防法第8条の2の4」「消防法施行令第21条第1項」のように法令名と条番号で示す。
- 見つからない・判断が分かれる内容は推測で断定せず、その旨と確認先（条文・運用基準・上司）を書く。
- 書式：最初に結論を1〜2文。続けて根拠（条文と要点）を「・」の箇条書きで。最後に「根拠条文：」の行に条番号を列挙。見出し記号（#）や太字（**）は使わない。全体で400字程度まで。
- 法的な最終判断ではない参考回答であることを前提に、簡潔に。`;

async function qaAsk(){
  const q = ($('#qaIn')?.value || '').trim(); if (!q || qaBusy) return;
  const objId = $('#qaObj')?.value || '';
  V.qaDraft = q; V.qaObj = objId;
  if (!SAMPLE) {
    const refs = searchCorpus(q, 10).map(c => c.id);
    S.qa = (S.qa || []).concat({ q, a: refs.length ? '' : '関係する条文が見つかりませんでした。言葉を変えて試してください（例：「ダクト 清掃」「避難口 物件」）。', refs, objId, at: Date.now(), ai: false }).slice(-50);
    save(); V.qaDraft = ''; render(); return;
  }
  qaBusy = true; render();
  const live = $('#qaLive'); const refs = [];
  live.innerHTML = qaItem({ q, a: '条文を探しています…', refs: [], objId, ai: true });
  const textEl = () => live.querySelector('.qa-text');
  const tools = [
    { name: 'search_articles', description: '揖斐郡消防組合の条例・規則・査察規程等（本文）と消防法令（要旨）から、語句に関係する条文を探す。結果は id・条番号・見出し・本文の抜粋。',
      inputSchema: { type: 'object', properties: { query: { type: 'string', description: '検索語（例：「厨房設備 排気ダクト 清掃」）' }, source: { type: 'string', enum: ['all', 'local', 'national'], description: 'local=揖斐郡の条例・規程、national=消防法令（要旨）' } }, required: ['query'] },
      execute: ({ query, source }) => {
        const rs = searchCorpus(query, 8, source === 'local' ? 'loc' : source === 'national' ? 'nat' : null);
        return rs.map(c => ({ id: c.id, 条: c.title, 見出し: c.head, 種別: c.kind === 'loc' ? '本文' : '要旨', 抜粋: c.text.slice(0, 400) }));
      } },
    { name: 'get_article', description: 'search_articles で得た id の条文の全文を取得する。',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      execute: ({ id }) => {
        const c = CORPUS.find(x => x.id === id); if (!c) throw new Error('id が見つかりません');
        if (!refs.includes(id)) refs.push(id);
        return { 条: c.title, 見出し: c.head, 種別: c.kind === 'loc' ? '本文' : '要旨（正文ではない）', 本文: c.text.slice(0, 6000) };
      } },
  ];
  const o = objId ? S.objects.find(x => x.id === objId) : null;
  const input = `${QA_RULES}\n\n${o ? objContext(o) + '\n\n' : ''}【質問】${q}`;
  qaAbort = new AbortController();
  let answer = '';
  try {
    const r = await SAMPLE(input, { tools, cache: false, signal: qaAbort.signal, modelTier: 'default',
      onText: ({ text }) => { answer = text; const el = textEl(); if (el) el.textContent = text || '考えています…'; } });
    answer = r.text || answer;
    S.qa = (S.qa || []).concat({ q, a: answer, refs, objId, at: Date.now(), ai: true }).slice(-50);
    save(); V.qaDraft = '';
  } catch (e) {
    const m = e && e.code === 'rate_limited' ? '質問が集中しています。少し時間をおいてから質問してください。'
      : e && e.code === 'not_granted' ? 'この画面では Claude への質問が許可されていません。'
      : e && e.name === 'AbortError' ? '回答を止めました。' : `回答を受け取れませんでした（${esc(e && (e.message || e.code) || '')}）。`;
    if (e && e.code === 'not_granted') SAMPLE = null;
    if (answer) { S.qa = (S.qa || []).concat({ q, a: answer + '\n（途中で終了）', refs, objId, at: Date.now(), ai: true }).slice(-50); save(); }
    V.qaMsg = m;
  }
  qaBusy = false; qaAbort = null; render();
  if (V.qaMsg) { $('#qaLive').innerHTML = `<div class="warn">${V.qaMsg}</div>`; V.qaMsg = ''; }
}
