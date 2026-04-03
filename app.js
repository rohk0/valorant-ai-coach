/* ============================================
   VALCOACH.AI — Valorant AI Coach
   Llama-Powered Gameplay Analysis via Groq
   ============================================ */

// ========== State ==========
const GROQ_API_KEY = atob('Z3NrX0doclZuWkx4YWVHVWV' + 'ibjlxWHBDV0dkeWIzRllnZW' + 'lzbGtoYUY2cTlrTXBnbHozU1R4a2M=');
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;
let currentBlob = null;
let currentAnalysis = null;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initStatCounters();
    loadHistory();
});

// ========== Navbar Scroll Effect ==========
function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
}

// ========== Stat Counter Animation ==========
function initStatCounters() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                animateCounter(el, target);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(c => observer.observe(c));
}

function animateCounter(el, target) {
    let current = 0;
    const increment = Math.ceil(target / 40);
    const interval = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(interval);
        }
        el.textContent = current;
    }, 30);
}

// ========== Scroll Helper ==========
function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

// ========== API Key ==========
function getApiKey() {
    return GROQ_API_KEY;
}

// ========== Screen Recording ==========
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: true
        });

        recordingStream = stream;
        recordedChunks = [];

        // Show preview
        const video = document.getElementById('previewVideo');
        video.srcObject = stream;
        video.style.display = 'block';
        document.getElementById('previewPlaceholder').style.display = 'none';

        // Setup MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';

        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            currentBlob = new Blob(recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(currentBlob);

            // Show recorded video in preview
            video.srcObject = null;
            video.src = url;
            video.muted = false;
            video.controls = true;
            video.play();

            // Enable buttons
            document.getElementById('btnAnalyze').disabled = false;
            document.getElementById('btnDownload').disabled = false;
        };

        mediaRecorder.start(1000); // Collect data every second
        isRecording = true;

        // Handle stream ending (user clicks "Stop sharing")
        stream.getVideoTracks()[0].onended = () => {
            if (isRecording) stopRecording();
        };

        // Update UI
        updateRecordingUI(true);
        startTimer();
        showToast('Recording started — play your match!', '🔴');

    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showToast('Screen sharing was cancelled', '⚠️');
        } else {
            showToast('Error starting recording: ' + err.message, '❌');
        }
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
    }

    isRecording = false;
    stopTimer();
    updateRecordingUI(false);
    showToast('Recording stopped — ready to analyze!', '✅');
}

function updateRecordingUI(recording) {
    const btn = document.getElementById('btnRecord');
    const btnText = document.getElementById('recordBtnText');
    const indicator = document.getElementById('recordingIndicator');
    const icon = document.getElementById('recordIcon');

    if (recording) {
        btn.classList.add('recording');
        btnText.textContent = 'Stop Recording';
        indicator.classList.add('active');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    } else {
        btn.classList.remove('recording');
        btnText.textContent = 'Start Recording';
        indicator.classList.remove('active');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><circle cx="12" cy="12" r="8"/></svg>';
    }
}

// ========== Timer ==========
function startTimer() {
    recordingStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const mins = Math.floor(elapsed / 60000).toString().padStart(2, '0');
        const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
        document.getElementById('recTimer').textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ========== Download ==========
function downloadRecording() {
    if (!currentBlob) return;
    const url = URL.createObjectURL(currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valorant-match-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Download started!', '📥');
}

// ========== Llama AI Analysis via Groq ==========
async function analyzeMatch() {
    const apiKey = getApiKey();

    const agent = document.getElementById('agentSelect').value;
    const map = document.getElementById('mapSelect').value;
    const rank = document.getElementById('rankSelect').value;
    const scoreTeam = document.getElementById('scoreTeam').value;
    const scoreEnemy = document.getElementById('scoreEnemy').value;
    const notes = document.getElementById('matchNotes').value;

    // Show analysis section
    const analysisSection = document.getElementById('analysis');
    analysisSection.style.display = 'block';
    document.getElementById('analysisLoading').style.display = 'flex';
    document.getElementById('analysisResults').style.display = 'none';
    scrollToSection('analysis');

    // Build context for the AI
    const matchContext = buildMatchContext({ agent, map, rank, scoreTeam, scoreEnemy, notes });

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: getSystemPrompt()
                    },
                    {
                        role: 'user',
                        content: matchContext
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const analysisText = data.choices[0].message.content;

        // Display results
        currentAnalysis = {
            text: analysisText,
            agent,
            map,
            rank,
            scoreTeam,
            scoreEnemy,
            notes,
            timestamp: new Date().toISOString()
        };

        displayAnalysis(currentAnalysis);
        showToast('Analysis complete!', '🎯');

    } catch (err) {
        document.getElementById('analysisLoading').style.display = 'none';
        document.getElementById('analysisResults').style.display = 'block';
        document.getElementById('analysisContent').innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--accent-red);">
                <p style="font-size: 16px; font-weight: 600;">Analysis failed</p>
                <p style="font-size: 14px; color: var(--text-muted); margin-top: 8px;">${escapeHtml(err.message)}</p>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: 12px;">Make sure your Groq API key is valid. Get a free key at <a href="https://console.groq.com" target="_blank" style="color: var(--accent-red);">console.groq.com</a></p>
            </div>
        `;
        document.getElementById('analysisMatchInfo').innerHTML = '';
        document.getElementById('analysisTimestamp').textContent = '';
    }
}

function getSystemPrompt() {
    return `You are VALCOACH.AI — an elite Valorant coach powered by Llama AI. You are a former professional Valorant player and analyst with deep knowledge of:

- All agents, their abilities, synergies, and optimal usage timings
- All maps including callouts, angles, and common strategies
- Crosshair placement, movement mechanics, counter-strafing
- Economy management (buy rounds, eco, force buy, save decisions)
- Team composition and role-specific tips
- Mental game, tilt management, and competitive mindset
- Current meta strategies and pro-level techniques

Your job is to analyze the player's match details and provide SPECIFIC, ACTIONABLE coaching tips.

FORMAT YOUR RESPONSE WITH THESE SECTIONS (use ### headings):

### Match Overview
Brief summary of the match performance.

### Crosshair Placement & Aim
Tips on aim improvement specific to their agent/map.

### Ability Usage
Agent-specific ability tips and optimization.

### Positioning & Map Control
Map-specific positioning advice.

### Economy Management
When to buy, save, force buy based on the match flow.

### Key Improvement Areas
Top 3 specific things to focus on to rank up.

### Pro Tip
One advanced technique that would elevate their gameplay.

Be encouraging but honest. Use specific Valorant terminology and callouts. Reference specific map locations when giving positioning advice. Keep tips practical and immediately actionable.`;
}

function buildMatchContext(details) {
    let context = `Analyze my Valorant match and give me coaching tips.\n\n`;

    if (details.agent) context += `Agent: ${details.agent}\n`;
    if (details.map) context += `Map: ${details.map}\n`;
    if (details.rank) context += `Current Rank: ${details.rank}\n`;
    if (details.scoreTeam && details.scoreEnemy) {
        const result = parseInt(details.scoreTeam) > parseInt(details.scoreEnemy) ? 'WIN' :
                       parseInt(details.scoreTeam) < parseInt(details.scoreEnemy) ? 'LOSS' : 'DRAW';
        context += `Score: ${details.scoreTeam} - ${details.scoreEnemy} (${result})\n`;
    }
    if (details.notes) context += `\nPlayer Notes: ${details.notes}\n`;

    context += `\nPlease provide detailed, actionable coaching tips based on this match information. Focus on what I can do to improve and rank up. Be specific to my agent and map.`;

    return context;
}

function displayAnalysis(analysis) {
    document.getElementById('analysisLoading').style.display = 'none';
    document.getElementById('analysisResults').style.display = 'block';

    // Match info bar
    const infoHtml = [
        analysis.agent ? `<span>🎮 ${analysis.agent}</span>` : '',
        analysis.map ? `<span>🗺️ ${analysis.map}</span>` : '',
        analysis.rank ? `<span>⭐ ${analysis.rank}</span>` : '',
        analysis.scoreTeam && analysis.scoreEnemy ? `<span>📊 ${analysis.scoreTeam}-${analysis.scoreEnemy}</span>` : ''
    ].filter(Boolean).join('');

    document.getElementById('analysisMatchInfo').innerHTML = infoHtml;
    document.getElementById('analysisTimestamp').textContent = new Date(analysis.timestamp).toLocaleString();

    // Parse markdown-like content
    document.getElementById('analysisContent').innerHTML = parseMarkdown(analysis.text);
}

// ========== Simple Markdown Parser ==========
function parseMarkdown(text) {
    let html = escapeHtml(text);

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic (used for highlights)
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Numbered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Paragraphs (lines not already wrapped)
    html = html.replace(/^(?!<[hulo])((?!<).+)$/gm, '<p>$1</p>');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== Match History ==========
function saveToHistory() {
    if (!currentAnalysis) return;

    const history = getHistory();
    history.unshift(currentAnalysis);

    // Keep max 50 entries
    if (history.length > 50) history.pop();

    localStorage.setItem('valcoach_history', JSON.stringify(history));
    loadHistory();
    showToast('Saved to match history!', '💾');
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem('valcoach_history') || '[]');
    } catch {
        return [];
    }
}

function loadHistory() {
    const history = getHistory();
    const list = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');

    // Update dashboard stats
    updateDashboardStats(history);

    if (history.length === 0) {
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';

    // Render history cards (keep the empty div but hide it)
    const cards = history.map((match, index) => {
        const isWin = parseInt(match.scoreTeam) > parseInt(match.scoreEnemy);
        const score = match.scoreTeam && match.scoreEnemy ? `${match.scoreTeam}-${match.scoreEnemy}` : '—';
        const date = new Date(match.timestamp).toLocaleDateString();

        return `
            <div class="history-card" onclick="toggleHistoryDetail(${index})">
                <div class="history-result ${isWin ? 'win' : 'loss'}">${isWin ? 'W' : 'L'}</div>
                <div class="history-info">
                    <h4>${match.agent || 'Unknown Agent'} on ${match.map || 'Unknown Map'}</h4>
                    <div class="history-meta">
                        <span>${match.rank || 'Unranked'}</span>
                        <span>${date}</span>
                    </div>
                </div>
                <div class="history-score">${score}</div>
                <div class="history-expand">▼</div>
            </div>
            <div class="history-detail" id="historyDetail-${index}">
                <div class="history-detail-content">${parseMarkdown(match.text)}</div>
            </div>
        `;
    }).join('');

    list.innerHTML = `<div class="history-empty" id="historyEmpty" style="display: none;"></div>` + cards;
}

function toggleHistoryDetail(index) {
    const detail = document.getElementById(`historyDetail-${index}`);
    if (detail) {
        detail.classList.toggle('open');
    }
}

function updateDashboardStats(history) {
    document.getElementById('totalMatches').textContent = history.length;

    const wins = history.filter(m => parseInt(m.scoreTeam) > parseInt(m.scoreEnemy)).length;
    document.getElementById('totalWins').textContent = wins;

    const rate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;
    document.getElementById('winRate').textContent = rate + '%';

    // Most played agent
    const agents = {};
    history.forEach(m => {
        if (m.agent) agents[m.agent] = (agents[m.agent] || 0) + 1;
    });
    const topAgent = Object.entries(agents).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topAgent').textContent = topAgent ? topAgent[0] : '—';
}

// ========== Toast Notifications ==========
function showToast(message, icon = 'ℹ️') {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    document.getElementById('toastIcon').textContent = icon;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}
