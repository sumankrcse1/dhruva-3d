from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, re
ROOT=Path(__file__).resolve().parent.parent
files=sorted(p for p in (ROOT/'renders').glob('*.png') if re.match(r'\d\d_',p.name))
assert len(files)==10, f'Expected ten 4K renders; found {len(files)}'
labels=['Master overview','EFM inverted installation','ANT-50 lightning sensor','LRX-1 network receiver','Distributed lightning network','Wearable / concept hardware','Command application / concept','Translator / concept workflow','End-to-end system architecture','Emergency alert demonstration']
sheet=Image.new('RGB',(1440,2260),(12,20,28)); draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',19)
head=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',28)
draw.text((28,22),'DHRUVA DEFENCE / 3D SYSTEM VISUALIZATION',font=head,fill=(230,237,241))
draw.text((28,62),'Editable Blender concept scene  |  Ten Cycles views  |  3840 x 2160 each',font=font,fill=(150,174,188))
metadata=[]
for i,(path,label) in enumerate(zip(files,labels)):
    im=Image.open(path); assert im.size==(3840,2160),(path.name,im.size)
    metadata.append({'file':path.name,'width':im.width,'height':im.height,'bytes':path.stat().st_size})
    im.thumbnail((692,390)); x=20+(i%2)*710; y=115+(i//2)*421
    sheet.paste(im,(x,y)); draw.text((x+4,y+393),f'{i+1:02d} / {label}',font=font,fill=(207,222,229))
sheet.save(ROOT/'renders'/'Contact_sheet.jpg',quality=94)
with open(ROOT/'renders'/'render_manifest.json','w') as f: json.dump(metadata,f,indent=2)
qa=ROOT/'renders'/'qa'; qa.mkdir(exist_ok=True)
for path in (ROOT/'renders').glob('QA_*.png'): path.rename(qa/path.name)
print(json.dumps(metadata,indent=2))
