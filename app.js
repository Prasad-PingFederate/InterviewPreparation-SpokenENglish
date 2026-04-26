// -- STATE ------------------------------------------
let apiKeyValue = '';
let sessionHistory = JSON.parse(localStorage.getItem('sp_history') || '[]');
let sessionCounts = JSON.parse(localStorage.getItem('sp_counts') || '{"text":0,"voice":0,"video":0,"eval":0}');
let recognition = null;
let isRecording = false;
let voiceMode = 'ask'; // 'ask' | 'answer'
let voiceAnswer = '';
let mediaRecorder = null;
let recordedChunks = [];
let liveStream = null;
let liveRecognition = null;
let liveTranscript = '';
let videoRecording = false;
let evalFocus = 'all';
let currentSpeech = null;

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const QUICK_Q = {
  'Java Developer':['Explain JVM architecture','HashMap vs ConcurrentHashMap','What is garbage collection?','Java 8 Stream API','Multithreading in Java'],
  'Python Developer':['GIL in Python explained','List vs Tuple vs Set','Decorators in Python','Generators vs Iterators','Django vs Flask vs FastAPI'],
  'React / Frontend':['Virtual DOM explained','useEffect vs useLayoutEffect','Context API vs Redux','React reconciliation','Custom hooks best practices'],
  'Data Scientist':['Bias vs Variance tradeoff','Explain Random Forest','Cross-validation techniques','Feature engineering tips','Neural network basics'],
  'DevOps Engineer':['Docker vs VM differences','CI/CD pipeline design','Kubernetes pods & services','Infrastructure as code','Blue-green deployment'],
  'SQL / Database':['INNER vs LEFT JOIN','Indexing strategies','ACID properties explained','Stored procedures vs functions','Query optimization tips'],
  'System Design':['Design a URL shortener','CAP theorem explained','Load balancing strategies','Microservices vs Monolith','Database sharding'],
  'Behavioral / HR':['Tell me about yourself','Greatest weakness honestly','Why this company?','Conflict resolution example','Where do you see yourself in 5 years?'],
  'Spoken English':['Introduce yourself professionally','Describe your strengths','How do you handle pressure?','Talk about a challenge you overcame','Career goals speech'],
  'Product Manager':['What is product-market fit?','How do you prioritize features?','Explain your product roadmap','Handling stakeholder conflicts','Metrics for product success'],
};

// -- INIT -------------------------------------------
window.onload = () => {
  loadKey();
  updateQuickQuestions();
  initCamera();
  renderDashboard();
};

// -- API KEY ----------------------------------------
function loadKey() {
  const k = sessionStorage.getItem('sp_key');
  if (k) { document.getElementById('apiKey').value = k; apiKeyValue = k; checkKey(); }
}

function checkKey() {
  const k = document.getElementById('apiKey').value.trim();
  apiKeyValue = k;
  const st = document.getElementById('apiStatus');
  if (k.startsWith('sk-ant-') && k.length > 30) {
    st.textContent = '? Connected'; st.className = 'api-status ok';
    sessionStorage.setItem('sp_key', k);
  } else {
    st.textContent = '? Not connected'; st.className = 'api-status err';
  }
}

// -- CLAUDE API -------------------------------------
async function callClaude(prompt, systemMsg, maxTokens = 1500) {
  if (!apiKeyValue.startsWith('sk-ant-')) {
    showToast('?? Please enter your Anthropic API key!'); return null;
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKeyValue, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: maxTokens, system: systemMsg, messages: [{ role: 'user', content: prompt }] })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || 'API error');
  return d.content[0].text;
}

// -- NAVIGATION -------------------------------------
function switchTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + tab);
  const nav = document.getElementById('nav-' + tab);
  if (panel) panel.classList.add('active');
  if (nav) nav.classList.add('active');
  
  const titles = { 
    text: '📝 Text Practice', 
    voice: '🎙 Voice Mode', 
    video: '📹 Video Mode', 
    evaluate: '🧠 Evaluate Me', 
    resume: '📄 Resume Builder', 
    dashboard: '📊 Dashboard',
    mock: '🎯 Mock Interview',
    bank: '📚 Question Bank',
    flash: '🃏 Flashcards',
    jobeval: '🔍 Job Evaluator',
    tracker: '📋 Job Tracker',
    stories: '⭐ STAR Stories',
    outreach: '💼 LinkedIn Outreach',
    salary: '💰 Salary Negotiator'
  };
  
  const titleEl = document.getElementById('topBarTitle');
  if (titleEl) titleEl.textContent = titles[tab] || tab;
  
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'tracker' && typeof updateTrackerUI === 'function') updateTrackerUI();
  if (tab === 'stories' && typeof updateStoryList === 'function') updateStoryList();
  
  if (window.innerWidth <= 700) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function updateQuickQuestions() {
  const role = document.getElementById('jobRole').value;
  const qs = QUICK_Q[role] || [];
  const container = document.getElementById('quickQuestions');
  if (container) {
    container.innerHTML = qs.map(q =>
      \<button class="quick-btn" onclick="setQuestion('\')">📝 \</button>\
    ).join('');
  }
}

function setQuestion(q) { 
  const input = document.getElementById('textQuestion');
  if (input) input.value = q; 
}

function fmt(text) {
  return text
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre>$2</pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^##\s*(.*)/gm, '<div class="res-h2">$1</div>')
    .replace(/^###\s*(.*)/gm, '<div class="res-h3">$1</div>')
    .replace(/??(.*)/g, '<div class="key-takeaway">??$1</div>')
    .replace(/?(.*)/g, '<div class="tip-line">?$1</div>')
    .replace(/?(.*)/g, '<div class="err-line">?$1</div>')
    .replace(/\n/g, '<br>');
}

// inject inline styles for fmt classes once
const fmtStyle = document.createElement('style');
fmtStyle.textContent = `
  .res-h2{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent2);margin:14px 0 6px;}
  .res-h3{font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:var(--accent);margin:10px 0 4px;}
  .key-takeaway{background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:12px;margin-top:14px;font-family:'Syne',sans-serif;font-weight:600;}
  .tip-line{color:var(--accent3);margin:4px 0;}
  .err-line{color:var(--warn);margin:4px 0;}
`;
document.head.appendChild(fmtStyle);

// -- TEXT MODE --------------------------------------
async function askTextQuestion() {
  const q = document.getElementById('textQuestion').value.trim();
  if (!q) { showToast('Please enter a question!'); return; }
  const role = document.getElementById('jobRole').value;
  const exp = document.getElementById('expLevel').value;
  const style = document.getElementById('answerStyle').value;
  const btn = document.getElementById('textSendBtn');
  const box = document.getElementById('textResponse');

  btn.disabled = true; btn.querySelector('span:last-child').textContent = 'Thinking…';
  box.style.display = 'block';
  box.innerHTML = thinking('Generating expert answer…');

  const sys = `You are an elite interview coach and ${role} expert with 15+ years experience.
Help a ${exp} candidate. Answer style: ${style}.
Format: use **bold** for key terms, ## for sections, bullet points.
End with a "?? Key Takeaway:" section (1-2 lines).`;

  try {
    const ans = await callClaude(q, sys);
    box.innerHTML = `
      <div class="res-header">
        <h3 class="res-title">?? AI Expert Answer</h3>
        <div class="res-actions">
          <button class="icon-btn" onclick="copyEl('textBodyContent')">?? Copy</button>
          <button class="icon-btn" onclick="speakText('textBodyContent')">?? Read</button>
        </div>
      </div>
      <div class="res-body" id="textBodyContent">${fmt(ans)}</div>`;
    addHistory(q, role, 'text');
    incrementCount('text');
  } catch (e) {
    box.innerHTML = `<div style="color:var(--warn);padding:10px">? ${e.message}</div>`;
  }
  btn.disabled = false; btn.querySelector('span:last-child').textContent = 'Get Expert Answer';
}

function copyResponse() { copyEl('textBodyContent'); }

// -- VOICE MODE -------------------------------------
function setVoiceMode(mode) {
  voiceMode = mode;
  document.getElementById('vtog-ask').classList.toggle('active', mode === 'ask');
  document.getElementById('vtog-answer').classList.toggle('active', mode === 'answer');
  document.getElementById('voiceAnswerSetup').style.display = mode === 'answer' ? 'block' : 'none';
  document.getElementById('voiceFeedbackArea').innerHTML = '';
  document.getElementById('voiceTranscript').textContent = 'Your words will appear here in real time…';
  document.getElementById('voiceStatus').textContent = 'Click the mic to start speaking';
}

function toggleRecording() {
  if (!SR) { showToast('Speech recognition needs Chrome or Edge'); return; }
  isRecording ? stopVoiceRec() : startVoiceRec();
}

function startVoiceRec() {
  recognition = new SR();
  recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US';
  let full = '';
  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('micRing').classList.add('active');
    document.getElementById('micBtn').textContent = '?';
    document.getElementById('voiceStatus').textContent = '?? Listening… Speak now';
    document.getElementById('waveform').classList.add('active');
    document.getElementById('voiceTranscript').textContent = '';
  };
  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) full += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('voiceTranscript').textContent = full + interim;
  };
  recognition.onend = () => { if (full.trim()) processVoiceInput(full.trim()); };
  recognition.start();
}

function stopVoiceRec() {
  isRecording = false;
  if (recognition) recognition.stop();
  document.getElementById('micRing').classList.remove('active');
  document.getElementById('micBtn').textContent = '??';
  document.getElementById('waveform').classList.remove('active');
  document.getElementById('voiceStatus').textContent = '? Processing…';
}

async function processVoiceInput(text) {
  const role = document.getElementById('jobRole').value;
  const exp = document.getElementById('expLevel').value;
  document.getElementById('voiceStatus').textContent = '? Analysing & generating feedback…';
  const area = document.getElementById('voiceFeedbackArea');
  area.innerHTML = thinking('Analysing your speech…');

  if (voiceMode === 'ask') {
    const sys = `You are an expert English coach AND ${role} interview expert.
Given a spoken question (may have grammar errors), do TWO things:
1. Output corrected English version labelled "CORRECTED:"
2. Provide a thorough interview answer labelled "ANSWER:" formatted with ** for bold, ## for sections.
End the ANSWER with ?? Key Takeaway.`;
    try {
      const res = await callClaude(`Spoken input: "${text}"`, sys);
      const corrMatch = res.match(/CORRECTED:([\s\S]*?)ANSWER:/i);
      const ansMatch = res.match(/ANSWER:([\s\S]*)/i);
      const corrected = corrMatch ? corrMatch[1].trim() : text;
      const answer = ansMatch ? ansMatch[1].trim() : res;
      voiceAnswer = answer;
      area.innerHTML = `
        <div class="correction-block">
          <div class="block-label">? Corrected English</div>
          <div style="font-size:14px;line-height:1.7;">${corrected}</div>
        </div>
        <div class="response-card">
          <div class="res-header">
            <h3 class="res-title">?? AI Answer</h3>
            <div class="res-actions">
              <button class="icon-btn" onclick="copyEl('vAnswerBody')">?? Copy</button>
              <button class="speak-answer-btn" onclick="speakText('vAnswerBody')">?? Play Answer</button>
            </div>
          </div>
          <div class="res-body" id="vAnswerBody">${fmt(answer)}</div>
        </div>`;
      document.getElementById('voiceStatus').textContent = '? Done!';
      addHistory(corrected, role, 'voice'); incrementCount('voice');
    } catch (e) { area.innerHTML = `<div style="color:var(--warn)">? ${e.message}</div>`; document.getElementById('voiceStatus').textContent = 'Error occurred'; }
  } else {
    // EVALUATE mode
    const question = document.getElementById('voicePracticeQ').value.trim() || 'General interview question';
    await evaluateVoiceAnswer(text, question, role, exp, area);
  }
}

async function evaluateVoiceAnswer(answer, question, role, exp, container) {
  const sys = `You are a brutally honest but encouraging interview coach specialising in ${role} interviews and English communication.
The candidate (${exp}) spoke an answer to an interview question.
Analyse and return JSON only:
{
  "overallScore": <0-100>,
  "grammarScore": <0-100>,
  "contentScore": <0-100>,
  "fluencyScore": <0-100>,
  "correctedAnswer": "<rewritten version in perfect professional English>",
  "grammarMistakes": [{"wrong":"...","right":"...","explanation":"..."}],
  "contentFeedback": "<brutal honest feedback on content quality>",
  "fillerWords": ["list"],
  "encouragement": "<2-3 sentences of genuine, warm encouragement noting real strengths>"
}`;
  try {
    const res = await callClaude(`Question: "${question}"\nSpoken Answer: "${answer}"`, sys, 1800);
    const data = JSON.parse(res.replace(/```json|```/g,'').trim());
    renderVoiceEval(data, container);
    incrementCount('voice');
  } catch(e) {
    container.innerHTML = `<div style="color:var(--warn)">? ${e.message}</div>`;
  }
}

function renderVoiceEval(d, container) {
  const color = v => v >= 75 ? 'var(--accent3)' : v >= 50 ? 'var(--accent)' : 'var(--warn)';
  const mistakes = (d.grammarMistakes || []).map(m =>
    `<div class="mistake-item"><span>? <span class="mistake-wrong">${m.wrong}</span> ? ? <span class="mistake-right">${m.right}</span> — <em style="color:var(--muted)">${m.explanation}</em></span></div>`
  ).join('') || '<div style="color:var(--accent3);font-size:13px">? No major grammar mistakes found!</div>';

  container.innerHTML = `
    <div class="response-card">
      <div class="res-header"><h3 class="res-title">?? Your Performance</h3></div>
      <div class="score-grid">
        ${['overallScore','grammarScore','contentScore','fluencyScore'].map(k => `
          <div class="score-card">
            <div class="score-num" style="color:${color(d[k])}">${d[k]}</div>
            <div class="score-lbl">${k.replace('Score','')}</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${d[k]}%"></div></div>
          </div>`).join('')}
      </div>
      <div style="margin-bottom:14px;">
        <div class="eval-section-title" style="color:var(--warn);margin-bottom:8px;">? Grammar Corrections</div>
        ${mistakes}
      </div>
      <div class="correction-block">
        <div class="block-label">? How You Should Have Said It</div>
        <div style="font-size:13px;line-height:1.7;font-style:italic;">${d.correctedAnswer || ''}</div>
      </div>
      ${d.fillerWords && d.fillerWords.length ? `<div style="background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.2);border-radius:10px;padding:12px;margin-top:12px;font-size:13px;"><strong style="color:var(--warn)">?? Filler Words:</strong> ${d.fillerWords.join(', ')}</div>` : ''}
      <div class="encourage-block" style="margin-top:14px;">
        <div class="block-label">?? Coach's Encouragement</div>
        <div style="font-size:14px;line-height:1.7;">${d.encouragement || ''}</div>
      </div>
    </div>`;
}

// -- VIDEO MODE -------------------------------------
async function initCamera() {
  try {
    liveStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('liveVideo').srcObject = liveStream;
  } catch(e) { console.warn('Camera not available:', e.message); }
}

function toggleRecord() {
  videoRecording ? stopVideoRecord() : startVideoRecord();
}

function startVideoRecord() {
  if (!liveStream) { showToast('Camera access required!'); initCamera(); return; }
  recordedChunks = []; liveTranscript = '';
  try { mediaRecorder = new MediaRecorder(liveStream, { mimeType: 'video/webm;codecs=vp9,opus' }); }
  catch(e) { mediaRecorder = new MediaRecorder(liveStream); }
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.start(100);
  videoRecording = true;
  document.getElementById('recBtn').textContent = '? Stop Recording';
  document.getElementById('recBtn').style.background = 'linear-gradient(135deg,#ef4444,#991b1b)';
  document.getElementById('recIndicator').classList.add('active');
  document.getElementById('playbackBtn').disabled = true;
  document.getElementById('analyseBtn').disabled = true;
  document.getElementById('feedbackBox').style.display = 'none';
  document.getElementById('liveTranscriptMini').textContent = 'Live transcript appears here as you speak?';
  if (SR) {
    liveRecognition = new SR();
    liveRecognition.continuous = true; liveRecognition.interimResults = true; liveRecognition.lang = 'en-US';
    liveRecognition.onresult = e => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
      liveTranscript = t;
      document.getElementById('liveTranscriptMini').textContent = t;
    };
    try { liveRecognition.start(); } catch(e) {}
  }
}

function stopVideoRecord() {
  if (mediaRecorder) mediaRecorder.stop();
  if (liveRecognition) { try { liveRecognition.stop(); } catch(e) {} }
  videoRecording = false;
  document.getElementById('recBtn').textContent = '? Start Recording';
  document.getElementById('recBtn').style.background = '';
  document.getElementById('recIndicator').classList.remove('active');
  document.getElementById('playbackBtn').disabled = false;
  document.getElementById('analyseBtn').disabled = false;
  setTimeout(() => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    document.getElementById('playbackVideo').src = URL.createObjectURL(blob);
  }, 300);
}

function playRecording() {
  const v = document.getElementById('playbackVideo');
  if (v.src) v.play(); else showToast('No recording yet.');
}

async function analyseVideo() {
  const q = document.getElementById('videoQuestion').value.trim() || 'General self-introduction';
  const transcript = liveTranscript.trim();
  if (!transcript) { showToast('No speech detected! Please record yourself speaking.'); return; }
  const role = document.getElementById('jobRole').value;
  const exp = document.getElementById('expLevel').value;
  const btn = document.getElementById('analyseBtn');
  btn.disabled = true; btn.textContent = '? Analysing?';
  const fb = document.getElementById('feedbackBox');
  fb.style.display = 'block';
  document.getElementById('scoreRow').innerHTML = '';
  document.getElementById('feedbackContent').innerHTML = thinking('Running deep AI analysis?');

  const sys = `You are an elite interview coach analysing a video interview response for ${role} (${exp}).
Analyse the transcript and return valid JSON only:
{
  "scores": { "content": <0-100>, "clarity": <0-100>, "confidence": <0-100>, "grammar": <0-100>, "overall": <0-100> },
  "feedback": "Detailed feedback with **Strengths:** and **Areas to Improve:** sections. Be brutally honest about weaknesses.",
  "fillerWords": ["list","detected"],
  "topTip": "One most important actionable tip",
  "encouragement": "2 sentences of genuine encouragement"
}`;
  try {
    const res = await callClaude(`Question: "${q}"\nRole: ${role}, Level: ${exp}\nAnswer transcript:\n"${transcript}"`, sys, 1800);
    const data = JSON.parse(res.replace(/```json|```/g, '').trim());
    renderVideoFeedback(data);
    addHistory(q, role, 'video'); incrementCount('video');
  } catch(e) {
    document.getElementById('feedbackContent').innerHTML = `<span style="color:var(--warn)">? ${e.message}</span>`;
  }
  btn.disabled = false; btn.textContent = '?? Analyse';
}

function renderVideoFeedback(data) {
  const color = v => v >= 75 ? 'var(--accent3)' : v >= 50 ? 'var(--accent)' : 'var(--warn)';
  const scores = data.scores || {};
  document.getElementById('scoreRow').innerHTML = Object.entries(scores).map(([k, v]) => `
    <div class="score-card">
      <div class="score-num" style="color:${color(v)}">${v}</div>
      <div class="score-lbl">${k}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${v}%"></div></div>
    </div>`).join('');
  let extra = '';
  if (data.fillerWords && data.fillerWords.length)
    extra += `<div style="background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.2);border-radius:10px;padding:12px;margin-top:12px;font-size:13px;"><strong style="color:var(--warn)">?? Filler Words Detected:</strong> ${data.fillerWords.join(', ')}</div>`;
  if (data.topTip)
    extra += `<div style="background:rgba(0,255,157,0.08);border:1px solid rgba(0,255,157,0.2);border-radius:10px;padding:12px;margin-top:10px;font-size:13px;"><strong style="color:var(--accent3)">?? Top Tip:</strong> ${data.topTip}</div>`;
  if (data.encouragement)
    extra += `<div class="encourage-block" style="margin-top:12px;"><div class="block-label">?? Encouragement</div><div style="font-size:13px;line-height:1.7">${data.encouragement}</div></div>`;
  document.getElementById('feedbackContent').innerHTML = fmt(data.feedback || '') + extra;
}

function copyFeedback() { copyEl('feedbackContent'); }

// -- EVALUATE ME ------------------------------------
function setFocus(focus) {
  evalFocus = focus;
  document.querySelectorAll('.focus-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('focus-' + focus).classList.add('active');
}

async function evaluateAnswer() {
  const q = document.getElementById('evalQuestion').value.trim();
  const a = document.getElementById('evalAnswer').value.trim();
  if (!q) { showToast('Please enter the question!'); return; }
  if (!a) { showToast('Please write your answer first!'); return; }
  const role = document.getElementById('jobRole').value;
  const exp = document.getElementById('expLevel').value;
  const btn = document.getElementById('evalBtn');
  btn.disabled = true; btn.querySelector('span:last-child').textContent = 'Evaluating?';
  const result = document.getElementById('evalResult');
  result.style.display = 'block';
  result.innerHTML = thinking('Analysing your answer with brutal honesty?');

  const sys = `You are a brutally honest, no-nonsense interview coach for ${role} (${exp} level).
Focus area: ${evalFocus}.
Evaluate the candidate's written answer and return JSON only:
{
  "overallScore": <0-100>,
  "grade": "<A+|A|B|C|D|F>",
  "grammarMistakes": [{"wrong":"...","right":"...","explanation":"..."}],
  "contentIssues": ["specific issue 1", "specific issue 2"],
  "strengths": ["strength 1", "strength 2"],
  "improvedAnswer": "<rewrite the answer professionally and completely>",
  "encouragement": "<2-3 sentences warm encouragement, mention specific good points>"
}
Be BRUTALLY honest about grammar and content mistakes. Don't sugarcoat. But end with genuine encouragement.`;

  try {
    const res = await callClaude(`Question: "${q}"\n\nCandidate's Answer: "${a}"`, sys, 2000);
    const data = JSON.parse(res.replace(/```json|```/g, '').trim());
    renderEvalResult(data, result);
    addHistory(q, role, 'eval'); incrementCount('eval');
  } catch(e) {
    result.innerHTML = `<div style="color:var(--warn)">? ${e.message}</div>`;
  }
  btn.disabled = false; btn.querySelector('span:last-child').textContent = 'Evaluate My Answer';
}

function renderEvalResult(d, container) {
  const score = d.overallScore || 0;
  const color = score >= 75 ? 'var(--accent3)' : score >= 50 ? 'var(--accent)' : 'var(--warn)';
  const grade = d.grade || 'N/A';
  const mistakes = (d.grammarMistakes || []).slice(0, 8).map(m =>
    `<div class="mistake-item">? <span class="mistake-wrong">"${m.wrong}"</span> ? ? <span class="mistake-right">"${m.right}"</span><br><em style="color:var(--muted);font-size:12px">${m.explanation}</em></div>`
  ).join('') || '<div style="color:var(--accent3);font-size:13px;padding:8px 0">? Grammar is solid!</div>';
  const issues = (d.contentIssues || []).map(i => `<div style="margin:4px 0;font-size:13px"> ${i}</div>`).join('') || '<div style="color:var(--accent3);font-size:13px">? Content is well-structured!</div>';
  const strengths = (d.strengths || []).map(s => `<div style="margin:4px 0;font-size:13px;color:var(--accent3)">? ${s}</div>`).join('');

  container.innerHTML = `
    <div class="response-card">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--bg3),var(--bg2));border:3px solid ${color};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">
          <div style="font-family:Syne,sans-serif;font-size:26px;font-weight:800;color:${color}">${score}</div>
          <div style="font-size:10px;color:var(--muted);font-family:JetBrains Mono,monospace">SCORE</div>
        </div>
        <div>
          <div style="font-family:Syne,sans-serif;font-size:28px;font-weight:800;color:${color}">Grade: ${grade}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px">Focus: ${evalFocus} evaluation</div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <div class="eval-section-title" style="color:var(--warn)">? Grammar Mistakes (Fix These!)</div>
        ${mistakes}
      </div>
      <div style="margin-bottom:16px;">
        <div class="eval-section-title" style="color:var(--warn)">?? Content Issues</div>
        ${issues}
      </div>
      <div style="margin-bottom:16px;">
        <div class="eval-section-title" style="color:var(--accent3)">? Your Strengths</div>
        ${strengths}
      </div>
      <div class="correction-block">
        <div class="block-label">?? How a Perfect Answer Looks</div>
        <div style="font-size:13px;line-height:1.8;font-style:italic;color:var(--text)">${(d.improvedAnswer||'').replace(/\n/g,'<br>')}</div>
      </div>
      <div class="encourage-block" style="margin-top:14px;">
        <div class="block-label">?? Your Coach Says</div>
        <div style="font-size:14px;line-height:1.7">${d.encouragement||''}</div>
      </div>
    </div>`;
}

// -- RESUME BUILDER ---------------------------------
async function generateResume() {
  const name = document.getElementById('rName').value.trim();
  const role = document.getElementById('rRole').value.trim();
  if (!name || !role) { showToast('Please fill in your name and target role!'); return; }
  const btn = document.getElementById('resumeGenBtn');
  btn.disabled = true; btn.querySelector('span:last-child').textContent = 'Generating?';
  const preview = document.getElementById('resumePreview');
  preview.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#555">${thinking('Crafting your professional resume...')}</div>`;

  const data = {
    name, role, email: document.getElementById('rEmail').value,
    phone: document.getElementById('rPhone').value,
    linkedin: document.getElementById('rLinkedin').value,
    location: document.getElementById('rLocation').value,
    experience: document.getElementById('rExperience').value,
    skills: document.getElementById('rSkills').value,
    education: document.getElementById('rEducation').value,
    achievements: document.getElementById('rAchievements').value,
  };

  const sys = `You are a world-class resume writer and career coach. 
Create a professional, ATS-optimised resume in clean HTML sections (no full HTML/body tags).
Use these exact div classes for styling: rv-name, rv-role, rv-contact, rv-section-title, rv-content, rv-bullet.
Make bullet points start with strong action verbs. Quantify achievements. Keep it 1 page worth.
Return ONLY the HTML content, no explanation.`;

  const prompt = `Create a professional resume for:
Name: ${data.name}
Target Role: ${data.role}
Email: ${data.email} | Phone: ${data.phone} | Location: ${data.location}
LinkedIn: ${data.linkedin}
Experience: ${data.experience}
Skills: ${data.skills}
Education: ${data.education}
Achievements/Projects: ${data.achievements}`;

  try {
    const html = await callClaude(prompt, sys, 2000);
    preview.innerHTML = html;
    document.getElementById('downloadResumeBtn').style.display = 'inline-flex';
    showToast('✅ Resume generated!');
  } catch(e) {
    preview.innerHTML = `<div style="color:red;padding:20px">? ${e.message}</div>`;
  }
  btn.disabled = false; btn.querySelector('span:last-child').textContent = 'Generate My Resume';
}

function downloadResume() {
  const content = document.getElementById('resumePreview').innerHTML;
  const name = document.getElementById('rName').value || 'resume';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name} Resume</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>body{font-family:'DM Sans',sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#111;line-height:1.6;}
.rv-name{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;margin-bottom:2px;}
.rv-role{font-size:15px;color:#7b5cfa;font-weight:600;margin-bottom:6px;}
.rv-contact{font-size:12px;color:#555;display:flex;flex-wrap:wrap;gap:14px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #7b5cfa;}
.rv-section-title{font-size:13px;font-weight:700;color:#7b5cfa;text-transform:uppercase;letter-spacing:1px;margin:16px 0 6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;}
.rv-content{font-size:13px;color:#333;}
.rv-bullet{margin-left:16px;}</style></head><body>${content}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/\s+/g,'_')}_Resume.html`;
  a.click();
}

// -- DASHBOARD --------------------------------------
function renderDashboard() {
  const total = Object.values(sessionCounts).reduce((a,b) => a+b, 0);
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-text').textContent = sessionCounts.text || 0;
  document.getElementById('stat-voice').textContent = sessionCounts.voice || 0;
  document.getElementById('stat-eval').textContent = sessionCounts.eval || 0;
  document.getElementById('sessionStat').textContent = `${total} sessions`;
  const icons = { text:'??', voice:'??', video:'??', eval:'??' };
  const list = document.getElementById('historyList');
  document.getElementById('historyCount').textContent = sessionHistory.length;
  if (!sessionHistory.length) {
    list.innerHTML = '<div class="empty-state">No sessions yet. Start practising! ??</div>'; return;
  }
  list.innerHTML = sessionHistory.slice(0,20).map(h => `
    <div class="history-item">
      <div class="hi-icon">${icons[h.type]||'??'}</div>
      <div style="flex:1">
        <div class="hi-q">${h.q.substring(0,80)}${h.q.length>80?'?':''}</div>
        <div class="hi-meta">${h.role} ? ${h.type} ? ${h.time}</div>
      </div>
    </div>`).join('');
}

function addHistory(q, role, type) {
  sessionHistory.unshift({ q, role, type, time: new Date().toLocaleTimeString() });
  if (sessionHistory.length > 50) sessionHistory.pop();
  localStorage.setItem('sp_history', JSON.stringify(sessionHistory));
}

function incrementCount(type) {
  sessionCounts[type] = (sessionCounts[type] || 0) + 1;
  localStorage.setItem('sp_counts', JSON.stringify(sessionCounts));
  const total = Object.values(sessionCounts).reduce((a,b) => a+b, 0);
  document.getElementById('sessionStat').textContent = `${total} sessions`;
}

// -- UTILS ------------------------------------------
function copyEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => showToast('? Copied!'));
}

function speakText(id) {
  const el = document.getElementById(id);
  if (!el) return;
  window.speechSynthesis.cancel();
  const text = el.innerText.substring(0, 3000);
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.92; utt.pitch = 1; utt.lang = 'en-US';
  const voices = window.speechSynthesis.getVoices();
  const pref = voices.find(v => v.name.includes('Google UK') || v.name.includes('Samantha') || v.name.includes('Daniel'));
  if (pref) utt.voice = pref;
  speechSynthesis.speak(utt);
}

function thinking(msg) {
  return `<div class="thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div> ${msg}</div>`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}



