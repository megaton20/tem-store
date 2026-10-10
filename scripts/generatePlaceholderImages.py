"""
Generates simple placeholder PNGs for every seeded product so the storefront
looks populated during development. Swap these out for real product photos
later - just keep the same filenames referenced in seeders/seed.js.
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'images')
os.makedirs(OUT_DIR, exist_ok=True)

SIZE = (600, 600)

# name, filename, bg hex, fg hex, emoji-ish label (kept short - no emoji font needed)
PRODUCTS = [
    ("Classic Chocolate Chip", "cookie-classic.png", "#EFE0C8", "#3A2317", "CHOC CHIP"),
    ("Double Fudge Brownie", "cookie-fudge.png", "#5B3A26", "#FBF3E7", "FUDGE"),
    ("Peanut Butter Crunch", "cookie-peanut.png", "#C97A2B", "#FBF3E7", "PB CRUNCH"),
    ("Oatmeal Raisin Spice", "cookie-oatmeal.png", "#A8611E", "#FBF3E7", "OATMEAL"),
    ("Remote Control Racer", "toy-rc-car.png", "#2F4A34", "#FBF3E7", "RC CAR"),
    ("Wireless Earbuds Pro", "gadget-earbuds.png", "#3A2317", "#FBF3E7", "EARBUDS"),
    ("18K Gold Pendant Necklace", "vault-gold-pendant.png", "#1B1B22", "#C9A24B", "GOLD"),
]

def load_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def draw_cookie_texture(draw, cx, cy, r, fg):
    # a ring + dots to vaguely suggest a cookie without needing real art
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=fg, width=6)
    import random
    random.seed(r)
    for _ in range(10):
        ang = random.uniform(0, 6.283)
        dist = random.uniform(0.15, 0.75) * r
        dx, dy = cx + dist * random.uniform(-1, 1) * 0.6, cy + dist * random.uniform(-1, 1) * 0.6
        dr = random.uniform(8, 16)
        draw.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=fg)

for name, filename, bg, fg, label in PRODUCTS:
    img = Image.new("RGB", SIZE, bg)
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE[0] // 2, SIZE[1] // 2 - 30

    if "cookie" in filename:
        draw_cookie_texture(draw, cx, cy, 180, fg)
    elif "vault" in filename:
        # simple diamond/gem shape for the vault item
        pts = [(cx, cy - 160), (cx + 140, cy - 20), (cx, cy + 180), (cx - 140, cy - 20)]
        draw.polygon(pts, outline=fg, width=6)
        draw.line([cx - 140, cy - 20, cx + 140, cy - 20], fill=fg, width=4)
        draw.line([cx, cy - 160, cx, cy + 180], fill=fg, width=2)
    else:
        draw.rounded_rectangle([cx - 160, cy - 140, cx + 160, cy + 140], radius=28, outline=fg, width=6)

    font = load_font(40)
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy + 190), label, fill=fg, font=font)

    small_font = load_font(24)
    footer = "TEM STORE"
    bbox2 = draw.textbbox((0, 0), footer, font=small_font)
    fw = bbox2[2] - bbox2[0]
    draw.text(((SIZE[0] - fw) / 2, SIZE[1] - 50), footer, fill=fg, font=small_font)

    img.save(os.path.join(OUT_DIR, filename))
    print(f"Generated {filename}")

print("Done.")
