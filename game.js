/* ============================================================
   NIGHT SHIFT — Moteur du jeu (v4, vanilla JS, zéro dépendance)
   Progression en actes + puzzles variés + accusation par preuves.
   ============================================================ */

const App = (() => {

  let foundClues = new Set();
  let hintsUsed = 0;
  let clockMinute = 47;
  let act2Cleared = false; // débloque l'acte 3
  let timelineOrder = [];  // ordre choisi par le joueur pour le puzzle chronologie
  let timelineSolved = false;
  let cipherSolved = false;
  let hexSolved = false;

  /* ---------- Écrans généraux ---------- */

  function showHowTo(){
    document.getElementById('sec-title').classList.add('hidden');
    document.getElementById('sec-howto').classList.remove('hidden');
  }
  function hideHowTo(){
    document.getElementById('sec-howto').classList.add('hidden');
    document.getElementById('sec-title').classList.remove('hidden');
  }
  function startBriefing(){
    document.getElementById('sec-title').classList.add('hidden');
    document.getElementById('sec-intro').classList.remove('hidden');
  }
  function startGame(){
    document.getElementById('sec-intro').classList.add('hidden');
    document.getElementById('game-sections').classList.remove('hidden');
    renderAct1();
    renderAct2();
    renderAct3(); // affiché mais verrouillé tant qu'act2Cleared === false
    renderSuspects();
    updateProgress();
    drawGraph();
    tickClock();
  }
  function tickClock(){
    setInterval(()=>{
      clockMinute++;
      const m = clockMinute % 60;
      document.getElementById('clock-line').textContent = `14 MARS — 03:${String(m).padStart(2,'0')}`;
    }, 4000);
  }

  /* ============================================================
     ACTE 1 — Logs réseau + outil de lookup IP
     ============================================================ */

  function renderAct1(){
    const grid = document.getElementById('logs-act1-grid');
    grid.innerHTML = '';
    logs_act1.forEach(l=>{
      const done = foundClues.has(l.clue);
      const div = document.createElement('div');
      div.className = 'card' + (done ? ' done':'');
      div.innerHTML = `
        <h3>${done?'✅':'📁'} ${l.title}</h3>
        ${done ? `<div class="log-output">${l.reveal}</div>`
               : `<button onclick="App.openLog1('${l.id}')">Ouvrir le journal</button>`}
      `;
      grid.appendChild(div);
    });

    const whoisBox = document.getElementById('whois-tool');
    if(foundClues.has('vpn_ip')){
      whoisBox.classList.remove('hidden');
    } else {
      whoisBox.classList.add('hidden');
    }
  }

  function openLog1(id){
    const log = logs_act1.find(l=>l.id===id);
    if(!foundClues.has(log.clue)){
      foundClues.add(log.clue);
      renderAct1(); renderBoard(); updateProgress(); drawGraph();
    }
  }

  function runWhois(){
    const input = document.getElementById('whois-ip').value.trim();
    const result = document.getElementById('whois-result');
    if(input === '185.44.12.9'){
      result.innerHTML = `<div class="log-output">IP: 185.44.12.9
Range: résidentiel
Pays: Belgique
Ville: Bruxelles
FAI: Proximus SA
Type: broadband domestique (non VPN commercial)</div>`;
      if(!foundClues.has('whois')){
        foundClues.add('whois');
        renderBoard(); updateProgress(); drawGraph();
        checkAct1Complete();
      }
    } else {
      result.innerHTML = `<p class="dim" style="color:var(--red)">Aucun résultat pour cette IP. Vérifie l'adresse relevée dans les logs VPN.</p>`;
    }
  }

  function checkAct1Complete(){
    const act1Done = foundClues.has('siem') && foundClues.has('vpn_ip') && foundClues.has('whois');
    if(act1Done){
      document.getElementById('act1-status').textContent = "✅ Acte 1 terminé — Acte 2 débloqué ci-dessous.";
      document.getElementById('act2-panel').classList.remove('locked-panel');
    }
  }

  /* ============================================================
     ACTE 2 — Puzzles : César / Hexadécimal / Chronologie
     ============================================================ */

  function renderAct2(){
    // Chronologie : construit la liste mélangée cliquable
    const pool = document.getElementById('timeline-pool');
    pool.innerHTML = '';
    const shuffled = [...TIMELINE_EVENTS].sort(()=>Math.random()-0.5);
    shuffled.forEach(ev=>{
      const btn = document.createElement('button');
      btn.textContent = ev.label;
      btn.dataset.id = ev.id;
      btn.onclick = ()=>pickTimelineEvent(ev.id, btn);
      pool.appendChild(btn);
    });
    renderTimelineOrder();
  }

  function caesarDecode(str, shift){
    return str.split('').map(ch=>{
      if(ch===' ') return ' ';
      const code = ch.charCodeAt(0);
      if(code>=65 && code<=90) return String.fromCharCode(((code-65-shift+2600)%26)+65);
      return ch;
    }).join('');
  }

  function tryCipher(){
    const val = parseInt(document.getElementById('cipher-shift').value, 10);
    const result = document.getElementById('cipher-result');
    if(isNaN(val)){ result.textContent = "Entre un nombre entre 1 et 25."; return; }
    const decoded = caesarDecode(CIPHER_SOURCE, val);
    result.innerHTML = `Résultat avec décalage ${val} : <strong>${decoded}</strong>`;
    if(decoded === CIPHER_ANSWER && !cipherSolved){
      cipherSolved = true;
      foundClues.add("cipher");
      result.innerHTML += "<br><span style='color:var(--green)'>✅ Message déchiffré !</span>";
      renderBoard(); updateProgress(); drawGraph(); checkAct2Complete();
    }
  }

  function tryHex(){
    const input = document.getElementById('hex-input').value.trim().toUpperCase();
    const result = document.getElementById('hex-result');
    // Convertit l'entrée (supposée en clair) et compare à la réponse attendue
    if(input === HEX_ANSWER){
      result.innerHTML = "<span style='color:var(--green)'>✅ Correct ! Mot de passe identifié.</span>";
      if(!hexSolved){
        hexSolved = true;
        foundClues.add("hexpass");
        renderBoard(); updateProgress(); drawGraph(); checkAct2Complete();
      }
    } else {
      result.innerHTML = "<span class='dim'>Pas encore. Convertis chaque paire hexadécimale en caractère ASCII (table ASCII : 41=A, 42=B... 30=0, 31=1...).</span>";
    }
  }

  function pickTimelineEvent(id, btnEl){
    if(timelineOrder.includes(id)) return;
    timelineOrder.push(id);
    btnEl.disabled = true;
    renderTimelineOrder();
    if(timelineOrder.length === TIMELINE_EVENTS.length){
      checkTimelineOrder();
    }
  }

  function renderTimelineOrder(){
    const box = document.getElementById('timeline-order');
    box.innerHTML = '';
    timelineOrder.forEach((id,i)=>{
      const ev = TIMELINE_EVENTS.find(e=>e.id===id);
      const div = document.createElement('div');
      div.className = 'card';
      div.style.marginBottom='6px';
      div.textContent = `${i+1}. ${ev.label}`;
      box.appendChild(div);
    });
  }

  function checkTimelineOrder(){
    const result = document.getElementById('timeline-result');
    const correct = timelineOrder.every((id,i)=>{
      const ev = TIMELINE_EVENTS.find(e=>e.id===id);
      return ev.order === i+1;
    });
    if(correct){
      result.innerHTML = "<span style='color:var(--green)'>✅ Chronologie correcte ! Le silence radio entre le départ et la nuit de l'attaque est confirmé.</span>";
      if(!timelineSolved){
        timelineSolved = true;
        foundClues.add("timeline");
        renderBoard(); updateProgress(); drawGraph(); checkAct2Complete();
      }
    } else {
      result.innerHTML = `<span style='color:var(--red)'>❌ Ordre incorrect. Réessaie.</span>
        <br><button class="ghost small" onclick="App.resetTimeline()">🔄 Recommencer</button>`;
    }
  }

  function resetTimeline(){
    timelineOrder = [];
    renderAct2();
    document.getElementById('timeline-result').innerHTML = '';
  }

  function checkAct2Complete(){
    if(cipherSolved && hexSolved && timelineSolved && !act2Cleared){
      act2Cleared = true;
      document.getElementById('act2-status').textContent = "✅ Acte 2 terminé — Acte 3 débloqué ci-dessous, et de nouvelles questions d'interrogatoire sont apparues.";
      document.getElementById('act3-panel').classList.remove('locked-panel');
      renderSuspects(); // pour révéler les relances désormais accessibles (elles dépendent d'indices, déjà gérées, mais on rerender par cohérence)
    }
  }

  /* ============================================================
     ACTE 3 — Logs internes (débloqués)
     ============================================================ */

  function renderAct3(){
    const grid = document.getElementById('logs-act3-grid');
    grid.innerHTML = '';
    logs_act3.forEach(l=>{
      const done = foundClues.has(l.clue);
      const div = document.createElement('div');
      div.className = 'card' + (done ? ' done':'');
      div.innerHTML = `
        <h3>${done?'✅':'📁'} ${l.title}</h3>
        ${done ? `<div class="log-output">${l.reveal}</div>`
               : `<button onclick="App.openLog3('${l.id}')">Ouvrir le journal</button>`}
      `;
      grid.appendChild(div);
    });
  }

  function openLog3(id){
    const log = logs_act3.find(l=>l.id===id);
    if(!foundClues.has(log.clue)){
      foundClues.add(log.clue);
      renderAct3(); renderBoard(); updateProgress(); drawGraph();
      renderSuspects(); // débloque potentiellement des relances (ex: Claire après "ad")
    }
  }

  /* ============================================================
     SUSPECTS — questions de base + relances conditionnelles
     ============================================================ */

  function renderSuspects(){
    const list = document.getElementById('suspects-list');
    list.innerHTML = '';
    suspects.forEach(s=>{
      const div = document.createElement('div');
      div.className = 'card'; div.style.marginBottom = '14px';
      div.innerHTML = `
        <h3>${s.name} <span class="badge">${s.role}</span></h3>
        <p class="dim">${s.bio}</p>
        <div class="dialogue" id="dlg-${s.id}"></div>
        <div id="qbuttons-${s.id}"></div>
      `;
      list.appendChild(div);
      renderQuestions(s);
    });
  }

  function renderQuestions(s){
    const box = document.getElementById(`qbuttons-${s.id}`);
    box.innerHTML = '';
    s.questions.forEach((q,i)=>{
      const btn = document.createElement('button');
      btn.textContent = q.q;
      btn.onclick = ()=>askQuestion(s.id, i, false);
      box.appendChild(btn);
    });
    // Relances conditionnelles
    (s.followups||[]).forEach((q,i)=>{
      if(foundClues.has(q.requires)){
        const btn = document.createElement('button');
        btn.textContent = "🔓 " + q.q;
        btn.style.borderColor = 'var(--accent2)';
        btn.onclick = ()=>askQuestion(s.id, i, true);
        box.appendChild(btn);
      }
    });
  }

  function askQuestion(suspectId, qIndex, isFollowup){
    const s = suspects.find(x=>x.id===suspectId);
    const q = isFollowup ? s.followups[qIndex] : s.questions[qIndex];
    const dlg = document.getElementById(`dlg-${suspectId}`);

    const you = document.createElement('div');
    you.className = 'said'; you.textContent = "Toi : " + q.q;
    const them = document.createElement('div');
    them.className = 'said suspect'; them.textContent = s.name + " : " + q.a;
    dlg.appendChild(you); dlg.appendChild(them);

    if(q.clue && !foundClues.has(q.clue)){
      foundClues.add(q.clue);
      renderBoard(); updateProgress(); drawGraph();
      const tag = document.createElement('div');
      tag.className = 'dim'; tag.style.color = 'var(--green)';
      tag.textContent = "✅ Élément retenu pour le dossier.";
      dlg.appendChild(tag);
    }
  }

  /* ============================================================
     TABLEAU D'INDICES / PROGRESSION / INDICES D'AIDE
     ============================================================ */

  function renderBoard(){
    const box = document.getElementById('clues-found');
    if(foundClues.size===0){ box.innerHTML = '<em class="dim">Aucun indice retenu pour le moment.</em>'; return; }
    box.innerHTML = '';
    foundClues.forEach(id=>{
      const def = CLUE_DEFS[id];
      if(!def) return;
      const div = document.createElement('div');
      div.className = 'clue'; div.textContent = def.text;
      box.appendChild(div);
    });
  }

  function updateProgress(){
    const count = foundClues.size;
    document.getElementById('progress-fill').style.width = Math.min(100,(count/TOTAL_STEPS)*100)+'%';
    document.getElementById('progress-text').textContent = `${count} / ${TOTAL_STEPS} éléments d'enquête complétés`;
    document.getElementById('score-live').textContent = `Score: ${computeScore().score}`;
    document.getElementById('hint-count').textContent = hintsUsed>0 ? ` (${hintsUsed} indice(s) utilisé(s), -${hintsUsed*15} pts)` : '';
  }

  function useHint(){
    if(hintsUsed >= HINTS.length){ alert("Plus d'indices disponibles !"); return; }
    alert("💡 Indice : " + HINTS[hintsUsed]);
    hintsUsed++;
    updateProgress();
  }

  /* ============================================================
     GRAPHE DE CORRÉLATION (canvas)
     ============================================================ */

  function drawGraph(){
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);

    const suspectNodes = suspects.map((s,i)=>({ id:s.id, label:s.name.split(' ')[0], x:120, y:50+i*80 }));
    const evidenceNodes = [
      {id:'vpn-log', label:'Logs VPN/SIEM', x:700, y:30},
      {id:'cipher-log', label:'Note déchiffrée', x:700, y:90},
      {id:'hex-log', label:'Mot de passe hex', x:700, y:150},
      {id:'timeline-log', label:'Chronologie', x:700, y:210},
      {id:'ad-log', label:'Active Directory', x:700, y:270},
      {id:'mail-log', label:'Messagerie', x:700, y:330},
    ];

    ctx.lineWidth = 2;
    foundClues.forEach(id=>{
      const def = CLUE_DEFS[id];
      if(!def || !def.node) return;
      const ev = evidenceNodes.find(e=>e.id===def.node);
      if(!ev) return;
      const targetSuspect = def.points ? 'julien' : (id.includes('marc')?'marc':'sarah');
      const sn = suspectNodes.find(s=>s.id===targetSuspect);
      if(!sn) return;
      ctx.strokeStyle = def.points ? 'rgba(255,180,84,0.7)' : 'rgba(107,125,146,0.5)';
      ctx.beginPath();
      ctx.moveTo(sn.x+40, sn.y);
      ctx.lineTo(ev.x-75, ev.y);
      ctx.stroke();
    });

    suspectNodes.forEach(n=>{
      const isCulprit = n.id===CULPRIT;
      const strong = isCulprit && foundClues.size>=7;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 32, 0, Math.PI*2);
      ctx.fillStyle = strong ? 'rgba(255,123,114,0.18)' : 'rgba(79,209,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = strong ? '#ff7b72' : '#4fd1ff';
      ctx.stroke();
      ctx.fillStyle = '#c9d6e3';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y+4);
    });

    evidenceNodes.forEach(n=>{
      const active = Array.from(foundClues).some(id=>CLUE_DEFS[id] && CLUE_DEFS[id].node===n.id);
      const w=140,h=32;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(n.x-w/2, n.y-h/2, w, h, 6); else ctx.rect(n.x-w/2, n.y-h/2, w, h);
      ctx.fillStyle = active ? 'rgba(126,231,135,0.12)' : 'rgba(107,125,146,0.06)';
      ctx.fill();
      ctx.strokeStyle = active ? '#7ee787' : '#233247';
      ctx.stroke();
      ctx.fillStyle = active ? '#7ee787' : '#6b7d92';
      ctx.font = '10.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y+4);
    });
  }

  /* ============================================================
     ACCUSATION FINALE — sélection multi-preuves + suspect
     ============================================================ */

  function renderAccusationForm(){
    const sel = document.getElementById('accuse-select');
    sel.innerHTML = '<option value="">-- Choisir un suspect --</option>';
    suspects.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name;
      sel.appendChild(opt);
    });

    const evBox = document.getElementById('evidence-picker');
    evBox.innerHTML = '';
    if(foundClues.size===0){
      evBox.innerHTML = '<p class="dim">Aucune preuve collectée — retourne enquêter avant de rédiger le rapport.</p>';
      return;
    }
    foundClues.forEach(id=>{
      const def = CLUE_DEFS[id];
      if(!def) return;
      const label = document.createElement('label');
      label.style.display='block'; label.style.margin='6px 0'; label.style.fontSize='13px';
      label.innerHTML = `<input type="checkbox" class="ev-checkbox" value="${id}"> ${def.text}`;
      evBox.appendChild(label);
    });
  }

  function goToAccusation(){
    document.getElementById('game-sections').style.display='none';
    const sec = document.getElementById('sec-accuse');
    sec.style.display='block';
    renderAccusationForm();
    sec.scrollIntoView({behavior:'smooth'});
  }

  function computeScore(){
    let score = 0, maxScore = 0;
    Object.values(CLUE_DEFS).forEach(c=>{ if(c.points) maxScore += c.weight; });
    foundClues.forEach(id=>{
      const def = CLUE_DEFS[id];
      if(def && def.points) score += def.weight;
    });
    score -= hintsUsed * 15;
    return { score: Math.max(0,score), maxScore, pct: Math.min(100, Math.round((Math.max(0,score)/maxScore)*100)) };
  }

  function accuse(){
    const chosen = document.getElementById('accuse-select').value;
    if(!chosen){ alert("Choisis un suspect avant d'envoyer le rapport."); return; }

    const checked = Array.from(document.querySelectorAll('.ev-checkbox:checked')).map(c=>c.value);
    if(checked.length===0){ alert("Sélectionne au moins une preuve à joindre au rapport."); return; }

    // Précision/rappel sur les preuves choisies parmi celles qui sont réellement à charge (points:true)
    const relevantAvailable = Array.from(foundClues).filter(id=>CLUE_DEFS[id] && CLUE_DEFS[id].points);
    const truePositives = checked.filter(id=>relevantAvailable.includes(id));
    const falsePositives = checked.filter(id=>!relevantAvailable.includes(id));
    const precision = checked.length ? truePositives.length/checked.length : 0;
    const recall = relevantAvailable.length ? truePositives.length/relevantAvailable.length : 0;
    const f1 = (precision+recall)>0 ? (2*precision*recall)/(precision+recall) : 0;

    const { score, maxScore } = computeScore();
    const finalPct = Math.round(f1*100);
    const correct = (chosen === CULPRIT);

    document.getElementById('game-sections').style.display='none';
    document.getElementById('sec-accuse').style.display='none';
    const end = document.getElementById('sec-end');
    end.style.display='block';

    let rankLabel, rankColor;
    if(!correct){ rankLabel = "❌ ERREUR D'ATTRIBUTION"; rankColor = "var(--red)"; }
    else if(finalPct >= 85){ rankLabel = "🥇 ANALYSTE CONFIRMÉ"; rankColor = "var(--green)"; }
    else if(finalPct >= 55){ rankLabel = "🥈 DOSSIER ACCEPTABLE"; rankColor = "var(--accent2)"; }
    else { rankLabel = "🥉 DOSSIER FRAGILE"; rankColor = "var(--accent)"; }

    document.getElementById('end-title').textContent = correct ? "Rapport envoyé à la direction" : "Rapport rejeté par la direction";
    const rankEl = document.getElementById('end-rank');
    rankEl.textContent = rankLabel; rankEl.style.color = rankColor;

    const text = document.getElementById('end-text');
    if(correct){
      text.innerHTML = `Tu as désigné <strong>Julien Faure</strong>, appuyé par ${checked.length} preuve(s) jointes (précision ${Math.round(precision*100)}%, rappel ${Math.round(recall*100)}%). ${falsePositives.length>0 ? "Attention : certaines preuves jointes sont des impasses qui affaiblissent ton dossier." : "Toutes les preuves jointes sont pertinentes — excellent travail."}`;
    } else {
      const wrong = suspects.find(x=>x.id===chosen).name;
      text.innerHTML = `Tu as désigné <strong>${wrong}</strong>, mais l'ensemble des preuves solides (IP belge, compte jamais désactivé, note déchiffrée, aveu implicite en interrogatoire) pointait vers Julien Faure.`;
    }

    document.getElementById('end-rapport').innerHTML = `
      <h3>📎 Preuves jointes au rapport</h3>
      <ul class="rap">${checked.map(id=>`<li>${CLUE_DEFS[id] ? CLUE_DEFS[id].text : id}</li>`).join('')}</ul>
      <p class="dim">💡 En vrai SOC : ce scénario illustre l'importance d'un <strong>processus d'offboarding rigoureux</strong> et de la <strong>corrélation multi-sources</strong> pour qualifier un incident — et celle de ne joindre à un rapport que des preuves réellement probantes.</p>
    `;

    saveBestScore(correct ? Math.round(score * f1) : 0);
    window._lastReport = buildReportText(correct, checked, precision, recall, chosen);
  }

  function buildReportText(correct, checked, precision, recall, chosenId){
    const chosenName = suspects.find(s=>s.id===chosenId).name;
    return [
      "=== RAPPORT D'INCIDENT — SecuriTech Corp ===",
      `Date de l'incident : 14 mars, 03:41`,
      `Analyste : Toi (SOC junior, astreinte de nuit)`,
      "",
      `Suspect désigné : ${chosenName}`,
      `Conclusion correcte : ${correct ? "OUI" : "NON"}`,
      `Précision du dossier : ${Math.round(precision*100)}%`,
      `Rappel du dossier : ${Math.round(recall*100)}%`,
      `Indices d'aide utilisés : ${hintsUsed}`,
      "",
      "--- Preuves jointes ---",
      ...checked.map(id=>CLUE_DEFS[id] ? "- " + CLUE_DEFS[id].text : ""),
      "",
      "Généré par NIGHT SHIFT — jeu d'enquête cybersécurité."
    ].join('\n');
  }

  function downloadReport(){
    const text = window._lastReport || "Aucun rapport disponible.";
    const blob = new Blob([text], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rapport-incident-securitech.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Best score (localStorage) ---------- */

  function saveBestScore(score){
    const best = parseInt(localStorage.getItem('nightshift_best') || '0', 10);
    if(score > best) localStorage.setItem('nightshift_best', String(score));
  }
  function loadBestScore(){
    const best = localStorage.getItem('nightshift_best');
    const box = document.getElementById('best-score-box');
    if(best) box.textContent = `🏆 Meilleur score enregistré : ${best} pts`;
  }
  document.addEventListener('DOMContentLoaded', loadBestScore);

  return {
    showHowTo, hideHowTo, startBriefing, startGame,
    openLog1, runWhois, tryCipher, tryHex, resetTimeline,
    openLog3, useHint, goToAccusation, accuse, downloadReport
  };
})();
