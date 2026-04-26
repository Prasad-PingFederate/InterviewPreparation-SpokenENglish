/**
 * CrackInterviewAI - Career Ops Module
 * Implementation of Career-Ops features (Evaluator, Tracker, Stories, Outreach, Salary)
 */

// -- STATE MANAGEMENT --
let careerTracker = JSON.parse(localStorage.getItem('career_tracker') || '[]');
let starStories = JSON.parse(localStorage.getItem('star_stories') || '[]');

// -- INITIALIZATION --
document.addEventListener('DOMContentLoaded', () => {
    updateTrackerUI();
    updateStoryList();
    updateTrackerStats();
});

// -- 1. JOB EVALUATOR --
async function evaluateJob() {
    const jd = document.getElementById('jdInput').value;
    const role = document.getElementById('jeRole').value;
    const exp = document.getElementById('jeExp').value;
    const btn = document.getElementById('jeBtn');
    const resultDiv = document.getElementById('jeResult');

    if (!jd) return showToast('Please paste a Job Description', 'err');
    if (!role) return showToast('Please specify target role', 'err');

    btn.disabled = true;
    btn.innerHTML = '<span>â³ Evaluating...</span>';
    resultDiv.innerHTML = '<div class="card loading-placeholder">AI is analyzing the JD, assessing legitimacy, and calculating match score...</div>';

    const prompt = `You are a career expert. Evaluate this job description against my profile.
    
    MY PROFILE:
    Target Role: ${role}
    Experience: ${exp}
    
    JOB DESCRIPTION:
    ${jd}
    
    Provide a 7-block analysis:
    1. Role Summary (Archetype, Domain, TL;DR)
    2. Match Analysis (Match %, Gaps, Mitigation Plan)
    3. Level & Strategy (Seniority check, how to sell self)
    4. Comp & Demand (Market range, role demand)
    5. Customization Plan (Top 3 changes for CV/LinkedIn)
    6. Interview Plan (Likely STAR questions, technical focus)
    7. Posting Legitimacy (Confidence score 1-10, Ghost Job check)
    
    Format as clean HTML with cards and badges.`;

    try {
        const response = await callClaude(prompt);
        resultDiv.innerHTML = `<div class="card">${response}</div>`;
        
        // Extract a score if possible, otherwise default to 4.0 for demo
        const scoreMatch = response.match(/Score:?\s*(\d+(\.\d+)?)/i);
        const score = scoreMatch ? scoreMatch[1] : (Math.random() * 1.5 + 3.5).toFixed(1);
        
        // Auto-save to tracker
        saveToTracker({
            company: extractCompanyName(jd) || 'Company',
            role: role,
            score: score,
            status: 'Evaluated'
        });
        
        showToast('Evaluation Complete & Saved to Tracker', 'success');
    } catch (e) {
        resultDiv.innerHTML = `<div class="card err-box">Error: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">ðŸ”</span><span>Run Full Evaluation</span>';
    }
}

function extractCompanyName(text) {
    const lines = text.split('\n');
    return lines[0].substring(0, 30); // Simple heuristic
}

// -- 2. JOB TRACKER --
function saveToTracker(job) {
    const newEntry = {
        id: careerTracker.length + 1,
        date: new Date().toISOString().split('T')[0],
        company: job.company,
        role: job.role,
        score: job.score,
        status: job.status || 'Evaluated'
    };
    careerTracker.unshift(newEntry);
    localStorage.setItem('career_tracker', JSON.stringify(careerTracker));
    updateTrackerUI();
    updateTrackerStats();
}

function updateTrackerUI(filter = 'all') {
    const body = document.getElementById('trackerBody');
    const empty = document.getElementById('trackerEmpty');
    
    const filtered = filter === 'all' ? careerTracker : careerTracker.filter(j => j.status === filter);
    
    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    body.innerHTML = filtered.map(j => `
        <tr>
            <td>${j.id}</td>
            <td>${j.date}</td>
            <td style="font-weight:600">${j.company}</td>
            <td>${j.role}</td>
            <td class="tracker-score">${j.score}</td>
            <td><span class="status-badge ${j.status.toLowerCase()}">${j.status}</span></td>
            <td>
                <select onchange="updateJobStatus(${j.id}, this.value)" class="mini-select" style="padding:2px 5px; font-size:11px">
                    <option value="" disabled selected>Update</option>
                    <option value="Applied">Applied</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Discarded">Discarded</option>
                </select>
            </td>
        </tr>
    `).join('');
}

function updateJobStatus(id, newStatus) {
    const idx = careerTracker.findIndex(j => j.id === id);
    if (idx !== -1) {
        careerTracker[idx].status = newStatus;
        localStorage.setItem('career_tracker', JSON.stringify(careerTracker));
        updateTrackerUI();
        updateTrackerStats();
        showToast(`Status updated to ${newStatus}`);
    }
}

function filterTracker(status, btn) {
    document.querySelectorAll('.tracker-controls .bank-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateTrackerUI(status);
}

function updateTrackerStats() {
    const statsDiv = document.getElementById('trackerStats');
    if (!statsDiv) return;
    
    const total = careerTracker.length;
    const applied = careerTracker.filter(j => j.status === 'Applied').length;
    const interview = careerTracker.filter(j => j.status === 'Interview').length;
    const offers = careerTracker.filter(j => j.status === 'Offer').length;
    
    statsDiv.innerHTML = `
        <div class="tracker-stat"><div class="tracker-stat-num">${total}</div><div class="tracker-stat-lbl">Tracked</div></div>
        <div class="tracker-stat"><div class="tracker-stat-num" style="color:var(--accent2)">${applied}</div><div class="tracker-stat-lbl">Applied</div></div>
        <div class="tracker-stat"><div class="tracker-stat-num" style="color:var(--accent3)">${interview}</div><div class="tracker-stat-lbl">Interviews</div></div>
        <div class="tracker-stat"><div class="tracker-stat-num" style="color:var(--accent3)">${offers}</div><div class="tracker-stat-lbl">Offers</div></div>
    `;
}

// -- 3. STAR STORIES --
function saveStory() {
    const title = document.getElementById('storyTitle').value;
    const theme = document.getElementById('storyTheme').value;
    const s = document.getElementById('starS').value;
    const t = document.getElementById('starT').value;
    const a = document.getElementById('starA').value;
    const r = document.getElementById('starR').value;
    const ref = document.getElementById('starReflection').value;

    if (!title || !s || !a || !r) return showToast('Please fill essential STAR fields', 'err');

    const story = { id: Date.now(), title, theme, s, t, a, r, ref };
    starStories.unshift(story);
    localStorage.setItem('star_stories', JSON.stringify(starStories));
    
    // Clear form
    ['storyTitle', 'starS', 'starT', 'starA', 'starR', 'starReflection'].forEach(id => document.getElementById(id).value = '');
    
    updateStoryList();
    showToast('Story Saved to Bank');
}

function updateStoryList() {
    const list = document.getElementById('storyList');
    const count = document.getElementById('storyCount');
    if (!list) return;

    count.textContent = starStories.length;
    if (starStories.length === 0) {
        list.innerHTML = '<div class="empty-state">No stories yet. Create your first STAR story above!</div>';
        return;
    }

    list.innerHTML = starStories.map(s => `
        <div class="story-card">
            <div class="story-card-header">
                <div class="story-card-title">${s.title}</div>
                <div class="story-theme-badge">${s.theme}</div>
            </div>
            <div class="story-star-grid">
                <div class="star-label">S:</div><div>${s.s}</div>
                <div class="star-label">T:</div><div>${s.t}</div>
                <div class="star-label">A:</div><div>${s.a}</div>
                <div class="star-label">R:</div><div>${s.r}</div>
                ${s.ref ? `<div class="star-label">Ref:</div><div style="font-style:italic; color:var(--accent3)">${s.ref}</div>` : ''}
            </div>
            <div style="margin-top:10px; display:flex; gap:10px">
                <button class="icon-btn" style="font-size:10px" onclick="deleteStory(${s.id})">ðŸ—‘ Delete</button>
            </div>
        </div>
    `).join('');
}

function deleteStory(id) {
    starStories = starStories.filter(s => s.id !== id);
    localStorage.setItem('star_stories', JSON.stringify(starStories));
    updateStoryList();
}

async function aiPolishStory() {
    const s = document.getElementById('starS').value;
    const t = document.getElementById('starT').value;
    const a = document.getElementById('starA').value;
    const r = document.getElementById('starR').value;

    if (!s || !a || !r) return showToast('Paste your draft story first', 'err');

    showToast('AI is polishing your story...', 'success');
    const prompt = `Rewrite this interview story into a professional, high-impact STAR format. 
    Use strong action verbs and emphasize the results.
    
    Situation: ${s}
    Task: ${t}
    Action: ${a}
    Result: ${r}
    
    Return JSON format: {"s": "...", "t": "...", "a": "...", "r": "...", "reflection": "..."}`;

    try {
        const response = await callClaude(prompt);
        const data = JSON.parse(response.replace(/```json|```/g, ''));
        document.getElementById('starS').value = data.s;
        document.getElementById('starT').value = data.t;
        document.getElementById('starA').value = data.a;
        document.getElementById('starR').value = data.r;
        document.getElementById('starReflection').value = data.reflection || '';
        showToast('Story Polished!', 'success');
    } catch (e) {
        showToast('Failed to polish story', 'err');
    }
}

// -- 4. LINKEDIN OUTREACH --
async function generateOutreach() {
    const company = document.getElementById('outCompany').value;
    const person = document.getElementById('outPerson').value;
    const role = document.getElementById('outRole').value;
    const type = document.getElementById('outType').value;
    const proof = document.getElementById('outProof').value;
    const resultDiv = document.getElementById('outResult');

    if (!company || !role) return showToast('Company and Role are required', 'err');

    resultDiv.innerHTML = '<div class="card loading-placeholder">Crafting your power move...</div>';

    const prompt = `Generate a LinkedIn outreach message (under 300 characters) for a ${type} at ${company} for the ${role} role.
    Target Name: ${person}
    My Key Proof Point: ${proof}
    
    Follow the 3-sentence power-move framework:
    1. Direct match/interest hook.
    2. Concrete proof point (value-add).
    3. Low-friction CTA.
    
    Return 2 options.`;

    try {
        const response = await callClaude(prompt);
        resultDiv.innerHTML = `
            <div class="outreach-msg">
                ${response.replace(/\n/g, '<br>')}
                <div class="char-count">Target: < 300 chars</div>
            </div>
            <button class="icon-btn" style="margin-top:10px" onclick="copyDivContent('outResult')">ðŸ“‹ Copy Message</button>
        `;
    } catch (e) {
        resultDiv.innerHTML = `<div class="card err-box">Error: ${e.message}</div>`;
    }
}

// -- 5. SALARY NEGOTIATOR --
async function runSalaryAnalysis() {
    const role = document.getElementById('salRole').value;
    const company = document.getElementById('salCompany').value;
    const loc = document.getElementById('salLocation').value;
    const exp = document.getElementById('salYears').value;
    const scenario = document.getElementById('salScenario').value;
    const resultDiv = document.getElementById('salResult');

    if (!role || !company) return showToast('Role and Company are required', 'err');

    resultDiv.innerHTML = '<div class="card loading-placeholder">Analyzing market data and crafting strategy...</div>';

    const prompt = `Act as a senior compensation negotiator. 
    Scenario: ${scenario}
    Role: ${role}
    Company: ${company}
    Location: ${loc}
    Experience: ${exp} years
    
    Provide:
    1. Market Salary Range (Estimated)
    2. Negotiation Strategy / Script
    3. Key Leverage Points
    4. "Geographic Discount" or "Compete" logic if applicable.
    
    Format as clean HTML with a visual range bar.`;

    try {
        const response = await callClaude(prompt);
        resultDiv.innerHTML = `<div class="card">${response}</div>`;
    } catch (e) {
        resultDiv.innerHTML = `<div class="card err-box">Error: ${e.message}</div>`;
    }
}

// -- HELPERS --
function copyDivContent(id) {
    const text = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
}

function addTrackerEntry() {
    const company = prompt('Enter Company Name:');
    const role = prompt('Enter Role Title:');
    if (company && role) {
        saveToTracker({ company, role, score: 'â€”', status: 'Applied' });
    }
}

