import * as THREE from 'three';

export async function loadTextures() {
    const textures = [];
    const numTextures = 5; // Number of random textures to load
    
    for (let i = 0; i < numTextures; i++) {
        try {
            // Fetch a random screenshot from onemillionscreenshots.com
            const randomId = Math.floor(Math.random() * 1000000); // Random ID (adjust range if needed)
            const screenshotUrl = `https://onemillionscreenshots.com/images/${randomId}.jpg`;
            
            // Load the texture using THREE.TextureLoader
            const texture = await new Promise((resolve, reject) => {
                new THREE.TextureLoader().load(
                    screenshotUrl,
                    resolve,
                    undefined,
                    reject
                );
            });
            
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.encoding = THREE.sRGBEncoding;
            
            textures.push(texture);
            console.log(`Loaded texture: ${screenshotUrl}`);
        } catch (error) {
            console.warn(`Failed to load random screenshot:`, error);
            // Fallback: Use a default texture if loading fails
            const fallbackTexture = new THREE.TextureLoader().load('./textures/fallback.jpg');
            textures.push(fallbackTexture);
        }
    }
    
    return textures;
}