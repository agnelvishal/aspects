import SwissEph from './swisseph-wasm/src/swisseph.js';

// DOM Elements
const planetsContainer = document.getElementById('planetsContainer');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const orbInput = document.getElementById('orb');
const findBtn = document.getElementById('findBtn');
const resultsContent = document.getElementById('resultsContent');
const statusMessage = document.getElementById('statusMessage');

// Planet definitions based on request and SwissEph constants
const S_PLANETS = [
    { id: 'sun', symbol: '☀️', name: 'Sun (Surya)', se_id: 0 }, // SE_SUN
    { id: 'moon', symbol: '🌙', name: 'Moon (Chandra)', se_id: 1 }, // SE_MOON
    { id: 'mars', symbol: '♂️', name: 'Mars (Mangala)', se_id: 4 }, // SE_MARS
    { id: 'mercury', symbol: '☿️', name: 'Mercury (Budha)', se_id: 2 }, // SE_MERCURY
    { id: 'jupiter', symbol: '♃', name: 'Jupiter (Brihaspati)', se_id: 5 }, // SE_JUPITER
    { id: 'venus', symbol: '♀️', name: 'Venus (Shukra)', se_id: 3 }, // SE_VENUS
    { id: 'saturn', symbol: '♄', name: 'Saturn (Shani)', se_id: 6 }, // SE_SATURN
    { id: 'rahu', symbol: '☊', name: 'Rahu (True Node)', se_id: 11 }, // SE_TRUE_NODE
    { id: 'ketu', symbol: '☋', name: 'Ketu (Desc Node)', se_id: 'KETU' } // KETU is Rahu + 180 (calculated manually)
];

// Initialize UI
function initUI() {
    // Set default dates (today to 1 year from now)
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    startDateInput.value = today.toISOString().split('T')[0];
    endDateInput.value = nextYear.toISOString().split('T')[0];

    // Generate checkboxes
    S_PLANETS.forEach(planet => {
        const label = document.createElement('label');
        label.className = 'planet-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = planet.id;
        checkbox.dataset.seId = planet.se_id;
        checkbox.dataset.name = planet.name;
        checkbox.dataset.symbol = planet.symbol;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${planet.symbol} ${planet.name}`));
        planetsContainer.appendChild(label);
    });

    findBtn.addEventListener('click', handleFindConjunctions);
}

function showStatus(msg, isError = false) {
    statusMessage.textContent = msg;
    statusMessage.className = `status-msg ${isError ? 'error' : ''}`;
}

function hideStatus() {
    statusMessage.className = 'status-msg hidden';
}

function getSelectedPlanets() {
    const checkboxes = document.querySelectorAll('.planet-label input:checked');
    return Array.from(checkboxes).map(cb => ({
        id: cb.value,
        se_id: cb.dataset.seId === 'KETU' ? 'KETU' : parseInt(cb.dataset.seId),
        name: cb.dataset.name,
        symbol: cb.dataset.symbol
    }));
}

// Calculate shortest angular distance between two degrees (0-360)
function getAngularDistance(deg1, deg2) {
    let diff = Math.abs(deg1 - deg2) % 360;
    return diff > 180 ? 360 - diff : diff;
}

// Find max distance between any pair of planets in a given set
function getMaxDistance(positions) {
    let maxDist = 0;
    const len = positions.length;
    for (let i = 0; i < len; i++) {
        for (let j = i + 1; j < len; j++) {
            const dist = getAngularDistance(positions[i], positions[j]);
            if (dist > maxDist) maxDist = dist;
        }
    }
    return maxDist;
}

async function handleFindConjunctions() {
    const selectedPlanets = getSelectedPlanets();
    if (selectedPlanets.length < 2) {
        showStatus('Please select at least 2 planets.', true);
        return;
    }

    const startStr = startDateInput.value;
    const endStr = endDateInput.value;
    const orb = parseFloat(orbInput.value);

    if (!startStr || !endStr || isNaN(orb)) {
        showStatus('Please fill all configuration fields correctly.', true);
        return;
    }

    const start = new Date(startStr);
    const end = new Date(endStr);

    if (start >= end) {
        showStatus('End date must be after start date.', true);
        return;
    }

    findBtn.disabled = true;
    showStatus('Initializing ephemeris...');
    resultsContent.innerHTML = '';

    let swe = null;
    try {
        swe = new SwissEph();
        await swe.initSwissEph();
        
        // Use Lahiri Ayanamsa for Indian Astrology (Sidereal)
        swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);

        showStatus('Calculating conjunctions... (This may take a moment)');
        
        // Yield to let UI update
        await new Promise(r => setTimeout(r, 50)); 

        // Calculation logic
        const results = findConjunctionRanges(swe, start, end, selectedPlanets, orb);
        
        renderResults(results, selectedPlanets);
        hideStatus();
    } catch (e) {
        console.error(e);
        showStatus(`Error: ${e.message}`, true);
    } finally {
        if (swe) swe.close();
        findBtn.disabled = false;
    }
}

function calculatePosition(swe, jd, planet_se_id) {
    // 2=SEFLG_SWIEPH, 65536=SEFLG_SIDEREAL
    const flags = 2 | 65536; 

    if (planet_se_id === 'KETU') {
        const rahuPos = swe.calc_ut(jd, 11, flags)[0]; // 11 is SE_TRUE_NODE
        return (rahuPos + 180) % 360;
    } else {
        return swe.calc_ut(jd, planet_se_id, flags)[0];
    }
}

function findConjunctionRanges(swe, start, end, planets, orb) {
    const results = [];
    
    // Convert to UTC dates for JD calculation roughly at 12:00 UTC
    const startMs = start.getTime();
    const endMs = end.getTime();
    
    // Check if Moon is included to adjust step size (Moon moves ~13 deg/day)
    const hasMoon = planets.some(p => p.se_id === 1);
    
    // Base step in days: 1 day if no moon, 0.125 days (3 hours) if Moon is present
    const baseStepJulian = hasMoon ? 0.125 : 1.0; 

    const startJd = swe.julday(
        start.getUTCFullYear(),
        start.getUTCMonth() + 1,
        start.getUTCDate(),
        12.0
    );
    
    const endJd = swe.julday(
        end.getUTCFullYear(),
        end.getUTCMonth() + 1,
        end.getUTCDate(),
        12.0
    );

    let inConjunction = false;
    let currentEvent = null;

    let currentJd = startJd;

    while (currentJd <= endJd) {
        const positions = planets.map(p => calculatePosition(swe, currentJd, p.se_id));
        const maxDist = getMaxDistance(positions);
        const isConjunct = maxDist <= orb;

        if (isConjunct && !inConjunction) {
            // Started a conjunction period
            inConjunction = true;
            currentEvent = {
                startJd: currentJd,
                minDistJd: currentJd,
                minDist: maxDist,
                endJd: currentJd
            };
        } else if (isConjunct && inConjunction) {
            // Continuing a conjunction period
            currentEvent.endJd = currentJd;
            if (maxDist < currentEvent.minDist) {
                currentEvent.minDist = maxDist;
                currentEvent.minDistJd = currentJd;
            }
        } else if (!isConjunct && inConjunction) {
            // Ended a conjunction period
            results.push(currentEvent);
            inConjunction = false;
            currentEvent = null;
        }

        currentJd += baseStepJulian;
    }

    if (inConjunction) {
        results.push(currentEvent);
    }

    // Refine Exact Peaks to be more precise (step 1 hour around the minDistJd)
    const refinedResults = results.map(ev => {
        let bestJd = ev.minDistJd;
        let bestDist = ev.minDist;
        
        // Scan +/- 2 times the base step at 1 hour intervals
        const fineStep = 1/24; // 1 hour
        const scanStart = ev.minDistJd - (baseStepJulian * 2);
        const scanEnd = ev.minDistJd + (baseStepJulian * 2);
        
        for (let j = scanStart; j <= scanEnd; j += fineStep) {
            const positions = planets.map(p => calculatePosition(swe, j, p.se_id));
            const d = getMaxDistance(positions);
            if (d < bestDist) {
                bestDist = d;
                bestJd = j;
            }
        }
        
        // Convert Jd back to Date
        const exactDateObj = getJSDateFromJd(swe, bestJd);
        
        return {
            exactDate: exactDateObj,
            minDist: bestDist
        };
    });

    return refinedResults;
}

function getJSDateFromJd(swe, jd) {
    // revjul returns {year, month, day, hour}
    // hour is decimal UTC hour
    const dateData = swe.revjul(jd, 1); // 1 = SE_GREG_CAL
    
    let hr = Math.floor(dateData.hour);
    let rem = (dateData.hour - hr) * 60;
    let min = Math.floor(rem);
    let sec = Math.floor((rem - min) * 60);
    
    return new Date(Date.UTC(dateData.year, dateData.month - 1, dateData.day, hr, min, sec));
}

function renderResults(results, planets) {
    if (results.length === 0) {
        resultsContent.innerHTML = '<p class="placeholder-text">No conjunctions found in this time range with the given orb.</p>';
        return;
    }

    const planetNames = planets.map(p => p.symbol + ' ' + p.name).join(' + ');

    resultsContent.innerHTML = '';
    
    // Sort by date just in case
    results.sort((a,b) => a.exactDate - b.exactDate);

    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'result-card';
        
        const dateStr = res.exactDate.toLocaleString(undefined, { 
            weekday: 'short', year: 'numeric', month: 'short', 
            day: 'numeric', hour: '2-digit', minute:'2-digit'
        });
        
        div.innerHTML = `
            <div class="result-date">${dateStr}</div>
            <div class="result-details">
                <span>Closest Approach</span>
            </div>
            <div class="result-orb">Max spread: ${res.minDist.toFixed(3)}°</div>
        `;
        resultsContent.appendChild(div);
    });
}

// Init when DOM loaded
document.addEventListener('DOMContentLoaded', initUI);
