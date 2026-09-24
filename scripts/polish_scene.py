import bpy, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s=bpy.context.scene
# Continuous snow transition and mineral detail avoid polygon-shaped snow patches.
m=bpy.data.materials.new('MAT_Mountain_Strata_Snow'); m.use_nodes=True
nt=m.node_tree; bs=nt.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.92
geo=nt.nodes.new('ShaderNodeNewGeometry'); sep=nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'],sep.inputs[0])
n=nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=.65; n.inputs['Detail'].default_value=5; nt.links.new(geo.outputs['Position'],n.inputs[0])
r=nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color=(.12,.115,.10,1); r.color_ramp.elements[1].color=(.42,.39,.33,1); nt.links.new(n.outputs['Fac'],r.inputs[0])
height=nt.nodes.new('ShaderNodeMapRange'); height.inputs['From Min'].default_value=13; height.inputs['From Max'].default_value=21; nt.links.new(sep.outputs['Z'],height.inputs['Value'])
mix=nt.nodes.new('ShaderNodeMixRGB'); mix.inputs[2].default_value=(.80,.89,.95,1); nt.links.new(height.outputs[0],mix.inputs[0]); nt.links.new(r.outputs[0],mix.inputs[1]); nt.links.new(mix.outputs[0],bs.inputs['Base Color'])
b=nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=.5; b.inputs['Distance'].default_value=.32; nt.links.new(n.outputs[0],b.inputs['Height']); nt.links.new(b.outputs[0],bs.inputs['Normal'])
o=bpy.data.objects['Fictional_mountain_landscape']; o.data.materials.clear(); o.data.materials.append(m)
for f in o.data.polygons: f.material_index=0
# Put early-warning camera inside the exhibit sign line.
o=bpy.data.objects['CAM_04_EARLY_WARNING']; o.location=(1,-3.6,2.25); o.rotation_euler=(Vector((-.8,-1,1.6))-o.location).to_track_quat('-Z','Y').to_euler(); o.data.lens=37
col=bpy.data.collections['03_WARNING_SYSTEM']
for name,p,d in [('Notification_StandStem',(-.53,-1.1,.65),(.025,.025,1.28)),('Notification_StandFoot',(-.53,-1.1,.035),(.22,.22,.045))]:
    bpy.ops.mesh.primitive_cube_add(size=1,location=p); o=bpy.context.object; o.name=name; o.dimensions=d; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(bpy.data.materials['MAT_Aluminium_Black'])
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
source=bpy.data.objects['SOLDIER_02_PLACEHOLDER_GENERIC_PERSONNEL']; root=source.copy(); root.name='COMMANDER_01_PLACEHOLDER_GENERIC_PERSONNEL'; bpy.data.collections['05_COMMAND_CENTER'].objects.link(root); root.location=(1.8,8.0,0)
for child in source.children:
    new=child.copy(); new.name='COMMANDER_01_'+child.name.split('_',2)[-1]; bpy.data.collections['05_COMMAND_CENTER'].objects.link(new); new.parent=root
# Narrower sign text stays visible at exhibition scale; original branding remains packed.
s.frame_set(0); s.camera=bpy.data.objects['CAM_00_MASTER_OVERVIEW']; s.render.resolution_percentage=100
s.cycles.samples=48; s.cycles.adaptive_threshold=.06; s.cycles.use_denoising=True
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Dhruva_Defence_Ecosystem.blend'))
print('POLISH_COMPLETE',flush=True)
