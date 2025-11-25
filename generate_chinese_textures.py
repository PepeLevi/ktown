#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Abstract Character-Like Texture Generator for Dwarf Fortress
Replaces all 18x18 textures with abstract patterns that resemble Chinese-style characters
but are completely made up and don't belong to any real language
"""

import os
import random
from pathlib import Path
from PIL import Image, ImageDraw

def draw_abstract_character(draw, size, color):
    """
    Draw an abstract character-like pattern using strokes that resemble
    Chinese-style characters but are completely fictional
    """
    padding = 2
    inner_size = size - padding * 2
    base_x = padding
    base_y = padding
    
    # Choose a pattern style
    style = random.choice(['dense', 'sparse', 'vertical', 'horizontal', 'boxy', 'curved'])
    
    if style == 'dense':
        # Many intersecting strokes
        for _ in range(random.randint(4, 8)):
            if random.random() < 0.5:
                # Horizontal stroke
                y = random.randint(base_y, base_y + inner_size - 2)
                draw.line([(base_x + 1, y), (base_x + inner_size - 2, y)], fill=color, width=1)
            else:
                # Vertical stroke
                x = random.randint(base_x, base_x + inner_size - 2)
                draw.line([(x, base_y + 1), (x, base_y + inner_size - 2)], fill=color, width=1)
    
    elif style == 'sparse':
        # Fewer, longer strokes
        num_strokes = random.randint(2, 4)
        for _ in range(num_strokes):
            if random.random() < 0.4:
                # Horizontal stroke
                y = random.randint(base_y + 2, base_y + inner_size - 3)
                start_x = random.randint(base_x, base_x + inner_size // 3)
                end_x = random.randint(base_x + inner_size * 2 // 3, base_x + inner_size - 1)
                draw.line([(start_x, y), (end_x, y)], fill=color, width=1)
            elif random.random() < 0.7:
                # Vertical stroke
                x = random.randint(base_x + 2, base_x + inner_size - 3)
                start_y = random.randint(base_y, base_y + inner_size // 3)
                end_y = random.randint(base_y + inner_size * 2 // 3, base_y + inner_size - 1)
                draw.line([(x, start_y), (x, end_y)], fill=color, width=1)
            else:
                # Diagonal stroke
                if random.random() < 0.5:
                    draw.line([(base_x + 2, base_y + 2), (base_x + inner_size - 3, base_y + inner_size - 3)], fill=color, width=1)
                else:
                    draw.line([(base_x + inner_size - 3, base_y + 2), (base_x + 2, base_y + inner_size - 3)], fill=color, width=1)
    
    elif style == 'vertical':
        # Vertical lines with horizontal connectors
        num_vert = random.randint(2, 4)
        x_positions = sorted([random.randint(base_x + 1, base_x + inner_size - 2) for _ in range(num_vert)])
        for x in x_positions:
            draw.line([(x, base_y + 1), (x, base_y + inner_size - 2)], fill=color, width=1)
        
        # Add horizontal connectors
        num_connectors = random.randint(1, 3)
        for _ in range(num_connectors):
            y = random.randint(base_y + 2, base_y + inner_size - 3)
            if len(x_positions) > 1:
                draw.line([(x_positions[0], y), (x_positions[-1], y)], fill=color, width=1)
    
    elif style == 'horizontal':
        # Horizontal lines with vertical connectors
        num_horiz = random.randint(2, 4)
        y_positions = sorted([random.randint(base_y + 1, base_y + inner_size - 2) for _ in range(num_horiz)])
        for y in y_positions:
            draw.line([(base_x + 1, y), (base_x + inner_size - 2, y)], fill=color, width=1)
        
        # Add vertical connectors
        num_connectors = random.randint(1, 3)
        for _ in range(num_connectors):
            x = random.randint(base_x + 2, base_x + inner_size - 3)
            if len(y_positions) > 1:
                draw.line([(x, y_positions[0]), (x, y_positions[-1])], fill=color, width=1)
    
    elif style == 'boxy':
        # Box-like structures (radicals)
        num_boxes = random.randint(1, 3)
        for _ in range(num_boxes):
            box_x = random.randint(base_x, base_x + inner_size // 2)
            box_y = random.randint(base_y, base_y + inner_size // 2)
            box_w = random.randint(3, inner_size // 2)
            box_h = random.randint(3, inner_size // 2)
            
            # Draw box outline (not filled, just lines)
            if random.random() < 0.7:
                draw.rectangle([box_x, box_y, box_x + box_w, box_y + box_h], outline=color, width=1)
            else:
                # Just top and left
                draw.line([(box_x, box_y), (box_x + box_w, box_y)], fill=color, width=1)
                draw.line([(box_x, box_y), (box_x, box_y + box_h)], fill=color, width=1)
        
        # Add some strokes inside/around boxes
        for _ in range(random.randint(1, 3)):
            if random.random() < 0.5:
                y = random.randint(base_y + 1, base_y + inner_size - 2)
                draw.line([(base_x + 1, y), (base_x + inner_size - 2, y)], fill=color, width=1)
            else:
                x = random.randint(base_x + 1, base_x + inner_size - 2)
                draw.line([(x, base_y + 1), (x, base_y + inner_size - 2)], fill=color, width=1)
    
    elif style == 'curved':
        # More flowing, curved strokes
        num_strokes = random.randint(3, 6)
        for _ in range(num_strokes):
            # Create a curved path
            points = []
            start_x = random.randint(base_x, base_x + inner_size - 1)
            start_y = random.randint(base_y, base_y + inner_size - 1)
            
            for i in range(random.randint(2, 4)):
                x = random.randint(base_x, base_x + inner_size - 1)
                y = random.randint(base_y, base_y + inner_size - 1)
                points.append((x, y))
            
            # Draw connected line segments
            if len(points) > 1:
                for i in range(len(points) - 1):
                    draw.line([points[i], points[i + 1]], fill=color, width=1)

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

def create_abstract_texture(size=18, bg_color=None, text_color=None, preserve_alpha=False):
    """Create a single 18x18 texture with an abstract character-like pattern"""
    if bg_color is None or text_color is None:
        bg_color, text_color = generate_colors()
    
    # Create image with background color (RGBA if preserving alpha)
    if preserve_alpha:
        img = Image.new('RGBA', (size, size), bg_color + (255,))
    else:
        img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Draw abstract character pattern
    draw_color = text_color + (255,) if preserve_alpha else text_color
    draw_abstract_character(draw, size, draw_color)
    
    return img

def process_texture_file(file_path, texture_size=18):
    """Process a PNG file and replace all textures with abstract character-like patterns"""
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
                
                # Create abstract character-like texture
                char_texture = create_abstract_texture(texture_size, preserve_alpha=preserve_alpha)
                
                # Paste into the new image
                # Always paste directly (no alpha mask) to ensure opaque backgrounds
                new_img.paste(char_texture, (x, y))
        
        # Save the modified image
        output_path = file_path
        new_img.save(output_path, 'PNG')
        print(f"  [OK] Saved {cols * rows} abstract character textures")
        
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
    print(f"Abstract Character-Like Texture Generator")
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
    print("      definitions. Your abstract characters will be visible, but")
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

