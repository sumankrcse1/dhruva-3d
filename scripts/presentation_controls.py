"""Optional Blender UI. Run once in Blender's Text Editor to add an Exhibition sidebar."""
import bpy, json

class DHRUVA_OT_camera(bpy.types.Operator):
    bl_idname='dhruva.camera'
    bl_label='Show presentation view'
    name:bpy.props.StringProperty()
    def execute(self,context):
        bindings={m.name:m.camera.name for m in context.scene.timeline_markers if m.camera}
        if bindings: context.scene['dhruva_saved_camera_bindings']=json.dumps(bindings)
        for marker in context.scene.timeline_markers:
            if marker.camera:
                marker.camera=None
        context.scene.camera=bpy.data.objects.get(self.name)
        for area in context.screen.areas:
            if area.type=='VIEW_3D': area.spaces.active.region_3d.view_perspective='CAMERA'
        return {'FINISHED'}

class DHRUVA_OT_timeline(bpy.types.Operator):
    bl_idname='dhruva.timeline'
    bl_label='Restore timeline camera cuts'
    def execute(self,context):
        bindings=json.loads(context.scene.get('dhruva_saved_camera_bindings','{}'))
        for marker in context.scene.timeline_markers:
            name=bindings.get(marker.name)
            if name: marker.camera=bpy.data.objects.get(name)
        context.scene.frame_set(context.scene.frame_current)
        return {'FINISHED'}

class DHRUVA_OT_state(bpy.types.Operator):
    bl_idname='dhruva.state'
    bl_label='Show demonstration state'
    frame:bpy.props.IntProperty()
    def execute(self,context):
        context.scene.frame_set(self.frame)
        return {'FINISHED'}

class DHRUVA_PT_exhibition(bpy.types.Panel):
    bl_label='Dhruva Defence / Exhibition'
    bl_idname='DHRUVA_PT_exhibition'
    bl_space_type='VIEW_3D'; bl_region_type='UI'; bl_category='Exhibition'
    def draw(self,context):
        layout=self.layout
        layout.label(text='Fictional site / concept visualization')
        for name,label in [('CAM_00_MASTER_OVERVIEW','Master overview'),('CAM_01_EFM','EFM installation'),('CAM_02_LIGHTNING_SENSOR','ANT-50 sensor'),('CAM_09_LRX_RECEIVER','LRX-1 receiver'),('CAM_03_LIGHTNING_NETWORK','Distributed network'),('CAM_04_EARLY_WARNING','Early warning'),('CAM_05_SOLDIER_WEARABLE','Wearable concept'),('CAM_06_COMMAND_CENTER','Command application'),('CAM_07_TRANSLATOR','Translator concept'),('CAM_08_SYSTEM_ARCHITECTURE','End-to-end architecture')]:
            op=layout.operator('dhruva.camera',text=label); op.name=name
        layout.operator('dhruva.timeline',text='Restore timeline camera cuts')
        col=bpy.data.collections.get('08_DATA_VISUALIZATION')
        layout.prop(col,'hide_viewport',text='Hide information links')
        layout.prop(col,'hide_render',text='Hide links in renders')
        row=layout.row(align=True)
        for label,frame in [('Normal',300),('Caution',325),('Alert',360)]: row.operator('dhruva.state',text=label).frame=frame
        ctrl=bpy.data.objects.get('SYSTEM_DEMO_CONTROLS')
        if ctrl:
            layout.label(text='Thresholds unconfirmed / not operational')
            layout.prop(ctrl,'["caution_threshold_kVm"]',text='Caution kV/m')
            layout.prop(ctrl,'["alert_threshold_kVm"]',text='Alert kV/m')

classes=[DHRUVA_OT_camera,DHRUVA_OT_timeline,DHRUVA_OT_state,DHRUVA_PT_exhibition]
def register():
    for cls in classes:
        old=getattr(bpy.types,cls.__name__,None)
        if old: bpy.utils.unregister_class(old)
        bpy.utils.register_class(cls)
if __name__=='__main__': register()
