import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AvatarController } from './avatarController.js';

export class Avatar {
    constructor(scene, respawnHeight, playerHeight, playerRadius) {
        this.scene = scene;
        this.respawnHeight = respawnHeight;
        this.playerHeight = playerHeight || 1.8; // Typical human height
        this.playerRadius = playerRadius || 0.25; // Typical human radius
        this.avatarFeetOffset = 0;
        
        // Player physics - capsule creation - CORRECTED
        // The capsule should represent the actual character volume
        this.collider = new Capsule(
            new THREE.Vector3(0, respawnHeight + this.playerRadius, 0), // Bottom of capsule at feet level + radius
            new THREE.Vector3(0, respawnHeight + this.playerHeight - this.playerRadius, 0), // Top of capsule at head level - radius
            this.playerRadius
        );
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.onFloor = false;
        
        // Jump state tracking
        this.isJumping = false;
        this.jumpStartTime = 0;
        this.jumpCooldown = 0.5;
        this.lastJumpTime = 0;
        this.clock = null;
        this.jumpCompletionTime = 3.0; // 3 seconds for full jump animation
        this.forceJumpCompletion = false; // Force jump animation to complete
        
        // Character model
        this.character = null;
        this.mixer = null;
        this.animations = null;
        this.animationActions = {
            idle: null,
            walk: null,
            run: null,
            jump: null
        };
        this.currentAction = null;
        
        // Debug
        this.debugCapsuleMesh = null;
        this.debugEnabled = false;
        // Add debug markers storage
        this.debugMarkers = {
            feet: null,
            origin: null,
            head: null
        };
        
        // Camera
        this.cameraMode = 'thirdPerson'; // Always third-person
        this.cameraTarget = new THREE.Vector3();
        this.cameraDistance = 5;
        this.cameraHeight = 2;
        this.cameraAzimuth = 0;
        this.cameraPolar = Math.PI / 3;
        
        this.controller = null;
    }

    // Jump the avatar
    jump() {
        if (!this.clock) return false;
        
        const currentTime = this.clock.getElapsedTime();
        if (this.onFloor && currentTime - this.lastJumpTime > this.jumpCooldown) {
            this.velocity.y = 15;
            this.onFloor = false;
            this.isJumping = true;
            this.jumpStartTime = currentTime;
            this.lastJumpTime = currentTime;
            this.forceJumpCompletion = true; // Force the animation to complete
            
            console.log("Jump started - forcing 3 second completion");
            this.setAnimation('jump');
            return true;
        }
        return false;
    }

    resetState() {
        this.onFloor = true;
        this.velocity.set(0, 0, 0);
        this.setAnimation('idle');
        
        // Update debug capsule if it exists
        if (this.debugCapsuleMesh) {
            this.updateDebugCapsule();
        }
    }

    async loadCharacter(modelPath) {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync(modelPath);
            this.character = gltf.scene;

            // Calculate the actual bounding box to get proper dimensions
            const box = new THREE.Box3().setFromObject(this.character);
            const size = new THREE.Vector3();
            box.getSize(size);
            
            // Calculate the actual feet offset (distance from model origin to bottom)
            this.avatarFeetOffset = Math.abs(box.min.y);
            
            console.log("Model dimensions:", size);
            console.log("Feet offset:", this.avatarFeetOffset);
            
            // CRITICAL FIX: Position character to align feet with capsule bottom
            // The capsule bottom is at this.collider.start.y
            // We need to place the character's feet at that exact Y position
            this.character.position.set(0, this.collider.start.y - this.playerRadius, 0);
            
            this.scene.add(this.character);

            // Set up animations
            this.mixer = new THREE.AnimationMixer(this.character);
            this.animations = gltf.animations;
            
            if (this.animations && this.animations.length > 0) {
                this.animationActions.idle = this.mixer.clipAction(this.findAnimation('idle'));
                this.animationActions.walk = this.mixer.clipAction(this.findAnimation('walk'));
                this.animationActions.run = this.mixer.clipAction(this.findAnimation('run'));
                this.animationActions.jump = this.mixer.clipAction(this.findAnimation('jump'));
                
                // Set loop modes - JUMP should NOT loop!
                this.animationActions.idle.setLoop(THREE.LoopRepeat, Infinity);
                this.animationActions.walk.setLoop(THREE.LoopRepeat, Infinity);
                this.animationActions.run.setLoop(THREE.LoopRepeat, Infinity);
                this.animationActions.jump.setLoop(THREE.LoopOnce, 1);
                
                this.animationActions.jump.clampWhenFinished = true;
                
                this.setAnimation('idle');
            }
            
            // Initialize controller
            this.controller = new AvatarController(this.character);
            
            return this.character;
        } catch (error) {
            console.error('Error loading character:', error);
            return null;
        }
    }

    setRespawnHeight(newHeight) {
        this.respawnHeight = newHeight;
    }

    findAnimation(name) {
        const lowerName = name.toLowerCase();
        return this.animations.find(anim => 
            anim.name.toLowerCase().includes(lowerName)
        ) || this.animations[0];
    }

    setAnimation(name) {
        if (this.currentAction === name) return;

        if (!this.animationActions[name]) return;
        
        // Fade out current animation
        if (this.currentAction && this.animationActions[this.currentAction]) {
            this.animationActions[this.currentAction].fadeOut(0.2);
        }
        
        // Fade in new animation
        if (this.animationActions[name]) {
            const action = this.animationActions[name];
            
            // Remove any existing event listeners to prevent memory leaks
            if (action._onFinish) {
                action.getMixer().removeEventListener('finished', action._onFinish);
                action._onFinish = null;
            }
            
            action.reset()
                .setEffectiveTimeScale(1.0)
                .fadeIn(0.2)
                .play();
            
            // For jump animation, set up completion callback
            if (name === 'jump') {
                // Create a proper callback function
                const onJumpFinished = (e) => {
                    if (e.action === action) {
                        this.isJumping = false;
                        // Automatically transition back to idle when jump completes
                        if (this.onFloor) {
                            this.setAnimation('idle');
                        }
                        // Remove the event listener after it fires
                        action.getMixer().removeEventListener('finished', onJumpFinished);
                    }
                };
                
                // Store reference and add event listener
                action._onFinish = onJumpFinished;
                action.getMixer().addEventListener('finished', onJumpFinished);
            }
            
            this.currentAction = name;
        }
    }

    update(deltaTime) {
        // Remove the character positioning from here - it's now handled in main.js updatePlayer
        // The character position is updated based on the actual capsule movement after collisions
        
        // Update debug capsule position if it exists
        if (this.debugCapsuleMesh) {
            this.updateDebugCapsule();
        }
        
        // Handle forced jump completion
        if (this.forceJumpCompletion && this.clock) {
            const currentTime = this.clock.getElapsedTime();
            if (currentTime - this.jumpStartTime >= this.jumpCompletionTime) {
                this.forceJumpCompletion = false;
                this.isJumping = false;
                console.log("Jump animation forced completion");
                
                // Only transition to idle if actually on floor
                if (this.onFloor) {
                    this.setAnimation('idle');
                }
            }
        }
    }

    updateThirdPersonCamera(camera) {
        if (!this.character) return;
        
        const spherical = new THREE.Spherical();
        spherical.radius = this.cameraDistance;
        spherical.phi = this.cameraPolar;
        spherical.theta = this.cameraAzimuth;

        const offset = new THREE.Vector3();
        offset.setFromSpherical(spherical);

        this.cameraTarget.copy(this.character.position);
        this.cameraTarget.y += this.cameraHeight;
        
        camera.position.copy(this.cameraTarget).add(offset);
        camera.lookAt(this.cameraTarget);
    }

    resetThirdPersonCamera(camera) {
        if (!this.character) return;
        
        this.cameraDistance = 5;
        this.cameraHeight = 1.5;
        this.cameraAzimuth = this.character.rotation.y + Math.PI;
        this.cameraPolar = Math.PI / 3;
        
        const spherical = new THREE.Spherical();
        spherical.radius = this.cameraDistance;
        spherical.phi = this.cameraPolar;
        spherical.theta = this.cameraAzimuth;

        const offset = new THREE.Vector3();
        offset.setFromSpherical(spherical);

        this.cameraTarget.copy(this.character.position);
        this.cameraTarget.y += this.cameraHeight;
        
        camera.position.copy(this.cameraTarget).add(offset);
        camera.lookAt(this.cameraTarget);
    }

    resetState() {
        this.onFloor = true;
        this.velocity.set(0, 0, 0);
        this.setAnimation('idle');
        
        // Update debug capsule if it exists
        if (this.debugCapsuleMesh) {
            this.updateDebugCapsule();
        }
    }

debugCapsule() {
    if (this.debugCapsuleMesh) this.scene.remove(this.debugCapsuleMesh);
    
    // Use the EXACT same dimensions as the physics capsule
    const capsuleHeight = this.collider.end.y - this.collider.start.y;
    const capsuleRadius = this.collider.radius;
    
    // Create a proper capsule geometry that matches the physics dimensions
    // THREE.CapsuleGeometry creates a capsule with hemispheres on both ends
    // The total height will be capsuleHeight + 2 * capsuleRadius
    const capsuleGeometry = new THREE.CapsuleGeometry(
        capsuleRadius,  // Radius
        capsuleHeight,  // Height between hemisphere centers
        16,             // Radial segments
        8               // Height segments
    );
    
    this.debugCapsuleMesh = new THREE.Mesh(
        capsuleGeometry,
        new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.7
        })
    );
    
    // Store reference for updating
    this.debugCapsuleMesh.userData.isDebugCapsule = true;
    
    this.scene.add(this.debugCapsuleMesh);
    
    // Update the debug capsule position immediately
    this.updateDebugCapsule();
    
    console.log("Debug capsule created:", {
        radius: capsuleRadius,
        height: capsuleHeight,
        totalHeight: capsuleHeight + (2 * capsuleRadius),
        physicsStart: this.collider.start.y,
        physicsEnd: this.collider.end.y
    });
}

// Add these methods to your Avatar class for verification
verifyCapsuleAlignment() {
    if (!this.debugCapsuleMesh || !this.debugCapsuleMesh.geometry) {
        console.error("Debug capsule or geometry is undefined!");
        return false;
    }
    
    // Calculate actual capsule center (with hemispheres included)
    const physicsBottom = new THREE.Vector3().copy(this.collider.start);
    physicsBottom.y -= this.playerRadius;
    const physicsTop = new THREE.Vector3().copy(this.collider.end);
    physicsTop.y += this.playerRadius;
    const actualCenter = new THREE.Vector3()
        .addVectors(physicsBottom, physicsTop)
        .multiplyScalar(0.5);
    
    // Calculate debug capsule center
    const debugCenter = this.debugCapsuleMesh.position.clone();
    
    // Check position alignment
    const positionDiff = actualCenter.distanceTo(debugCenter);
    console.log("Position difference:", positionDiff.toFixed(6));
    
    // Check dimensions
    const actualTotalHeight = physicsTop.y - physicsBottom.y;
    const actualRadius = this.collider.radius;
    
    // Get debug capsule dimensions
    const debugGeometry = this.debugCapsuleMesh.geometry;
    debugGeometry.computeBoundingBox();
    const bbox = debugGeometry.boundingBox;
    const debugHeight = bbox.max.y - bbox.min.y;
    const debugRadius = bbox.max.x;
    
    console.log("Actual total height:", actualTotalHeight.toFixed(3), "Debug height:", debugHeight.toFixed(3));
    console.log("Actual radius:", actualRadius.toFixed(3), "Debug radius:", debugRadius.toFixed(3));
    
    return positionDiff < 0.001 && 
           Math.abs(actualTotalHeight - debugHeight) < 0.001 && 
           Math.abs(actualRadius - debugRadius) < 0.001;
}

// Update the debug capsule update method
// Update the debug capsule update method
updateDebugCapsule() {
    if (!this.debugCapsuleMesh) return;
    
    // Calculate the exact bottom of the physics capsule (floor level)
    const physicsBottom = new THREE.Vector3().copy(this.collider.start);
    physicsBottom.y -= this.playerRadius; // Bottom of bottom hemisphere
    
    // Calculate the exact top of the physics capsule (head level)
    const physicsTop = new THREE.Vector3().copy(this.collider.end);
    physicsTop.y += this.playerRadius; // Top of top hemisphere
    
    // Calculate the center of the entire physics capsule (including hemispheres)
    const physicsCenter = new THREE.Vector3()
        .addVectors(physicsBottom, physicsTop)
        .multiplyScalar(0.5);
    
    // Position the debug capsule at the correct center
    this.debugCapsuleMesh.position.copy(physicsCenter);
    
    // Calculate the direction vector (should be straight up)
    const direction = new THREE.Vector3(0, 1, 0);
    
    // For capsule geometry, we don't need rotation since it's already oriented vertically
    this.debugCapsuleMesh.quaternion.identity();
    }

    update(deltaTime) {
        // Update debug capsule position if it exists
        if (this.debugCapsuleMesh) {
            this.updateDebugCapsule();
        }
        
        // Handle forced jump completion
        if (this.forceJumpCompletion && this.clock) {
            const currentTime = this.clock.getElapsedTime();
            if (currentTime - this.jumpStartTime >= this.jumpCompletionTime) {
                this.forceJumpCompletion = false;
                this.isJumping = false;
                console.log("Jump animation forced completion");
                
                // Only transition to idle if actually on floor
                if (this.onFloor) {
                    this.setAnimation('idle');
                }
            }
        }
    }

    cleanup() {
        // Clean up animation event listeners
        if (this.animationActions) {
            Object.values(this.animationActions).forEach(action => {
                if (action && action._onFinish) {
                    action.getMixer().removeEventListener('finished', action._onFinish);
                    action._onFinish = null;
                    }
                });
            }
        }
}