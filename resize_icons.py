import os
from PIL import Image

target_dir = 'miniprogram/images'
target_size = (81, 81)

files = [f for f in os.listdir(target_dir) if f.startswith('tab-') and f.endswith('.png')]

print(f"Found {len(files)} images to resize in {target_dir}")

for filename in files:
    filepath = os.path.join(target_dir, filename)
    try:
        with Image.open(filepath) as img:
            # Resize using LANCZOS for quality
            img_resized = img.resize(target_size, Image.Resampling.LANCZOS)
            img_resized.save(filepath, optimize=True)
            print(f"Resized {filename} to {target_size}")
    except Exception as e:
        print(f"Failed to resize {filename}: {e}")
