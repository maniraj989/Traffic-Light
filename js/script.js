/**
 * ============================================================================
 * DIGITAL TRAFFIC LIGHT CONTROLLER
 * College Engineering Project - Web Simulation
 * 
 * Features:
 * - 6-Phase Finite State Machine (FSM)
 * - Automatic & Manual Operating Modes with Hardware-Grade Safety Interlocking
 * - Dynamic Traffic Density Adjustments (Low 10s, Medium 15s, High 20s)
 * - 1-Second Controlled Master Interval (Guaranteed No Duplicates)
 * - Conflict Prevention: Opposing greens are mathematically impossible
 * - Live System Telemetry, Countdown Timer & Diagnostic Activity Log
 * - Top-Down Vehicle Flow Physics with Signal Obeyance
 * ============================================================================
 */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 1. CONFIGURATION & STATE DEFINITION
   * -------------------------------------------------------------------------- */
  
  // Timing profiles per traffic density (in seconds)
  const DENSITY_TIMINGS = {
    low: { green: 10, yellow: 3, clearance: 1 },
    medium: { green: 15, yellow: 3, clearance: 1 },
    high: { green: 20, yellow: 3, clearance: 1 }
  };

  // 6-Phase FSM Sequence Definitions
  const PHASES = [
    {
      id: 1,
      name: 'North-South GREEN',
      activeDirection: 'North - South',
      signalColor: 'GREEN',
      nsColor: 'green',
      ewColor: 'red',
      getType: () => 'green',
      description: 'North & South flow active. East & West held at Red.'
    },
    {
      id: 2,
      name: 'North-South YELLOW',
      activeDirection: 'North - South',
      signalColor: 'YELLOW',
      nsColor: 'yellow',
      ewColor: 'red',
      getType: () => 'yellow',
      description: 'North & South caution. Preparing clearance.'
    },
    {
      id: 3,
      name: 'ALL RED Clearance',
      activeDirection: 'All Directions',
      signalColor: 'RED',
      nsColor: 'red',
      ewColor: 'red',
      getType: () => 'clearance',
      description: 'Safety clearance. Intersection must be physically vacated.'
    },
    {
      id: 4,
      name: 'East-West GREEN',
      activeDirection: 'East - West',
      signalColor: 'GREEN',
      nsColor: 'red',
      ewColor: 'green',
      getType: () => 'green',
      description: 'East & West flow active. North & South held at Red.'
    },
    {
      id: 5,
      name: 'East-West YELLOW',
      activeDirection: 'East - West',
      signalColor: 'YELLOW',
      nsColor: 'red',
      ewColor: 'yellow',
      getType: () => 'yellow',
      description: 'East & West caution. Preparing clearance.'
    },
    {
      id: 6,
      name: 'ALL RED Clearance',
      activeDirection: 'All Directions',
      signalColor: 'RED',
      nsColor: 'red',
      ewColor: 'red',
      getType: () => 'clearance',
      description: 'Safety clearance before initiating next cycle.'
    }
  ];

  // Core Simulation State
  const state = {
    isRunning: false,
    mode: 'auto',              // 'auto' | 'manual'
    density: 'medium',          // 'low' | 'medium' | 'high'
    phaseIndex: 0,             // 0 to 5 corresponds to PHASES 1 to 6
    timeRemaining: 15,         // Seconds left in active phase
    completedCycles: 0,
    totalSignalChanges: 0,
    simSpeed: 1,               // 1x, 2x, 5x
    
    // Manual Mode Transition State
    manualTargetDirection: null, // 'NS' | 'EW' | 'HOLD'
    isManualTransitioning: false,
    manualActiveDirection: 'NS', // Which direction has active green/yellow
    
    // System Status String
    status: 'READY'            // 'READY' | 'RUNNING' | 'STOPPED' | 'TRANSITIONING'
  };

  // Master Timer Reference
  let masterTimerId = null;

  /* --------------------------------------------------------------------------
   * 2. DOM ELEMENT REFERENCES
   * -------------------------------------------------------------------------- */
  const dom = {
    // Action Buttons
    btnStart: document.getElementById('btn-start'),
    btnStop: document.getElementById('btn-stop'),
    btnReset: document.getElementById('btn-reset'),
    
    // Mode Selectors
    radioModeAuto: document.getElementById('radio-mode-auto'),
    radioModeManual: document.getElementById('radio-mode-manual'),
    labelModeAuto: document.getElementById('label-mode-auto'),
    labelModeManual: document.getElementById('label-mode-manual'),
    
    // Traffic Density
    densitySelect: document.getElementById('density-select'),
    densityGreenBadge: document.getElementById('density-green-badge'),
    
    // Manual Controls
    manualControlsPanel: document.getElementById('manual-controls-panel'),
    btnManualNS: document.getElementById('btn-manual-ns'),
    btnManualEW: document.getElementById('btn-manual-ew'),
    btnManualHold: document.getElementById('btn-manual-hold'),
    manualInterlockStatus: document.getElementById('manual-interlock-status'),
    
    // Speed & Vehicle Toggles
    simSpeedSelect: document.getElementById('sim-speed-select'),
    toggleVehicles: document.getElementById('toggle-vehicles'),
    vehiclesLayer: document.getElementById('vehicles-layer'),
    
    // Header & Tags
    intersectionPhaseTag: document.getElementById('intersection-phase-tag'),
    controllerStateTag: document.getElementById('controller-state-tag'),
    
    // System Info Bar
    infoActiveDirection: document.getElementById('info-active-direction'),
    infoSignalBadge: document.getElementById('info-signal-badge'),
    infoTimer: document.getElementById('info-timer'),
    infoStatusText: document.getElementById('info-status-text'),
    infoStatusDot: document.getElementById('info-status-dot'),
    infoCycleCount: document.getElementById('info-cycle-count'),
    
    // Statistics Section
    statTotalCycles: document.getElementById('stat-total-cycles'),
    statTotalChanges: document.getElementById('stat-total-changes'),
    statCurrentMode: document.getElementById('stat-current-mode'),
    statCurrentDensity: document.getElementById('stat-current-density'),
    
    // Activity Log
    activityLogTerminal: document.getElementById('activity-log-terminal'),
    btnClearLog: document.getElementById('btn-clear-log'),
    
    // Signal Hardware Units
    signals: {
      north: document.getElementById('signal-north'),
      south: document.getElementById('signal-south'),
      east: document.getElementById('signal-east'),
      west: document.getElementById('signal-west')
    },
    
    // Nav Links for Smooth Scroll
    navLinks: document.querySelectorAll('.site-header .nav-link')
  };

  /* --------------------------------------------------------------------------
   * 3. TIMING & DURATION UTILITIES
   * -------------------------------------------------------------------------- */
  
  /**
   * Retrieves the duration for a specific phase based on current traffic density.
   */
  function getPhaseDuration(phaseIndex) {
    const phase = PHASES[phaseIndex];
    const timings = DENSITY_TIMINGS[state.density];
    const type = phase.getType();
    
    if (type === 'green') return timings.green;
    if (type === 'yellow') return timings.yellow;
    if (type === 'clearance') return timings.clearance;
    return 15;
  }

  /* --------------------------------------------------------------------------
   * 4. HARDWARE SIGNAL RENDERING & CONFLICT PREVENTION
   * -------------------------------------------------------------------------- */
  
  /**
   * Applies illuminated colors to physical signal heads.
   * Enforces strict assertion that opposing directions can NEVER be green simultaneously.
   */
  function applySignalStates(nsColor, ewColor) {
    // SAFETY ASSERTION:
    // Conflicting directions must never both exhibit Green or Yellow!
    if ((nsColor === 'green' || nsColor === 'yellow') && (ewColor === 'green' || ewColor === 'yellow')) {
      console.error('CRITICAL SAFETY INTERLOCK FAULT: Conflicting green/yellow signals detected! Forcing All-Red.');
      logEvent('SAFETY', 'CRITICAL INTERLOCK FAULT: Conflicting green detected! Forced All-Red clearance.', 'log-tag-safety');
      nsColor = 'red';
      ewColor = 'red';
    }

    // Update North and South heads
    updateSignalUnit(dom.signals.north, nsColor);
    updateSignalUnit(dom.signals.south, nsColor);

    // Update East and West heads
    updateSignalUnit(dom.signals.east, ewColor);
    updateSignalUnit(dom.signals.west, ewColor);
  }

  /**
   * Illuminates the appropriate lamp within a single signal unit.
   */
  function updateSignalUnit(unitElement, activeColor) {
    if (!unitElement) return;
    const lights = unitElement.querySelectorAll('.signal-light');
    lights.forEach(light => {
      const lightColor = light.getAttribute('data-light');
      if (lightColor === activeColor) {
        light.classList.add('active');
      } else {
        light.classList.remove('active');
      }
    });
  }

  /* --------------------------------------------------------------------------
   * 5. SYSTEM INFORMATION & UI UPDATING
   * -------------------------------------------------------------------------- */
  
  /**
   * Synchronizes all status badges, timers, cards, and labels.
   */
  function updateUI() {
    const currentPhase = PHASES[state.phaseIndex];

    // 1. Countdown Timer
    if (state.isRunning) {
      dom.infoTimer.textContent = `${state.timeRemaining}s`;
    } else {
      dom.infoTimer.textContent = state.status === 'STOPPED' ? '--' : `${state.timeRemaining}s`;
    }

    // 2. Active Direction & Phase Tag
    if (state.mode === 'auto') {
      dom.intersectionPhaseTag.textContent = `PHASE ${currentPhase.id} : ${currentPhase.name.toUpperCase()}`;
      dom.infoActiveDirection.textContent = currentPhase.activeDirection;
      
      // Signal Color Badge
      dom.infoSignalBadge.textContent = currentPhase.signalColor;
      dom.infoSignalBadge.className = `color-badge color-${currentPhase.signalColor.toLowerCase()}`;
    } else {
      // Manual Mode display
      if (state.isManualTransitioning) {
        dom.intersectionPhaseTag.textContent = `MANUAL : TRANSITIONING SAFELY`;
        dom.infoActiveDirection.textContent = 'Clearing Intersection...';
        dom.infoSignalBadge.textContent = 'CLEARANCE';
        dom.infoSignalBadge.className = 'color-badge color-yellow';
      } else if (state.manualActiveDirection === 'NS') {
        dom.intersectionPhaseTag.textContent = `MANUAL : NORTH-SOUTH ACTIVE`;
        dom.infoActiveDirection.textContent = 'North - South';
        dom.infoSignalBadge.textContent = 'GREEN';
        dom.infoSignalBadge.className = 'color-badge color-green';
      } else if (state.manualActiveDirection === 'EW') {
        dom.intersectionPhaseTag.textContent = `MANUAL : EAST-WEST ACTIVE`;
        dom.infoActiveDirection.textContent = 'East - West';
        dom.infoSignalBadge.textContent = 'GREEN';
        dom.infoSignalBadge.className = 'color-badge color-green';
      } else {
        dom.intersectionPhaseTag.textContent = `MANUAL : ALL RED HOLD`;
        dom.infoActiveDirection.textContent = 'All Directions';
        dom.infoSignalBadge.textContent = 'RED';
        dom.infoSignalBadge.className = 'color-badge color-red';
      }
    }

    // 3. System Status Display
    if (state.isRunning) {
      dom.infoStatusText.innerHTML = `<span class="status-indicator-dot running" id="info-status-dot"></span> Running...`;
      dom.controllerStateTag.textContent = 'OPERATIONAL';
    } else if (state.status === 'STOPPED') {
      dom.infoStatusText.innerHTML = `<span class="status-indicator-dot stopped" id="info-status-dot"></span> Stopped`;
      dom.controllerStateTag.textContent = 'STOPPED';
    } else {
      dom.infoStatusText.innerHTML = `<span class="status-indicator-dot" id="info-status-dot"></span> Ready`;
      dom.controllerStateTag.textContent = 'STANDBY';
    }

    // 4. Signal Cycles & Counters
    dom.infoCycleCount.textContent = state.completedCycles;
    dom.statTotalCycles.textContent = state.completedCycles;
    dom.statTotalChanges.textContent = state.totalSignalChanges;

    // 5. Mode & Density Metrics
    dom.statCurrentMode.textContent = state.mode === 'auto' ? 'Automatic' : 'Manual Override';
    const densityLabel = state.density.charAt(0).toUpperCase() + state.density.slice(1);
    const greenTime = DENSITY_TIMINGS[state.density].green;
    dom.statCurrentDensity.textContent = `${densityLabel} (${greenTime}s)`;
    dom.densityGreenBadge.textContent = `Green: ${greenTime}s`;

    // 6. Manual Buttons Active State
    if (state.mode === 'manual') {
      dom.btnManualNS.classList.toggle('active-manual', state.manualActiveDirection === 'NS' && !state.isManualTransitioning);
      dom.btnManualEW.classList.toggle('active-manual', state.manualActiveDirection === 'EW' && !state.isManualTransitioning);
    }
  }

  /* --------------------------------------------------------------------------
   * 6. MASTER TIMER & CLOCK MECHANISM
   * -------------------------------------------------------------------------- */
  
  /**
   * Starts the deterministic 1-second master clock interval.
   * Guaranteed to avoid duplicate timers.
   */
  function startClock() {
    stopClock(); // Ensure any existing interval is cleanly destroyed
    const intervalMs = Math.round(1000 / state.simSpeed);
    masterTimerId = setInterval(tick, intervalMs);
  }

  /**
   * Destroys the active master clock interval cleanly.
   */
  function stopClock() {
    if (masterTimerId !== null) {
      clearInterval(masterTimerId);
      masterTimerId = null;
    }
  }

  /**
   * Master clock tick executed every second.
   */
  function tick() {
    if (!state.isRunning) return;

    if (state.mode === 'auto') {
      handleAutoTick();
    } else {
      handleManualTick();
    }

    updateUI();
  }

  /* --------------------------------------------------------------------------
   * 7. AUTOMATIC FSM STATE MACHINE LOGIC
   * -------------------------------------------------------------------------- */
  
  /**
   * Executes one tick of the automated 6-phase FSM.
   */
  function handleAutoTick() {
    state.timeRemaining--;

    // Countdown reached zero: transition to next phase
    if (state.timeRemaining <= 0) {
      advanceAutoPhase();
    }
  }

  /**
   * Transitions to the subsequent phase in the FSM cycle.
   */
  function advanceAutoPhase() {
    // If we were at Phase 6 (index 5), complete the cycle
    if (state.phaseIndex === PHASES.length - 1) {
      state.completedCycles++;
      state.phaseIndex = 0; // Wrap back to Phase 1
      logEvent('CYCLE', `Completed full 6-phase cycle #${state.completedCycles}. Restarting Phase 1.`, 'log-tag-status');
    } else {
      state.phaseIndex++;
    }

    const nextPhase = PHASES[state.phaseIndex];
    state.timeRemaining = getPhaseDuration(state.phaseIndex);
    state.totalSignalChanges++;

    // Apply the physical light signals
    applySignalStates(nextPhase.nsColor, nextPhase.ewColor);

    // Diagnostic logging
    logEvent(`PHASE ${nextPhase.id}`, `${nextPhase.name} active (${state.timeRemaining}s) - ${nextPhase.description}`, 'log-tag-phase');
  }

  /* --------------------------------------------------------------------------
   * 8. MANUAL MODE & HARDWARE SAFETY INTERLOCK
   * -------------------------------------------------------------------------- */
  
  /**
   * Handles countdown and execution during manual transition periods.
   */
  function handleManualTick() {
    if (state.isManualTransitioning) {
      state.timeRemaining--;
      if (state.timeRemaining <= 0) {
        advanceManualTransitionStep();
      }
    }
  }

  /**
   * Requests a direction switch in Manual mode.
   * Enforces 3s Yellow and 1s All-Red clearances before granting green.
   */
  function requestManualDirection(target) {
    if (state.isManualTransitioning) {
      logEvent('MANUAL', 'Transition already in progress. Please wait for clearance.', 'log-tag-safety');
      return;
    }

    if (!state.isRunning) {
      // If controller was stopped, resume running in manual mode
      state.isRunning = true;
      startClock();
    }

    // Case 1: Target is already currently green
    if (state.manualActiveDirection === target) {
      logEvent('MANUAL', `Direction ${target} is already active green.`, 'log-tag-manual');
      return;
    }

    // Set transition target
    state.manualTargetDirection = target;
    state.isManualTransitioning = true;
    setManualButtonsDisabled(true);

    // Determine safe transition sequence
    if (state.manualActiveDirection === 'NS') {
      // NS is currently green -> switch NS to Yellow for 3s
      logEvent('MANUAL', 'Interlock: North-South transitioning to YELLOW (3s clearance warning).', 'log-tag-manual');
      applySignalStates('yellow', 'red');
      state.totalSignalChanges++;
      state.timeRemaining = 3;
      dom.manualInterlockStatus.textContent = '● Interlock: NS Yellow Caution (3s)...';
    } else if (state.manualActiveDirection === 'EW') {
      // EW is currently green -> switch EW to Yellow for 3s
      logEvent('MANUAL', 'Interlock: East-West transitioning to YELLOW (3s clearance warning).', 'log-tag-manual');
      applySignalStates('red', 'yellow');
      state.totalSignalChanges++;
      state.timeRemaining = 3;
      dom.manualInterlockStatus.textContent = '● Interlock: EW Yellow Caution (3s)...';
    } else {
      // Currently All-Red Hold -> enter 1s clearance buffer
      logEvent('MANUAL', 'Interlock: All-Red safety clearance buffer (1s).', 'log-tag-safety');
      applySignalStates('red', 'red');
      state.totalSignalChanges++;
      state.timeRemaining = 1;
      dom.manualInterlockStatus.textContent = '● Interlock: All-Red Clearance (1s)...';
    }

    updateUI();
  }

  /**
   * Advanced step-by-step transition for manual mode.
   */
  function advanceManualTransitionStep() {
    // Check if we just completed a yellow phase
    const isNorthSouthYellow = dom.signals.north.querySelector('.light-yellow.active') !== null;
    const isEastWestYellow = dom.signals.east.querySelector('.light-yellow.active') !== null;

    if (isNorthSouthYellow || isEastWestYellow) {
      // Step into mandatory 1-second ALL RED clearance
      logEvent('MANUAL', 'Interlock: Entering mandatory 1-second ALL RED clearance.', 'log-tag-safety');
      applySignalStates('red', 'red');
      state.totalSignalChanges++;
      state.timeRemaining = 1;
      dom.manualInterlockStatus.textContent = '● Interlock: All-Red Safety Clearance (1s)...';
      return;
    }

    // Now all clearance has completed: grant green to target direction
    const target = state.manualTargetDirection;
    state.isManualTransitioning = false;
    state.manualActiveDirection = target;
    setManualButtonsDisabled(false);

    if (target === 'NS') {
      applySignalStates('green', 'red');
      state.totalSignalChanges++;
      state.timeRemaining = DENSITY_TIMINGS[state.density].green;
      logEvent('MANUAL', 'Interlock complete: North-South granted GREEN.', 'log-tag-manual');
      dom.manualInterlockStatus.textContent = '● Active: North-South Green granted.';
    } else if (target === 'EW') {
      applySignalStates('red', 'green');
      state.totalSignalChanges++;
      state.timeRemaining = DENSITY_TIMINGS[state.density].green;
      logEvent('MANUAL', 'Interlock complete: East-West granted GREEN.', 'log-tag-manual');
      dom.manualInterlockStatus.textContent = '● Active: East-West Green granted.';
    } else if (target === 'HOLD') {
      applySignalStates('red', 'red');
      state.totalSignalChanges++;
      state.timeRemaining = 0;
      logEvent('MANUAL', 'All Red Safety Hold active. Intersection stopped.', 'log-tag-safety');
      dom.manualInterlockStatus.textContent = '● Active: All Red Clearance Hold.';
    }

    updateUI();
  }

  /**
   * Disables or enables manual action buttons during transitions.
   */
  function setManualButtonsDisabled(disabled) {
    dom.btnManualNS.disabled = disabled;
    dom.btnManualEW.disabled = disabled;
    dom.btnManualHold.disabled = disabled;
  }

  /* --------------------------------------------------------------------------
   * 9. USER COMMAND HANDLERS (START, STOP, RESET, MODE, DENSITY)
   * -------------------------------------------------------------------------- */
  
  /**
   * START command handler
   */
  function handleStart() {
    if (state.isRunning) {
      logEvent('SYSTEM', 'Controller is already running.', 'log-tag-status');
      return;
    }

    state.isRunning = true;
    state.status = 'RUNNING';

    if (state.mode === 'auto') {
      const activePhase = PHASES[state.phaseIndex];
      applySignalStates(activePhase.nsColor, activePhase.ewColor);
      logEvent('SYSTEM', `Simulation STARTED. Initiating ${activePhase.name}.`, 'log-tag-status');
    } else {
      if (state.manualActiveDirection === 'NS') {
        applySignalStates('green', 'red');
      } else if (state.manualActiveDirection === 'EW') {
        applySignalStates('red', 'green');
      } else {
        applySignalStates('red', 'red');
      }
      logEvent('SYSTEM', 'Simulation STARTED in Manual mode.', 'log-tag-status');
    }

    startClock();
    updateUI();
  }

  /**
   * STOP command handler
   */
  function handleStop() {
    state.isRunning = false;
    state.status = 'STOPPED';
    stopClock();

    // Turn all signals RED safely
    applySignalStates('red', 'red');
    logEvent('SYSTEM', 'Simulation STOPPED. All signals forced to RED for safety.', 'log-tag-safety');

    updateUI();
  }

  /**
   * RESET command handler
   */
  function handleReset() {
    stopClock();

    state.isRunning = false;
    state.mode = 'auto';
    state.density = 'medium';
    state.phaseIndex = 0;
    state.timeRemaining = DENSITY_TIMINGS['medium'].green;
    state.completedCycles = 0;
    state.totalSignalChanges = 0;
    state.status = 'READY';
    state.isManualTransitioning = false;
    state.manualActiveDirection = 'NS';

    // Reset controls in DOM
    dom.radioModeAuto.checked = true;
    dom.radioModeManual.checked = false;
    dom.labelModeAuto.classList.add('selected');
    dom.labelModeManual.classList.remove('selected');
    dom.manualControlsPanel.classList.add('disabled');
    dom.densitySelect.value = 'medium';
    setManualButtonsDisabled(false);

    // Apply Phase 1 standby state
    const phase1 = PHASES[0];
    applySignalStates(phase1.nsColor, phase1.ewColor);

    logEvent('SYSTEM', 'System RESET. Timers and statistics re-initialized to default.', 'log-tag-status');
    updateUI();
  }

  /**
   * Mode switch handler
   */
  function handleModeChange(mode) {
    if (state.mode === mode) return;

    state.mode = mode;

    if (mode === 'auto') {
      dom.labelModeAuto.classList.add('selected');
      dom.labelModeManual.classList.remove('selected');
      dom.manualControlsPanel.classList.add('disabled');

      // Sync active phase based on current light
      state.phaseIndex = 0;
      state.timeRemaining = getPhaseDuration(0);
      const phase = PHASES[0];
      applySignalStates(phase.nsColor, phase.ewColor);
      logEvent('MODE', 'Switched to AUTOMATIC mode. Continuous 6-phase sequence resumed.', 'log-tag-phase');
    } else {
      dom.labelModeManual.classList.add('selected');
      dom.labelModeAuto.classList.remove('selected');
      dom.manualControlsPanel.classList.remove('disabled');

      state.manualActiveDirection = 'NS';
      state.isManualTransitioning = false;
      applySignalStates('green', 'red');
      state.timeRemaining = DENSITY_TIMINGS[state.density].green;
      logEvent('MODE', 'Switched to MANUAL mode. Operator override enabled.', 'log-tag-manual');
    }

    updateUI();
  }

  /**
   * Density change handler
   */
  function handleDensityChange(newDensity) {
    if (!DENSITY_TIMINGS[newDensity]) return;

    state.density = newDensity;
    const greenDuration = DENSITY_TIMINGS[newDensity].green;

    // If currently in a green phase in auto mode, adapt time smoothly
    if (state.mode === 'auto' && state.isRunning) {
      const activePhase = PHASES[state.phaseIndex];
      if (activePhase.getType() === 'green') {
        // Adjust remaining time to not exceed new max
        state.timeRemaining = Math.min(state.timeRemaining, greenDuration);
      }
    }

    logEvent('DENSITY', `Traffic density adjusted to ${newDensity.toUpperCase()} (${greenDuration}s Green).`, 'log-tag-status');
    updateUI();
  }

  /**
   * Simulation speed adjustment
   */
  function handleSpeedChange(newSpeed) {
    state.simSpeed = parseFloat(newSpeed) || 1;
    if (state.isRunning) {
      startClock(); // Re-arm timer with updated frequency
    }
    logEvent('SYSTEM', `Simulation clock frequency set to ${state.simSpeed}x.`, 'log-tag-status');
  }

  /* --------------------------------------------------------------------------
   * 10. DIAGNOSTIC ACTIVITY LOGGING
   * -------------------------------------------------------------------------- */
  
  /**
   * Appends an entry to the diagnostic event feed with human-readable timestamp.
   */
  function logEvent(tag, message, tagClass = 'log-tag-phase') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      <span class="log-timestamp">[${timeStr}]</span>
      <span class="log-tag ${tagClass}">[${tag}]</span>
      <span>${escapeHTML(message)}</span>
    `;

    dom.activityLogTerminal.insertBefore(entry, dom.activityLogTerminal.firstChild);

    // Limit log length to 60 entries for performance
    if (dom.activityLogTerminal.children.length > 60) {
      dom.activityLogTerminal.removeChild(dom.activityLogTerminal.lastChild);
    }
  }

  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[match]);
  }

  /* --------------------------------------------------------------------------
   * 11. TOP-DOWN VEHICLE PHYSICS SIMULATION
   * -------------------------------------------------------------------------- */
  
  const vehicles = [];
  const LANE_COORDINATES = {
    // Northbound (travels upward from bottom)
    northbound: {
      startX: 36, // percentage from left
      startY: 105,
      direction: 'up',
      isHorizontal: false,
      stopY: 72,
      exitY: -10,
      color: '#2457A4'
    },
    // Southbound (travels downward from top)
    southbound: {
      startX: 54,
      startY: -10,
      direction: 'down',
      isHorizontal: false,
      stopY: 26,
      exitY: 105,
      color: '#D32F2F'
    },
    // Eastbound (travels rightward from left)
    eastbound: {
      startX: -10,
      startY: 54,
      direction: 'right',
      isHorizontal: true,
      stopY: 26, // stopX in percentage
      exitY: 105,
      color: '#F57C00'
    },
    // Westbound (travels leftward from right)
    westbound: {
      startX: 105,
      startY: 36,
      direction: 'left',
      isHorizontal: true,
      stopY: 72, // stopX in percentage
      exitY: -10,
      color: '#512DA8'
    }
  };

  /**
   * Initializes top-down vehicles.
   */
  function initVehicles() {
    dom.vehiclesLayer.innerHTML = '';
    vehicles.length = 0;

    const lanes = ['northbound', 'southbound', 'eastbound', 'westbound'];
    lanes.forEach(laneKey => {
      const config = LANE_COORDINATES[laneKey];
      const el = document.createElement('div');
      el.className = `vehicle ${config.isHorizontal ? 'vehicle-horizontal' : ''}`;
      el.style.backgroundColor = config.color;

      if (!config.isHorizontal) {
        el.innerHTML = '<div class="vehicle-windshield"></div><div class="vehicle-rear"></div>';
      } else {
        el.innerHTML = '<div class="vehicle-windshield"></div><div class="vehicle-rear"></div>';
      }

      dom.vehiclesLayer.appendChild(el);

      vehicles.push({
        element: el,
        lane: laneKey,
        config: config,
        x: config.startX,
        y: config.startY,
        speed: 0.35 + Math.random() * 0.15,
        isStopped: false
      });
    });

    requestAnimationFrame(renderVehicles);
  }

  /**
   * Physics loop for vehicles.
   */
  function renderVehicles() {
    if (dom.toggleVehicles.checked) {
      dom.vehiclesLayer.style.display = 'block';

      // Check current signal statuses
      const isNSGreen = dom.signals.north.querySelector('.light-green.active') !== null;
      const isEWGreen = dom.signals.east.querySelector('.light-green.active') !== null;

      vehicles.forEach(v => {
        const cfg = v.config;
        let canPass = false;

        if (cfg.direction === 'up' || cfg.direction === 'down') {
          canPass = isNSGreen && state.isRunning;
        } else {
          canPass = isEWGreen && state.isRunning;
        }

        // Movement physics
        if (cfg.direction === 'up') {
          // Approaching stop line from bottom
          if (!canPass && v.y <= cfg.stopY && v.y > cfg.stopY - 6) {
            v.y = cfg.stopY; // Stopped at line
          } else {
            v.y -= v.speed * (state.isRunning ? state.simSpeed : 0);
          }
          if (v.y < cfg.exitY) v.y = cfg.startY;
          v.element.style.top = `${v.y}%`;
          v.element.style.left = `${v.x}%`;
        } else if (cfg.direction === 'down') {
          // Approaching stop line from top
          if (!canPass && v.y >= cfg.stopY && v.y < cfg.stopY + 6) {
            v.y = cfg.stopY; // Stopped at line
          } else {
            v.y += v.speed * (state.isRunning ? state.simSpeed : 0);
          }
          if (v.y > cfg.exitY) v.y = cfg.startY;
          v.element.style.top = `${v.y}%`;
          v.element.style.left = `${v.x}%`;
        } else if (cfg.direction === 'right') {
          // Approaching stop line from left
          if (!canPass && v.x >= cfg.stopY && v.x < cfg.stopY + 6) {
            v.x = cfg.stopY; // Stopped at line
          } else {
            v.x += v.speed * (state.isRunning ? state.simSpeed : 0);
          }
          if (v.x > cfg.exitY) v.x = cfg.startX;
          v.element.style.top = `${v.y}%`;
          v.element.style.left = `${v.x}%`;
        } else if (cfg.direction === 'left') {
          // Approaching stop line from right
          if (!canPass && v.x <= cfg.stopY && v.x > cfg.stopY - 6) {
            v.x = cfg.stopY; // Stopped at line
          } else {
            v.x -= v.speed * (state.isRunning ? state.simSpeed : 0);
          }
          if (v.x < cfg.exitY) v.x = cfg.startX;
          v.element.style.top = `${v.y}%`;
          v.element.style.left = `${v.x}%`;
        }
      });
    } else {
      dom.vehiclesLayer.style.display = 'none';
    }

    requestAnimationFrame(renderVehicles);
  }

  /* --------------------------------------------------------------------------
   * 12. EVENT LISTENERS SETUP
   * -------------------------------------------------------------------------- */
  function setupEventListeners() {
    // 1. Primary Buttons
    dom.btnStart.addEventListener('click', handleStart);
    dom.btnStop.addEventListener('click', handleStop);
    dom.btnReset.addEventListener('click', handleReset);

    // 2. Mode Radios
    dom.radioModeAuto.addEventListener('change', () => handleModeChange('auto'));
    dom.radioModeManual.addEventListener('change', () => handleModeChange('manual'));

    // 3. Traffic Density
    dom.densitySelect.addEventListener('change', (e) => handleDensityChange(e.target.value));

    // 4. Manual Direction Buttons
    dom.btnManualNS.addEventListener('click', () => requestManualDirection('NS'));
    dom.btnManualEW.addEventListener('click', () => requestManualDirection('EW'));
    dom.btnManualHold.addEventListener('click', () => requestManualDirection('HOLD'));

    // 5. Simulation Speed & Vehicle Toggles
    dom.simSpeedSelect.addEventListener('change', (e) => handleSpeedChange(e.target.value));

    // 6. Clear Diagnostic Log
    dom.btnClearLog.addEventListener('click', () => {
      dom.activityLogTerminal.innerHTML = '';
      logEvent('SYSTEM', 'Diagnostic log cleared by operator.', 'log-tag-status');
    });

    // 7. Navigation Smooth Scroll & Active Indicator
    dom.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        dom.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // 8. Window Unload Safety Cleanup
    window.addEventListener('beforeunload', () => {
      stopClock();
    });
  }

  /* --------------------------------------------------------------------------
   * 13. SYSTEM INITIALIZATION
   * -------------------------------------------------------------------------- */
  function init() {
    logEvent('FSM', 'System boot sequence complete. Controller initialized.', 'log-tag-status');
    logEvent('INTERLOCK', 'Safety interlock verification: PASS. Simultaneous green locked out.', 'log-tag-safety');

    setupEventListeners();
    initVehicles();

    // Default start condition: Phase 1 ready
    const initialPhase = PHASES[0];
    applySignalStates(initialPhase.nsColor, initialPhase.ewColor);
    state.timeRemaining = getPhaseDuration(0);

    // Automatically begin simulation on load (or ready state)
    // Starting in running state provides instant engagement as in demo
    handleStart();

    updateUI();
  }

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

