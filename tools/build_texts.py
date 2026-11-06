"""揖斐郡消防組合の条例・規程PDFを条ごとに分割して data/localtexts.json を作る。
使い方: pdf/ に kayojo.pdf 等を置き、python3 tools/build_texts.py（pdftotext が必要）
"""
import re, json, sys, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = str(root / 'pdf') + '/'
docs=[('kayojo','揖斐郡消防組合火災予防条例','kayojo.pdf','http://www.fd-ibi.jp/jorei/kayojo.pdf'),
('kayoki','揖斐郡消防組合火災予防規則','kayoki.pdf','http://www.fd-ibi.jp/jorei/kayoki.pdf'),
('kayosaki','揖斐郡消防組合火災予防査察規程','kayosaki.pdf','http://www.fd-ibi.jp/jorei/kayosaki.pdf'),
('kiseki','揖斐郡消防組合危険物規制規則','kiseki.pdf','http://www.fd-ibi.jp/jorei/kiseki.pdf'),
('sotsuyo','遠隔移報システム等による火災通報の取扱要綱','sotsuyo.pdf','http://www.fd-ibi.jp/jorei/sotsuyo.pdf'),
('boukahyouji','防火対象物に係る表示制度要綱','boukahyouji.pdf','http://www.fd-ibi.jp/jorei/boukahyouji.pdf')]
out=[]
for key,title,fn,url in docs:
    txt=subprocess.run(['pdftotext','-layout',src+fn,'-'],capture_output=True,text=True,check=True).stdout
    lines=[l.strip() for l in txt.splitlines()]
    lines=[l for l in lines if l and not re.fullmatch(r'-?\s*\d+\s*/\s*\d+\s*-?|\d+',l)]
    # merge broken lines
    paras=[]
    for l in lines:
        newp = (not paras) or re.match(r'^(第[0-9０-９]+[条章節]|（[^）]{1,40}）$|\(\s*\d+|（\d+）|\([0-9]+の[0-9]+\)|[２-９]\s|[0-9０-９]{1,2}\s|[ア-ン]\s|別表|別記|様式|附\s*則|目次|第[0-9０-９]+\s|[0-9０-９]+\s|＜|【|・)',l) or paras[-1].endswith(('。','）'))
        if newp: paras.append(l)
        else: paras[-1]+=l
    # split into articles
    arts=[]; cur={'art':'冒頭','head':'','body':[]}; pendhead=''
    for p in paras:
        m=re.match(r'^(第[0-9０-９]+条(?:の[0-9０-９]+)*)[\s　]*(.*)$',p)
        mh=re.fullmatch(r'（[^）]{1,40}）',p)
        if mh: pendhead=p; continue
        if m or re.match(r'^(別表|別記|附\s*則)',p):
            arts.append(cur)
            if m: cur={'art':m.group(1),'head':pendhead,'body':[m.group(1)+' '+m.group(2)]}
            else: cur={'art':p[:12],'head':pendhead,'body':[p]}
            pendhead=''
        else:
            if pendhead: cur['body'].append(pendhead); pendhead=''
            cur['body'].append(p)
    arts.append(cur)
    for a in arts:
        if not a['body']: continue
        out.append({'d':key,'a':a['art'],'h':a['head'],'t':'\n'.join(a['body'])})
    print(key,len(arts),file=sys.stderr)
meta=[{'key':k,'title':t,'url':u} for k,t,f,u in docs]
json.dump({'docs':meta,'arts':out},open(root/'data/localtexts.json','w',encoding='utf-8'),ensure_ascii=False)
