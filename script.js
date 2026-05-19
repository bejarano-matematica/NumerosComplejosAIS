let audioCtx;
let timerInterval;
const TIME_LIMIT = 120;
let exerciseStep = 0;
let autoExitTimer = null; 

// --- BANCO DE EJERCICIOS ---
// --- BANCO DE EJERCICIOS AMPLIADO Y SIN REPETICIÓN ---
const level2Bank = [
    { q: "i^{15} \\cdot i^{3} : i^{17}", a: "i" },
    { q: "i^{18} : i^{16}", a: "-1" },
    { q: "2(\\cos 60^\\circ + i \\sin 60^\\circ) \\cdot 3(\\cos 110^\\circ + i \\sin 110^\\circ)", a: "6(\\cos(170^\\circ)+i\\sin(170^\\circ))" },
    { q: "8(\\cos 50^\\circ + i \\sin 50^\\circ) : 2(\\cos 35^\\circ + i \\sin 35^\\circ)", a: "4(\\cos(15^\\circ)+i\\sin(15^\\circ))" },
    { q: "4\\angle 120^\\circ \\cdot 2\\angle 90^\\circ", a: "8\\angle 210^\\circ" },
    { q: "12\\angle 315^\\circ : 3\\angle 45^\\circ", a: "4\\angle 270^\\circ" },
    // NUEVOS INYECTADOS
    { q: "i^{45} \\cdot i^{12}", a: "i" },
    { q: "i^{102}", a: "-1" },
    { q: "5\\angle 30^\\circ \\cdot 2\\angle 45^\\circ", a: "10\\angle 75^\\circ" },
    { q: "20(\\cos 180^\\circ + i \\sin 180^\\circ) : 5(\\cos 90^\\circ + i \\sin 90^\\circ)", a: "4(\\cos(90^\\circ)+i\\sin(90^\\circ))" }
];

const level3Bank = [
    { q: "(1 - 2i + 3 + i) \\cdot 2i", a: "2+8i" },
    { q: "(1 - 2i) \\cdot 2i - (3 + i)", a: "1+i" },
    { q: "(2+3i)^{2}", a: "-5+12i" },
    { q: "\\frac{2-i}{1+i}", a: "\\frac{1}{2}-\\frac{3}{2}i" },
    { q: "i^{34}", a: "-1" },
    { q: "2(1+i) - 3(2-i)", a: "-4+5i" },
    // NUEVOS INYECTADOS
    { q: "(3 + 2i)(3 - 2i) - 5", a: "8" },
    { q: "\\frac{4+2i}{2-i}", a: "+2i" },
    { q: "(1 - i)^{2} + 3i", a: "i" },
    { q: "2i(5 - 3i) + (1 - i)", a: "7+9i" }
];

// Copias dinámicas para evitar repeticiones (Mazo de cartas)
let activeLevel2Deck = [];
let activeLevel3Deck = [];

function parseComplex(str) {
    let re = 0, im = 0, reTerms = 0, imTerms = 0;
    let s = str.replace(/[\{\}\s\\]/g, "").replace(/frac/g, "/").replace(/\^circ/g, "");
    s = s.replace(/-/g, "+-");
    if (s.startsWith("+")) s = s.substring(1);
    
    let parts = s.split("+").filter(p => p !== "");
    parts.forEach(p => {
        if (p.includes("i")) {
            imTerms++;
            let val = p.replace("i", "");
            if (val === "" || val === "1") im += 1;
            else if (val === "-") im -= 1;
            else if (val === "-1") im -= 1;
            else im += parseFloat(val) || 0;
        } else {
            reTerms++;
            re += parseFloat(p) || 0;
        }
    });
    return { re, im, reTerms, imTerms, totalTerms: parts.length };
}

function renderMathDirectly(elementId, latexStr) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // OPTIMIZACIÓN VISUAL: Si la expresión es larga (como la forma polar), bajamos la fuente para que entre entera
    el.style.fontSize = latexStr.length > 25 ? "1.1rem" : "1.5rem";
    el.innerHTML = `\\( ${latexStr} \\)`;
    
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([el]).then(() => {
            const mjx = el.querySelector('mjx-container');
            if (mjx) mjx.style.color = 'white';
        }).catch(err => console.warn("MathJax reset:", err));
    }
}

function playTick() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } catch(e) {}
}

const rndVal = () => { let v = Math.floor(Math.random() * 8) + 1; return Math.random() > 0.5 ? v : -v; };

function formatC(re, im) {
    if (re === 0 && im === 0) return "0";
    let s = "";
    if (re !== 0) s += re;
    if (im !== 0) {
        if (im > 0 && re !== 0) s += "+";
        else if (im < 0) s += "-";
        let absIm = Math.abs(im);
        s += (absIm === 1 ? "i" : absIm + "i");
    }
    return s;
}

// LÓGICA DE EXTRACCIÓN SIN REPETICIÓN
function getExercise() {
    exerciseStep++;
    if (gameState.currentLevel === 1) {
        const types = ['suma', 'resta', 'mult', 'div'];
        const type = types[Math.floor(Math.random() * types.length)];
        let a = rndVal(), b = rndVal(), c = rndVal(), d = rndVal();
        
        if (type === 'suma') return { q: `(${formatC(a, b)}) + (${formatC(c, d)})`, a: formatC(a + c, b + d), type: 'suma' };
        if (type === 'resta') return { q: `(${formatC(a, b)}) - (${formatC(c, d)})`, a: formatC(a - c, b - d), type: 'resta' };
        if (type === 'mult') { let re = (a * c) - (b * d), im = (a * d) + (b * c); return { q: `(${formatC(a, b)}) \\cdot (${formatC(c, d)})`, a: formatC(re, im), type: 'mult' }; }
        if (type === 'div') { let z1_re = a, z1_im = b, z2_re = c, z2_im = d; let z3_re = (z1_re * z2_re) - (z1_im * z2_im); let z3_im = (z1_re * z2_im) + (z1_im * z2_re); return { q: `\\frac{${formatC(z3_re, z3_im)}}{${formatC(z2_re, z2_im)}}`, a: formatC(z1_re, z1_im), type: 'div' }; }
    } 
    else if (gameState.currentLevel === 2) {
        if (activeLevel2Deck.length === 0) {
            activeLevel2Deck = [...level2Bank].sort(() => Math.random() - 0.5);
        }
        return activeLevel2Deck.shift();
    } 
    else {
        if (activeLevel3Deck.length === 0) {
            activeLevel3Deck = [...level3Bank].sort(() => Math.random() - 0.5);
        }
        return activeLevel3Deck.shift();
    }
}

let gameState = { userString: "", cursorPos: 0, playerHP: 100, monsterHP: 100, isGameOver: false, isBlocked: false, playerName: "VECTOR_ACTIVO", selectedAvatarImg: "", currentLevel: 1, score: 0, timeLeft: TIME_LIMIT, mistakes: [] };
let currentExercise = null;

function selectAvatar(img, el) { gameState.selectedAvatarImg = img; document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected')); el.classList.add('selected'); playTick(); }

function startGame() {
    gameState.playerName = document.getElementById('player-name-input').value.trim() || "OPERATIVO_1";
    document.getElementById('display-name').innerText = gameState.playerName.toUpperCase();
    document.getElementById('player-avatar-display').src = gameState.selectedAvatarImg || "https://images.unsplash.com/photo-1618336306544-cb22a9446340?q=80&w=150";
    document.getElementById('screen-start').style.display = 'none'; document.getElementById('screen-game').style.display = 'flex';
    gameState.currentLevel = 1; gameState.score = 0; gameState.playerHP = 100; gameState.monsterHP = 100; exerciseStep = 0;
    activeLevel2Deck = []; activeLevel3Deck = []; // Reset de mazos
    initKeyboard(); updateUI(); nextExercise(); 
}

function restartApp() { clearInterval(timerInterval); document.getElementById('screen-end').style.display = 'none'; document.getElementById('screen-start').style.display = 'flex'; document.getElementById('player-name-input').value = ""; }

function nextExercise() {
    if (gameState.isGameOver) return;
    currentExercise = getExercise();
    gameState.userString = ""; gameState.cursorPos = 0;
    document.getElementById('user-input-display').classList.remove('error-text');
    updateMessage(`[NÚCLEO ${gameState.currentLevel}] ESPERANDO DATOS...`);
    renderMathDirectly('exercise-display', `${currentExercise.q} =`);
    renderUserAnswer();
    startTimer();
}

function renderUserAnswer() {
    if (gameState.isBlocked) return;
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    let t = before + '|' + after;
    if(t === "|") t = "\\text{?}";
    renderMathDirectly('user-input-display', t);
    clearTimeout(autoExitTimer);
    if (after.startsWith('}') || after.startsWith('}{')) {
        autoExitTimer = setTimeout(() => {
            if (!gameState.isGameOver && !gameState.isBlocked) {
                let currentAfter = gameState.userString.slice(gameState.cursorPos);
                if (currentAfter.startsWith('}{')) { gameState.cursorPos += 2; renderUserAnswer(); } 
                else if (currentAfter.startsWith('}')) { gameState.cursorPos++; renderUserAnswer(); }
            }
        }, 1500);
    }
}

function handleInput(k) {
    if (gameState.isGameOver || gameState.isBlocked) return;
    playTick();
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    if (after.startsWith('}') && ['+','-','i','/','a/b','(',')','sen','cos','∠','°'].includes(k)) {
        gameState.cursorPos++; before = gameState.userString.slice(0, gameState.cursorPos); after = gameState.userString.slice(gameState.cursorPos);
    }
    let insertStr = k; let cursorOffset = k.length;
    if (k === '^2') { insertStr = "^{2}"; cursorOffset = 4; } 
    else if (k === '^') { insertStr = "^{}"; cursorOffset = 2; } 
    else if (k === 'a/b' || k === '/') { insertStr = "\\frac{}{}"; cursorOffset = 6; }
    else if (k === 'sen') { insertStr = "\\sin("; cursorOffset = 5; }
    else if (k === 'cos') { insertStr = "\\cos("; cursorOffset = 5; }
    else if (k === '√') { insertStr = "\\sqrt{}"; cursorOffset = 6; }
    else if (k === '°') { insertStr = "^\\circ"; cursorOffset = 6; }
    else if (k === '∠') { insertStr = "\\angle "; cursorOffset = 7; }
    gameState.userString = before + insertStr + after;
    gameState.cursorPos += cursorOffset;
    renderUserAnswer();
}

function backspace() {
    if (gameState.isGameOver || gameState.isBlocked || gameState.cursorPos === 0) return;
    playTick();
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    if (before.endsWith("\\frac{") && after.startsWith("}{}")) { gameState.userString = before.slice(0, -6) + after.slice(3); gameState.cursorPos -= 6; } 
    else if (before.endsWith("\\sqrt{") && after.startsWith("}")) { gameState.userString = before.slice(0, -6) + after.slice(1); gameState.cursorPos -= 6; }
    else if (before.endsWith("\\sin(")) { gameState.userString = before.slice(0, -5) + after; gameState.cursorPos -= 5; }
    else if (before.endsWith("\\cos(")) { gameState.userString = before.slice(0, -5) + after; gameState.cursorPos -= 5; }
    else if (before.endsWith("^\\circ")) { gameState.userString = before.slice(0, -6) + after; gameState.cursorPos -= 6; }
    else if (before.endsWith("\\angle ")) { gameState.userString = before.slice(0, -7) + after; gameState.cursorPos -= 7; }
    else if (before.endsWith("^{") && after.startsWith("}")) { gameState.userString = before.slice(0, -2) + after.slice(1); gameState.cursorPos -= 2; }
    else if (before.endsWith("^{2}")) { gameState.userString = before.slice(0, -4) + after; gameState.cursorPos -= 4; } 
    else if (before.endsWith("{") || before.endsWith("}")) {
        if (before.endsWith("}{")) gameState.cursorPos -= 2;
        else if (before.endsWith("\\frac{")) gameState.cursorPos -= 6;
        else if (before.endsWith("\\sqrt{")) gameState.cursorPos -= 6;
        else if (before.endsWith("^{")) gameState.cursorPos -= 2;
        else gameState.cursorPos--;
    } 
    else { gameState.userString = before.slice(0, -1) + after; gameState.cursorPos--; }
    renderUserAnswer();
}

function moveCursor(dir) {
    if (gameState.isGameOver || gameState.isBlocked) return;
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    if (dir === 'left' && gameState.cursorPos > 0) {
        if (before.endsWith("}{")) gameState.cursorPos -= 2;
        else if (before.endsWith("\\frac{")) gameState.cursorPos -= 6;
        else if (before.endsWith("\\sqrt{")) gameState.cursorPos -= 6;
        else if (before.endsWith("^{")) gameState.cursorPos -= 2;
        else gameState.cursorPos--;
        playTick();
    }
    if (dir === 'right' && gameState.cursorPos < gameState.userString.length) {
        if (after.startsWith("}{")) gameState.cursorPos += 2;
        else if (after.startsWith("}")) gameState.cursorPos++;
        else gameState.cursorPos++;
        playTick();
    }
    renderUserAnswer();
}

function clearInput() { if (!gameState.isBlocked) { playTick(); gameState.userString = ""; gameState.cursorPos = 0; renderUserAnswer(); } }

function cleanC(str) { return str.replace(/\s+/g, "").replace(/\\+/g, "").replace(/\+i/g, "+1i").replace(/\-i/g, "-1i").replace(/^i/g, "1i"); }

function checkAnswer() {
    if (gameState.isGameOver || gameState.isBlocked || gameState.userString === "") return;
    playTick();
    
    if (gameState.userString.includes("i^{2}") || gameState.userString.includes("i^2")) {
        updateMessage("¡ATENCIÓN! REEMPLAZÁ i² POR -1 Y AGRUPÁ REALES.");
        return; 
    }

    let uNormal = cleanC(gameState.userString);
    let cNormal = cleanC(currentExercise.a);
    
    if (uNormal === cNormal) {
        processHit();
        return;
    }

    if (!cNormal.includes("cos") && !cNormal.includes("sin") && !cNormal.includes("frac") && !cNormal.includes("angle")) {
        let user = parseComplex(gameState.userString);
        let correct = parseComplex(currentExercise.a);
        
        if (user.re === correct.re && user.im === correct.im) {
            if (user.reTerms > 1 || user.imTerms > 1) {
                updateMessage("SCAN: No te olvides de operar con los términos semejantes.");
            } else {
                processHit();
            }
            return; 
        }
    }
    processMiss();
}

// TRANSICIÓN ACELERADA (De 3.5s bajó a 1.2s totales para evitar lag)
function processHit() {
    gameState.isBlocked = true; clearInterval(timerInterval);
    gameState.score += 100 + gameState.timeLeft; gameState.monsterHP -= 34; updateUI();
    updateMessage("VULNERABILIDAD EXPLOTADA");
    
    setTimeout(() => { 
        if (gameState.monsterHP <= 0) {
            gameState.score += 500; 
            if (gameState.currentLevel < 3) {
                gameState.currentLevel++; gameState.monsterHP = 100; exerciseStep = 0;
                
                // Reseteamos displays de entrada antes de inyectar el teclado
                gameState.userString = ""; gameState.cursorPos = 0;
                document.getElementById('user-input-display').innerHTML = "";
                
                updateUI(); 
                updateMessage(`ACCEDIENDO AL NÚCLEO ${gameState.currentLevel}...`);
                
                if (typeof playLevelUpSound === 'function') playLevelUpSound(); 
                
                // Sincronización limpia de teclado y carga de ejercicio
                setTimeout(() => { 
                    initKeyboard();
                    gameState.isBlocked = false; 
                    nextExercise(); 
                }, 800);
            } else { endGame(true); }
        } else { gameState.isBlocked = false; nextExercise(); }
    }, 400);
}

function processMiss() {
    gameState.isBlocked = true; clearInterval(timerInterval);
    gameState.playerHP -= 25; updateUI();
    updateMessage("SINTAXIS RECHAZADA. DAÑO RECIBIDO.");
    gameState.mistakes.push({ q: currentExercise.q, user: gameState.userString, correct: currentExercise.a });
    const d = document.getElementById('user-input-display');
    d.classList.add('error-text'); renderMathDirectly('user-input-display', `\\text{Core: } ${currentExercise.a}`);
    animateDamage('battle-scene');
    setTimeout(() => { gameState.isBlocked = false; if (gameState.playerHP <= 0) endGame(false); else nextExercise(); }, 2000);
}

function startTimer() { if (timerInterval) clearInterval(timerInterval); gameState.timeLeft = TIME_LIMIT; updateTimerDisplay(); timerInterval = setInterval(() => { if (!gameState.isBlocked && !gameState.isGameOver) { gameState.timeLeft--; updateTimerDisplay(); if (gameState.timeLeft <= 0) { clearInterval(timerInterval); processMiss(); } } }, 1000); }
function updateTimerDisplay() { const m = Math.floor(gameState.timeLeft / 60).toString().padStart(2, '0'); const s = (gameState.timeLeft % 60).toString().padStart(2, '0'); document.getElementById('timer-display').innerText = `${m}:${s}`; }
function updateUI() { document.getElementById('player-hp').style.width = Math.max(0, gameState.playerHP) + "%"; const monsterBar = document.getElementById('monster-hp'); monsterBar.style.width = Math.max(0, gameState.monsterHP) + "%"; document.getElementById('enemy-name-display').innerText = `NÚCLEO IA ${gameState.currentLevel}`; }
function updateMessage(t) { document.getElementById('battle-message').innerText = t; }
function animateDamage(id) { const el = document.getElementById(id); if(el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 300); } }


function endGame(win) {
    gameState.isGameOver = true; 
    clearInterval(timerInterval);
    document.getElementById('screen-game').style.display = 'none'; 
    document.getElementById('screen-end').style.display = 'flex';
    
    const endTitle = document.getElementById('end-title');
    const endMessage = document.getElementById('end-message');
    const finalContainer = document.getElementById('final-controls-container');
    
    document.getElementById('end-score').innerText = `PUNTAJE: ${gameState.score}`;
    
    // Armamos el tablero reglamentario de fallos
    const board = document.getElementById('mistakes-board'); 
    const list = document.getElementById('mistakes-list');
    list.innerHTML = '';
    
    if (gameState.mistakes.length > 0) {
        board.style.display = 'block';
        gameState.mistakes.forEach((err) => {
            const li = document.createElement('li');
            li.innerHTML = `\\( ${err.q} \\) <br> <span style="color:#ff00ff">Tu error: \\( ${err.user} \\)</span> <br> <span style="color:#00f0ff">Correcto: \\( ${err.correct} \\)</span>`;
            list.appendChild(li);
        });
        if (window.MathJax) MathJax.typesetPromise([list]);
    } else { 
        board.style.display = 'none'; 
    }

    if (win) {
        endTitle.innerText = "SISTEMA VULNERADO";
        endTitle.className = "neon-text-cyan";
        endMessage.innerText = "Protocolos de seguridad de la IA comprometidos de forma exitosa.";
        
        // BOTÓN LIMPIO DE ESPERA: Evita el amontonamiento inicial en el touch
        finalContainer.style.height = "auto";
        finalContainer.innerHTML = `
            <button onclick="activarFaseBroma()" class="btn-start" style="width: 100%; border-color: var(--cyan); color: var(--cyan);">
                > CONTINUAR PROTOCOLO
            </button>
        `;
    } else {
        // Flujo tradicional si pierden la partida
        endTitle.innerText = "CONEXIÓN PERDIDA";
        endTitle.className = "neon-text-magenta";
        endMessage.innerText = "La IA enemiga superó tus escudos corporativos.";
        finalContainer.style.height = "auto";
        finalContainer.innerHTML = `<button id="btn-final-action" onclick="restartApp()" class="btn-start" style="width: 100%;">NUEVA SESIÓN</button>`;
    }
}

// NUEVA FUNCIÓN: Limpia la pantalla de errores y despliega el lore de preceptoría sin amontonamiento
function activarFaseBroma() {
    playTick();
    
    // Ocultamos el tablero de fallos de forma definitiva para liberar el espacio touch
    document.getElementById('mistakes-board').style.display = 'none';
    document.getElementById('end-score').style.display = 'none';
    
    const endTitle = document.getElementById('end-title');
    const endMessage = document.getElementById('end-message');
    const finalContainer = document.getElementById('final-controls-container');
    
    endTitle.innerText = "NÚCLEO MAINFRAME";
    endTitle.className = "neon-text-cyan";
    
    // Agregamos un texto que acompañe de manera formal la acción
    endMessage.innerHTML = `
        <span style="color: #ffff00; font-family: var(--font-sec); font-size: 1.2rem;">SISTEMA DE ASIGNACIÓN DE CALIFICACIONES - IAS</span><br><br>
        Conexión establecida con las planillas de 5to año. Registre la condición definitiva del alumno en la base de datos:
    `;
    
    // Otorgamos un contenedor alto exclusivo (180px) para que el botón tenga rango seguro de huida
    finalContainer.style.height = "180px";
    
    finalContainer.innerHTML = `
        <button id="btn-aprobaste" tabindex="-1" onmouseover="dodgeButton(this)" ontouchstart="dodgeButton(this, event)" onclick="dodgeButton(this, event)" style="position: absolute; left: 10%; top: 40px; font-size: 1.2em; background: var(--cyan); color: #000; border: none; padding: 12px 25px; cursor: pointer; z-index: 10; border-radius: 4px; font-family: var(--font-main); font-weight: bold; box-shadow: 0 0 10px var(--cyan); margin:0;">
            Aprobaste
        </button>
        <button onclick="acceptDefeat()" style="position: absolute; right: 10%; top: 40px; font-size: 1.2em; background: transparent; color: var(--magenta); border: 2px solid var(--magenta); padding: 12px 25px; cursor: pointer; z-index: 5; border-radius: 4px; font-family: var(--font-main); font-weight: bold; box-shadow: 0 0 10px rgba(255,0,255,0.2); margin:0;">
            Diciembre
        </button>
    `;
}

function giveHint() {
    if (gameState.isGameOver || gameState.isBlocked) return;
    playTick();
    let hint = "";
    if (gameState.currentLevel === 1 && currentExercise) {
        const currentType = currentExercise.type;
        if (currentType === 'suma') hint = "Suma reales con reales e imaginarios con imaginarios.";
        else if (currentType === 'resta') hint = "El signo menos cambia los signos de todo el segundo paréntesis.";
        else if (currentType === 'mult') hint = "Aplica distributiva doble. No olvides que i² es -1.";
        else hint = "Multiplica arriba y abajo por el conjugado del divisor.";
    } 
    else if (gameState.currentLevel === 2) hint = "En polares: Multiplicá módulos y sumá ángulos. En i^n: Dividí el exponente por 4.";
    else hint = "Análisis de Núcleo: Resuelve potencias y multiplicaciones antes de sumar.";
    updateMessage("SCAN: " + hint);
}

function setupControls() {
    document.getElementById('btn-spell').onclick = checkAnswer;
    let btnHint = document.getElementById('btn-hint') || document.getElementById('btn-reset');
    if (btnHint) { btnHint.id = 'btn-hint'; btnHint.innerText = 'ESCANEAR'; btnHint.onclick = giveHint; }
}

function initKeyboard() {
    let keys = (gameState.currentLevel === 1) ? 
        ['1','2','3','+','-','◀',
         '4','5','6','i','/','▶',
         '7','8','9','^2','^','a/b', 
         '0','DEL','(',')','CLR'] :  
        ['sen','cos','°','√','∠','π',
         '1','2','3','+','-','◀',
         '4','5','6','i','/','▶',
         '7','8','9','^2','^','a/b', 
         '0','DEL','(',')','CLR'];   
    const container = document.getElementById('keyboard'); container.innerHTML = '';
    keys.forEach(k => {
        const b = document.createElement('button');
        b.innerText = k === 'DEL' ? 'BORRAR' : (k === '^2' ? 'x²' : (k === 'CLR' ? 'C' : k)); 
        b.className = 'key';
        if (k === 'DEL' || k === 'CLR') b.classList.add('key-del');
        else if (['+','-','i','^2','^','/','a/b','(',')','◀','▶','sen','cos','°','√','∠','π'].includes(k)) {
            b.classList.add('key-op');
            if (['sen','cos','°','√','∠','π'].includes(k)) b.style.borderColor = "#f1c40f"; 
        }
        if (k === '0') b.classList.add('key-zero');
        b.onmousedown = (ev) => { ev.preventDefault(); if (k === 'DEL') backspace(); else if (k === 'CLR') clearInput(); else if (k === '◀') moveCursor('left'); else if (k === '▶') moveCursor('right'); else handleInput(k); };
        container.appendChild(b);
    });
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('screen-start').style.display === 'flex') { if (e.key === "Enter") startGame(); return; }
    if (!gameState.isGameOver && !gameState.isBlocked) {
        if (e.key === "Enter") checkAnswer();
        else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); moveCursor('left'); }
        else if (e.key === "ArrowRight") { e.preventDefault(); moveCursor('right'); }
        else if ("0123456789+-i/()^".includes(e.key.toLowerCase())) { e.preventDefault(); handleInput(e.key.toLowerCase()); }
    }
});

const avatarsList = ['avatar1.jpeg', 'avatar2.jpeg', 'avatar3.jpeg', 'avatar4.jpeg', 'avatar5.jpeg'];

function loadRandomAvatars() {
    const container = document.getElementById('avatar-container');
    if (!container) return;
    container.innerHTML = ''; 
    const shuffledAvatars = avatarsList.sort(() => 0.5 - Math.random());
    shuffledAvatars.forEach((src, index) => {
        const div = document.createElement('div');
        div.className = 'avatar-option';
        if (index === 0) { div.classList.add('selected'); gameState.selectedAvatarImg = src; }
        div.onclick = function() { selectAvatar(src, this); };
        const img = document.createElement('img');
        img.src = src; img.alt = `Vector ${index + 1}`;
        div.appendChild(img); container.appendChild(div);
    });
}

window.onload = () => { setupControls(); initKeyboard(); loadRandomAvatars(); };
