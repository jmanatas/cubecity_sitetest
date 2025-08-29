// avatar.js - Non-module version
class Avatar {
    constructor(scene, respawnHeight, playerHeight, playerRadius) {
        this.scene = scene;
        this.respawnHeight = respawnHeight;
        this.playerHeight = playerHeight || 2.0;
        this.playerRadius = playerRadius || 0.4;
        this.avatarFeetOffset = 0;

        this.isJumping = false;
        this.gravityEnabled = true;
        
        // Player physics
        this.collider = new Capsule(
            new THREE.Vector3(0, respawnHeight + this.playerRadius, 0),
            new THREE.Vector3(0, respawnHeight + this.playerHeight * 0.5, 0),
            this.playerRadius
        );
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.onFloor = false;
        
        // Character model
        this.character = null;
        this.mixer = null;
        this.animations = null;
        this.animationActions = {
            idle: null,
            walk: null,
            run: null,
            jump: null,
            fly: null
        };
        this.currentAction = null;
        
        // Debug
        this.debugCapsuleMesh = null;
        this.debugEnabled = false;
        
        // Camera
        this.cameraMode = 'thirdPerson';
        this.cameraTarget = new THREE.Vector3();
        this.cameraDistance = 5;
        this.cameraHeight = 2;
        this.cameraAzimuth = 0;
        this.cameraPolar = Math.PI / 3;
        
        this.controller = null;
    }

    // Jump the avatar
    jump() {
        if (!this.onFloor || this.isJumping) {
            return false;
        }

        this.velocity.y = 15; // Jump impulse
        this.onFloor = false;
        this.isJumping = true;
        
        // Trigger jump animation if available
        if (this.mixer && this.animations.jump) {
            // Fade to jump animation
            const action = this.mixer.clipAction(this.animations.jump);
            action.reset();
            action.setEffectiveTimeScale(1);
            action.setEffectiveWeight(1);
            action.clampWhenFinished = true;
            action.loop = THREE.LoopOnce;
            action.fadeIn(0.1);
            action.play();
            
            // Store reference to current action
            this.currentAction = 'jump';
        }
        
        return true;
    }

    resetState() {
        this.velocity.set(0, 0, 0);
        this.isJumping = false;
    }

    async loadCharacter(modelPath) {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync(modelPath);
            this.character = gltf.scene;

            // Calculate positioning
            const box = new THREE.Box3().setFromObject(this.character);
            this.avatarFeetOffset = box.min.y;
            const avatarHeight = box.max.y - box.min.y;
            
            // Set up animations
            this.mixer = new THREE.AnimationMixer(this.character);
            this.animations = gltf.animations;
            
            if (this.animations && this.animations.length > 0) {
                this.animationActions.idle = this.mixer.clipAction(this.findAnimation('idle'));
                this.animationActions.walk = this.mixer.clipAction(this.findAnimation('walk'));
                this.animationActions.run = this.mixer.clipAction(this.findAnimation('run'));
                this.animationActions.jump = this.mixer.clipAction(this.findAnimation('jump'));
                this.animationActions.fly = this.mixer.clipAction(this.findAnimation('fly'));
                
                Object.values(this.animationActions).forEach(action => {
                    if (action) action.setLoop(THREE.LoopRepeat, Infinity);
                });
                
                this.setAnimation('idle');
            }
            
            // Position character
            this.character.position.set(0, this.respawnHeight - this.avatarFeetOffset, 0);
            this.scene.add(this.character);
            
            // Initialize controller
            this.controller = new AvatarController(this.character, this);
            
            return this.character;
        } catch (error) {
            console.error('Error loading character:', error);
            return null;
        }
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
        // Update character position to match capsule
        if (this.character) {
            this.character.position.x = this.collider.start.x;
            this.character.position.z = this.collider.start.z;
            this.character.position.y = this.collider.start.y - this.playerRadius - this.avatarFeetOffset;
        }
        
        // Update debug capsule position if it exists
        if (this.debugCapsuleMesh) {
            const centerY = (this.collider.start.y + this.collider.end.y) / 2;
            this.debugCapsuleMesh.position.set(
                this.collider.start.x,
                centerY,
                this.collider.start.z
            );
        }
    }

    toggleCameraMode() {
        this.cameraMode = this.cameraMode === 'firstPerson' ? 'thirdPerson' : 'firstPerson';
        
        if (this.character) {
            this.character.visible = (this.cameraMode === 'thirdPerson');
        }
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

    updateThirdPersonCamera(camera) {
        if (this.cameraMode !== 'thirdPerson' || !this.character) return;
        
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

    debugCapsule() {
        if (this.debugCapsuleMesh) this.scene.remove(this.debugCapsuleMesh);
        
        const capsuleGeometry = new THREE.CapsuleGeometry(
            this.playerRadius,
            this.playerHeight - (2 * this.playerRadius),
            8, 16
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
        
        // Position at the center of the physics capsule
        const centerY = (this.collider.start.y + this.collider.end.y) / 2;
        
        this.debugCapsuleMesh.position.set(
            this.collider.start.x,
            centerY,
            this.collider.start.z
        );
        
        this.scene.add(this.debugCapsuleMesh);
    }
}