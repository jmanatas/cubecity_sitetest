When the website loads, the user's avatar is spawned at the center of Cubecity on a Grass textured plane at position 0.0.0.<br>
<img width="1190" height="1289" alt="Screenshot from 2025-09-24 17-20-31" src="https://github.com/user-attachments/assets/7ede1ec4-0c5e-4405-a49f-33c2d0f37624" />
<i>Grass plane positioned at the centre of Cubecity where the avatar spawns the first time.</i>
<br>
<br>
There's vertical and horizontal planes that can be seen as walls, floors and ceillings an these are textured with images loaded from [onemillionscreenshots](https://onemillionscreenshots.com/).<br>
<br>
The background is a HDRI downloaded from [polyhaven](https://polyhaven.com/hdris/) .<br>
<br>
There's 1 directional light configured to help emphasize the lighting from the HDRI so we can get nice soft shadows from the avatr and all other objects. <br>
<img width="1190" height="1289" alt="Screenshot from 2025-09-24 17-24-53" src="https://github.com/user-attachments/assets/16aa656d-9214-48d6-89e0-ae688927a0d6" />
<i>Avatar and other objects casting shadows</i>
<br>
<br>
Ambient Occlusion is also configured to help with shadows and a mnore realistic effect with intersecting objects. The effect is not very pronounced yet, for the time being the plan is to keep a nice balance between the HDRI lighting, the directional light, shadows and how everything blends together without any compositing.<br>
<img width="1190" height="1289" alt="Screenshot from 2025-09-24 17-32-15" src="https://github.com/user-attachments/assets/1018fff7-b92e-46ee-9488-3744d9e747a0" />
<i>The effect of Ambient Occlusion</i>
<br>
<br>
H on the keyboard will toggle between 3 states of lighting.<br>
<img width="330" height="363" alt="Screenshot from 2025-09-24 17-35-07" src="https://github.com/user-attachments/assets/d0d89d91-dcea-4919-80c9-10d9effafc88" /><img width="330" height="363" alt="Screenshot from 2025-09-24 17-35-11" src="https://github.com/user-attachments/assets/f1fea410-3a8b-4865-8085-7a193f5c2533" /><img width="330" height="363" alt="Screenshot from 2025-09-24 17-35-19" src="https://github.com/user-attachments/assets/77e252e6-0e4c-49ed-8ed4-03b2b5a2fc49" />
<i>Open images on new tabs to see the differences</i>
<br>
<br>
At the very bottom, below Cubecity, there's a plane with a cheap simulated moving water effect. An idea is to make the avatar respawns when hits the plane, avatar dies and hits water and repaswns at the original position. Another idea is to give it the ability to be submerged and swim so it can complete a task before respawning at the Grass plane. For the time being the avatar stands on the water as if it's a hard plane and can be respawned by pressing R.<br>
<img width="1190" height="1288" alt="Screenshot from 2025-09-24 18-01-29" src="https://github.com/user-attachments/assets/75f98aab-8014-4cf9-94ec-0462410b7aba" />
<i>Avatar standing at the bottom, on the Water plane</i>
<br>
<br>
The user can move the avatar using w/a/s/d and the mouse, space to jump and hold Shift to run.<br>
<br>
F turns gravity of and allows the user to use w/a/s/d to fly around, while holding Shift the avatar will fly faster. Also when Gravity is switched off the q/e keys become available so the user can control the avatar up and down. Pressing F mid flight will make the avatar fall, pressing F again will make the avatar fly again.<br>
<img width="1190" height="1288" alt="Screenshot from 2025-09-24 18-03-53" src="https://github.com/user-attachments/assets/99f1a953-9620-4fe1-8e57-f53162bb4be6" />
<i>Fly mode</i>
<br>
<br>
Pressing the Left mouse button will have the avatar shooting green balls. <br>
<img width="1190" height="1293" alt="Screenshot from 2025-09-24 18-06-12" src="https://github.com/user-attachments/assets/2c3eda61-1126-43e4-a6f9-7fd5a28aec91" />
<i>Avatar shooting balls</i>
<br>
<br>
Esc releases the mouse so the user can reach the controls at the top right corner of the screen.<br>
<br>
The Controls button will show onscreen controls for mobile devices. On the left handside a joystick allows the user to control the avatr's movement and switch Run on or off, while on the right handside there's a joystick to control the camera, a gravity on/off button, up/down buttons for when gravity is turned off, a green button with and an arrow pointing up that is for jumping and a red button with a circle for shooting the green balls. So, all controls for desktop are available for mobile.<br>
<img width="1190" height="1293" alt="Screenshot from 2025-09-24 18-07-52" src="https://github.com/user-attachments/assets/95ddbc05-aa12-4d19-ac46-aab987e27287" />
<i>Onscreen controls for mobile devices</i>
<br>
<br>
Below the Controls button, at the top right there's a Teleport button. When clicked, or usinf T on the keyboard, a list of all objects is displayed identifying each object with url for the site of the respective texture loaded per object. The user can scroll through all the object or search, once Go is pressed the avatar is immediately teleported. The user might want to be ready to switch gravity off, since the teleporting can be happening to a location where there's no floor so the avatar will no the next object below or if there's none, it will end up on the Water plane.<br>
<img width="1190" height="1293" alt="Screenshot from 2025-09-24 18-11-17" src="https://github.com/user-attachments/assets/506e87b5-f05b-4a11-a1c9-d9591fca3bf0" />
<i>Teleport Window listing sites</i>
<br>
<br>
<img width="1190" height="1293" alt="Screenshot from 2025-09-24 18-09-45" src="https://github.com/user-attachments/assets/85b394c1-ea8f-4a16-83e1-b8e6cd98bfbb" />
<i>Teleport Window showing all "Guess" locations in Cubecity</i>
<br>
<br>
Holding Alt will dim everything and highlight in pink the plane where the user is pointing the mouse to. Clicking any of the highlighted planes will open the respective site url on a new tab.
<img width="1084" height="1190" alt="Screenshot from 2025-09-24 18-21-22" src="https://github.com/user-attachments/assets/d5ba55d5-582d-4f10-b89e-7cbf6c9c8684" />


