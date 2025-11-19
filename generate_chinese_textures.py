#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chinese Character Texture Generator for Dwarf Fortress
Replaces all 18x18 textures with Chinese characters related to philosophy and art
"""

import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

# Chinese characters related to philosophy and art
PHILOSOPHY_CHARS = [
    # Philosophy concepts
    "道", "德", "仁", "义", "礼", "智", "信", "和", "中", "正",
    "理", "气", "心", "性", "天", "地", "人", "物", "生", "死",
    "有", "无", "虚", "实", "阴", "阳", "动", "静", "变", "常",
    # Art and aesthetics
    "美", "艺", "文", "诗", "书", "画", "音", "乐", "舞", "戏",
    "雅", "俗", "精", "神", "韵", "味", "境", "意", "情", "思",
    # Additional philosophical terms
    "知", "行", "学", "问", "思", "辨", "修", "养", "悟", "觉",
    "空", "色", "相", "法", "因", "果", "缘", "业", "苦", "乐",
    # More art-related
    "墨", "笔", "纸", "砚", "琴", "棋", "书", "画", "茶", "酒",
    "山", "水", "花", "鸟", "竹", "梅", "兰", "菊", "松", "石",
]

def get_chinese_font(size=16):
    """Try to get a Chinese font, fallback to default if not available"""
    font_paths = [
        # Windows common fonts
        "C:/Windows/Fonts/msyh.ttc",  # Microsoft YaHei
        "C:/Windows/Fonts/simsun.ttc",  # SimSun
        "C:/Windows/Fonts/simhei.ttf",  # SimHei
        "C:/Windows/Fonts/STKAITI.TTF",  # KaiTi
        # Linux common fonts
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
        # macOS common fonts
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                return ImageFont.truetype(font_path, size)
            except:
                continue
    
    # Fallback to default font (may not support Chinese)
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()

def generate_chinese_char():
    """Get a random Chinese character related to philosophy/art"""
    return random.choice(PHILOSOPHY_CHARS)

def generate_colors():
    """Generate random but readable color combinations"""
    # Background colors - darker, muted tones
    bg_colors = [
        (20, 30, 40), (40, 30, 20), (30, 20, 40), (25, 35, 25),
        (35, 25, 30), (30, 25, 35), (40, 35, 30), (30, 40, 35),
        (25, 30, 35), (35, 30, 25), (40, 30, 25), (25, 40, 30),
        (30, 35, 40), (35, 40, 30), (40, 25, 30), (30, 30, 40),
    ]
    
    # Text colors - brighter, contrasting
    text_colors = [
        (200, 180, 160), (180, 200, 160), (160, 180, 200), (200, 160, 180),
        (220, 200, 180), (180, 220, 200), (200, 180, 220), (220, 180, 200),
        (240, 220, 200), (200, 240, 220), (220, 200, 240), (240, 200, 220),
        (255, 230, 200), (200, 255, 230), (230, 200, 255), (255, 200, 230),
        (180, 200, 240), (240, 180, 200), (200, 240, 180), (240, 200, 180),
    ]
    
    bg = random.choice(bg_colors)
    text = random.choice(text_colors)
    
    # Ensure good contrast
    while sum(abs(bg[i] - text[i]) for i in range(3)) < 100:
        text = random.choice(text_colors)
    
    return bg, text

def create_chinese_texture(size=18, char=None, bg_color=None, text_color=None, preserve_alpha=False):
    """Create a single 18x18 texture with a Chinese character"""
    if char is None:
        char = generate_chinese_char()
    if bg_color is None or text_color is None:
        bg_color, text_color = generate_colors()
    
    # Create image with background color (RGBA if preserving alpha)
    if preserve_alpha:
        img = Image.new('RGBA', (size, size), bg_color + (255,))
    else:
        img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Try to get Chinese font
    font_size = size - 4  # Leave some padding
    font = get_chinese_font(font_size)
    
    # Get text bounding box to center it
    try:
        bbox = draw.textbbox((0, 0), char, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    except:
        # Fallback if font doesn't work
        text_width = size // 2
        text_height = size // 2
    
    # Center the character
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - 2  # Slight vertical adjustment
    
    # Draw the character
    try:
        if preserve_alpha:
            draw.text((x, y), char, fill=text_color + (255,), font=font)
        else:
            draw.text((x, y), char, fill=text_color, font=font)
    except Exception as e:
        # Fallback: draw a simple rectangle if font fails
        if preserve_alpha:
            draw.rectangle([4, 4, size-4, size-4], fill=text_color + (255,))
        else:
            draw.rectangle([4, 4, size-4, size-4], fill=text_color)
    
    return img

def process_texture_file(file_path, texture_size=18):
    """Process a PNG file and replace all textures with Chinese characters"""
    print(f"Processing: {file_path.name}")
    
    try:
        # Open the image
        img = Image.open(file_path)
        width, height = img.size
        original_mode = img.mode
        
        # Calculate grid dimensions
        cols = width // texture_size
        rows = height // texture_size
        
        print(f"  Image size: {width}x{height}, Mode: {original_mode}")
        print(f"  Grid: {cols} columns x {rows} rows = {cols * rows} textures")
        
        # Preserve alpha channel if original image has it
        preserve_alpha = original_mode in ('RGBA', 'LA', 'P')
        
        # Create new image with same size and mode
        # Use opaque background (alpha=255) even if preserving alpha channel
        if preserve_alpha:
            new_img = Image.new('RGBA', (width, height), (0, 0, 0, 255))  # Opaque black background
        else:
            new_img = Image.new('RGB', (width, height))
        
        # Process each texture in the grid
        for row in range(rows):
            for col in range(cols):
                # Calculate position
                x = col * texture_size
                y = row * texture_size
                
                # Create Chinese character texture
                char_texture = create_chinese_texture(texture_size, preserve_alpha=preserve_alpha)
                
                # Paste into the new image
                # Always paste directly (no alpha mask) to ensure opaque backgrounds
                new_img.paste(char_texture, (x, y))
        
        # Save the modified image
        output_path = file_path
        new_img.save(output_path, 'PNG')
        print(f"  [OK] Saved {cols * rows} Chinese character textures")
        
        return True
    except Exception as e:
        print(f"  [ERROR] Error processing {file_path.name}: {e}")
        import traceback
        traceback.print_exc()
        return False

def process_directory(directory_path, texture_size=18, recursive=True):
    """Process all PNG files in a directory"""
    directory = Path(directory_path)
    
    if not directory.exists():
        print(f"Error: Directory does not exist: {directory}")
        return
    
    print("=" * 60)
    print(f"Chinese Character Texture Generator")
    print(f"Directory: {directory}")
    print(f"Texture size: {texture_size}x{texture_size}")
    print("=" * 60)
    
    # Find all PNG files (recursively)
    png_files = list(directory.rglob("*.png"))
    
    # Filter out very small files (likely icons, not texture sheets)
    # and files that are clearly not texture sheets
    filtered_files = []
    skipped_files = []
    for png_file in png_files:
        try:
            img = Image.open(png_file)
            width, height = img.size
            # Skip very small files (icons, UI elements)
            if width < texture_size or height < texture_size:
                skipped_files.append((png_file.name, f"{width}x{height} (too small)"))
                continue
            
            # Process texture sheets (multiples of texture_size) or large files
            if (width % texture_size == 0) and (height % texture_size == 0):
                filtered_files.append(png_file)
            elif width >= 100 or height >= 100:  # Large files might be texture sheets
                filtered_files.append(png_file)
            else:
                skipped_files.append((png_file.name, f"{width}x{height} (not texture sheet)"))
        except Exception as e:
            skipped_files.append((png_file.name, f"Error: {e}"))
            continue
    
    print(f"Found {len(png_files)} PNG file(s) total")
    print(f"Processing {len(filtered_files)} texture sheet(s)")
    if skipped_files:
        print(f"Skipping {len(skipped_files)} file(s) (icons, UI elements, etc.)")
    print()
    
    # Process each file
    success_count = 0
    for png_file in filtered_files:
        if process_texture_file(png_file, texture_size):
            success_count += 1
        print()
    
    print("=" * 60)
    print(f"SUCCESS: Processed {success_count}/{len(filtered_files)} files")
    print("=" * 60)
    print()
    print("NOTE: The game applies color tints from colors.txt and creature")
    print("      definitions. Your Chinese characters will be visible, but")
    print("      the game may overlay colors (blue for water, green for grass, etc.)")
    print("      This is normal game behavior and cannot be changed without")
    print("      modifying the game's color system.")

def main():
    """Main function"""
    # Default directory
    default_dir = Path("LNP/graphics/Ironhand")
    
    # Check if default directory exists
    if default_dir.exists():
        process_directory(default_dir, texture_size=18, recursive=True)
    else:
        print(f"Default directory not found: {default_dir}")
        print("Please specify the directory path:")
        user_dir = input("Directory path: ").strip()
        if user_dir:
            process_directory(user_dir, texture_size=18, recursive=True)
        else:
            print("No directory specified. Exiting.")

if __name__ == "__main__":
    main()

