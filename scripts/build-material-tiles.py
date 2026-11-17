"""Build local map tiles from the supplied, independently calibrated map images."""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = 250_000_000
root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--only', default='')
args = parser.parse_args()
calibration = json.loads((root/'source/maps/src/data/companion-material-calibration.json').read_text(encoding='utf-8'))
configs = json.loads((root/'source/tracker/app/data/maps.json').read_text(encoding='utf-8'))
source = root/'source/maps/public/materials'
public = root/'source/tracker/public/companion'

def projection(layer):
    if layer.get('matrix'):
        matrix = np.array(layer['matrix']).reshape(2, 3)
        project = lambda x, z: (matrix[0,0]*x+matrix[0,1]*z+matrix[0,2], matrix[1,0]*x+matrix[1,1]*z+matrix[1,2])
    else:
        spec = layer['tps']
        points = np.array(spec['game_points'], dtype=float)
        origin = points[0]
        scale = max(1, np.max(np.abs(points-origin)))
        points = (points-origin)/scale
        distances = np.sum((points[:,None,:]-points[None,:,:])**2, axis=2)
        radial = distances*np.log(np.maximum(distances, 1e-16))
        affine = np.c_[np.ones(len(points)), points]
        system = np.block([[radial,affine],[affine.T,np.zeros((3,3))]])
        weights = np.linalg.solve(system, np.r_[np.array(spec['img_points']),np.zeros((3,2))])
        def project(x, z):
            x,z=(x-origin[0])/scale,(z-origin[1])/scale
            u=weights[-3,0]+weights[-2,0]*x+weights[-1,0]*z
            v=weights[-3,1]+weights[-2,1]*x+weights[-1,1]*z
            for point,weight in zip(points,weights):
                distance=(x-point[0])**2+(z-point[1])**2
                radial=distance*np.log(np.maximum(distance,1e-16))
                u=u+weight[0]*radial;v=v+weight[1]*radial
            return u,v
    if not layer.get('postHomography'):return project
    h=np.array(layer['postHomography'])
    def transform(x,z):
        u,v=project(x,z)
        d=h[2,0]*u+h[2,1]*v+h[2,2]
        return (h[0,0]*u+h[0,1]*v+h[0,2])/d,(h[1,0]*u+h[1,1]*v+h[1,2])/d
    return transform

def inverse_crs(px,py,config,zoom):
    a,b,c,d=config['transform']
    x=(px/(2**zoom)-b)/a
    z=(d-py/(2**zoom))/c
    rotation=config.get('coordinateRotation',0)%360
    angle=np.deg2rad(rotation)
    return x*np.cos(angle)+z*np.sin(angle),-x*np.sin(angle)+z*np.cos(angle)

def projected_bounds(config,zoom):
    points=np.array(config['bounds'],dtype=float)
    a,b,c,d=config['transform'];angle=np.deg2rad(config.get('coordinateRotation',0))
    x=points[:,0]*np.cos(angle)-points[:,1]*np.sin(angle)
    z=points[:,0]*np.sin(angle)+points[:,1]*np.cos(angle)
    px=(a*x+b)*(2**zoom);py=(-c*z+d)*(2**zoom)
    return int(np.floor(px.min()/256)),int(np.floor(py.min()/256)),int(np.floor(px.max()/256)),int(np.floor(py.max()/256))

def write_tile(file,image):
    file.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(image).save(file,format='WEBP',quality=90,method=3)

tiles=0
for entry in calibration['maps']:
    if args.only and entry['key']!=args.only:continue
    key=entry['key'];config=configs[key].get('svg') or configs[key]['tile']
    for floor,layer in entry['floors'].items():
        with Image.open(source/layer['image']) as im:image=np.array(im.convert('RGB'))
        project=projection(layer)
        for zoom in range(entry['maxNativeZoom']+1):
            x0,y0,x1,y1=projected_bounds(config,zoom)
            for tx in range(x0,x1+1):
                for ty in range(y0,y1+1):
                    px,py=np.meshgrid(np.arange(256,dtype=float)+tx*256,np.arange(256,dtype=float)+ty*256)
                    x,z=inverse_crs(px,py,config,zoom)
                    u,v=project(x,z)
                    tile=cv2.remap(image,u.astype(np.float32),v.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(24,24,24))
                    if layer.get('crop'):
                        left,top,right,bottom=layer['crop']
                        tile[(u<left)|(u>right)|(v<top)|(v>bottom)]=(24,24,24)
                    for left,top,right,bottom in layer.get('exclude',[]):
                        tile[(u>=left)&(u<=right)&(v>=top)&(v<=bottom)]=(24,24,24)
                    # Nitro excludes a public file whose basename starts with a dash.
                    write_tile(public/'terrain'/key/floor/str(zoom)/str(tx)/('y'+str(ty)+'.webp'),tile)
                    tiles+=1
        print(key,floor,'tiles built',flush=True)
        del image
for entry in calibration['referenceImages']:
    if args.only and entry['key']!=args.only:continue
    with Image.open(source/entry['image']) as image:
        image=image.convert('RGB')
        for zoom in range(5):
            width=max(1,round(image.width*(2**zoom)/16));height=max(1,round(image.height*(2**zoom)/16))
            scaled=image.resize((width,height),Image.Resampling.LANCZOS)
            for x in range((width+255)//256):
                for y in range((height+255)//256):
                    tile=Image.new('RGB',(256,256),(24,24,24))
                    crop=scaled.crop((x*256,y*256,min(width,(x+1)*256),min(height,(y+1)*256)))
                    tile.paste(crop,(0,0))
                    write_tile(public/'reference'/entry['key']/str(zoom)/str(x)/(str(y)+'.webp'),np.array(tile))
                    tiles+=1
    print(entry['key'],'reference tiles built',flush=True)
print(json.dumps({'tilesBuilt':tiles,'output':str(public)},ensure_ascii=False),flush=True)
