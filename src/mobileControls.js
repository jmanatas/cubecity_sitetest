// Mobile joystick variables
let joystickActive = false;
let joystickCenterX = 0;
let joystickCenterY = 0;
let joystickRadius = 60;
let joystickVector = { x: 0, y: 0 };

// Initialize mobile controls
export function initMobileControls() {
    const joystick = document.getElementById('movement-joystick');
    const stick = document.getElementById('movement-stick');
    const jumpButton = document.getElementById('jump-button');
    const throwButton = document.getElementById('throw-button');
    const flyUpButton = document.getElementById('fly-up-button');
    const flyDownButton = document.getElementById('fly-down-button');
    
    if (!joystick || !stick) return;
    
    // ... existing joystick code ...
    
    // Fly up button events
    flyUpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.keyStates) {
            window.keyStates['KeyQ'] = true;
        }
        flyUpButton.style.backgroundColor = 'rgba(0, 150, 255, 0.9)';
    });
    
    flyUpButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (window.keyStates) {
            window.keyStates['KeyQ'] = false;
        }
        flyUpButton.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
    });
    
    flyUpButton.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        if (window.keyStates) {
            window.keyStates['KeyQ'] = false;
        }
        flyUpButton.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
    });
    
    // Fly down button events
    flyDownButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.keyStates) {
            window.keyStates['KeyE'] = true;
        }
        flyDownButton.style.backgroundColor = 'rgba(0, 150, 255, 0.9)';
    });
    
    flyDownButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (window.keyStates) {
            window.keyStates['KeyE'] = false;
        }
        flyDownButton.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
    });
    
    flyDownButton.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        if (window.keyStates) {
            window.keyStates['KeyE'] = false;
        }
        flyDownButton.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
    });
    
    // Mouse events for testing
    flyUpButton.addEventListener('mousedown', () => {
        if (window.keyStates) {
            window.keyStates['KeyQ'] = true;
        }
        flyUpButton.style.backgroundColor = 'rgba(0, 150, 255, 0.9)';
    });
    
    flyUpButton.addEventListener('mouseup', () => {
        if (window.keyStates) {
            window.keyStates['KeyQ'] = false;
        }
        flyUpButton.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
    });
    
    flyDownButton.addEventListener('mousedown', () => {
        if (window.keyStates) {
            window.keyStates['KeyE'] = true;
        }
        flyDownButton.style.backgroundColor = 'rgba(0, 150, 255, 0.9)';
    });
    
    flyDownButton.addEventListener('mouseup', () => {
        if (window.keyStates) {
            window.keyStates['KeyE'] = false;
        }
        flyDownButton.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
    });
}

// Joystick event handlers
function handleJoystickStart(e) {
    e.preventDefault();
    joystickActive = true;
    
    if (e.type === 'touchstart') {
        const touch = e.touches[0];
        updateJoystickPosition(touch.clientX, touch.clientY);
    } else if (e.type === 'mousedown') {
        updateJoystickPosition(e.clientX, e.clientY);
    }
}

function handleJoystickMove(e) {
    if (!joystickActive) return;
    e.preventDefault();
    
    if (e.type === 'touchmove') {
        const touch = e.touches[0];
        updateJoystickPosition(touch.clientX, touch.clientY);
    } else if (e.type === 'mousemove' && joystickActive) {
        updateJoystickPosition(e.clientX, e.clientY);
    }
}

function handleJoystickEnd(e) {
    e.preventDefault();
    resetJoystick();
}

function updateJoystickPosition(x, y) {
    const stick = document.getElementById('movement-stick');
    if (!stick) return;
    
    // Calculate distance from center
    const dx = x - joystickCenterX;
    const dy = y - joystickCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Limit to joystick radius
    const limitedDistance = Math.min(distance, joystickRadius);
    const angle = Math.atan2(dy, dx);
    
    // Calculate stick position
    const stickX = Math.cos(angle) * limitedDistance;
    const stickY = Math.sin(angle) * limitedDistance;
    
    // Update stick visual position
    stick.style.transform = `translate(${stickX}px, ${stickY}px)`;
    
    // Normalize joystick vector for movement
    joystickVector.x = limitedDistance > 0 ? dx / joystickRadius : 0;
    joystickVector.y = limitedDistance > 0 ? dy / joystickRadius : 0;
    
    // Update key states based on joystick direction
    updateKeyStatesFromJoystick();
}

function resetJoystick() {
    const stick = document.getElementById('movement-stick');
    if (stick) {
        stick.style.transform = 'translate(0, 0)';
    }
    
    joystickActive = false;
    joystickVector = { x: 0, y: 0 };
    
    // Reset all movement keys
    if (window.keyStates) {
        window.keyStates['KeyW'] = false;
        window.keyStates['KeyS'] = false;
        window.keyStates['KeyA'] = false;
        window.keyStates['KeyD'] = false;
    }
}

function updateKeyStatesFromJoystick() {
    if (!window.keyStates) return;
    
    // Deadzone to prevent accidental movement
    const deadzone = 0.2;
    
    // Forward/backward movement (W/S keys)
    if (joystickVector.y < -deadzone) {
        window.keyStates['KeyW'] = true;
        window.keyStates['KeyS'] = false;
    } else if (joystickVector.y > deadzone) {
        window.keyStates['KeyW'] = false;
        window.keyStates['KeyS'] = true;
    } else {
        window.keyStates['KeyW'] = false;
        window.keyStates['KeyS'] = false;
    }
    
    // Left/right movement (A/D keys)
    if (joystickVector.x < -deadzone) {
        window.keyStates['KeyA'] = true;
        window.keyStates['KeyD'] = false;
    } else if (joystickVector.x > deadzone) {
        window.keyStates['KeyA'] = false;
        window.keyStates['KeyD'] = true;
    } else {
        window.keyStates['KeyA'] = false;
        window.keyStates['KeyD'] = false;
    }
}

// Add camera control for mobile (swipe to look around)
export function initMobileCameraControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isCameraMoving = false;
    
    document.addEventListener('touchstart', (e) => {
        // Only handle single-finger touches outside of UI elements
        if (e.touches.length === 1 && 
            !e.target.closest('#mobile-controls') && 
            !e.target.closest('#action-buttons') &&
            !e.target.closest('#object-list')) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isCameraMoving = true;
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!isCameraMoving || e.touches.length !== 1) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;
        
        // Update camera angles (sensitivity adjustment)
        if (window.avatar) {
            window.avatar.cameraAzimuth -= deltaX * 0.005;
            window.avatar.cameraPolar = THREE.MathUtils.clamp(
                window.avatar.cameraPolar - (deltaY * 0.005),
                0.1,
                Math.PI - 0.1
            );
        }
        
        touchStartX = touchX;
        touchStartY = touchY;
        
        e.preventDefault();
    });
    
    document.addEventListener('touchend', () => {
        isCameraMoving = false;
    });
    
    document.addEventListener('touchcancel', () => {
        isCameraMoving = false;
    });
}

// Detect touch device and adjust UI accordingly
export function checkTouchDevice() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
        // Show mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        const actionButtons = document.getElementById('action-buttons');
        const info = document.getElementById('info');
        
        if (mobileControls) mobileControls.style.display = 'block';
        if (actionButtons) actionButtons.style.display = 'flex';
        
        // Hide keyboard instructions
        if (info) info.style.display = 'none';
        
        // Adjust UI for mobile
        const gravityIndicator = document.getElementById('gravity-indicator');
        if (gravityIndicator) {
            gravityIndicator.style.top = '20px';
            gravityIndicator.style.right = '20px';
        }
    }
}
