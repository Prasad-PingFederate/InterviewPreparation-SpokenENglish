// -- MOCK INTERVIEW ---------------------------------
let mockQuestions = [];
let mockCurrent = 0;
let mockAnswers = [];
let mockTimerInterval = null;
let mockVoiceRec = null;
let mockVoiceText = '';
let mockIsRecording = false;

async function startMockInterview() {
  const role = document.getElementById('jobRole').value;
  const count = parseInt(document.getElementById('mockQCount').value);
  const type = document.getElementById('mockType').value;
  const mode = document.getElementById('mockAnswerMode').value;
  const btn = document.querySelector('#mock-setup .primary-btn');
  btn.disabled = true; btn.querySelector('span:last-child').textContent = 'Generating questions';

  const sys = `You are an expert interviewer for ${role} positions. Generate exactly ${count} interview questions.
Type: ${type}. Return JSON array only: [{"q":"question text","type":"technical|behavioral","difficulty":"easy|medium|hard"}]`;
  try {
    const res = await callClaude(`Generate ${count} ${type} interview questions for ${role}`, sys, 1000);
    mockQuestions = JSON.parse(res.replace(/```json|```/g,'').trim());
    mockAnswers = [];
    mockCurrent = 0;
    document.getElementById('mock-setup').style.display = 'none';
    document.getElementById('mock-session').style.display = 'block';
    document.getElementById('mock-report').style.display = 'none';
    document.getElementById('mockTextAnswerWrap').style.display = mode === 'text' ? 'block' : 'none';
    document.getElementById('mockVoiceAnswerWrap').style.display = mode === 'voice' ? 'block' : 'none';
    showMockQuestion();
  } catch(e) { showToast('? ' + e.message); }
  btn.disabled = false; btn.querySelector('span:last-child').textContent = 'Start Mock Interview';
}

function showMockQuestion() {
  const q = mockQuestions[mockCurrent];
  if (!q) { showMockReport(); return; }
  const total = mockQuestions.length;
  document.getElementById('mockQCounter').textContent = `Question ${mockCurrent+1} of ${total}`;
  document.getElementById('mockProgressFill').style.width = `${((mockCurrent)/total)*100}%`;
  document.getElementById('mockQText').textContent = q.q;
  document.getElementById('mockTextAnswer').value = '';
  document.getElementById('mockVoiceTranscript').textContent = 'Your answer will appear here';
  mockVoiceText = '';
  document.getElementById('mockAnswerFeedback').innerHTML = '';
  const timerSecs = parseInt(document.getElementById('mockTimer').value);
  if (timerSecs > 0) startMockTimer(timerSecs);
  else document.getElementById('mockTimerDisplay').style.display = 'none';
  if (document.getElementById('mockAnswerMode').value === 'voice') {
    document.getElementById('mockMicRing').classList.remove('active');
    document.getElementById('mockMicBtn').textContent = '\u23F9';
    document.getElementById('mockVoiceStatus').textContent = 'Click mic to answer';
    mockIsRecording = false;
  }
}

function startMockTimer(secs) {
  clearInterval(mockTimerInterval);
  let remaining = secs;
  const display = document.getElementById('mockTimerDisplay');
  const val = document.getElementById('mockTimerVal');
  display.style.display = 'inline-block';
  const update = () => {
    const m = Math.floor(remaining/60), s = remaining%60;
    val.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    if (remaining <= 10) display.style.borderColor = 'rgba(255,107,53,0.6)';
    if (remaining <= 0) { clearInterval(mockTimerInterval); submitMockAnswer(); }
    remaining--;
  };
  update();
  mockTimerInterval = setInterval(update, 1000);
}

function toggleMockVoice() {
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { showToast('Use Chrome/Edge for voice'); return; }
  mockIsRecording ? stopMockVoice() : startMockVoice();
}

function startMockVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  mockVoiceRec = new SR();
  mockVoiceRec.continuous = true; mockVoiceRec.interimResults = true; mockVoiceRec.lang = 'en-US';
  let full = '';
  mockVoiceRec.onstart = () => {
    mockIsRecording = true;
    document.getElementById('mockMicRing').classList.add('active');
    document.getElementById('mockMicBtn').textContent = '?';
    document.getElementById('mockVoiceStatus').textContent = ' Recording';
  };
  mockVoiceRec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) full += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('mockVoiceTranscript').textContent = full + interim;
    mockVoiceText = full;
  };
  mockVoiceRec.start();
}

function stopMockVoice() {
  if (mockVoiceRec) mockVoiceRec.stop();
  mockIsRecording = false;
  document.getElementById('mockMicRing').classList.remove('active');
  document.getElementById('mockMicBtn').textContent = '\u23F9';
  document.getElementById('mockVoiceStatus').textContent = '? Done. Submit when ready.';
}

async function submitMockAnswer() {
  clearInterval(mockTimerInterval);
  const mode = document.getElementById('mockAnswerMode').value;
  const answer = mode === 'text'
    ? document.getElementById('mockTextAnswer').value.trim()
    : mockVoiceText.trim();
  if (!answer) { showToast('Please provide an answer first!'); return; }
  if (mockIsRecording) stopMockVoice();
  const q = mockQuestions[mockCurrent];
  const role = document.getElementById('jobRole').value;
  const exp = document.getElementById('expLevel').value;
  const fb = document.getElementById('mockAnswerFeedback');
  fb.innerHTML = thinking('Evaluating your answer');
  document.getElementById('mockSubmitBtn').disabled = true;

  const sys = `You are a strict but fair ${role} interviewer. Evaluate this answer concisely. Return JSON:
{"score":<0-100>,"verdict":"<Good|Needs Work|Poor>","keyMissing":"<1 main thing missing>","quickFix":"<1 sentence improvement tip>","encouragement":"<short warm note>"}`;
  try {
    const res = await callClaude(`Q: "${q.q}"\nA: "${answer}"`, sys, 500);
    const data = JSON.parse(res.replace(/```json|```/g,'').trim());
    const color = data.score >= 70 ? 'var(--accent3)' : data.score >= 45 ? 'var(--accent)' : 'var(--warn)';
    mockAnswers.push({ q: q.q, answer, score: data.score, verdict: data.verdict, tip: data.quickFix });
    fb.innerHTML = `<div class="card" style="padding:16px;border-left:3px solid ${color}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="font-family:Syne,sans-serif;font-size:28px;font-weight:800;color:${color}">${data.score}</div>
        <div><div style="font-weight:700;color:${color}">${data.verdict}</div><div style="font-size:12px;color:var(--muted)">${q.difficulty} question</div></div>
      </div>
      <div style="font-size:13px;margin-bottom:6px"> <strong>Missing:</strong> ${data.keyMissing}</div>
      <div style="font-size:13px;margin-bottom:6px"> <strong>Quick Fix:</strong> ${data.quickFix}</div>
      <div style="font-size:13px;color:var(--accent3)"> ${data.encouragement}</div>
    </div>
    <button class="primary-btn" style="margin-top:12px" onclick="nextMockQuestion()">
      ${mockCurrent+1 < mockQuestions.length ? '? Next Question' : ' View Report Card'}
    </button>`;
  } catch(e) {
    mockAnswers.push({ q: q.q, answer, score: 50, verdict: 'Evaluated', tip: '' });
    fb.innerHTML = `<button class="primary-btn" style="margin-top:12px" onclick="nextMockQuestion()">${mockCurrent+1 < mockQuestions.length ? '? Next Question' : ' View Report'}</button>`;
  }
  document.getElementById('mockSubmitBtn').disabled = false;
}

function skipMockQuestion() {
  clearInterval(mockTimerInterval);
  mockAnswers.push({ q: mockQuestions[mockCurrent]?.q, answer: '(Skipped)', score: 0, verdict: 'Skipped', tip: '' });
  nextMockQuestion();
}

function nextMockQuestion() {
  mockCurrent++;
  if (mockCurrent >= mockQuestions.length) showMockReport();
  else showMockQuestion();
}

function showMockReport() {
  document.getElementById('mock-session').style.display = 'none';
  document.getElementById('mock-report').style.display = 'block';
  const avg = Math.round(mockAnswers.reduce((a,b) => a+b.score, 0) / (mockAnswers.length || 1));
  const color = avg >= 70 ? 'var(--accent3)' : avg >= 45 ? 'var(--accent)' : 'var(--warn)';
  document.getElementById('mockReportScores').innerHTML = `
    <div class="score-card"><div class="score-num" style="color:${color}">${avg}</div><div class="score-lbl">Overall</div><div class="progress-bar"><div class="progress-fill" style="width:${avg}%"></div></div></div>
    <div class="score-card"><div class="score-num" style="color:var(--accent)">${mockAnswers.length}</div><div class="score-lbl">Answered</div></div>
    <div class="score-card"><div class="score-num" style="color:var(--accent3)">${mockAnswers.filter(a=>a.score>=70).length}</div><div class="score-lbl">Strong</div></div>
    <div class="score-card"><div class="score-num" style="color:var(--warn)">${mockAnswers.filter(a=>a.score<45).length}</div><div class="score-lbl">Weak</div></div>`;
  document.getElementById('mockReportDetail').innerHTML = mockAnswers.map((a,i) => {
    const c = a.score>=70?'var(--accent3)':a.score>=45?'var(--accent)':'var(--warn)';
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong style="font-size:13px">Q${i+1}: ${a.q}</strong><span style="color:${c};font-family:Syne,sans-serif;font-weight:700">${a.score}</span></div>
      <div style="font-size:12px;color:var(--muted)">${a.verdict}${a.tip?'  '+a.tip:''}</div></div>`;
  }).join('');
  addHistory(`Mock Interview (${mockAnswers.length}Q)`, document.getElementById('jobRole').value, 'eval');
  incrementCount('eval');
}

function resetMockInterview() {
  mockQuestions=[]; mockAnswers=[]; mockCurrent=0;
  clearInterval(mockTimerInterval);
  document.getElementById('mock-setup').style.display='block';
  document.getElementById('mock-session').style.display='none';
  document.getElementById('mock-report').style.display='none';
}

// -- QUESTION BANK ----------------------------------
const BANK = {
  'Java Developer':[
    {q:'What is the difference between JDK, JRE, and JVM?',diff:'easy'},
    {q:'Explain Java memory model and garbage collection.',diff:'medium'},
    {q:'What are the SOLID principles? Give Java examples.',diff:'medium'},
    {q:'Explain ConcurrentHashMap vs HashMap thread safety.',diff:'hard'},
    {q:'What is the difference between Comparable and Comparator?',diff:'easy'},
    {q:'How does Java achieve platform independence?',diff:'easy'},
    {q:'Explain the Java Stream API with examples.',diff:'medium'},
    {q:'What are design patterns? Explain Singleton and Factory.',diff:'medium'},
    {q:'How does Spring Boot auto-configuration work?',diff:'hard'},
    {q:'Explain Java 8 Optional class and its use cases.',diff:'medium'},
    {q:'What is the difference between abstract class and interface?',diff:'easy'},
    {q:'How does multithreading work? Explain synchronized keyword.',diff:'hard'},
  ],
  'Python Developer':[
    {q:'What is a Python decorator and how do you create one?',diff:'medium'},
    {q:'Explain the Global Interpreter Lock (GIL).',diff:'hard'},
    {q:'Difference between list, tuple, set, and dictionary.',diff:'easy'},
    {q:'How does Python manage memory? Explain garbage collection.',diff:'medium'},
    {q:'What are generators and when should you use them?',diff:'medium'},
    {q:'Explain Django vs Flask vs FastAPI differences.',diff:'medium'},
    {q:'What is list comprehension vs generator expression?',diff:'easy'},
    {q:'How does Python handle exceptions? Best practices?',diff:'easy'},
    {q:'Explain *args and **kwargs with examples.',diff:'easy'},
    {q:'What is the difference between __str__ and __repr__?',diff:'medium'},
  ],
  'System Design':[
    {q:'Design a URL shortener like bit.ly.',diff:'medium'},
    {q:'Explain CAP theorem with real-world examples.',diff:'hard'},
    {q:'How would you design Twitter\'s news feed?',diff:'hard'},
    {q:'Explain horizontal vs vertical scaling.',diff:'easy'},
    {q:'What is consistent hashing and when is it used?',diff:'hard'},
    {q:'Design a rate limiter for an API.',diff:'medium'},
    {q:'How would you design a chat application like WhatsApp?',diff:'hard'},
    {q:'Explain microservices vs monolith trade-offs.',diff:'medium'},
    {q:'What is an event-driven architecture?',diff:'medium'},
    {q:'How does a CDN work? When would you use one?',diff:'easy'},
  ],
  'Behavioral / HR':[
    {q:'Tell me about yourself in 2 minutes.',diff:'easy'},
    {q:'Describe a time you resolved a conflict with a teammate.',diff:'medium'},
    {q:'What is your greatest professional weakness?',diff:'medium'},
    {q:'Tell me about a project you are most proud of.',diff:'easy'},
    {q:'How do you handle tight deadlines and pressure?',diff:'medium'},
    {q:'Where do you see yourself in 5 years?',diff:'easy'},
    {q:'Describe a time you failed and what you learned.',diff:'hard'},
    {q:'How do you prioritise tasks when everything is urgent?',diff:'medium'},
    {q:'Why do you want to leave your current company?',diff:'hard'},
    {q:'What motivates you at work?',diff:'easy'},
  ],
  'Spoken English':[
    {q:'Give a professional self-introduction for an interview.',diff:'easy'},
    {q:'Describe your dream job in fluent English.',diff:'easy'},
    {q:'Explain your biggest achievement using the STAR method.',diff:'medium'},
    {q:'How would you politely disagree with your manager?',diff:'medium'},
    {q:'Give a 1-minute speech on "The importance of communication".',diff:'medium'},
    {q:'How do you stay updated with industry trends?',diff:'easy'},
    {q:'Describe a situation where you showed leadership.',diff:'medium'},
    {q:'How would you explain a technical concept to a non-technical person?',diff:'hard'},
  ],
  'DevOps Engineer':[
    {q:'Explain the difference between Docker and a VM.',diff:'easy'},
    {q:'What is a CI/CD pipeline? Walk me through one you built.',diff:'medium'},
    {q:'Explain Kubernetes architecture (nodes, pods, services).',diff:'hard'},
    {q:'What is Infrastructure as Code? Tools you have used?',diff:'medium'},
    {q:'How does blue-green deployment differ from canary?',diff:'hard'},
    {q:'Explain Git branching strategies for a team.',diff:'medium'},
    {q:'What monitoring tools have you used and why?',diff:'medium'},
    {q:'How would you reduce a Docker image size?',diff:'medium'},
    {q:'What is Helm and how is it used with Kubernetes?',diff:'hard'},
    {q:'Explain how you would set up a zero-downtime deployment.',diff:'hard'},
  ],
};

let bankCategory = 'Java Developer';
let bankData = [];

function initBank() {
  const cats = Object.keys(BANK);
  document.getElementById('bankCategoryTabs').innerHTML = cats.map(c =>
    `<button class="bank-cat-btn${c===bankCategory?' active':''}" onclick="setBankCategory('${c}')">${c}</button>`
  ).join('');
  renderBank();
}

function setBankCategory(cat) {
  bankCategory = cat;
  document.querySelectorAll('.bank-cat-btn').forEach(b => b.classList.toggle('active', b.textContent===cat));
  filterBank();
}

function filterBank() {
  const search = (document.getElementById('bankSearch')?.value||'').toLowerCase();
  const diff = document.getElementById('bankDifficulty')?.value||'';
  const items = BANK[bankCategory]||[];
  bankData = items.filter(i =>
    (!search || i.q.toLowerCase().includes(search)) &&
    (!diff || i.diff === diff)
  );
  renderBank();
}

function renderBank() {
  const grid = document.getElementById('bankGrid');
  if (!bankData.length) { bankData = BANK[bankCategory]||[]; }
  grid.innerHTML = bankData.map((item,idx) => `
    <div class="bank-card">
      <div class="bank-card-q">${item.q}</div>
      <div class="bank-card-meta">
        <span class="bank-diff ${item.diff}">${item.diff}</span>
        <div class="bank-action-btns">
          <button class="bank-mini-btn" onclick="bankPracticeText(${idx})">\uD83D\uDCDD Practice</button>
          <button class="bank-mini-btn" onclick="bankEvaluate(${idx})">\uD83E\uDDE0 Evaluate</button>
        </div>
      </div>
    </div>`).join('');
}

function bankPracticeText(idx) {
  const q = bankData[idx]?.q;
  if (!q) return;
  document.getElementById('textQuestion').value = q;
  switchTab('text');
  showToast('Question loaded in Text Practice ?');
}

function bankEvaluate(idx) {
  const q = bankData[idx]?.q;
  if (!q) return;
  document.getElementById('evalQuestion').value = q;
  switchTab('evaluate');
  showToast('Question loaded in Evaluate Me ?');
}

// -- FLASHCARDS -------------------------------------
const FLASHCARDS = {
  english:[
    {front:'How to start your self-introduction',back:'Say: "Thank you for this opportunity. My name is [Name]. I am a [role] with [X] years of experience in [domain]. I am passionate about [area] and most recently I [achievement]."'},
    {front:'How to say you don\'t know something professionally',back:'"That\'s a great question. I don\'t have that information off the top of my head, but I would approach it by [method]. I\'d verify and get back to you with a precise answer."'},
    {front:'STAR Method structure',back:'S  Situation: Set the context\nT  Task: What was your responsibility?\nA  Action: What did YOU specifically do?\nR  Result: What was the measurable outcome?'},
    {front:'How to handle "What is your weakness?"',back:'Pick a real but non-critical weakness. Show self-awareness and what you are doing to improve. Example: "I used to struggle with public speaking, so I joined a Toastmasters club and now present weekly."'},
    {front:'Professional way to say "I disagree"',back:'"I appreciate your perspective. I\'d like to offer a different viewpoint  [your point]. What are your thoughts on that approach?"'},
    {front:'Closing a job interview strongly',back:'"Thank you so much for your time. This role excites me because [reason]. I am very interested and confident I can contribute significantly. What are the next steps in the process?"'},
    {front:'How to describe a gap in employment',back:'"During that period, I [what you did: freelanced, upskilled, managed family]. It gave me [what you gained]. I am now fully ready and excited to contribute."'},
    {front:'Answering "Why should we hire you?"',back:'Structure: 1) Your unique skills matching the JD, 2) Relevant achievement with numbers, 3) Cultural fit + enthusiasm. Never say "I need a job."'},
  ],
  java:[
    {front:'What is the difference between == and .equals()?',back:'== compares object references (memory address). .equals() compares object content/value. For Strings, always use .equals() to compare values.'},
    {front:'What is HashMap\'s time complexity?',back:'Average case: O(1) for get/put. Worst case (all keys same hash bucket): O(n). Java 8+ converts bucket to TreeNode at 8+ entries ? O(log n) worst case.'},
    {front:'What does "volatile" keyword do?',back:'Ensures visibility of variable changes across threads. Every write is flushed to main memory; every read comes from main memory. Does NOT guarantee atomicity.'},
    {front:'Difference: ArrayList vs LinkedList',back:'ArrayList: O(1) random access, O(n) insert/delete in middle. LinkedList: O(n) access, O(1) insert/delete at known node. Use ArrayList for most cases.'},
    {front:'What is a functional interface?',back:'An interface with exactly ONE abstract method. Used with lambdas. Examples: Runnable, Callable, Comparator, Predicate, Function, Consumer, Supplier.'},
    {front:'Explain try-with-resources',back:'Auto-closes resources (implements AutoCloseable) after try block. Syntax: try(Resource r = new Resource()){ ... }  no need for finally block to close.'},
    {front:'What is Optional in Java 8?',back:'A container object that may or may not contain a non-null value. Avoids NullPointerException. Key methods: isPresent(), get(), orElse(), orElseGet(), map(), filter().'},
    {front:'What is the difference between Checked and Unchecked exceptions?',back:'Checked: must be handled (IOException, SQLException). Unchecked (RuntimeException): NullPointerException, ArrayIndexOutOfBoundsException  compiler doesn\'t force handling.'},
  ],
  python:[
    {front:'What is a Python decorator?',back:'A function that takes another function and extends its behaviour. Syntax: @decorator_name above function definition. Used for logging, auth, caching, timing.'},
    {front:'Difference between list and tuple',back:'List: mutable, [ ], slower. Tuple: immutable, ( ), faster, hashable (can be dict key). Use tuple when data shouldn\'t change.'},
    {front:'What is __init__ vs __new__?',back:'__new__ creates the instance (called first). __init__ initialises it (called after). Usually only override __init__. Override __new__ for singletons or immutable types.'},
    {front:'Explain list comprehension',back:'[expression for item in iterable if condition]\nExample: [x**2 for x in range(10) if x%2==0] ? squares of even numbers. Faster than equivalent for loop.'},
    {front:'What is a generator?',back:'A function using yield instead of return. Returns a lazy iterator  values computed on demand, saving memory. Best for large datasets.'},
    {front:'Explain *args and **kwargs',back:'*args: accepts any number of positional arguments as a tuple.\n**kwargs: accepts any number of keyword arguments as a dict.\nOrder: def fn(a, *args, **kwargs)'},
    {front:'What is GIL?',back:'Global Interpreter Lock  a mutex that allows only one thread to execute Python bytecode at a time. Limits CPU-bound multithreading. Use multiprocessing for CPU tasks.'},
    {front:'Difference between deep copy and shallow copy',back:'Shallow copy: copies object but references nested objects (copy.copy()). Deep copy: copies everything recursively including nested objects (copy.deepcopy()).'},
  ],
  system:[
    {front:'What is the CAP Theorem?',back:'Distributed system can guarantee only 2 of 3: Consistency (all nodes same data), Availability (always responds), Partition Tolerance (works despite network splits). CP or AP systems.'},
    {front:'SQL vs NoSQL  when to use each?',back:'SQL: structured data, ACID transactions, complex queries (banking, ERP). NoSQL: flexible schema, massive scale, fast reads (social media, IoT, real-time analytics).'},
    {front:'What is consistent hashing?',back:'Maps both servers and keys onto a ring. Key goes to the next server clockwise. Adding/removing a server only remaps a fraction of keys. Used in distributed caches (Redis Cluster, Cassandra).'},
    {front:'Explain Load Balancing algorithms',back:'Round Robin: sequential. Weighted Round Robin: based on server capacity. Least Connections: fewest active. IP Hash: same client ? same server. Random: random selection.'},
    {front:'What is a message queue? When to use it?',back:'Decouples producers from consumers. Use when: async processing, rate limiting, peak load buffering. Examples: RabbitMQ, Kafka, SQS. Kafka best for high-throughput event streaming.'},
    {front:'Database indexing  how does it work?',back:'Creates a data structure (B-tree usually) for fast lookup. Trade-off: speeds up reads, slows writes, uses storage. Index columns used in WHERE, JOIN, ORDER BY.'},
    {front:'What is eventual consistency?',back:'System guarantees all nodes will eventually converge to the same value  but not immediately. Used by DNS, Cassandra, DynamoDB. Higher availability but may serve stale data briefly.'},
    {front:'Horizontal vs Vertical Scaling',back:'Vertical (scale up): bigger server, more RAM/CPU. Simple but limited. Horizontal (scale out): more servers, needs load balancer. Preferred for modern distributed systems.'},
  ],
  behavioral:[
    {front:'STAR for "Tell me about a challenge you overcame"',back:'S: "Our payment service was failing under load."\nT: "I was the lead backend dev responsible for fixing it."\nA: "I profiled the code, found N+1 queries, added caching."\nR: "Response time dropped 60%, zero downtime."'},
    {front:'STAR for "Describe teamwork/collaboration"',back:'S: "Cross-functional project with 3 teams."\nT: "Coordinate between frontend, backend, QA."\nA: "Set up daily standups, shared Jira board, clear ownership."\nR: "Delivered 2 weeks ahead of schedule."'},
    {front:'STAR for "Leadership example"',back:'S: "Junior devs were making repeated bugs in production."\nT: "As senior, improve code quality."\nA: "Introduced code reviews, pair programming, weekly knowledge sessions."\nR: "Production bugs reduced by 40%."'},
    {front:'STAR for "Handling conflict"',back:'S: "Disagreed with PM on feature priority."\nT: "Resolve without damaging relationship."\nA: "Presented data on user impact, had private discussion, found middle ground."\nR: "Better feature shipped, relationship intact."'},
    {front:'How to answer "Why this company?"',back:'Research: product, mission, culture, recent news. Connect: "Your focus on [X] aligns with my experience in [Y]. I admire [specific thing] and see myself contributing to [specific goal]."'},
    {front:'Answering salary expectation questions',back:'"Based on my research and experience level, I am looking for [range]. However, I am flexible and more interested in the overall opportunity. What is the budgeted range for this role?"'},
  ],
  devops:[
    {front:'Docker image vs container',back:'Image: read-only template/blueprint (like a class). Container: running instance of an image (like an object). Multiple containers can run from one image.'},
    {front:'What is Kubernetes and why use it?',back:'Container orchestration platform. Manages: deployment, scaling, load balancing, self-healing, rolling updates. Use when running many containers in production.'},
    {front:'CI vs CD',back:'CI (Continuous Integration): auto build + test on every commit. CD (Continuous Delivery): auto deploy to staging. Continuous Deployment: auto deploy to production. CI runs inside CD.'},
    {front:'What is a Dockerfile?',back:'Text file with instructions to build a Docker image. Key commands: FROM (base image), RUN (execute), COPY (add files), EXPOSE (port), CMD/ENTRYPOINT (start command).'},
    {front:'Blue-Green vs Canary Deployment',back:'Blue-Green: two identical environments, switch traffic instantly, easy rollback. Canary: gradually shift % of traffic to new version, monitor, expand or rollback. Canary safer for large scale.'},
    {front:'What is Terraform?',back:'Infrastructure as Code tool by HashiCorp. Define cloud resources in HCL files. Commands: init, plan (preview), apply (create), destroy. Maintains state file to track real resources.'},
    {front:'What is a Kubernetes Pod?',back:'Smallest deployable unit in K8s. Contains one or more containers sharing network and storage. Containers in a pod communicate via localhost. Ephemeral  managed by Deployments.'},
    {front:'What is Helm?',back:'Package manager for Kubernetes. A "chart" is a collection of YAML templates. Helm fills in values and deploys. Simplifies complex K8s app deployments and upgrades.'},
  ],
};

let flashDeck = [];
let flashIdx = 0;
let flashKnow = 0;
let flashDontKnow = 0;
let flashFlipped = false;
let flashMarked = [];

function loadFlashcards() {
  const cat = document.getElementById('flashCategory').value;
  flashDeck = [...(FLASHCARDS[cat]||[])];
  flashIdx = 0; flashKnow = 0; flashDontKnow = 0;
  flashMarked = new Array(flashDeck.length).fill(null);
  flashFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');
  document.getElementById('flashActionBtns').style.display = 'none';
  updateFlashStats();
  showFlashcard();
}

function showFlashcard() {
  if (!flashDeck.length) return;
  const card = flashDeck[flashIdx];
  flashFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');
  document.getElementById('flashActionBtns').style.display = 'none';
  document.getElementById('flashFront').innerHTML = `
    <div class="flash-front-label">Question ${flashIdx+1} of ${flashDeck.length}</div>
    <div class="flash-front-text">${card.front}</div>
    <div class="flash-tap-hint"> Click to reveal answer</div>`;
  document.getElementById('flashBack').innerHTML = `
    <div class="flash-back-label"> Answer</div>
    <div class="flash-back-text">${card.back.replace(/\n/g,'<br>')}</div>`;
}

function flipCard() {
  flashFlipped = !flashFlipped;
  document.getElementById('flashcard').classList.toggle('flipped', flashFlipped);
  document.getElementById('flashActionBtns').style.display = flashFlipped ? 'flex' : 'none';
}

function markCard(known) {
  flashMarked[flashIdx] = known;
  if (known) flashKnow++; else flashDontKnow++;
  updateFlashStats();
  nextCard();
}

function nextCard() {
  flashIdx = (flashIdx+1) % flashDeck.length;
  showFlashcard();
}

function prevCard() {
  flashIdx = (flashIdx-1+flashDeck.length) % flashDeck.length;
  showFlashcard();
}

function updateFlashStats() {
  document.getElementById('flashKnow').textContent = `? Know: ${flashKnow}`;
  document.getElementById('flashDontKnow').textContent = `? Learning: ${flashDontKnow}`;
  document.getElementById('flashProgress').textContent = ` ${flashIdx+1}/${flashDeck.length}`;
}


  if (extraTitles[tab]) document.getElementById('topBarTitle').textContent = extraTitles[tab];
  if (tab === 'bank') { initBank(); filterBank(); }
  if (tab === 'flash') loadFlashcards();
};

// -- DAILY CHALLENGE --------------------------------
function showDailyChallenge() {
  const allQ = Object.values(BANK).flat();
  const today = new Date().toDateString();
  const seed = today.split('').reduce((a,c) => a+c.charCodeAt(0), 0);
  const q = allQ[seed % allQ.length];
  if (q) { document.getElementById('textQuestion').value = q.q; switchTab('text'); showToast(' Daily Challenge loaded!'); }
}

// -- INIT FEATURES ON LOAD --------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Add daily challenge button to top bar
  const actions = document.querySelector('.top-bar-actions');
  if (actions) {
    const dcBtn = document.createElement('button');
    dcBtn.className = 'icon-btn';
    dcBtn.textContent = ' Daily';
    dcBtn.title = 'Load today\'s daily challenge question';
    dcBtn.onclick = showDailyChallenge;
    actions.insertBefore(dcBtn, actions.firstChild);
  }
});


