// avatarController.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js';

export class AvatarController {
    constructor(character = null, avatar = null) {
        this.character = character;
        this.avatar = avatar;
        this.controls = {
            key: [0, 0],
            velocity: new THREE.Vector3(),
            walkVelocity: 1.5,
            runVelocity: 5.5,
        };
        // REMOVE the local animation variable - it's not needed here
    }

    update(delta, keyStates, cameraAzimuth) {
        // Reset controls state
        this.controls.key[0] = 0;
        this.controls.key[1] = 0;
        this.controls.key[2] = 0;

        // Update key states
        if (keyStates['KeyW']) this.controls.key[0] = -1;
        if (keyStates['KeyS']) this.controls.key[0] = 1;
        if (keyStates['KeyA']) this.controls.key[1] = -1;
        if (keyStates['KeyD']) this.controls.key[1] = 1;
        if (keyStates['ShiftLeft']) this.controls.key[2] = 1;

        // Calculate movement
        const active = this.controls.key[0] !== 0 || this.controls.key[1] !== 0;
        const velocity = this.controls.key[2] ? this.controls.runVelocity : this.controls.walkVelocity;

        // Calculate moveVector
        const moveVector = new THREE.Vector3(0, 0, 0);
        
        if (active) {
            const direction = new THREE.Vector3(
                this.controls.key[1], 0, this.controls.key[0]
            ).normalize();
            
            const rotationMatrix = new THREE.Matrix4().makeRotationY(cameraAzimuth);
            direction.applyMatrix4(rotationMatrix);
            
            moveVector.copy(direction).multiplyScalar(velocity);
            
            // Update character rotation
            const angle = Math.atan2(moveVector.x, moveVector.z);
            if (this.character) {
                this.character.rotation.y = angle;
            }
        }

        // Determine animation
        let animation = 'idle';
        
        if (!this.avatar.gravityEnabled) {
            animation = 'fly'; // Fly when gravity is off
        } else if (this.avatar && this.avatar.isJumping) {
            animation = 'jump'; // Jump animation when actively jumping
        } else if (!this.avatar.onFloor) {
            animation = 'jump'; // Jump animation when falling (not on floor)
        } else if (moveVector.length() > 0.1) {
            animation = this.controls.key[2] ? 'run' : 'walk';
        }
        return {
            moveVector: moveVector,
            animation: animation
        };
    }
}