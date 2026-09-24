import bpy, os, json, bmesh
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
specs=[
 ('EFM100',lambda n:n.startswith('EFM_') and not n.startswith(('EFM_Zone','EFM_Process','EFM_Flow','EFM_Graph','EFM_History')),(-14,-3,0)),
 ('LRX1',lambda n:n.startswith('NODE_01_LRX1'),(-19.44,11.965,.711)),
 ('ANT50',lambda n:n.startswith('NODE_01_ANT50'),(-19.93,12,1.7)),
 ('HealthWatch',lambda n:n.startswith('PLACEHOLDER_HealthWatch') or n=='Watch_UnconfirmedUI',(-5.20,-5.24,1.315)),
 ('AndroidDevice',lambda n:n.startswith('Commander_Android') or n=='Android_Notification',(-.53,-1.1,1.3)),
 ('Soldier',lambda n:n.startswith('SOLDIER_01'),(-5,-5,0)),
 ('TranslatorDevice',lambda n:n.startswith('PLACEHOLDER_TranslatorAndroid') or n=='Translator_DeviceUI',(10.2,-3.30,1.3))]
exports={}
for name,predicate,origin in specs:
    coll=bpy.data.collections.new('ASSET_'+name); coll.asset_mark()
    for ob in list(bpy.context.scene.objects):
        if not predicate(ob.name) or ob.type=='EMPTY': continue
        cp=ob.copy(); cp.data=ob.data; matrix=ob.matrix_world.copy(); cp.parent=None; matrix.translation-=Vector(origin); cp.matrix_world=matrix; coll.objects.link(cp)
    folder=os.path.join(ROOT,'Assets',name); os.makedirs(folder,exist_ok=True)
    path=os.path.join(folder,name+'.blend'); bpy.data.libraries.write(path,{coll},fake_user=True); exports[name]=len(coll.objects)
    for ob in list(coll.objects): bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.collections.remove(coll)
report=json.load(open(os.path.join(ROOT,'QA_report.json')))
report['object_count']=len(bpy.context.scene.objects)
report['camera_count']=sum(o.type=='CAMERA' for o in bpy.context.scene.objects)
report['packed_images']=[im.name for im in bpy.data.images if im.packed_file]
report['packed_fonts']=[f.name for f in bpy.data.fonts if f.packed_file]
report['reusable_product_exports']=exports
report['hero_raw_mesh_topology']={}
for ob in bpy.context.scene.objects:
    if ob.type=='MESH' and (ob.name.startswith('EFM_') or ob.name.startswith('NODE_01_LRX1') or ob.name.startswith('NODE_01_ANT50')):
        bm=bmesh.new(); bm.from_mesh(ob.data); bad=sum(not e.is_manifold for e in bm.edges); bm.free()
        report['hero_raw_mesh_topology'][ob.name]={'nonmanifold_edges':bad}
report['visual_review_limits']=['Inspected camera previews and final render contact sheet; not an exhaustive geometric collision certification.','Generic personnel and unconfirmed wearable/interface models remain concept placeholders.','No LOD switching system or photoreal scanned personnel provided.','Blender 4.x compatibility not tested; source scripts use the installed Blender 5.2.2.']
with open(os.path.join(ROOT,'QA_report.json'),'w') as f: json.dump(report,f,indent=2)
print('EXPORTS',exports,flush=True)
