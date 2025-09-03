// Mobile joystick variables
let joystickActive = false;
let joystickCenterX = 0;
let joystickCenterY = 0;
let joystickRadius = 60;
let joystickVector = { x: 0, y: 0 };
let runModeEnabled = false;

// Safety check function
function ensureGlobals() {
    if (!window.keyStates) {
        window.keyStates = {};
        // Initialize shift key state
        window.keyStates['ShiftLeft'] = false;
    }
    if (!window.THREE) {
        console.error('THREE.js not available');
        return false;
    }
    return true;
}

// Initialize mobile controls
export function initMobileControls() {
    if (!ensureGlobals()) return;

    // Initialize run toggle first
    initRunToggle();
    
    const joystick = document.getElementById('movement-joystick');
    const stick = document.getElementById('movement-stick');
    const jumpButton = document.getElementById('jump-button');
    const throwButton = document.getElementById('throw-button');
    const flyUpButton = document.getElementById('fly-up-button');
    const flyDownButton = document.getElementById('fly-down-button');
    
    if (!joystick || !stick) {
        console.warn('Joystick elements not found');
        return;
    }
    
    // Get joystick center position
    const updateJoystickPosition = () => {
        const rect = joystick.getBoundingClientRect();
        joystickCenterX = rect.left + rect.width / 2;
        joystickCenterY = rect.top + rect.height / 2;
        joystickRadius = rect.width / 2;
    };
    
    // Initial position update
    updateJoystickPosition();
    
    // Update position on window resize
    window.addEventListener('resize', updateJoystickPosition);
    
    // Joystick touch events
    joystick.addEventListener('touchstart', function(e) {
        e.preventDefault();
        updateJoystickPosition();
        handleJoystickStart(e);
    });
    
    joystick.addEventListener('touchmove', function(e) {
        e.preventDefault();
        handleJoystickMove(e);
    });
    
    joystick.addEventListener('touchend', function(e) {
        e.preventDefault();
        handleJoystickEnd(e);
    });
    
    joystick.addEventListener('touchcancel', function(e) {
        e.preventDefault();
        handleJoystickEnd(e);
    });
    
    // Also support mouse events for testing on desktop
    joystick.addEventListener('mousedown', function(e) {
        e.preventDefault();
        updateJoystickPosition();
        handleJoystickStart(e);
    });
    
    // Prevent default on action buttons to avoid scrolling
    if (jumpButton) {
        jumpButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.keyStates) {
                window.keyStates['Space'] = true;
            }
            jumpButton.style.backgroundColor = 'rgba(0, 200, 0, 0.9)';
        });
        
        jumpButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (window.keyStates) {
                window.keyStates['Space'] = false;
            }
            jumpButton.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
        });
        
        jumpButton.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            if (window.keyStates) {
                window.keyStates['Space'] = false;
            }
            jumpButton.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
        });
        
        // Mouse events for testing
        jumpButton.addEventListener('mousedown', () => {
            if (window.keyStates) {
                window.keyStates['Space'] = true;
            }
            jumpButton.style.backgroundColor = 'rgba(0, 200, 0, 0.9)';
        });
        
        jumpButton.addEventListener('mouseup', () => {
            if (window.keyStates) {
                window.keyStates['Space'] = false;
            }
            jumpButton.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
        });
    }
    
    if (throwButton) {
        throwButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            throwButton.style.backgroundColor = 'rgba(200, 0, 0, 0.9)';
            if (window.throwBall) {
                window.throwBall();
            }
        });
        
        throwButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            throwButton.style.backgroundColor = 'rgba(128, 0, 0, 0.7)';
        });
        
        throwButton.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            throwButton.style.backgroundColor = 'rgba(128, 0, 0, 0.7)';
        });
        
        // Mouse events for testing
        throwButton.addEventListener('mousedown', () => {
            throwButton.style.backgroundColor = 'rgba(200, 0, 0, 0.9)';
            if (window.throwBall) {
                window.throwBall();
            }
        });
        
        throwButton.addEventListener('mouseup', () => {
            throwButton.style.backgroundColor = 'rgba(128, 0, 0, 0.7)';
        });
    }
    
    // Fly up button events
    if (flyUpButton) {
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
    }
    
    // Fly down button events
    if (flyDownButton) {
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
}

// Initialize run toggle button
function initRunToggle() {
    const runToggleButton = document.getElementById('run-toggle-button');
    if (!runToggleButton) return;
    
    runToggleButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleRunMode();
    });
    
    runToggleButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        toggleRunMode();
    });
    
    // Also support click for accessibility
    runToggleButton.addEventListener('click', (e) => {
        e.preventDefault();
        toggleRunMode();
    });
}

// Toggle run mode function
function toggleRunMode() {
    runModeEnabled = !runModeEnabled;
    
    const runToggleButton = document.getElementById('run-toggle-button');
    if (runToggleButton) {
        if (runModeEnabled) {
            runToggleButton.classList.add('active');
            runToggleButton.textContent = 'RUNNING';
            if (window.keyStates) {
                window.keyStates['ShiftLeft'] = true;
            }
        } else {
            runToggleButton.classList.remove('active');
            runToggleButton.textContent = 'WALK';
            if (window.keyStates) {
                window.keyStates['ShiftLeft'] = false;
            }
        }
    }
    
    console.log('Run mode:', runModeEnabled ? 'ON' : 'OFF');
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
    
    // Reset all movement keys but keep run state
    if (window.keyStates) {
        window.keyStates['KeyW'] = false;
        window.keyStates['KeyS'] = false;
        window.keyStates['KeyA'] = false;
        window.keyStates['KeyD'] = false;
        // Note: We DON'T reset ShiftLeft here to maintain run toggle state
    }
}

function updateKeyStatesFromJoystick() {
    if (!window.keyStates) return;
    
    // Deadzone to prevent accidental movement
    const deadzone = 0.2;
    
    // Reset all movement keys first
    window.keyStates['KeyW'] = false;
    window.keyStates['KeyS'] = false;
    window.keyStates['KeyA'] = false;
    window.keyStates['KeyD'] = false;
    
    // Only set keys if joystick is active and beyond deadzone
    if (joystickActive && (Math.abs(joystickVector.x) > deadzone || Math.abs(joystickVector.y) > deadzone)) {
        // Forward/backward movement (W/S keys)
        if (joystickVector.y < -deadzone) {
            window.keyStates['KeyW'] = true;
        } else if (joystickVector.y > deadzone) {
            window.keyStates['KeyS'] = true;
        }
        
        // Left/right movement (A/D keys)
        if (joystickVector.x < -deadzone) {
            window.keyStates['KeyA'] = true;
        } else if (joystickVector.x > deadzone) {
            window.keyStates['KeyD'] = true;
        }
    }
    
    // Debug log to verify joystick is working
    console.log('Joystick:', joystickVector.x.toFixed(2), joystickVector.y.toFixed(2));
    console.log('Keys - W:', window.keyStates['KeyW'], 'S:', window.keyStates['KeyS'], 
                'A:', window.keyStates['KeyA'], 'D:', window.keyStates['KeyD']);
}

// Add camera control for mobile (swipe to look around)
export function initMobileCameraControls() {
    if (!ensureGlobals()) return;
    
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
        if (!isCameraMoving || e.touches.length !== 1 || !window.avatar) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;
        
        // Update camera angles (sensitivity adjustment)
        window.avatar.cameraAzimuth -= deltaX * 0.005;
        window.avatar.cameraPolar = window.THREE.MathUtils.clamp(
            window.avatar.cameraPolar - (deltaY * 0.005),
            0.1,
            Math.PI - 0.1
        );
        
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
    // Continuous update for joystick input
    function updateJoystickInput() {
        if (joystickActive) {
            updateKeyStatesFromJoystick();
        }
        requestAnimationFrame(updateJoystickInput);
    }

    // Start the update loop
    updateJoystickInput();
}