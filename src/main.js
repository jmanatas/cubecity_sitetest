import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { loadTextures } from './textureLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { TextureLoader } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AvatarController } from './avatarController.js';
import { Avatar } from './avatar.js';
import { PhysicsWorld, createPhysicsSphere, GRAVITY, SPHERE_RADIUS, STEPS_PER_FRAME } from './physics.js';

const NUM_SPHERES = 25; // Number of spheres to create
const PLAYER_HEIGHT = 1.8; // Height of the player capsule
const PLAYER_RADIUS = 0.35; // Radius of the player capsule
const RESPAWN_HEIGHT = 200; // Height at which the player respawns
const FALL_THRESHOLD = 20; // Height difference to trigger respawn
const RESPAWN_DELAY = 8.0; // Delay before respawning

// Global variables
let threejsData = { objects: [] }
let scene, camera, renderer, worldOctree, worldObjects;
let stats;
let textures = [];
let clock = new THREE.Clock(); 
let objectsData = []; 
let selectedObjectIndex = -1; 
let currentSpeed = 10; // Normal movement speed
let composer;
let outlinePass;
let renderPass;
let effectFXAA;
let textureUrls = new Map(); // Stores texture-to-url mappings
let pendingRedirectUrl = null;
let redirectDialog = null;
let cancelRedirectBtn = null;
let confirmRedirectBtn = null;
let lastMouseX = 0;
let lastMouseY = 0;
const MOUSE_DEADZONE = 2; // pixels

let physicsWorld;
let avatar;
let spheres = [];
let sphereIdx = 0;
let mouseTime = 0;
let fallStartTime = null;
let isFalling = false;
const playerDirection = new THREE.Vector3();

let screenshotTextures = [];
const screenshotDomains = [
     'berluti.com', 'chevignon.com', 'dior.com', 'dolcegabbana.com', 'hugoboss.com', 'ports1961.com', 'marinabaysands.com', 'stefanoricci.com', 'zegna.com', 'aliceandolivia.com', 'chanel.com', 'dvf.com', 'graceland.com', 'maxmara.com', 'misssixty.com', 'miumiu.com', 'self-portrait.com', 'snidel.com', 'toryburch.com', 'victoriassecret.com', 'weekendmaxmara.com', 'bape.com', 'aigle.com', 'aimer.com', 'alexandermcqueen.com', 'americanvintage-store.com', 'armani.com', 'balmain.com', 'bauhaus.com', 'brooksbrothers.com', 'calvinklein.com', 'clubmonaco.com', 'descente.com', 'diesel.com', 'edhardyoriginals.com', 'armani.com', 'givenchy.com', 'guess.com', 'hermes.com', 'kenzo.com', 'lacoste.com', 'girbaud.com', 'moncler.com', 'ralphlauren.com', 'ports1961.com', 'prada.com', 'rainbowshops.com', 'ysl.com', 'sandro-paris.com', 'thenorthface.com', 'tommy.com', 'uniqlo.com', 'valentino.com', 'versace.com', 'y-3.com', 'zara.com', 'adidas.com', 'arcteryx.com', 'columbia.com', 'fila.de', 'kswiss.com', 'lululemon.com', 'marathonsports.com', 'nike.com', 'skechers.com', 'vilebrequin.com', 'schiaparelli.com', 'jeanpaulgaultier.com', 'maisonmargiela.com', 'viktor-rolf.com', 'irisvanherpen.com', 'zuhairmurad.com', 'brunellocucinelli.com', 'bottegaveneta.com', 'therow.com', 'tods.com', 'adererror.com', 'musinsa.com', 'yohjiyamamoto.co.jp', 'sacai.jp', 'mooseknucklescanada.com', 'khaite.com', 'lemaire.fr', 'jacquemus.com', 'simonerocha.com', 'ganni.com', 'rickowens.eu', 'anndemeulemeester.com', 'burberry.cn', 'barbour.com', 'gucci.com', 'hm.com', 'carhartt-wip.com', 'carhartt.com', 'dickies.com', 'thefrankieshop.com', 'stussy.com', 'princesspolly.com', 'on.com', 'salomon.com', 'aloyoga.com', 'patagonia.com', 'oakley.com', 'mammut.com', 'hoka.com'
];

// Maximum number of concurrent texture loads
const MAX_CONCURRENT_LOADS = 10; // Limit concurrent loads to avoid rate limiting

// Highlight effect variables
let highlightEffectEnabled = false;
let highlightedObject = null;
let originalMaterials = new Map();
let lastHighlightTime = 0;
const HIGHLIGHT_HYSTERESIS = 200; // ms delay before switching objects

// CAMERA MOVEMENT SPEEDS
const WALK_SPEED = 10;
const RUN_SPEED = 20;

// Load object/geometry data from JSON file
async function loadObjectsData() {
    try {
        const response = await fetch('threejs_export.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        objectsData = await response.json();
    } catch (error) {
        console.error('Error loading threejs_export.json:', error);
    }
}

// Create a colored fallback texture
function createColoredFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `hsl(${Math.random() * 360}, 80%, 50%)`;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = 'white';
    ctx.font = '100px Arial';
    ctx.fillText('FALLBACK', 50, 500);
    return canvas;
}

// Player variables
const keyStates = {};

// Caching geometries for better performance
const geometryCache = {};

document.addEventListener('keydown', function(event) {
    keyStates[event.code] = true;
});

document.addEventListener('keyup', function(event) {
    keyStates[event.code] = false;
});

// Load data and start the game
loadObjectsData().then(() => {
    async function startGame() {
        await loadObjectsData();
        init(); // Call init() instead of startRendering()
    }
}).catch(error => {
    console.error('Error starting game:', error);
});

// Utility vectors - Reusable temporary vectors for physics/collision calculations  
// (Avoids frequent allocations in loops for better performance)  
const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

// Texture Aspect Ratio Helper Functions
function isPowerOfTwo(value) {
  return (value & (value - 1)) === 0 && value !== 0;
}
function nextPowerOfTwo(value) {
  return Math.pow(2, Math.ceil(Math.log(value) / Math.log(2)));
}

// Loads scene data from threejs_export.json, falling back to a simple default scene if the file is missing or invalid.
// Returns a Promise resolving to the parsed JSON data containing object geometries, positions, and other properties.
async function loadJSON() {
    try {
        const response = await fetch('/threejs_export.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (!data.objects) throw new Error('Missing objects array in JSON');
        return data;
    } catch (error) {
        console.warn('Using fallback scene data due to:', error.message);
        return { 
            objects: [{
                vertices: [-5,0,-5,5,0,-5,5,0,5,-5,0,-5,5,0,5,-5,0,5],
                castShadow: true,
                receiveShadow: true
            }]
        };
    }
}

// Helper functions
function setupLights() {

    // Hemisphere light (from webgl_lights_hemisphere.html)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // Directional light (from webgl_lights_hemisphere.html)
    const dirLight = new THREE.DirectionalLight(0xffffff, 3);
    dirLight.color.setHSL(0.1, 1, 0.95);
    dirLight.position.set(-1, 1.75, 1);
    dirLight.position.multiplyScalar(30);
    scene.add(dirLight);

    // Configure shadows (optional)
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.far = 3500;
    dirLight.shadow.bias = -0.0001;
}

function setupPlayer() {
    avatar = new Avatar(scene, RESPAWN_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS);
    
    // Initialize controller immediately
    avatar.controller = new AvatarController(); 
}

function setupSpheres() {
    if (!physicsWorld) {
        console.error("Physics world not initialized");
        return;
    }

    const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xdede8d });

    for (let i = 0; i < NUM_SPHERES; i++) {
        const mesh = new THREE.Mesh(
            new THREE.IcosahedronGeometry(SPHERE_RADIUS, 5),
            sphereMaterial
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const sphere = createPhysicsSphere(mesh, SPHERE_RADIUS, new THREE.Vector3(0, -100, 0));
        physicsWorld.addSphere(sphere);
        spheres.push(sphere);
    }
}

function throwBall() {
    const sphere = spheres[sphereIdx];
    camera.getWorldDirection(avatar.direction);

    sphere.collider.center.copy(avatar.collider.end)
        .addScaledVector(avatar.direction, avatar.collider.radius * 1.5);

    const impulse = 15 + 30 * (1 - Math.exp((mouseTime - performance.now()) * 0.001));
    sphere.velocity.copy(avatar.direction).multiplyScalar(impulse);
    sphere.velocity.addScaledVector(avatar.velocity, 2);

    sphereIdx = (sphereIdx + 1) % spheres.length;
}

// Sets up the teleport button click handler to move the player to the selected object's position.
// Uses the current selectedObjectIndex from the object list UI to determine the target location.
// Adjusts height to avoid collisions and resets player velocity after teleportation.
function setupTeleportButton() {
    const teleportBtn = document.getElementById('teleport-button');
    if (!teleportBtn) {
        console.error("Teleport button not found");
        return;
    }
    
    teleportBtn.onclick = function() {
        console.log("Teleport button clicked");
        console.log("Selected object index:", selectedObjectIndex);

        if (selectedObjectIndex === -1) {
            console.log("No object selected for teleport");
            return;
        }
        
        const objData = objectsData.objects[selectedObjectIndex];
        if (!objData) {
            console.error("Selected object data not found");
            return;
        }
        
        if (!objData.position) {
            console.error("Selected object has no position data");
            return;
        }
        
        console.log("Teleporting to:", objData.position);
        
        // Teleport player to object position
        const targetX = objData.position[0] || 0;
        const targetY = (objData.position[1] || 0) + avatar.playerRadius; // Start at feet level + radius
        const targetZ = objData.position[2] || 0;
        
        // Update physics capsule
        avatar.collider.start.set(targetX, targetY, targetZ);
        avatar.collider.end.set(targetX, targetY + (avatar.playerHeight - 2 * avatar.playerRadius), targetZ);
        
        // Update character position
        if (avatar.character) {
            avatar.character.position.set(targetX, targetY - avatar.playerRadius, targetZ);
        }
        
        // Update the respawn height to match the teleported position
        avatar.setRespawnHeight(targetY);
        
        // Reset physics state
        avatar.velocity.set(0, 0, 0);
        avatar.onFloor = true;
        
        // Update camera
        if (avatar.cameraMode === 'thirdPerson') {
            avatar.resetThirdPersonCamera(camera);
        }
    };
}

// Creates a floating UI window listing all scene objects with teleport functionality.
// Generates clickable object entries with names and positions, plus a 'GO' button.
// The window is hidden by default and can be toggled via the UI or keyboard shortcut.
function createObjectListWindow() {
    if (document.getElementById('object-list')) return;

    // Create the object list container
    const container = document.createElement('div');
    container.id = 'object-list';
    container.style.display = 'none'; // Explicitly set to hidden

    // Create header section
    const header = document.createElement('div');
    header.id = 'object-list-header';

    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Scene Objects';
    header.appendChild(title);

    // Create teleport button
    const teleportBtn = document.createElement('button');
    teleportBtn.id = 'teleport-button';
    teleportBtn.textContent = 'GO!';
    header.appendChild(teleportBtn);

    container.appendChild(header);

    // Create scrollable content section
    const content = document.createElement('div');
    content.id = 'object-list-content';

    // Create the list container
    const list = document.createElement('div');
    list.id = 'object-list-items';
    content.appendChild(list);
    
    container.appendChild(content);
    
    document.body.appendChild(container);
}

// Updates the object list UI with current scene objects from objectsData.
// Creates interactive list items showing object names and positions,
// and highlights the currently selected object.
// Only updates if objectsData is available.
function updateObjectList() {
    const listElement = document.getElementById('object-list-items');
    if (!listElement) {
        console.error("List element not found");
        return;
    }
    
    // Check if objectsData is available
    if (!objectsData || !objectsData.objects) {
        console.error("No objects data available");
        return;
    }
    
    console.log("Updating object list with", objectsData.objects.length, "objects");
    
    listElement.innerHTML = '';
    // Create object items
    objectsData.objects.forEach((objData, index) => {
        const objName = objData.name || `Object_${index}`;
        const item = document.createElement('div');
        item.className = `object-item ${selectedObjectIndex === index ? 'selected' : ''}`;
        item.dataset.index = index;
        // Add click event listener
        item.onclick = handleObjectClick;
        // Highlight the selected object
        const nameSpan = document.createElement('span');
        nameSpan.className = 'object-name';
        nameSpan.textContent = objName;
        // Create position span
        const posSpan = document.createElement('span');
        posSpan.className = 'object-position';
        // Create position text
        if (objData.position) {
            posSpan.textContent = ` (${objData.position[0]?.toFixed(1) || 0}, ${
                                 objData.position[1]?.toFixed(1) || 0}, ${
                                 objData.position[2]?.toFixed(1) || 0})`;
        }
        // Append elements to item
        item.appendChild(nameSpan);
        item.appendChild(posSpan);
        listElement.appendChild(item);
    });
}

// Handles click events on object list items, updating the selectedObjectIndex.
// Applies visual selection highlighting by toggling the 'selected' CSS class.
// Stores the clicked object's index in selectedObjectIndex for teleport targeting.
function handleObjectClick() {
    document.querySelectorAll('.object-item').forEach(el => {
        el.classList.remove('selected');
    });
    this.classList.add('selected');
    selectedObjectIndex = parseInt(this.dataset.index);
}

// Creates a randomized textured material for scene objects, with proper UV mapping.
// Uses loaded textures if available (with correct wrapping and encoding),
// or falls back to colored materials with random HSL values.
// Ensures consistent material properties (roughness, metalness) for visual coherence.
function createRandomMaterial(position, uvs, isVertical) {
    // Create a texture from the screenshot if available
    const texture = screenshotTextures.length > 0 
        ? screenshotTextures[Math.floor(Math.random() * screenshotTextures.length)]
        : null;
    // Create a new material
    const material = new THREE.MeshStandardMaterial({
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    // Apply UV mapping
    if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();        
        // Reset any texture transformations
        texture.repeat.set(1, 1);
        texture.offset.set(0, 0);
        texture.center.set(0.5, 0.5);        
        // Remove the rotation here since we're handling it in UV mapping
        texture.rotation = 0;

        material.map = texture;
        material.needsUpdate = true;
    } else {
        material.color.setHSL(Math.random(), 0.7, 0.5);
    }

    return material;
}

// Sets up a fallback scene with basic lighting and a ground plane.
function setupFallbackScene() {
    // Add lights
    const light = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Add floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Add cube
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.y = 0.5;
    scene.add(box);
}

// Main animation loop that updates game state and renders each frame.
// Handles physics steps (player movement, collisions, sphere dynamics),
// camera updates, and scene rendering at the target framerate.
// Uses fixed timestep physics (STEPS_PER_FRAME) for stability.
function animate() {
    requestAnimationFrame(animate);

    // Only update if needed
    if (stats) stats.begin();
    // Cap deltaTime to avoid large jumps
    const deltaTime = Math.min(0.05, clock.getDelta());
    const physicsDeltaTime = deltaTime / STEPS_PER_FRAME;
    
    // Skip updates when tab is not visible
    if (!document.hidden) {
        // Physics updates (using subdivided time)
        if (physicsWorld) {
            for (let i = 0; i < STEPS_PER_FRAME; i++) {
                controls(physicsDeltaTime);
                updatePlayer(physicsDeltaTime);
                physicsWorld.update(physicsDeltaTime, avatar);
                teleportPlayerIfOob();
            }
        }

        // Animation updates (using full frame time)
        if (avatar.mixer) {
            avatar.mixer.update(deltaTime);
        }

        // Camera updates - always use third-person
        if (avatar.character) {
            avatar.updateThirdPersonCamera(camera);
        }

        composer.render(scene, camera);
    }
    
    if (stats) stats.end();
}

// Processes player input and updates avatar movement/animations.
// Translates keyboard states into movement vectors and animations,
// handling jumping, camera-relative movement, and animation transitions.
// Uses deltaTime for frame-rate independent behavior.
// In main.js, update the controls function to ensure jump physics is applied:
function controls(deltaTime) {
    if (!avatar || !avatar.controller) return;

    let currentAzimuth;
    if (avatar.cameraMode === 'thirdPerson') {
        currentAzimuth = avatar.cameraAzimuth;
    } else {
        currentAzimuth = camera.rotation.y;
    }

    const { moveVector, animation } = avatar.controller.update(deltaTime, keyStates, currentAzimuth);
    
    // Apply movement regardless of jump state
    avatar.velocity.x = moveVector.x;
    avatar.velocity.z = moveVector.z;
    
    // Handle jump input - only allow if not currently jumping or forcing completion
    if (keyStates['Space'] && avatar.onFloor && !avatar.isJumping && !avatar.forceJumpCompletion) {
        if (avatar.jump()) {
            console.log("Jump successful");
            return;
        } else {
            console.log("Jump failed");
        }
    }
    
    // Only set ground animations when on floor and not jumping or forcing jump completion
    if (avatar.onFloor && !avatar.isJumping && !avatar.forceJumpCompletion) {
        avatar.setAnimation(animation);
    }
}

    function updatePlayer(deltaTime) {
        // Remove the atRespawnHeight check that forces onFloor=true
        // This was preventing gravity from working
        
        // Store the capsule position BEFORE moving it
        const oldCapsulePosition = new THREE.Vector3().copy(avatar.collider.start);
        
        // Apply gravity if not on floor
        if (!avatar.onFloor) {
            avatar.velocity.y -= GRAVITY * deltaTime;
        }
        
        // Move the player
        const deltaPosition = avatar.velocity.clone().multiplyScalar(deltaTime);
        avatar.collider.translate(deltaPosition);
        
        // Handle collisions - this will set onFloor appropriately
        physicsWorld.playerCollisions(avatar);
        
        // Calculate the actual movement that occurred (after collisions)
        const actualMovement = new THREE.Vector3().subVectors(avatar.collider.start, oldCapsulePosition);
        
        // Update character model position to match the capsule - FIXED
        if (avatar.character) {
            // Position character so feet are at floor level
            avatar.character.position.copy(avatar.collider.start);
            avatar.character.position.y -= avatar.playerRadius; // Move down to floor level
        }
        
        // Don't override jump animation while jumping or forcing completion
        if (avatar.isJumping || avatar.forceJumpCompletion) {
            // Keep jump animation playing - but still allow movement and physics
        }
        
        // Handle falling animation (only if not forcing jump completion)
        if (!avatar.onFloor && !avatar.forceJumpCompletion) {
            avatar.setAnimation('jump');
        } else if (!avatar.forceJumpCompletion) {
            // Only set ground animations when on floor and not forcing jump
            const horizontalVelocity = new THREE.Vector2(avatar.velocity.x, avatar.velocity.z).length();
            if (horizontalVelocity > 8) {
                avatar.setAnimation('run');
            } else if (horizontalVelocity > 0.1) {
                avatar.setAnimation('walk');
            } else {
                avatar.setAnimation('idle');
            }
        }

        avatar.update(deltaTime);
    }

function teleportPlayerIfOob() {
    const currentTime = clock.getElapsedTime();
    
    // Use the avatar's current respawn height instead of the global constant
    const threshold = avatar.respawnHeight - FALL_THRESHOLD;
    
    // Use only third-person check
    if (avatar.collider.start.y <= threshold) {
        if (!isFalling) {
            isFalling = true;
            fallStartTime = currentTime;
        }
        
        if (currentTime - fallStartTime >= RESPAWN_DELAY) {
            resetPlayerPosition();
            isFalling = false;
        }
    } else {
        isFalling = false;
    }
}

function resetPlayerPosition() {
    // Use the avatar's current respawn height
    avatar.collider.start.set(0, avatar.respawnHeight + avatar.playerRadius, 0);
    avatar.collider.end.set(0, avatar.respawnHeight + avatar.playerHeight - avatar.playerRadius, 0);
    
    // Position character to match capsule - FIXED
    if (avatar.character) {
        // Position character so feet are at floor level
        avatar.character.position.copy(avatar.collider.start);
        avatar.character.position.y -= avatar.playerRadius; // Move down to floor level
    }
    
    // Reset physics state
    avatar.velocity.set(0, 0, 0);
    avatar.onFloor = true;
    avatar.isJumping = false;
    avatar.forceJumpCompletion = false;
    
    avatar.setAnimation('idle');
    
    // Always use third-person camera
    avatar.resetThirdPersonCamera(camera);
}

// Remove the toggleCameraMode function completely or replace it with:
function toggleCameraMode() {
    // Always use third-person mode
    avatar.cameraMode = 'thirdPerson';
    avatar.resetThirdPersonCamera(camera);
    
    // Make character visible
    if (avatar.character) {
        avatar.character.visible = true;
    }
}

function resetThirdPersonCamera() {
    if (!avatar.character) return;
    
    avatar.cameraDistance = 5;
    avatar.cameraHeight = 1.5;
    avatar.cameraAzimuth = avatar.character.rotation.y + Math.PI;
    avatar.cameraPolar = Math.PI / 3;
    
    const spherical = new THREE.Spherical();
    spherical.radius = avatar.cameraDistance;
    spherical.phi = avatar.cameraPolar;
    spherical.theta = avatar.cameraAzimuth;

    const offset = new THREE.Vector3();
    offset.setFromSpherical(spherical);

    avatar.cameraTarget.copy(avatar.character.position);
    avatar.cameraTarget.y += avatar.cameraHeight;
    
    camera.position.copy(avatar.cameraTarget).add(offset);
    camera.lookAt(avatar.cameraTarget);
}


document.body.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        // Only handle third-person camera control
        avatar.cameraAzimuth -= event.movementX / 500;
        avatar.cameraPolar = THREE.MathUtils.clamp(
            avatar.cameraPolar - (event.movementY / 500),
            0.1,  // Min angle
            Math.PI - 0.1  // Max angle
        );
    }
});

window.addEventListener('resize', onWindowResize);

// Handles window resize events to maintain proper rendering proportions.
// Updates camera aspect ratio and viewport dimensions to prevent distortion.
// Ensures consistent rendering across different screen sizes.
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update post-processing
    effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Sets up the click handler for objects in the scene.
function setupObjectClickHandler() {
    document.addEventListener('click', (event) => {
        if (!highlightEffectEnabled || !highlightedObject) return;
        if (!document.body.classList.contains('clickable')) return;
        
        event.preventDefault();
        
        // Get texture URL
        let texture = highlightedObject.material;
        if (Array.isArray(texture)) texture = texture[0];
        texture = texture.map;
        // Get texture URL
        if (texture && textureUrls.has(texture)) {
            const url = textureUrls.get(texture);
            
            // Reset state but keep Alt mode active
            const tempHighlight = highlightEffectEnabled;
            resetHighlightEffect();
            highlightEffectEnabled = tempHighlight;
            document.body.classList.add('highlight-mode');
            
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    });
}

// Initializes all application event listeners including:
// - Keyboard controls (movement, debug, UI)
// - Mouse interactions (pointer lock, camera control)
// - Window events (resize handling)
// - Special key bindings (teleport UI, camera mode toggle)
function setupEventListeners() {
    const container = document.getElementById('container');

    // Keyboard controls
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Eescape') {
            document.exitPointerLock();
            document.body.style.cursor = 'auto';
        }
        if (event.code === 'KeyT') {
            toggleTeleportWindow();
            document.body.style.cursor = 'auto';
            return;
        }
        
        // if (event.code === 'KeyV') toggleCameraMode();
        keyStates[event.code] = true;
        
    });

    document.addEventListener('keyup', (event) => {
        keyStates[event.code] = false;
    });

    // Mouse down event to request pointer lock
    container.addEventListener('mousedown', () => {
        document.body.requestPointerLock();
        mouseTime = performance.now();
    });
    // Mouse up event to release pointer lock
    document.addEventListener('mouseup', () => {
        if (document.pointerLockElement !== null) throwBall();
    });

    // Handle pointer lock change
    document.addEventListener('pointerlockchange', () => {
        // Check if pointer lock is active
        if (document.pointerLockElement === document.body) {
            // Pointer lock is active
            if (highlightEffectEnabled) {
                document.body.classList.add('highlight-mode');
                // Check if highlighted object has a texture URL
                if (highlightedObject && highlightedObject.material.map && textureUrls.has(highlightedObject.material.map)) {
                    document.body.classList.add('clickable');
                }
            } else {
                // Not in highlight mode
                document.body.style.cursor = 'none';
            }
        } else {
            // Pointer lock is inactive
            document.body.classList.remove('highlight-mode', 'clickable');
            document.body.style.cursor = 'auto';
        }
    });
    // End pointer lock change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && highlightEffectEnabled) {
            highlightEffectEnabled = false;
            keyStates['AltLeft'] = false;
            resetHighlightEffect();
            document.body.classList.remove('highlight-mode', 'clickable');
        }
        });

    // Alt to highlight objects
    document.addEventListener('keydown', function(event) {
        keyStates[event.code] = true;
        // Check if Alt is pressed
        if (event.code === 'AltLeft') {
            highlightEffectEnabled = true;
            document.body.classList.add('highlight-mode');
            // Force update even without mouse movement
            const mouse = new THREE.Vector2(
                (renderer.domElement.width/2) / window.innerWidth * 2 - 1,
                -(renderer.domElement.height/2) / window.innerHeight * 2 + 1
            );
            // Force update even without mouse movement to make sure object stays highlighted if holding Alt
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(worldObjects.children, true);
            if (intersects.length > 0) {
                applyHighlightEffect(intersects[0].object);
            }
        }
    });
    // End Alt key highlight
    document.addEventListener('keyup', function(event) {
        keyStates[event.code] = false;
        if (event.code === 'AltLeft') {
            highlightEffectEnabled = false;
            resetHighlightEffect();
            document.body.classList.remove('highlight-mode', 'clickable');
        }
    });
    
    // detect objects under cursor - Raycaster
    document.addEventListener('mousemove', (event) => {
    if (!highlightEffectEnabled) return;
    
    // Check if mouse moved enough
    if (Math.abs(event.clientX - lastMouseX) < MOUSE_DEADZONE && 
        Math.abs(event.clientY - lastMouseY) < MOUSE_DEADZONE) {
        return;
    }

    // Update last mouse position
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    // Create a raycaster from the camera
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Improved intersection detection:
    raycaster.params.Points.threshold = 0.1; // For point-like objects
    raycaster.params.Line.threshold = 0.1;   // For line-like objects

    // Check for intersections
    const intersects = raycaster.intersectObjects(worldObjects.children, true);

    // hysteresis to prevent flickering between objects
    if (intersects.length > 0) {
        const now = performance.now();
        const bestIntersect = intersects[0];
        
        // If we have a current highlighted object
        if (highlightedObject) {
            const currentIndex = intersects.findIndex(i => i.object === highlightedObject);
            
            // If current object is still in the list and we're not past hysteresis delay
            if (currentIndex >= 0 && (now - lastHighlightTime < HIGHLIGHT_HYSTERESIS)) {
                // Keep the current highlight
                return;
            }
        }
        
        // Only change highlight if it's a different object
        if (!highlightedObject || highlightedObject !== bestIntersect.object) {
            applyHighlightEffect(bestIntersect.object); // This maintains dimming
        }
        } else if (highlightedObject) {
            // Only reset if we had something highlighted
            resetHighlightEffect();
        }
    });

    // Mouse controls
    container.addEventListener('mousedown', () => {
    document.body.requestPointerLock();
    });

    window.addEventListener('resize', onWindowResize);

    // Continuous Alt check - modified to maintain dimming
    function checkAltKeyState() {
        //
        if (highlightEffectEnabled) {
            if (!keyStates['AltLeft']) {
                // Alt was released
                highlightEffectEnabled = false;
                resetHighlightEffect();
                document.body.classList.remove('highlight-mode', 'clickable');
            } else if (!highlightedObject) {
                // Alt is held but no object highlighted - recheck
                const mouse = new THREE.Vector2(
                    (renderer.domElement.width/2) / window.innerWidth * 2 - 1,
                    -(renderer.domElement.height/2) / window.innerHeight * 2 + 1
                );
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(worldObjects.children, true);
                // Check if we hit anything
                if (intersects.length > 0) {
                    applyHighlightEffect(intersects[0].object);
                }
            }
        }
        requestAnimationFrame(checkAltKeyState);
    }
    checkAltKeyState();
}

// Toggle Teleport windows with mouse click or using 'T' key
function toggleTeleportWindow() {
    const list = document.getElementById('object-list');
    // Check if list exists
    if (!list) return;
    // Toggle visibility
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    // Update teleport button visibility
    if (isHidden) {
        updateObjectList();
        // Exit Pointer Lock when showing the UI
        if (document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }
    }
}

// Apply highlight effect to the object
function applyHighlightEffect(object) {
    if (highlightedObject === object) return;
    
    resetHighlightEffect();
    
    highlightedObject = object;
    
    // Outline effect (existing code)
    const bbox = new THREE.Box3().setFromObject(object);
    const size = bbox.getSize(new THREE.Vector3()).length();
    outlinePass.edgeStrength = size < 1.0 ? 5.0 : 3.0;
    outlinePass.selectedObjects = [object];
    
    // Restore dimming effect
    worldObjects.traverse((child) => {
        if (!child.isMesh || child === object || !child.material) return;
        
        if (!originalMaterials.has(child)) {
            originalMaterials.set(child, child.material);
        }
        
        const desatMaterial = child.material.clone();
        desatMaterial.color.setHSL(0, 0, 0.3); // Dimming effect
        child.material = desatMaterial;
    });
    
    // Check if object has a clickable texture
    const hasClickableTexture = object.material.map && textureUrls.has(object.material.map);
    
    // Update cursor classes
    document.body.classList.add('highlight-mode');
    if (hasClickableTexture) {
        document.body.classList.add('clickable');
    } else {
        document.body.classList.remove('clickable');
    }
    
    // Add clickable class if texture has URL
    document.body.classList.toggle('clickable', hasClickableTexture);
    
    // raycaster precision for small objects
    worldObjects.traverse((child) => {
        // Check if child is a mesh
        if (child.isMesh) {
            // Increase precision for small objects
            if (child.geometry.boundingSphere) {
                const radius = child.geometry.boundingSphere.radius;
                if (radius < 1.0) { // Adjust threshold as needed
                    child.raycast = function(raycaster, intersects) {
                        const geometry = this.geometry;
                        const matrixWorld = this.matrixWorld;
                        
                        // Use more precise raycasting for small objects
                        const threshold = raycaster.params.Points.threshold;
                        raycaster.params.Points.threshold = 0.5; // Increased threshold
                        
                        // Call original raycast
                        THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
                        
                        // Restore threshold
                        raycaster.params.Points.threshold = threshold;
                    };
                }
            }
        }
    });
}
// Updated reset function
function resetHighlightEffect() {
    if (!highlightedObject) return;
    
    // Clear cursor classes
    document.body.classList.remove('clickable');
    if (!highlightEffectEnabled) {
        document.body.classList.remove('highlight-mode');
    }
    
    // Remove clickable class
    document.body.classList.remove('clickable');
    
    // Clear outline selection
    outlinePass.selectedObjects = [];

    // Restore original materials
    worldObjects.traverse((child) => {
        if (originalMaterials.has(child)) {
            child.material = originalMaterials.get(child);
            originalMaterials.delete(child);
        }
    });
    
    highlightedObject = null;
}

// Add this to your main.js for testing
function testCapsuleAlignment() {
    if (avatar && avatar.verifyCapsuleAlignment) {
        const isAligned = avatar.verifyCapsuleAlignment();
        
        if (avatar.debugCapsuleMesh) {
        }
    }
}

// Call this after initialization and periodically to verify
setTimeout(testCapsuleAlignment, 1000);
//setInterval(testCapsuleAlignment, 5000); // Check every 5 seconds

// Loads screenshot textures from predefined domains
async function loadScreenshotTextures() {
  const textureLoader = new THREE.TextureLoader();
  screenshotTextures = [];
  
  // Show loading overlay
  const loadingOverlay = document.getElementById('loading-overlay');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  // Update progress function
  const updateProgress = (loaded, total) => {
    const percent = Math.round((loaded / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${loaded}/${total} loaded`;
  };

  // Process all domains
  for (let i = 0; i < screenshotDomains.length; i++) {
    const domain = screenshotDomains[i];
    const url = `https://screenshotof.com/${domain}`;
    const websiteUrl = `https://${domain}`;
    
    try {
      const texture = await new Promise((resolve) => {
        textureLoader.load(
          url,
          (texture) => {
            // Check if texture is valid
            if (!texture.image || texture.image.width === 0) {
              const fallback = createColoredFallbackTexture();
              const fallbackTexture = new THREE.CanvasTexture(fallback);
              textureUrls.set(fallbackTexture, websiteUrl);
              resolve(fallbackTexture);
              return;
            }
            // Texture is valid
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            textureUrls.set(texture, websiteUrl);
            resolve(texture);
          },
          undefined,
          (error) => {
            console.error('Error loading texture:', url, error);
            const fallback = createColoredFallbackTexture();
            const fallbackTexture = new THREE.CanvasTexture(fallback);
            textureUrls.set(fallbackTexture, websiteUrl);
            resolve(fallbackTexture);
          }
        );
      });
      // Add texture to the list
      screenshotTextures.push(texture);
      updateProgress(i + 1, screenshotDomains.length);
    } catch (error) {
      console.error('Error loading texture:', error);
      // Still count as loaded (fallback will be used)
      updateProgress(i + 1, screenshotDomains.length);
    }
  }
  
  // Hide loading overlay when done
  loadingOverlay.style.display = 'none';
}

// Main initialization function that sets up the entire Three.js application:
// 1. Creates core Three.js components (scene, camera, renderer)
// 2. Loads assets (JSON data, textures, character model)
// 3. Initializes game systems (physics, controls, UI)
// 4. Configures lighting and world geometry
// 5. Starts the animation loop
async function init() {
    try {
        // Create and configure stats FIRST
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        stats.domElement.style.left = '0px';
        document.getElementById('container').appendChild(stats.domElement);

        // Create basic Three.js components
        scene = new THREE.Scene();
        //scene.background = new THREE.Color(0x88ccee);
        scene.fog = new THREE.Fog(0xfffae6, 0, 750); //color, near, far

        // Camera setup - position it at the player's head
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 500);
        camera.rotation.order = 'YXZ';

        // Initialize physics world FIRST
        physicsWorld = new PhysicsWorld(scene);
        
        // Setup player and load character
        setupPlayer();
        await avatar.loadCharacter('./src/models/Cubetonian_250825.glb');
        avatar.clock = clock;

        // Set to third-person mode explicitly
        avatar.cameraMode = 'thirdPerson';
        avatar.resetThirdPersonCamera(camera);

        // Debug capsule
        avatar.debugCapsule();

        // Reset state after character is loaded
        avatar.resetState();

        // Setup spheres (now physicsWorld is initialized)
        setupSpheres();

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: false
        });
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        document.getElementById('container').appendChild(renderer.domElement);

        // Loader for HDR environment map
        const loader = new RGBELoader();
        loader.load('./src/hdri/qwantani_afternoon_2k.hdr', (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.background = texture;

                camera.position.z = 20;

                function animate() {
                    requestAnimationFrame(animate);
                    renderer.render(scene, camera);
                }
                animate();
            }, undefined, (error) => {
                console.error('Error loading HDR texture:', error);
            });

        // Handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Set up post-processing
        composer = new EffectComposer(renderer);
        renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Outline pass setup
        outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            scene,
            camera
        );

        // Pink outline configuration
        outlinePass.visibleEdgeColor.set(0xff69b4); // Pink color
        outlinePass.hiddenEdgeColor.set(0xff1493); // Darker pink
        outlinePass.edgeStrength = 3.0; // Line thickness
        outlinePass.edgeGlow = 0.5; // Glow intensity
        outlinePass.edgeThickness = 1.0; // Edge thickness
        outlinePass.pulsePeriod = 0; // No pulsation

        composer.addPass(outlinePass);

        // Optional: Anti-aliasing
        effectFXAA = new ShaderPass(FXAAShader);
        effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
        composer.addPass(effectFXAA);

        // Load assets FIRST
        threejsData = await loadJSON();
        objectsData = threejsData; // Ensure objectsData is set

        // Load screenshot textures before creating objects
        await loadScreenshotTextures();

        // THEN create the UI elements
        createObjectListWindow(); // This must come first
        setupTeleportButton();

        // Add toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-object-list';
        toggleBtn.textContent = 'Teleport'; 
        toggleBtn.style.pointerEvents = 'auto';
        toggleBtn.style.zIndex = '101'; // Ensure it's above the list
        //toggleBtn.style.display = 'none'; // Hide by default
        toggleBtn.addEventListener('click', toggleTeleportWindow);
        document.body.appendChild(toggleBtn);

        // Initialize world
        worldOctree = new Octree();
        worldObjects = new THREE.Group();

        // Create world objects
        threejsData.objects.forEach(objData => {
          if (!objData.vertices) return;
            
          // Create or reuse geometry
          const geometryKey = objData.vertices.join('|');
          let geometry = geometryCache[geometryKey];
          // Check if geometry exists
          if (!geometry) {
              geometry = new THREE.BufferGeometry();
              geometry.setAttribute('position', new THREE.Float32BufferAttribute(objData.vertices, 3));
              geometryCache[geometryKey] = geometry;
          }
          // Set indices if available
          if (objData.indices?.length > 0) {
            geometry.setIndex(objData.indices);
          }

            // In your object creation loop, replace the UV generation with:
            // Get geometry data (only declare these once per object)
            geometry.computeBoundingBox();
            const boundingBox = geometry.boundingBox;
            const size = new THREE.Vector3();
            boundingBox.getSize(size);

            // Calculate plane normal (using first triangle)
            const positions = geometry.attributes.position.array; // Only declare this once
            const normal = new THREE.Vector3();
            const vA = new THREE.Vector3().fromArray(positions, 0);
            const vB = new THREE.Vector3().fromArray(positions, 3);
            const vC = new THREE.Vector3().fromArray(positions, 6);
            vB.sub(vA);
            vC.sub(vA);
            normal.crossVectors(vB, vC).normalize();

            // Determine dominant axis
            const absNormal = new THREE.Vector3(
                Math.abs(normal.x),
                Math.abs(normal.y),
                Math.abs(normal.z)
            );
            const maxComponent = Math.max(absNormal.x, absNormal.y, absNormal.z);
            const isVertical = absNormal.y !== maxComponent;

            // Generate UVs
            const uvs = [];
            for (let i = 0; i < positions.length; i += 3) {
                // Get UV coordinates based on the dominant axis
                if (isVertical) {
                    // YZ plane (wall primarily facing X)
                    if (absNormal.x > absNormal.z) {
                        const u = (positions[i+1] - boundingBox.min.y) / size.y;
                        const v = (positions[i+2] - boundingBox.min.z) / size.z;
                        
                        // Check if it's perfectly X-axis aligned (normal ≈ (1,0,0))
                        if (Math.abs(normal.x) > 0.99) {
                            // X-axis aligned wall - apply -90° rotation
                            uvs.push(1 - v, u);
                        } else {
                            // Not perfectly X-aligned - keep original
                            uvs.push(u, v);
                        }
                    } else {
                        // XY plane (wall primarily facing Z)
                        const u = (positions[i] - boundingBox.min.x) / size.x;
                        const v = (positions[i+1] - boundingBox.min.y) / size.y;
                        
                        // Z-axis aligned walls keep original orientation
                        uvs.push(u, v);
                    }
                } else {
                    // Horizontal planes - standard XZ mapping
                    uvs.push(
                        (positions[i] - boundingBox.min.x) / size.x,
                        (positions[i+2] - boundingBox.min.z) / size.z
                    );
                }
            }
            // Set UVs
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

            // Recompute normals if needed
            geometry.computeVertexNormals();

            // After creating geometry, add this to fix vertical planes rotation
            geometry.computeVertexNormals();

            // Access normals array
            const normals = geometry.attributes.normal.array;

            // Re-order vertices to ensure consistent winding for vertical planes
            if (isVertical) {
                // Find dominant normal axis
                const absNormal = new THREE.Vector3(
                    Math.abs(normal.x),
                    Math.abs(normal.y),
                    Math.abs(normal.z)
                );
                // Determine winding order
                if (absNormal.x > absNormal.z) {
                    // For X-facing walls, ensure vertices are ordered clockwise when viewed from front
                    // (Add your vertex reordering logic here)
                } else {
                    // For Z-facing walls, ensure consistent ordering
                    // (Add your vertex reordering logic here)
                }
                // Recompute normals after reordering
                geometry.computeVertexNormals();
            }
            // Get position safely
            const position = new THREE.Vector3(
                objData.position?.[0] || 0,
                objData.position?.[1] || 0,
                objData.position?.[2] || 0
            );

            // Create material with position and UVs
            const material = createRandomMaterial(position, objData.uvs, isVertical);
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.rotation.set(
                objData.rotation?.[0] || 0,
                objData.rotation?.[1] || 0,
                objData.rotation?.[2] || 0
            );
            mesh.scale.set(
                objData.scale?.[0] || 1,
                objData.scale?.[1] || 1,
                objData.scale?.[2] || 1
            );
            mesh.castShadow = objData.castShadow !== false;
            mesh.receiveShadow = objData.receiveShadow !== false;
            worldObjects.add(mesh);
        });

        // Update physics world with the created objects
        physicsWorld.initWorld(worldObjects);

        // Add world to scene
        scene.add(worldObjects);
        worldOctree.fromGraphNode(worldObjects);

        // Setup spheres
        setupSpheres();

        // Setup lights
        setupLights();

        // Set initial camera position
        if (avatar.character) {
            avatar.updateThirdPersonCamera(camera);
        }

        // Setup event listeners
        setupEventListeners();
        setupObjectClickHandler();

        // Start animation
        animate();

        renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.warn('WebGL context lost');
            // Add recovery logic here if needed
        }, false);

        renderer.domElement.addEventListener('mouseleave', () => {
            if (highlightEffectEnabled) {
                // Keep effect active but remove clickable state
                document.body.classList.remove('clickable');
            }
        });

        renderer.domElement.addEventListener('mouseenter', () => {
            if (highlightEffectEnabled && highlightedObject) {
                // Restore clickable state if applicable
                const hasClickableTexture = highlightedObject.material.map && 
                                        textureUrls.has(highlightedObject.material.map);
                document.body.classList.toggle('clickable', hasClickableTexture);
            }
        });

    } catch (error) {
        console.error('Initialization failed:', error);
        setupFallbackScene();
        animate();
    }
}

function cleanup() {
    // Check if worldObjects exists and has children before trying to traverse it
    if (!worldObjects || !worldObjects.children) return;
    
    // Dispose geometries, materials
    worldObjects.traverse(child => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m && m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    });
    
    // Cleanup physics
    if (physicsWorld && typeof physicsWorld.cleanup === 'function') {
        physicsWorld.cleanup();
    }
    
    // Cleanup avatar animations
    if (avatar && typeof avatar.cleanup === 'function') {
        avatar.cleanup();
    }
}

// Call on window unload
window.addEventListener('beforeunload', cleanup);

init();