
let apiKeyValue = '';
let sessionHistory = [];
let sessionCounts = {text:0,voice:0,video:0,eval:0};

function switchTab(tab) {
  console.log('Navigating to:', tab);
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const panel = document.getElementById('panel-' + tab);
  const nav = document.getElementById('nav-' + tab);
  
  if (panel) panel.classList.add('active');
  if (nav) nav.classList.add('active');
  
  const titles = {
    text: '📝 Text Practice',
    voice: '🎙️ Voice Mode',
    video: '📹 Video Mode',
    evaluate: '🧠 Evaluate Me',
    resume: '📄 Resume Builder',
    jobeval: '🔍 Job Evaluator',
    tracker: '📋 Job Tracker',
    stories: '⭐ STAR Stories',
    outreach: '💼 Outreach',
    salary: '💰 Salary Negotiator',
    dashboard: '📊 Dashboard'
  };
  
  const titleEl = document.getElementById('topBarTitle');
  if (titleEl) titleEl.textContent = titles[tab] || tab;
  
  if (tab === 'tracker' && typeof updateTrackerUI === 'function') updateTrackerUI();
  if (tab === 'stories' && typeof updateStoryList === 'function') updateStoryList();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function checkKey() {
  const k = document.getElementById('apiKey').value.trim();
  apiKeyValue = k;
  const st = document.getElementById('apiStatus');
  if (k.startsWith('sk-ant-')) {
    st.textContent = '✅ Connected'; st.className = 'api-status ok';
    sessionStorage.setItem('sp_key', k);
  } else {
    st.textContent = '❌ Not connected'; st.className = 'api-status err';
  }
}

window.onload = () => {
  const k = sessionStorage.getItem('sp_key');
  if (k) { document.getElementById('apiKey').value = k; checkKey(); }
};
