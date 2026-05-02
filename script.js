let robotIP = "192.168.1.100";
let isConnected = false;
let dataInterval;
let isManualModeEnabled = false;

// DOM Elements
const connectionText = document.getElementById("connectionText");
const connectionStatus = document.querySelector(".connection-status");
const ipInput = document.getElementById("esp-ip");
const batteryFill = document.getElementById("battery-fill");
const batteryText = document.getElementById("battery-text");
const stateText = document.getElementById("state-text");

const lampYellow = document.getElementById("lamp-yellow");
const lampRed = document.getElementById("lamp-red");
const lampGreen = document.getElementById("lamp-green");

function connectToRobot() {
    robotIP = ipInput.value.trim();
    if (!robotIP) {
        alert("Please enter a valid IP address.");
        return;
    }
    
    // Attempt initial connection by fetching status
    console.log(`Attempting connection to ESP32 at ${robotIP}...`);
    fetchStatus();
    
    // Set up polling interval to get live data every 2 seconds
    if (dataInterval) clearInterval(dataInterval);
    dataInterval = setInterval(fetchStatus, 2000);
}

function updateConnectionState(connected) {
    isConnected = connected;
    if (connected) {
        connectionStatus.classList.add("connected");
        connectionText.textContent = "Connected";
    } else {
        connectionStatus.classList.remove("connected");
        connectionText.textContent = "Disconnected";
    }
}

function toggleManualMode() {
    isManualModeEnabled = document.getElementById("manual-toggle").checked;
    const panel = document.getElementById("control-panel");
    if (isManualModeEnabled) {
        panel.classList.remove("disabled");
        console.log("Manual Mode: ENABLED");
    } else {
        panel.classList.add("disabled");
        console.log("Manual Mode: DISABLED");
        // Safety feature: Send stop command when manual mode is disabled
        if (isConnected) {
            fetch(`http://${robotIP}/command?dir=stop`, { method: 'GET' }).catch(e => console.error(e));
        } else {
            setLampState('idle'); // Just for simulation
        }
    }
}

// Function to send commands via ESP32 Web Server
// Expected endpoints on ESP32: /command?dir=forward, /command?dir=backward, /command?dir=lcd_up, etc.
function sendCommand(cmd) {
    if (!isManualModeEnabled) {
        console.log("Manual mode is disabled. Command ignored.");
        return;
    }

    console.log(`Manual Mode -> Sending command: ${cmd}`);

    if (!isConnected) {
        // SIMULATION: If we aren't connected, simulate the action
        if(cmd === 'stop') {
            setLampState('stopped');
        } else if (cmd === 'forward' || cmd === 'backward' || cmd === 'left' || cmd === 'right') {
            setLampState('moving');
        } else {
            console.log(`Simulating LCD Command: ${cmd}`);
        }
        return;
    }

    fetch(`http://${robotIP}/command?dir=${cmd}`, { method: 'GET' })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            console.log(`Successfully sent: ${cmd}`);
        })
        .catch(err => {
            console.error("Failed to send command to ESP32:", err);
            updateConnectionState(false);
        });
}

function sendWaypoint(id) {
    const x = document.getElementById(`waypoint${id}-x`).value;
    const y = document.getElementById(`waypoint${id}-y`).value;
    
    if (x === "" || y === "") {
        alert(`Please enter both X and Y axis values for Waypoint ${id}.`);
        return;
    }
    
    if (!isManualModeEnabled) {
        console.log("Manual mode is disabled. Waypoint ignored.");
        return;
    }

    console.log(`Manual Mode -> Sending waypoint ${id}: X=${x}, Y=${y}`);

    if (!isConnected) {
        setLampState('moving');
        return;
    }

    fetch(`http://${robotIP}/command?dir=waypoint&id=${id}&x=${x}&y=${y}`, { method: 'GET' })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            console.log(`Successfully sent waypoint ${id}: X=${x}, Y=${y}`);
        })
        .catch(err => {
            console.error(`Failed to send waypoint ${id} to ESP32:`, err);
        });
}


// Function to fetch live data (Battery, State) from ESP32
function fetchStatus() {
    // Example ESP32 Endpoint: http://192.168.1.100/status
    // Should return JSON like: {"battery": 85, "state": "moving"}
    fetch(`http://${robotIP}/status`, { method: 'GET' })
        .then(response => {
            if (!response.ok) throw new Error("Network error");
            return response.json();
        })
        .then(data => {
            updateConnectionState(true);
            updateBattery(data.battery);
            updateRobotState(data.state);
        })
        .catch(err => {
            if (isConnected) {
                console.error("Lost connection to ESP32.");
            }
            updateConnectionState(false);
        });
}

function updateBattery(level) {
    // Ensure level is between 0 and 100
    level = Math.max(0, Math.min(100, level));
    
    batteryFill.style.width = `${level}%`;
    batteryText.textContent = `${Math.round(level)}%`;

    // Change color and shadow based on battery level
    if (level > 50) {
        batteryFill.style.backgroundColor = "var(--lamp-green)";
        batteryFill.style.boxShadow = "0 0 10px rgba(34, 197, 94, 0.5)";
    } else if (level > 20) {
        batteryFill.style.backgroundColor = "var(--lamp-yellow)";
        batteryFill.style.boxShadow = "0 0 10px rgba(234, 179, 8, 0.5)";
    } else {
        batteryFill.style.backgroundColor = "var(--lamp-red)";
        batteryFill.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.5)";
    }
}

function setLampState(state) {
    // Turn all off
    lampYellow.className = "lamp";
    lampRed.className = "lamp";
    lampGreen.className = "lamp";

    switch(state) {
        case 'moving':
            lampYellow.classList.add("active-yellow");
            stateText.textContent = "Moving to Target...";
            stateText.style.color = "var(--lamp-yellow)";
            break;
        case 'stopped':
        case 'obstacle':
            lampRed.classList.add("active-red");
            stateText.textContent = "Obstacle Detected! Stopped.";
            stateText.style.color = "var(--lamp-red)";
            break;
        case 'reached':
        case 'target':
            lampGreen.classList.add("active-green");
            stateText.textContent = "Target Reached!";
            stateText.style.color = "var(--lamp-green)";
            break;
        default:
            stateText.textContent = "Idle / Awaiting Command";
            stateText.style.color = "var(--text-muted)";
            break;
    }
}

function updateRobotState(stateStr) {
    // stateStr expected: "moving", "obstacle", "reached"
    setLampState(stateStr);
}


/* =======================================================
   SIMULATION CODE
   This runs ONLY when disconnected, to demonstrate the UI
   working perfectly for your presentation/grading!
   ======================================================= */
let simBattery = 100;
let simStates = ['moving', 'moving', 'obstacle', 'moving', 'reached'];
let simIndex = 0;

function simulateLiveData() {
    if (isConnected) return; // Don't simulate if we have real data
    
    // Decrease battery by 1% every 3 minutes (180 seconds).
    // This function runs every 1 second, so we decrease by 1/180 each tick.
    simBattery -= (1 / 180);
    if (simBattery < 5) simBattery = 100;
    updateBattery(simBattery);

    // Rotate states every 3 seconds
    simIndex = Math.floor(Date.now() / 3000) % simStates.length;
    updateRobotState(simStates[simIndex]);
}

// Initial simulation start
simulateLiveData();
setInterval(simulateLiveData, 1000);
