import SwissEph from './swisseph-wasm/src/swisseph.js';

// DOM Elements
const searchModeSelect = document.getElementById('searchMode');
const groupAContainer = document.getElementById('groupAContainer');
const groupBContainer = document.getElementById('groupBContainer');
const groupALabel = document.getElementById('groupALabel');
const planetsGridA = document.getElementById('planetsGridA');
const planetsGridB = document.getElementById('planetsGridB');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const orbInput = document.getElementById('orb');
const findBtn = document.getElementById('findBtn');
const downloadCSVBtn = document.getElementById('downloadCSVBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const copyLinkMsg = document.getElementById('copyLinkMsg');
const resultsContent = document.getElementById('resultsContent');
const statusMessage = document.getElementById('statusMessage');
const resultsStatusMessage = document.getElementById('resultsStatusMessage');
const showAspectedPlanetPositionsCheckbox = document.getElementById('showAspectedPlanetPositions');
const showAllPlanetsPositionCheckbox = document.getElementById('showAllPlanetsPosition');
const fetchWikiEventsCheckbox = document.getElementById('fetchWikiEvents');

let currentResults = [];
let currentSearchMode = '';

// Planet definitions based on request and SwissEph constants
const S_PLANETS = [
    { id: 'sun', symbol: '☀️', name: 'Sun', se_id: 0 },
    { id: 'moon', symbol: '🌙', name: 'Moon', se_id: 1 },
    { id: 'mars', symbol: '♂️', name: 'Mars', se_id: 4 },
    { id: 'mercury', symbol: '☿️', name: 'Mercury', se_id: 2 },
    { id: 'jupiter', symbol: '♃', name: 'Jupiter', se_id: 5 },
    { id: 'venus', symbol: '♀️', name: 'Venus', se_id: 3 },
    { id: 'saturn', symbol: '♄', name: 'Saturn', se_id: 6 },
    { id: 'rahu', symbol: '☊', name: 'Rahu (True Node)', se_id: 11 },
    { id: 'ketu', symbol: '☋', name: 'Ketu (Desc Node)', se_id: 'KETU' }
];

// Initialize UI
function initUI() {
    // Set default dates
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    startDateInput.value = today.toISOString().split('T')[0];
    endDateInput.value = nextYear.toISOString().split('T')[0];

    // Generate checkboxes for Group A
    S_PLANETS.forEach(planet => {
        planetsGridA.appendChild(createCheckboxLabel(planet, 'A'));
    });

    // Generate checkboxes for Group B
    S_PLANETS.forEach(planet => {
        planetsGridB.appendChild(createCheckboxLabel(planet, 'B'));
    });

    searchModeSelect.addEventListener('change', handleModeChange);
    searchModeSelect.addEventListener('change', saveToLocalStorage);
    findBtn.addEventListener('click', handleFindEvents);
    downloadCSVBtn.addEventListener('click', handleDownloadCSV);
    copyLinkBtn.addEventListener('click', handleCopyLink);

    startDateInput.addEventListener('input', saveToLocalStorage);
    endDateInput.addEventListener('input', saveToLocalStorage);
    orbInput.addEventListener('input', saveToLocalStorage);

    // Save when planet checkboxes change (delegated on grids)
    planetsGridA.addEventListener('change', saveToLocalStorage);
    planetsGridB.addEventListener('change', saveToLocalStorage);
    showAspectedPlanetPositionsCheckbox.addEventListener('change', saveToLocalStorage);
    showAllPlanetsPositionCheckbox.addEventListener('change', saveToLocalStorage);

    loadFromLocalStorage();
    loadFromURLParams();
}

function createCheckboxLabel(planet, groupPrefix) {
    const label = document.createElement('label');
    label.className = 'planet-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = planet.id;
    checkbox.dataset.seId = planet.se_id;
    checkbox.dataset.name = planet.name;
    checkbox.dataset.symbol = planet.symbol;
    checkbox.dataset.group = groupPrefix;

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${planet.symbol} ${planet.name}`));
    return label;
}

function handleModeChange() {
    const orbLabel = document.querySelector('label[for="orb"]');
    if (searchModeSelect.value === 'conjunct') {
        groupBContainer.classList.add('hidden');
        groupALabel.textContent = 'Select Planets (Min 2)';
        orbLabel.textContent = 'Orb (Tolerance in Degrees)';
    } else {
        groupBContainer.classList.remove('hidden');
        groupALabel.textContent = 'Group A (Conjunct)';
        orbLabel.textContent = 'Orb (Max spread for Groups A, B, and Opposition)';
    }
}

function showStatus(msg, isError = false) {
    statusMessage.textContent = msg;
    statusMessage.className = `status-msg ${isError ? 'error' : ''}`;
    resultsStatusMessage.textContent = msg;
    resultsStatusMessage.className = `status-msg ${isError ? 'error' : ''}`;
}

function hideStatus() {
    statusMessage.className = 'status-msg hidden';
    resultsStatusMessage.className = 'status-msg hidden';
}

function getSelectedPlanets(groupPrefix) {
    const checkboxes = document.querySelectorAll(`input[data-group="${groupPrefix}"]:checked`);
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
    if (positions.length <= 1) return 0;
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

// Find max deviation from exact opposition (180deg) between two groups
function getMaxOppositionDeviation(positionsA, positionsB) {
    let maxDeviation = 0;
    for (let a of positionsA) {
        for (let b of positionsB) {
            const dist = getAngularDistance(a, b);
            const deviation = Math.abs(dist - 180);
            if (deviation > maxDeviation) maxDeviation = deviation;
        }
    }
    return maxDeviation;
}

async function handleFindEvents() {
    const isOpposedMode = searchModeSelect.value === 'opposed';
    const groupA = getSelectedPlanets('A');
    const groupB = isOpposedMode ? getSelectedPlanets('B') : [];

    if (isOpposedMode) {
        if (groupA.length < 1 || groupB.length < 1) {
            showStatus('Please select at least 1 planet in each group.', true);
            return;
        }
    } else {
        if (groupA.length < 2) {
            showStatus('Please select at least 2 planets.', true);
            return;
        }
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
    currentResults = [];

    let swe = null;
    try {
        swe = new SwissEph();
        await swe.initSwissEph();

        // Use Lahiri Ayanamsa for Indian Astrology (Sidereal)
        swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);

        showStatus('Calculating events... (This may take a moment)');

        // Yield to let UI update
        await new Promise(r => setTimeout(r, 50));

        currentResults = findAstrologicalEvents(swe, start, end, groupA, groupB, orb, isOpposedMode);
        currentSearchMode = searchModeSelect.value;

        renderResults(currentResults, groupA, groupB, isOpposedMode);
        hideStatus();

        if (fetchWikiEventsCheckbox.checked) {
            appendWikiEventsToResults(currentResults);
        }
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

function findAstrologicalEvents(swe, start, end, groupA, groupB, orb, isOpposedMode) {
    const results = [];

    // Check if Moon is included to adjust step size (Moon moves ~13 deg/day)
    const hasMoon = groupA.some(p => p.se_id === 1) || groupB.some(p => p.se_id === 1);

    // Base step in days: 1 day if no moon, 0.125 days (3 hours) if Moon is present
    const baseStepJulian = hasMoon ? 0.125 : 1.0;

    const startJd = swe.julday(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), 12.0);
    const endJd = swe.julday(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), 12.0);

    let inEvent = false;
    let currentEvent = null;

    let currentJd = startJd;

    while (currentJd <= endJd) {
        const positionsA = groupA.map(p => calculatePosition(swe, currentJd, p.se_id));
        const maxDistA = getMaxDistance(positionsA);

        let isValid = false;
        let eventError = 0; // The single metric we try to minimize
        let maxDistB = 0;
        let maxOppDev = 0;

        if (!isOpposedMode) {
            isValid = maxDistA <= orb;
            eventError = maxDistA;
        } else {
            const positionsB = groupB.map(p => calculatePosition(swe, currentJd, p.se_id));
            maxDistB = getMaxDistance(positionsB);
            maxOppDev = getMaxOppositionDeviation(positionsA, positionsB);

            isValid = (maxDistA <= orb) && (maxDistB <= orb) && (maxOppDev <= orb);
            eventError = Math.max(maxDistA, maxDistB, maxOppDev); // error metric is the largest deviation among the constraints
        }

        if (isValid && !inEvent) {
            // Started an event period
            inEvent = true;
            currentEvent = {
                startJd: currentJd,
                minDistJd: currentJd,
                minError: eventError,
                maxDistA: maxDistA,
                maxDistB: maxDistB,
                maxOppDev: maxOppDev,
                endJd: currentJd
            };
        } else if (isValid && inEvent) {
            // Continuing an event period
            currentEvent.endJd = currentJd;
            if (eventError < currentEvent.minError) {
                currentEvent.minError = eventError;
                currentEvent.minDistJd = currentJd;
                currentEvent.maxDistA = maxDistA;
                currentEvent.maxDistB = maxDistB;
                currentEvent.maxOppDev = maxOppDev;
            }
        } else if (!isValid && inEvent) {
            // Ended an event period
            results.push(currentEvent);
            inEvent = false;
            currentEvent = null;
        }

        currentJd += baseStepJulian;
    }

    if (inEvent) {
        results.push(currentEvent);
    }

    // Refine Exact Peaks to be more precise (step 1 hour around the minDistJd)
    const refinedResults = results.map(ev => {
        let bestJd = ev.minDistJd;
        let bestError = ev.minError;
        let bestA = ev.maxDistA;
        let bestB = ev.maxDistB;
        let bestOpp = ev.maxOppDev;

        // Scan +/- 2 times the base step at 1 hour intervals
        const fineStep = 1 / 24; // 1 hour
        const scanStart = ev.minDistJd - (baseStepJulian * 2);
        const scanEnd = ev.minDistJd + (baseStepJulian * 2);

        for (let j = scanStart; j <= scanEnd; j += fineStep) {
            const posA = groupA.map(p => calculatePosition(swe, j, p.se_id));
            const dA = getMaxDistance(posA);

            let eError = dA;
            let dB = 0;
            let dOpp = 0;

            if (isOpposedMode) {
                const posB = groupB.map(p => calculatePosition(swe, j, p.se_id));
                dB = getMaxDistance(posB);
                dOpp = getMaxOppositionDeviation(posA, posB);
                eError = Math.max(dA, dB, dOpp);
            }

            if (eError < bestError) {
                bestError = eError;
                bestJd = j;
                bestA = dA;
                bestB = dB;
                bestOpp = dOpp;
            }
        }

        // Capture planet positions at the exact peak JD
        const planetPositionsA = groupA.map(p => ({
            name: p.name,
            symbol: p.symbol,
            longitude: calculatePosition(swe, bestJd, p.se_id)
        }));
        const planetPositionsB = groupB.map(p => ({
            name: p.name,
            symbol: p.symbol,
            longitude: calculatePosition(swe, bestJd, p.se_id)
        }));

        // Capture all planets positions at the exact peak JD
        const allPlanetPositions = S_PLANETS.map(p => ({
            name: p.name,
            symbol: p.symbol,
            longitude: calculatePosition(swe, bestJd, p.se_id)
        }));

        return {
            exactDate: getJSDateFromJd(swe, bestJd),
            maxDistA: bestA,
            maxDistB: bestB,
            maxOppDev: bestOpp,
            minError: bestError,
            planetPositionsA,
            planetPositionsB,
            allPlanetPositions
        };
    });

    return refinedResults;
}

function getJSDateFromJd(swe, jd) {
    const dateData = swe.revjul(jd, 1);
    let hr = Math.floor(dateData.hour);
    let rem = (dateData.hour - hr) * 60;
    let min = Math.floor(rem);
    let sec = Math.floor((rem - min) * 60);
    return new Date(Date.UTC(dateData.year, dateData.month - 1, dateData.day, hr, min, sec));
}

function renderResults(results, groupA, groupB, isOpposedMode) {
    if (results.length === 0) {
        resultsContent.innerHTML = '<p class="placeholder-text">No events found in this time range with the given orb.</p>';
        downloadCSVBtn.classList.add('hidden');
        return;
    }

    resultsContent.innerHTML = '';
    downloadCSVBtn.classList.remove('hidden');
    results.sort((a, b) => a.exactDate - b.exactDate);

    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'result-card';

        const dateStr = res.exactDate.toLocaleString(undefined, {
            weekday: 'short', year: 'numeric', month: 'short',
            day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let detailsHtml = '';
        if (!isOpposedMode) {
            detailsHtml = `
                <div class="result-orb">Max spread: ${res.maxDistA.toFixed(3)}°</div>
            `;
        } else {
            detailsHtml = `
                <div class="result-details" style="display:block;">
                    <span style="display:block; margin-bottom: 4px;"><strong>Group A Spread:</strong> ${res.maxDistA.toFixed(3)}°</span>
                    <span style="display:block; margin-bottom: 4px;"><strong>Group B Spread:</strong> ${res.maxDistB.toFixed(3)}°</span>
                    <span style="display:block; margin-bottom: 4px;"><strong>Opposition Deviation:</strong> ${res.maxOppDev.toFixed(3)}° off 180°</span>
                </div>
            `;
        }

        let planetPositionsHtml = '';
        if (showAspectedPlanetPositionsCheckbox.checked) {
            const aspectedPositions = [...res.planetPositionsA, ...res.planetPositionsB];
            if (aspectedPositions.length > 0) {
                const rows = aspectedPositions.map(p =>
                    `<span class="planet-pos-item">${p.symbol} ${p.name}: <strong>${p.longitude.toFixed(3)}°</strong></span>`
                ).join('');
                planetPositionsHtml += `<div class="planet-positions">${rows}</div>`;
            }
        }
        if (showAllPlanetsPositionCheckbox.checked && res.allPlanetPositions) {
            const rows = res.allPlanetPositions.map(p =>
                `<span class="planet-pos-item">${p.symbol} ${p.name}: <strong>${p.longitude.toFixed(3)}°</strong></span>`
            ).join('');
            planetPositionsHtml += `<div class="planet-positions">${rows}</div>`;
        }

        div.innerHTML = `
            <div class="result-date">${dateStr}</div>
            ${detailsHtml}
            ${planetPositionsHtml}
        `;
        resultsContent.appendChild(div);
    });
}

function handleDownloadCSV() {
    if (!currentResults || currentResults.length === 0) return;

    const isOpposed = currentSearchMode === 'opposed';
    const includeAllPlanets = showAllPlanetsPositionCheckbox.checked;
    const headers = ['Date', 'Mode'];

    if (isOpposed) {
        headers.push('Group A Spread', 'Group B Spread', 'Opposition Deviation');
    } else {
        headers.push('Max Spread');
    }

    // Add headers for aspected planets
    const firstResult = currentResults[0];
    const aspectedPlanets = [...firstResult.planetPositionsA, ...firstResult.planetPositionsB];
    aspectedPlanets.forEach(p => headers.push(`${p.name} Longitude`));

    // Add headers for all planets if checkbox is checked
    if (includeAllPlanets && firstResult.allPlanetPositions) {
        firstResult.allPlanetPositions.forEach(p => headers.push(`All: ${p.name} Longitude`));
    }

    const csvRows = [headers.join(',')];

    currentResults.forEach(res => {
        const row = [];
        row.push(`"${res.exactDate.toISOString()}"`);
        row.push(`"${currentSearchMode}"`);

        if (isOpposed) {
            row.push(res.maxDistA.toFixed(4));
            row.push(res.maxDistB.toFixed(4));
            row.push(res.maxOppDev.toFixed(4));
        } else {
            row.push(res.maxDistA.toFixed(4));
        }

        const planetPositions = [...res.planetPositionsA, ...res.planetPositionsB];
        planetPositions.forEach(p => row.push(p.longitude.toFixed(4)));

        if (includeAllPlanets && res.allPlanetPositions) {
            res.allPlanetPositions.forEach(p => row.push(p.longitude.toFixed(4)));
        }

        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `astrology_events_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function buildConfigURL() {
    const params = new URLSearchParams();
    params.set('startDate', startDateInput.value);
    params.set('endDate', endDateInput.value);
    params.set('orb', orbInput.value);
    params.set('searchMode', searchModeSelect.value);

    const planetsA = Array.from(document.querySelectorAll('input[data-group="A"]:checked')).map(cb => cb.value);
    if (planetsA.length > 0) params.set('planetsA', planetsA.join(','));

    const planetsB = Array.from(document.querySelectorAll('input[data-group="B"]:checked')).map(cb => cb.value);
    if (planetsB.length > 0) params.set('planetsB', planetsB.join(','));

    if (showAspectedPlanetPositionsCheckbox.checked) params.set('showAspectedPlanetPositions', '1');
    if (showAllPlanetsPositionCheckbox.checked) params.set('showAllPlanetsPosition', '1');

    const url = new URL(window.location.href);
    url.search = params.toString();
    return url.toString();
}

let copyLinkTimeout = null;

function handleCopyLink() {
    const url = buildConfigURL();
    navigator.clipboard.writeText(url).then(() => {
        copyLinkMsg.classList.remove('hidden');
        if (copyLinkTimeout) clearTimeout(copyLinkTimeout);
        copyLinkTimeout = setTimeout(() => {
            copyLinkMsg.classList.add('hidden');
        }, 2000);
    }).catch(() => {
        // Fallback for browsers without clipboard API
        prompt('Copy this link:', url);
    });
}

const LS_KEY = 'aspects_config';

function saveToLocalStorage() {
    const planetsA = Array.from(document.querySelectorAll('input[data-group="A"]:checked')).map(cb => cb.value);
    const planetsB = Array.from(document.querySelectorAll('input[data-group="B"]:checked')).map(cb => cb.value);
    const config = {
        startDate: startDateInput.value,
        endDate: endDateInput.value,
        orb: orbInput.value,
        searchMode: searchModeSelect.value,
        planetsA,
        planetsB,
        showAspectedPlanetPositions: showAspectedPlanetPositionsCheckbox.checked,
        showAllPlanetsPosition: showAllPlanetsPositionCheckbox.checked,
        fetchWikiEvents: fetchWikiEventsCheckbox.checked
    };
    localStorage.setItem(LS_KEY, JSON.stringify(config));
}

function loadFromLocalStorage() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
        const config = JSON.parse(raw);
        if (config.startDate) startDateInput.value = config.startDate;
        if (config.endDate) endDateInput.value = config.endDate;
        if (config.orb !== undefined) orbInput.value = config.orb;
        if (config.searchMode && ['conjunct', 'opposed'].includes(config.searchMode)) {
            searchModeSelect.value = config.searchMode;
            handleModeChange();
        }
        if (Array.isArray(config.planetsA)) {
            document.querySelectorAll('input[data-group="A"]').forEach(cb => {
                cb.checked = config.planetsA.includes(cb.value);
            });
        }
        if (Array.isArray(config.planetsB)) {
            document.querySelectorAll('input[data-group="B"]').forEach(cb => {
                cb.checked = config.planetsB.includes(cb.value);
            });
        }
        if (config.showAspectedPlanetPositions !== undefined) {
            showAspectedPlanetPositionsCheckbox.checked = config.showAspectedPlanetPositions;
        }
        if (config.showAllPlanetsPosition !== undefined) {
            showAllPlanetsPositionCheckbox.checked = config.showAllPlanetsPosition;
        }
        if (config.fetchWikiEvents !== undefined) {
            fetchWikiEventsCheckbox.checked = config.fetchWikiEvents;
        }
    } catch (e) {
        // Ignore corrupt data
    }
}

function loadFromURLParams() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('startDate')) {
        startDateInput.value = params.get('startDate');
    }
    if (params.has('endDate')) {
        endDateInput.value = params.get('endDate');
    }
    if (params.has('orb')) {
        orbInput.value = params.get('orb');
    }
    if (params.has('searchMode')) {
        const mode = params.get('searchMode');
        if (['conjunct', 'opposed'].includes(mode)) {
            searchModeSelect.value = mode;
            handleModeChange();
        }
    }
    if (params.has('planetsA')) {
        const ids = params.get('planetsA').split(',').map(s => s.trim());
        document.querySelectorAll('input[data-group="A"]').forEach(cb => {
            cb.checked = ids.includes(cb.value);
        });
    }
    if (params.has('planetsB')) {
        const ids = params.get('planetsB').split(',').map(s => s.trim());
        document.querySelectorAll('input[data-group="B"]').forEach(cb => {
            cb.checked = ids.includes(cb.value);
        });
    }
    if (params.has('showAspectedPlanetPositions')) {
        showAspectedPlanetPositionsCheckbox.checked = params.get('showAspectedPlanetPositions') === '1';
    }
    if (params.has('showAllPlanetsPosition')) {
        showAllPlanetsPositionCheckbox.checked = params.get('showAllPlanetsPosition') === '1';
    }
    if (params.has('fetchWikiEvents')) {
        fetchWikiEventsCheckbox.checked = params.get('fetchWikiEvents') === '1';
    }
}

// ─── Wikipedia Historical Events ────────────────────────────────────────────

const MONTH_NAMES_WIKI = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Cache wikitext per year to avoid redundant HTTP requests
const wikitextCache = {};

/**
 * Fetches the raw wikitext for a given year's Wikipedia page via the public API.
 */
async function fetchWikitext(year) {
    if (wikitextCache[year]) return wikitextCache[year];
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${year}&prop=wikitext&format=json&origin=*`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'AspectsApp/1.0 (planetary conjunction finder)'
        }
    });
    if (!response.ok) throw new Error(`Wikipedia API HTTP error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`Wikipedia API error: ${data.error.info}`);
    const wikitext = data.parse.wikitext['*'];
    wikitextCache[year] = wikitext;
    return wikitext;
}

/**
 * Strips wiki markup from a string, returning plain text.
 */
function stripWikiMarkup(text) {
    text = text.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1');
    text = text.replace(/\{\{[^}]*\}\}/g, '');
    text = text.replace(/'{2,3}/g, '');
    text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
    text = text.replace(/<ref[^>]*\/>/gi, '');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

/**
 * Parses events for a specific date from the wikitext.
 */
function parseEventsForDate(wikitext, month, day) {
    const monthName = MONTH_NAMES_WIKI[month - 1];

    const eventsSectionMatch = wikitext.match(/==\s*Events\s*==([\s\S]*?)(?=\n==\s*[^=])/);
    if (!eventsSectionMatch) return [];
    const eventsSection = eventsSectionMatch[1];

    const monthPattern = new RegExp(
        `===\\s*${monthName}[^=]*===([\\s\\S]*?)(?====|$)`
    );
    const monthMatch = eventsSection.match(monthPattern);
    if (!monthMatch) return [];
    const monthSection = monthMatch[1];

    const events = [];
    const lines = monthSection.split('\n');
    let inTargetDate = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const dateLineMatch = line.match(/^\*\s*(?:\[\[)?(\w+ \d+)(?:\]\])?/);
        if (dateLineMatch) {
            const dateStr = dateLineMatch[1];
            const [mName, dStr] = dateStr.split(' ');
            const lineMonth = MONTH_NAMES_WIKI.indexOf(mName) + 1;
            const lineDay = parseInt(dStr, 10);

            if (lineMonth === month && lineDay === day) {
                inTargetDate = true;
                const afterDate = line.replace(/^\*\s*(?:\[\[)?(\w+ \d+)(?:\]\])?/, '').trim();
                if (afterDate) {
                    const eventText = afterDate.replace(/^[–\-]\s*/, '').trim();
                    if (eventText) events.push(stripWikiMarkup(eventText));
                }
            } else {
                if (inTargetDate) break;
                inTargetDate = false;
            }
        } else if (inTargetDate) {
            if (line.startsWith('**')) {
                const subEvent = line.replace(/^\*+\s*/, '').trim();
                if (subEvent) events.push(stripWikiMarkup(subEvent));
            } else if (line.startsWith('*')) {
                break;
            }
        }
    }

    return events;
}

/**
 * After rendering results, fetch Wikipedia events for each result date
 * and append them as bullet lists to each result card.
 */
async function appendWikiEventsToResults(results) {
    const cards = resultsContent.querySelectorAll('.result-card');
    if (cards.length === 0) return;

    for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const card = cards[i];
        if (!card) continue;

        const date = res.exactDate;
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();

        // Add a loading placeholder
        const wikiSection = document.createElement('div');
        wikiSection.className = 'wiki-events';
        wikiSection.innerHTML = `<div class="wiki-events-loading">📰 Loading Wikipedia events for ${MONTH_NAMES_WIKI[month - 1]} ${day}…</div>`;
        card.appendChild(wikiSection);

        try {
            const wikitext = await fetchWikitext(year);
            const events = parseEventsForDate(wikitext, month, day);

            if (events.length > 0) {
                const dateLabel = `${MONTH_NAMES_WIKI[month - 1]} ${day}, ${year}`;
                const listItems = events.map(e => `<li>${e}</li>`).join('');
                wikiSection.innerHTML = `
                    <div class="wiki-events-title">📰 Historical events on ${dateLabel}:</div>
                    <ul class="wiki-events-list">${listItems}</ul>
                `;
            } else {
                wikiSection.innerHTML = `<div class="wiki-events-empty">📰 No Wikipedia events found for ${MONTH_NAMES_WIKI[month - 1]} ${day}, ${year}.</div>`;
            }
        } catch (err) {
            wikiSection.innerHTML = `<div class="wiki-events-error">⚠️ Could not fetch Wikipedia events: ${err.message}</div>`;
        }
    }
}

// Init when DOM loaded
document.addEventListener('DOMContentLoaded', initUI);
