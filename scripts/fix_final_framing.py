import bpy, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
o=bpy.data.objects['CAM_04_EARLY_WARNING']; o.location=(1.5,-4.5,2.45); o.rotation_euler=(Vector((-.8,-1,1.35))-o.location).to_track_quat('-Z','Y').to_euler(); o.data.lens=32
empty=bpy.data.collections.get('Collection')
if empty and not empty.objects and not empty.children: bpy.data.collections.remove(empty)
bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Dhruva_Defence_Ecosystem.blend'))
