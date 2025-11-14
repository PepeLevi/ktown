#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dwarf Fortress Name Editor - Expanded Version
Edita TODOS los nombres para romper completamente el lenguaje del juego
"""

import os
import re
import random
import string
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from pathlib import Path
from typing import List, Dict, Tuple, Optional

class NameEntry:
    """Representa una entrada de nombre en un archivo"""
    def __init__(self, file_path: str, line_num: int, tag_type: str, 
                 original_line: str, parts: List[str], context: str = "", 
                 state_type: str = ""):
        self.file_path = file_path
        self.line_num = line_num
        self.tag_type = tag_type  # NAME, CASTE_NAME, SQUAD, T_WORD, STATE_NAME_ADJ, etc.
        self.original_line = original_line
        self.parts = parts  # Lista de partes del nombre
        self.context = context
        self.state_type = state_type  # Para STATE_NAME_ADJ (ALL_SOLID, LIQUID, etc.)
        self.modified = False
        self.entry_id = id(self)  # ID único para identificar en el árbol

class TextEntry:
    """Representa una entrada de texto/frase en un archivo"""
    def __init__(self, file_path: str, line_num: int, text_set: str, 
                 original_text: str, context: str = ""):
        self.file_path = file_path
        self.line_num = line_num
        self.text_set = text_set  # TEXT_SET name (GENERAL, POSITIVE, CURSE, etc.)
        self.original_text = original_text
        self.text = original_text  # Texto actual (puede ser modificado)
        self.context = context
        self.modified = False
        self.entry_id = id(self)  # ID único

class DFNameEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Dwarf Fortress Name Editor - Language Breaker")
        self.root.geometry("1400x900")
        
        self.base_path = Path("df_53_03_win/data/vanilla")
        self.name_entries: List[NameEntry] = []
        self.text_entries: List[TextEntry] = []  # Entradas de texto/frases
        self.entry_dict: Dict[int, NameEntry] = {}  # Mapeo ID -> Entry para el árbol
        self.text_entry_dict: Dict[int, TextEntry] = {}  # Mapeo ID -> TextEntry
        
        self.create_ui()
        
    def create_ui(self):
        # Frame superior
        control_frame = ttk.Frame(self.root, padding="10")
        control_frame.pack(fill=tk.X)
        
        ttk.Button(control_frame, text="📁 Seleccionar Directorio", 
                  command=self.select_base_path).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="🔄 Cargar Archivos", 
                  command=self.load_files).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="🎲 RANDOMIZAR TODO", 
                  command=self.randomize_all,
                  style="Accent.TButton").pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="💾 Guardar Cambios", 
                  command=self.save_changes).pack(side=tk.LEFT, padx=5)
        
        self.status_label = ttk.Label(control_frame, text="Listo - Selecciona directorio y carga archivos")
        self.status_label.pack(side=tk.LEFT, padx=20)
        
        # Frame principal con Notebook (pestañas)
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Pestaña 1: Nombres
        names_frame = ttk.Frame(notebook)
        notebook.add(names_frame, text="📝 Nombres")
        
        # Pestaña 2: Frases/Texto
        text_frame = ttk.Frame(notebook)
        notebook.add(text_frame, text="📜 Frases y Texto")
        
        # ========== PESTAÑA DE NOMBRES ==========
        main_frame = ttk.PanedWindow(names_frame, orient=tk.HORIZONTAL)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Panel izquierdo
        left_panel = ttk.Frame(main_frame)
        main_frame.add(left_panel, weight=1)
        
        ttk.Label(left_panel, text="Filtrar:").pack(anchor=tk.W, padx=5, pady=5)
        self.filter_var = tk.StringVar(value="Todos")
        filter_combo = ttk.Combobox(left_panel, textvariable=self.filter_var, 
                                   values=["Todos", "Criaturas", "Items", "Entidades", 
                                          "Materiales", "Plantas", "Idiomas"],
                                   state="readonly", width=25)
        filter_combo.pack(fill=tk.X, padx=5, pady=5)
        filter_combo.bind("<<ComboboxSelected>>", lambda e: self.update_tree())
        
        ttk.Label(left_panel, text="Entradas:").pack(anchor=tk.W, padx=5, pady=5)
        
        tree_frame = ttk.Frame(left_panel)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        scrollbar_tree = ttk.Scrollbar(tree_frame)
        scrollbar_tree.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.tree = ttk.Treeview(tree_frame, yscrollcommand=scrollbar_tree.set,
                                 columns=("Tipo", "Archivo"), show="tree headings")
        self.tree.heading("#0", text="Nombre")
        self.tree.heading("Tipo", text="Tipo")
        self.tree.heading("Archivo", text="Archivo")
        self.tree.column("#0", width=350)
        self.tree.column("Tipo", width=120)
        self.tree.column("Archivo", width=200)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_tree.config(command=self.tree.yview)
        
        self.tree.bind("<<TreeviewSelect>>", self.on_select)
        
        # Panel derecho (Nombres)
        right_panel = ttk.Frame(main_frame)
        main_frame.add(right_panel, weight=2)
        
        # Info
        info_frame = ttk.LabelFrame(right_panel, text="Información", padding="10")
        info_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.info_text = scrolledtext.ScrolledText(info_frame, height=5, wrap=tk.WORD)
        self.info_text.pack(fill=tk.X)
        
        # Editor
        edit_frame = ttk.LabelFrame(right_panel, text="Editar Nombre", padding="10")
        edit_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.edit_widgets_frame = ttk.Frame(edit_frame)
        self.edit_widgets_frame.pack(fill=tk.BOTH, expand=True)
        
        # Botones
        button_frame = ttk.Frame(edit_frame)
        button_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(button_frame, text="✅ Aplicar", 
                  command=self.apply_changes).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="🎲 Randomizar Este", 
                  command=self.randomize_current).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="↩️ Restaurar", 
                  command=self.restore_original).pack(side=tk.LEFT, padx=5)
        
        self.current_entry = None
        self.edit_vars = []
        
        # ========== PESTAÑA DE TEXTO/FRASES ==========
        text_main_frame = ttk.PanedWindow(text_frame, orient=tk.HORIZONTAL)
        text_main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Panel izquierdo (texto)
        text_left_panel = ttk.Frame(text_main_frame)
        text_main_frame.add(text_left_panel, weight=1)
        
        ttk.Label(text_left_panel, text="Filtrar:").pack(anchor=tk.W, padx=5, pady=5)
        self.text_filter_var = tk.StringVar(value="Todos")
        text_filter_combo = ttk.Combobox(text_left_panel, textvariable=self.text_filter_var,
                                        values=["Todos", "General", "Positivo", "Maldición", 
                                               "Libros", "Profesiones", "Diálogos"],
                                        state="readonly", width=25)
        text_filter_combo.pack(fill=tk.X, padx=5, pady=5)
        text_filter_combo.bind("<<ComboboxSelected>>", lambda e: self.update_text_tree())
        
        ttk.Label(text_left_panel, text="Frases:").pack(anchor=tk.W, padx=5, pady=5)
        
        text_tree_frame = ttk.Frame(text_left_panel)
        text_tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        text_scrollbar = ttk.Scrollbar(text_tree_frame)
        text_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.text_tree = ttk.Treeview(text_tree_frame, yscrollcommand=text_scrollbar.set,
                                      columns=("Tipo", "Archivo"), show="tree headings")
        self.text_tree.heading("#0", text="Frase")
        self.text_tree.heading("Tipo", text="Tipo")
        self.text_tree.heading("Archivo", text="Archivo")
        self.text_tree.column("#0", width=400)
        self.text_tree.column("Tipo", width=120)
        self.text_tree.column("Archivo", width=200)
        self.text_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        text_scrollbar.config(command=self.text_tree.yview)
        
        self.text_tree.bind("<<TreeviewSelect>>", self.on_text_select)
        
        # Panel derecho (texto)
        text_right_panel = ttk.Frame(text_main_frame)
        text_main_frame.add(text_right_panel, weight=2)
        
        # Info texto
        text_info_frame = ttk.LabelFrame(text_right_panel, text="Información", padding="10")
        text_info_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.text_info_text = scrolledtext.ScrolledText(text_info_frame, height=4, wrap=tk.WORD)
        self.text_info_text.pack(fill=tk.X)
        
        # Editor texto
        text_edit_frame = ttk.LabelFrame(text_right_panel, text="Editar Frase", padding="10")
        text_edit_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        ttk.Label(text_edit_frame, text="Texto:").pack(anchor=tk.W, padx=5, pady=5)
        self.text_edit_widget = scrolledtext.ScrolledText(text_edit_frame, height=10, wrap=tk.WORD)
        self.text_edit_widget.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Botones texto
        text_button_frame = ttk.Frame(text_edit_frame)
        text_button_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(text_button_frame, text="✅ Aplicar", 
                  command=self.apply_text_changes).pack(side=tk.LEFT, padx=5)
        ttk.Button(text_button_frame, text="🎲 Randomizar Este", 
                  command=self.randomize_current_text).pack(side=tk.LEFT, padx=5)
        ttk.Button(text_button_frame, text="↩️ Restaurar", 
                  command=self.restore_original_text).pack(side=tk.LEFT, padx=5)
        
        self.current_text_entry = None
    
    def select_base_path(self):
        path = filedialog.askdirectory(title="Seleccionar df_53_03_win/data/vanilla")
        if path:
            self.base_path = Path(path)
            self.status_label.config(text=f"Directorio: {self.base_path}")
    
    def load_files(self):
        if not self.base_path.exists():
            messagebox.showerror("Error", "Selecciona el directorio base primero")
            return
        
        self.name_entries = []
        self.entry_dict = {}
        self.status_label.config(text="Cargando archivos...")
        self.root.update()
        
        # TODOS los archivos de criaturas
        creature_files = [
            "vanilla_creatures/objects/creature_standard.txt",
            "vanilla_creatures/objects/creature_large_tropical.txt",
            "vanilla_creatures/objects/creature_large_temperate.txt",
            "vanilla_creatures/objects/creature_large_mountain.txt",
            "vanilla_creatures/objects/creature_large_ocean.txt",
            "vanilla_creatures/objects/creature_large_riverlake.txt",
            "vanilla_creatures/objects/creature_large_tundra.txt",
            "vanilla_creatures/objects/creature_domestic.txt",
            "vanilla_creatures/objects/creature_fanciful.txt",
            "vanilla_creatures/objects/creature_birds.txt",
            "vanilla_creatures/objects/creature_birds_new.txt",
            "vanilla_creatures/objects/creature_reptiles.txt",
            "vanilla_creatures/objects/creature_amphibians.txt",
            "vanilla_creatures/objects/creature_insects.txt",
            "vanilla_creatures/objects/creature_small_mammals.txt",
            "vanilla_creatures/objects/creature_small_mammal_new.txt",
            "vanilla_creatures/objects/creature_subterranean.txt",
            "vanilla_creatures/objects/creature_tropical_new.txt",
            "vanilla_creatures/objects/creature_temperate_new.txt",
            "vanilla_creatures/objects/creature_desert_new.txt",
            "vanilla_creatures/objects/creature_mountain_new.txt",
            "vanilla_creatures/objects/creature_ocean_new.txt",
            "vanilla_creatures/objects/creature_riverlakepool_new.txt",
            "vanilla_creatures/objects/creature_tundra_taiga_new.txt",
            "vanilla_creatures/objects/creature_next_underground.txt",
            "vanilla_creatures/objects/creature_other.txt",
            "vanilla_creatures/objects/creature_bug_slug_new.txt",
            "vanilla_creatures/objects/creature_annelids.txt",
            "vanilla_creatures/objects/creature_small_ocean.txt",
            "vanilla_creatures/objects/creature_small_riverlake.txt",
            "vanilla_creatures/objects/creature_equipment.txt",
        ]
        
        # Items
        item_files = [
            "vanilla_items/objects/item_tool.txt",
            "vanilla_items/objects/item_weapon.txt",
            "vanilla_items/objects/item_armor.txt",
            "vanilla_items/objects/item_food.txt",
            "vanilla_items/objects/item_ammo.txt",
            "vanilla_items/objects/item_shield.txt",
            "vanilla_items/objects/item_helm.txt",
            "vanilla_items/objects/item_gloves.txt",
            "vanilla_items/objects/item_pants.txt",
            "vanilla_items/objects/item_shoes.txt",
            "vanilla_items/objects/item_toy.txt",
            "vanilla_items/objects/item_trapcomp.txt",
            "vanilla_items/objects/item_siegeammo.txt",
        ]
        
        # Materiales
        material_files = [
            "vanilla_materials/objects/inorganic_stone_layer.txt",
            "vanilla_materials/objects/inorganic_stone_mineral.txt",
            "vanilla_materials/objects/inorganic_stone_soil.txt",
            "vanilla_materials/objects/inorganic_stone_gem.txt",
            "vanilla_materials/objects/inorganic_metal.txt",
            "vanilla_materials/objects/inorganic_other.txt",
        ]
        
        # Plantas
        plant_files = [
            "vanilla_plants/objects/plant_standard.txt",
            "vanilla_plants/objects/plant_grasses.txt",
            "vanilla_plants/objects/plant_new_trees.txt",
            "vanilla_plants/objects/plant_crops.txt",
            "vanilla_plants/objects/plant_garden.txt",
        ]
        
        # Cargar archivos
        for file_path in creature_files:
            self.parse_file(self.base_path / file_path, "creature")
        
        for file_path in item_files:
            self.parse_file(self.base_path / file_path, "item")
        
        for file_path in material_files:
            self.parse_file(self.base_path / file_path, "material")
        
        for file_path in plant_files:
            self.parse_file(self.base_path / file_path, "plant")
        
        # Entidades
        entity_file = self.base_path / "vanilla_entities/objects/entity_default.txt"
        if entity_file.exists():
            self.parse_entity_file(entity_file)
        
        # Idiomas
        language_files = [
            "vanilla_languages/objects/language_words.txt",
            "vanilla_languages/objects/language_DWARF.txt",
            "vanilla_languages/objects/language_ELF.txt",
            "vanilla_languages/objects/language_HUMAN.txt",
            "vanilla_languages/objects/language_GOBLIN.txt",
        ]
        
        for file_path in language_files:
            self.parse_file(self.base_path / file_path, "language")
        
        # Archivos de texto/frases
        text_files = [
            "vanilla_text/objects/text_general.txt",
            "vanilla_text/objects/text_positive.txt",
            "vanilla_text/objects/text_curse.txt",
            "vanilla_text/objects/text_secret_death.txt",
            "vanilla_text/objects/text_hist_fig_slayer.txt",
            "vanilla_text/objects/text_slayer.txt",
            "vanilla_text/objects/text_animal_slayer.txt",
            "vanilla_text/objects/text_book_art.txt",
            "vanilla_text/objects/text_book_instruction.txt",
            "vanilla_text/objects/text_greet.txt",
            "vanilla_text/objects/text_greet_reply.txt",
            "vanilla_text/objects/text_greet_reply_diff_language.txt",
            "vanilla_text/objects/text_family_relationship_spec.txt",
            "vanilla_text/objects/text_family_relationship_no_spec.txt",
            "vanilla_text/objects/text_hunting_profession.txt",
            "vanilla_text/objects/text_mercenary_profession.txt",
            "vanilla_text/objects/text_thief_profession.txt",
            "vanilla_text/objects/text_justification_antithetical.txt",
            "vanilla_text/objects/text_justification_experience.txt",
            "vanilla_text/objects/text_justification_proximity.txt",
        ]
        
        for file_path in text_files:
            self.parse_text_file(self.base_path / file_path)
        
        self.update_tree()
        self.update_text_tree()
        self.status_label.config(text=f"✅ Cargadas {len(self.name_entries)} nombres y {len(self.text_entries)} frases")
    
    def parse_file(self, file_path: Path, file_type: str):
        """Parsea un archivo según su tipo"""
        if not file_path.exists():
            return
        
        try:
            if file_type == "creature":
                self.parse_creature_file(file_path)
            elif file_type == "item":
                self.parse_item_file(file_path)
            elif file_type == "material":
                self.parse_material_file(file_path)
            elif file_type == "plant":
                self.parse_plant_file(file_path)
            elif file_type == "language":
                self.parse_language_file(file_path)
        except Exception as e:
            print(f"Error en {file_path}: {e}")
    
    def parse_creature_file(self, file_path: Path):
        """Parsea archivos de criaturas"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        current_creature = ""
        for i, line in enumerate(lines, 1):
            creature_match = re.match(r'\[CREATURE:(\w+)\]', line)
            if creature_match:
                current_creature = creature_match.group(1)
            
            # [NAME:...] y [CASTE_NAME:...]
            name_match = re.match(r'\s*\[(NAME|CASTE_NAME):([^\]]+)\]', line)
            if name_match:
                tag_type = name_match.group(1)
                parts_str = name_match.group(2)
                parts = [p.strip() for p in parts_str.split(':')]
                if len(parts) >= 2:
                    context = f"{current_creature} ({tag_type})" if current_creature else tag_type
                    entry = NameEntry(str(file_path), i, tag_type, line.strip(), parts, context)
                    entry.entry_id = len(self.name_entries)
                    self.name_entries.append(entry)
                    self.entry_dict[entry.entry_id] = entry
            
            # [GENERAL_CHILD_NAME:...]
            child_match = re.match(r'\s*\[GENERAL_CHILD_NAME:([^\]]+)\]', line)
            if child_match:
                parts_str = child_match.group(1)
                parts = [p.strip() for p in parts_str.split(':')]
                if len(parts) >= 2:
                    context = f"{current_creature} (child name)" if current_creature else "child name"
                    entry = NameEntry(str(file_path), i, "GENERAL_CHILD_NAME", line.strip(), parts, context)
                    entry.entry_id = len(self.name_entries)
                    self.name_entries.append(entry)
                    self.entry_dict[entry.entry_id] = entry
    
    def parse_item_file(self, file_path: Path):
        """Parsea archivos de items"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        current_item = ""
        for i, line in enumerate(lines, 1):
            item_match = re.match(r'\[ITEM_\w+:(ITEM_\w+)\]', line)
            if item_match:
                current_item = item_match.group(1)
            
            name_match = re.match(r'\[NAME:([^\]]+)\]', line)
            if name_match:
                parts_str = name_match.group(1)
                parts = [p.strip() for p in parts_str.split(':')]
                if len(parts) >= 2:
                    context = current_item if current_item else "Item"
                    entry = NameEntry(str(file_path), i, "NAME", line.strip(), parts, context)
                    entry.entry_id = len(self.name_entries)
                    self.name_entries.append(entry)
                    self.entry_dict[entry.entry_id] = entry
    
    def parse_material_file(self, file_path: Path):
        """Parsea archivos de materiales: [STATE_NAME_ADJ:STATE:nombre]"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        current_material = ""
        for i, line in enumerate(lines, 1):
            material_match = re.match(r'\[INORGANIC:(\w+)\]', line)
            if material_match:
                current_material = material_match.group(1)
            
            # [STATE_NAME_ADJ:ALL_SOLID:nombre] o [STATE_NAME_ADJ:LIQUID:nombre]
            state_match = re.match(r'\s*\[STATE_NAME_ADJ:(\w+):([^\]]+)\]', line)
            if state_match:
                state_type = state_match.group(1)
                name = state_match.group(2).strip()
                context = f"{current_material} ({state_type})" if current_material else state_type
                entry = NameEntry(str(file_path), i, "STATE_NAME_ADJ", line.strip(), 
                                [name], context, state_type)
                entry.entry_id = len(self.name_entries)
                self.name_entries.append(entry)
                self.entry_dict[entry.entry_id] = entry
            
            # [STATE_NAME:ALL_SOLID:nombre]
            state_name_match = re.match(r'\s*\[STATE_NAME:(\w+):([^\]]+)\]', line)
            if state_name_match:
                state_type = state_name_match.group(1)
                name = state_name_match.group(2).strip()
                context = f"{current_material} ({state_type})" if current_material else state_type
                entry = NameEntry(str(file_path), i, "STATE_NAME", line.strip(), 
                                [name], context, state_type)
                entry.entry_id = len(self.name_entries)
                self.name_entries.append(entry)
                self.entry_dict[entry.entry_id] = entry
    
    def parse_plant_file(self, file_path: Path):
        """Parsea archivos de plantas: [NAME:...][NAME_PLURAL:...][ADJ:...] (pueden estar en la misma línea)"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        current_plant = ""
        
        for i, line in enumerate(lines, 1):
            plant_match = re.match(r'\[PLANT:(\w+)\]', line)
            if plant_match:
                current_plant = plant_match.group(1)
            
            # Buscar NAME, NAME_PLURAL, ADJ (pueden estar en la misma línea)
            if current_plant:
                name_match = re.search(r'\[NAME:([^\]]+)\]', line)
                plural_match = re.search(r'\[NAME_PLURAL:([^\]]+)\]', line)
                adj_match = re.search(r'\[ADJ:([^\]]+)\]', line)
                
                if name_match or plural_match:
                    parts = []
                    if name_match:
                        parts.append(name_match.group(1).strip())
                    if plural_match:
                        parts.append(plural_match.group(1).strip())
                    if adj_match:
                        parts.append(adj_match.group(1).strip())
                    
                    if len(parts) >= 2:
                        entry = NameEntry(str(file_path), i, "PLANT_NAME", 
                                        line.strip(), parts, current_plant)
                        entry.entry_id = len(self.name_entries)
                        self.name_entries.append(entry)
                        self.entry_dict[entry.entry_id] = entry
    
    def parse_entity_file(self, file_path: Path):
        """Parsea archivos de entidades"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        current_position = ""
        for i, line in enumerate(lines, 1):
            pos_match = re.match(r'\[POSITION:(\w+)\]', line)
            if pos_match:
                current_position = pos_match.group(1)
            
            name_match = re.match(r'\s*\[NAME:([^\]]+)\]', line)
            if name_match:
                parts_str = name_match.group(1)
                parts = [p.strip() for p in parts_str.split(':')]
                if len(parts) >= 2:
                    context = f"Position: {current_position}" if current_position else "Entity"
                    entry = NameEntry(str(file_path), i, "NAME", line.strip(), parts, context)
                    entry.entry_id = len(self.name_entries)
                    self.name_entries.append(entry)
                    self.entry_dict[entry.entry_id] = entry
            
            squad_match = re.match(r'\s*\[SQUAD:(\d+):([^\]]+)\]', line)
            if squad_match:
                number = squad_match.group(1)
                parts_str = squad_match.group(2)
                parts = [p.strip() for p in parts_str.split(':')]
                if len(parts) >= 2:
                    context = f"Squad ({number} members)"
                    entry = NameEntry(str(file_path), i, "SQUAD", line.strip(), 
                                    [number] + parts, context)
                    entry.entry_id = len(self.name_entries)
                    self.name_entries.append(entry)
                    self.entry_dict[entry.entry_id] = entry
    
    def parse_language_file(self, file_path: Path):
        """Parsea archivos de idiomas: [NOUN:...] y [ADJ:...] y [T_WORD:...]"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        current_word = ""
        for i, line in enumerate(lines, 1):
            word_match = re.match(r'\[WORD:(\w+)\]', line)
            if word_match:
                current_word = word_match.group(1)
            
            # [NOUN:singular:plural]
            noun_match = re.match(r'\s*\[NOUN:([^\]]+)\]', line)
            if noun_match:
                parts_str = noun_match.group(1)
                parts = [p.strip() for p in parts_str.split(':')]
                if len(parts) >= 2:
                    context = f"Word: {current_word}" if current_word else "Language"
                    entry = NameEntry(str(file_path), i, "NOUN", line.strip(), parts, context)
                    entry.entry_id = len(self.name_entries)
                    self.name_entries.append(entry)
                    self.entry_dict[entry.entry_id] = entry
            
            # [ADJ:adjective]
            adj_match = re.match(r'\s*\[ADJ:([^\]]+)\]', line)
            if adj_match:
                adj = adj_match.group(1).strip()
                context = f"Word: {current_word}" if current_word else "Language"
                entry = NameEntry(str(file_path), i, "ADJ", line.strip(), [adj], context)
                entry.entry_id = len(self.name_entries)
                self.name_entries.append(entry)
                self.entry_dict[entry.entry_id] = entry
            
            # [T_WORD:ENGLISH:translation] (en archivos de traducción)
            tword_match = re.match(r'\s*\[T_WORD:[^:]+:([^\]]+)\]', line)
            if tword_match:
                translation = tword_match.group(1).strip()
                context = f"Translation"
                entry = NameEntry(str(file_path), i, "T_WORD", line.strip(), [translation], context)
                entry.entry_id = len(self.name_entries)
                self.name_entries.append(entry)
                self.entry_dict[entry.entry_id] = entry
    
    def update_tree(self):
        """Actualiza el árbol"""
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        filter_type = self.filter_var.get()
        
        # Agrupar por archivo
        files_dict = {}
        for entry in self.name_entries:
            # Filtrar
            if filter_type != "Todos":
                file_name = Path(entry.file_path).name
                if filter_type == "Criaturas" and "creature" not in file_name.lower():
                    continue
                elif filter_type == "Items" and "item" not in file_name.lower():
                    continue
                elif filter_type == "Entidades" and "entity" not in file_name.lower():
                    continue
                elif filter_type == "Materiales" and "inorganic" not in file_name.lower():
                    continue
                elif filter_type == "Plantas" and "plant" not in file_name.lower():
                    continue
                elif filter_type == "Idiomas" and "language" not in file_name.lower():
                    continue
            
            file_name = Path(entry.file_path).name
            if file_name not in files_dict:
                files_dict[file_name] = []
            files_dict[file_name].append(entry)
        
        # Agregar al árbol
        for file_name, entries in sorted(files_dict.items()):
            file_node = self.tree.insert("", tk.END, text=file_name, 
                                        values=("Archivo", file_name))
            for entry in entries:
                # Texto descriptivo
                if entry.tag_type == "SQUAD" and len(entry.parts) >= 3:
                    display_text = f"{entry.parts[1]} / {entry.parts[2]} ({entry.context})"
                elif len(entry.parts) >= 2:
                    display_text = f"{entry.parts[0]} / {entry.parts[1]}"
                    if len(entry.parts) >= 3:
                        display_text += f" / {entry.parts[2]}"
                    if entry.context:
                        display_text += f" ({entry.context})"
                else:
                    display_text = entry.parts[0] if entry.parts else "Sin nombre"
                
                item_id = self.tree.insert(file_node, tk.END, text=display_text,
                                         values=(entry.tag_type, file_name),
                                         tags=(str(entry.entry_id),))
    
    def on_select(self, event):
        """Cuando se selecciona una entrada"""
        selection = self.tree.selection()
        if not selection:
            return
        
        item = selection[0]
        # Obtener el entry_id desde los tags
        tags = self.tree.item(item, "tags")
        if tags:
            try:
                entry_id = int(tags[0])
                entry = self.entry_dict.get(entry_id)
                if entry:
                    self.show_entry(entry)
            except (ValueError, IndexError):
                pass
    
    def show_entry(self, entry: NameEntry):
        """Muestra y permite editar una entrada"""
        # Limpiar widgets anteriores
        for widget in self.edit_widgets_frame.winfo_children():
            widget.destroy()
        
        self.current_entry = entry
        self.edit_vars = []
        
        # Info
        info = f"Archivo: {Path(entry.file_path).name}\n"
        info += f"Línea: {entry.line_num}\n"
        info += f"Tipo: {entry.tag_type}\n"
        if entry.state_type:
            info += f"Estado: {entry.state_type}\n"
        info += f"Contexto: {entry.context}\n"
        info += f"Original: {entry.original_line}"
        
        self.info_text.delete(1.0, tk.END)
        self.info_text.insert(1.0, info)
        
        # Crear campos según tipo
        if entry.tag_type == "SQUAD" and len(entry.parts) >= 3:
            ttk.Label(self.edit_widgets_frame, text="Número:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
            num_var = tk.StringVar(value=entry.parts[0])
            ttk.Entry(self.edit_widgets_frame, textvariable=num_var, state="readonly").grid(row=0, column=1, sticky=tk.EW, padx=5, pady=5)
            
            ttk.Label(self.edit_widgets_frame, text="Singular:").grid(row=1, column=0, sticky=tk.W, padx=5, pady=5)
            var1 = tk.StringVar(value=entry.parts[1])
            ttk.Entry(self.edit_widgets_frame, textvariable=var1, width=50).grid(row=1, column=1, sticky=tk.EW, padx=5, pady=5)
            self.edit_vars.append(var1)
            
            ttk.Label(self.edit_widgets_frame, text="Plural:").grid(row=2, column=0, sticky=tk.W, padx=5, pady=5)
            var2 = tk.StringVar(value=entry.parts[2])
            ttk.Entry(self.edit_widgets_frame, textvariable=var2, width=50).grid(row=2, column=1, sticky=tk.EW, padx=5, pady=5)
            self.edit_vars.append(var2)
            
        elif entry.tag_type in ["STATE_NAME_ADJ", "STATE_NAME"]:
            ttk.Label(self.edit_widgets_frame, text="Nombre:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
            var = tk.StringVar(value=entry.parts[0] if entry.parts else "")
            ttk.Entry(self.edit_widgets_frame, textvariable=var, width=50).grid(row=0, column=1, sticky=tk.EW, padx=5, pady=5)
            self.edit_vars.append(var)
            
        elif len(entry.parts) >= 3:
            labels = ["Singular:", "Plural:", "Adjetivo:"]
            for i, (label, value) in enumerate(zip(labels, entry.parts)):
                ttk.Label(self.edit_widgets_frame, text=label).grid(row=i, column=0, sticky=tk.W, padx=5, pady=5)
                var = tk.StringVar(value=value)
                ttk.Entry(self.edit_widgets_frame, textvariable=var, width=50).grid(row=i, column=1, sticky=tk.EW, padx=5, pady=5)
                self.edit_vars.append(var)
        elif len(entry.parts) >= 2:
            labels = ["Singular:", "Plural:"]
            for i, (label, value) in enumerate(zip(labels, entry.parts)):
                ttk.Label(self.edit_widgets_frame, text=label).grid(row=i, column=0, sticky=tk.W, padx=5, pady=5)
                var = tk.StringVar(value=value)
                ttk.Entry(self.edit_widgets_frame, textvariable=var, width=50).grid(row=i, column=1, sticky=tk.EW, padx=5, pady=5)
                self.edit_vars.append(var)
        else:
            ttk.Label(self.edit_widgets_frame, text="Nombre:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
            var = tk.StringVar(value=entry.parts[0] if entry.parts else "")
            ttk.Entry(self.edit_widgets_frame, textvariable=var, width=50).grid(row=0, column=1, sticky=tk.EW, padx=5, pady=5)
            self.edit_vars.append(var)
        
        self.edit_widgets_frame.columnconfigure(1, weight=1)
    
    def apply_changes(self):
        """Aplica cambios a la entrada actual"""
        if not self.current_entry:
            return
        
        entry = self.current_entry
        new_parts = [var.get().strip() for var in self.edit_vars]
        
        if entry.tag_type == "SQUAD" and len(entry.parts) >= 3:
            new_parts = [entry.parts[0]] + new_parts
        
        entry.parts = new_parts
        entry.modified = True
        
        self.update_tree()
        messagebox.showinfo("Éxito", "Cambios aplicados (guarda el archivo)")
    
    def randomize_current(self):
        """Randomiza la entrada actual"""
        if not self.current_entry:
            return
        
        for var in self.edit_vars:
            random_name = self.generate_random_name()
            var.set(random_name)
        
        self.apply_changes()
    
    def randomize_all(self):
        """Randomiza TODOS los nombres Y textos"""
        if not self.name_entries and not self.text_entries:
            messagebox.showwarning("Advertencia", "Carga archivos primero")
            return
        
        total = len(self.name_entries) + len(self.text_entries)
        result = messagebox.askyesno("Confirmar", 
                                    f"¿Randomizar TODAS las {total} entradas?\n"
                                    f"({len(self.name_entries)} nombres + {len(self.text_entries)} frases)\n"
                                    "Esto romperá completamente el lenguaje del juego.")
        if not result:
            return
        
        # Randomizar nombres
        for entry in self.name_entries:
            if entry.tag_type == "SQUAD" and len(entry.parts) >= 3:
                entry.parts = [entry.parts[0], 
                              self.generate_random_name(),
                              self.generate_random_name()]
            else:
                entry.parts = [self.generate_random_name() for _ in entry.parts]
            entry.modified = True
        
        # Randomizar textos
        for entry in self.text_entries:
            # Randomizar palabras manteniendo estructura básica
            words = entry.text.split()
            random_words = []
            for word in words:
                # Preservar placeholders como [CONTEXT:...] o [NAME]
                if word.startswith('[') and word.endswith(']'):
                    random_words.append(word)
                else:
                    # Randomizar palabra pero mantener longitud similar
                    random_words.append(self.generate_random_name(length=len(word)))
            entry.text = ' '.join(random_words)
            entry.modified = True
        
        self.update_tree()
        self.update_text_tree()
        messagebox.showinfo("Éxito", f"🎲 Randomizadas {total} entradas!\n"
                                   f"({len(self.name_entries)} nombres + {len(self.text_entries)} frases)\n"
                                   "El lenguaje del juego está completamente roto.")
    
    def generate_random_name(self, length=None):
        """Genera nombre aleatorio ASCII"""
        if length is None:
            length = random.randint(5, 12)
        chars = string.ascii_letters + string.digits + "çñáéíóúàèìòùâêîôûäëïöü"
        return ''.join(random.choice(chars) for _ in range(length))
    
    def restore_original(self):
        """Restaura el original"""
        if not self.current_entry:
            return
        
        entry = self.current_entry
        # Re-parsear desde original
        if entry.tag_type == "SQUAD":
            match = re.match(r'\s*\[SQUAD:(\d+):([^\]]+)\]', entry.original_line)
            if match:
                parts_str = match.group(2)
                parts = [p.strip() for p in parts_str.split(':')]
                entry.parts = [match.group(1)] + parts
        elif entry.tag_type in ["STATE_NAME_ADJ", "STATE_NAME"]:
            match = re.match(r'\s*\[(?:STATE_NAME_ADJ|STATE_NAME):\w+:([^\]]+)\]', entry.original_line)
            if match:
                entry.parts = [match.group(1).strip()]
        elif entry.tag_type == "PLANT_NAME":
            # Restaurar desde original (complejo, mejor recargar)
            pass
        else:
            match = re.match(r'\[(?:NAME|CASTE_NAME|GENERAL_CHILD_NAME|NOUN|ADJ|T_WORD):([^\]]+)\]', entry.original_line)
            if match:
                parts_str = match.group(1)
                entry.parts = [p.strip() for p in parts_str.split(':')]
        
        entry.modified = False
        self.show_entry(entry)
    
    def save_changes(self):
        """Guarda todos los cambios (nombres y textos)"""
        modified_names = [e for e in self.name_entries if e.modified]
        modified_texts = [e for e in self.text_entries if e.modified]
        
        if not modified_names and not modified_texts:
            messagebox.showinfo("Info", "No hay cambios para guardar")
            return
        
        # Guardar nombres
        name_files_dict = {}
        for entry in modified_names:
            if entry.file_path not in name_files_dict:
                name_files_dict[entry.file_path] = []
            name_files_dict[entry.file_path].append(entry)
        
        # Guardar textos
        text_files_dict = {}
        for entry in modified_texts:
            if entry.file_path not in text_files_dict:
                text_files_dict[entry.file_path] = []
            text_files_dict[entry.file_path].append(entry)
        
        saved_count = 0
        total_files = 0
        
        # Guardar archivos de nombres
        for file_path, entries in name_files_dict.items():
            try:
                self.save_file(file_path, entries)
                saved_count += len(entries)
                total_files += 1
            except Exception as e:
                messagebox.showerror("Error", f"Error guardando {file_path}:\n{e}")
                return
        
        # Guardar archivos de texto
        for file_path, entries in text_files_dict.items():
            try:
                self.save_text_file(file_path, entries)
                saved_count += len(entries)
                total_files += 1
            except Exception as e:
                messagebox.showerror("Error", f"Error guardando {file_path}:\n{e}")
                return
        
        for entry in modified_names + modified_texts:
            entry.modified = False
        
        messagebox.showinfo("Éxito", f"💾 Guardados {saved_count} cambios en {total_files} archivo(s)")
        self.status_label.config(text=f"Guardados {saved_count} cambios")
    
    def save_file(self, file_path: str, entries: List[NameEntry]):
        """Guarda cambios en un archivo"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        changes = {entry.line_num - 1: entry for entry in entries}
        
        for line_num, entry in changes.items():
            if line_num < len(lines):
                original_line = lines[line_num]
                indent_match = re.match(r'^(\s*)', original_line)
                indent = indent_match.group(1) if indent_match else ""
                
                if entry.tag_type == "SQUAD" and len(entry.parts) >= 3:
                    new_line = f"{indent}[SQUAD:{entry.parts[0]}:{':'.join(entry.parts[1:])}]\n"
                elif entry.tag_type in ["STATE_NAME_ADJ"]:
                    state_type = entry.state_type if entry.state_type else "ALL_SOLID"
                    new_line = f"{indent}[STATE_NAME_ADJ:{state_type}:{entry.parts[0]}]\n"
                elif entry.tag_type in ["STATE_NAME"]:
                    state_type = entry.state_type if entry.state_type else "ALL_SOLID"
                    new_line = f"{indent}[STATE_NAME:{state_type}:{entry.parts[0]}]\n"
                elif entry.tag_type == "PLANT_NAME":
                    # Plantas tienen formato especial: [NAME:...][NAME_PLURAL:...][ADJ:...]
                    name_part = f"[NAME:{entry.parts[0]}]" if len(entry.parts) > 0 else ""
                    plural_part = f"[NAME_PLURAL:{entry.parts[1]}]" if len(entry.parts) > 1 else ""
                    adj_part = f"[ADJ:{entry.parts[2]}]" if len(entry.parts) > 2 else ""
                    new_line = f"{indent}{name_part}{plural_part}{adj_part}\n"
                elif entry.tag_type in ["NAME", "CASTE_NAME", "GENERAL_CHILD_NAME", "NOUN", "ADJ", "T_WORD"]:
                    new_line = f"{indent}[{entry.tag_type}:{':'.join(entry.parts)}]\n"
                else:
                    new_line = original_line
                
                lines[line_num] = new_line
        
        with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
            f.writelines(lines)
    
    # ========== FUNCIONES PARA TEXTO/FRASES ==========
    
    def parse_text_file(self, file_path: Path):
        """Parsea archivos de texto: cada línea después de [TEXT_SET:...] es una frase"""
        if not file_path.exists():
            return
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            current_text_set = ""
            in_text_set = False
            
            for i, line in enumerate(lines, 1):
                # Buscar [TEXT_SET:...]
                text_set_match = re.match(r'\[TEXT_SET:(\w+)\]', line)
                if text_set_match:
                    current_text_set = text_set_match.group(1)
                    in_text_set = True
                    continue
                
                # Si estamos en un TEXT_SET y la línea no está vacía y no es un tag
                if in_text_set and line.strip() and not line.strip().startswith('['):
                    text = line.strip()
                    if text:  # Solo agregar si hay texto
                        context = f"{current_text_set}" if current_text_set else "Text"
                        entry = TextEntry(str(file_path), i, current_text_set, text, context)
                        entry.entry_id = len(self.text_entries)
                        self.text_entries.append(entry)
                        self.text_entry_dict[entry.entry_id] = entry
        except Exception as e:
            print(f"Error parseando {file_path}: {e}")
    
    def update_text_tree(self):
        """Actualiza el árbol de textos"""
        for item in self.text_tree.get_children():
            self.text_tree.delete(item)
        
        filter_type = self.text_filter_var.get()
        
        # Agrupar por archivo
        files_dict = {}
        for entry in self.text_entries:
            # Filtrar
            if filter_type != "Todos":
                file_name = Path(entry.file_path).name.lower()
                if filter_type == "General" and "general" not in file_name:
                    continue
                elif filter_type == "Positivo" and "positive" not in file_name:
                    continue
                elif filter_type == "Maldición" and "curse" not in file_name:
                    continue
                elif filter_type == "Libros" and "book" not in file_name:
                    continue
                elif filter_type == "Profesiones" and "profession" not in file_name:
                    continue
                elif filter_type == "Diálogos" and "greet" not in file_name and "dialogue" not in file_name:
                    continue
            
            file_name = Path(entry.file_path).name
            if file_name not in files_dict:
                files_dict[file_name] = []
            files_dict[file_name].append(entry)
        
        # Agregar al árbol
        for file_name, entries in sorted(files_dict.items()):
            file_node = self.text_tree.insert("", tk.END, text=file_name,
                                             values=("Archivo", file_name))
            for entry in entries:
                # Truncar texto largo para visualización
                display_text = entry.text[:80] + "..." if len(entry.text) > 80 else entry.text
                item_id = self.text_tree.insert(file_node, tk.END, text=display_text,
                                               values=(entry.text_set, file_name),
                                               tags=(str(entry.entry_id),))
    
    def on_text_select(self, event):
        """Cuando se selecciona una entrada de texto"""
        selection = self.text_tree.selection()
        if not selection:
            return
        
        item = selection[0]
        tags = self.text_tree.item(item, "tags")
        if tags:
            try:
                entry_id = int(tags[0])
                entry = self.text_entry_dict.get(entry_id)
                if entry:
                    self.show_text_entry(entry)
            except (ValueError, IndexError):
                pass
    
    def show_text_entry(self, entry: TextEntry):
        """Muestra y permite editar una entrada de texto"""
        self.current_text_entry = entry
        
        # Info
        info = f"Archivo: {Path(entry.file_path).name}\n"
        info += f"Línea: {entry.line_num}\n"
        info += f"Tipo: {entry.text_set}\n"
        info += f"Contexto: {entry.context}\n"
        info += f"Original: {entry.original_text}"
        
        self.text_info_text.delete(1.0, tk.END)
        self.text_info_text.insert(1.0, info)
        
        # Texto editable
        self.text_edit_widget.delete(1.0, tk.END)
        self.text_edit_widget.insert(1.0, entry.text)
    
    def apply_text_changes(self):
        """Aplica cambios a la entrada de texto actual"""
        if not self.current_text_entry:
            return
        
        new_text = self.text_edit_widget.get(1.0, tk.END).strip()
        self.current_text_entry.text = new_text
        self.current_text_entry.modified = True
        
        self.update_text_tree()
        messagebox.showinfo("Éxito", "Cambios aplicados (guarda el archivo)")
    
    def randomize_current_text(self):
        """Randomiza el texto actual"""
        if not self.current_text_entry:
            return
        
        words = self.current_text_entry.text.split()
        random_words = []
        for word in words:
            # Preservar placeholders
            if word.startswith('[') and word.endswith(']'):
                random_words.append(word)
            else:
                random_words.append(self.generate_random_name(length=len(word)))
        
        new_text = ' '.join(random_words)
        self.text_edit_widget.delete(1.0, tk.END)
        self.text_edit_widget.insert(1.0, new_text)
        
        self.apply_text_changes()
    
    def restore_original_text(self):
        """Restaura el texto original"""
        if not self.current_text_entry:
            return
        
        self.current_text_entry.text = self.current_text_entry.original_text
        self.current_text_entry.modified = False
        
        self.text_edit_widget.delete(1.0, tk.END)
        self.text_edit_widget.insert(1.0, self.current_text_entry.original_text)
    
    def save_text_file(self, file_path: str, entries: List[TextEntry]):
        """Guarda cambios en un archivo de texto"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        changes = {entry.line_num - 1: entry for entry in entries}
        
        for line_num, entry in changes.items():
            if line_num < len(lines):
                # Preservar indentación si existe
                original_line = lines[line_num]
                indent_match = re.match(r'^(\s*)', original_line)
                indent = indent_match.group(1) if indent_match else ""
                
                # Reemplazar la línea con el nuevo texto
                lines[line_num] = f"{indent}{entry.text}\n"
        
        with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
            f.writelines(lines)

def main():
    root = tk.Tk()
    app = DFNameEditor(root)
    root.mainloop()

if __name__ == "__main__":
    main()
