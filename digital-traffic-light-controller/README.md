# Digital Traffic Light Controller

**Academic Software Engineering Project**  
**Institution:** SRM Institute of Science and Technology, Tiruchirappalli – 621 105  
**Faculty:** Faculty of Engineering and Technology  

---

## Project Team / Student Details

| # | Student Name | Registration Number | Faculty & Institution |
| :---: | :--- | :---: | :--- |
| **1** | **Nirajan Yadav** | `RA2511013050040` | Faculty of Engineering and Technology, SRMIST |
| **2** | **Irfan Alam** | `RA2511013050046` | Faculty of Engineering and Technology, SRMIST |
| **3** | **Sudip Prakash Prasad Kurmi** | `RA2511013050052` | Faculty of Engineering and Technology, SRMIST |

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Traffic Control Working Principle (FSM)](#traffic-control-working-principle-fsm)
4. [Safety Interlock & Conflict Prevention](#safety-interlock--conflict-prevention)
5. [Technologies Used](#technologies-used)
6. [Folder Structure](#folder-structure)
7. [How to Run Locally](#how-to-run-locally)
8. [Vercel Deployment Guide](#vercel-deployment-guide)
9. [Academic Evaluation Notes](#academic-evaluation-notes)

---

## 1. Project Overview

The **Digital Traffic Light Controller** is a web-based simulation designed to demonstrate the working principle of an automated traffic signal system. It controls traffic flow at a four-way intersection by managing signal timing and switching between red, yellow and green lights. The project demonstrates basic traffic management logic through an interactive web interface.

Developed as an academic software engineering project for **SRM Institute of Science and Technology, Tiruchirappalli (Faculty of Engineering and Technology)**.

---

## 2. Key Features

- **Automated 6-Phase Signal Sequencing:** Deterministic Finite State Machine (FSM) governing North-South and East-West corridors.
- **Top-Down Intersection Simulation:** Fully responsive 4-way intersection complete with asphalt roadways, lane dividers, zebra crosswalks, stop lines, curbs, and realistic 3-lens signal housings.
- **Hardware-Grade Conflict Prevention:** Opposing green signals are strictly prevented by programmatic interlocks.
- **Mandatory Safety Clearance:** 1-second All-Red physical clearance interval buffers every directional change.
- **Manual Mode with Safe Clearance Transitions:** Allows operators to manually grant green signals. If the opposing flow is green, the system automatically cycles through a 3-second Yellow warning and 1-second All-Red before granting the requested green.
- **Dynamic Traffic Density Adaptation:**
  - **Low Density:** 10s Green
  - **Medium Density:** 15s Green (Standard)
  - **High Density:** 20s Green
  - *(Yellow remains fixed at 3s; All-Red clearance remains fixed at 1s).*
- **Deterministic Single-Interval Master Timer:** Clean interval architecture preventing duplicate clock ticks or drift upon repeated clicks of Start or Reset.
- **Live System Telemetry & Statistics:** Real-time metrics tracking completed cycles, signal change operations, operating mode, and traffic density.
- **Diagnostic Activity Log:** Real-time event terminal logging every phase change, transition, and interlock trigger with timestamps.
- **Top-Down Vehicle Flow Physics:** Visualized cars stop cleanly behind stop lines on Red/Yellow and accelerate across when Green is illuminated (can be toggled on/off).

---

## 3. Traffic Control Working Principle (FSM)

The controller operates as a deterministic 6-phase Finite State Machine:

| Phase | Active Arterial | North & South | East & West | Timing | Operational Purpose |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **Phase 1** | North-South | **GREEN** | **RED** | 10s / 15s / 20s | North-South vehicular flow right-of-way. |
| **Phase 2** | North-South | **YELLOW** | **RED** | 3s (Fixed) | Prepares North-South traffic to stop. |
| **Phase 3** | Intersection Clearance | **RED** | **RED** | 1s (Fixed) | All-Red clearance; flushes intersection. |
| **Phase 4** | East-West | **RED** | **GREEN** | 10s / 15s / 20s | East-West vehicular flow right-of-way. |
| **Phase 5** | East-West | **RED** | **YELLOW** | 3s (Fixed) | Prepares East-West traffic to stop. |
| **Phase 6** | Intersection Clearance | **RED** | **RED** | 1s (Fixed) | All-Red clearance before repeating cycle. |

Upon completion of Phase 6, the `Signal Cycle` counter increments by 1, and the cycle seamlessly loops back to Phase 1.

---

## 4. Safety Interlock & Conflict Prevention

Safety is paramount in traffic signal engineering. The application enforces two strict layers of safety:

1. **State Assertion Check:** The render function asserts that `(nsColor === 'green' || nsColor === 'yellow')` and `(ewColor === 'green' || ewColor === 'yellow')` can NEVER evaluate to `true` simultaneously. If an invalid state is ever detected, the system immediately forces an All-Red state and logs a safety event.
2. **Manual Mode Transition Guard:** When an operator commands an immediate directional switch (e.g., from North-South to East-West), the system refuses to snap directly from Green to Green. It locks manual inputs, enforces a 3-second Yellow on the current direction, follows with a 1-second All-Red clearance, and only then illuminates Green on the target corridor.

---

## 5. Technologies Used

- **HTML5:** Semantic architecture, accessible ARIA attributes, SVG iconography, viewport responsive meta tags.
- **CSS3:** Custom Properties (Variables), CSS Grid & Flexbox, clean styling adhering to government transportation software guidelines.
- **Vanilla JavaScript (ES6+):** Pure client-side logic, event listener decoupling, single controlled interval timer.
- **Zero External Dependencies:** No frameworks (React, Angular, Vue), no heavy libraries, no backend servers, and no npm build requirements. Fully runnable in any browser.

---

## 6. Folder Structure

```text
digital-traffic-light-controller/
│
├── index.html              # Main HTML5 application and layout
├── vercel.json             # Vercel static deployment configuration
├── css/
│   └── style.css           # Styling, color palette, grid layout & signal animations
├── js/
│   └── script.js           # Traffic controller FSM, safety interlocks & timer logic
├── assets/
│   └── icons/              # Clean vector SVG icons (traffic light, play, stop, reset, etc.)
│       ├── traffic-light.svg
│       ├── play.svg
│       ├── stop.svg
│       ├── reset.svg
│       ├── road.svg
│       ├── gear.svg
│       ├── clock.svg
│       └── chart.svg
└── README.md               # Project documentation and deployment guide
```

---

## 7. How to Run Locally

### Option 1: Direct Browser Launch (Simplest)
1. Download or clone this repository to your computer.
2. Double-click the `index.html` file (or right-click and choose **Open with Google Chrome / Microsoft Edge / Firefox**).
3. The application will load and start running immediately.

### Option 2: Using VS Code Live Server
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension if not already installed.
3. Right-click `index.html` in the file explorer and select **Open with Live Server**.
4. The site will open automatically at `http://127.0.0.1:5500`.

### Option 3: Using Python Built-in HTTP Server
If Python is installed on your system, open your terminal / PowerShell in the project directory and run:

```bash
# Python 3
python -m http.server 8000
```

Then open your browser and navigate to: `http://localhost:8000`.

---

## 8. Vercel Deployment Guide

Deploying this project to **Vercel** is straightforward since the application is built entirely with pure client-side web technologies and requires zero build tools.

### Step-by-Step Vercel Deployment:

1. **Push the project to a GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "feat: Digital Traffic Light Controller with college details"
   git branch -M main
   git remote add origin https://github.com/<your-username>/digital-traffic-light-controller.git
   git push -u origin main
   ```
2. **Log in to Vercel:**  
   Navigate to [vercel.com](https://vercel.com/) and sign in with your GitHub account.
3. **Select Add New Project:**  
   Click the **Add New...** dropdown on the Vercel dashboard and select **Project**.
4. **Import the GitHub repository:**  
   Locate your `digital-traffic-light-controller` repository from the list and click **Import**.
5. **Configure Project Settings:**
   - **Framework Preset:** Select **Other**.
   - **Root Directory:** Leave as `./` (project root).
   - **Build Command:** Leave empty.
   - **Output Directory:** Set to the project root (`.`) or leave blank.
6. **Deploy the project:**  
   Click the blue **Deploy** button.
7. **Test the generated Vercel URL:**  
   Within seconds, Vercel will complete deployment and generate a live URL (e.g., `https://digital-traffic-light-controller-xxxx.vercel.app`).
   Open the link to verify all features, responsiveness, and assets.

---

## 9. Academic Evaluation Notes

- **Collision Prevention Verification:** Try switching directions rapidly in Manual mode; observe that the system forces the active direction through Yellow (3s) and All-Red (1s) before allowing opposing movement.
- **Timer Stability:** Press the `Start` button repeatedly while the simulation is running; notice that the countdown ticker does not accelerate because duplicate intervals are strictly guarded.
- **Dynamic Density:** Change the traffic density dropdown between Low, Medium, and High while the simulation is active; observe that green phase durations adapt dynamically while yellow and all-red clearance intervals remain constant.
