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
import json
import requests
import threading
import time
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
        self.root.geometry("1600x1000")
        self.root.minsize(1200, 700)  # Tamaño mínimo
        
        # Auto-detect version based on directory structure
        self.base_path = self.detect_base_path()
        self.name_entries: List[NameEntry] = []
        self.text_entries: List[TextEntry] = []  # Entradas de texto/frases
        self.entry_dict: Dict[int, NameEntry] = {}  # Mapeo ID -> Entry para el árbol
        self.text_entry_dict: Dict[int, TextEntry] = {}  # Mapeo ID -> TextEntry
        
        self.create_ui()
        
    def detect_base_path(self):
        """Detect the base path based on version (0.47 vs 0.53)"""
        # Try 0.53 structure first
        path_53 = Path("df_53_03_win/data/vanilla")
        if path_53.exists():
            return path_53
        
        # Try 0.47 structure
        path_47 = Path("Dwarf Fortress 0.47.05/raw")
        if path_47.exists():
            return path_47
        
        # Default to 0.53 structure
        return Path("df_53_03_win/data/vanilla")
    
    def is_version_47(self):
        """Check if we're using version 0.47 structure"""
        return "0.47" in str(self.base_path) or "raw" in str(self.base_path)
    
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
        
        # Pestaña 3: AI Generator (DeepSeek)
        ai_frame = ttk.Frame(notebook)
        notebook.add(ai_frame, text="🤖 AI Generator")
        
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
        
        # ========== PESTAÑA DE AI GENERATOR ==========
        # Crear un canvas con scrollbar para toda la pestaña AI
        ai_canvas_frame = ttk.Frame(ai_frame)
        ai_canvas_frame.pack(fill=tk.BOTH, expand=True)
        
        ai_canvas = tk.Canvas(ai_canvas_frame)
        ai_scrollbar = ttk.Scrollbar(ai_canvas_frame, orient="vertical", command=ai_canvas.yview)
        ai_scrollable_frame = ttk.Frame(ai_canvas)
        
        canvas_window = ai_canvas.create_window((0, 0), window=ai_scrollable_frame, anchor="nw")
        ai_canvas.configure(yscrollcommand=ai_scrollbar.set)
        
        # Actualizar scrollregion cuando cambie el tamaño del frame
        def update_scroll_region(event=None):
            ai_canvas.update_idletasks()
            ai_canvas.configure(scrollregion=ai_canvas.bbox("all"))
        
        ai_scrollable_frame.bind("<Configure>", update_scroll_region)
        
        # Asegurar que el canvas se expanda con el contenido
        def configure_canvas_width(event):
            canvas_width = event.width
            ai_canvas.itemconfig(canvas_window, width=canvas_width)
        ai_canvas.bind("<Configure>", configure_canvas_width)
        
        ai_canvas.pack(side="left", fill="both", expand=True)
        ai_scrollbar.pack(side="right", fill="y")
        
        # Bind mousewheel to canvas (Windows)
        def _on_mousewheel(event):
            if event.delta:
                ai_canvas.yview_scroll(int(-1*(event.delta/120)), "units")
            else:
                # Linux/Unix
                if event.num == 4:
                    ai_canvas.yview_scroll(-1, "units")
                elif event.num == 5:
                    ai_canvas.yview_scroll(1, "units")
        
        # Bind para Windows
        ai_canvas.bind("<MouseWheel>", _on_mousewheel)
        # Bind para Linux
        ai_canvas.bind("<Button-4>", _on_mousewheel)
        ai_canvas.bind("<Button-5>", _on_mousewheel)
        
        # Guardar referencia al canvas para actualizaciones
        self.ai_canvas = ai_canvas
        self.ai_scrollable_frame = ai_scrollable_frame
        
        ai_main_frame = ai_scrollable_frame
        
        # Cargar configuración API
        self.load_api_config()
        
        # Panel superior: Configuración y Prompt
        ai_top_frame = ttk.LabelFrame(ai_main_frame, text="AI Configuration", padding="10")
        ai_top_frame.pack(fill=tk.X, pady=5, padx=10)
        
        # API Key
        api_key_frame = ttk.Frame(ai_top_frame)
        api_key_frame.pack(fill=tk.X, pady=5)
        ttk.Label(api_key_frame, text="API Key:").pack(side=tk.LEFT, padx=5)
        self.api_key_var = tk.StringVar(value=self.api_key if hasattr(self, 'api_key') else "")
        api_key_entry = ttk.Entry(api_key_frame, textvariable=self.api_key_var, width=50, show="*")
        api_key_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        ttk.Button(api_key_frame, text="💾 Guardar", command=self.save_api_config).pack(side=tk.LEFT, padx=5)
        
        # Model selection
        model_frame = ttk.Frame(ai_top_frame)
        model_frame.pack(fill=tk.X, pady=5)
        ttk.Label(model_frame, text="Model:").pack(side=tk.LEFT, padx=5)
        self.model_var = tk.StringVar(value=self.model if hasattr(self, 'model') else "deepseek-chat")
        model_combo = ttk.Combobox(model_frame, textvariable=self.model_var,
                                  values=["deepseek-chat", "deepseek-coder"],
                                  state="readonly", width=30)
        model_combo.pack(side=tk.LEFT, padx=5)
        
        # Prompt del usuario
        prompt_frame = ttk.LabelFrame(ai_main_frame, text="Your Creative Prompt", padding="10")
        prompt_frame.pack(fill=tk.BOTH, expand=True, pady=5, padx=10)
        
        ttk.Label(prompt_frame, text="Describe the theme/style you want (e.g., 'write names based on toy story and storytelling should be really deluzian way of writing'):").pack(anchor=tk.W, padx=5, pady=5)
        
        self.user_prompt_text = scrolledtext.ScrolledText(prompt_frame, height=5, wrap=tk.WORD)
        self.user_prompt_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Botones de acción
        ai_button_frame = ttk.Frame(prompt_frame)
        ai_button_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(ai_button_frame, text="🎨 Generate Names", 
                  command=self.generate_names_with_ai).pack(side=tk.LEFT, padx=5)
        ttk.Button(ai_button_frame, text="📜 Generate Text Phrases", 
                  command=self.generate_texts_with_ai).pack(side=tk.LEFT, padx=5)
        ttk.Button(ai_button_frame, text="🎲 Generate Everything", 
                  command=self.generate_all_with_ai).pack(side=tk.LEFT, padx=5)
        
        # Panel de resultados
        result_frame = ttk.LabelFrame(ai_main_frame, text="AI Generated Results", padding="10")
        result_frame.pack(fill=tk.BOTH, expand=True, pady=5, padx=10)
        
        self.ai_result_text = scrolledtext.ScrolledText(result_frame, height=12, wrap=tk.WORD)
        self.ai_result_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Botones de aplicación
        apply_frame = ttk.Frame(result_frame)
        apply_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(apply_frame, text="✅ Apply to Names", 
                  command=self.apply_ai_to_names).pack(side=tk.LEFT, padx=5)
        ttk.Button(apply_frame, text="✅ Apply to Texts", 
                  command=self.apply_ai_to_texts).pack(side=tk.LEFT, padx=5)
        ttk.Button(apply_frame, text="💾 Save All Changes", 
                  command=self.save_changes).pack(side=tk.LEFT, padx=5)
        
        # Panel de logs
        log_frame = ttk.LabelFrame(ai_main_frame, text="Activity Logs", padding="10")
        log_frame.pack(fill=tk.BOTH, expand=True, pady=5, padx=10)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=12, wrap=tk.WORD, 
                                                   font=("Consolas", 9))
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.log_text.config(state=tk.DISABLED)
        
        # Configuración de batch processing con mejor feedback
        batch_frame = ttk.Frame(ai_top_frame)
        batch_frame.pack(fill=tk.X, pady=5)
        
        batch_info_frame = ttk.Frame(batch_frame)
        batch_info_frame.pack(fill=tk.X, pady=2)
        ttk.Label(batch_info_frame, text="Entries per batch:").pack(side=tk.LEFT, padx=5)
        self.batch_size_var = tk.StringVar(value="100")
        batch_entry = ttk.Entry(batch_info_frame, textvariable=self.batch_size_var, width=10)
        batch_entry.pack(side=tk.LEFT, padx=5)
        ttk.Label(batch_info_frame, text="Max batches:").pack(side=tk.LEFT, padx=5)
        self.max_batches_var = tk.StringVar(value="10")
        max_batch_entry = ttk.Entry(batch_info_frame, textvariable=self.max_batches_var, width=10)
        max_batch_entry.pack(side=tk.LEFT, padx=5)
        
        # Info label que se actualiza dinámicamente
        self.batch_info_label = ttk.Label(batch_info_frame, text="(Will process up to 1000 entries)", 
                                          foreground="gray")
        self.batch_info_label.pack(side=tk.LEFT, padx=10)
        
        # Bind para actualizar info cuando cambian los valores
        def update_batch_info(*args):
            try:
                batch_size = int(self.batch_size_var.get())
                max_batches = int(self.max_batches_var.get())
                max_entries = batch_size * max_batches
                self.batch_info_label.config(
                    text=f"(Will process up to {max_entries:,} entries in {max_batches} batches)")
            except:
                self.batch_info_label.config(text="(Invalid values)")
        
        self.batch_size_var.trace('w', update_batch_info)
        self.max_batches_var.trace('w', update_batch_info)
        update_batch_info()
        
        self.ai_generated_data = {"names": [], "texts": []}
        
        # Inicializar log
        self.log("Dwarf Fortress Name Editor - AI Generator initialized")
        self.log("Ready to load files and generate content")
    
    def load_api_config(self):
        """Carga la configuración de la API"""
        config_path = Path("config_api.json")
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    self.api_key = config.get("deepseek_api_key", "")
                    self.model = config.get("deepseek_model", "deepseek-chat")
                    self.api_url = config.get("deepseek_base_url", "https://api.deepseek.com/chat/completions")
            except Exception as e:
                print(f"Error cargando config: {e}")
                self.api_key = ""
                self.model = "deepseek-chat"
                self.api_url = "https://api.deepseek.com/chat/completions"
        else:
            self.api_key = ""
            self.model = "deepseek-chat"
            self.api_url = "https://api.deepseek.com/chat/completions"
    
    def save_api_config(self):
        """Guarda la configuración de la API"""
        config_path = Path("config_api.json")
        config = {
            "deepseek_api_key": self.api_key_var.get(),
            "deepseek_model": self.model_var.get(),
            "deepseek_base_url": "https://api.deepseek.com/chat/completions"
        }
        try:
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            self.api_key = config["deepseek_api_key"]
            self.model = config["deepseek_model"]
            messagebox.showinfo("Éxito", "Configuración guardada")
        except Exception as e:
            messagebox.showerror("Error", f"Error guardando configuración: {e}")
    
    def select_base_path(self):
        if self.is_version_47():
            path = filedialog.askdirectory(title="Seleccionar Dwarf Fortress 0.47.05/raw")
        else:
            path = filedialog.askdirectory(title="Seleccionar df_53_03_win/data/vanilla")
        if path:
            self.base_path = Path(path)
            version_info = "0.47" if self.is_version_47() else "0.53"
            self.status_label.config(text=f"Directorio: {self.base_path} (Version {version_info})")
    
    def load_files(self):
        if not self.base_path.exists():
            messagebox.showerror("Error", "Selecciona el directorio base primero")
            return
        
        self.log("=" * 60)
        self.log("Starting file loading process...")
        self.name_entries = []
        self.text_entries = []
        self.entry_dict = {}
        self.text_entry_dict = {}
        self.status_label.config(text="Cargando archivos...")
        self.root.update()
        
        # Get file paths based on version
        if self.is_version_47():
            # Version 0.47 structure: raw/objects/
            creature_files = [
                "objects/creature_standard.txt",
                "objects/creature_large_tropical.txt",
                "objects/creature_large_temperate.txt",
                "objects/creature_large_mountain.txt",
                "objects/creature_large_ocean.txt",
                "objects/creature_large_riverlake.txt",
                "objects/creature_large_tundra.txt",
                "objects/creature_domestic.txt",
                "objects/creature_fanciful.txt",
                "objects/creature_birds.txt",
                "objects/creature_birds_new.txt",
                "objects/creature_reptiles.txt",
                "objects/creature_amphibians.txt",
                "objects/creature_insects.txt",
                "objects/creature_small_mammals.txt",
                "objects/creature_small_mammal_new.txt",
                "objects/creature_subterranean.txt",
                "objects/creature_tropical_new.txt",
                "objects/creature_temperate_new.txt",
                "objects/creature_desert_new.txt",
                "objects/creature_mountain_new.txt",
                "objects/creature_ocean_new.txt",
                "objects/creature_riverlakepool_new.txt",
                "objects/creature_tundra_taiga_new.txt",
                "objects/creature_next_underground.txt",
                "objects/creature_other.txt",
                "objects/creature_bug_slug_new.txt",
                "objects/creature_annelids.txt",
                "objects/creature_small_ocean.txt",
                "objects/creature_small_riverlake.txt",
                "objects/creature_equipment.txt",
            ]
            
            item_files = [
                "objects/item_tool.txt",
                "objects/item_weapon.txt",
                "objects/item_armor.txt",
                "objects/item_food.txt",
                "objects/item_ammo.txt",
                "objects/item_shield.txt",
                "objects/item_helm.txt",
                "objects/item_gloves.txt",
                "objects/item_pants.txt",
                "objects/item_shoes.txt",
                "objects/item_toy.txt",
                "objects/item_trapcomp.txt",
                "objects/item_siegeammo.txt",
            ]
            
            material_files = [
                "objects/inorganic_stone_layer.txt",
                "objects/inorganic_stone_mineral.txt",
                "objects/inorganic_stone_soil.txt",
                "objects/inorganic_stone_gem.txt",
                "objects/inorganic_metal.txt",
                "objects/inorganic_other.txt",
            ]
            
            plant_files = [
                "objects/plant_standard.txt",
                "objects/plant_grasses.txt",
                "objects/plant_new_trees.txt",
                "objects/plant_crops.txt",
                "objects/plant_garden.txt",
            ]
        else:
            # Version 0.53 structure: data/vanilla/vanilla_*/objects/
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
            
            material_files = [
                "vanilla_materials/objects/inorganic_stone_layer.txt",
                "vanilla_materials/objects/inorganic_stone_mineral.txt",
                "vanilla_materials/objects/inorganic_stone_soil.txt",
                "vanilla_materials/objects/inorganic_stone_gem.txt",
                "vanilla_materials/objects/inorganic_metal.txt",
                "vanilla_materials/objects/inorganic_other.txt",
            ]
            
            plant_files = [
                "vanilla_plants/objects/plant_standard.txt",
                "vanilla_plants/objects/plant_grasses.txt",
                "vanilla_plants/objects/plant_new_trees.txt",
                "vanilla_plants/objects/plant_crops.txt",
                "vanilla_plants/objects/plant_garden.txt",
            ]
        
        # Cargar archivos
        self.log("Loading creature files...")
        for file_path in creature_files:
            self.parse_file(self.base_path / file_path, "creature")
        
        self.log("Loading item files...")
        for file_path in item_files:
            self.parse_file(self.base_path / file_path, "item")
        
        self.log("Loading material files...")
        for file_path in material_files:
            self.parse_file(self.base_path / file_path, "material")
        
        self.log("Loading plant files...")
        for file_path in plant_files:
            self.parse_file(self.base_path / file_path, "plant")
        
        # Entidades
        self.log("Loading entity files...")
        if self.is_version_47():
            entity_file = self.base_path / "objects/entity_default.txt"
        else:
            entity_file = self.base_path / "vanilla_entities/objects/entity_default.txt"
        if entity_file.exists():
            self.parse_entity_file(entity_file)
        
        # Idiomas
        self.log("Loading language files...")
        if self.is_version_47():
            language_files = [
                "objects/language_words.txt",
                "objects/language_DWARF.txt",
                "objects/language_ELF.txt",
                "objects/language_HUMAN.txt",
                "objects/language_GOBLIN.txt",
            ]
        else:
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
        self.log("Loading text files...")
        # Text files - Focus on Legends mode content
        if self.is_version_47():
            # Version 0.47: text files are in objects/text/
            text_files = [
                "objects/text/book_art.txt",
                "objects/text/book_instruction.txt",
                "objects/text/secret_death.txt",
            ]
        else:
            # Version 0.53: text files are in vanilla_text/objects/
            text_files = [
                # Essential Legends mode files
                "vanilla_text/objects/text_general.txt",  # General historical narratives
                "vanilla_text/objects/text_positive.txt",  # Positive events
                "vanilla_text/objects/text_curse.txt",  # Negative events
                "vanilla_text/objects/text_secret_death.txt",  # Secret deaths
                "vanilla_text/objects/text_hist_fig_slayer.txt",  # Historical figure slayer
                "vanilla_text/objects/text_slayer.txt",  # Slayer titles
                "vanilla_text/objects/text_animal_slayer.txt",  # Animal slayer
                # Book and scroll generation (Legends mode)
                "vanilla_text/objects/text_book_art.txt",  # Artistic book titles
                "vanilla_text/objects/text_book_instruction.txt",  # Instructional book titles
                # Historical figure interactions (Legends mode)
                "vanilla_text/objects/text_justification_antithetical.txt",
                "vanilla_text/objects/text_justification_experience.txt",
                "vanilla_text/objects/text_justification_proximity.txt",
                "vanilla_text/objects/text_justification_reminder.txt",
                "vanilla_text/objects/text_justification_representation.txt",
                "vanilla_text/objects/text_arch_info_justification.txt",
                # Historical figure relationships (Legends mode)
                "vanilla_text/objects/text_family_relationship_spec.txt",
                "vanilla_text/objects/text_family_relationship_no_spec.txt",
                "vanilla_text/objects/text_family_relationship_spec_dead.txt",
                "vanilla_text/objects/text_family_relationship_no_spec_dead.txt",
                "vanilla_text/objects/text_family_relationship_additional.txt",
                "vanilla_text/objects/text_family_relationship_additional_dead.txt",
                # Historical figure professions (Legends mode)
                "vanilla_text/objects/text_hunting_profession.txt",
                "vanilla_text/objects/text_mercenary_profession.txt",
                "vanilla_text/objects/text_thief_profession.txt",
                "vanilla_text/objects/text_snatcher_profession.txt",
                "vanilla_text/objects/text_wandering_profession.txt",
                "vanilla_text/objects/text_past_hunting_profession.txt",
                "vanilla_text/objects/text_past_mercenary_profession.txt",
                "vanilla_text/objects/text_past_thief_profession.txt",
                "vanilla_text/objects/text_past_snatcher_profession.txt",
                "vanilla_text/objects/text_past_wandering_profession.txt",
                "vanilla_text/objects/text_hunting_profession_year.txt",
                "vanilla_text/objects/text_mercenary_profession_year.txt",
                "vanilla_text/objects/text_thief_profession_year.txt",
                "vanilla_text/objects/text_snatcher_profession_year.txt",
                "vanilla_text/objects/text_wandering_profession_year.txt",
                "vanilla_text/objects/text_current_profession_year.txt",
                "vanilla_text/objects/text_current_profession_no_year.txt",
                "vanilla_text/objects/text_past_profession_year.txt",
                "vanilla_text/objects/text_past_profession_no_year.txt",
                # Historical figure seekers (Legends mode)
                "vanilla_text/objects/text_unknown_hf_seeker.txt",
                "vanilla_text/objects/text_site_specific_hf_seeker.txt",
                "vanilla_text/objects/text_ab_specific_hf_seeker.txt",
                "vanilla_text/objects/text_same_site_specific_hf_seeker.txt",
                "vanilla_text/objects/text_same_site_ab_specific_hf_seeker.txt",
                # Other Legends mode content
                "vanilla_text/objects/text_child_age_proclamation.txt",
                "vanilla_text/objects/text_no_family.txt",
                # Additional text files that may appear in Legends mode
                "vanilla_text/objects/text_goodbye_worship_1.txt",
                "vanilla_text/objects/text_goodbye_worship_2.txt",
                "vanilla_text/objects/text_goodbye_worship_3.txt",
                "vanilla_text/objects/text_greet_baby.txt",
                "vanilla_text/objects/text_greet_reply_after_hero.txt",
                "vanilla_text/objects/text_greet_reply_unusual_first.txt",
                "vanilla_text/objects/text_greet_worship.txt",
                "vanilla_text/objects/text_guard_profession.txt",
                "vanilla_text/objects/text_guard_warning.txt",
                "vanilla_text/objects/text_soldier_profession.txt",
                "vanilla_text/objects/text_task_recommendation.txt",
                "vanilla_text/objects/text_temple_already_member.txt",
                "vanilla_text/objects/text_temple_become_member.txt",
                "vanilla_text/objects/text_threat.txt",
            ]
        
        for file_path in text_files:
            self.parse_text_file(self.base_path / file_path)
        
        # For version 0.47, also search subfolders recursively for any additional .txt files
        if self.is_version_47():
            self.log("Scanning subfolders for additional text files...")
            objects_path = self.base_path / "objects"
            if objects_path.exists():
                # Recursively find all .txt files in subfolders
                for txt_file in objects_path.rglob("*.txt"):
                    # Skip files we've already loaded
                    relative_path = txt_file.relative_to(self.base_path)
                    already_loaded = False
                    
                    # Check if already in our lists
                    for creature_file in creature_files:
                        if (self.base_path / creature_file) == txt_file:
                            already_loaded = True
                            break
                    if already_loaded:
                        continue
                    
                    for item_file in item_files:
                        if (self.base_path / item_file) == txt_file:
                            already_loaded = True
                            break
                    if already_loaded:
                        continue
                    
                    for material_file in material_files:
                        if (self.base_path / material_file) == txt_file:
                            already_loaded = True
                            break
                    if already_loaded:
                            continue
                    
                    for plant_file in plant_files:
                        if (self.base_path / plant_file) == txt_file:
                            already_loaded = True
                            break
                    if already_loaded:
                        continue
                    
                    for lang_file in language_files:
                        if (self.base_path / lang_file) == txt_file:
                            already_loaded = True
                            break
                    if already_loaded:
                        continue
                    
                    for text_file in text_files:
                        if (self.base_path / text_file) == txt_file:
                            already_loaded = True
                            break
                    if already_loaded:
                        continue
                    
                    # Skip entity_default.txt (already handled)
                    if txt_file.name == "entity_default.txt":
                        continue
                    
                    # Try to parse the file based on its name/path
                    file_name_lower = txt_file.name.lower()
                    parent_dir = txt_file.parent.name.lower()
                    
                    if "creature" in file_name_lower or "creature" in parent_dir:
                        self.log(f"Found additional creature file: {relative_path}")
                        self.parse_file(txt_file, "creature")
                    elif "item" in file_name_lower or "item" in parent_dir:
                        self.log(f"Found additional item file: {relative_path}")
                        self.parse_file(txt_file, "item")
                    elif "inorganic" in file_name_lower or "material" in file_name_lower:
                        self.log(f"Found additional material file: {relative_path}")
                        self.parse_file(txt_file, "material")
                    elif "plant" in file_name_lower:
                        self.log(f"Found additional plant file: {relative_path}")
                        self.parse_file(txt_file, "plant")
                    elif "language" in file_name_lower:
                        self.log(f"Found additional language file: {relative_path}")
                        self.parse_file(txt_file, "language")
                    elif "text" in parent_dir or "book" in file_name_lower or "secret" in file_name_lower:
                        self.log(f"Found additional text file: {relative_path}")
                        self.parse_text_file(txt_file)
                    elif "entity" in file_name_lower:
                        self.log(f"Found additional entity file: {relative_path}")
                        self.parse_entity_file(txt_file)
                    elif "descriptor" in file_name_lower or "body" in file_name_lower or "reaction" in file_name_lower or "interaction" in file_name_lower or "building" in file_name_lower:
                        # These might have names we can edit
                        self.log(f"Found additional file (attempting to parse): {relative_path}")
                        self.parse_file(txt_file, "creature")  # Try creature parser as fallback
        
        self.update_tree()
        self.update_text_tree()
        self.log(f"SUCCESS: Loaded {len(self.name_entries)} name entries and {len(self.text_entries)} text entries")
        self.log("=" * 60)
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
        self.log("=" * 60)
        self.log("Starting save process...")
        self.log(f"Total name entries: {len(self.name_entries)}")
        self.log(f"Total text entries: {len(self.text_entries)}")
        
        modified_names = [e for e in self.name_entries if e.modified]
        modified_texts = [e for e in self.text_entries if e.modified]
        
        self.log(f"Modified name entries: {len(modified_names)}")
        self.log(f"Modified text entries: {len(modified_texts)}")
        
        if modified_names:
            self.log("Modified name entries details:")
            for i, entry in enumerate(modified_names[:10]):  # Mostrar primeros 10
                file_name = Path(entry.file_path).name
                self.log(f"  [{i}] {file_name}:{entry.line_num} - {entry.tag_type} - {entry.context} - parts: {entry.parts}")
            if len(modified_names) > 10:
                self.log(f"  ... and {len(modified_names) - 10} more")
        
        if not modified_names and not modified_texts:
            self.log("No changes to save")
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
        self.log(f"Saving {len(name_files_dict)} name files...")
        for file_path, entries in name_files_dict.items():
            try:
                file_name = Path(file_path).name
                self.log(f"  Processing {file_name} ({len(entries)} entries)...")
                # Verificar que el archivo existe
                if not Path(file_path).exists():
                    self.log(f"  ✗ ERROR: File does not exist: {file_path}")
                    continue
                
                self.save_file(file_path, entries)
                saved_count += len(entries)
                total_files += 1
                self.log(f"  ✓ Saved {file_name} successfully ({len(entries)} changes)")
            except Exception as e:
                import traceback
                error_details = traceback.format_exc()
                self.log(f"  ✗ ERROR saving {Path(file_path).name}: {e}")
                self.log(f"  Traceback: {error_details}")
                messagebox.showerror("Error", f"Error guardando {file_path}:\n{e}\n\nRevisa los logs para más detalles.")
                return
        
        # Guardar archivos de texto
        self.log(f"Saving {len(text_files_dict)} text files...")
        for file_path, entries in text_files_dict.items():
            try:
                self.log(f"  Saving {Path(file_path).name} ({len(entries)} entries)...")
                self.save_text_file(file_path, entries)
                saved_count += len(entries)
                total_files += 1
                self.log(f"  ✓ Saved {Path(file_path).name} successfully")
            except Exception as e:
                self.log(f"  ✗ ERROR saving {Path(file_path).name}: {e}")
                messagebox.showerror("Error", f"Error guardando {file_path}:\n{e}")
                return
        
        for entry in modified_names + modified_texts:
            entry.modified = False
        
        self.log(f"SUCCESS: Saved {saved_count} changes in {total_files} file(s)")
        self.log("=" * 60)
        messagebox.showinfo("Éxito", f"💾 Guardados {saved_count} cambios en {total_files} archivo(s)\n\nLos cambios están ahora en los archivos vanilla del juego.")
        self.status_label.config(text=f"Guardados {saved_count} cambios")
    
    def save_file(self, file_path: str, entries: List[NameEntry]):
        """Guarda cambios en un archivo"""
        file_path_obj = Path(file_path)
        self.log(f"  Reading file: {file_path_obj.name}")
        self.log(f"  Full path: {file_path}")
        self.log(f"  File exists: {file_path_obj.exists()}")
        
        if not file_path_obj.exists():
            self.log(f"  ✗ ERROR: File does not exist: {file_path}")
            raise FileNotFoundError(f"File does not exist: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        self.log(f"  File has {len(lines)} lines")
        
        changes = {entry.line_num - 1: entry for entry in entries}
        self.log(f"  Will modify {len(changes)} lines in file")
        self.log(f"  Entries to modify:")
        for entry in entries:
            self.log(f"    - Line {entry.line_num}: {entry.tag_type} - {entry.context}")
        
        modifications_made = 0
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
                elif entry.tag_type in ["NAME", "CASTE_NAME"]:
                    # NAME y CASTE_NAME: singular:plural:adjective (3 partes)
                    if len(entry.parts) >= 3:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}:{entry.parts[1]}:{entry.parts[2]}]\n"
                    elif len(entry.parts) == 2:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}:{entry.parts[1]}]\n"
                    else:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}]\n"
                elif entry.tag_type == "GENERAL_CHILD_NAME":
                    # GENERAL_CHILD_NAME: singular:plural (2 partes)
                    if len(entry.parts) >= 2:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}:{entry.parts[1]}]\n"
                    else:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}]\n"
                elif entry.tag_type == "NOUN":
                    # NOUN: singular:plural (2 partes)
                    if len(entry.parts) >= 2:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}:{entry.parts[1]}]\n"
                    else:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}]\n"
                elif entry.tag_type == "ADJ":
                    # ADJ: adjective (1 parte)
                    new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}]\n"
                elif entry.tag_type == "T_WORD":
                    # T_WORD: english:translation (2 partes)
                    if len(entry.parts) >= 2:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}:{entry.parts[1]}]\n"
                    else:
                        new_line = f"{indent}[{entry.tag_type}:{entry.parts[0]}]\n"
                else:
                    new_line = original_line
                    self.log(f"    WARNING: Unknown tag type {entry.tag_type}, keeping original")
                
                # Log del cambio
                if new_line != original_line:
                    modifications_made += 1
                    self.log(f"    Line {line_num + 1}: {entry.tag_type}")
                    self.log(f"      OLD: {original_line.strip()}")
                    self.log(f"      NEW: {new_line.strip()}")
                    self.log(f"      Parts: {entry.parts}")
                else:
                    self.log(f"    Line {line_num + 1}: No change (same as original)")
                
                lines[line_num] = new_line
            else:
                self.log(f"    ERROR: Line {line_num + 1} out of range (file has {len(lines)} lines)")
        
        self.log(f"  Made {modifications_made} actual modifications")
        self.log(f"  Writing file: {file_path_obj.name}")
        
        # Crear backup antes de escribir
        backup_path = file_path_obj.with_suffix(file_path_obj.suffix + '.bak')
        try:
            import shutil
            shutil.copy2(file_path, backup_path)
            self.log(f"  Created backup: {backup_path.name}")
        except Exception as e:
            self.log(f"  WARNING: Could not create backup: {e}")
        
        # Escribir el archivo
        try:
            with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
                f.writelines(lines)
            self.log(f"  ✓ File written successfully ({len(lines)} lines)")
            
            # Verificar que se escribió correctamente
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                verify_lines = f.readlines()
            if len(verify_lines) == len(lines):
                self.log(f"  ✓ File verification passed ({len(verify_lines)} lines)")
            else:
                self.log(f"  ⚠ WARNING: File verification failed (expected {len(lines)}, got {len(verify_lines)})")
        except Exception as e:
            self.log(f"  ✗ ERROR writing file: {e}")
            raise
    
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
        self.log(f"  Reading text file: {Path(file_path).name}")
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        self.log(f"  File has {len(lines)} lines")
        changes = {entry.line_num - 1: entry for entry in entries}
        self.log(f"  Will modify {len(changes)} lines in file")
        
        modifications_made = 0
        for line_num, entry in changes.items():
            if line_num < len(lines):
                # Preservar indentación si existe
                original_line = lines[line_num]
                indent_match = re.match(r'^(\s*)', original_line)
                indent = indent_match.group(1) if indent_match else ""
                
                # Limpiar el texto (sin saltos de línea, sin espacios extra al inicio/final)
                clean_text = entry.text.strip()
                
                # Reemplazar la línea con el nuevo texto
                new_line = f"{indent}{clean_text}\n"
                
                if new_line != original_line:
                    modifications_made += 1
                    self.log(f"    Line {line_num + 1}:")
                    self.log(f"      OLD: {original_line.strip()}")
                    self.log(f"      NEW: {new_line.strip()}")
                
                lines[line_num] = new_line
            else:
                self.log(f"    ERROR: Line {line_num + 1} out of range (file has {len(lines)} lines)")
        
        self.log(f"  Made {modifications_made} actual modifications")
        self.log(f"  Writing text file: {Path(file_path).name}")
        with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
            f.writelines(lines)
        self.log(f"  ✓ Text file written successfully")
    
    # ========== FUNCIONES DE AI ==========
    
    def log(self, message: str):
        """Agrega un mensaje al log (thread-safe)"""
        try:
            if hasattr(self, 'log_text') and self.log_text.winfo_exists():
                self.root.after(0, self._log_safe, message)
            else:
                # Si el widget no existe, imprimir a consola
                from datetime import datetime
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] {message}")
        except:
            # Fallback a print si hay cualquier error
            from datetime import datetime
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {message}")
    
    def _log_safe(self, message: str):
        """Agrega mensaje al log de forma segura (ejecutado en main thread)"""
        try:
            if hasattr(self, 'log_text') and self.log_text.winfo_exists():
                self.log_text.config(state=tk.NORMAL)
                from datetime import datetime
                timestamp = datetime.now().strftime("%H:%M:%S")
                self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
                self.log_text.see(tk.END)
                self.log_text.config(state=tk.DISABLED)
        except Exception as e:
            print(f"Error logging: {e} - {message}")
    
    def call_deepseek_api(self, system_prompt: str, user_prompt: str, api_key: str = None, model: str = None) -> str:
        """Llama a la API de DeepSeek (no bloquea la UI)"""
        # Obtener valores si no se pasan (thread-safe)
        if api_key is None:
            try:
                api_key = self.api_key_var.get() if hasattr(self, 'api_key_var') else self.api_key
            except:
                api_key = self.api_key if hasattr(self, 'api_key') else ""
        
        if not api_key:
            self.log("ERROR: API Key no configurada")
            self.root.after(0, lambda: messagebox.showerror("Error", "API Key no configurada"))
            return ""
        
        if model is None:
            try:
                model = self.model_var.get() if hasattr(self, 'model_var') else self.model
            except:
                model = self.model if hasattr(self, 'model') else "deepseek-chat"
        self.log(f"Calling DeepSeek API with model: {model}")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        data = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.8,  # Ligeramente más creativo pero más rápido
            "max_tokens": 8000  # Aumentado para más respuestas por llamada
        }
        
        try:
            self.log("Sending request to DeepSeek API...")
            # La llamada se hace en thread, no bloquea UI
            response = requests.post(self.api_url, headers=headers, json=data, timeout=120)
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            self.log(f"API Response received ({len(content)} characters)")
            return content
        except Exception as e:
            error_msg = f"Error llamando a DeepSeek API: {e}"
            self.log(f"ERROR: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror("Error API", error_msg))
            return ""
    
    def generate_names_with_ai(self):
        """Genera nombres usando AI con batch processing (no bloquea UI)"""
        user_prompt = self.user_prompt_text.get(1.0, tk.END).strip()
        if not user_prompt:
            messagebox.showwarning("Advertencia", "Escribe un prompt primero")
            return
        
        if not self.name_entries:
            messagebox.showwarning("Advertencia", "Carga los archivos de nombres primero")
            return
        
        # Obtener valores de UI antes de iniciar thread
        try:
            batch_size = int(self.batch_size_var.get())
            max_batches = int(self.max_batches_var.get())
        except:
            batch_size = 100  # Valor por defecto optimizado
            max_batches = 10
        
        # Ejecutar en thread separado para no bloquear UI
        thread = threading.Thread(target=self._generate_names_with_ai_thread, 
                                  args=(user_prompt, batch_size, max_batches), daemon=True)
        thread.start()
    
    def _generate_names_with_ai_thread(self, user_prompt: str, batch_size: int, max_batches: int):
        """Genera nombres en thread separado"""
        
        self.log(f"Starting name generation with batch_size={batch_size}, max_batches={max_batches}")
        self.root.after(0, lambda: self.status_label.config(text="Generando nombres con AI..."))
        
        all_generated = []
        total_entries = len(self.name_entries)
        num_batches = min(max_batches, (total_entries + batch_size - 1) // batch_size)
        max_processable = batch_size * max_batches
        actual_processable = min(total_entries, max_processable)
        
        self.log(f"=" * 60)
        self.log(f"BATCH CONFIGURATION:")
        self.log(f"  Total entries available: {total_entries:,}")
        self.log(f"  Batch size: {batch_size} entries per batch")
        self.log(f"  Max batches: {max_batches}")
        self.log(f"  Max processable: {max_processable:,} entries")
        self.log(f"  Actual batches to run: {num_batches}")
        self.log(f"  Entries to process: {actual_processable:,} ({100*actual_processable/total_entries:.1f}% of total)")
        if actual_processable < total_entries:
            self.log(f"  ⚠ WARNING: {total_entries - actual_processable:,} entries will NOT be processed")
        self.log(f"  Estimated tokens per batch: ~{batch_size * 50}")
        self.log(f"=" * 60)
        
        # Obtener API key y model antes de los batches
        try:
            api_key = self.api_key_var.get() if hasattr(self, 'api_key_var') else self.api_key
            model = self.model_var.get() if hasattr(self, 'model_var') else self.model
        except:
            api_key = self.api_key if hasattr(self, 'api_key') else ""
            model = self.model if hasattr(self, 'model') else "deepseek-chat"
        
        # Crear prompt del sistema OPTIMIZADO - más compacto y eficiente
        system_prompt = """You are a creative name generator for Dwarf Fortress modding. Generate names in EXACT game format.

FORMAT: Return ONLY JSON array. Each object: {"index": N, "type": "NAME|CASTE_NAME|etc", "parts": ["part1", "part2", "part3"], "context": "CREATURE (TYPE)"}

RULES:
- NAME/CASTE_NAME: 3 parts (singular:plural:adjective)
- GENERAL_CHILD_NAME: 2 parts (singular:plural)  
- NOUN: 2 parts (singular:plural)
- ADJ: 1 part (adjective)
- T_WORD: 2 parts (english:translation)
- Match entry count EXACTLY. Include exact "index" from input.
- Follow user's creative theme. Names 5-15 chars per part."""
        
        # Procesar en batches
        for batch_num in range(num_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, total_entries)
            batch_entries = self.name_entries[start_idx:end_idx]
            
            batch_entries_count = end_idx - start_idx
            self.log(f"Processing batch {batch_num + 1}/{num_batches} (entries {start_idx:,}-{end_idx-1:,}, {batch_entries_count} entries)")
            
            # Crear información OPTIMIZADA - compacta pero completa
            entries_info = []
            for i, entry in enumerate(batch_entries):
                idx = start_idx + i
                # Formato compacto: solo lo esencial
                entries_info.append({
                    "i": idx,  # Índice (abreviado para ahorrar tokens)
                    "t": entry.tag_type,  # Tipo (abreviado)
                    "p": entry.parts,  # Partes actuales
                    "c": entry.context  # Contexto
                })
            
            # Prompt optimizado - más compacto, menos tokens
            user_prompt_full = f"""Theme: {user_prompt}

Generate {len(entries_info)} names. Return JSON array with EXACT format:
[{{"index": {start_idx}, "type": "NAME", "parts": ["s", "p", "a"], "context": "DWARF (NAME)"}}, ...]

Entries (i=index, t=type, p=current_parts, c=context):
{json.dumps(entries_info, separators=(',', ':'), ensure_ascii=False)}

CRITICAL: Return EXACT "index" from input. Match parts count. Follow theme: {user_prompt}"""
            
            result = self.call_deepseek_api(system_prompt, user_prompt_full, api_key, model)
            
            if result:
                # Intentar parsear JSON
                try:
                    json_match = re.search(r'\[.*\]', result, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                        parsed = json.loads(json_str)
                        all_generated.extend(parsed)
                        self.log(f"Batch {batch_num + 1}: Parsed {len(parsed)} entries successfully")
                    else:
                        self.log(f"WARNING: Batch {batch_num + 1}: No JSON found in response")
                except Exception as e:
                    self.log(f"ERROR: Batch {batch_num + 1}: Failed to parse JSON - {e}")
            
            # Pausa mínima entre batches (reducida para más velocidad)
            if batch_num < num_batches - 1:
                time.sleep(0.2)  # Reducido de 0.5 a 0.2 segundos
                # Actualizar UI periódicamente
                self.root.after(0, lambda: self.root.update_idletasks())
        
        # Mostrar todos los resultados en main thread
        def show_results():
            if all_generated:
                result_text = json.dumps(all_generated, indent=2, ensure_ascii=False)
                self.ai_result_text.delete(1.0, tk.END)
                self.ai_result_text.insert(1.0, result_text)
                self.ai_generated_data["names"] = all_generated
                self.log(f"SUCCESS: Generated {len(all_generated)} names total")
                messagebox.showinfo("Éxito", f"Generados {len(all_generated)} nombres en {num_batches} batches. Revisa y aplica.")
            else:
                self.log("ERROR: No names were generated")
                messagebox.showwarning("Advertencia", "No se generaron nombres. Revisa los logs.")
            
            self.status_label.config(text="Listo")
        
        self.root.after(0, show_results)
    
    def generate_texts_with_ai(self):
        """Genera textos/frases usando AI con batch processing (no bloquea UI)"""
        user_prompt = self.user_prompt_text.get(1.0, tk.END).strip()
        if not user_prompt:
            messagebox.showwarning("Advertencia", "Escribe un prompt primero")
            return
        
        if not self.text_entries:
            messagebox.showwarning("Advertencia", "Carga los archivos de texto primero")
            return
        
        # Obtener valores de UI antes de iniciar thread
        try:
            batch_size = int(self.batch_size_var.get())
            max_batches = int(self.max_batches_var.get())
        except:
            batch_size = 100  # Valor por defecto optimizado
            max_batches = 10
        
        # Ejecutar en thread separado
        thread = threading.Thread(target=self._generate_texts_with_ai_thread, 
                                  args=(user_prompt, batch_size, max_batches), daemon=True)
        thread.start()
    
    def _generate_texts_with_ai_thread(self, user_prompt: str, batch_size: int, max_batches: int):
        """Genera textos en thread separado"""
        
        self.log(f"Starting text generation with batch_size={batch_size}, max_batches={max_batches}")
        self.root.after(0, lambda: self.status_label.config(text="Generando textos con AI..."))
        
        all_generated = []
        total_entries = len(self.text_entries)
        num_batches = min(max_batches, (total_entries + batch_size - 1) // batch_size)
        max_processable = batch_size * max_batches
        actual_processable = min(total_entries, max_processable)
        
        self.log(f"=" * 60)
        self.log(f"BATCH CONFIGURATION:")
        self.log(f"  Total text entries available: {total_entries:,}")
        self.log(f"  Batch size: {batch_size} entries per batch")
        self.log(f"  Max batches: {max_batches}")
        self.log(f"  Max processable: {max_processable:,} entries")
        self.log(f"  Actual batches to run: {num_batches}")
        self.log(f"  Entries to process: {actual_processable:,} ({100*actual_processable/total_entries:.1f}% of total)")
        if actual_processable < total_entries:
            self.log(f"  ⚠ WARNING: {total_entries - actual_processable:,} entries will NOT be processed")
        self.log(f"  Estimated tokens per batch: ~{batch_size * 40}")
        self.log(f"=" * 60)
        
        # Obtener API key y model antes de los batches
        try:
            api_key = self.api_key_var.get() if hasattr(self, 'api_key_var') else self.api_key
            model = self.model_var.get() if hasattr(self, 'model_var') else self.model
        except:
            api_key = self.api_key if hasattr(self, 'api_key') else ""
            model = self.model if hasattr(self, 'model') else "deepseek-chat"
        
        # Prompt optimizado para textos - GENERA TEXTO NUEVO en el estilo solicitado
        # Enfocado en Legends mode: libros, eventos históricos, narrativas
        system_prompt = """You are a creative writer for Dwarf Fortress Legends mode. CREATE COMPLETELY NEW TEXT in the requested writing style. Generate fresh, original phrases for historical narratives, book titles, and event descriptions.

FORMAT: Return ONLY JSON array. Each object: {{"index": N, "text": "new creative phrase with [PLACEHOLDERS]", "type": "TEXT_SET"}}

CRITICAL RULES FOR LEGENDS MODE:
1. CREATE NEW TEXT: Generate completely original phrases. Do NOT copy or transform the original text.
2. Preserve ALL placeholders EXACTLY: [CONTEXT:...], [NAME], [ADJ], [NOUN], [VERB], [NO_ART_NAME], [PHRASE], [ANY_AGE], [ANY_PRONOUN], etc.
3. Follow the user's creative theme/style throughout:
   - Spinoza style = philosophical, systematic, geometric reasoning, necessary causation
   - Deleuze style = rhizomatic, nomadic, deterritorialized thought
   - Other styles = adapt accordingly
4. For BOOK TITLES (BOOK_ART, BOOK_INSTRUCTION): Create creative, meaningful titles in the requested style. Make them sound like real book titles.
5. For HISTORICAL EVENTS: Change action verbs and narrative structure:
   - "killed" → "brought about the cessation of", "terminated the existence of", etc. (match style)
   - "attacked" → "initiated conflict with", "engaged in combat against", etc.
   - "fought with" → "entered into battle alongside", "waged war in conjunction with", etc.
   - "was created" → "came into existence", "was brought into being", etc.
   - "was lost" → "ceased to be present", "was removed from existence", etc.
6. For NARRATIVE PHRASES: Transform the entire sentence structure while preserving placeholders.
7. Match entry count EXACTLY. Include exact "index" from input.
8. Be creative and chaotic but maintain the requested writing style throughout.

EXAMPLES for Spinoza style:
- Book title: "Treatise on the Geometric Necessity of [NOUN] by [NAME]"
- Event: "In the year [CONTEXT:NUMBER], through geometric necessity of causation, [CONTEXT:HIST_FIG:TRANS_NAME] brought about the cessation of [NAME]"
- Death: "Through the chain of necessary causes, [NAME] reached the limit of duration"

EXAMPLES for Deleuze style:
- Book title: "Rhizomatic Explorations of [NOUN] by [NAME]"
- Event: "In the year [CONTEXT:NUMBER], through rhizomatic connections, [CONTEXT:HIST_FIG:TRANS_NAME] deterritorialized [NAME]"
- Death: "Through lines of flight, [NAME] escaped the territorial assemblage"

DO NOT generate random characters like "HèJQfcpôvö8" - generate REAL, MEANINGFUL TEXT in the requested style."""
        
        # Procesar en batches
        for batch_num in range(num_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, total_entries)
            batch_entries = self.text_entries[start_idx:end_idx]
            
            batch_entries_count = end_idx - start_idx
            self.log(f"Processing text batch {batch_num + 1}/{num_batches} (entries {start_idx:,}-{end_idx-1:,}, {batch_entries_count} entries)")
            
            # Formato optimizado para textos - compacto
            entries_info = []
            for i, entry in enumerate(batch_entries):
                idx = start_idx + i
                entries_info.append({
                    "i": idx,
                    "t": entry.text_set,
                    "txt": entry.text[:80]  # Primeros 80 chars para contexto
                })
            
            user_prompt_full = f"""Creative Theme/Style: {user_prompt}

CREATE {len(entries_info)} COMPLETELY NEW text phrases for Dwarf Fortress Legends mode in the requested style.

LEGENDS MODE CONTEXT:
- These phrases appear in historical narratives, book titles, event descriptions, and character interactions
- Book titles (BOOK_ART, BOOK_INSTRUCTION) should be creative and meaningful
- Historical event phrases should use action verbs and narrative structure matching your style
- Death phrases, slayer titles, and relationship phrases should all match the requested style

Return JSON array:
[{{"index": {start_idx}, "text": "new creative phrase with [PLACEHOLDERS]", "type": "TEXT_SET"}}, ...]

Context reference (i=index, t=text_set, txt=original_text - for context only, DO NOT copy):
{json.dumps(entries_info, separators=(',', ':'), ensure_ascii=False)}

CRITICAL REQUIREMENTS:
1. Return EXACT "index" from input (starting from {start_idx})
2. Preserve ALL [PLACEHOLDERS] exactly: [CONTEXT:...], [NAME], [ADJ], [NOUN], [VERB], [NO_ART_NAME], [PHRASE], etc.
3. CREATE NEW TEXT: Generate completely original phrases, do NOT copy or transform the original
4. For BOOK TITLES (t=BOOK_ART or BOOK_INSTRUCTION): Create meaningful, creative titles that sound like real books
5. For HISTORICAL EVENTS: Transform action verbs and narrative structure (e.g., "killed" → style-appropriate alternative)
6. For NARRATIVE PHRASES: Change sentence structure while preserving placeholders
7. Follow the creative theme/style: {user_prompt}
8. Generate REAL TEXT, not random characters"""
            
            result = self.call_deepseek_api(system_prompt, user_prompt_full, api_key, model)
            
            if result:
                try:
                    json_match = re.search(r'\[.*\]', result, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                        parsed = json.loads(json_str)
                        all_generated.extend(parsed)
                        self.log(f"Text batch {batch_num + 1}: Parsed {len(parsed)} entries successfully")
                    else:
                        self.log(f"WARNING: Text batch {batch_num + 1}: No JSON found")
                except Exception as e:
                    self.log(f"ERROR: Text batch {batch_num + 1}: Failed to parse - {e}")
            
            if batch_num < num_batches - 1:
                time.sleep(0.2)  # Reducido para más velocidad
                self.root.after(0, lambda: self.root.update_idletasks())
        
        # Mostrar resultados en main thread
        def show_text_results():
            if all_generated:
                result_text = json.dumps(all_generated, indent=2, ensure_ascii=False)
                self.ai_result_text.delete(1.0, tk.END)
                self.ai_result_text.insert(1.0, result_text)
                self.ai_generated_data["texts"] = all_generated
                self.log(f"SUCCESS: Generated {len(all_generated)} text phrases total")
                messagebox.showinfo("Éxito", f"Generadas {len(all_generated)} frases en {num_batches} batches. Revisa y aplica.")
            else:
                self.log("ERROR: No texts were generated")
                messagebox.showwarning("Advertencia", "No se generaron textos. Revisa los logs.")
            
            self.status_label.config(text="Listo")
        
        self.root.after(0, show_text_results)
    
    def generate_all_with_ai(self):
        """Genera nombres y textos con AI (no bloquea UI)"""
        user_prompt = self.user_prompt_text.get(1.0, tk.END).strip()
        if not user_prompt:
            messagebox.showwarning("Advertencia", "Escribe un prompt primero")
            return
        
        # Obtener valores de UI antes de iniciar thread
        try:
            batch_size = int(self.batch_size_var.get())
            max_batches = int(self.max_batches_var.get())
        except:
            batch_size = 100  # Valor por defecto optimizado
            max_batches = 10
        
        # Ejecutar en thread para no bloquear
        def generate_all_thread():
            self.log("Starting generation of names and texts...")
            if self.name_entries:
                self._generate_names_with_ai_thread(user_prompt, batch_size, max_batches)
                time.sleep(1)  # Pequeña pausa entre tipos
            if self.text_entries:
                self._generate_texts_with_ai_thread(user_prompt, batch_size, max_batches)
        
        thread = threading.Thread(target=generate_all_thread, daemon=True)
        thread.start()
    
    def apply_ai_to_names(self):
        """Aplica los nombres generados por AI - ENFOQUE SIMPLE como cambio manual"""
        if not self.ai_generated_data.get("names"):
            messagebox.showwarning("Advertencia", "No hay nombres generados. Genera primero.")
            return
        
        self.log("=" * 60)
        self.log("APPLYING AI-GENERATED NAMES (Simple Direct Approach)...")
        generated = self.ai_generated_data["names"]
        self.log(f"Total generated entries: {len(generated)}")
        self.log(f"Total loaded entries: {len(self.name_entries)}")
        
        applied = 0
        skipped = 0
        
        # ENFOQUE SIMPLE: Aplicar directamente por índice, igual que el cambio manual
        for gen_entry in generated:
            # Obtener índice - puede venir como int o string
            idx = None
            if "index" in gen_entry:
                try:
                    idx = int(gen_entry["index"])
                except (ValueError, TypeError):
                    idx = None
            
            # Si no hay índice válido, usar orden secuencial
            if idx is None:
                idx = applied + skipped
                self.log(f"  Entry {applied + skipped}: No valid index, using sequential position")
            
            # Verificar que el índice es válido
            if not isinstance(idx, int) or idx < 0 or idx >= len(self.name_entries):
                skipped += 1
                self.log(f"  ✗ Entry {idx}: Index out of range (max: {len(self.name_entries)-1})")
                continue
            
            # Obtener la entrada directamente por índice (como el cambio manual)
            entry = self.name_entries[idx]
            
            # Verificar que tiene partes
            if "parts" not in gen_entry:
                skipped += 1
                self.log(f"  ✗ Entry {idx}: No 'parts' field in generated data")
                continue
            
            # Aplicar los cambios directamente (igual que apply_changes)
            old_parts = entry.parts.copy()
            new_parts = gen_entry["parts"]
            
            # Determinar el número correcto de partes según el tipo de tag
            if entry.tag_type in ["NAME", "CASTE_NAME"]:
                # NAME y CASTE_NAME: formato singular:plural:adjective (3 partes máximo)
                max_parts = 3
            elif entry.tag_type == "GENERAL_CHILD_NAME":
                # GENERAL_CHILD_NAME: formato singular:plural (2 partes máximo)
                max_parts = 2
            elif entry.tag_type in ["NOUN", "ADJ"]:
                # NOUN: singular:plural (2 partes), ADJ: adjective (1 parte)
                max_parts = 2 if entry.tag_type == "NOUN" else 1
            elif entry.tag_type == "T_WORD":
                # T_WORD: english:translation (2 partes)
                max_parts = 2
            elif entry.tag_type in ["STATE_NAME_ADJ", "STATE_NAME"]:
                # STATE_NAME_ADJ y STATE_NAME: solo 1 parte (el nombre)
                max_parts = 1
            elif entry.tag_type == "SQUAD":
                # SQUAD: number:singular:plural (3 partes mínimo)
                max_parts = max(3, len(entry.parts))
            elif entry.tag_type == "PLANT_NAME":
                # PLANT_NAME: name:plural:adjective (3 partes)
                max_parts = 3
            else:
                # Por defecto, usar el número de partes original
                max_parts = len(entry.parts)
            
            # Ajustar número de partes al formato correcto
            if len(new_parts) >= max_parts:
                entry.parts = new_parts[:max_parts]
            elif len(new_parts) > 0:
                # Si tenemos menos partes de las necesarias, completar con las originales
                entry.parts = new_parts + entry.parts[len(new_parts):max_parts]
            else:
                # Si no hay partes nuevas, mantener las originales
                entry.parts = entry.parts[:max_parts]
            
            self.log(f"     Format: {entry.tag_type} requires {max_parts} parts")
            self.log(f"     Received {len(new_parts)} parts, using {len(entry.parts)} parts")
            
            # Marcar como modificada (igual que el cambio manual)
            entry.modified = True
            applied += 1
            
            file_name = Path(entry.file_path).name
            self.log(f"  ✓ Entry {idx}: {file_name}:{entry.line_num} - {entry.tag_type}")
            self.log(f"     OLD: {':'.join(old_parts)}")
            self.log(f"     NEW: {':'.join(entry.parts)}")
            self.log(f"     Modified: {entry.modified}")
            self.log("")
        
        # Verificar cuántas entradas quedaron modificadas
        actually_modified = [e for e in self.name_entries if e.modified]
        
        # Contar cuántos archivos se modificarán
        modified_files = set()
        for entry in self.name_entries:
            if entry.modified:
                modified_files.add(entry.file_path)
        
        self.update_tree()
        self.log("")
        self.log(f"SUCCESS: Applied {applied} names, skipped {skipped}")
        self.log(f"Actually modified entries: {len(actually_modified)}")
        self.log(f"Modified entries in {len(modified_files)} file(s)")
        for f in modified_files:
            self.log(f"  - {Path(f).name}")
        self.log("=" * 60)
        
        if applied == 0:
            result_msg = f"⚠️ ADVERTENCIA: No se aplicaron cambios.\n\n"
            result_msg += f"Generados: {len(generated)} entradas\n"
            result_msg += f"Aplicados: {applied}\n"
            result_msg += f"Omitidos: {skipped}\n\n"
            result_msg += "Revisa los logs para ver qué pasó."
            messagebox.showwarning("Advertencia", result_msg)
        else:
            result_msg = f"✅ Aplicados {applied} nombres ({skipped} omitidos)\n\n"
            result_msg += f"Archivos que se modificarán: {len(modified_files)}\n"
            result_msg += "\n⚠️ IMPORTANTE: Los cambios están en memoria.\n"
            result_msg += "Haz clic en '💾 Guardar Cambios' para escribir los archivos al disco."
            messagebox.showinfo("Éxito", result_msg)
    
    def apply_ai_to_texts(self):
        """Aplica los textos generados por AI - ENFOQUE SIMPLE como cambio manual"""
        if not self.ai_generated_data.get("texts"):
            messagebox.showwarning("Advertencia", "No hay textos generados. Genera primero.")
            return
        
        self.log("=" * 60)
        self.log("APPLYING AI-GENERATED TEXTS (Simple Direct Approach)...")
        generated = self.ai_generated_data["texts"]
        self.log(f"Total generated entries: {len(generated)}")
        self.log(f"Total loaded entries: {len(self.text_entries)}")
        
        applied = 0
        skipped = 0
        
        # ENFOQUE SIMPLE: Aplicar directamente por índice
        for gen_entry in generated:
            # Obtener índice
            idx = None
            if "index" in gen_entry:
                try:
                    idx = int(gen_entry["index"])
                except (ValueError, TypeError):
                    idx = None
            
            # Si no hay índice válido, usar orden secuencial
            if idx is None:
                idx = applied + skipped
                self.log(f"  Entry {applied + skipped}: No valid index, using sequential position")
            
            # Verificar que el índice es válido
            if not isinstance(idx, int) or idx < 0 or idx >= len(self.text_entries):
                skipped += 1
                self.log(f"  ✗ Entry {idx}: Index out of range (max: {len(self.text_entries)-1})")
                continue
            
            # Obtener la entrada directamente por índice
            entry = self.text_entries[idx]
            
            # Verificar que tiene texto
            if "text" not in gen_entry:
                skipped += 1
                self.log(f"  ✗ Entry {idx}: No 'text' field in generated data")
                continue
            
            # Aplicar el cambio directamente
            old_text = entry.text
            new_text = gen_entry["text"].strip()  # Limpiar espacios
            
            # Verificar que el texto realmente cambió
            if new_text == old_text:
                skipped += 1
                self.log(f"  ⚠ Entry {idx}: Generated text is identical to original, skipping")
                self.log(f"     Text: {old_text[:80]}...")
                continue
            
            # Aplicar el nuevo texto
            entry.text = new_text
            entry.modified = True
            applied += 1
            
            file_name = Path(entry.file_path).name
            self.log(f"  ✓ Entry {idx}: {file_name}:{entry.line_num} - {entry.text_set}")
            self.log(f"     OLD: {old_text[:80]}...")
            self.log(f"     NEW: {new_text[:80]}...")
            self.log(f"     Modified: {entry.modified}")
            self.log("")
        
        # Verificar cuántas entradas quedaron modificadas
        actually_modified = [e for e in self.text_entries if e.modified]
        
        # Contar cuántos archivos se modificarán
        modified_files = set()
        for entry in self.text_entries:
            if entry.modified:
                modified_files.add(entry.file_path)
        
        self.update_text_tree()
        self.log("")
        self.log(f"SUCCESS: Applied {applied} texts, skipped {skipped}")
        self.log(f"Actually modified entries: {len(actually_modified)}")
        self.log(f"Modified entries in {len(modified_files)} file(s)")
        for f in modified_files:
            self.log(f"  - {Path(f).name}")
        self.log("=" * 60)
        
        if applied == 0:
            result_msg = f"⚠️ ADVERTENCIA: No se aplicaron cambios.\n\n"
            result_msg += f"Generados: {len(generated)} entradas\n"
            result_msg += f"Aplicados: {applied}\n"
            result_msg += f"Omitidos: {skipped}\n\n"
            result_msg += "Revisa los logs para ver qué pasó."
            messagebox.showwarning("Advertencia", result_msg)
        else:
            result_msg = f"✅ Aplicadas {applied} frases ({skipped} omitidas)\n\n"
            result_msg += f"Archivos que se modificarán: {len(modified_files)}\n"
            result_msg += "\n⚠️ IMPORTANTE: Los cambios están en memoria.\n"
            result_msg += "Haz clic en '💾 Guardar Cambios' para escribir los archivos al disco."
            messagebox.showinfo("Éxito", result_msg)

def main():
    root = tk.Tk()
    app = DFNameEditor(root)
    root.mainloop()

if __name__ == "__main__":
    main()
