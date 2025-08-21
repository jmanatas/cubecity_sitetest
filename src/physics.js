// physics.js
import * as THREE from 'three';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper.js'; // Add this import
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

// Physics constants
export const GRAVITY = 30;
export const SPHERE_RADIUS = 0.2;
export const STEPS_PER_FRAME = 5;

// Reusable vectors for physics calculations
export const vector1 = new THREE.Vector3();
export const vector2 = new THREE.Vector3();
export const vector3 = new THREE.Vector3();

export class PhysicsWorld {
    constructor(scene) {
        this.scene = scene;
        this.worldOctree = new Octree();
        this.spheres = [];
        this.sphereIdx = 0;
    }

    // Initialize physics world with objects
    initWorld(worldObjects, debugEnabled = false) {
        this.worldOctree = new Octree();
        this.worldOctree.fromGraphNode(worldObjects);
        
        // Add debug visualization
        const helper = new OctreeHelper(this.worldOctree);
        helper.visible = debugEnabled;
        this.scene.add(helper);
    }

    // Add spheres for physics simulation
    addSphere(sphere) {
        this.spheres.push(sphere);
    }

    // Player collision detection
    playerCollisions(player) {
        const result = this.worldOctree.capsuleIntersect(player.collider);
        
        if (result) {
            player.onFloor = result.normal.y > 0.5;

            // Special handling for floor planes
            if (player.onFloor) {
                // Stronger response for floor collisions
                const penetrationCorrection = Math.max(result.depth, 0.05);
                player.collider.translate(result.normal.multiplyScalar(penetrationCorrection));
                
                // Cancel vertical velocity completely
                player.velocity.y = Math.max(player.velocity.y, 0);
                
                // Apply stronger friction
                player.velocity.x *= 0.5;
                player.velocity.z *= 0.5;
            } else {
                // Regular collision response
                const velocityDotNormal = result.normal.dot(player.velocity);
                player.velocity.addScaledVector(result.normal, -velocityDotNormal * 1.5);
                player.collider.translate(result.normal.multiplyScalar(result.depth * 1.05));
            }
        }
    }

    // Sphere-to-sphere collision detection
    spheresCollisions() {
        for (let i = 0, length = this.spheres.length; i < length; i++) {
            const s1 = this.spheres[i];

            for (let j = i + 1; j < length; j++) {
                const s2 = this.spheres[j];

                const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
                const r = s1.collider.radius + s2.collider.radius;
                const r2 = r * r;

                if (d2 < r2) {
                    const normal = vector1.subVectors(s1.collider.center, s2.collider.center).normalize();
                    const v1 = vector2.copy(normal).multiplyScalar(normal.dot(s1.velocity));
                    const v2 = vector3.copy(normal).multiplyScalar(normal.dot(s2.velocity));

                    s1.velocity.add(v2).sub(v1);
                    s2.velocity.add(v1).sub(v2);

                    const d = (r - Math.sqrt(d2)) / 2;
                    s1.collider.center.addScaledVector(normal, d);
                    s2.collider.center.addScaledVector(normal, -d);
                }
            }
        }
    }

    // Player-sphere collision detection
    playerSphereCollision(player, sphere) {
        const center = vector1.addVectors(player.collider.start, player.collider.end).multiplyScalar(0.5);
        const sphere_center = sphere.collider.center;
        const r = player.collider.radius + sphere.collider.radius;
        const r2 = r * r;

        for (const point of [player.collider.start, player.collider.end, center]) {
            const d2 = point.distanceToSquared(sphere_center);

            if (d2 < r2) {
                const normal = vector1.subVectors(point, sphere_center).normalize();
                const v1 = vector2.copy(normal).multiplyScalar(normal.dot(player.velocity));
                const v2 = vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

                player.velocity.add(v2).sub(v1);
                sphere.velocity.add(v1).sub(v2);

                const d = (r - Math.sqrt(d2)) / 2;
                sphere_center.addScaledVector(normal, -d);
            }
        }
    }

    // Update all physics objects
    update(deltaTime, player) {
        // Update spheres
        this.spheres.forEach(sphere => {
            sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);
            const result = this.worldOctree.sphereIntersect(sphere.collider);

            if (result) {
                sphere.velocity.addScaledVector(result.normal, -result.normal.dot(sphere.velocity) * 1.5);
                sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
            } else {
                sphere.velocity.y -= GRAVITY * deltaTime;
            }

            const damping = Math.exp(-1.5 * deltaTime) - 1;
            sphere.velocity.addScaledVector(sphere.velocity, damping);
            this.playerSphereCollision(player, sphere);
        });

        this.spheresCollisions();

        // Update sphere meshes
        for (const sphere of this.spheres) {
            sphere.mesh.position.copy(sphere.collider.center);
        }
    }
}

// Helper function to create a physics sphere
export function createPhysicsSphere(mesh, radius, position) {
    return {
        mesh: mesh,
        collider: new THREE.Sphere(position || new THREE.Vector3(0, -100, 0), radius || SPHERE_RADIUS),
        velocity: new THREE.Vector3()
    };
}
