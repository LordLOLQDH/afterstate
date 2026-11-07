import * as THREE from 'three';
import { supabaseConfigured } from './supabase';

const VERSION = '0.2.2';
const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const menu = document.querySelector<HTMLElement>('#menu')!;
const hud = document.querySelector<HTMLElement>('#hud')!;
const touchControls = document.querySelector<HTMLElement>('#touch-controls')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
// Register the touch action immediately, before building the large 3D scene.
document.querySelector('#play')?.addEventListener('click', () => startGame());
const controlsPanel = document.querySelector<HTMLElement>('#controls-panel');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaebdca);
scene.fog = new THREE.Fog(0xaebdca, 105, 340);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 700);
// Mobile Safari has a much tighter GPU budget than desktop browsers.
// Keep the mobile renderer lightweight so the game can initialize reliably.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: isTouch ? 'low-power' : 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0xaebdca);


const hemi = new THREE.HemisphereLight(0xc7d9ea, 0x424b50, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2bf, 3.1);
sun.position.set(-65, 100, 45);
sun.castShadow = !isTouch;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.00012;
sun.shadow.normalBias = 0.025;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
scene.add(sun);

function makeSurfaceTexture(base: string, seed: number, facade = false) {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 512;
  canvasTexture.height = 512;
  const ctx = canvasTexture.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < (isTouch ? 1200 : 6000); i++) {
    const shade = Math.floor(random() * 48);
    ctx.fillStyle = random() > .5 ? `rgba(255,255,255,${shade / 1200})` : `rgba(0,0,0,${shade / 1100})`;
    const size = facade ? 1.5 : 2.5;
    ctx.fillRect(random() * 512, random() * 512, size, size);
  }
  if (facade) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 22 + col * 82, y = 20 + row * 62;
        const lit = random() > .58;
        ctx.fillStyle = '#26343d';
        ctx.fillRect(x - 3, y - 3, 54, 43);
        ctx.fillStyle = lit ? (random() > .5 ? '#9bb7c5' : '#d0c8ad') : '#34434b';
        ctx.fillRect(x, y, 48, 37);
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(x + 3, y + 3, 3, 30);
        ctx.fillStyle = 'rgba(10,18,24,.35)';
        ctx.fillRect(x + 23, y, 2, 37);
      }
    }
    ctx.fillStyle = 'rgba(15,22,28,.28)';
    for (let y = 0; y < 512; y += 62) ctx.fillRect(0, y, 512, 5);
  }
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.needsUpdate = true;
  return texture;
}
const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeSurfaceTexture('#626b62', 11), roughness: 1 });
const roadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeSurfaceTexture('#292f33', 29), roughness: .98 });
const lineMat = new THREE.MeshStandardMaterial({ color: 0xc4c2b5, roughness: .8 });
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeSurfaceTexture('#888b86', 47), roughness: 1 });
const buildingMats = [0x68737b,0x8a8d89,0x555f68,0x9a9990,0x6d7775,0x4b5964].map((color, index) => new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: makeSurfaceTexture('#' + color.toString(16).padStart(6, '0'), 100 + index * 17, true),
  roughness: .88,
  metalness: .04,
}));
const windowMat = new THREE.MeshStandardMaterial({ color: 0x8eb3c8, emissive: 0x29465a, emissiveIntensity: .45, metalness: .35, roughness: .28 });
const darkWindowMat = new THREE.MeshStandardMaterial({ color: 0x263944, metalness: .35, roughness: .3 });
const obstacles: Array<{minX:number;maxX:number;minZ:number;maxZ:number}> = [];

function addBox(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material, cast=true, receive=true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
  mesh.position.set(x,y+h/2,z);
  mesh.castShadow = cast && !isTouch;
  mesh.receiveShadow = receive;
  scene.add(mesh);
  return mesh;
}
function addRoad(x:number,z:number,w:number,d:number) {
  addBox(x,-.08,z,w,.12,d,roadMat,false,true);
  if (w > d) {
    for(let p=-w/2+4;p<w/2-2;p+=9) addBox(x+p,.04,z,.12,.012,.22,lineMat,false,false);
  } else {
    for(let p=-d/2+4;p<d/2-2;p+=9) addBox(x,.04,z+p,.22,.012,.12,lineMat,false,false);
  }
}
function seeded(n:number) { const v=Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); }

addBox(0,-.1,0,420,.1,420,groundMat,false,true);

// A compact first district. The four larger cities will be built as separate world regions later.
const blockCenters:number[]=[];
for(let i=-3;i<=3;i++) blockCenters.push(i*30);
for(const x of blockCenters) addRoad(x,0,9,210);
for(const z of blockCenters) addRoad(0,z,210,9);

for(let ix=-3;ix<3;ix++) for(let iz=-3;iz<3;iz++) {
  const cx=(ix+.5)*30, cz=(iz+.5)*30;
  addBox(cx,-.01,cz,20,.18,20,sidewalkMat,false,true);
  for(let q=0;q<4;q++) {
    const bx=cx+(q%2===0?-5:5), bz=cz+(q<2?-5:5);
    const height=10+seeded((ix+5)*41+(iz+5)*7+q)*(isTouch ? 24 : 38);
    const width=5.8+seeded(q+ix*11+iz*3)*2.2;
    const depth=5.8+seeded(q+ix*5+iz*13)*2.2;
    const material=buildingMats[Math.floor(seeded(ix*71+iz*19+q)*buildingMats.length)];
    const building=addBox(bx,height/2-.05,bz,width,height,depth,material);
    building.position.y=height/2;
    obstacles.push({minX:bx-width/2-.42,maxX:bx+width/2+.42,minZ:bz-depth/2-.42,maxZ:bz+depth/2+.42});
    const floors=Math.max(2,Math.floor(height/3.1));
    const cols=Math.max(2,Math.floor(width/(isTouch ? 2.1 : 1.35)));
    for(let f=0;f<floors;f++) for(let c=0;c<cols;c++) {
      const wx=bx-width/2+.7+c*(width-.9)/cols;
      const wy=1.3+f*2.8;
      const win=addBox(wx,wy,bz-depth/2-.035,.66,1.15,.045,seeded(f*19+c+q)>0.16?windowMat:darkWindowMat,false,false);
      win.position.y=wy;
    }
    addBox(bx,height+.03,bz,width+.2,.12,depth+.2,new THREE.MeshStandardMaterial({color:0x313a40,roughness:.8}),false,false);
  }
}

// Street lamps and small roadside trees.
const poleMat=new THREE.MeshStandardMaterial({color:0x303a40,metalness:.65,roughness:.45});
const lampMat=new THREE.MeshStandardMaterial({color:0xffe6bd,emissive:0xffc879,emissiveIntensity:.55});
for(let i=-5;i<=5;i++) {
  for(const side of [-1,1]) {
    const x=i*18+side*6.5;
    addBox(x,0,-105,.14,5.2,.14,poleMat,false,false);
    addBox(x,5.05,-103.8,2.2,.12,.12,poleMat,false,false);
    const lamp=addBox(x+1,5.0,-103.8,.25,.1,.25,lampMat,false,false);
    lamp.material=lampMat;
  }
}
const trunkMat=new THREE.MeshStandardMaterial({color:0x554537});
const leafMat=new THREE.MeshStandardMaterial({color:0x425d50,roughness:1});
for(let i=0;i<(isTouch ? 14 : 34);i++) {
  const x=(seeded(i+20)-.5)*185, z=(seeded(i+80)-.5)*185;
  if(Math.abs(x%30)<8 || Math.abs(z%30)<8) continue;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.26,2.5,7),trunkMat);
  trunk.position.set(x,1.25,z); scene.add(trunk);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.35,1),leafMat);
  crown.position.set(x,3.1,z); crown.scale.set(1,1.25,1); crown.castShadow=!isTouch; scene.add(crown);
}

// Player model with simple procedural limbs.
const player=new THREE.Group();
const skin=new THREE.MeshStandardMaterial({color:0xc18f70,roughness:.8});
const jacket=new THREE.MeshStandardMaterial({color:0x202b37,roughness:.8});
const pants=new THREE.MeshStandardMaterial({color:0x25282c,roughness:.9});
const shoes=new THREE.MeshStandardMaterial({color:0x111519,roughness:.8});
function capsulePart(radius:number,length:number,mat:THREE.Material,x:number,y:number,z:number) {
  const m=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,4,8),mat);
  m.position.set(x,y,z); m.castShadow=!isTouch; player.add(m); return m;
}
const torso=capsulePart(.34,.55,jacket,0,1.28,0);
const head=new THREE.Mesh(new THREE.SphereGeometry(.23,16,12),skin); head.position.y=2.02; head.castShadow=!isTouch; player.add(head);
const legL=capsulePart(.13,.5,pants,-.17,.55,0), legR=capsulePart(.13,.5,pants,.17,.55,0);
const armL=capsulePart(.105,.48,jacket,-.43,1.32,0), armR=capsulePart(.105,.48,jacket,.43,1.32,0);
const footL=new THREE.Mesh(new THREE.BoxGeometry(.22,.12,.38),shoes), footR=footL.clone();
footL.position.set(-.17,.12,-.06); footR.position.set(.17,.12,-.06); player.add(footL,footR);
player.position.set(0,0,0); scene.add(player);

const state={playing:false,firstPerson:false,yaw:0,pitch:-.12,vertical:0,onGround:true,walkTime:0,moveX:0,moveZ:0,lookX:0,lookY:0,gamepadCameraPressed:false};
const keys=new Set<string>();
const clock=new THREE.Clock();
const moveForward=new THREE.Vector3(), moveRight=new THREE.Vector3(), desired=new THREE.Vector3();
const cameraTarget=new THREE.Vector3();
let lastToast=0;

function showToast(message:string) {
  toast.textContent=message; toast.classList.remove('hidden');
  window.clearTimeout(lastToast);
  lastToast=window.setTimeout(()=>toast.classList.add('hidden'),2200);
}
function startGame() {
  state.playing=true; menu.classList.add('hidden'); hud.classList.remove('hidden');
  if(isTouch) touchControls.classList.remove('hidden');
  else canvas.requestPointerLock?.();
  showToast('Willkommen in Metro City.');
}
function toggleCamera() {
  state.firstPerson=!state.firstPerson;
  document.querySelector('#crosshair')?.classList.toggle('hidden',!state.firstPerson);
  showToast(state.firstPerson?'First Person':'Third Person');
}

document.querySelector('#how-to-play')?.addEventListener('click',()=>controlsPanel?.classList.remove('hidden'));
document.querySelector('#close-controls')?.addEventListener('click',()=>controlsPanel?.classList.add('hidden'));
window.addEventListener('keydown',e=>{
  keys.add(e.code);
  if(e.code==='KeyV'&&state.playing) toggleCamera();
  if(e.code==='Escape'&&document.pointerLockElement===canvas) document.exitPointerLock();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('click',()=>{if(state.playing&&!isTouch&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
window.addEventListener('mousemove',e=>{
  if(!state.playing||document.pointerLockElement!==canvas)return;
  state.yaw-=e.movementX*.0022;
  state.pitch=Math.max(-.95,Math.min(.45,state.pitch-e.movementY*.0018));
});
window.addEventListener('contextmenu',e=>e.preventDefault());

// Mobile joystick and right-side look area.
const stick=document.querySelector<HTMLElement>('#move-stick')!;
const knob=stick.querySelector<HTMLElement>('.stick-knob')!;
let stickPointer:number|null=null,stickOrigin={x:0,y:0};
stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);const r=stick.getBoundingClientRect();stickOrigin={x:r.left+r.width/2,y:r.top+r.height/2};});
stick.addEventListener('pointermove',e=>{
  if(stickPointer!==e.pointerId)return;
  const dx=e.clientX-stickOrigin.x,dy=e.clientY-stickOrigin.y,len=Math.max(1,Math.hypot(dx,dy)),scale=Math.min(1,42/len);
  state.moveX=dx*scale/42;state.moveZ=dy*scale/42;knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
});
function resetStick(){stickPointer=null;state.moveX=0;state.moveZ=0;knob.style.transform='translate(0,0)';}
stick.addEventListener('pointerup',resetStick);stick.addEventListener('pointercancel',resetStick);
const lookZone=document.querySelector<HTMLElement>('#look-zone')!;
let lookPointer:number|null=null,lastLook={x:0,y:0};
lookZone.addEventListener('pointerdown',e=>{lookPointer=e.pointerId;lookZone.setPointerCapture(e.pointerId);lastLook={x:e.clientX,y:e.clientY};});
lookZone.addEventListener('pointermove',e=>{
  if(lookPointer!==e.pointerId)return;
  state.yaw-=(e.clientX-lastLook.x)*.006;state.pitch=Math.max(-.95,Math.min(.45,state.pitch-(e.clientY-lastLook.y)*.004));
  lastLook={x:e.clientX,y:e.clientY};
});
function endLook(){lookPointer=null;}
lookZone.addEventListener('pointerup',endLook);lookZone.addEventListener('pointercancel',endLook);
const jumpButton=document.querySelector<HTMLButtonElement>('#jump')!;
jumpButton.addEventListener('pointerdown',e=>{e.preventDefault();if(state.onGround){state.vertical=7.2;state.onGround=false;}});

function blocked(x:number,z:number) {
  return obstacles.some(o=>x>o.minX&&x<o.maxX&&z>o.minZ&&z<o.maxZ);
}
function updatePlayer(dt:number) {
  let x=state.moveX,z=state.moveZ;
  const gamepad=navigator.getGamepads?.().find(p=>p?.connected);
  if(gamepad) {
    x+=Math.abs(gamepad.axes[0]??0)>.14?gamepad.axes[0]:0;
    z+=Math.abs(gamepad.axes[1]??0)>.14?gamepad.axes[1]:0;
    state.yaw-=(Math.abs(gamepad.axes[2]??0)>.14?gamepad.axes[2]:0)*2.4*dt;
    state.pitch=Math.max(-.95,Math.min(.45,state.pitch-(Math.abs(gamepad.axes[3]??0)>.14?gamepad.axes[3]:0)*2.0*dt));
    const cameraPressed=Boolean(gamepad.buttons[3]?.pressed);
    if(cameraPressed&&!state.gamepadCameraPressed)toggleCamera();
    state.gamepadCameraPressed=cameraPressed;
    if(gamepad.buttons[0]?.pressed&&state.onGround){state.vertical=7.2;state.onGround=false;}
  } else {
    state.gamepadCameraPressed=false;
  }
  if(keys.has('KeyW')||keys.has('ArrowUp'))z-=1;
  if(keys.has('KeyS')||keys.has('ArrowDown'))z+=1;
  if(keys.has('KeyA')||keys.has('ArrowLeft'))x-=1;
  if(keys.has('KeyD')||keys.has('ArrowRight'))x+=1;
  const moving=Math.hypot(x,z)>.08;
  if(moving) {
    const len=Math.hypot(x,z);x/=len;z/=len;
    moveForward.set(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
    moveRight.set(Math.cos(state.yaw),0,-Math.sin(state.yaw));
    desired.copy(moveForward).multiplyScalar(-z).addScaledVector(moveRight,x).normalize();
    const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const speed=sprint?10.5:6.2;
    const nx=player.position.x+desired.x*speed*dt,nz=player.position.z+desired.z*speed*dt;
    if(!blocked(nx,player.position.z))player.position.x=nx;
    if(!blocked(player.position.x,nz))player.position.z=nz;
    player.rotation.y=Math.atan2(desired.x,desired.z);
    state.walkTime+=dt*(sprint?13:9);
  }
  if((keys.has('Space'))&&state.onGround){state.vertical=7.2;state.onGround=false;}
  state.vertical-=19*dt;
  player.position.y+=state.vertical*dt;
  if(player.position.y<=0){player.position.y=0;state.vertical=0;state.onGround=true;}
  const swing=moving?Math.sin(state.walkTime)*.48:0;
  legL.rotation.x=swing;legR.rotation.x=-swing;armL.rotation.x=-swing*.75;armR.rotation.x=swing*.75;
  torso.position.y=1.28+(moving?Math.abs(Math.sin(state.walkTime*2))*.035:0);
}

function updateCamera(dt:number) {
  const forward=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
  if(state.firstPerson) {
    cameraTarget.set(player.position.x,player.position.y+1.75,player.position.z);
    camera.position.lerp(cameraTarget.clone().add(new THREE.Vector3(0,.04,0)),1-Math.exp(-18*dt));
    const look=new THREE.Vector3(
      camera.position.x+forward.x*Math.cos(state.pitch),
      camera.position.y+Math.sin(state.pitch),
      camera.position.z+forward.z*Math.cos(state.pitch)
    );
    camera.lookAt(look);
  } else {
    cameraTarget.set(player.position.x,player.position.y+1.35,player.position.z);
    const distance=6.8;
    const desiredCamera=new THREE.Vector3(
      player.position.x+Math.sin(state.yaw)*distance,
      player.position.y+3.0+state.pitch*3,
      player.position.z+Math.cos(state.yaw)*distance
    );
    camera.position.lerp(desiredCamera,1-Math.exp(-7*dt));
    camera.lookAt(cameraTarget);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);
  if(state.playing) {
    updatePlayer(dt);
    updateCamera(dt);
  } else {
    const t=clock.elapsedTime;
    camera.position.set(Math.sin(t*.035)*17,17,35+Math.cos(t*.035)*4);
    camera.lookAt(0,9,0);
  }
  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,isTouch?1:2));
});

if(!supabaseConfigured) console.info('AFTERSTATE: Supabase credentials are not configured yet. The local prototype still works.');
document.title=`AFTERSTATE | Version ${VERSION}`;
