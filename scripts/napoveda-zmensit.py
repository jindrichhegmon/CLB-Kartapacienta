#!/usr/bin/env python3
"""Zmenší snímky nápovědy (public/napoveda/img/*.png) na 256 barev – stejně jako v PéčeDoma. Spouštět po napoveda-snimky.mjs."""
import pathlib
from PIL import Image

slozka = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'napoveda' / 'img'
pred = po = 0
for f in sorted(slozka.glob('*.png')):
    pred += f.stat().st_size
    im = Image.open(f).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    im.save(f, optimize=True)
    po += f.stat().st_size
print(f'{len(list(slozka.glob("*.png")))} obrázků: {pred // 1024} kB → {po // 1024} kB')
