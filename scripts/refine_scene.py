import bpy, math, random, os
from mathutils import Vector, noise
from math import sin,cos,pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(24); s=bpy.context.scene
env=bpy.data.collections['00_ENVIRONMENT']
rock=bpy.data.materials['MAT_Rock']; snow=bpy.data.materials['MAT_Snow']
for o in list(env.objects):
    if o.name.startswith('Himalayan_fictional_ridge'): bpy.data.objects.remove(o,do_unlink=True)
for j in range(2):
    for k in range(9):
        x=-100+k*25+random.uniform(-4,4); y=65+j*36; peak=random.uniform(24,40)+j*14
        sectors=96; rings=45; verts=[(x,y,peak)]
        for ri in range(1,rings+1):
            r=ri/rings
            for aidx in range(sectors):
                a=aidx*2*pi/sectors
                xx=x+cos(a)*r*34; yy=y+sin(a)*r*25
                ridge=.88+.12*sin(a*7+1.1)+.07*cos(a*13)
                zz=peak*(1-r)**1.1*ridge+noise.fractal(Vector((xx*.21,yy*.21,r*3)),1,2,5)*2.8*sin(r*pi)
                verts.append((xx,yy,zz-1.5))
        faces=[(0,1+i,1+(i+1)%sectors) for i in range(sectors)]
        for ri in range(rings-1):
            for i in range(sectors):
                a=1+ri*sectors+i; b=1+ri*sectors+(i+1)%sectors; c=b+sectors; d=a+sectors
                faces.extend([(a,d,b),(b,d,c)])
        me=bpy.data.meshes.new('Mountain_ridgeline_mesh'); me.from_pydata(verts,[],faces); me.update()
        o=bpy.data.objects.new('Himalayan_fictional_ridge_%d_%d'%(j,k),me); env.objects.link(o); me.materials.append(rock); me.materials.append(snow)
        for f in me.polygons:
            z=sum(me.vertices[v].co.z for v in f.vertices)/len(f.vertices)
            f.material_index=int(z>peak*.36+noise.noise(f.center*.22)*2 and f.normal.z>.32)
            f.use_smooth=True
# Fine gravel surface with warm, restrained mineral variation.
m=bpy.data.materials['MAT_Concrete']; nt=m.node_tree
n=nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=3.2; n.inputs['Detail'].default_value=5
r=nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color=(.20,.19,.16,1); r.color_ramp.elements[1].color=(.45,.42,.34,1)
nt.links.new(n.outputs['Fac'],r.inputs[0]); nt.links.new(r.outputs[0],nt.nodes.get('Principled BSDF').inputs['Base Color'])
for o in env.objects:
    if o.name.startswith('Foreground_talus'):
        sub=o.modifiers.new('Eroded_surface','SUBSURF'); sub.levels=1
        for f in o.data.polygons: f.use_smooth=True
# Wider elevation keeps the whole installation and snow ridgelines in the overview.
cam=bpy.data.objects['CAM_00_MASTER_OVERVIEW']; cam.location=(64,-87,44); cam.rotation_euler=(Vector((0,12,7))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.lens=43
# Correct information panels mounted to stanchions rather than floating.
for n in ['EFM_ProcessDisplay','Translator_Workflow']:
    o=bpy.data.objects[n+'_Frame']; x,y,z=o.location
    for dx in [-o.dimensions.x*.33,o.dimensions.x*.33]:
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x+dx,y,(z-o.dimensions.z/2)/2)); leg=bpy.context.object; leg.name=n+'_Stanchion'; leg.dimensions=(.045,.045,z-o.dimensions.z/2); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); leg.data.materials.append(bpy.data.materials['MAT_Aluminium_Black'])
        for c in list(leg.users_collection): c.objects.unlink(leg)
        o.users_collection[0].objects.link(leg)
# Bright daylight exposure retains realistic material colors.
bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs[1].default_value=.65
bpy.data.lights['Sun_ClearAltitude'].energy=3.0
s.view_settings.look='AgX - Medium High Contrast'; s.view_settings.exposure=.5
for o in s.objects:
    if o.name.startswith('PLACEHOLDER_HealthWatch') or o.name=='Watch_UnconfirmedUI': o.location.z+=.06
watch=bpy.data.objects['PLACEHOLDER_HealthWatch_Strap']; watch.hide_render=True; watch.hide_viewport=True
bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=12,location=(-5.20,-5.24,1.255),major_radius=.057,minor_radius=.008)
band=bpy.context.object; band.name='PLACEHOLDER_HealthWatch_WristBand'; band.rotation_euler=Vector((.08,-.17,.08)).to_track_quat('Z','Y').to_euler(); band.data.materials.append(bpy.data.materials['MAT_Rubber_Black'])
for c in list(band.users_collection): c.objects.unlink(band)
bpy.data.collections['04_SOLDIER_WEARABLE'].objects.link(band)
camw=bpy.data.objects['CAM_05_SOLDIER_WEARABLE']; camw.location=(-5.36,-5.55,1.64); camw.rotation_euler=(Vector((-5.20,-5.24,1.31))-camw.location).to_track_quat('-Z','Y').to_euler(); camw.data.lens=58
camc=bpy.data.objects['CAM_06_COMMAND_CENTER']; camc.location=(2,3.5,2.9); camc.rotation_euler=(Vector((2,11.9,2))-camc.location).to_track_quat('-Z','Y').to_euler(); camc.data.lens=30
# Keep procedural builder parenting deterministic on rebuild as well.
s.frame_set(0); s.camera=cam; s.render.resolution_percentage=100
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Dhruva_Defence_Ecosystem.blend'))
for name,folder in [('04_SOLDIER_WEARABLE','HealthWatch_Personnel'),('06_TRANSLATOR','TranslatorDevice')]:
    bpy.data.libraries.write(os.path.join(ROOT,'Assets',folder,folder+'.blend'),{bpy.data.collections[name]},fake_user=True)
print('REFINE_COMPLETE',flush=True)
