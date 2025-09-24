// highlightEffect.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

// Highlight effect variables
let highlightEffectEnabled = false;
let highlightedObject = null;
let originalMaterials = new Map();
let lastHighlightTime = 0;
const HIGHLIGHT_HYSTERESIS = 200; // ms delay before switching objects

let outlinePass;
let worldObjects;
let textureUrls;
let camera;
let renderer;
let MOUSE_DEADZONE = 2; // pixels
let lastMouseX = 0;
let lastMouseY = 0;

// Initialize the highlight effect system
export function initHighlightEffect(pass, objects, urls, cam, rend) {
    outlinePass = pass;
    worldObjects = objects;
    textureUrls = urls;
    camera = cam;
    renderer = rend;
    
    // Pink outline configuration
    outlinePass.visibleEdgeColor.set(0xff69b4); // Pink color
    outlinePass.hiddenEdgeColor.set(0xff1493); // Darker pink
    outlinePass.edgeStrength = 3.0; // Line thickness
    outlinePass.edgeGlow = 0.5; // Glow intensity
    outlinePass.edgeThickness = 1.0; // Edge thickness
    outlinePass.pulsePeriod = 0; // No pulsation
}

// Safe traversal function
function safeTraverse(callback) {
    if (!worldObjects) return;
    worldObjects.traverse(callback);
}

// Apply highlight effect to the object
export function applyHighlightEffect(object) {
    if (!worldObjects) return;
    if (highlightedObject === object) return;
    
    resetHighlightEffect();
    
    highlightedObject = object;
    
    // Outline effect (existing code)
    const bbox = new THREE.Box3().setFromObject(object);
    const size = bbox.getSize(new THREE.Vector3()).length();
    outlinePass.edgeStrength = size < 1.0 ? 5.0 : 3.0;
    outlinePass.selectedObjects = [object];
    
    // Restore dimming effect
    safeTraverse((child) => {
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
    safeTraverse((child) => {
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

// Reset highlight effect
export function resetHighlightEffect() {
    if (!worldObjects || !highlightedObject) return;
    
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
    safeTraverse((child) => {
        if (originalMaterials.has(child)) {
            child.material = originalMaterials.get(child);
            originalMaterials.delete(child);
        }
    });
    
    highlightedObject = null;
}

// Handle mouse movement for highlighting
export function handleHighlightMouseMove(event) {
    if (!highlightEffectEnabled || !worldObjects || !worldObjects.children) return;
    
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
}

// Set highlight effect enabled state
export function setHighlightEffectEnabled(enabled) {
    highlightEffectEnabled = enabled;
    if (!enabled) {
        resetHighlightEffect();
        document.body.classList.remove('highlight-mode', 'clickable');
    } else {
        document.body.classList.add('highlight-mode');
    }
}

// Get highlight effect enabled state
export function isHighlightEffectEnabled() {
    return highlightEffectEnabled;
}

// Get the currently highlighted object
export function getHighlightedObject() {
    return highlightedObject;
}

// Check if highlighted object has a clickable texture
export function hasClickableHighlight() {
    if (!highlightedObject) return false;
    
    const material = Array.isArray(highlightedObject.material) ? 
                    highlightedObject.material[0] : highlightedObject.material;
    
    return material.map && textureUrls.has(material.map);
}