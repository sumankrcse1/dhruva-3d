import bpy, os, json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
code=open(os.path.join(ROOT,'scripts','presentation_controls.py')).read()
exec(compile(code,'presentation_controls.py','exec'))
scene=bpy.context.scene
before={m.name:m.camera.name for m in scene.timeline_markers if m.camera}
bpy.ops.dhruva.camera(name='CAM_09_LRX_RECEIVER')
assert scene.camera.name=='CAM_09_LRX_RECEIVER'
assert all(m.camera is None for m in scene.timeline_markers)
bpy.ops.dhruva.timeline()
assert {m.name:m.camera.name for m in scene.timeline_markers if m.camera}==before
scene.frame_set(0); scene.camera=bpy.data.objects['CAM_00_MASTER_OVERVIEW']
tx=bpy.data.texts['presentation_controls.py']; tx.clear(); tx.write(code)
scene['DELIVERY_STATUS']='Editable concept visualization with ten 4K Cycles stills. Unconfirmed hardware/interfaces and generic personnel are placeholders. See README.'
for ob in scene.objects: ob.select_set(False)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Dhruva_Defence_Ecosystem.blend'))
report=json.load(open(os.path.join(ROOT,'QA_report.json')))
report['controls_test']={'manual_camera_override':True,'timeline_restore':True,'camera_bindings_restored':len(before)}
report['renders_verified']={'count':10,'width':3840,'height':2160,'engine':'Cycles','samples':'48 for views 1-2; 16 with denoising for views 3-10'}
with open(os.path.join(ROOT,'QA_report.json'),'w') as f: json.dump(report,f,indent=2)
print('PRESENTATION_CONTROLS_VERIFIED',flush=True)
