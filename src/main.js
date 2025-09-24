import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import Stats from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/stats.module.js';
import { Octree } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/math/Octree.js';
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/shaders/FXAAShader.js';
import { Avatar } from './avatar.js';
import { PhysicsWorld, createPhysicsSphere, GRAVITY, SPHERE_RADIUS, STEPS_PER_FRAME } from './physics.js';
import { initMobileControls } from './mobileControls.js';
import { screenshotDomains } from './screenshotDomains.js';
import { 
    initHighlightEffect, 
    applyHighlightEffect, 
    resetHighlightEffect, 
    handleHighlightMouseMove,
    setHighlightEffectEnabled,
    isHighlightEffectEnabled,
    getHighlightedObject,
    hasClickableHighlight
} from './highlightEffect.js';

const NUM_SPHERES = 25; // Number of spheres to create
const PLAYER_HEIGHT = 1.8; // Height of the player capsule
const PLAYER_RADIUS = 0.35; // Radius of the player capsule
const RESPAWN_HEIGHT = 10; // Height at which the player respawns
const FALL_THRESHOLD = 20; // Height difference to trigger respawn
const RESPAWN_DELAY = 8.0; // Delay before respawning

// Global variables
let threejsData = { objects: [] }
let scene, camera, renderer, worldOctree, worldObjects;
let stats;
let clock = new THREE.Clock(); 
let objectsData = []; 
let selectedObjectIndex = -1; 
let composer;
let outlinePass;
let renderPass;
let effectFXAA;
let textureUrls = new Map(); // Stores texture-to-url mappings

let gravityEnabled = true;
let physicsWorld;
let avatar;
let spheres = [];
let sphereIdx = 0;

let respawnCooldown = false;
const RESPAWN_COOLDOWN_TIME = 1.0; // 1 second cooldown

let screenshotTextures = [];

// Water effect variables
let waterMaterials = [];
let waterTime = 0;

// Load object/geometry data from JSON file
async function loadObjectsData() {
    try {
        const response = await fetch('./threejs_export.json');
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

// Utility vectors - Reusable temporary vectors for physics/collision calculations  
// (Avoids frequent allocations in loops for better performance)  
const vector1 = new THREE.Vector3();

// Loads scene data from threejs_export.json, falling back to a simple default scene if the file is missing or invalid.
// Returns a Promise resolving to the parsed JSON data containing object geometries, positions, and other properties.
async function loadJSON() {
    try {
        const response = await fetch('./threejs_export.json');
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

function setupPlayer() {
    avatar = new Avatar(scene, RESPAWN_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS);
    
    // Force the avatar to start falling immediately
    avatar.onFloor = false;
    avatar.velocity.y = -0.5; // Small initial downward velocity
    
    // Explicitly set position to (0,0,0)
    const capsuleHeight = avatar.collider.end.y - avatar.collider.start.y;
    avatar.collider.start.set(0, avatar.playerRadius, 0);
    avatar.collider.end.set(0, avatar.playerRadius + capsuleHeight, 0);
    
    if (avatar.character) {
        avatar.character.position.set(0, 0, 0);
    }
}

function setupSpheres() {
    if (!physicsWorld) {
        console.error("Physics world not initialized");
        return;
    }

    // Change from MeshLambertMaterial to MeshStandardMaterial
    const sphereMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xdede8d,
        roughness: 0.3,      // Less rough for more reflection
        metalness: 0.7       // More metallic to reflect environment
    });

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
// Function to throw a ball from the avatar's position in the camera's look direction
function throwBall() {
    const sphere = spheres[sphereIdx];
    
    // Create a direction vector from the camera instead of using avatar.direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    sphere.collider.center.copy(avatar.collider.end)
        .addScaledVector(direction, avatar.collider.radius * 1.5);

    // Increased impulse from 15 to 25 for longer travel distance
    const impulse = 100; 
    sphere.velocity.copy(direction).multiplyScalar(impulse);
    sphere.velocity.addScaledVector(avatar.velocity, 2);

    sphereIdx = (sphereIdx + 1) % spheres.length;
}

// Gravity indicator
function createGravityIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'gravity-indicator';
    indicator.textContent = 'GRAVITY ON';
    indicator.addEventListener('click', toggleGravity);
    
    // Add proper styling classes - let CSS handle the positioning
    indicator.classList.add('action-button');
    
    // Add hover effects
    indicator.addEventListener('mouseenter', function() {
        if (gravityEnabled) {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 0 10px rgba(0, 136, 255, 0.5)';
            this.style.backgroundColor = 'rgba(0, 100, 200, 0.9)';
        } else {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
            this.style.backgroundColor = 'rgba(128, 0, 0, 0.9)';
        }
    });

    indicator.addEventListener('mouseleave', function() {
        this.style.transform = '';
        this.style.boxShadow = '';
        if (gravityEnabled) {
            this.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
        } else {
            this.style.backgroundColor = 'rgba(128, 0, 0, 0.7)';
        }
    });
    
    document.body.appendChild(indicator);
    return indicator;
}

function toggleGravity() {
    gravityEnabled = !gravityEnabled;
    avatar.gravityEnabled = gravityEnabled; 
    
    // Reset vertical velocity when switching modes
    avatar.velocity.y = 0;
    
    // Update visual indicator
    const gravityIndicator = document.getElementById('gravity-indicator');
    if (gravityIndicator) {
        if (gravityEnabled) {
            gravityIndicator.textContent = 'GRAVITY ON';
            gravityIndicator.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
            gravityIndicator.style.borderColor = '#0088ff';
            gravityIndicator.style.color = 'white';
            gravityIndicator.classList.remove('off');
        } else {
            gravityIndicator.textContent = 'GRAVITY OFF';
            gravityIndicator.style.backgroundColor = 'rgba(128, 0, 0, 0.7)';
            gravityIndicator.style.borderColor = '#ff0000';
            gravityIndicator.style.color = 'white';
            gravityIndicator.classList.add('off');
        }
    }
    
    // Reset jumping state when gravity is disabled
    if (!gravityEnabled && avatar.isJumping) {
        avatar.isJumping = false;
        avatar.setAnimation('fly');
    } else if (!gravityEnabled) {
        avatar.setAnimation('fly');
    } else {
        const { animation } = avatar.controller.update(0.016, keyStates, avatar.cameraAzimuth);
        avatar.setAnimation(animation);
    }
    
    if (!gravityEnabled) {
        avatar.velocity.y = 0;
    } else {
        avatar.onFloor = false;
        avatar.velocity.y = -1.0;
    }
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
        // Add visual feedback
        this.classList.add('clicked');

        if (selectedObjectIndex === -1) {
            // Remove clicked state after short delay
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 300);
            return;
        }
        
        const objData = objectsData.objects[selectedObjectIndex];
        if (!objData) {
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 300);
            return;
        }
        
        if (!objData.position) {
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 300);
            return;
        }
        
        // Teleport player to object position
        const targetX = objData.position[0] || 0;
        const targetY = (objData.position[1] || 0) + avatar.playerRadius;
        const targetZ = objData.position[2] || 0;
        
        // Update physics capsule
        avatar.collider.start.set(targetX, targetY, targetZ);
        avatar.collider.end.set(targetX, targetY + (avatar.playerHeight - 2 * avatar.playerRadius), targetZ);
        
        // Update character position
        if (avatar.character) {
            avatar.character.position.set(targetX, targetY - avatar.playerRadius, targetZ);
        }
        
        // KEEP falling physics state instead of resetting it
        // Only reset horizontal velocity, keep vertical velocity for falling
        avatar.velocity.x = 0;
        avatar.velocity.z = 0;
        // DON'T set onFloor to true - keep it false so avatar continues falling
        // avatar.onFloor = true; // REMOVE THIS LINE
        
        // If gravity is enabled, give a small downward push to ensure falling continues
        if (gravityEnabled) {
            avatar.velocity.y = -0.5; // Small downward velocity
        }
        
        // Update camera
        if (avatar.cameraMode === 'thirdPerson') {
            avatar.resetThirdPersonCamera(camera);
        }
        
        // Visual feedback for successful teleport
        this.classList.remove('clicked');
        this.classList.add('success');
        
        // Revert to normal state after 1 second
        setTimeout(() => {
            this.classList.remove('success');
            this.style.transform = '';
            this.style.boxShadow = '';
            this.style.backgroundColor = 'rgba(0,0,0,0.7)';
        }, 1000);
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
    container.style.display = 'none'; // Hidden by default

    // Get the existing header from HTML
    const header = document.getElementById('object-list-header');
    
    // Create teleport button and add it to the header
    const teleportBtn = document.createElement('button');
    teleportBtn.id = 'teleport-button';
    teleportBtn.textContent = 'GO!';
    teleportBtn.style.display = 'none'; // Hidden initially
    
    // Position the button in the header
    teleportBtn.style.position = 'absolute';
    teleportBtn.style.right = '10px';
    teleportBtn.style.top = '10px';
    teleportBtn.style.padding = '6px 10px';
    teleportBtn.style.fontSize = '10px';
    teleportBtn.style.borderRadius = '4px';
    
    header.appendChild(teleportBtn);
    
    // Move the header into the container
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
    
    // Add search functionality
    setupSearchFunctionality();
    
    // Setup teleport button functionality
    setupTeleportButton();
}
function setupSearchFunctionality() {
    const searchInput = document.getElementById('object-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        filterObjectList(this.value.toLowerCase());
    });
    
    searchInput.addEventListener('keydown', function(e) {
        // Prevent Enter key from submitting forms or doing other actions
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });
}

// Add this function to main.js
function toggleMobileControls() {
    const mobileControls = document.getElementById('mobile-controls');
    const actionButtons = document.getElementById('action-buttons-container');
    const toggleBtn = document.getElementById('toggle-controls-button');
    
    if (!mobileControls || !actionButtons || !toggleBtn) return;
    
    const isHidden = mobileControls.style.display === 'none' || 
                    mobileControls.style.display === '';
    
    // Toggle visibility
    mobileControls.style.display = isHidden ? 'block' : 'none';
    actionButtons.style.display = isHidden ? 'flex' : 'none';
    
    // Update button state and text
    if (isHidden) {
        toggleBtn.classList.add('active');
        toggleBtn.textContent = 'Controls';
    } else {
        toggleBtn.classList.remove('active');
        toggleBtn.textContent = 'Controls';
    }
}

function filterObjectList(searchTerm) {
    const items = document.querySelectorAll('.object-item');
    let hasMatches = false;
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (searchTerm === '' || text.includes(searchTerm)) {
            item.style.display = 'flex';
            hasMatches = true;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Show a "no results" message if no matches found
    const noResults = document.getElementById('no-results-message');
    if (!hasMatches && searchTerm !== '') {
        if (!noResults) {
            const listElement = document.getElementById('object-list-items');
            const noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'no-results-message';
            noResultsMsg.className = 'no-results';
            noResultsMsg.textContent = 'No websites found matching your search';
            listElement.appendChild(noResultsMsg);
        }
    } else if (noResults) {
        noResults.remove();
    }
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
    
    listElement.innerHTML = '';
    
    // Get current search term
    const searchInput = document.getElementById('object-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    // Create object items
    objectsData.objects.forEach((objData, index) => {
        // Try to get the texture URL for this object
        let displayText = `Object_${index}`;
        
        // If we have a mesh for this object, try to get its texture URL
        if (worldObjects && worldObjects.children[index]) {
            const mesh = worldObjects.children[index];
            if (mesh.isMesh) {
                let material = mesh.material;
                if (Array.isArray(material)) material = material[0];
                
                if (material && material.map && textureUrls.has(material.map)) {
                    const url = textureUrls.get(material.map);
                    // Extract just the domain for display
                    try {
                        const domain = new URL(url).hostname;
                        displayText = domain;
                    } catch (e) {
                        displayText = url; // Fallback to full URL if parsing fails
                    }
                }
            }
        }
        
        // Check if this item matches the search term
        const isVisible = searchTerm === '' || displayText.toLowerCase().includes(searchTerm);
        
        const item = document.createElement('div');
        item.className = `object-item ${selectedObjectIndex === index ? 'selected' : ''}`;
        item.dataset.index = index;
        item.style.display = isVisible ? 'flex' : 'none';
        
        // Add click event listener
        item.onclick = handleObjectClick;
        
        // Create name span with URL
        const nameSpan = document.createElement('span');
        nameSpan.className = 'object-name';
        nameSpan.textContent = displayText;
        nameSpan.title = displayText; // Add tooltip with full text
        
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
    
    // Show "no results" message if needed
    if (searchTerm !== '') {
        const visibleItems = document.querySelectorAll('.object-item[style="display: flex"]');
        if (visibleItems.length === 0) {
            const noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'no-results-message';
            noResultsMsg.className = 'no-results';
            noResultsMsg.textContent = 'No websites found matching your search';
            listElement.appendChild(noResultsMsg);
        }
    }
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
function createRandomMaterial(position, uvs, isVertical, objData) {
    // Check if this is the ground object at (0,0,0)
    const isGroundAtOrigin = position.x === 0 && position.y === 0 && position.z === 0;
    
    // Check if this is the object named "zGround"
    const isZGround = objData.name && objData.name.toLowerCase() === 'zground';
    
    // Create texture loader
    const textureLoader = new THREE.TextureLoader();
    
    // Use specific textures for specific objects
    if (isGroundAtOrigin) {
        // Load grass texture for object at (0,0,0)
        const grassTexture = textureLoader.load('./src/images/grass.png');
        grassTexture.wrapS = THREE.RepeatWrapping;
        grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        
        return new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide,
            shadowSide: THREE.FrontSide,  // ADD THIS LINE
            transparent: false           // ADD THIS LINE
        });
    } else if (isZGround) {
        // Load water texture
        const waterTexture = textureLoader.load('./src/images/water.png');
        waterTexture.wrapS = THREE.RepeatWrapping;
        waterTexture.wrapT = THREE.RepeatWrapping;
        waterTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        
        // Water material optimized for maximum HDRI reflections
        const waterMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, // Neutral white - HDRI provides all color
            map: waterTexture,
            roughness: 0.05,   // Very smooth surface for sharp reflections
            metalness: 0.9,    // High metalness for strong reflections
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,     // Slightly more transparent to show reflections
            envMapIntensity: 2.5, // BOOSTED: Much stronger environment reflections
            transmission: 0.2,    // Reduced transmission to prioritize reflections
            thickness: 0.3,       // Thinner for better surface reflections
            specularIntensity: 1.2, // Enhanced specular highlights
            clearcoat: 0.5,       // Adds extra reflective layer
            clearcoatRoughness: 0.1, // Smooth clearcoat for better reflections
            shadowSide: THREE.FrontSide  // ADD THIS LINE
        });
        
        // Store reference for animation
        waterMaterial.userData = {
            isWater: true,
            texture: waterTexture,
            time: 0,
            speed: 0.0015 // Even slower for calmer water
        };
        
        waterMaterials.push(waterMaterial);
        return waterMaterial;
    }
    
    // Default behavior for all other objects
    const texture = screenshotTextures.length > 0 
        ? screenshotTextures[Math.floor(Math.random() * screenshotTextures.length)]
        : null;
    
    // FIXED: Added missing comma and proper property formatting
    const material = new THREE.MeshStandardMaterial({
        roughness: 0.7,
        metalness: 0.1, // Add slight metalness to benefit from HDRI reflections
        side: THREE.DoubleSide,
        shadowSide: THREE.FrontSide,  // ADD THIS LINE
        transparent: false            // ADD THIS LINE
    });
    
    if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.repeat.set(1, 1);
        texture.offset.set(0, 0);
        texture.center.set(0.5, 0.5);
        texture.rotation = 0;

        material.map = texture;
        material.needsUpdate = true;
    } else {
        material.color.setHSL(Math.random(), 0.7, 0.5);
    }

    return material;
}

// Create a simple water normal map
function createSimpleWaterNormalMap() {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    
    // Create a wavy normal map pattern
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = (y * size + x) * 4;
            
            // Create wave patterns using sine waves
            const wave1 = Math.sin(x / 25 + y / 30) * 0.5 + 0.5;
            const wave2 = Math.cos(x / 20 - y / 15) * 0.5 + 0.5;
            
            // Combine waves for more natural pattern
            const normalX = wave1 * 0.6 + wave2 * 0.4;
            const normalY = wave2 * 0.7 + wave1 * 0.3;
            const normalZ = 1.0;
            
            // Convert to normal map format (0-255)
            data[index] = Math.floor(normalX * 255);     // R (X direction)
            data[index + 1] = Math.floor(normalY * 255); // G (Y direction) 
            data[index + 2] = Math.floor(normalZ * 255); // B (Z direction)
            data[index + 3] = 255;                       // A
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const normalTexture = new THREE.CanvasTexture(canvas);
    normalTexture.wrapS = THREE.RepeatWrapping;
    normalTexture.wrapT = THREE.RepeatWrapping;
    normalTexture.needsUpdate = true;
    
    return normalTexture;
}

// Sets up a fallback scene with basic lighting and a ground plane.
function setupFallbackScene() {
    // Add lights
    const light = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.castShadow = true;
    directionalLight.position.set(0, 10, 0);
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
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
    
    // Update water textures with very slow, smooth animation
    waterMaterials.forEach(material => {
        if (material.userData && material.userData.isWater) {
            material.userData.time += material.userData.speed;
            
            // Very gentle, slow movement - almost imperceptible
            const offsetX = Math.sin(material.userData.time * 0.2) * 0.0015;
            const offsetY = Math.cos(material.userData.time * 0.15) * 0.0015;
            
            if (material.map) {
                material.map.offset.x += offsetX;
                material.map.offset.y += offsetY;
            }
            
            if (material.normalMap) {
                // Normal map moves at slightly different rate for more natural look
                material.normalMap.offset.x += offsetX * 1.2;
                material.normalMap.offset.y += offsetY * 0.8;
            }
        }
    });

    // Only update if needed
    if (stats) stats.begin();
    const deltaTime = Math.min(0.05, clock.getDelta());
    const physicsDeltaTime = deltaTime / STEPS_PER_FRAME;
    
    if (!document.hidden) {
        // PROCESS JUMP INPUT ONCE PER FRAME
        processJumpInput();
        
        // Physics updates
        if (physicsWorld) {
            for (let i = 0; i < STEPS_PER_FRAME; i++) {
                controls(physicsDeltaTime);
                updatePlayer(physicsDeltaTime);
                physicsWorld.update(physicsDeltaTime, avatar);
                
                // NEW: Check for zGround collision to trigger respawn
                if (checkZGroundCollision()) {
                    respawnPlayer();
                }
            }
        }

        // Animation updates (using full frame time)
        if (avatar.mixer) {
            avatar.mixer.update(deltaTime);
        }

        // Camera updates - always use third-person
        // This is the key fix - always update the camera, not just when character exists
        if (avatar.cameraMode === 'thirdPerson') {
            avatar.updateThirdPersonCamera(camera);
        }

        composer.render();
    }
    
    if (stats) stats.end();
}

// Process jump input once per frame
function processJumpInput() {
    if (!avatar || !avatar.controller) {
        return;
    }
    
    // Handle jump input - only if not already jumping and on floor
    if (keyStates['Space'] && avatar.onFloor && !avatar.isJumping) {
        const jumpSuccess = avatar.jump();
        
        // If jump was successful, consume the key press to prevent multiple jumps
        if (jumpSuccess) {
            keyStates['Space'] = false;
        }
    }
}

// Processes player input and updates avatar movement/animations.
// Translates keyboard states into movement vectors and animations,
// handling jumping, camera-relative movement, and animation transitions.
// Uses deltaTime for frame-rate independent behavior.
function controls(deltaTime) {
    if (!avatar || !avatar.controller) {
        return;
    }

    let currentAzimuth;
    if (avatar.cameraMode === 'thirdPerson') {
        currentAzimuth = avatar.cameraAzimuth;
    } else {
        currentAzimuth = camera.rotation.y;
    }

    const { moveVector, animation } = avatar.controller.update(deltaTime, keyStates, currentAzimuth);
    
    // Apply movement
    avatar.velocity.x = moveVector.x;
    avatar.velocity.z = moveVector.z;
    
    // Handle Q and E for vertical movement (only when gravity is DISABLED)
    if (!gravityEnabled) {
        const verticalSpeed = 5.0; // Adjust this value for desired vertical speed
        
        // Reset vertical velocity first
        avatar.velocity.y = 0;
        
        // Apply vertical movement only while keys are pressed
        if (keyStates['KeyQ']) {
            // Q key - move up
            avatar.velocity.y = verticalSpeed;
        } else if (keyStates['KeyE']) {
            // E key - move down
            avatar.velocity.y = -verticalSpeed;
        }
        // If neither Q nor E is pressed, vertical velocity remains 0
    }
    
    // Set animation based on controller output, but don't override jump animation
    if (!avatar.isJumping || avatar.currentAction !== 'jump') {
        avatar.setAnimation(animation);
    }
}

function updatePlayer(deltaTime) {
    // Store the capsule position BEFORE moving it
    const oldCapsulePosition = new THREE.Vector3().copy(avatar.collider.start);
    
    // Apply gravity if not on floor AND gravity is enabled
    if (!avatar.onFloor && gravityEnabled) {
        avatar.velocity.y -= GRAVITY * deltaTime;
    }
    
    // Store previous floor state
    const wasOnFloor = avatar.onFloor;
    
    // Move the player
    const deltaPosition = avatar.velocity.clone().multiplyScalar(deltaTime);
    avatar.collider.translate(deltaPosition);
    
    // Handle collisions - this will set onFloor appropriately
    // BUT only apply collisions when gravity is enabled
    if (gravityEnabled) {
        physicsWorld.playerCollisions(avatar);
    } else {
        // In fly mode, we're never "on floor"
        avatar.onFloor = false;
    }
    
    // If we've landed after a jump (was in air, now on floor)
    if (avatar.isJumping && !wasOnFloor && avatar.onFloor) {
        avatar.isJumping = false;
        
        // Get current movement state to determine which animation to transition to
        const { animation } = avatar.controller.update(deltaTime, keyStates, avatar.cameraAzimuth);
        avatar.setAnimation(animation);
    }
    
    // Calculate the actual movement that occurred (after collisions)
    const actualMovement = new THREE.Vector3().subVectors(avatar.collider.start, oldCapsulePosition);
    
    // Update character model position to match the capsule - FIXED
    if (avatar.character) {
        // Position character so feet are at floor level
        avatar.character.position.copy(avatar.collider.start);
        avatar.character.position.y -= avatar.playerRadius; // Move down to floor level
    }

    avatar.update(deltaTime);
}

// Add this new function to check for zGround collisions
function checkZGroundCollision() {
    if (!physicsWorld || !avatar || respawnCooldown) return false;
    
    // Check if avatar is colliding with any object named zGround
    const result = physicsWorld.worldOctree.capsuleIntersect(avatar.collider);
    
    if (result && result.object) {
        // Check if the collided object is named zGround
        let currentObject = result.object;
        while (currentObject) {
            if (currentObject.userData && currentObject.userData.name && 
                currentObject.userData.name.toLowerCase() === 'zground') {
                return true;
            }
            currentObject = currentObject.parent;
        }
    }
    
    return false;
}

// Add this new respawn function
function respawnPlayer() {
    if (respawnCooldown) return;
    
    respawnCooldown = true;
    
    const capsuleHeight = avatar.collider.end.y - avatar.collider.start.y;
    
    // Reset position to (0, 1, 0) - slightly above ground
    avatar.collider.start.set(0, 1 + avatar.playerRadius, 0);
    avatar.collider.end.set(0, 1 + avatar.playerRadius + capsuleHeight, 0);
    
    // Position character to match capsule
    if (avatar.character) {
        avatar.character.position.copy(avatar.collider.start);
        avatar.character.position.y -= avatar.collider.radius;
    }
    
    // Reset velocity
    avatar.velocity.set(0, 0, 0);
    avatar.onFloor = false;
    
    // Set animation
    if (gravityEnabled) {
        avatar.setAnimation('idle');
    } else {
        avatar.setAnimation('fly');
    }
    
    // Reset cooldown after delay
    setTimeout(() => {
        respawnCooldown = false;
    }, RESPAWN_COOLDOWN_TIME * 1000);
    
    console.log('Player respawned!');
}

// Add R key handling to your event listeners
document.addEventListener('keydown', function(event) {
    if (event.code === 'KeyR' && !respawnCooldown) {
        respawnPlayer();
        event.preventDefault(); // Prevent browser refresh
    }
});

function resetPlayerPosition() {
    const capsuleHeight = avatar.collider.end.y - avatar.collider.start.y;
    
    // Reset position to (0,0,0) instead of respawn height
    avatar.collider.start.set(0, avatar.playerRadius, 0);
    avatar.collider.end.set(0, avatar.playerRadius + capsuleHeight, 0);
    
    // Position character to match capsule
    if (avatar.character) {
        avatar.character.position.copy(avatar.collider.start);
        avatar.character.position.y -= avatar.collider.radius;
    }
    
    // KEEP falling physics state instead of resetting it
    avatar.velocity.x = 0;
    avatar.velocity.z = 0;
    
    // If gravity is enabled, give a small downward push to ensure falling continues
    if (gravityEnabled) {
        avatar.velocity.y = -0.5; // Small downward velocity
        avatar.onFloor = false; // Ensure it continues falling
    }
    
    // Set appropriate animation
    if (gravityEnabled) {
        avatar.setAnimation('idle'); // Idle animation while falling
    } else {
        avatar.setAnimation('fly'); // Fly animation when gravity is off
    }
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
    
    // Note: We can't update SSAO pass size here since it's dynamically loaded
    // It will automatically handle resize when recreated
}

// Sets up the click handler for objects in the scene.
function setupObjectClickHandler() {
    document.addEventListener('click', (event) => {
        if (!isHighlightEffectEnabled() || !getHighlightedObject()) return;
        
        // Get texture URL more reliably
        let material = getHighlightedObject().material;
        if (Array.isArray(material)) material = material[0];
        
        if (material.map && textureUrls.has(material.map)) {
            const url = textureUrls.get(material.map);
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

    // Add Controls button toggle functionality
    const toggleControlsBtn = document.getElementById('toggle-controls-button');
    if (toggleControlsBtn) {
        toggleControlsBtn.addEventListener('click', toggleMobileControls);
    }

    // Keyboard controls
    document.addEventListener('keydown', function(event) {
        if (event.code === 'Escape') {
            document.exitPointerLock();
            document.body.style.cursor = 'auto';
        }
        if (event.code === 'KeyT') {
            toggleTeleportWindow();
            document.body.style.cursor = 'auto';
            return;
        }
        if (event.code === 'KeyB') {
            if (avatar.debugCapsuleMesh) {
                avatar.debugCapsuleMesh.visible = !avatar.debugCapsuleMesh.visible;
            }
            return; // Add return to prevent further processing
        }
        
        // Set key state for ALL keys first
        keyStates[event.code] = true;
        
        // Handle specific key actions
        if (event.code === 'KeyF') {
            toggleGravity();
            // Prevent default to avoid any browser shortcuts
            event.preventDefault();
        }
        
        // Check if Alt is pressed
        if (event.code === 'AltLeft') {
            setHighlightEffectEnabled(true);
            // Force update even without mouse movement
            const mouse = new THREE.Vector2(
                (renderer.domElement.width/2) / window.innerWidth * 2 - 1,
                -(renderer.domElement.height/2) / window.innerHeight * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(worldObjects.children, true);
            if (intersects.length > 0) {
                applyHighlightEffect(intersects[0].object);
            }
        }
        
        // Handle Q and E only when gravity is DISABLED
        if (!gravityEnabled && (event.code === 'KeyQ' || event.code === 'KeyE')) {
            // Prevent default to avoid any browser shortcuts
            event.preventDefault();
        }

        // Replace this section in your keydown event listener:
        if (event.code === 'KeyH') {
            // Toggle between different shadow intensity levels
            let shadowIntensity = 1.0;
            
            scene.traverse((object) => {
                if (object.isDirectionalLight && object.castShadow) {
                    // Store current intensity in userData if not set
                    if (object.userData.shadowIntensity === undefined) {
                        object.userData.shadowIntensity = 1.0;
                    }
                    
                    // Cycle through intensity levels
                    if (object.userData.shadowIntensity === 1.0) {
                        object.userData.shadowIntensity = 0.7; // Lighter shadows
                        object.intensity = 0.8; // Also reduce light intensity
                        console.log("Shadows: Lighter");
                    } else if (object.userData.shadowIntensity === 0.7) {
                        object.userData.shadowIntensity = 1.5; // Darker shadows
                        object.intensity = 1.2; // Increase light intensity
                        console.log("Shadows: Darker");
                    } else {
                        object.userData.shadowIntensity = 1.0; // Normal shadows
                        object.intensity = 1.0; // Reset light intensity
                        console.log("Shadows: Normal");
                    }
                    
                    shadowIntensity = object.userData.shadowIntensity;
                }
            });
            
            // Also adjust ambient light to complement shadow changes
            scene.traverse((object) => {
                if (object.isAmbientLight) {
                    if (shadowIntensity === 1.5) { // Darker shadows
                        object.intensity = 0.6; // Reduce ambient light
                    } else if (shadowIntensity === 0.7) { // Lighter shadows
                        object.intensity = 0.9; // Increase ambient light
                    } else {
                        object.intensity = 0.75; // Normal ambient light
                    }
                }
            });
            
            event.preventDefault();
        }

        // Key logger
        console.log('Key down:', event.code, event.key)
    });

    // Mouse down event to request pointer lock
    container.addEventListener('mousedown', () => {
        document.body.requestPointerLock();
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
            if (isHighlightEffectEnabled()) {
                document.body.classList.add('highlight-mode');
                // Check if highlighted object has a texture URL
                if (hasClickableHighlight()) {
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
    
    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isHighlightEffectEnabled()) {
            setHighlightEffectEnabled(false);
            keyStates['AltLeft'] = false;
            document.body.classList.remove('highlight-mode', 'clickable');
        }
    });

    // End Alt key highlight
    document.addEventListener('keyup', function(event) {
        keyStates[event.code] = false;
        
        // Add F key handling
        if (event.code === 'KeyF') {
            // Just consume the key, no additional action needed
            keyStates['KeyF'] = false;
        }
        
        if (event.code === 'AltLeft') {
            setHighlightEffectEnabled(false);
        }
        // Handle Space key release
        if (event.code === 'Space') {
            keyStates['Space'] = false;
        }
        // Handle Q and E key releases (only when gravity is disabled)
        if (!gravityEnabled && (event.code === 'KeyQ' || event.code === 'KeyE')) {
            // Stop vertical movement when keys are released
            if (avatar) {
                avatar.velocity.y = 0;
            }
        }
    });
    
    // detect objects under cursor - Raycaster
    document.addEventListener('mousemove', handleHighlightMouseMove);

    // Continuous Alt check
    function checkAltKeyState() {
        if (isHighlightEffectEnabled()) {
            if (!keyStates['AltLeft']) {
                // Alt was released
                setHighlightEffectEnabled(false);
            } else if (!getHighlightedObject()) {
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
    
    // Start the Alt key state checker
    checkAltKeyState();

    // Add toggle button functionality
    const toggleBtn = document.getElementById('toggle-object-list');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTeleportWindow);
    }
}

// Toggle Teleport windows with mouse click or using 'T' key
function toggleTeleportWindow() {
    const list = document.getElementById('object-list');
    const toggleBtn = document.getElementById('toggle-object-list');
    const teleportBtn = document.getElementById('teleport-button');
    
    // Check if elements exist
    if (!list || !toggleBtn || !teleportBtn) return;
    
    // Toggle visibility
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    teleportBtn.style.display = isHidden ? 'block' : 'none';
    
    // Update toggle button state
    if (isHidden) {
        toggleBtn.classList.add('active');
        updateObjectList();
    } else {
        toggleBtn.classList.remove('active');
    }
    
    // Exit Pointer Lock when showing the UI
    if (isHidden && document.pointerLockElement === document.body) {
        document.exitPointerLock();
    }
}

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

// Add this debug function to check the avatar's materials
function debugAvatarMaterials() {
    console.log("=== AVATAR MATERIAL DEBUG ===");
    if (avatar && avatar.character) {
        avatar.character.traverse((child) => {
            if (child.isMesh) {
                console.log("Mesh:", child.name);
                console.log("  - castShadow:", child.castShadow);
                console.log("  - receiveShadow:", child.receiveShadow);
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        console.log("  - Materials:", child.material.length);
                        child.material.forEach((mat, i) => {
                            console.log(`    [${i}]:`, mat.constructor.name);
                            console.log(`      - transparent:`, mat.transparent);
                            console.log(`      - alphaTest:`, mat.alphaTest);
                        });
                    } else {
                        console.log("  - Material:", child.material.constructor.name);
                        console.log("    - transparent:", child.material.transparent);
                        console.log("    - alphaTest:", child.material.alphaTest);
                    }
                }
            }
        });
    }
}

// Add this function to create SSAO pass after scene is loaded
function setupSSAOPass() {
    // Dynamically import SSAOPass to avoid module loading issues
    import('three/examples/jsm/postprocessing/SSAOPass.js')
        .then(({ SSAOPass }) => {
            const ssaoPass = new SSAOPass(
                scene,
                camera,
                window.innerWidth,
                window.innerHeight
            );
            ssaoPass.kernelRadius = 16;
            ssaoPass.minDistance = 0.1;
            ssaoPass.maxDistance = 1;
            ssaoPass.output = SSAOPass.OUTPUT.Default;
            
            // Recreate the composer with SSAO pass
            const newComposer = new EffectComposer(renderer);
            newComposer.addPass(renderPass);
            newComposer.addPass(ssaoPass);
            newComposer.addPass(outlinePass);
            newComposer.addPass(effectFXAA);
            
            // Replace the old composer
            composer = newComposer;
            
            console.log("SSAO enabled successfully");
        })
        .catch(error => {
            console.error("Failed to load SSAOPass:", error);
            console.log("Continuing without SSAO");
        });
}

// Call this after your avatar is loaded
setTimeout(debugAvatarMaterials, 3000);

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
        stats.domElement.style.top = '250';
        stats.domElement.style.left = '0px';
        document.getElementById('container').appendChild(stats.domElement);

        // Create basic Three.js components
        scene = new THREE.Scene();
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

        // In main.js, add this line after creating the camera:
        window.camera = camera;

        // Debug capsule
        avatar.debugCapsule();

        // Setup spheres (now physicsWorld is initialized)
        setupSpheres();

        // ADD THIS LINE RIGHT HERE - after avatar and camera are fully set up
        window.avatar = avatar;

        // NOW initialize mobile controls
        initMobileControls();

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: false
        });
        renderer.shadowMap.enabled = true; // enables Shadows
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better quality shadows
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        document.getElementById('container').appendChild(renderer.domElement);

        // Initialize controls button state - hide by default on all devices
        const toggleControlsBtn = document.getElementById('toggle-controls-button');
        if (toggleControlsBtn) {
            // Hide mobile controls by default
            const mobileControls = document.getElementById('mobile-controls');
            const actionButtons = document.getElementById('action-buttons-container');
            
            if (mobileControls) mobileControls.style.display = 'none';
            if (actionButtons) actionButtons.style.display = 'none';
            
            // Set button to "Controls" state
            toggleControlsBtn.textContent = 'Controls';
            toggleControlsBtn.classList.remove('active');
        }

        // Initialize gravity button
        const gravityIndicator = document.getElementById('gravity-indicator');
        if (gravityIndicator) {
            gravityIndicator.addEventListener('click', toggleGravity);
            
            // Add hover effects
            gravityIndicator.addEventListener('mouseenter', function() {
                if (gravityEnabled) {
                    this.style.transform = 'scale(1.05)';
                    this.style.boxShadow = '0 0 10px rgba(0, 136, 255, 0.5)';
                    this.style.backgroundColor = 'rgba(0, 100, 200, 0.9)';
                } else {
                    this.style.transform = 'scale(1.05)';
                    this.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
                    this.style.backgroundColor = 'rgba(128, 0, 0, 0.9)';
                }
            });

            gravityIndicator.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
                if (gravityEnabled) {
                    this.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
                } else {
                    this.style.backgroundColor = 'rgba(128, 0, 0, 0.7)';
                }
            });
            
            // Set initial state
            if (gravityEnabled) {
                gravityIndicator.textContent = 'GRAVITY ON';
                gravityIndicator.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
                gravityIndicator.style.borderColor = '#0088ff';
                gravityIndicator.style.color = 'white';
                gravityIndicator.classList.remove('off');
            } else {
                gravityIndicator.textContent = 'GRAVITY OFF';
                gravityIndicator.style.backgroundColor = 'rgba(128, 0, 0, 0.7)';
                gravityIndicator.style.borderColor = '#ff0000';
                gravityIndicator.style.color = 'white';
                gravityIndicator.classList.add('off');
            }
        }

        // Loader for HDR environment map
        const loader = new RGBELoader();
        loader.load('./src/hdri/qwantani_afternoon_2k.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            
            // Set as both background and environment
            scene.background = texture;
            scene.environment = texture;
            
            // Keep current environment intensity
            scene.environmentIntensity = 0.5;
            scene.environmentRotation.y = 0;
            
            // Keep current tone mapping exposure
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 0.75;
            
            console.log("HDRI lighting enabled with enhanced shadows");
            
            // ENHANCE the directional light for stronger shadows
            const shadowLight = new THREE.DirectionalLight(0xffffff, 1.2); // Slightly increased from 1.0
            shadowLight.position.set(10, 30, 10);
            shadowLight.castShadow = true;

            // Configure shadow properties for more prominent shadows
            shadowLight.shadow.mapSize.width = 4096; // Higher resolution for sharper shadows
            shadowLight.shadow.mapSize.height = 4096;
            shadowLight.shadow.camera.near = 0.1;
            shadowLight.shadow.camera.far = 100;
            shadowLight.shadow.camera.left = -30;
            shadowLight.shadow.camera.right = 30;
            shadowLight.shadow.camera.top = 30;
            shadowLight.shadow.camera.bottom = -30;

            // Adjust shadow properties for more prominent shadows
            shadowLight.shadow.bias = -0.0001; // Reduced bias for cleaner shadows
            shadowLight.shadow.radius = 1; // Sharper shadow edges
            
            // Increase shadow darkness significantly
            shadowLight.shadow.darkness = 1.2; // Increased beyond 1.0 for darker shadows

            scene.add(shadowLight);

            // Keep ambient light as is
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
            scene.add(ambientLight);

            // ADD THIS LINE after setting up lights
            adjustShadowProperties();
            
        }, undefined, (error) => {
            console.error('Error loading HDR texture:', error);
        });
        
        function adjustShadowProperties() {
            // Make shadows more prominent
            renderer.shadowMap.autoUpdate = true;
            renderer.shadowMap.needsUpdate = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Ensure soft shadows
            
            // Adjust shadow properties for all materials to enhance shadow visibility
            scene.traverse((object) => {
                if (object.isMesh && object.material) {
                    // Make sure objects cast and receive shadows properly
                    if (object.castShadow !== undefined) {
                        object.castShadow = true; // Ensure all meshes cast shadows
                    }
                    
                    if (object.receiveShadow !== undefined && object !== avatar.character) {
                        object.receiveShadow = true; // Ensure all meshes receive shadows (except avatar)
                    }
                    
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => {
                            if (mat.isMaterial) {
                                mat.shadowSide = THREE.FrontSide;
                                // Slightly increase roughness for better shadow definition
                                if (mat.roughness !== undefined) mat.roughness = Math.max(mat.roughness, 0.7);
                                // Reduce metalness to minimize reflections that wash out shadows
                                if (mat.metalness !== undefined) mat.metalness = Math.min(mat.metalness, 0.3);
                            }
                        });
                    } else {
                        object.material.shadowSide = THREE.FrontSide;
                        if (object.material.roughness !== undefined) {
                            object.material.roughness = Math.max(object.material.roughness, 0.7);
                        }
                        if (object.material.metalness !== undefined) {
                            object.material.metalness = Math.min(object.material.metalness, 0.3);
                        }
                    }
                }
            });
        }

        // Handle window resize
        window.addEventListener('resize', onWindowResize);

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

        // Add hover effects to toggle button
        toggleBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 0 10px rgba(74, 175, 255, 0.5)';
            this.style.backgroundColor = 'rgba(0,0,0,0.9)';
        });

        toggleBtn.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.transform = '';
                this.style.boxShadow = '';
                this.style.backgroundColor = 'rgba(0,0,0,0.7)';
            }
        });

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
                // Recompute normals after reordering
                geometry.computeVertexNormals();
            }
            
            // Get position safely
            const position = new THREE.Vector3(
                objData.position?.[0] || 0,
                objData.position?.[1] || 0,
                objData.position?.[2] || 0
            );

            // Create material with position, UVs, and objData
            const material = createRandomMaterial(position, uvs, isVertical, objData);
            // Create mesh and set properties
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
            mesh.castShadow = objData.castShadow !== false;    // Should cast shadow by default
            mesh.receiveShadow = objData.receiveShadow !== false; // Should receive shadow by default

            // In your object creation loop, ensure ground objects receive shadows
            if (objData.name && objData.name.toLowerCase().includes('ground')) {
                mesh.receiveShadow = true;
                mesh.castShadow = false; // Ground usually doesn't cast shadows
                console.log("Ground object configured to receive shadows:", objData.name);
            }

            // NEW: Store object name in userData for collision detection
            if (objData.name) {
                mesh.userData.name = objData.name;
            }

            worldObjects.add(mesh);
        });

        // Update physics world with the created objects
        physicsWorld.initWorld(worldObjects);

        // Add world to scene
        scene.add(worldObjects);
        worldOctree.fromGraphNode(worldObjects);

        // Add world to scene
        scene.add(worldObjects);
        worldOctree.fromGraphNode(worldObjects);

        // Set initial camera position
        if (avatar.character) {
            avatar.updateThirdPersonCamera(camera);
        }

        // Initialize highlight effect system
        initHighlightEffect(outlinePass, worldObjects, textureUrls, camera, renderer);

        // Setup SSAO after everything is loaded
        setTimeout(() => {
            setupSSAOPass();
        }, 1000);

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
            if (isHighlightEffectEnabled()) {
                // Keep effect active but remove clickable state
                document.body.classList.remove('clickable');
            }
        });

        renderer.domElement.addEventListener('mouseenter', () => {
            if (isHighlightEffectEnabled() && getHighlightedObject()) {
                // Restore clickable state if applicable
                document.body.classList.toggle('clickable', hasClickableHighlight());
            }
        });

    } catch (error) {
        console.error('Initialization failed:', error);
        setupFallbackScene();
        animate();
    }
}

// Make sure these global variables are accessible to mobileControls.js
window.keyStates = keyStates;
window.throwBall = throwBall;
window.THREE = THREE; // Add this line to export THREE

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