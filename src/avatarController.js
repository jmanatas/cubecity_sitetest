// avatarController.js
import * as THREE from 'three';

export class AvatarController {
    constructor(character) {
        this.character = character;
        this.controls = {
            key: [0, 0],
            velocity: new THREE.Vector3(),
            rotate: new THREE.Quaternion(),
            rotateSpeed: 0.05,
            walkVelocity: 5,
            runVelocity: 10,
            floorDecale: 0,
        };
    }

    update(delta, keyStates, cameraAzimuth) {
        // Reset controls state
        this.controls.key[0] = 0; // Forward/backward
        this.controls.key[1] = 0; // Left/right
        this.controls.key[2] = 0; // Run modifier

        // Update key states - CORRECTED VALUES
        if (keyStates['KeyW']) this.controls.key[0] = -1;    // Forward (positive Z)
        if (keyStates['KeyS']) this.controls.key[0] = 1;   // Backward (negative Z)
        if (keyStates['KeyA']) this.controls.key[1] = -1;   // Left
        if (keyStates['KeyD']) this.controls.key[1] = 1;    // Right
        if (keyStates['ShiftLeft']) this.controls.key[2] = 1;

        // Calculate movement
        const active = this.controls.key[0] !== 0 || this.controls.key[1] !== 0;
        const velocity = this.controls.key[2] ? this.controls.runVelocity : this.controls.walkVelocity;

        // Reset velocity before calculating new movement
        this.controls.velocity.set(0, 0, 0);

        if (active) {
            // Calculate direction vector based on input
            const direction = new THREE.Vector3(
                this.controls.key[1],  // Left/Right (X-axis)
                0,                    // Y-axis (Up/Down) - should remain 0 for ground movement
                this.controls.key[0]   // Forward/Backward (Z-axis)
            ).normalize();

            // Rotate by camera azimuth
            const rotationMatrix = new THREE.Matrix4().makeRotationY(cameraAzimuth);
            direction.applyMatrix4(rotationMatrix);

            // Scale by velocity
            this.controls.velocity.copy(direction).multiplyScalar(velocity);

            // Update character rotation
            const angle = Math.atan2(this.controls.velocity.x, this.controls.velocity.z);
            this.character.rotation.y = angle;
        }

        return {
            moveVector: this.controls.velocity,
            animation: active ? 
                (this.controls.key[2] ? 'run' : 'walk') : 
                'idle'
        };
    }
}