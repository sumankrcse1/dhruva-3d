import bpy, os, sys, json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene=bpy.context.scene
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
preview='preview' in args
if 'gpu' in args:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'; prefs.get_devices()
    for device in prefs.devices: device.use=device.type=='METAL'
    scene.cycles.device='GPU'
scene.render.resolution_percentage=30 if preview else 100
scene.cycles.samples=16 if preview else 48
if 'delivery' in args:
    scene.cycles.samples=16
    scene.cycles.adaptive_threshold=.10
    scene.cycles.max_bounces=4
    scene.cycles.diffuse_bounces=2
    scene.cycles.glossy_bounces=2
scene.cycles.use_denoising=True
# Render evaluation otherwise reapplies timeline camera bindings.
for marker in scene.timeline_markers: marker.camera=None
views=[
 ('01_Master_overview','CAM_00_MASTER_OVERVIEW',0),
 ('02_EFM_closeup','CAM_01_EFM',100),
 ('03_ANT50_closeup','CAM_02_LIGHTNING_SENSOR',200),
 ('04_LRX1_receiver','CAM_09_LRX_RECEIVER',200),
 ('05_Lightning_network','CAM_03_LIGHTNING_NETWORK',240),
 ('06_Wearable_concept','CAM_05_SOLDIER_WEARABLE',400),
 ('07_Command_application_concept','CAM_06_COMMAND_CENTER',500),
 ('08_Translator_concept','CAM_07_TRANSLATOR',600),
 ('09_End_to_end_architecture','CAM_08_SYSTEM_ARCHITECTURE',700),
 ('10_Emergency_alert','CAM_04_EARLY_WARNING',360)]
selected=[a for a in args if a.isdigit()]
for idx,(name,cam,frame) in enumerate(views,1):
    if selected and str(idx) not in selected: continue
    scene.frame_set(frame); scene.camera=bpy.data.objects[cam]
    bpy.data.collections['08_DATA_VISUALIZATION'].hide_render=idx not in [1,5,9]
    if idx==10:
        bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs[1].default_value=.018
        bpy.data.lights['Sun_ClearAltitude'].energy=.035
        d=bpy.data.lights.new('Emergency_MoonFill','AREA'); d.energy=90; d.color=(.35,.51,1); d.shape='DISK'; d.size=5
        ob=bpy.data.objects.new('Emergency_MoonFill',d); scene.collection.objects.link(ob); ob.location=(0,-3,5)
        d=bpy.data.lights.new('Alert_RedSpill','POINT'); d.energy=20; d.color=(1,.025,.006); d.shadow_soft_size=.3
        ob=bpy.data.objects.new('Alert_RedSpill',d); scene.collection.objects.link(ob); ob.location=(-1,-1,2.6)
    scene.render.filepath=os.path.join(ROOT,'renders',('QA_' if preview else '')+name+'.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER_COMPLETE',name,flush=True)
