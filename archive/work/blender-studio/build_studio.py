import bpy, bmesh, math, random, os, json, sys
import numpy as np
from mathutils import Vector
from pathlib import Path
random.seed(29)
HERE=Path(__file__).resolve().parent
DEFAULT_OUT=HERE.parent if HERE.name=='source' else HERE.parent.parent/'outputs'/'worklive-blender-studio'
OUT=Path(os.environ.get('WORKLIVE_STUDIO_OUTPUT',str(DEFAULT_OUT)))
ASSETS=OUT/'assets'; ASSETS.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'

def rgba(h):
 h=h.lstrip('#');c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)
def mat(name,color,rough=.5,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgba(color);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;m.diffuse_color=rgba(color);return m

def image(name,arr):
 h,w=arr.shape[:2];im=bpy.data.images.new(name,width=w,height=h,alpha=True);a=np.ones((h,w,4),np.float32);a[:,:,:arr.shape[2]]=arr;im.pixels.foreach_set(a.ravel());im.filepath_raw=str(ASSETS/(name+'.png'));im.file_format='PNG';im.save();return im
rng=np.random.default_rng(14)
n=512;Y,X=np.mgrid[0:n,0:n].astype(float)
height=.30*np.sin(X*math.pi/3)*np.sin(Y*math.pi/3)+.045*rng.normal(size=(n,n));dy,dx=np.gradient(height)
norm=np.dstack((-dx,-dy,np.ones_like(dx)));norm/=np.linalg.norm(norm,axis=2)[:,:,None]
clothmap=image('woven-normal',norm*.5+.5);clothmap.colorspace_settings.name='Non-Color'
h=.25*np.sin(X*.26+np.sin(Y*.021)*1.4)+.12*np.sin(X*.65+np.sin(Y*.03))+.018*rng.normal(size=(n,n));dy,dx=np.gradient(h);norm=np.dstack((-dx*.35,-dy*.35,np.ones_like(dx)));norm/=np.linalg.norm(norm,axis=2)[:,:,None]
woodmap=image('wood-normal',norm*.5+.5);woodmap.colorspace_settings.name='Non-Color'
base=np.array([.47,.31,.185]);grain=.026*np.sin(X*.22+np.sin(Y*.009)*4)+.015*np.sin(X*.7+np.sin(Y*.03))+.007*rng.normal(size=(n,n));woodcolor=image('walnut-grain',np.clip(base[None,None,:]+grain[:,:,None],0,1))

def texture(m,im,kind='normal',strength=.35):
 nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF');t=nodes.new('ShaderNodeTexImage');t.image=im
 if kind=='normal':
  nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=strength;links.new(t.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
 else:links.new(t.outputs['Color'],p.inputs['Base Color'])

M={}
for name,col,r,metal in [
 ('Plaster','#d8d0bc',.85,0),('Warm white','#ece5d4',.6,0),('Forest lacquer','#294a46',.38,0),('Sage ceramic','#819684',.28,0),('Clay ceramic','#b16d4d',.43,0),('Walnut','#896044',.42,0),('Oak','#baa183',.55,0),('Blackened steel','#242b2c',.34,.75),('Brushed brass','#a88a51',.3,.75),('Parchment','#e7d8b6',.9,0),('Leather cognac','#9e5f3c',.5,0),('Boucle olive','#65746a',.98,0),('Linen cream','#d8d2bb',.94,0),('Boucle navy','#35474c',.9,0),('Terracotta tile','#a67359',.72,0),('Soil','#332b22',1,0),('Leaf dark','#385747',.63,0),('Leaf light','#628469',.64,0),('Black rubber','#1a2021',.93,0),('Paper','#e9ddc4',.8,0),('Page ink','#343a37',.75,0),('Copper','#b87550',.4,.6),('Coffee','#302318',.24,0),('Screen black','#151d23',.32,.2),('Rug oat','#b6a68a',1,0)]:
 M[name]=mat(name,col,r,metal)
for k in ['Boucle olive','Boucle navy','Linen cream','Rug oat','Parchment']:texture(M[k],clothmap,strength=.55)
texture(M['Walnut'],woodcolor,'base');texture(M['Walnut'],woodmap,strength=.65);texture(M['Oak'],woodmap,strength=.5)
oakcolor=image('oak-grain',np.clip(np.array(rgba('#b19b81')[:3])[None,None,:]*(1+grain[:,:,None]*2),0,1));texture(M['Oak'],oakcolor,'base');M['Oak'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.67
for k in ['Leather cognac','Plaster']:texture(M[k],clothmap,strength=.12)

COL=None
def place(o,name,material=None,parent=None):
 o.name=name
 if COL:
  for c in list(o.users_collection):c.objects.unlink(o)
  COL.objects.link(o)
 if material:o.data.materials.append(M.get(material,material) if isinstance(material,str) else material)
 if parent:o.parent=parent
 return o

def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);(COL or scene.collection).objects.link(o);o.location=loc;o.parent=parent;return o

def cube(name,loc,scale,material,bevel=.025,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=place(bpy.context.object,name,material,parent);o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  m=o.modifiers.new('Crafted edges','BEVEL');m.width=min(bevel,min(scale)*.46);m.segments=3
  m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');m.keep_sharp=True
 return o

def sphere(name,loc,scale,material,parent=None,segments=24,rings=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc);o=place(bpy.context.object,name,material,parent);o.scale=scale
 for p in o.data.polygons:p.use_smooth=True
 return o

def cylinder(name,loc,radius,depth,material,r2=None,parent=None,vertices=32):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=radius if r2 is None else r2,depth=depth,location=loc);o=place(bpy.context.object,name,material,parent)
 be=o.modifiers.new('Soft rim','BEVEL');be.width=min(.009,depth*.15);be.segments=2
 for p in o.data.polygons:p.use_smooth=True
 return o

def line(name,points,radius,material,parent=None):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=10;c.bevel_depth=radius;c.bevel_resolution=3
 s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for a,b in zip(s.bezier_points,points):a.co=b;a.handle_left_type='AUTO';a.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);(COL or scene.collection).objects.link(o);o.parent=parent;c.materials.append(M.get(material,material) if isinstance(material,str) else material);return o

def rod(name,start,end,radius,material,parent=None):
 a,b=Vector(start),Vector(end);o=cylinder(name,(a+b)/2,radius,(a-b).length,material,parent=parent,vertices=12);o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');return o

def ringbody(name,profile,material,parent=None,n=32,center=(0,0,0),sub=1):
 # profile: height, half width, half depth, front/back center
 verts=[]
 for z,rx,ry,cy in profile:
  for j in range(n):
   a=j*2*math.pi/n;verts.append((center[0]+math.cos(a)*rx,center[1]+cy+math.sin(a)*ry,center[2]+z))
 faces=[tuple(range(n-1,-1,-1))]
 for i in range(len(profile)-1):
  for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
 faces.append(tuple((len(profile)-1)*n+j for j in range(n)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);(COL or scene.collection).objects.link(o);o.parent=parent;mesh.materials.append(M.get(material,material) if isinstance(material,str) else material)
 uv=mesh.uv_layers.new(name='UVMap')
 for poly in mesh.polygons:
  for loop in poly.loop_indices:
   v=mesh.loops[loop].vertex_index;uv.data[loop].uv=(v%n/(n-1),(v//n)/(len(profile)-1))
  poly.use_smooth=True
 if sub:
  mod=o.modifiers.new('Sculpted surface','SUBSURF');mod.levels=sub;mod.render_levels=sub
 return o

def patch(name,vertices,faces,material,parent=None,solid=0):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);(COL or scene.collection).objects.link(o);mesh.materials.append(M.get(material,material) if isinstance(material,str) else material);o.parent=parent
 uv=mesh.uv_layers.new(name='UVMap')
 for p in mesh.polygons:
  p.use_smooth=True
  for l in p.loop_indices:
   idx=mesh.loops[l].vertex_index;uv.data[l].uv=(idx%2,idx/max(1,len(vertices)-1))
 if solid:m=o.modifiers.new('Thickness','SOLIDIFY');m.thickness=solid
 return o

def text(name,value,loc,size,material,rotation=(math.pi/2,0,0),align='CENTER'):
 c=bpy.data.curves.new(name,'FONT');c.body=value;c.size=size;c.align_x=align;c.align_y='CENTER';c.extrude=.0005;c.bevel_depth=.0002
 o=bpy.data.objects.new(name,c);(COL or scene.collection).objects.link(o);o.location=loc;o.rotation_euler=rotation;c.materials.append(M.get(material,material) if isinstance(material,str) else material);return o

def export_collection(col,path):
 # Consolidate static surfaces while preserving articulated empty-node hierarchy.
 excluded=lambda o:o.name.startswith(('Display line','Display heading'))
 candidates=[o for o in col.all_objects if o.type in {'MESH','CURVE','FONT'} and not excluded(o)]
 bpy.ops.object.select_all(action='DESELECT')
 for o in candidates:o.select_set(True)
 if candidates:
  bpy.context.view_layer.objects.active=candidates[0];bpy.ops.object.convert(target='MESH')
 groups={}
 for o in list(col.all_objects):
  if o.type!='MESH' or excluded(o) or o.name.startswith(('MonitorScreen_','WindowView_','LampGlow_','PendantGlow_')):continue
  key=(o.parent.name if o.parent else '',tuple(m.name if m else '' for m in o.data.materials))
  groups.setdefault(key,[]).append(o)
 for key,objects in groups.items():
  if len(objects)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
 bpy.ops.object.select_all(action='DESELECT')
 for o in col.all_objects:
  if not excluded(o):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
 print('EXPORTED',path.name,flush=True)
 # Keep the authored meshes in the .blend and full-detail exports. The browser
 # gets a separate simplified copy with the same materials, UVs and rig nodes.
 fast=path.parent/'fast';fast.mkdir(exist_ok=True)
 originals=[]
 try:
  for o in col.all_objects:
   if o.type!='MESH' or excluded(o) or len(o.data.polygons)<96:continue
   original=o.data;o.data=original.copy();originals.append((o,original))
   bpy.context.view_layer.objects.active=o
   dec=o.modifiers.new('Realtime triangle budget','DECIMATE')
   dec.ratio=.23 if path.stem=='studio' else (.42 if o.parent and ('Head' in o.parent.name or 'Eye' in o.parent.name) else .25)
   dec.use_collapse_triangulate=True
   bpy.ops.object.modifier_apply(modifier=dec.name)
  bpy.ops.export_scene.gltf(filepath=str(fast/path.name),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
  print('EXPORTED FAST',path.name,flush=True)
 finally:
  for o,original in originals:
   reduced=o.data;o.data=original
   if reduced.users==0:bpy.data.meshes.remove(reduced)


def build_character(idx,name,provider):
 global COL
 COL=bpy.data.collections.new('Character '+name);scene.collection.children.link(COL)
 root=empty(name+'_Root');body=empty(name+'_Body',(0,0,.92),root)
 skins=['#c59578','#8b583f','#67442f','#d9b193'];haircols=['#302626','#242321','#211d1c','#75462e']
 skin=mat(name+' skin',skins[idx],.57);p=skin.node_tree.nodes.get('Principled BSDF');p.inputs['Subsurface Weight'].default_value=.065
 hair=mat(name+' hair',haircols[idx],.63);iris=mat(name+' iris',['#667e76','#645b3d','#4e3c29','#54716e'][idx],.36)
 eyelid=mat(name+' lid',skins[idx],.67);lip=mat(name+' lips',['#9d6354','#6d3d34','#552f29','#ae7465'][idx],.65)
 shirt=mat('Provider '+provider+' '+name,'#2D9D8F' if provider=='codex' else '#D97757',.88);texture(shirt,clothmap,strength=.43)
 seam=mat(name+' ribbing','#247f74' if provider=='codex' else '#b9684a',.93);texture(seam,clothmap,strength=.5)
 pants=mat(name+' trousers',['#34434b','#a68f6e','#424644','#38474d'][idx],.9);texture(pants,clothmap,strength=.35)
 ivory=M['Warm white'];black=M['Screen black'];soles=M['Black rubber'];nails=mat(name+' nails',['#d6ac93','#ac7e63','#886149','#e8c5aa'][idx],.7)
 # A tailored torso with sloped shoulders, a softened waist and a distinct hem.
 torso=ringbody(name+'_Sweater',[(.01,.19,.125,0),(.035,.217,.143,0),(.10,.217,.146,0),(.22,.225,.15,0),(.37,.245,.15,.006),(.49,.270,.13,.006),(.54,.24,.12,.008),(.585,.155,.10,.01),(.60,.092,.078,.01)],shirt,body,n=40,sub=2)
 ringbody(name+'_Hem',[(.025,.215,.145,0),(.038,.225,.152,0),(.08,.226,.152,0),(.092,.215,.145,0)],seam,body,sub=1)
 # Wrinkles are shallow folds following the fabric rather than drawn stripes.
 for side in [-1,1]:
  for i in range(1):
   z=.15;line(name+'_Fold',[(side*.19,-.084,z+.009),(side*.14,-.130,z),(side*.11,-.139,z+.006)],.002,shirt,body)
 if idx==1:
  for side in [-1,1]:
   patch(name+'_Collar',[(side*.03,-.089,.605),(side*.13,-.107,.574),(side*.091,-.159,.46),(side*.008,-.157,.535)],[(0,1,2,3)],shirt,body,solid=.012)
  cube(name+'_Button placket',(0,-.154,.32),(.022,.012,.42),seam,.006,body)
  for z in [.15,.25,.35,.45]:sphere(name+'_Button',(0,-.166,z),(.006,.004,.006),M['Brushed brass'],body,12,8)
  cube(name+'_Pocket',(-.12,-.147,.38),(.095,.018,.11),shirt,.009,body)
 elif idx==3:
  ringbody(name+'_Hood',[(.41,.16,.09,.052),(.44,.185,.10,.058),(.52,.16,.105,.051),(.615,.101,.07,.02)],shirt,body,sub=2)
  for side in [-1,1]:
   line(name+'_Drawstring',[(side*.05,-.093,.60),(side*.063,-.16,.5),(side*.057,-.162,.40)],.0045,ivory,body)
   cube(name+'_Aglet',(side*.057,-.162,.39),(.008,.008,.032),M['Brushed brass'],.003,body)
  line(name+'_Kangaroo pocket',[(-.14,-.146,.26),(-.17,-.152,.13),(0,-.166,.115),(.17,-.152,.13),(.14,-.146,.26)],.005,seam,body)
 else:
  ringbody(name+'_Neck ribbing',[(.558,.102,.087,0),(.585,.106,.09,0),(.611,.095,.077,0)],seam,body,sub=1)
 cylinder(name+'_Neck',(0,0,.635),.073,.15,skin,parent=body)
 head=empty(name+'_Head',(0,-.003,.862),body)
 ringbody(name+'_Face',[(-.224,.025,.032,-.015),(-.20,.078,.072,-.018),(-.153,.118,.112,-.008),(-.08,.153,.137,.0),(.005,.169,.143,0),(.10,.16,.139,.009),(.19,.133,.12,.015),(.235,.075,.068,.01),(.251,.008,.008,0)],skin,head,n=48,sub=2)
 for side in [-1,1]:
  sphere(name+'_Ear',(side*.166,.009,-.031),(.031,.023,.052),skin,head)
  sphere(name+'_Inner ear',(side*.178,-.010,-.034),(.014,.013,.029),lip,head,16,12)
  line(name+'_Ear rim',[(side*.182,-.018,-.06),(side*.189,-.016,-.025),(side*.175,-.015,.005)],.006,skin,head)
  eye=empty(name+('_EyeL' if side<0 else '_EyeR'),(side*.065,-.137,.038),head)
  sphere(name+'_Eye white',(0,-.004,0),(.040,.010,.023),ivory,eye)
  sphere(name+'_Iris',(side*-.002,-.015,.000),(.014,.005,.016),iris,eye)
  sphere(name+'_Pupil',(side*-.002,-.020,.000),(.0065,.0025,.009),black,eye,16,12)
  sphere(name+'_Catchlight',(-.005,-.023,.006),(.003,.002,.003),ivory,eye,12,8)
  line(name+'_Upper lid',[(-.040,-.006,.001),(-.022,-.016,.020),(0,-.018,.024),(.024,-.015,.019),(.040,-.005,.002)],.0055,eyelid,eye)
  line(name+'_Lower lid',[(-.038,-.006,-.001),(0,-.018,-.021),(.038,-.006,-.001)],.0033,eyelid,eye)
  line(name+'_Brow',[(side*.031,-.143,.089),(side*.064,-.152,.100),(side*.101,-.128,.084)],.007,hair,head)
 sphere(name+'_Nose bridge',(0,-.142,-.003),(.020,.022,.047),skin,head)
 sphere(name+'_Nose tip',(0,-.170,-.046),(.027,.026,.024),skin,head)
 for side in [-1,1]:sphere(name+'_Nostril',(side*.017,-.188,-.058),(.006,.008,.004),lip,head,12,8)
 line(name+'_Upper lip',[(-.044,-.136,-.118),(-.020,-.154,-.124),(0,-.161,-.122),(.024,-.153,-.122),(.045,-.135,-.109)],.0038,lip,head)
 line(name+'_Lower lip',[(-.036,-.143,-.124),(0,-.159,-.137),(.037,-.140,-.118)],.005,lip,head)
 # Contoured hair cap: a different hairline at the forehead, temples and nape.
 hv=[];hf=[];nu,nv=48,14
 for v in range(nv+1):
  for u in range(nu):
   a=2*math.pi*u/nu;front=max(0,-math.sin(a));back=max(0,math.sin(a));end=1.55-front*.51+back*.39
   t=.01+v/nv*end;hv.append((.179*math.sin(t)*math.cos(a),.012+.155*math.sin(t)*math.sin(a),.019+.25*math.cos(t)))
 for v in range(nv):
  for u in range(nu):hf.append((v*nu+u,v*nu+(u+1)%nu,(v+1)*nu+(u+1)%nu,(v+1)*nu+u))
 patch(name+'_Hair cap',hv,hf,hair,head,solid=.004)
 if idx==0:
  for side in [-1,1]:
   for j in range(5):
    x=side*(.129+j*.009);y=.005+j*.020
    o=line(name+'_Bob strand',[(side*.12,y,.19),(side*.17,y,.06),(x,y,-.14),(side*.14,y,-.225)],.028,hair,head)
    for i,b in enumerate(o.data.splines[0].bezier_points):b.radius=[.8,1.05,.95,.3][i]
  for j in range(6):
   o=line(name+'_Swept fringe',[(-.135+j*.01,-.015,.217),(-.04+j*.022,-.123,.211),(.076+j*.014,-.121,.145),(.149,-.046,.073-j*.004)],.024,hair,head)
   for i,b in enumerate(o.data.splines[0].bezier_points):b.radius=[.55,1,.65,.08][i]
  for side in [-1,1]:
   pts=[(side*.065+.051*math.cos(a),-.188+.005*abs(math.cos(a)),.038+.040*math.sin(a)) for a in np.linspace(0,2*math.pi,25)]
   line(name+'_Glasses rim',pts,.0048,M['Brushed brass'],head)
   rod(name+'_Glasses arm',(side*.113,-.181,.047),(side*.166,.001,.049),.0035,M['Brushed brass'],head)
  line(name+'_Glasses bridge',[(-.015,-.189,.045),(0,-.199,.052),(.015,-.189,.045)],.0038,M['Brushed brass'],head)
 elif idx==1:
  for j in range(70):
   a=j*2.39996;r=.16*math.sqrt(j/70);z=.04+.245*math.sqrt(max(0,1-r*r/.18**2));sphere(name+'_Coil',(r*math.cos(a),.008+r*.85*math.sin(a),z),(.025,.024,.022),hair,head,12,8)
  # Individual short beard strokes taper around the jaw.
  for j in range(39):
   x=(j%13-6)*.017;z=-.16+(j//13)*.016;y=-.092-math.sqrt(max(0,.11**2-x*x))*.35
   line(name+'_Stubble',[(x,y,z),(x+.002,y-.002,z+.009)],.0017,hair,head)
 elif idx==2:
  sphere(name+'_Braided bun',(0,.174,.113),(.103,.079,.108),hair,head)
  for j in range(13):
   a=(j-6)*.21;x=.164*math.sin(a);y=-.119*math.cos(a)
   o=line(name+'_Braid',[(x,y,.143),(x*.9,.019,.259),(x*.5,.139,.18),(x*.4,.211,.13)],.0105,hair,head)
   for k in range(12):
    t=k/11;xx=x*(1-t*.55);yy=y*(1-t)+.17*t;zz=.14+math.sin(t*math.pi)*.14
    sphere(name+'_Braid weave',(xx+.004*math.sin(k*3),yy,zz),(.011,.011,.008),hair,head,8,6)
  for side in [-1,1]:
   for j in range(3):sphere(name+'_Ear stud',(side*.184,-.019,-.053-j*.009),(.006,.006,.006),M['Brushed brass'],head,12,8)
 else:
  for j in range(6):
   x=-.12+j*.039;o=line(name+'_Quiff',[(x,.07,.165),(x-.024,.012,.244+.02*math.sin(j)),(x+.022,-.096,.229+.016*math.sin(j)),(x+.025,-.133,.162)],.043,hair,head)
   for i,b in enumerate(o.data.splines[0].bezier_points):b.radius=[.5,1.1,.85,.10][i]
  for side in [-1,1]:
   for j in range(10):
    x=side*(.08+random.random()*.047);z=-.055+random.random()*.046;y=-.119+abs(x)*.09
    sphere(name+'_Freckle',(x,y-.017,z),(.0019,.0012,.0019),lip,head,8,6)
 # Pelvis and two articulated trouser legs.
 cube(name+'_Pelvis',(0,0,.003),(.36,.25,.14),pants,.055,body)
 for side,tag in [(-1,'L'),(1,'R')]:
  hip=empty(name+'_Thigh'+tag,(side*.105,0,-.025),body)
  ringbody(name+'_Upper trouser'+tag,[(-.005,.10,.11,0),(-.055,.10,.105,0),(-.23,.085,.092,.009),(-.425,.076,.079,0)],pants,hip,n=24,sub=1)
  knee=empty(name+'_Shin'+tag,(0,0,-.385),hip)
  ringbody(name+'_Lower trouser'+tag,[(.018,.079,.08,0),(-.06,.079,.084,-.005),(-.24,.064,.075,0),(-.35,.061,.069,0),(-.385,.065,.073,0)],pants,knee,n=24,sub=1)
  line(name+'_Trouser seam'+tag,[(side*.073,0,.0),(side*.073,.01,-.13),(side*.059,.01,-.35)],.0028,pants,knee)
  cube(name+'_Shoe'+tag,(0,-.049,-.423),(.149,.27,.095),ivory if idx!=1 else M['Leather cognac'],.045,knee)
  cube(name+'_Sole'+tag,(0,-.049,-.462),(.151,.279,.027),M['Warm white'],.012,knee)
  cube(name+'_Heel'+tag,(0,.035,-.412),(.14,.10,.099),ivory if idx!=1 else M['Leather cognac'],.025,knee)
  for j in range(4):line(name+'_Laces'+tag,[(-.045,-.042-j*.023,-.377),(0,-.049-j*.023,-.375),(.045,-.042-j*.023,-.377)],.0029,M['Linen cream'],knee)
  shoulder=empty(name+'_UpperArm'+tag,(side*.245,0,.50),body)
  ringbody(name+'_Sleeve'+tag,[(.075,.06,.065,0),(.02,.105,.099,0),(-.13,.09,.087,0),(-.24,.079,.072,0)],shirt,shoulder,n=24,sub=2)
  elbow=empty(name+'_Forearm'+tag,(0,0,-.23),shoulder)
  if idx in [0,3]:
   ringbody(name+'_Long sleeve'+tag,[(.025,.079,.073,0),(-.12,.070,.065,0),(-.235,.05,.046,0)],shirt,elbow,n=24,sub=1)
   ringbody(name+'_Cuff'+tag,[(-.196,.054,.05,0),(-.213,.058,.053,0),(-.25,.052,.048,0)],seam,elbow,n=24,sub=1)
  else:
   ringbody(name+'_Rolled cuff'+tag,[(.035,.085,.078,0),(-.008,.085,.078,0),(-.035,.075,.069,0)],seam,elbow,n=24,sub=1)
   ringbody(name+'_Forearm skin'+tag,[(.004,.067,.061,0),(-.12,.051,.05,0),(-.24,.040,.037,0)],skin,elbow,n=24,sub=1)
  hand=empty(name+'_Hand'+tag,(0,0,-.266),elbow)
  sphere(name+'_Palm'+tag,(0,-.004,-.034),(.043,.027,.064),skin,hand)
  for j in range(4):
   x=(j-1.5)*.019;length=[.046,.058,.061,.048][j]
   line(name+'_Finger'+tag,[(x,-.002,-.064),(x,-.006,-.064-length*.55),(x,-.013,-.064-length)],.010,skin,hand)
   sphere(name+'_Nail'+tag,(x,-.020,-.055-length),(.006,.002,.010),nails,hand,12,8)
  line(name+'_Thumb'+tag,[(side*-.036,-.008,-.012),(side*-.059,-.016,-.035),(side*-.057,-.028,-.062)],.014,skin,hand)
 # Every character has a cup attachment; it is visible only for a coffee pose.
 cup=empty(name+'_Cup',(0,-.065,-.036),bpy.data.objects[name+'_HandR'])
 cylinder(name+'_Ceramic cup',(0,0,.035),.049,.10,M['Sage ceramic'],r2=.054,parent=cup)
 cylinder(name+'_Coffee surface',(0,0,.087),.046,.002,M['Coffee'],parent=cup)
 pts=[(.058+.022*math.cos(a),0,.033+.031*math.sin(a)) for a in np.linspace(0,2*math.pi,21)];line(name+'_Cup handle',pts,.007,M['Sage ceramic'],cup)
 export_collection(COL,ASSETS/(name.lower()+'.glb'))
 return root,body,COL

characters=[]
for idx,(name,provider) in enumerate([('Ada','claude'),('Milo','codex'),('June','claude'),('Wren','codex')]):characters.append(build_character(idx,name,provider))
COL=bpy.data.collections.new('Architecture and furniture');scene.collection.children.link(COL)

# --- Architecture: a cut-away loft, with an actual arched masonry wall. ---
cube('Architectural plinth',(0,0,-.19),(13.4,9.3,.38),'Plaster',.10)
cube('Inset foundation',(0,0,-.38),(12.7,8.65,.16),'Forest lacquer',.03)
cube('Floor substrate',(0,0,.007),(13.0,8.9,.05),'Oak',.005)
# Alternating staggered oak boards, with narrow joints and individual grain.
for col in range(49):
 x=-6.36+col*.265
 for row in range(-1,8):
  y=-4.33+row*1.30+(col%3)*.42
  lo=max(-4.44,y);hi=min(4.44,y+1.294)
  if hi>lo:cube('Oak floor board',(x,(lo+hi)/2,.042),(.260,hi-lo,.055),'Oak',.004)
wall=cube('Arched plaster wall',(0,4.42,1.82),(13.1,.28,3.65),'Plaster',.015)
# Apply wall bevel before cutting its openings.
bpy.context.view_layer.objects.active=wall
for mod in list(wall.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
for wx in [-4.80,-1.76,1.28]:
 width=2.40;bottom=.60;shoulder=2.40;r=width/2
 outline=[(wx-r,bottom),(wx+r,bottom)]+[(wx+r*math.cos(a),shoulder+r*math.sin(a)) for a in np.linspace(0,math.pi,33)]
 verts=[(x,y,z) for y in [4.05,4.85] for x,z in outline];nn=len(outline);faces=[tuple(range(nn-1,-1,-1)),tuple(range(nn,nn*2))]+[(i,(i+1)%nn,(i+1)%nn+nn,i+nn) for i in range(nn)]
 cutter=patch('Window cutter',verts,faces,'Plaster');bm=bmesh.new();bm.from_mesh(cutter.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(cutter.data);bm.free();bpy.context.view_layer.objects.active=wall;mod=wall.modifiers.new('Arched opening','BOOLEAN');mod.object=cutter;mod.operation='DIFFERENCE';mod.solver='EXACT';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
 for sx in [-r,r]:cube('Steel window upright',(wx+sx,4.31,(bottom+shoulder)/2),(.052,.08,shoulder-bottom),'Blackened steel',.008)
 line('Steel window arch',[(wx+r*math.cos(a),4.31,shoulder+r*math.sin(a)) for a in np.linspace(0,math.pi,33)],.031,'Blackened steel')
 cube('Steel window crossbar',(wx,4.30,1.88),(2.42,.085,.038),'Blackened steel',.006)
 cube('Steel window center',(wx,4.30,1.83),(.036,.085,2.42),'Blackened steel',.006)
 cube('Stone window sill',(wx,4.19,.57),(2.67,.56,.15),'Warm white',.025)
 # A warm, softly abstracted garden view. The real-time viewer can recolor it for evening.
 sky=mat('Window view '+str(wx),'#a8bcb2',.7)
 pp=sky.node_tree.nodes.get('Principled BSDF');pp.inputs['Emission Color'].default_value=rgba('#849e94');pp.inputs['Emission Strength'].default_value=.35
 back=patch('WindowView_'+str(wx),[(x,4.61,z) for x,z in outline],[tuple(range(nn))],sky);back.visible_shadow=False
 for j in range(5):
  xx=wx-.88+j*.44;sphere('Distant garden',(xx,4.69,.85+random.random()*.45),(.42,.03,.60),'Leaf light',segments=16,rings=12)
 # Folded linen on one side of each opening.
 cv=[];cf=[];nu,nv=18,16
 for v in range(nv+1):
  t=v/nv
  for u in range(nu+1):
   q=u/nu;cv.append((wx-1.23+q*.43+.03*math.sin(t*5),4.04+.047*math.sin(q*math.pi*8),3.48-t*2.83+.021*math.sin(q*7)))
 for v in range(nv):
  for u in range(nu):a=v*(nu+1)+u;cf.append((a,a+1,a+nu+2,a+nu+1))
 patch('Linen curtain',cv,cf,'Linen cream',solid=.003)
 cube('Curtain rail',(wx-1.03,4.04,3.5),(.66,.04,.04),'Brushed brass',.006)
# A low wall and timber slats define the lounge without blocking the viewer.
cube('Left cut-away wall',(-6.55,0,.64),(.22,8.95,1.28),'Forest lacquer',.025)
cube('Left stone cap',(-6.55,0,1.3),(.28,9.0,.08),'Warm white',.02)
for j in range(69):cube('Acoustic oak rib',(-6.409,-4.30+j*.126,.64),(.024,.028,1.14),'Walnut',.008)
cube('Skirting',(0,4.22,.15),(13,.065,.24),'Forest lacquer',.012)
cube('Back wall cornice',(0,4.22,3.65),(13.1,.10,.10),'Walnut',.01)
# A slim loft post and open roof beams establish architecture without hiding desks.
for yy in [-4.25,4.15]:cube('Loft post',(-6.49,yy,1.88),(.17,.17,3.75),'Blackened steel',.01)
cube('Loft beam',(-6.49,-.05,3.72),(.18,8.62,.18),'Blackened steel',.01)
for yy in [-4.1,-2.5,-.9,.7,2.3,4.1]:cube('Cross joist',(-5.84,yy,3.72),(1.32,.07,.12),'Walnut',.012)

# --- Original furniture ---
def mug(x,y,z,material='Warm white'):
 cylinder('Stoneware mug',(x,y,z+.043),.052,.086,material,r2=.056)
 cylinder('Coffee in mug',(x,y,z+.088),.046,.002,'Coffee')
 line('Mug handle',[(x+.05,y,z+.013),(x+.078,y,z+.012),(x+.079,y,z+.071),(x+.05,y,z+.072)],.008,material)

def books(x,y,z,n=4,vertical=False):
 cols=['Paper','Forest lacquer','Clay ceramic','Boucle navy','Linen cream']
 for j in range(n):
  if vertical:
   h=.25+random.random()*.11;cube('Book',(x+j*.072,y,z+h/2),(.06,.21,h),cols[j%5],.006);cube('Book spine line',(x+j*.072,y-.109,z+h*.70),(.04,.004,.008),'Brushed brass',.001)
  else:
   o=cube('Book',(x+random.uniform(-.02,.02),y,z+j*.038),(.26,.34,.035),cols[j%5],.006);o.rotation_euler.z=random.uniform(-.10,.10)

def leaf(a,b,w):
 a,b=Vector(a),Vector(b);d=b-a;side=d.cross(Vector((0,0,1)))
 if side.length<.001:side=Vector((1,0,0))
 side.normalize();v=[];f=[]
 for j in range(9):
  t=j/8;center=a+d*t+Vector((0,0,.04*math.sin(math.pi*t)));wid=w*math.sin(math.pi*t)**.8
  for k in [-1,0,1]:v.append(tuple(center+side*wid*k+Vector((0,0,-abs(k)*.027*math.sin(math.pi*t)))))
 for j in range(8):
  for k in range(2):q=j*3+k;f.append((q,q+1,q+4,q+3))
 patch('Ficus leaf',v,f,'Leaf dark' if random.random()<.6 else 'Leaf light',solid=.001)
 line('Leaf vein',[a,a+d*.5+Vector((0,0,.04)),b],.0018,'Leaf light')

def plant(x,y,s=1):
 cylinder('Fluted planter',(x,y,.24*s),.25*s,.44*s,'Clay ceramic',r2=.285*s)
 cylinder('Pot lip',(x,y,.475*s),.291*s,.047*s,'Clay ceramic')
 cylinder('Earth',(x,y,.489*s),.265*s,.008,'Soil')
 for j in range(30):
  a=j*math.pi/15;rod('Planter fluting',(x+math.cos(a)*.25*s,y+math.sin(a)*.25*s,.05*s),(x+math.cos(a)*.281*s,y+math.sin(a)*.281*s,.451*s),.005*s,'Clay ceramic')
 rod('Ficus trunk',(x,y,.48*s),(x+.02*s,y,1.68*s),.016*s,'Walnut')
 for j in range(20):
  a=j*2.399;height=.64+(j%10)*.13;start=(x,y,height*s);end=(x+math.sin(a)*(.30+random.random()*.13)*s,y+math.cos(a)*.38*s,(height+.10+random.random()*.12)*s)
  rod('Ficus branch',start,end,.006*s,'Walnut');leaf(end,(end[0]+math.sin(a)*.31*s,end[1]+math.cos(a)*.30*s,end[2]+.15*s),.15*s)

def chair(x,y,rot=0):
 g=empty('Chair',(x,y,0));g.rotation_euler.z=rot
 cylinder('Chair hub',(0,0,.26),.029,.30,'Blackened steel',parent=g)
 for j in range(5):
  a=j*2*math.pi/5;end=(math.sin(a)*.30,math.cos(a)*.30,.10);rod('Chair spoke',(0,0,.14),end,.019,'Blackened steel',g);sphere('Caster',end,(.035,.026,.032),'Black rubber',g,16,12)
 cube('Cushioned seat',(0,-.02,.455),(.55,.56,.13),'Boucle navy',.06,g)
 shell=cube('Walnut chair shell',(0,.235,.72),(.56,.10,.54),'Walnut',.045,g);shell.rotation_euler.x=-.10
 back=cube('Upholstered chair back',(0,.170,.74),(.50,.075,.43),'Boucle navy',.035,g);back.rotation_euler.x=-.10
 for side in [-1,1]:
  rod('Chair arm support',(side*.23,.04,.44),(side*.29,.035,.68),.015,'Blackened steel',g)
  cube('Leather armrest',(side*.29,-.015,.68),(.063,.30,.048),'Leather cognac',.02,g)
 return g

def desk(x,y,i):
 for sx in [-1.04,1.04]:
  cube('Desk trestle',(x+sx,y,.39),(.065,.67,.71),'Blackened steel',.012)
  cube('Desk foot',(x+sx,y,.045),(.11,.88,.075),'Blackened steel',.018)
 cube('Walnut desktop',(x,y,.80),(2.45,.94,.09),'Walnut',.036)
 cube('Desk front edge',(x,y-.456,.779),(2.40,.015,.03),'Walnut',.006)
 cube('Leather desk mat',(x+.08,y-.11,.853),(1.11,.55,.010),'Leather cognac',.035)
 cube('Keyboard',(x,y-.285,.874),(.68,.23,.036),'Blackened steel',.016)
 for r in range(4):
  for c in range(13):cube('Keyboard key',(x-.293+c*.048,y-.356+r*.048,.895),(.036,.035,.008),'Warm white',.006)
 cube('Spacebar',(x,y-.382,.9),(.22,.025,.007),'Warm white',.003)
 mouse=sphere('Mouse',(x+.52,y-.28,.89),(.047,.07,.031),'Warm white');cube('Mouse split',(x+.52,y-.30,.921),(.001,.051,.001),'Blackened steel',0)
 cube('Monitor base',(x,y+.20,.863),(.40,.24,.022),'Blackened steel',.027)
 cube('Monitor stem',(x,y+.22,1.052),(.065,.055,.36),'Blackened steel',.012)
 cube('Monitor aluminum',(x,y+.255,1.34),(1.18,.055,.725),'Blackened steel',.030)
 # Front faces -Y, corresponding to +Z after glTF export.
 sm=mat('Display '+str(i),'#30464d' if i==1 else '#ddd8c3',.65);p=sm.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=rgba('#607c75' if i==1 else '#c8c2aa');p.inputs['Emission Strength'].default_value=.25
 screen=patch('MonitorScreen_'+str(i),[(x-.550,y+.223,.999),(x+.550,y+.223,.999),(x+.550,y+.223,1.678),(x-.550,y+.223,1.678)],[(0,1,2,3)],sm)
 for q,loop in enumerate(screen.data.polygons[0].loop_indices):screen.data.uv_layers.active.data[loop].uv=[(0,0),(1,0),(1,1),(0,1)][q]
 # Screen illustration used in Blender renders; the viewer replaces it with canvas content.
 for j in range(6):cube('Display line',(x-.13,y+.217,1.48-j*.058),(.65-(j%3)*.09,.001,.011),'Leaf light' if i==1 else 'Sage ceramic',.001)
 text('Display heading','STUDIO.TS' if i==1 else 'FIELD NOTES',(x-.33,y+.209,1.588),.058,'Paper' if i==1 else 'Forest lacquer',align='LEFT')
 sphere('Webcam',(x,y+.220,1.690),(.005,.003,.005),'Black rubber',segments=12,rings=8)
 # A precise articulated brass task lamp.
 cylinder('Task lamp foot',(x-.96,y+.17,.871),.104,.028,'Blackened steel')
 rod('Task lamp lower',(x-.96,y+.17,.88),(x-.96,y+.17,1.15),.012,'Brushed brass');rod('Task lamp upper',(x-.96,y+.17,1.15),(x-.74,y+.15,1.34),.013,'Brushed brass')
 cylinder('Task lampshade',(x-.71,y+.15,1.33),.124,.12,'Forest lacquer',r2=.055)
 glow=mat('Warm task glow '+str(i),'#ffe5b6',.5);p=glow.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=rgba('#ffd49b');p.inputs['Emission Strength'].default_value=2
 cylinder('LampGlow_'+str(i),(x-.71,y+.15,1.268),.111,.005,glow)
 mug(x+.93,y-.14,.85,'Sage ceramic');books(x-.92,y-.22,.877,2)
 line('Pencil',[(x-.99,y-.35,.917),(x-.81,y-.12,.917)],.0055,'Brushed brass')
 # Tiny brass nameplate sits on the physical desk, without floating labels.
 cube('Nameplate',(x+.81,y+.17,.902),(.37,.032,.067),'Brushed brass',.009)
 text('Desk name',['ADA','MILO','JUNE','WREN','JULES','KAI'][i],(x+.81,y+.150,.905),.034,'Forest lacquer')
 chair(x,y-.91,math.pi)
 return (x,y-.92)

DESKS=[(-1.35,2.47),(1.55,2.47),(-1.35,-.39),(1.55,-.39)]
seats=[desk(x,y,i) for i,(x,y) in enumerate(DESKS)]
# Softer woven rugs under each desk pair.
for yy in [2.1,-.8]:cube('Woven workspace rug',(.1,yy,.081),(5.87,2.38,.028),'Rug oat',.015)
# Lounge: a low modular sofa, sculpted timber chair, round tables and a linen rug.
cube('Lounge rug',(-4.65,-1.78,.086),(3.05,4.15,.035),'Linen cream',.025)
for yy in [-2.55,-1.52,-.49]:
 for xx in [-6.0,-5.27]:cylinder('Sofa foot',(xx,yy,.17),.033,.22,'Blackened steel')
 cube('Sofa module',(-5.61,yy,.385),(1.03,1.0,.30),'Boucle olive',.12)
 cube('Sofa cushion',(-5.56,yy,.57),(.85,.94,.16),'Boucle olive',.075)
 cube('Sofa back',(-6.05,yy,.83),(.23,1.0,.77),'Boucle olive',.11)
for yy in [-3.09,.05]:cube('Sofa arm',(-5.65,yy,.69),(1.11,.20,.68),'Boucle olive',.09)
for yy,matl in [(-2.45,'Linen cream'),(-.40,'Leather cognac')]:
 pillow=cube('Sofa pillow',(-5.89,yy,.91),(.21,.50,.48),matl,.095);pillow.rotation_euler.y=-.2
# Round walnut nesting tables with thin metal tripod legs.
for x,y,r,z in [(-4.35,-1.50,.60,.48),(-4.15,-2.14,.36,.35)]:
 cylinder('Round walnut table',(x,y,z),r,.052,'Walnut')
 for j in range(3):
  a=j*2*math.pi/3;rod('Table leg',(x+math.cos(a)*r*.65,y+math.sin(a)*r*.65,.12),(x+math.cos(a)*r*.48,y+math.sin(a)*r*.48,z-.02),.013,'Blackened steel')
books(-4.32,-1.53,.53,3);mug(-4.11,-1.25,.51,'Clay ceramic')
# Curved accent chair with cognac upholstery.
g=empty('Reading chair',(-3.80,-3.27,0));g.rotation_euler.z=-.34
for xx in [-.31,.31]:
 for yy in [-.28,.28]:rod('Lounge chair leg',(xx,yy,.10),(xx*.85,yy*.9,.46),.023,'Walnut',g)
cube('Reading seat',(0,0,.47),(.80,.75,.19),'Leather cognac',.095,g)
cube('Reading back',(0,.30,.83),(.81,.20,.62),'Leather cognac',.085,g)
for xx in [-.43,.43]:cube('Reading arm',(xx,0,.67),(.075,.78,.08),'Walnut',.035,g)
# A brass floor lamp and warm fabric shade.
cylinder('Floor lamp base',(-6.05,-3.76,.105),.23,.055,'Blackened steel');rod('Floor lamp mast',(-6.05,-3.76,.12),(-6.05,-3.76,1.96),.014,'Brushed brass');cylinder('Linen floor shade',(-6.05,-3.76,1.87),.33,.34,'Parchment',r2=.23)

# Coffee alcove: ribbed green cabinets and polished stone countertop.
cube('Coffee cabinet',(-4.70,3.07,.43),(2.73,.91,.78),'Forest lacquer',.03)
for j in range(36):cube('Coffee cabinet rib',(-6.02+j*.075,2.596,.44),(.022,.017,.70),'Forest lacquer',.006)
cube('Stone coffee countertop',(-4.70,3.07,.855),(2.83,1.03,.10),'Warm white',.035)
for xx in [-5.34,-4.55]:rod('Cabinet pull',(xx,2.567,.46),(xx,2.567,.61),.012,'Brushed brass')
cube('Espresso machine',(-5.29,3.11,1.215),(.77,.57,.62),'Blackened steel',.052)
cube('Espresso face',(-5.29,2.813,1.26),(.67,.022,.36),'Brushed brass',.016)
cube('Espresso tray',(-5.29,2.78,.95),(.83,.41,.055),'Blackened steel',.025)
for xx in [-5.45,-5.13]:
 rod('Coffee spout',(xx,2.79,1.22),(xx,2.67,1.12),.013,'Blackened steel');mug(xx,2.70,.982)
for xx in [-5.48,-5.30,-5.12]:cylinder('Control dial',(xx,2.795,1.37),.030,.01,'Blackened steel').rotation_euler.x=math.pi/2
cylinder('Bean hopper',(-4.37,3.20,1.23),.105,.50,'Blackened steel',r2=.16)
cube('Grinder',(-4.37,3.20,1.075),(.26,.33,.32),'Sage ceramic',.04)
for j in range(3):mug(-4.01+j*.18,2.92,.91,'Clay ceramic')
text('Coffee sign','A LITTLE ROOM TO THINK.',(-4.77,4.245,.32),.095,'Paper')
# Shelves, a record player and framed work on the right wall.
cube('Library backing',(4.88,4.18,1.71),(2.82,.36,3.16),'Forest lacquer',.022)
for zz in [.27,.84,1.43,2.02,2.62,3.23]:cube('Library shelf',(4.88,3.89,zz),(2.94,.73,.051),'Walnut',.012)
for xx in [3.45,4.88,6.31]:cube('Library divider',(xx,3.93,1.72),(.047,.65,2.92),'Walnut',.005)
for level in range(5):
 for side in range(2):books(3.65+side*1.44,3.77,.31+level*.59,5 if level%2==0 else 3,True)
for x,z in [(4.54,1.0),(5.93,2.17),(4.52,2.72)]:
 cylinder('Shelf vase',(x,3.76,z),.09,.25,'Clay ceramic',r2=.055)
 for j in range(3):line('Dried branch',[(x,3.76,z+.1),(x+math.sin(j*2)*.12,3.74,z+.43)],.003,'Oak')
text('Library lettering','WORK / LIFE',(4.90,3.87,3.50),.17,'Forest lacquer')
cube('Credenza',(5.62,-.42,.42),(1.37,2.22,.73),'Forest lacquer',.03)
cube('Credenza top',(5.62,-.42,.835),(1.47,2.31,.10),'Walnut',.03)
for yy in [-1.13,-.43,.27]:cube('Credenza door',(4.923,yy,.45),(.034,.64,.64),'Forest lacquer',.01)
# Turntable.
cube('Record player',(5.61,-.25,.955),(.78,.57,.11),'Walnut',.016)
cylinder('Vinyl',(5.54,-.24,1.016),.225,.009,'Black rubber');cylinder('Record label',(5.54,-.24,1.023),.054,.002,'Clay ceramic')
line('Tone arm',[(5.89,-.07,1.038),(5.90,-.32,1.048),(5.72,-.41,1.040)],.008,'Brushed brass')
books(5.64,-1.11,.93,4)
# Two carefully shaped pendants; their interior is emissive.
for j,x in enumerate([-1.2,1.8]):
 rod('Pendant wire',(x,.75,3.70),(x,.75,2.80),.005,'Blackened steel')
 ringbody('Pendant shade',[(2.76,.37,.37,.75),(2.80,.35,.35,.75),(2.90,.28,.28,.75),(2.99,.16,.16,.75),(3.015,.04,.04,.75)],'Forest lacquer',center=(x,0,0),n=48,sub=1)
 lightmat=mat('Pendant luminous '+str(j),'#ffe0a3',.5);p=lightmat.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=rgba('#ffd091');p.inputs['Emission Strength'].default_value=3
 cylinder('PendantGlow_'+str(j),(x,.75,2.77),.34,.006,lightmat)
# Plants at the edges leave clear circulation space.
plant(-6.03,1.54,1.03);plant(6.04,2.20,1.06);plant(5.84,-3.63,.92);plant(-5.92,-4.02,.52)
# Pinboard, framed graphic and small brass studio number.
cube('Notice board',(6.46,1.03,1.53),(.07,1.37,1.20),'Walnut',.025)
cube('Board linen',(6.414,1.03,1.53),(.022,1.26,1.10),'Linen cream',.013)
for j in range(5):
 yy=.59+(j%2)*.47;zz=1.25+(j//2)*.32;o=cube('Pinned note',(6.398,yy,zz),(.010,.34,.26),['Paper','Clay ceramic','Sage ceramic'][j%3],.002);o.rotation_euler.x=(j%2-.5)*.08
 sphere('Brass pin',(6.387,yy,zz+.105),(.009,.009,.009),'Brushed brass',segments=12,rings=8)
text('Front plinth logo','W O R K L I V E',(0,-4.665,-.16),.16,'Forest lacquer')
text('Studio plate','01',(-6.404,-3.71,.94),.26,'Brushed brass',rotation=(math.pi/2,0,math.pi/2))
export_collection(COL,ASSETS/'studio.glb')
room_collection=COL;COL=None

# Position the authored characters for a matching Blender render.
for idx,(root,body,col) in enumerate(characters):
 name=['Ada','Milo','June','Wren'][idx]
 if idx<3:
  root.location=(seats[idx][0],seats[idx][1],0);root.rotation_euler.z=math.pi;body.location=(0,-.025,.535)
  for tag in ['L','R']:
   bpy.data.objects[name+'_Thigh'+tag].rotation_euler.x=-math.pi/2;bpy.data.objects[name+'_Shin'+tag].rotation_euler.x=math.pi/2
   bpy.data.objects[name+'_UpperArm'+tag].rotation_euler.x=-.80;bpy.data.objects[name+'_Forearm'+tag].rotation_euler.x=-.80
  bpy.data.objects[name+'_Head'].rotation_euler.x=.07
 else:
  root.location=(-3.72,.57,0);root.rotation_euler.z=-.25
  bpy.data.objects[name+'_UpperArmR'].rotation_euler.x=-.28;bpy.data.objects[name+'_ForearmR'].rotation_euler.x=-1.32;bpy.data.objects[name+'_Cup'].rotation_euler.x=1.60
 # Cups are a separate rigid prop, so they can be hidden per pose.
 if idx<3:
  cup=bpy.data.objects[name+'_Cup']
  for obj in [cup]+list(cup.children_recursive):obj.hide_render=True;obj.hide_viewport=True

# Render-only lighting and staging, excluded from glTF exports.
rendercol=bpy.data.collections.new('Render cameras and lighting');scene.collection.children.link(rendercol);COL=rendercol
cube('Backdrop',(0,0,-.525),(200,200,.10),mat('Backdrop matte','#253135',.93),0)
world=bpy.data.worlds.new('Studio ambience');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=rgba('#aebfcc');world.node_tree.nodes['Background'].inputs[1].default_value=.28;scene.world=world

def light(name,kind,loc,power,color,size=1,target=(0,0,0)):
 d=bpy.data.lights.new(name,kind);d.energy=power;d.color=rgba(color)[:3]
 if kind=='AREA':d.shape='DISK';d.size=size
 if kind=='SUN':d.angle=.07
 o=bpy.data.objects.new(name,d);rendercol.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
light('Afternoon sun','SUN',(-5,6,8),2.5,'#ffdbab',target=(1,-1,0))
light('Soft window key','AREA',(-3.5,3.1,5.7),800,'#ffdfb9',4,target=(0,0,0))
light('Cool open sky','AREA',(3,-4,7),600,'#c9e3ee',5,target=(0,0,1))
light('Warm bounce','AREA',(-5,-4,3),180,'#eac9a3',4,target=(0,0,1))
for x in [-1.2,1.8]:light('Pendant','AREA',(x,.75,2.72),28,'#ffd39d',.5,target=(x,.75,0))
light('Floor lamp','POINT',(-6.05,-3.76,1.66),9,'#ffd49b')

def camera(name,loc,target,lens=48,ortho=None):
 d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);rendercol.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens
 if ortho:d.type='ORTHO';d.ortho_scale=ortho
 return o
hero=camera('Office hero',(13,-18,13),(0,0,.90),50,17.6)
portrait=camera('Character portrait',(-3.1,-2.35,1.98),(-3.72,.57,1.48),58)
portrait.data.dof.use_dof=True;portrait.data.dof.focus_distance=(Vector((-3.72,.57,1.48))-portrait.location).length;portrait.data.dof.aperture_fstop=3.8
deskcam=camera('At the desks',(5.0,-7.5,4.4),(-.7,.8,1.03),50)
scene.camera=hero
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True
scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='METAL'
 if any(d.type=='METAL' for d in prefs.devices):scene.cycles.device='GPU';print('USING METAL',flush=True)
except Exception as e:print('CPU render:',e,flush=True)
scene.render.resolution_x=2000;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
try:scene.view_settings.look='AgX - Medium High Contrast'
except:pass
scene.render.filepath=str(OUT/'blender-office-preview.png')
# Pack generated texture images; the .blend remains usable without side files.
for im in bpy.data.images:
 if im.source=='FILE' or im.filepath:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Worklive Studio.blend'))
if '--no-render' not in sys.argv:
 bpy.ops.render.render(write_still=True)
 scene.camera=portrait;scene.render.resolution_x=1100;scene.render.resolution_y=1400;scene.render.resolution_percentage=100;scene.render.filepath=str(OUT/'blender-character-preview.png');bpy.ops.render.render(write_still=True)
print('STUDIO BUILD COMPLETE',flush=True)
