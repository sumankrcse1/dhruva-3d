import bpy, os, math, random, wave, struct
from mathutils import Vector, noise
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s=bpy.context.scene; env=bpy.data.collections['00_ENVIRONMENT']
for o in list(env.objects):
    if o.name.startswith('Himalayan_fictional_ridge'): bpy.data.objects.remove(o,do_unlink=True)
random.seed(24)
peaks=[(-145+i*23,85+random.uniform(-20,15),random.uniform(24,44),random.uniform(13,24)) for i in range(14)]
peaks +=[(-150+i*30,145+random.uniform(-15,15),random.uniform(35,55),random.uniform(19,28)) for i in range(11)]
nx,ny=260,210; verts=[]
for iy in range(ny):
    y=-130+iy*1.6
    for ix in range(nx):
        x=-208+ix*1.6
        z=max([h*math.exp(-((x-px)**2/(w*w)+(y-py)**2/(w*w*.68))) for px,py,h,w in peaks])
        detail=noise.fractal(Vector((x*.10,y*.10,1.4)),1.1,2,5)
        z=z*(.82+.16*detail)+min(1,max(0,(y-22)/15))*detail*2-.3
        if y<22: z=-.3+max(0,min(1,(abs(x)-27)/12))*detail*.7
        verts.append((x,y,z))
faces=[]
for iy in range(ny-1):
    for ix in range(nx-1):
        a=iy*nx+ix; faces.extend([(a,a+1,a+nx),(a+1,a+nx+1,a+nx)])
me=bpy.data.meshes.new('Continuous_high_altitude_terrain'); me.from_pydata(verts,[],faces); me.update()
o=bpy.data.objects.new('Fictional_mountain_landscape',me); env.objects.link(o)
me.materials.append(bpy.data.materials['MAT_Rock']); me.materials.append(bpy.data.materials['MAT_Snow'])
for f in me.polygons:
    p=sum((me.vertices[i].co for i in f.vertices),Vector())/3
    f.material_index=int(p.z>15+noise.noise(p*.2)*3 and f.normal.z>.45); f.use_smooth=True
def cam(name,pos,target,lens):
    o=bpy.data.objects[name]; o.location=pos; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler(); o.data.lens=lens
cam('CAM_00_MASTER_OVERVIEW',(52,-71,34),(0,13,8),38)
cam('CAM_01_EFM',(-15.2,-4.8,1.55),(-14.03,-3,.95),44)
cam('CAM_02_LIGHTNING_SENSOR',(-21.1,9.9,2.2),(-19.98,12,1.49),49)
cam('CAM_09_LRX_RECEIVER',(-19.27,11.66,1.04),(-19.44,11.965,.712),54)
cam('CAM_07_TRANSLATOR',(14,-7,3.15),(11,-1.9,1.63),35)
# Dedicated architecture stage outside the environment's sightlines.
for o in list(s.objects):
    if o.name.startswith('Architecture_'): o.location.x+=300
cam('CAM_08_SYSTEM_ARCHITECTURE',(300,50,8),(300,70,8),50)
# Conceal translator front sign in its close view by placing it beside the stage.
for o in s.objects:
    if o.name.startswith('Translator_Zone'): o.location.x+=4.8; o.location.y+=3.0
# Procedural demonstration chime, packed into the .blend.
audio=os.path.join(ROOT,'Assets','demo_alert.wav')
rate=22050
with wave.open(audio,'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate)
    samples=[]
    for i in range(rate*2):
        t=i/rate; gate=1 if t%0.5<.25 else 0
        amp=.13*gate*math.sin(2*math.pi*(660 if t<1 else 880)*t)
        samples.append(struct.pack('<h',int(amp*32767)))
    f.writeframes(b''.join(samples))
ed=s.sequence_editor_create()
try:
    strips=ed.strips if hasattr(ed,'strips') else ed.sequences
    strip=strips.new_sound('DEMO_ALERT_CHIME_NOT_OPERATIONAL',audio,channel=1,frame_start=350)
    strip.volume=.4
except Exception as exc: print('AUDIO_STRIP_NOTE',exc)
s.render.use_sequencer=False
tx=bpy.data.texts.get('presentation_controls.py') or bpy.data.texts.new('presentation_controls.py'); tx.clear(); tx.write(open(os.path.join(ROOT,'scripts','presentation_controls.py')).read())
bpy.data.texts['READ_ME_FIRST'].write('\nOptional controls: run presentation_controls.py in the Text Editor, then use the 3D View Exhibition sidebar. Demo alert chime at frame 350.\n')
for curve in bpy.data.actions:
    pass
s.frame_set(0); s.camera=bpy.data.objects['CAM_00_MASTER_OVERVIEW']; s.render.resolution_percentage=100
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Dhruva_Defence_Ecosystem.blend'))
print('FINAL_SCENE_SAVED',flush=True)
