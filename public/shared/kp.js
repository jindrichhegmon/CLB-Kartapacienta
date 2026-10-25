/* Společné funkce pro centrální aplikaci, kartu na mobilu a správu tenantů. */
(function () {
  const KP = {};
  KP.CILE = { symptom: 'Symptomatická (úleva od obtíží)', limited: 'Omezená (léčba bez resuscitace a intenzivní péče)', full: 'Plná léčba' };
  KP.LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];
  KP.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  KP.fmtD = (iso) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${+d}. ${+m}. ${y}`; };
  KP.fmtDT = (s) => { if (!s) return '—'; const t = String(s).replace('T', ' '); return `${KP.fmtD(t.slice(0, 10))} ${t.slice(11, 16)}`; };
  KP.dnes = () => new Date().toISOString().slice(0, 10);
  KP.prosly = (iso) => !!iso && iso < KP.dnes();
  KP.casLokalni = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  KP.uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15); return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  KP.toast = (m) => { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 3200); };
  KP.modal = (html, bind) => {
    let m = document.getElementById('modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal"><div class="box"><div class="grab"></div>${html}</div></div>`;
    m.querySelector('.modal').onclick = (e) => { if (e.target.classList.contains('modal')) KP.closeModal(); };
    m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = KP.closeModal));
    if (bind) bind(m);
  };
  KP.closeModal = () => { const m = document.getElementById('modal'); if (m) m.innerHTML = ''; };
  KP.confirm = (titulek, text, ok = 'Potvrdit', crit = false) => new Promise((res) => {
    KP.modal(`<h2>${KP.esc(titulek)}</h2><p>${text}</p><div class="quick"><button class="btn ${crit ? 'crit' : 'primary'}" id="kpOk">${KP.esc(ok)}</button><button class="btn" data-close>Zpět</button></div>`,
      (m) => { m.querySelector('#kpOk').onclick = () => { KP.closeModal(); res(true); }; m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => { KP.closeModal(); res(false); })); });
  });

  /** JSON API s Bearer session. */
  KP.api = async (path, { method = 'GET', body, token, typ = 'Bearer' } = {}) => {
    const r = await fetch(path, {
      method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `${typ} ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let d = {}; try { d = await r.json(); } catch { d = { ok: false, chyba: `Server odpověděl ${r.status}` }; }
    if (!r.ok || d.ok === false) { const e = new Error(d.chyba || `Chyba ${r.status}`); e.status = r.status; throw e; }
    return d;
  };

  KP.ICON = {
    karta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="3"/></svg>',
    denik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h12a3 3 0 013 3v11H7a3 3 0 00-3 3z"/><path d="M8 9h7M8 13h7"/></svg>',
    dg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v6a6 6 0 0012 0V3"/><path d="M12 15v3a3 3 0 006 0v-2"/><circle cx="18" cy="14" r="2"/></svg>',
    leky: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-45 12 12.5)"/><path d="M8.5 16L15.5 9"/></svg>',
    zhorseni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 17H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    kontakty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    udaje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
    dok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg>',
    zamek: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
    sync: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/></svg>',
  };

  /** Aktivní zhoršení = poslední krizový zápis je „Zhoršení stavu“. */
  KP.aktivniZhorseni = (denik) => {
    const krize = (denik || []).filter((e) => ['Zhoršení stavu', 'Stav stabilizován', 'Výjezd ZZS', 'Ukončení'].includes(e.typ));
    const l = krize[krize.length - 1];
    return l && l.typ === 'Zhoršení stavu' ? l : null;
  };

  /** Krizová karta z balíku (stejný tvar posílá server telefonu i centrální aplikaci). */
  /* doklad k limitacím (§ 36): DVP s poučením a ověřeným podpisem, DVP z přijetí (platí jen u toho poskytovatele), nebo rozhodnutí lékaře */
  KP.dokladHTML = (d) => {
    d = d || {};
    if (!d.dvp) return '<span class="chip warn">bez dříve vysloveného přání</span> rozhodnutí lékaře';
    const zaklad = `dříve vyslovené přání${d.datum ? ' z ' + KP.fmtD(d.datum) : ''}`;
    if (d.prijeti) return `${zaklad}, sepsané při přijetí u ${KP.esc(d.prijeti)} <span class="chip warn">platí jen u tohoto poskytovatele</span>`;
    if (d.pouceni && d.overenyPodpis) return `${zaklad} <span class="chip ok">poučení lékařem a ověřený podpis</span>`;
    return `${zaklad} <span class="chip warn">poučení / ověření podpisu neuvedeno – ověřte u originálu</span>`;
  };
  /* chat PéčeDoma s klientem (od 0.8.0) – jedno okno pro centrálu, telefon i Můj průkaz.
     nacti() → { zpravy }, posli(text) → { zpravy }; mojeSmer = 'OD_TYMU' (centrála) nebo 'OD_PACIENTA' (telefony) */
  KP.chatHTML = (zpravy, mojeSmer, nazvy = {}) => (zpravy || []).length
    ? zpravy.map((z) => `<div class="msg ${z.smer === mojeSmer ? 'out' : 'in'}${z.sms ? ' sms' : ''}"><div class="who">${KP.esc(nazvy[z.smer] || (z.smer === 'OD_TYMU' ? 'Tým PéčeDoma' : 'Klient'))}${z.kdo ? ' · ' + KP.esc(z.kdo) : ''} · ${KP.esc(KP.fmtDT(z.cas))}${z.sms ? ' · SMS' : ''}</div>${KP.esc(z.text)}</div>`).join('')
    : '<div class="muted" style="font-size:13px">Zatím žádné zprávy – napište první.</div>';
  /* náhled posledních zpráv bez rozklikávání (od 0.8.4): n posledních zpráv, prázdné vlákno = krátký text */
  KP.chatNahled = (zpravy, mojeSmer, nazvy = {}, n = 2) => (zpravy || []).length
    ? `<div class="chatl" style="max-height:none;min-height:0;padding:0 0 4px">${KP.chatHTML(zpravy.slice(-n), mojeSmer, nazvy)}</div>`
    : '<div class="muted" style="font-size:13px;padding:0 0 6px">Zatím žádné zprávy.</div>';
  KP.chatOkno = ({ titulek = 'Chat PéčeDoma', popis = '', mojeSmer, nazvy = {}, nacti, posli, poZmene = null }) => {
    KP.modal(`<h2>${KP.esc(titulek)}</h2>${popis ? `<div class="muted" style="font-size:13px">${popis}</div>` : ''}<div id="chat_l" class="chatl"><div class="muted" style="font-size:13px">Načítám zprávy…</div></div>
      <div class="row" style="gap:8px"><input id="chat_t" placeholder="Napište zprávu…" style="flex:1" maxlength="4000" autocomplete="off"><button class="btn primary" id="chat_s">Odeslat</button></div>
      <div class="quick"><button class="btn" data-close>Zavřít</button></div>`, (m) => {
      const l = m.querySelector('#chat_l'), t = m.querySelector('#chat_t'), s = m.querySelector('#chat_s');
      const ukaz = (zpravy) => { l.innerHTML = KP.chatHTML(zpravy, mojeSmer, nazvy); l.scrollTop = l.scrollHeight; if (poZmene) { try { poZmene(zpravy); } catch { /* */ } } };
      const chybaUkaz = (e) => { l.innerHTML = `<div class="banner crit">${KP.esc(e.message || String(e))}</div>`; };
      nacti().then((r) => ukaz(r.zpravy)).catch(chybaUkaz);
      const odesli = async () => { const text = t.value.trim(); if (!text) return; s.disabled = true; try { const r = await posli(text); t.value = ''; ukaz(r.zpravy); KP.toast('Zpráva odeslána do PéčeDoma'); } catch (e) { KP.toast(e.message); } s.disabled = false; t.focus(); };
      s.onclick = odesli; t.onkeydown = (e) => { if (e.key === 'Enter') odesli(); };
      setTimeout(() => t.focus(), 50);
    });
  };
  /* Vysvětlivky na klik (od 0.8.3): vysvětlující texty (.note, .rolehelp bez třídy keep) se po vykreslení přesunou na konec
     obrazovky do sbaleného bloku „Vysvětlivky“, aby obrazovka ukazovala jen důležité informace. Prázdný obal (panel) se odstraní. */
  KP.sbalVysvetlivky = (root, { pred = null, titulek = 'Vysvětlivky' } = {}) => {
    if (!root) return;
    const els = [...root.querySelectorAll('.note:not(.keep), .rolehelp:not(.keep)')].filter((e) => !e.closest('.vysv') && !e.closest('#modal') && e.textContent.trim());
    if (!els.length) return;
    const d = document.createElement('details'); d.className = 'vysv';
    d.innerHTML = `<summary>${KP.esc(titulek)} <span class="chip">${els.length}</span></summary><div class="vysv-b"></div>`;
    const b = d.querySelector('.vysv-b');
    els.forEach((e) => { const par = e.parentElement; e.classList.remove('rolehelp'); e.classList.add('note'); e.style.margin = ''; b.appendChild(e);
      if (par && par !== root && !par.children.length && !par.textContent.trim()) par.remove(); });
    const kam = pred ? root.querySelector(pred) : null;
    if (kam) root.insertBefore(d, kam); else root.appendChild(d);
  };
  /* Léky – jeden zdroj (od 0.9.0): u pacienta propojeného s PéčeDoma jsou léky z PéčeDoma (a tam se i mění), jinak z plánu péče */
  KP.leky = (b) => {
    const pd = b && b.pecedoma, p = (b && b.plan && b.plan.data) || {};
    if (pd && pd.propojeno && pd.aktualizovano) return { sos: pd.sos || [], opioidy: pd.opioidy || [], medikace: pd.medikace || [], zdroj: 'pecedoma', aktualizovano: pd.aktualizovano };
    return { sos: p.sos || [], opioidy: p.opioidy || [], medikace: p.medikace || [], zdroj: pd && pd.propojeno ? 'pecedoma-ceka' : 'plan' };
  };
  /* Léky z PéčeDoma – seznam s tlačítky a okno pro přidání / úpravu (centrála i telefon lékaře) */
  KP.TYP_LEKU = { ZACHRANNA: 'SOS lék', OPIOID: 'opioid', PRAVIDELNA: 'pravidelně', PARENTERALNI: 'parenterálně' };
  KP.SKUPINY_LEKU = [['ZACHRANNA', 'SOS léky', 'warn'], ['OPIOID', 'Opioidy', 'crit'], ['PRAVIDELNA', 'Pravidelná medikace', 'acc'], ['PARENTERALNI', 'Parenterálně', 'vio']];
  KP.lekyRadky = (leky, muze) => {
    const e = KP.esc, sk = KP.SKUPINY_LEKU;
    return sk.map(([t, n, c]) => { const r = (leky || []).filter((l) => l.typ === t); return `<div class="lbl" style="padding:8px 14px 2px">${n} <span class="chip ${c}">${r.length}</span></div>
      ${r.length ? `<table class="tbl"><tbody>${r.map((l) => `<tr><td><b>${e(l.nazev)}</b>${l.davka ? ' – ' + e(l.davka) : ''}${l.instr ? `<div class="lbl">${e(l.instr)}</div>` : ''}${l.popis ? `<div class="lbl">pro pacienta: ${e(l.popis)}</div>` : ''}</td>
        <td style="white-space:nowrap;text-align:right">${muze ? `<button class="btn sm" data-lk-edit="${e(l.id)}">Upravit</button> <button class="btn sm" data-lk-del="${e(l.id)}">Vyřadit</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="muted" style="padding:0 14px 8px;font-size:13px">žádné</div>'}`; }).join('');
  };
  KP.lekOkno = (l, ulozit) => {
    const e = KP.esc, $ = (id) => document.getElementById(id);
    KP.modal(`<h2>${l ? 'Upravit lék' : 'Přidat lék'}</h2><div class="form">
      <div class="field"><label>Typ</label><select id="lk_t">${Object.entries(KP.TYP_LEKU).map(([k, n]) => `<option value="${k}" ${l ? (l.typ === k ? 'selected' : '') : (k === 'PRAVIDELNA' ? 'selected' : '')}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Název léku *</label><input id="lk_n" value="${e(l ? l.nazev : '')}" placeholder="např. Morphin 10 mg"></div>
      <div class="field"><label>Dávkování</label><input id="lk_d" value="${e(l ? l.davka : '')}" placeholder="např. 1-0-1, nebo 10 mg s.c."></div>
      <div class="field"><label>Instrukce (u SOS léku: kdy podat, nejvýš jak často)</label><input id="lk_i" value="${e(l ? l.instr : '')}" placeholder="např. při bolesti nebo dušnosti, nejvýš po 4 h"></div>
      <div class="field"><label>Popis pro pacienta (volitelně)</label><input id="lk_p" value="${e(l ? l.popis : '')}"></div>
      <div class="quick"><button class="btn primary ulozit" id="lk_save">Uložit</button><button class="btn" data-close>Zrušit</button></div></div>`, () => {
      $('lk_save').onclick = async () => {
        const b = { id: l ? l.id : undefined, nazev_puv: l ? l.nazev : '', typ: $('lk_t').value, nazev: $('lk_n').value.trim(), davka: $('lk_d').value.trim(), instr: $('lk_i').value.trim(), popis: $('lk_p').value.trim() };
        if (!b.nazev) return KP.toast('Vyplňte název léku');
        $('lk_save').disabled = true;
        try { await ulozit(b); KP.closeModal(); } catch (err) { KP.toast(err.message); $('lk_save').disabled = false; }
      };
    });
  };
  KP.kartaHTML = (b, { tlacitka = '' } = {}) => {
    const p = b.pacient || {}; const plan = (b.plan && b.plan.data) || {}; const platnost = b.plan && b.plan.platnostDo;
    const kontakty = (b.kontakty || []).map((k) => ({ ...k, skupina: String(k.skupina || '').toLowerCase() }));
    const g = b.garant || {};
    const first = kontakty.find((k) => /hospic/i.test(k.jmeno) && k.skupina === 'pecuje') || kontakty.find((k) => k.skupina === 'pecuje') || (g.telefon24 ? { jmeno: g.poskytovatel, tel: g.telefon24 } : null);
    const rozh = kontakty.filter((k) => k.skupina === 'rozhoduje');
    const limity = plan.limity || []; const kpr = limity.includes('KPR');
    const dalsi = limity.filter((l) => l !== 'KPR');
    const doklad = plan.doklad || {};
    const zh = KP.aktivniZhorseni(b.denik);
    const last = zh || (b.denik || []).filter((e) => !KP.SYSTEM_TYPY.includes(e.typ)).slice(-1)[0];
    const exp = !b.plan || KP.prosly(platnost);
    const lekarJm = (b.plan && b.plan.podepsal) || g.lekar || '—';
    const lekarTel = g.lekarTelefon || g.telefon24 || '';
    const pd = b.pecedoma || null;   // propojení s PéčeDoma: nejbližší plánovaná návštěva patří do karty (vidí ji i ZZS a tisk)
    const leky = KP.leky(b);
    const e = KP.esc;
    return `<div class="card">
      <div class="hdr"><div class="row" style="justify-content:space-between"><span>KRIZOVÝ PLÁN PÉČE · ${e(p.kod || '')}</span><span class="valid ${exp ? 'exp' : ''}">${!b.plan ? 'BEZ PLÁNU' : exp ? 'ČEKÁ NA REVIZI' : 'platí do ' + KP.fmtD(platnost)}</span></div>
        <div class="name">${e(p.prijmeni || '')} ${e(p.jmeno || '')}${p.rok ? ', ' + e(p.rok) : ''}</div></div>
      <div class="body">
        <section class="sec navy"><h3>DIAGNÓZA</h3><div class="val" style="white-space:pre-wrap">${e(plan.dg || 'neuvedena')}</div>${plan.funkce ? `<div class="lbl">Funkční stav</div><div class="val">${e(plan.funkce)}</div>` : ''}</section>
        <section class="sec red"><h3>LIMITACE PÉČE</h3>
          <div class="pill ${kpr ? '' : 'ok'}">KPR: ${kpr ? 'NE' : 'ANO'}</div>
          ${dalsi.length ? `<div class="val">Dále ne: ${e(dalsi.join(', '))}</div>` : ''}
          <div class="lbl">Cíl péče</div><div class="val">${e(KP.CILE[plan.cil] || '—')}</div>
          <div class="lbl">Doklad</div><div class="val">${KP.dokladHTML(doklad)}</div>
          ${doklad.original || doklad.zprava ? `<div class="lbl" style="margin-top:2px">${e(doklad.dvp && doklad.original ? 'originál: ' + doklad.original : 'zápis: ' + (doklad.zprava || ''))}</div>` : ''}
        </section>
        <section class="sec amber"><h3>ALERGIE A SOS LÉKY</h3>
          <div class="val"><b>Alergie:</b> ${e(plan.alergie || 'neuvedeno')}</div>
          <div class="lbl">SOS léky${leky.zdroj === 'pecedoma' ? ' · PéčeDoma' : ''}</div>${leky.sos.map((s) => `<div class="val">${e(s)}</div>`).join('') || '<div class="val">neuvedeny</div>'}
          ${leky.opioidy.length ? `<div class="lbl">Opioidy</div>${leky.opioidy.map((s) => `<div class="val">${e(s)}</div>`).join('')}` : ''}
        </section>
        <section class="sec blue"><h3>KOHO VOLAT</h3>
          ${first ? `<a class="callrow first" href="tel:${e(String(first.tel).replace(/\s/g, ''))}" style="color:inherit;text-decoration:none"><span>Nejdřív: ${e(String(first.jmeno).replace(/ \(24\/7\)/, ''))}</span><span class="num">${e(first.tel)}</span></a>` : ''}
          <div class="callrow"><span><span class="lbl" style="margin:0">Lékař plánu${g.poskytovatel ? ' · ' + e(g.poskytovatel) : ''}</span><br>${e(lekarJm)}</span>${lekarTel ? `<a class="num" href="tel:${e(lekarTel.replace(/\s/g, ''))}">${e(lekarTel)}</a>` : ''}</div>
          ${rozh.map((r) => `<div class="callrow"><span><span class="lbl" style="margin:0">Rozhoduje</span><br>${e(r.jmeno)}</span><a class="num" href="tel:${e(String(r.tel).replace(/\s/g, ''))}">${e(r.tel)}</a></div>`).join('')}
        </section>
        ${pd && pd.pristiNavsteva ? `<section class="sec green"><h3>PŘÍŠTÍ NÁVŠTĚVA · PéčeDoma</h3><div class="val"><b>${e(KP.fmtDT(pd.pristiNavsteva))}</b></div>${pd.pristiKdo ? `<div class="val">${e(pd.pristiKdo)}</div>` : ''}${pd.pristiPozn ? `<div class="lbl">${e(pd.pristiPozn)}</div>` : ''}</section>`
          : pd && pd.aktualizovano ? `<section class="sec green"><h3>PŘÍŠTÍ NÁVŠTĚVA · PéčeDoma</h3><div class="lbl">V kalendáři PéčeDoma zatím není naplánovaná návštěva (stav ${e(KP.fmtDT(pd.aktualizovano))}).</div></section>` : ''}
        ${last ? `<section class="sec violet"><h3>${zh ? 'AKTUÁLNÍ ZHORŠENÍ' : 'POSLEDNÍ ZÁPIS'} · ${e(KP.fmtDT(last.cas))} · ${e(last.autor)}</h3><div class="val">${e(last.text)}</div></section>` : ''}
      </div>
      ${tlacitka ? `<div class="foot">${tlacitka}</div>` : ''}
    </div>`;
  };

  KP.ROLE = { lekar: 'lékař', sestra: 'sestra', rodina: 'rodina', hospic: 'hospic', pl: 'praktický lékař', zzs: 'ZZS', system: 'systém', pacient: 'pacient' };
  KP.SYSTEM_TYPY = ['Systém', 'Úprava údajů'];   // zápisy o nastavování, ne o pacientovi
  /* deník: primárně jen zápisy o pacientovi; systémové (párování, propojení, změna čísla…) jsou sbalené na konci */
  KP.denikHTML = (denik, { role = true, system = true } = {}) => {
    if (!system) return KP.denikSeznam(denik, { role });
    const vse = denik || [], sys = vse.filter((e) => KP.SYSTEM_TYPY.includes(e.typ)), pac = vse.filter((e) => !KP.SYSTEM_TYPY.includes(e.typ));
    return KP.denikSeznam(pac, { role }) + (sys.length ? `<details class="vysv"><summary>Systémové záznamy <span class="chip">${sys.length}</span></summary><div class="vysv-b">${KP.denikSeznam(sys, { role })}</div></details>` : '');
  };
  KP.denikSeznam = (denik, { role = true } = {}) => `<ul class="diary">${[...(denik || [])].reverse().map((e) => `<li><div class="when">${KP.esc(KP.fmtDT(e.cas))} · <span class="who">${KP.esc(e.autor)}${role && e.role ? ' · ' + KP.esc(KP.ROLE[e.role] || e.role) : ''}${e.overeno === false || e.overeno === 0 ? ' · <span class="chip warn">neověřeno</span>' : ''}${e.cekaNaOdeslani ? ' · <span class="chip">čeká na odeslání</span>' : ''}</span></div><div><span class="chip ${/SOS/.test(e.typ) ? 'warn' : /Zhoršení|ZZS/.test(e.typ) ? 'crit' : /Založení|Revize|Ukončení|Předání/.test(e.typ) ? 'acc' : /Úprava|Systém/.test(e.typ) ? 'vio' : ''}">${KP.esc(e.typ)}</span><div style="margin-top:4px;white-space:pre-wrap">${KP.esc(e.text)}</div></div></li>`).join('') || '<li class="muted">Zatím žádné zápisy.</li>'}</ul>`;

  window.KP = KP;
})();
