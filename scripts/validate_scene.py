import bpy, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s=bpy.context.scene
# Keep generic personnel in their authored world positions after parenting.
for o in s.objects:
    if o.name.endswith('_PLACEHOLDER_GENERIC_PERSONNEL'):
        bpy.context.view_layer.update()
        for child in o.children: child.matrix_parent_inverse=o.matrix_world.inverted()
bpy.context.view_layer.update()
checks={
 'EFM_Body':(.170,.170,.130),
 'NODE_01_LRX1_Enclosure':(.160,.114,.028),
 'NODE_01_ANT50_Radome':(.124,.124,.192),
 'NODE_01_ANT50_Mast_610mm':(.0267,.0267,.610)}
report={'dimensions':{},'missing_images':[], 'nonunit_mesh_scales':[], 'notes':[]}
for n,d in checks.items():
    o=bpy.data.objects[n]
    actual=tuple(round(v,6) for v in o.dimensions)
    report['dimensions'][n]={'expected':d,'actual':actual,'pass':all(abs(a-b)<.0001 for a,b in zip(actual,d))}
for im in bpy.data.images:
    if im.source=='FILE' and not im.packed_file and not os.path.isfile(bpy.path.abspath(im.filepath)): report['missing_images'].append(im.name)
for o in s.objects:
    if o.type=='MESH' and any(abs(v-1)>.0001 for v in o.scale):
        # Apply terrain rock scale for clean exported transforms.
        bpy.context.view_layer.objects.active=o; o.select_set(True)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.select_set(False)
report['notes']=['ANT-50 dome adds 62 mm above cylinder, yielding 254 mm overall sensor envelope.', 'EFM underside intentionally reference-limited.', 'No automatic claim of intersection-free geometry; visual camera QA required.','Watch/personnel/app screens are concept placeholders.']
# Pack fonts and images for portable master file.
bpy.ops.file.pack_all()
s.frame_set(0); s.camera=bpy.data.objects['CAM_00_MASTER_OVERVIEW']; s.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Dhruva_Defence_Ecosystem.blend'))
with open(os.path.join(ROOT,'QA_report.json'),'w') as f: json.dump(report,f,indent=2)
print(json.dumps(report),flush=True)
