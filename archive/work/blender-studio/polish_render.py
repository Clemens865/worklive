import bpy,math,numpy as np
from pathlib import Path
from mathutils import Vector
OUT=Path('/Users/clemenshoenig/Documents/Codex/2026-09-30/i-w/outputs/worklive-blender-studio')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Worklive Studio.blend'))
n=512;Y,X=np.mgrid[0:n,0:n].astype(float);rng=np.random.default_rng(14)
grain=.026*np.sin(X*.22+np.sin(Y*.009)*4)+.015*np.sin(X*.7+np.sin(Y*.03))+.007*rng.normal(size=(n,n))
c=[int('b19b81'[i:i+2],16)/255 for i in [0,2,4]];base=np.array([v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in c])
a=np.ones((n,n,4),dtype=np.float32);a[:,:,:3]=np.clip(base[None,None,:]*(1+grain[:,:,None]*2),0,1)
im=bpy.data.images.new('oak-grain',width=n,height=n,alpha=True);im.pixels.foreach_set(a.ravel());im.filepath_raw=str(OUT/'assets/oak-grain.png');im.file_format='PNG';im.save();im.pack()
m=bpy.data.materials['Oak'];nodes=m.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.67
room=bpy.data.collections['Architecture and furniture'];bpy.ops.object.select_all(action='DESELECT')
for o in room.all_objects:
 if not o.name.startswith(('Display line','Display heading')):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'assets/studio.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
scene=bpy.context.scene;hero=bpy.data.objects['Office hero'];portrait=bpy.data.objects['Character portrait'];portrait.location=(-3.1,-2.35,1.98);target=Vector((-3.72,.57,1.48));portrait.rotation_euler=(target-portrait.location).to_track_quat('-Z','Y').to_euler();portrait.data.dof.use_dof=True;portrait.data.dof.focus_distance=(target-portrait.location).length;portrait.data.dof.aperture_fstop=3.8
scene.camera=hero;scene.render.resolution_x=2000;scene.render.resolution_y=1400;scene.render.resolution_percentage=100;scene.render.filepath=str(OUT/'blender-office-preview.png')
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
 prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='METAL'
 scene.cycles.device='GPU'
except:pass
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Worklive Studio.blend'))
bpy.ops.render.render(write_still=True)
scene.camera=portrait;scene.render.resolution_x=1100;scene.render.resolution_y=1400;scene.render.filepath=str(OUT/'blender-character-preview.png');bpy.ops.render.render(write_still=True)
print('FINAL RENDERS SAVED',flush=True)
