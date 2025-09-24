When the website loads, the user's avatar is spawned at the center of Cubecity on a Grass textured plane at position 0.0.0.<br>
<br>
There's vertical and horizontal planes that can be seen as walls, floors and ceillings an these are textured with images loaded from [onemillionscreenshots](https://onemillionscreenshots.com/).<br>
<br>
The background is a HDRI downloaded from [polyhaven](https://polyhaven.com/hdris/) .<br>
<br>
There's 1 directional light configured to help emphasize the lighting from the HDRI so we can get nice soft shadows from the avatr and all other objects. Ambient Occlusion is also configured to help with shadows and a mnore realistic effect with intersecting objects. The effect is not very pronounced yet, for the time being the plan is to keep a nice balance between the HDRI lighting, the directional light, shadows and how everything blends together without any compositing.<br>
<br>
H on the keyboard will toggle between 3 states of lighting.<br>
<br>
At the very bottom, below Cubecity, there's a plane with a cheap simulated moving water effect. An idea is to make the avatar respawns when hits the plane, avatar dies and hits water and repaswns at the original position. Another idea is to give it the ability to be submerged and swim so it can complete a task before respawning at the Grass plane. For the time being the avatar with stand on the water as if it's a hard plane and can be respawned by pressing R.<br>
<br>
The user can move the avatar using w/a/s/d and the mouse, space to jump and hold Shift to run.<br>
<br>
F turns gravity of and allows the user to use w/a/s/d to fly around, while holding Shift the avatar will fly faster. Also when Gravity is switched off the q/e keys become available so the user can control the avatar up and down. Pressing F mid flight will make the avatar fall, pressing F again will make the avatar fly again.<br>
<br>
Pressing the Left mouse button will have the avatar shooting green balls. <br>
<br>
Esc releases the mouse so the user can reach the controls at the top right corner of the screen.<br>
<br>
The Controls button will show onscreen controls for mobile devices. On the left handside a joystick allows the user to control the avatr's movement and switch Run on or off, while on the right handside there's a joystick to control the camera, a gravity on/off button, up/down buttons for when gravity is turned off, a green button with and an arrow pointing up that is for jumping and a red button with a circle for shooting the green balls. So, all controls for desktop are available for mobile.<br>
<br>
Below the Controls button, at the top right there's a Teleport button. When clicked, a list of all objects is displayed identifying each object with url for the site of the respective texture loaded per object. The user can scroll through all the object or search, once Go is pressed the avatar is immediately teleported. The user might want to be ready to switch gravity off, since the teleporting can be happening to a location where there's no floor so the avatar will no the next object below or if there's none, it will end up on the Water plane.<br>
<br>
