import json, os, urllib.request, sys
op=urllib.request.build_opener(); op.addheaders=[("User-Agent","Worklive-mock/0.1 (local prototype)")]; urllib.request.install_opener(op)
models = ["metal_office_desk","modern_arm_chair_01","sofa_02","potted_plant_01","potted_plant_04","modern_coffee_table_01","steel_frame_shelves_01","classic_laptop","round_wooden_table_01","bar_chair_round_01","wall_clock","television_02"]
def get(url, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if not os.path.exists(path): urllib.request.urlretrieve(url, path)
for m in models:
    try:
        d = json.load(urllib.request.urlopen(f"https://api.polyhaven.com/files/{m}"))
        g = d["gltf"]["1k"]["gltf"]
        get(g["url"], f"ph/{m}/{m}.gltf")
        for rel, f in g["include"].items(): get(f["url"], f"ph/{m}/{rel}")
        print("ok", m)
    except Exception as e: print("fail", m, e)
# HDRI
d = json.load(urllib.request.urlopen("https://api.polyhaven.com/files/art_studio"))
get(d["hdri"]["1k"]["hdr"]["url"], "ph/art_studio_1k.hdr"); print("ok hdri")
# floor texture
d = json.load(urllib.request.urlopen("https://api.polyhaven.com/files/wood_floor"))
for k in ["Diffuse","Rough","nor_gl"]:
    get(d[k]["1k"]["jpg"]["url"], f"ph/wood_floor_{k}.jpg")
print("ok floor")
get("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb","Xbot.glb"); print("ok xbot")
