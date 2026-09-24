import bpy, math, random, os, json
from mathutils import Vector, noise
from math import sin, cos, pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(24)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
names=['00_ENVIRONMENT','01_EFM_ZONE','02_LIGHTNING_NETWORK','03_WARNING_SYSTEM','04_SOLDIER_WEARABLE','05_COMMAND_CENTER','06_TRANSLATOR','07_OPTIONAL_BORDER_TECH','08_DATA_VISUALIZATION','09_LIGHTING','10_CAMERAS','11_PRESENTATION_UI']
cols={n:bpy.data.collections.new(n) for n in names}
for c in cols.values(): scene.collection.children.link(c)
C=cols[names[0]]
def zone(i):
    global C
    C=cols[names[i]]
def finish(o,n,m=None):
    o.name=n
    for c in list(o.users_collection): c.objects.unlink(o)
    C.objects.link(o)
    if m: o.data.materials.append(m)
    return o
def mat(n,c,metal=0,rough=.5,emit=0):
    m=bpy.data.materials.new(n); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if emit: p.inputs['Emission Color'].default_value=(*c,1); p.inputs['Emission Strength'].default_value=emit
    return m
alu=mat('MAT_Aluminium_Brushed',(.57,.62,.67),.83,.27)
black=mat('MAT_Aluminium_Black',(.022,.03,.041),.72,.32)
steel=mat('MAT_StainlessSteel',(.42,.48,.5),.9,.24)
grey=mat('MAT_PowderCoat_Grey',(.22,.27,.28),.25,.6)
white=mat('MAT_Polycarbonate_White',(.83,.85,.84),0,.34)
rubber=mat('MAT_Rubber_Black',(.014,.019,.022),0,.83)
glass=mat('MAT_Glass_Display',(.018,.035,.047),.15,.18)
green=mat('MAT_LED_Green',(.11,.75,.37),0,.3,2)
amber=mat('MAT_LED_Amber',(.95,.42,.06),0,.3,2)
red=mat('MAT_LED_Red',(.95,.045,.025),0,.3,2)
screen=mat('MAT_Screen',(.008,.021,.033),0,.65,.3)
cable=mat('MAT_Cable',(.025,.032,.028),0,.85)
concrete=mat('MAT_Concrete',(.37,.38,.34),0,.92)
rock=mat('MAT_Rock',(.28,.255,.22),0,.96)
snow=mat('MAT_Snow',(.83,.9,.94),0,.85)
asphalt=mat('MAT_Asphalt',(.075,.092,.098),0,.92)
army=mat('MAT_ArmyFabric',(.17,.19,.105),0,.9)
tan=mat('MAT_Fabric_Tan',(.32,.28,.16),0,.92)
skin=mat('MAT_Skin',(.3,.17,.10),0,.63)
ink=mat('MAT_UI_Ivory',(.79,.87,.91),0,.55,.7)
muted=mat('MAT_UI_Muted',(.29,.43,.49),0,.7,.4)
cyan=mat('MAT_UI_SensorData',(.04,.59,.75),.2,.4,1.3)
gold=mat('MAT_UI_Gold',(.83,.54,.16),.35,.45,.5)
violet=mat('MAT_UI_Translation',(.51,.37,.78),0,.4,1)
for m,scale,strength in [(rock,9,.22),(concrete,30,.12),(army,170,.14),(alu,220,.08),(asphalt,80,.12)]:
    nt=m.node_tree; t=nt.nodes.new('ShaderNodeTexNoise'); t.inputs['Scale'].default_value=scale
    b=nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=strength; b.inputs['Distance'].default_value=.025 if m!=alu else .0001
    nt.links.new(t.outputs['Fac'],b.inputs['Height']); nt.links.new(b.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
# Procedural woven camouflage, no external texture dependency.
nt=army.node_tree; t=nt.nodes.new('ShaderNodeTexNoise'); t.inputs['Scale'].default_value=13; t.inputs['Detail'].default_value=2
r=nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].position=.35; r.color_ramp.elements[0].color=(.055,.07,.036,1); r.color_ramp.elements[1].position=.65; r.color_ramp.elements[1].color=(.30,.27,.15,1)
nt.links.new(t.outputs['Fac'],r.inputs[0]); nt.links.new(r.outputs[0],nt.nodes.get('Principled BSDF').inputs['Base Color'])
def bevel(o,w=.02):
    b=o.modifiers.new('Manufactured edge radii','BEVEL'); b.width=w; b.segments=3
    o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
def box(n,p,d,m,b=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p); o=finish(bpy.context.object,n,m); o.dimensions=d
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if b: bevel(o,b)
    return o
def cyl(n,p,r,h,m,verts=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=h,location=p); o=finish(bpy.context.object,n,m); bevel(o,min(.002,r*.08))
    for f in o.data.polygons: f.use_smooth=True
    return o
def ell(n,p,s,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=p); o=finish(bpy.context.object,n,m); o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for f in o.data.polygons: f.use_smooth=True
    return o
def line(n,pts,r,m,smooth=False):
    cu=bpy.data.curves.new(n,'CURVE'); cu.dimensions='3D'; cu.resolution_u=16; cu.bevel_depth=r; cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER' if smooth else 'POLY')
    if smooth:
        sp.bezier_points.add(len(pts)-1)
        for v,p in zip(sp.bezier_points,pts): v.co=p; v.handle_left_type='AUTO'; v.handle_right_type='AUTO'
    else:
        sp.points.add(len(pts)-1)
        for v,p in zip(sp.points,pts): v.co=(*p,1)
    o=bpy.data.objects.new(n,cu); C.objects.link(o); cu.materials.append(m); return o
def rod(n,a,b,r,m): return line(n,[a,b],r,m)
font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial.ttf')
bold=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
def text(n,body,p,size,m=ink,rot=(pi/2,0,0),heavy=False):
    cu=bpy.data.curves.new(n,'FONT'); cu.body=body; cu.size=size; cu.font=bold if heavy else font; cu.extrude=0; cu.space_line=1.22
    o=bpy.data.objects.new(n,cu); C.objects.link(o); o.location=p; o.rotation_euler=rot; cu.materials.append(m); return o
def empty(n,p):
    o=bpy.data.objects.new(n,None); C.objects.link(o); o.location=p; o.empty_display_type='CIRCLE'; o.empty_display_size=.4; return o
def asset(n,objects):
    root=empty(n,(0,0,0)); root.asset_mark()
    for o in objects: o.parent=root
    return root
def sign(n,title,sub,x,y,w=5):
    box(n+'_Board',(x,y,1.8),(w,.10,.95),black)
    box(n+'_Rule',(x-w/2+.08,y-.065,1.8),(.04,.012,.7),gold,.003)
    text(n+'_Title',title,(x-w/2+.23,y-.061,1.99),.19,ink,heavy=True)
    text(n+'_Subtitle',sub,(x-w/2+.23,y-.061,1.65),.105,muted)
    for dx in [-w*.36,w*.36]: box(n+'_Support',(x+dx,y,.68),(.05,.05,1.35),black)
def panel(n,p,w,h):
    x,y,z=p; box(n+'_Frame',p,(w+.07,.09,h+.07),black,.025); box(n+'_Screen',(x,y-.051,z),(w,.012,h),screen,.003)
    return y-.061
def logo(n,p,w):
    img=bpy.data.images.load(os.path.join(ROOT,'references/Dhruva_Defence_logo.png'),check_existing=True); img.pack()
    m=bpy.data.materials.get('MAT_Original_Dhruva_Logo')
    if not m:
        m=mat('MAT_Original_Dhruva_Logo',(1,1,1),0,.8)
        nt=m.node_tree; t=nt.nodes.new('ShaderNodeTexImage'); t.image=img
        bs=nt.nodes.get('Principled BSDF'); nt.links.new(t.outputs['Color'],bs.inputs['Base Color']); nt.links.new(t.outputs['Color'],bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value=.35
    bpy.ops.mesh.primitive_plane_add(size=1,location=p,rotation=(pi/2,0,0)); o=finish(bpy.context.object,n,m); o.scale=(w,w*img.size[1]/img.size[0],1); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return o

# TERRAIN: fictional installation; flat operational platform, eroded rock foothills.
zone(0)
box('Exhibition_geological_base',(0,2,-1.25),(57,43,2.4),rock,.7)
box('Installation_gravel_platform',(0,2,-.10),(51,37,.22),concrete,.3)
box('Vehicle_route',(0,-11,.028),(49,3.5,.035),asphalt,.1)
for x in range(-23,24,4): box('Road_center_dash',(x,-11,.052),(1.8,.055,.008),white,.002)
for j in range(2):
    for k in range(9):
        x=-75+k*19+random.uniform(-4,4); y=48+j*28; peak=random.uniform(20,38)+j*9
        verts=[(x,y,peak)]; rings=13; sectors=36
        for ri in range(1,rings+1):
            r=ri/rings
            for s in range(sectors):
                a=s*2*pi/sectors; xx=x+cos(a)*r*24; yy=y+sin(a)*r*18
                zz=peak*(1-r)**1.35 + noise.fractal(Vector((xx*.15,yy*.15,r*2)),1,2,4)*3.5*r
                verts.append((xx,yy,zz-1))
        faces=[]
        for s in range(sectors): faces.append((0,1+s,1+(s+1)%sectors))
        for ri in range(rings-1):
            for s in range(sectors):
                a=1+ri*sectors+s; b=1+ri*sectors+(s+1)%sectors; c=b+sectors; d=a+sectors
                faces.extend([(a,b,d),(b,c,d)])
        me=bpy.data.meshes.new('Eroded_ridge_mesh'); me.from_pydata(verts,[],faces); me.update(); ob=bpy.data.objects.new('Himalayan_fictional_ridge_%s_%s'%(j,k),me); C.objects.link(ob); me.materials.append(rock); me.materials.append(snow)
        for f in me.polygons:
            z=sum(me.vertices[i].co.z for i in f.vertices)/len(f.vertices)
            f.material_index=int(z>peak*.47+random.random()*3 and f.normal.z>.23)
        bevel(ob,.08)
for i in range(230):
    x=random.uniform(-28,28); y=random.uniform(-19,24)
    if abs(x)<24 and -15<y<19: continue
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,random.uniform(-.05,.3)))
    o=finish(bpy.context.object,'Foreground_talus_%03d'%i,rock); o.scale=(random.uniform(.2,1.1),random.uniform(.25,.9),random.uniform(.25,1))
for y in [-16,20]:
    for x in range(-25,26,3):
        if y==-16 and abs(x)<4: continue
        cyl('Perimeter_post',(x,y,1.05),.037,2.1,steel,16)
    for z in [.35,.75,1.15,1.55,1.9]:
        for lo,hi in ([(-25,-4),(4,25)] if y==-16 else [(-25,25)]): rod('Perimeter_horizontal_wire',(lo,y,z),(hi,y,z),.008,steel)
    for x in range(-25,25):
        if y==-16 and abs(x)<4: continue
        rod('Fence_mesh_diagonal',(x,y,.2),(x+1,y,1.9),.004,steel); rod('Fence_mesh_cross',(x,y,1.9),(x+1,y,.2),.004,steel)
for x in [-25,25]:
    for y in range(-16,21,3): cyl('Side_fence_post',(x,y,1.05),.037,2.1,steel,16)
    for z in [.4,.8,1.2,1.6,1.9]: rod('Side_fence_wire',(x,-16,z),(x,20,z),.008,steel)

# EFM inverted assembly; overall sensor envelope 170 x 130 mm.
zone(1); EX,EY=-14,-3
box('EFM_ClearMeasurementPad',(EX,EY,.03),(3,3,.06),concrete,.04)
for x,y in [(EX-.48,EY-.28),(EX+.48,EY-.28),(EX,EY+.5)]:
    box('EFM_TripodFoot',(x,y,.085),(.13,.10,.05),steel,.005); rod('EFM_TripodLeg',(x,y,.1),(EX+.24,EY,.61),.016,steel)
rod('EFM_TripodMast',(EX+.24,EY,.27),(EX+.24,EY,1.02),.026,steel)
line('EFM_Inverted_CurvedSupport',[(EX+.28,EY,.57),(EX+.28,EY,1.04),(EX+.17,EY,1.25),(EX-.06,EY,1.44),(EX-.22,EY,1.37),(EX-.25,EY,1.19)],.014,steel,True)
cx=EX-.25; cz=1.105
cyl('EFM_Body',(cx,EY,cz),.085,.13,alu)
cyl('EFM_LowerHousing',(cx,EY,1.04),.084,.009,steel)
cyl('EFM_SensingFace_REFERENCE_LIMITED',(cx,EY,1.034),.073,.006,black)
for i in range(6):
    a=i*pi/3; cyl('EFM_PerimeterFastener',(cx+.077*cos(a),EY+.077*sin(a),1.031),.0027,.004,steel,6)
cyl('EFM_Seal',(cx,EY,1.174),.028,.008,rubber)
cyl('EFM_Mount_ThreeQuarterNPT_nominal',(cx,EY,1.186),.01335,.018,steel)
box('EFM_JunctionBox',(EX+.28,EY-.037,.48),(.10,.065,.13),grey,.008)
for z in [.445,.515]:
    for x in [EX+.245,EX+.315]:
        o=cyl('EFM_JunctionLidScrew',(x,EY-.073,z),.003,.004,steel,8); o.rotation_euler.x=pi/2
line('EFM_PowerData_DripLoop',[(EX+.28,EY-.045,.41),(EX+.34,EY-.04,.3),(EX+.42,EY,.34),(EX+.5,EY,.08),(EX+1.5,EY,.06),(EX+4,EY,.06)],.004,cable,True)
line('EFM_GroundBond',[(EX+.25,EY,.55),(EX+.18,EY+.04,.2),(EX+.5,EY+.4,.045)],.002,green)
text('EFM_Identification','EFM-100C',(cx-.057,EY-.085,1.12),.012,black)
text('EFM_IdentificationSub','ELECTRIC FIELD MILL',(cx-.057,EY-.085,1.098),.006,black)
sign('EFM_Zone','01 / ATMOSPHERIC ELECTRIC FIELD','EFM-100C  /  INVERTED INSTALLATION',EX,-7,5.8)
fy=panel('EFM_ProcessDisplay',(-9,-2,1.8),2.9,1.65)
text('EFM_ProcessTitle','MEASUREMENT TO ACTION',(-10.3,fy,2.42),.13,gold,heavy=True)
text('EFM_Flow','THUNDERCLOUD\nAtmospheric electric field\nEFM  >  RS485 / edge processing\nCommand application  >  configurable alert',(-10.3,fy,2.16),.106)
text('EFM_GraphCaption','kV/m     /     SYNTHETIC DEMO HISTORY',(-10.3,fy,1.47),.07,muted)
line('EFM_History',[( -10.25+i*.062,fy-.008,1.15+.08*sin(i*.6)+.004*i) for i in range(40)],.007,cyan)
empty('HOTSPOT_EFM',(EX,EY,1.15))

# Three separated illustrative network nodes; true-scale ANT-50 / LRX-1.
zone(2)
def receiver(x,y,z,prefix):
    box(prefix+'LRX1_Enclosure',(x,y,z),(.160,.114,.028),black,.002)
    box(prefix+'LRX1_TopLabel',(x,y,z+.0144),(.146,.101,.0006),grey,.001)
    text(prefix+'LRX1_Name','LRX-1',(x-.063,y-.006,z+.015),.009,ink,rot=(0,0,0),heavy=True)
    text(prefix+'LRX1_Sub','Lightning Network Receiver',(x-.063,y-.025,z+.015),.0041,ink,rot=(0,0,0))
    for i,lab in enumerate(['POWER','STRIKE','GPS','SERVER 1','SERVER 2','SERVER 3']):
        yy=y+.039-i*.010
        cyl(prefix+'LRX1_LED_'+lab,(x+.029,yy,z+.0153),.00135,.0008,amber if i==1 else green,16)
        text(prefix+'LRX1_Label_'+lab,lab,(x+.034,yy-.0014,z+.015),.0032,ink,rot=(0,0,0))
    for i,(lab,w) in enumerate([('USB HOST',.013),('ETHERNET',.015),('USB DEVICE',.009),('GPS',.015),('LIGHTNING SENSOR',.015)]):
        xx=x-.061+i*.025
        box(prefix+'LRX1_'+lab+'_MetalRim',(xx,y-.0573,z), (w+.002,.001,.009),steel,.0004)
        box(prefix+'LRX1_'+lab+'_Socket',(xx,y-.058,z),(w,.001,.007),rubber,.0003)
        text(prefix+'LRX1_PortLabel_'+lab,lab,(xx-w/2,y-.048,z+.015),.0023,ink,rot=(0,0,0))
    o=cyl(prefix+'LRX1_PowerJack',(x+.063,y-.058,z),.00275,.002,rubber,24); o.rotation_euler.x=pi/2
    for side in [-1,1]:
        box(prefix+'LRX1_MountEar',(x+side*.085,y,z-.01),(.012,.053,.002),black,.001)
        for dy in [-.02,.02]: cyl(prefix+'LRX1_MountBolt',(x+side*.085,y+dy,z-.008),.002,.003,steel,6)
    return (x,y,z)
nodes=[(-20,12),(19,14),(20,-5)]
for i,(x,y) in enumerate(nodes,1):
    p='NODE_%02d_'%i
    box(p+'Foundation',(x,y,.06),(1.1,1.1,.12),concrete)
    cyl(p+'SupportPole',(x,y,.8),.034,1.5,steel)
    cyl(p+'ANT50_Mast_610mm',(x+.07,y,1.395),.01335,.610,steel)
    # Dome + straight body total 254 mm, diameter 124 mm.
    cyl(p+'ANT50_Radome',(x+.07,y,1.796),.062,.192,white)
    ell(p+'ANT50_Dome',(x+.07,y,1.892),(.062,.062,.062),white)
    cyl(p+'ANT50_BaseSeam',(x+.07,y,1.705),.064,.011,white)
    for dz in [1.15,1.37]:
        box(p+'ANT50_ClampBracket',(x+.035,y,dz),(.105,.05,.024),steel,.003)
        for dx in [-.012,.088]: cyl(p+'ANT50_ClampBolt',(x+dx,y,dz+.017),.004,.012,steel,6)
    for dx in [.065,.077]: line(p+'ANT50_CAT5',[(x+dx,y,1.7),(x+dx,y+.025,1.15),(x+.35,y+.02,.9),(x+.43,y,.7)],.003,cable,True)
    # Open cabinet is a presentation cutaway, receiver protected in deployment.
    box(p+'CabinetBack',(x+.56,y+.14,.73),(.46,.035,.60),grey,.015)
    box(p+'CabinetLeft',(x+.33,y,.73),(.025,.3,.60),grey,.01)
    box(p+'CabinetRight',(x+.79,y,.73),(.025,.3,.60),grey,.01)
    for zz in [.43,.68,1.03]: box(p+'CabinetShelf',(x+.56,y,zz),(.47,.32,.025),grey,.005)
    receiver(x+.56,y-.035,.711,p)
    box(p+'PowerSupply_PLACEHOLDER',(x+.51,y,.52),(.15,.11,.075),black,.004)
    line(p+'ReceiverNetworkCable',[(x+.525,y-.094,.711),(x+.5,y-.16,.65),(x+.7,y-.14,.47),(x+.8,y,.12)],.003,cable,True)
    text(p+'CabinetLabel','CUTAWAY / RECEIVER + POWER',(x+.34,y-.17,.91),.026,ink)
    empty('HOTSPOT_LDS' if i==1 else p+'HOTSPOT',(x,y,1.9))
    sign(p+'Sign','02 / LIGHTNING NODE %02d'%i,'ANT-50  >  LRX-1  >  NETWORK',x,y+1.6,4.6)

# Command building: roof removed only for exhibition access.
zone(5)
box('Command_Foundation',(2,9,.15),(11,7,.3),concrete,.08)
box('Command_Floor',(2,9,.33),(10.6,6.6,.06),grey,.02)
box('Command_RearWall',(2,12.3,1.95),(10.7,.18,3.3),tan,.02)
for x in [-3.3,7.3]:
    box('Command_SideWall',(x,9,1.04),(.18,6.6,1.4),tan)
    for y in [5.7,12.3]: box('Command_FrameColumn',(x,y,2),(.13,.13,3.3),black,.01)
    box('Command_RoofEdge',(x,9,3.64),(.15,6.7,.16),black)
box('Command_RearBeam',(2,12.3,3.64),(10.8,.18,.16),black)
box('Command_FrontBeam',(2,5.7,3.64),(10.8,.18,.16),black)
logo('Command_OriginalBrand',(-1.72,12.195,2.55),2.0)
y=panel('Integrated_Command_Display',(3.0,12.17,2.17),5.7,2.30)
text('Dashboard_Title','DHRUVA / INTEGRATED OPERATIONS',(.28,y,3.12),.16,ink,heavy=True)
text('Dashboard_Concept','CONCEPT INTERFACE  /  SYNTHETIC DATA  /  FICTIONAL SITE',(.28,y,2.9),.072,gold)
for x0,title in [(.28,'ENVIRONMENT'),(2.17,'LIGHTNING NETWORK'),(4.08,'TEAM STATUS')]:
    text('Dashboard_Module_'+title,title,(x0,y,2.63),.105,cyan,heavy=True)
text('Dashboard_Field','EFM / kV/m\nDemo history\nWarning threshold: configurable',(.28,y,2.40),.095)
line('Dashboard_FieldGraph',[(.29+i*.041,y-.008,1.65+.10*sin(i*.4)+.004*i) for i in range(40)],.008,cyan)
for z in [1.65,1.9,2.15]: rod('Chart_Grid',(.28,y,z),(1.94,y,z),.002,muted)
for radius in [.22,.39,.57]: line('Map_UserDefinedRing',[(3.0+radius*cos(a*2*pi/64),y-.005,1.96+radius*sin(a*2*pi/64)) for a in range(65)],.003,muted)
for x,z in [(2.7,2.14),(3.3,2.2),(2.94,1.64)]:
    text('Map_Node','+', (x,y-.009,z),.10,cyan)
text('Map_Strike','x  12:00:08 DEMO',(2.97,y-.01,1.89),.069,amber)
text('Map_Disclaimer','SCHEMATIC / NO REAL COORDINATES',(2.18,y,1.25),.058,muted)
text('Dashboard_SoldierList','SOLDIER 01   /   PENDING\nSOLDIER 02   /   PENDING\nSOLDIER 03   /   PENDING\nSOLDIER 04   /   PENDING',(4.08,y,2.39),.093)
text('Dashboard_Metrics','Metrics withheld pending\nhardware confirmation',(4.08,y,1.61),.075,gold)
text('Dashboard_Log','EVENT LOG  /  DEMO   12:00 CAUTION  >  12:01 ALERT',(.28,y,1.12),.085,amber)
text('Dashboard_Footer','NODE HEALTH    |    TRANSLATOR ACCESS    |    SYSTEM STATUS',(.28,y,.99),.065,muted)
for x in [-.7,3.8]:
    box('Workstation_Desk',(x,9.7,1.07),(2.9,1.0,.075),black)
    for dx in [-1.25,1.25]: box('Workstation_DeskLeg',(x+dx,9.7,.71),(.06,.65,.66),steel)
    box('Rugged_Laptop_Base',(x,9.5,1.14),(.38,.27,.035),black,.015)
    yy=panel('Rugged_Laptop',(x,9.63,1.3),.36,.22)
    text('Laptop_UI','OPERATIONS\nDEMO / CONCEPT',(x-.16,yy,1.35),.025,cyan)
    for i in range(10): box('Keyboard_Key',(x-.14+i*.03,9.45,1.161),(.02,.08,.003),grey,.001)
    cyl('Chair_Base',(x,8.65,.42),.24,.055,black); cyl('Chair_Column',(x,8.65,.64),.035,.4,steel)
    box('Chair_Seat',(x,8.65,.85),(.48,.43,.1),rubber,.04); box('Chair_Back',(x,8.43,1.17),(.48,.08,.58),rubber,.06)
box('Server_Rack',(6.35,11.5,1.25),(.65,.7,1.8),black,.025)
for z in [ .6,.85,1.1,1.35,1.6,1.85]:
    box('Server_Drawer',(6.35,11.135,z),(.57,.04,.18),grey,.01)
    for dx in [-.21,-.16]: ell('Server_LinkLED',(6.35+dx,11.108,z),(.008,.003,.008),green)
text('Server_Label','PROCESSING\nSERVER',(6.1,11.1,2),.08,ink)
sign('Command_Zone','05 / COMMAND + CONTROL','SENSOR DATA  >  PROCESSING  >  OPERATOR ACTION',2,5.5,7)
empty('HOTSPOT_COMMAND',(2,9,2))

# Rugged device / human placeholders: visible generic operational clothing.
def phone(n,x,y,z,w=.085,h=.17):
    box(n+'_RuggedBody',(x,y,z),(w,.018,h),rubber,.008)
    py=panel(n+'_Display',(x,y-.012,z),w*.85,h*.82)
    for zz in [z-.03,z+.025]: box(n+'_SideButton',(x+w/2,y,zz),(.004,.008,.017),grey,.002)
    return py
def soldier(n,x,y,turn=0):
    before=set(C.objects)
    for dx in [-.10,.10]:
        ell(n+'_Boot',(x+dx,y-.055,.13),(.09,.16,.12),rubber)
        ell(n+'_TrouserLower',(x+dx,y,.40),(.087,.095,.26),army)
        ell(n+'_TrouserUpper',(x+dx,y,.76),(.105,.11,.24),army)
        box(n+'_KneePanel',(x+dx,y-.085,.57),(.12,.05,.15),tan,.025)
    ell(n+'_Pelvis',(x,y,.93),(.20,.12,.17),army)
    ell(n+'_Jacket',(x,y,1.20),(.245,.14,.31),army)
    box(n+'_Vest',(x,y-.115,1.24),(.36,.10,.34),tan,.04)
    for dx in [-.12,0,.12]: box(n+'_VestPouch',(x+dx,y-.18,1.23),(.09,.055,.13),army,.015)
    box(n+'_Belt',(x,y,1.01),(.37,.27,.04),rubber,.008)
    cyl(n+'_Neck',(x,y,1.52),.055,.10,skin)
    ell(n+'_Head',(x,y-.005,1.65),(.089,.085,.115),skin)
    ell(n+'_Helmet',(x,y+.006,1.73),(.112,.102,.072),army)
    box(n+'_HelmetRim',(x,y-.077,1.715),(.18,.087,.014),army,.012)
    ell(n+'_Nose',(x,y-.087,1.65),(.018,.020,.025),skin)
    for dx in [-.043,.043]: ell(n+'_Eye',(x+dx,y-.084,1.676),(.012,.005,.004),black)
    for side in [-1,1]:
        a=(x+side*.22,y,1.39); b=(x+side*.28,y-.09,1.17); c=(x+side*.20,y-.26,1.25)
        rod(n+'_UpperSleeve',a,b,.077,army); ell(n+'_Elbow',b,(.077,.078,.08),army); rod(n+'_Forearm',b,c,.061,army)
        ell(n+'_GlovedHand',(c[0],c[1]-.02,c[2]),(.052,.055,.038),tan)
        for j in range(4): rod(n+'_GloveFinger',(c[0]-.032+j*.019,c[1]-.04,c[2]),(c[0]-.032+j*.019,c[1]-.075,c[2]-.007),.008,tan)
    root=empty(n+'_PLACEHOLDER_GENERIC_PERSONNEL',(x,y,0))
    for o in set(C.objects)-before-{root}:
        o.parent=root; o.matrix_parent_inverse=root.matrix_world.inverted()
    root['Reference_status']='Generic presentation figure; replace with approved photoreal asset for final exhibition.'
    return root
zone(4)
for i,(x,y) in enumerate([(-5,-5),(-3,-3),(-5,-1)],1): soldier('SOLDIER_%02d'%i,x,y)
# Wearable on soldier 01 left forearm. Housing is explicitly unconfirmed.
wx,wy,wz=-5.20,-5.24,1.255
box('PLACEHOLDER_HealthWatch_Strap',(wx,wy+.008,wz),(.075,.11,.014),rubber,.012)
box('PLACEHOLDER_HealthWatch_Housing',(wx,wy,wz+.018),(.046,.05,.014),black,.007)
box('PLACEHOLDER_HealthWatch_Glass',(wx,wy,wz+.026),(.037,.040,.001),glass,.004)
text('Watch_UnconfirmedUI','DHRUVA\nCONCEPT',(wx-.016,wy+.003,wz+.027),.0048,cyan,rot=(0,0,0))
for xx in [-.024,.024]: cyl('PLACEHOLDER_HealthWatch_Button',(wx+xx,wy,wz+.018),.003,.006,steel,24)
sign('Wearable_Zone','04 / PERSONNEL MONITORING','WEARABLE CONCEPT / HARDWARE + METRICS TO BE CONFIRMED',-4,-7.5,6.4)
empty('HOTSPOT_WEARABLE',(wx,wy,wz))

zone(6)
soldier('TRANSLATOR_PERSONNEL_A',10,-3)
soldier('TRANSLATOR_PERSONNEL_B',11.0,-2.6)
py=phone('PLACEHOLDER_TranslatorAndroid',10.2,-3.30,1.30,.092,.178)
text('Translator_DeviceUI','HINDI\n- - -\nCHINESE',(10.163,py,1.345),.011,violet)
sign('Translator_Zone','06 / LANGUAGE COMMUNICATION','HINDI  < >  CHINESE / INTERFACE AWAITING SCREENSHOTS',10,-6.8,6.5)
py=panel('Translator_Workflow',(12,-1,1.85),3.7,1.95)
text('Translator_Title','HINDI  < >  CHINESE',(10.3,py,2.60),.20,ink,heavy=True)
text('Translator_Disclaimer','APPLICATION CONCEPT / NOT A PRODUCT SCREENSHOT',(10.3,py,2.35),.075,gold)
text('Translator_Flow','HINDI INPUT\n      > Translation engine >\nCHINESE OUTPUT\n\nReverse language direction supported in this diagram',(10.3,py,2.11),.115,violet)
text('Translator_Unconfirmed','Voice / offline capabilities not asserted',(10.3,py,1.04),.088,muted)
empty('HOTSPOT_TRANSLATOR',(10,-3,1.4))

zone(3)
box('Warning_ConcreteBase',(-1,-1,.10),(.85,.85,.20),concrete)
cyl('Warning_SupportMast',(-1,-1,1.1),.042,2.0,steel)
box('Warning_ControlEnclosure',(-1,-1.09,1.25),(.35,.16,.42),grey,.025)
for zz,m,label in [(2.15,green,'NORMAL'),(2.30,amber,'CAUTION'),(2.45,red,'ALERT')]:
    cyl('Warning_Beacon_'+label,(-1,-1,zz),.075,.12,m)
    cyl('Warning_Beacon_Separator',(-1,-1,zz-.068),.082,.014,black)
    o=bpy.context.object
cyl('Warning_Beacon_Cap',(-1,-1,2.53),.078,.025,black)
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.10,radius2=.045,depth=.16,location=(-1,-1.13,1.88),rotation=(pi/2,0,0)); finish(bpy.context.object,'Warning_Sounder_Horn',grey)
ell('Warning_Sounder_Opening',(-1,-1.215,1.88),(.084,.004,.084),black)
line('Warning_PowerData',[(-1,-1.1,1.06),(-.94,-1,.8),(-.94,-1,.15),(0,-1,.06)],.006,cable)
py=panel('Warning_LocalDisplay',(-1,-1.181,1.3),.25,.14)
text('Warning_LocalStatus','DEMO\nCONFIGURABLE',(-1.112,py,1.325),.025,amber)
py=phone('Commander_Android_Concept',-.53,-1.1,1.3)
text('Android_Notification','DEMO ALERT\nCHECK COMMAND\nAWAIT ACTION',(-.563,py,1.344),.008,amber)
ctrl=empty('SYSTEM_DEMO_CONTROLS',(0,0,0))
ctrl['caution_threshold_kVm']=0.0; ctrl['alert_threshold_kVm']=0.0; ctrl['thresholds_confirmed']=False; ctrl['presentation_links']=True
ctrl['NOTICE']='Thresholds intentionally unset. Animation is a scripted demonstration, not a hazard algorithm or operational advice.'
ctrl['alert_state']=0
for frame,state in [(0,0),(299,0),(320,1),(350,2),(390,0)]: ctrl['alert_state']=state; ctrl.keyframe_insert(data_path='["alert_state"]',frame=frame)
for label,value,m in [('NORMAL',0,green),('CAUTION',1,amber),('ALERT',2,red)]:
    # State drivers are restricted to these beacon materials, preserving other UI lights.
    ob=bpy.data.objects['Warning_Beacon_'+label]; mm=m.copy(); mm.name='MAT_BeaconState_'+label; ob.data.materials.clear(); ob.data.materials.append(mm)
    bs=mm.node_tree.nodes.get('Principled BSDF'); d=bs.inputs['Emission Strength'].driver_add('default_value').driver; d.expression='3 if int(s)==%d else 0.02'%value
    v=d.variables.new(); v.name='s'; v.type='SINGLE_PROP'; v.targets[0].id=ctrl; v.targets[0].data_path='["alert_state"]'
sign('Warning_Zone','03 / CONFIGURABLE EARLY WARNING','NORMAL  >  CAUTION  >  ALERT  >  ACKNOWLEDGE',-.3,-4.0,6)
empty('HOTSPOT_WARNING',(-1,-1,1.5))

# Restrained dotted information overlays; no visible energy beams.
zone(8)
def datalink(n,points,m):
    for a,b in zip(points[:-1],points[1:]):
        a=Vector(a); b=Vector(b); length=(b-a).length; count=max(1,int(length/.65))
        for j in range(count): rod(n+'_Dash',a.lerp(b,j/count),a.lerp(b,(j+.40)/count),.013,m)
    packet=ell(n+'_AnimatedPacket',points[0],(.065,.065,.065),m)
    for f,p in zip([0,240,480,720], [points[0],points[min(1,len(points)-1)],points[-1],points[0]]): packet.location=p; packet.keyframe_insert(data_path='location',frame=f)
for i,(x,y) in enumerate(nodes,1): datalink('NETWORK_NODE_%02d'%i,[(x,y,2.0),(x,y,2.7),(5,8,2.7),(5,10,1.5)],cyan)
datalink('EFM_DATA',[(-14,-3,1.2),(-12,-1,.4),(-8,3,.4),(0,8,.4)],cyan)
datalink('WARNING_PATH',[(1,9,.45),(1,1,.45),(-1,-1,1.5)],amber)
datalink('WEARABLE_TELEMETRY_CONCEPT',[(-5,-5,1.25),(-6,0,.5),(-4,5,.5),(0,8,.5)],green)
datalink('TRANSLATION_MESSAGE_CONCEPT',[(10,-3,1.3),(10.6,-2.8,1.3),(11,-2.6,1.3)],violet)

zone(11)
sign('Presentation_Title','DHRUVA / CONNECTED FIELD SYSTEMS','FICTIONAL HIGH-ALTITUDE SITE  /  ENGINEERING VISUALIZATION',0,-15.6,13)
logo('Exhibition_OriginalBrand',(-10,-15.66,1.8),2.7)
text('Presentation_FictionNotice','ILLUSTRATIVE NETWORK SPACING  /  NOT A DEPLOYMENT DESIGN',(-6.25,-15.67,1.45),.105,gold)
# Architecture board located off-stage for a dedicated camera, still actual editable 3D.
py=panel('Architecture_Board',(0,70,8),19,9.5)
logo('Architecture_OriginalBrand',(-7.5,py-.002,10.85),2.1)
text('Architecture_Title','FROM MEASUREMENT TO ACTION',(-5.8,py,11.55),.44,ink,heavy=True)
text('Architecture_Sub','DHRUVA DEFENCE  /  INTEGRATED ECOSYSTEM  /  CONCEPT ARCHITECTURE',(-5.8,py,10.91),.18,gold)
stages=[('01 / SENSE','EFM-100C\nANT-50 / LRX-1'),('02 / TRANSPORT','RS485 / edge\nNetwork communication'),('03 / PROCESS','Central server\nStrike processing'),('04 / INFORM','Command application\nLive map / event log'),('05 / RESPOND','Beacon + sounder\nOperator notification')]
for i,(title,body) in enumerate(stages):
    x=-8.7+i*3.55
    box('Architecture_Card',(x+1.55,py-.03,8.75),(3.2,.035,2.3),grey,.06)
    text('Architecture_StageTitle',title,(x+.14,py-.056,9.43),.20,cyan,heavy=True)
    text('Architecture_StageBody',body,(x+.14,py-.056,8.85),.21,ink)
    if i<4: text('Architecture_Arrow','>',(x+3.27,py-.08,8.7),.30,gold)
text('Architecture_Parallel','PERSONNEL PATH   /   Wearable concept  >  wireless link  >  server  >  commander',(-8.55,py,6.62),.24,green)
text('Architecture_Translator','COMMUNICATION   /   Hindi input  >  translation engine  >  Chinese output  /  reverse',(-8.55,py,5.93),.24,violet)
text('Architecture_Integrity','UNCONFIRMED: watch hardware / metrics / app screens / voice / offline. No operational claims.\nThresholds remain editable and unset. All readings and events are synthetic demonstration data.',(-8.55,py,4.85),.18,muted)

zone(9)
world=bpy.data.worlds.new('HighAltitude_Daylight'); scene.world=world; world.use_nodes=True
nt=world.node_tree; nt.nodes.clear(); out=nt.nodes.new('ShaderNodeOutputWorld'); bg=nt.nodes.new('ShaderNodeBackground'); sky=nt.nodes.new('ShaderNodeTexSky'); sky.sky_type='HOSEK_WILKIE'; sky.sun_direction=Vector((-.4,-.5,.75)).normalized(); sky.turbidity=2.2; sky.ground_albedo=.25; bg.inputs[1].default_value=.4; nt.links.new(sky.outputs[0],bg.inputs[0]); nt.links.new(bg.outputs[0],out.inputs[0])
ld=bpy.data.lights.new('Sun_ClearAltitude','SUN'); ld.energy=2.1; ld.angle=.055; o=bpy.data.objects.new('Sun_ClearAltitude',ld); C.objects.link(o); o.rotation_euler=(.43,-.5,-.5)
def area(n,p,power,size,target):
    d=bpy.data.lights.new(n,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; o=bpy.data.objects.new(n,d); C.objects.link(o); o.location=p; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler(); return o
area('Command_SoftInterior',(2,9,3.5),350,5,(2,10,1))
area('EFM_Softbox',(-13,-5,3),160,3,(-14,-3,1))
area('LRX_Softbox',(-19,10,2.5),80,2,(-19.44,12,.71))

zone(10)
def camera(n,p,t,lens=48,ortho=None):
    d=bpy.data.cameras.new(n); o=bpy.data.objects.new(n,d); C.objects.link(o); o.location=p; o.rotation_euler=(Vector(t)-o.location).to_track_quat('-Z','Y').to_euler(); d.lens=lens; d.clip_start=.005; d.clip_end=1000
    if ortho: d.type='ORTHO'; d.ortho_scale=ortho
    return o
cams={}
cams['CAM_00_MASTER_OVERVIEW']=camera('CAM_00_MASTER_OVERVIEW',(48,-66,42),(0,4,2),48)
cams['CAM_01_EFM']=camera('CAM_01_EFM',(-15.0,-4.40,1.53),(-14.05,-3,1.00),58)
cams['CAM_02_LIGHTNING_SENSOR']=camera('CAM_02_LIGHTNING_SENSOR',(-20.85,10.45,2.29),(-19.97,12,1.48),65)
cams['CAM_03_LIGHTNING_NETWORK']=camera('CAM_03_LIGHTNING_NETWORK',(40,-40,45),(0,6,0),45)
cams['CAM_04_EARLY_WARNING']=camera('CAM_04_EARLY_WARNING',(2.8,-6.8,3),(-.7,-1,1.6),55)
cams['CAM_05_SOLDIER_WEARABLE']=camera('CAM_05_SOLDIER_WEARABLE',(wx-.15,wy-.23,wz+.35),(wx,wy,wz+.01),62)
cams['CAM_06_COMMAND_CENTER']=camera('CAM_06_COMMAND_CENTER',(0,4.8,2.8),(2.0,11.9,2),32)
cams['CAM_07_TRANSLATOR']=camera('CAM_07_TRANSLATOR',(14,-10,3.7),(10.7,-2,1.5),52)
cams['CAM_08_SYSTEM_ARCHITECTURE']=camera('CAM_08_SYSTEM_ARCHITECTURE',(0,50,8),(0,70,8),50,20.5)
cams['CAM_09_LRX_RECEIVER']=camera('CAM_09_LRX_RECEIVER',(-19.30,11.72,.965),(-19.44,11.96,.711),60)
for f,label,key in [(0,'MASTER OVERVIEW','CAM_00_MASTER_OVERVIEW'),(100,'EFM DEMO','CAM_01_EFM'),(200,'LIGHTNING NETWORK','CAM_03_LIGHTNING_NETWORK'),(300,'WARNING EVENT','CAM_04_EARLY_WARNING'),(400,'WEARABLE','CAM_05_SOLDIER_WEARABLE'),(500,'COMMANDER MONITORING','CAM_06_COMMAND_CENTER'),(600,'TRANSLATOR','CAM_07_TRANSLATOR'),(700,'FULL INTEGRATED SYSTEM','CAM_08_SYSTEM_ARCHITECTURE')]:
    marker=scene.timeline_markers.new('%03d %s'%(f,label),frame=f); marker.camera=cams[key]
scene.frame_start=0; scene.frame_end=740; scene.render.fps=30; scene.frame_set(0); scene.camera=cams['CAM_00_MASTER_OVERVIEW']
scene.render.engine='CYCLES'; scene.cycles.samples=48; scene.cycles.use_denoising=True
scene.cycles.max_bounces=6; scene.cycles.diffuse_bounces=3; scene.cycles.glossy_bounces=3
scene.render.resolution_x=3840; scene.render.resolution_y=2160; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='AgX'
scene['PROJECT_STATUS']='Reference-based concept visualization. Unconfirmed components explicitly named PLACEHOLDER. Not a validated operational digital twin.'
scene['UNCONFIRMED']='EFM sensing underside details; watch dimensions and metrics; final Dhruva screens and protocols; exact final warning hardware; personnel asset likeness.'
scene['NETWORK_SPACING']='Presentation compressed, fictional node positions. Not an engineered lightning-network siting design.'
scene['BLENDER_TARGET']='Uses Blender 4.x-compatible basic mesh, curve, Principled materials and Cycles; authored with installed Blender 5.2.2.'
# Selectable collection assets; separate appendable .blend libraries.
for i,folder in [(1,'EFM100'),(2,'LightningNetwork'),(3,'WarningBeacon'),(4,'HealthWatch_Personnel'),(5,'CommandTerminal'),(6,'TranslatorDevice')]:
    path=os.path.join(ROOT,'Assets',folder); os.makedirs(path,exist_ok=True)
    cols[names[i]].asset_mark()
    bpy.data.libraries.write(os.path.join(path,folder+'.blend'),{cols[names[i]]},fake_user=True)
for a in bpy.context.screen.areas:
    if a.type=='VIEW_3D': a.spaces.active.region_3d.view_perspective='CAMERA'; a.spaces.active.clip_end=1000
bpy.ops.object.select_all(action='DESELECT')
readme=bpy.data.texts.new('READ_ME_FIRST'); readme.write('DHRUVA DEFENCE / SYSTEM VISUALIZATION\n\nUse timeline camera markers 0 / 100 / 200 / 300 / 400 / 500 / 600 / 700.\nToggle 08_DATA_VISUALIZATION collection for presentation links.\nSelect SYSTEM_DEMO_CONTROLS for editable threshold placeholders and alert state.\nFrames 300-390 demonstrate normal / caution / alert states.\nAssets use metres. Source drawings in references. All external images packed.\n\nIMPORTANT: watch, personnel, warning hardware and app screens are concept placeholders, not validated Dhruva product models. Metrics and offline/voice claims intentionally withheld. Node spacing is compressed for presentation.\n')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Dhruva_Defence_Ecosystem.blend'))
summary={'objects':len(scene.objects),'collections':names,'cameras':list(cams),'engine':scene.render.engine,'resolution':[3840,2160],'unconfirmed':scene['UNCONFIRMED']}
with open(os.path.join(ROOT,'scene_manifest.json'),'w') as f: json.dump(summary,f,indent=2)
# Initial QA preview only. Production renders handled by render_views.py.
scene.render.resolution_percentage=30; scene.cycles.samples=16
scene.render.filepath=os.path.join(ROOT,'renders','QA_master.png'); bpy.ops.render.render(write_still=True)
print('BUILD_COMPLETE',len(scene.objects),flush=True)
