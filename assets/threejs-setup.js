// assets/threejs-setup.js
// This file will make all Three.js components available globally

// Create global THREE object if it doesn't exist
if (typeof THREE === 'undefined') {
    console.error('Three.js not loaded. Please load three.min.js first');
}

// Make sure we have the basic THREE object
if (typeof THREE !== 'undefined') {
    // Add missing components to THREE namespace
    THREE.Octree = class Octree {
        constructor() {
            console.warn('Octree placeholder - functionality may be limited');
        }
        fromGraphNode() {}
        triangleIntersect() { return null; }
        sphereIntersect() { return null; }
        capsuleIntersect() { return null; }
    };

    THREE.Capsule = class Capsule {
        constructor(start, end, radius) {
            this.start = start || new THREE.Vector3();
            this.end = end || new THREE.Vector3();
            this.radius = radius || 1;
        }
        translate() {}
        clone() { return this; }
    };

    // Simple placeholder for stats
    THREE.Stats = function() {
        return {
            domElement: document.createElement('div'),
            begin: function() {},
            end: function() {},
            update: function() {},
            showPanel: function() {}
        };
    };

    // Placeholder for RGBELoader
    THREE.RGBELoader = function() {
        this.load = function(url, onLoad, onProgress, onError) {
            console.warn('RGBELoader placeholder - HDR loading disabled');
            if (onError) onError(new Error('RGBELoader not implemented'));
        };
    };

    // Placeholder for EffectComposer
    THREE.EffectComposer = class EffectComposer {
        constructor(renderer) {
            this.renderer = renderer;
            this.passes = [];
        }
        addPass(pass) {
            this.passes.push(pass);
        }
        render() {}
        setSize() {}
        reset() {}
    };

    // Placeholder for RenderPass
    THREE.RenderPass = class RenderPass {
        constructor(scene, camera) {
            this.scene = scene;
            this.camera = camera;
        }
    };

    // Placeholder for OutlinePass
    THREE.OutlinePass = class OutlinePass {
        constructor(size, scene, camera) {
            this.selectedObjects = [];
            this.visibleEdgeColor = new THREE.Color();
            this.hiddenEdgeColor = new THREE.Color();
            this.edgeStrength = 1;
            this.edgeGlow = 0;
            this.edgeThickness = 1;
        }
    };

    // Placeholder for ShaderPass
    THREE.ShaderPass = class ShaderPass {
        constructor(shader) {
            this.uniforms = shader.uniforms || {};
        }
    };

    // Placeholder for FXAAShader
    THREE.FXAAShader = {
        uniforms: {
            'tDiffuse': { value: null },
            'resolution': { value: new THREE.Vector2() }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform vec2 resolution;
            varying vec2 vUv;
            void main() {
                gl_FragColor = texture2D(tDiffuse, vUv);
            }
        `
    };

    // Placeholder for GLTFLoader
    THREE.GLTFLoader = function() {
        this.load = function(url, onLoad, onProgress, onError) {
            console.warn('GLTFLoader placeholder - GLTF loading disabled');
            if (onError) onError(new Error('GLTFLoader not implemented'));
        };
        this.loadAsync = function(url) {
            return Promise.reject(new Error('GLTFLoader not implemented'));
        };
    };

    console.log('Three.js setup complete with placeholder components');
}