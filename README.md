# 🪐 Planetary Aspect Finder

A **pure frontend web app** for finding planetary conjunctions and oppositions using high-precision Swiss Ephemeris calculations with the **Lahiri Ayanamsa** (Vedic/Indian sidereal system).

🔗 **Live Demo**: [astro.gptindia.pro](https://astro.gptindia.pro/)


---

## ✨ Features

- **Conjunction Finder** — Find dates when 2 or more planets come within a configurable angular tolerance (orb) of each other
- **Opposition Finder** — Find dates when one group of planets conjuncts while opposing another group
- **9 Vedic Planets** — Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu (True Node), Ketu (Descending Node)
- **Lahiri Ayanamsa** — Sidereal calculations using the standard Indian ayanamsa
- **Precise Peak Detection** — Refines results to the nearest hour for the exact moment of closest aspect
- **Planet Positions** — Optionally display ecliptic longitudes of aspected or all planets at each event
- **Wikipedia Historical Events** — Optionally fetch historical events from Wikipedia for ±5 days around each result date
- **CSV Export** — Download all results as a CSV file
- **Shareable Links** — Copy a URL that encodes your full configuration for easy sharing
- **Persistent Config** — Settings are automatically saved to localStorage
- **No Backend Required** — Runs entirely in the browser; no server, no API keys

---

## 🖥️ How to Use

### 1. Set the Date Range
Choose a **Start Date** and **End Date** to search within.

### 2. Set Angular Deviation Tolerance (Orb)
The orb is the maximum angular separation (in degrees) allowed between planets for an aspect to be counted.

- In **Conjunction Only** mode: one orb applies to all selected planets
- In **Conjunction & Opposition** mode: separate orbs for Group A spread, Group B spread, and the opposition deviation

### 3. Choose Search Mode
| Mode | Description |
|------|-------------|
| **Conjunction Only** | Finds dates when all selected planets are within the orb of each other |
| **Conjunction & Opposition** | Finds dates when Group A planets conjunct each other AND oppose Group B planets |

### 4. Select Planets
- **Conjunction Only**: Select at least 2 planets from the list
- **Conjunction & Opposition**: Select at least 1 planet in Group A and 1 in Group B

### 5. Advanced Options
Expand the **Advanced** section to enable:
- **Show Aspected Planets Position** — Display ecliptic longitudes of the selected planets at each event
- **Show All Planets Position** — Display ecliptic longitudes of all 9 planets at each event
- **Fetch Wikipedia Historical Events** — Fetch historical events from Wikipedia for ±5 days around each result date (requires internet)

### 6. Find Aspects
Click **Find Aspects**. Results appear on the right panel, sorted chronologically.

### 7. Export & Share
- **📥 Download CSV** — Export all results with dates, orb values, and planet longitudes
- **🔗 Copy link to this configuration** — Copy a shareable URL with your current settings pre-filled

---

## 🔭 Technical Details

| Detail | Value |
|--------|-------|
| **Ephemeris** | Swiss Ephemeris (via WebAssembly) |
| **Ayanamsa** | Lahiri (SE_SIDM_LAHIRI) |
| **Coordinate system** | Sidereal ecliptic longitude |
| **Step size** | 1 day (3 hours when Moon is selected) |
| **Peak refinement** | ±2 steps scanned at 1-hour intervals |
| **Stack** | Vanilla HTML, CSS, JavaScript (ES modules) |
| **Dependencies** | `swisseph-wasm` (bundled locally) |

### Planets & Swiss Ephemeris IDs

| Planet | Symbol | SE ID |
|--------|--------|-------|
| Sun | ☀️ | 0 |
| Moon | 🌙 | 1 |
| Mercury | ☿️ | 2 |
| Venus | ♀️ | 3 |
| Mars | ♂️ | 4 |
| Jupiter | ♃ | 5 |
| Saturn | ♄ | 6 |
| Rahu (True Node) | ☊ | 11 |
| Ketu (Desc. Node) | ☋ | Rahu + 180° |

---

## 🚀 Self-Hosting / Local Development

No build step required. Just serve the files with any static file server.

### Using VS Code
Install the **Live Server** extension and click "Go Live".

> **Note**: The app uses ES modules and WebAssembly, so it must be served over HTTP/HTTPS — opening `index.html` directly as a `file://` URL will not work.

---

## 📁 Project Structure

```
aspects/
├── index.html          # Main HTML page
├── style.css           # Styles (dark cosmic theme, glassmorphism)
├── app.js              # Application logic (aspect calculation, UI, Wikipedia fetch)
├── favicon.png         # Site favicon
├── meta-image.png      # Open Graph / social preview image
└── swisseph-wasm/      # Swiss Ephemeris WebAssembly library (bundled)
    ├── src/
    │   └── swisseph.js # JS wrapper for the WASM module
    └── wasm/
        ├── swisseph.js
        └── swisseph.wasm
```

---

## ⚖️ License

This project uses the **Swiss Ephemeris** via the [`swisseph-wasm`](https://github.com/prolaxu/swisseph-wasm) library, which is licensed under **GPL-3.0**.

- **Open source / non-commercial use**: Free under GPL-3.0
- **Commercial use**: Requires a commercial license from [Astrodienst AG](https://www.astro.com/swisseph/)

---

## 📬 Contact

For software work or Astrology consultation:

- 📧 Email: [hi@gptindia.pro](mailto:hi@gptindia.pro)
- 💬 WhatsApp: [+91 94885 70091](https://wa.me/919488570091)
