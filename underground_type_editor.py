#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Underground Regions Type Editor
Edita el campo "type" en "underground_regions" de archivos JSON usando AI
Basado en df_name_editor.py pero especializado para tipos de regiones subterráneas
"""

import os
import re
import json
import requests
import threading
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

class UndergroundRegionEntry:
    """Representa una entrada de underground region"""
    def __init__(self, file_path: str, region_id: str, original_type: str, 
                 coords: str = "", depth: str = "", context: Dict = None):
        self.file_path = file_path
        self.region_id = region_id
        self.original_type = original_type
        self.type = original_type  # Tipo actual (puede ser modificado)
        self.coords = coords
        self.depth = depth
        self.context = context or {}  # Datos adicionales del objeto
        self.modified = False
        self.entry_id = id(self)

class UndergroundTypeEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Underground Regions Type Editor - AI Powered")
        self.root.geometry("1600x1000")
        self.root.minsize(1200, 700)
        
        # Cargar configuración API
        self.load_api_config()
        
        self.entries: List[UndergroundRegionEntry] = []
        self.entry_dict: Dict[int, UndergroundRegionEntry] = {}
        self.current_file_path = None
        
        self.create_ui()
        
    def load_api_config(self):
        """Carga la configuración de la API"""
        config_path = Path("config_api.json")
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    self.api_key = config.get("deepseek_api_key", "")
                    self.model = config.get("deepseek_model", "deepseek-chat")
                    self.api_url = config.get("deepseek_base_url", "https://api.deepseek.com/v1/chat/completions")
            except Exception as e:
                print(f"Error cargando config: {e}")
                self.api_key = ""
                self.model = "deepseek-chat"
                self.api_url = "https://api.deepseek.com/v1/chat/completions"
        else:
            self.api_key = ""
            self.model = "deepseek-chat"
            self.api_url = "https://api.deepseek.com/v1/chat/completions"
    
    def save_api_config(self):
        """Guarda la configuración de la API"""
        config_path = Path("config_api.json")
        config = {
            "deepseek_api_key": self.api_key_var.get(),
            "deepseek_model": self.model_var.get(),
            "deepseek_base_url": self.api_url
        }
        try:
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            self.api_key = config["deepseek_api_key"]
            self.model = config["deepseek_model"]
            messagebox.showinfo("Éxito", "Configuración guardada")
        except Exception as e:
            messagebox.showerror("Error", f"Error guardando configuración: {e}")
    
    def create_ui(self):
        # Frame superior de control
        control_frame = ttk.Frame(self.root, padding="10")
        control_frame.pack(fill=tk.X)
        
        ttk.Button(control_frame, text="📁 Seleccionar Archivo JSON", 
                  command=self.select_json_file).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="🔄 Cargar Archivo", 
                  command=self.load_json_file).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="💾 Guardar Cambios", 
                  command=self.save_changes).pack(side=tk.LEFT, padx=5)
        
        self.status_label = ttk.Label(control_frame, text="Listo - Selecciona y carga un archivo JSON")
        self.status_label.pack(side=tk.LEFT, padx=20)
        
        # Frame principal con Notebook (pestañas)
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Pestaña 1: Editor de Tipos
        editor_frame = ttk.Frame(notebook)
        notebook.add(editor_frame, text="📝 Editor de Tipos")
        
        # Pestaña 2: AI Generator
        ai_frame = ttk.Frame(notebook)
        notebook.add(ai_frame, text="🤖 AI Generator")
        
        # ========== PESTAÑA EDITOR ==========
        main_frame = ttk.PanedWindow(editor_frame, orient=tk.HORIZONTAL)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Panel izquierdo - Lista de entradas
        left_panel = ttk.Frame(main_frame)
        main_frame.add(left_panel, weight=1)
        
        ttk.Label(left_panel, text="Regiones Subterráneas:").pack(anchor=tk.W, padx=5, pady=5)
        
        tree_frame = ttk.Frame(left_panel)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        scrollbar_tree = ttk.Scrollbar(tree_frame)
        scrollbar_tree.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.tree = ttk.Treeview(tree_frame, yscrollcommand=scrollbar_tree.set,
                                 columns=("ID", "Tipo Original", "Tipo Actual"), show="tree headings")
        self.tree.heading("#0", text="Región")
        self.tree.heading("ID", text="ID")
        self.tree.heading("Tipo Original", text="Tipo Original")
        self.tree.heading("Tipo Actual", text="Tipo Actual")
        self.tree.column("#0", width=150)
        self.tree.column("ID", width=80)
        self.tree.column("Tipo Original", width=150)
        self.tree.column("Tipo Actual", width=150)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_tree.config(command=self.tree.yview)
        
        self.tree.bind("<<TreeviewSelect>>", self.on_select)
        
        # Panel derecho - Editor
        right_panel = ttk.Frame(main_frame)
        main_frame.add(right_panel, weight=2)
        
        # Info
        info_frame = ttk.LabelFrame(right_panel, text="Información", padding="10")
        info_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.info_text = scrolledtext.ScrolledText(info_frame, height=8, wrap=tk.WORD)
        self.info_text.pack(fill=tk.X)
        
        # Editor
        edit_frame = ttk.LabelFrame(right_panel, text="Editar Tipo", padding="10")
        edit_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        ttk.Label(edit_frame, text="Tipo:").pack(anchor=tk.W, padx=5, pady=5)
        self.type_var = tk.StringVar()
        type_entry = ttk.Entry(edit_frame, textvariable=self.type_var, width=50)
        type_entry.pack(fill=tk.X, padx=5, pady=5)
        
        # Botones
        button_frame = ttk.Frame(edit_frame)
        button_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(button_frame, text="✅ Aplicar", 
                  command=self.apply_changes).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="↩️ Restaurar", 
                  command=self.restore_original).pack(side=tk.LEFT, padx=5)
        
        self.current_entry = None
        
        # ========== PESTAÑA AI GENERATOR ==========
        # Canvas con scrollbar para toda la pestaña AI
        ai_canvas_frame = ttk.Frame(ai_frame)
        ai_canvas_frame.pack(fill=tk.BOTH, expand=True)
        
        ai_canvas = tk.Canvas(ai_canvas_frame)
        ai_scrollbar = ttk.Scrollbar(ai_canvas_frame, orient="vertical", command=ai_canvas.yview)
        ai_scrollable_frame = ttk.Frame(ai_canvas)
        
        canvas_window = ai_canvas.create_window((0, 0), window=ai_scrollable_frame, anchor="nw")
        ai_canvas.configure(yscrollcommand=ai_scrollbar.set)
        
        def update_scroll_region(event=None):
            ai_canvas.update_idletasks()
            ai_canvas.configure(scrollregion=ai_canvas.bbox("all"))
        
        ai_scrollable_frame.bind("<Configure>", update_scroll_region)
        
        def configure_canvas_width(event):
            canvas_width = event.width
            ai_canvas.itemconfig(canvas_window, width=canvas_width)
        ai_canvas.bind("<Configure>", configure_canvas_width)
        
        ai_canvas.pack(side="left", fill="both", expand=True)
        ai_scrollbar.pack(side="right", fill="y")
        
        def _on_mousewheel(event):
            if event.delta:
                ai_canvas.yview_scroll(int(-1*(event.delta/120)), "units")
            else:
                if event.num == 4:
                    ai_canvas.yview_scroll(-1, "units")
                elif event.num == 5:
                    ai_canvas.yview_scroll(1, "units")
        
        ai_canvas.bind("<MouseWheel>", _on_mousewheel)
        ai_canvas.bind("<Button-4>", _on_mousewheel)
        ai_canvas.bind("<Button-5>", _on_mousewheel)
        
        self.ai_canvas = ai_canvas
        self.ai_scrollable_frame = ai_scrollable_frame
        ai_main_frame = ai_scrollable_frame
        
        # Panel superior: Configuración
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
        
        # Batch configuration
        batch_frame = ttk.Frame(ai_top_frame)
        batch_frame.pack(fill=tk.X, pady=5)
        ttk.Label(batch_frame, text="Entries per batch:").pack(side=tk.LEFT, padx=5)
        self.batch_size_var = tk.StringVar(value="50")
        batch_entry = ttk.Entry(batch_frame, textvariable=self.batch_size_var, width=10)
        batch_entry.pack(side=tk.LEFT, padx=5)
        ttk.Label(batch_frame, text="Max batches:").pack(side=tk.LEFT, padx=5)
        self.max_batches_var = tk.StringVar(value="20")
        max_batch_entry = ttk.Entry(batch_frame, textvariable=self.max_batches_var, width=10)
        max_batch_entry.pack(side=tk.LEFT, padx=5)
        
        self.batch_info_label = ttk.Label(batch_frame, text="(Will process up to 1000 entries)", 
                                          foreground="gray")
        self.batch_info_label.pack(side=tk.LEFT, padx=10)
        
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
        
        # Prompt del usuario - MULTIPLE PROMPTS (uno por línea)
        prompt_frame = ttk.LabelFrame(ai_main_frame, text="Your Creative Prompts (One per line - for variety)", padding="10")
        prompt_frame.pack(fill=tk.BOTH, expand=True, pady=5, padx=10)
        
        ttk.Label(prompt_frame, text="Enter multiple prompts, one per line. Each batch will use a different prompt for variety:").pack(anchor=tk.W, padx=5, pady=5)
        ttk.Label(prompt_frame, text="Example:\nmythical places and philosophical concepts\nabstract territories and speculative spaces\ndeep psychological landscapes", 
                 foreground="gray", font=("Arial", 8)).pack(anchor=tk.W, padx=5, pady=2)
        
        self.user_prompt_text = scrolledtext.ScrolledText(prompt_frame, height=8, wrap=tk.WORD)
        self.user_prompt_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Configuración de concurrencia
        concurrency_frame = ttk.Frame(ai_top_frame)
        concurrency_frame.pack(fill=tk.X, pady=5)
        ttk.Label(concurrency_frame, text="Concurrent API calls:").pack(side=tk.LEFT, padx=5)
        self.concurrency_var = tk.StringVar(value="5")
        concurrency_entry = ttk.Entry(concurrency_frame, textvariable=self.concurrency_var, width=10)
        concurrency_entry.pack(side=tk.LEFT, padx=5)
        ttk.Label(concurrency_frame, text="(Number of parallel HTTP calls to API for faster processing)", 
                 foreground="gray", font=("Arial", 8)).pack(side=tk.LEFT, padx=5)
        
        # Botones de acción
        ai_button_frame = ttk.Frame(prompt_frame)
        ai_button_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(ai_button_frame, text="🎨 Generate Types with AI", 
                  command=self.generate_types_with_ai).pack(side=tk.LEFT, padx=5)
        
        # Panel de resultados
        result_frame = ttk.LabelFrame(ai_main_frame, text="AI Generated Results", padding="10")
        result_frame.pack(fill=tk.BOTH, expand=True, pady=5, padx=10)
        
        self.ai_result_text = scrolledtext.ScrolledText(result_frame, height=12, wrap=tk.WORD)
        self.ai_result_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Botones de aplicación
        apply_frame = ttk.Frame(result_frame)
        apply_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(apply_frame, text="✅ Apply Generated Types", 
                  command=self.apply_ai_types).pack(side=tk.LEFT, padx=5)
        ttk.Button(apply_frame, text="💾 Save All Changes", 
                  command=self.save_changes).pack(side=tk.LEFT, padx=5)
        
        # Panel de logs
        log_frame = ttk.LabelFrame(ai_main_frame, text="Activity Logs", padding="10")
        log_frame.pack(fill=tk.BOTH, expand=True, pady=5, padx=10)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=12, wrap=tk.WORD, 
                                                   font=("Consolas", 9))
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.log_text.config(state=tk.DISABLED)
        
        self.ai_generated_data = []
        
        # Inicializar log
        self.log("Underground Regions Type Editor - AI Generator initialized")
        self.log("Ready to load JSON file and generate types")
    
    def log(self, message: str):
        """Agrega un mensaje al log (thread-safe)"""
        try:
            if hasattr(self, 'log_text') and self.log_text.winfo_exists():
                self.root.after(0, self._log_safe, message)
            else:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] {message}")
        except:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {message}")
    
    def _log_safe(self, message: str):
        """Agrega mensaje al log de forma segura"""
        try:
            if hasattr(self, 'log_text') and self.log_text.winfo_exists():
                self.log_text.config(state=tk.NORMAL)
                timestamp = datetime.now().strftime("%H:%M:%S")
                self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
                self.log_text.see(tk.END)
                self.log_text.config(state=tk.DISABLED)
        except Exception as e:
            print(f"Error logging: {e} - {message}")
    
    def select_json_file(self):
        """Selecciona un archivo JSON"""
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo JSON",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if file_path:
            self.current_file_path = file_path
            self.status_label.config(text=f"Archivo seleccionado: {Path(file_path).name}")
    
    def load_json_file(self):
        """Carga un archivo JSON y parsea underground_regions"""
        if not self.current_file_path:
            messagebox.showwarning("Advertencia", "Selecciona un archivo JSON primero")
            return
        
        file_path = Path(self.current_file_path)
        if not file_path.exists():
            messagebox.showerror("Error", f"El archivo no existe: {file_path}")
            return
        
        self.log("=" * 60)
        self.log(f"Loading JSON file: {file_path.name}")
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                data = json.load(f)
            
            self.entries = []
            self.entry_dict = {}
            
            # Buscar underground_regions en el JSON
            if "underground_regions" in data and isinstance(data["underground_regions"], list):
                self.log(f"Found {len(data['underground_regions'])} underground regions")
                
                for region in data["underground_regions"]:
                    region_id = region.get("id", "unknown")
                    region_type = region.get("type", "")
                    coords = region.get("coords", "")
                    depth = region.get("depth", "")
                    
                    entry = UndergroundRegionEntry(
                        str(file_path),
                        region_id,
                        region_type,
                        coords,
                        depth,
                        region  # Guardar el contexto completo
                    )
                    entry.entry_id = len(self.entries)
                    self.entries.append(entry)
                    self.entry_dict[entry.entry_id] = entry
                    
                    self.log(f"  Loaded region ID {region_id}: type='{region_type}', depth={depth}")
            else:
                self.log("WARNING: No 'underground_regions' key found in JSON or it's not a list")
                messagebox.showwarning("Advertencia", "No se encontró 'underground_regions' en el JSON")
                return
            
            self.update_tree()
            self.log(f"SUCCESS: Loaded {len(self.entries)} underground regions")
            self.log("=" * 60)
            self.status_label.config(text=f"✅ Cargadas {len(self.entries)} regiones subterráneas")
            
        except json.JSONDecodeError as e:
            error_msg = f"Error parseando JSON: {e}"
            self.log(f"ERROR: {error_msg}")
            messagebox.showerror("Error", error_msg)
        except Exception as e:
            error_msg = f"Error cargando archivo: {e}"
            self.log(f"ERROR: {error_msg}")
            messagebox.showerror("Error", error_msg)
    
    def update_tree(self):
        """Actualiza el árbol de entradas"""
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        for entry in self.entries:
            # Determinar color basado en si está modificado
            tags = ()
            if entry.modified:
                tags = ("modified",)
            
            display_text = f"Region {entry.region_id}"
            item_id = self.tree.insert("", tk.END, text=display_text,
                                     values=(entry.region_id, entry.original_type, entry.type),
                                     tags=tags)
            
            # Configurar color para modificados
            if entry.modified:
                self.tree.set(item_id, "Tipo Actual", f"✏️ {entry.type}")
        
        # Configurar tag colors
        self.tree.tag_configure("modified", foreground="blue")
    
    def on_select(self, event):
        """Cuando se selecciona una entrada"""
        selection = self.tree.selection()
        if not selection:
            return
        
        item = selection[0]
        values = self.tree.item(item, "values")
        if values:
            region_id = values[0]
            # Buscar la entrada por ID
            for entry in self.entries:
                if entry.region_id == region_id:
                    self.show_entry(entry)
                    break
    
    def show_entry(self, entry: UndergroundRegionEntry):
        """Muestra y permite editar una entrada"""
        self.current_entry = entry
        
        # Info
        info = f"Archivo: {Path(entry.file_path).name}\n"
        info += f"ID: {entry.region_id}\n"
        info += f"Tipo Original: {entry.original_type}\n"
        info += f"Tipo Actual: {entry.type}\n"
        info += f"Profundidad: {entry.depth}\n"
        info += f"Coordenadas: {entry.coords[:100]}..." if len(entry.coords) > 100 else f"Coordenadas: {entry.coords}\n"
        info += f"Modificado: {'Sí' if entry.modified else 'No'}\n"
        
        self.info_text.delete(1.0, tk.END)
        self.info_text.insert(1.0, info)
        
        # Editor
        self.type_var.set(entry.type)
    
    def apply_changes(self):
        """Aplica cambios a la entrada actual"""
        if not self.current_entry:
            return
        
        new_type = self.type_var.get().strip()
        if not new_type:
            messagebox.showwarning("Advertencia", "El tipo no puede estar vacío")
            return
        
        self.current_entry.type = new_type
        self.current_entry.modified = True
        
        self.update_tree()
        messagebox.showinfo("Éxito", "Cambio aplicado (guarda el archivo)")
    
    def restore_original(self):
        """Restaura el tipo original"""
        if not self.current_entry:
            return
        
        self.current_entry.type = self.current_entry.original_type
        self.current_entry.modified = False
        
        self.type_var.set(self.current_entry.type)
        self.update_tree()
        messagebox.showinfo("Éxito", "Tipo restaurado")
    
    def call_deepseek_api(self, system_prompt: str, user_prompt: str, api_key: str = None, model: str = None) -> str:
        """Llama a la API de DeepSeek (thread-safe)"""
        # Si api_key y model no se pasan, obtenerlos (solo en thread principal)
        if api_key is None or model is None:
            # En threads paralelos, estos deberían pasarse siempre
            pass
        
        if not api_key:
            self.log("ERROR: API Key no configurada")
            return ""
        
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
            "temperature": 0.8,
            "max_tokens": 8000
        }
        
        try:
            response = requests.post(self.api_url, headers=headers, json=data, timeout=120)
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            return content
        except Exception as e:
            error_msg = f"Error llamando a DeepSeek API: {e}"
            self.log(f"ERROR: {error_msg}")
            return ""
    
    def generate_types_with_ai(self):
        """Genera tipos usando AI con batch processing y múltiples prompts"""
        user_prompt_text = self.user_prompt_text.get(1.0, tk.END).strip()
        if not user_prompt_text:
            messagebox.showwarning("Advertencia", "Escribe al menos un prompt primero (uno por línea)")
            return
        
        if not self.entries:
            messagebox.showwarning("Advertencia", "Carga un archivo JSON primero")
            return
        
        # Parsear múltiples prompts (uno por línea)
        prompts = [line.strip() for line in user_prompt_text.split('\n') if line.strip()]
        if not prompts:
            messagebox.showwarning("Advertencia", "Escribe al menos un prompt válido (uno por línea)")
            return
        
        try:
            batch_size = int(self.batch_size_var.get())
            max_batches = int(self.max_batches_var.get())
            concurrency = int(self.concurrency_var.get())
        except:
            batch_size = 50
            max_batches = 20
            concurrency = 5
        
        self.log(f"Loaded {len(prompts)} prompt(s) for variety")
        
        thread = threading.Thread(target=self._generate_types_with_ai_thread, 
                                  args=(prompts, batch_size, max_batches, concurrency), daemon=True)
        thread.start()
    
    def _process_single_batch(self, batch_num, start_idx, end_idx, prompt, api_key, model, system_prompt, total_entries, num_batches):
        """Procesa un solo batch - puede ser llamado en paralelo desde múltiples threads"""
        batch_entries = self.entries[start_idx:end_idx]
        
        # Crear información compacta
        entries_info = []
        for i, entry in enumerate(batch_entries):
            idx = start_idx + i
            entries_info.append({
                "i": idx,
                "id": entry.region_id,
                "type": entry.original_type,
                "depth": entry.depth
            })
        
        # Prompt optimizado usando el prompt específico para este batch
        user_prompt_full = f"""Theme: {prompt}

Generate {len(entries_info)} underground region types as LONG DESCRIPTIVE PHRASES OR PARAGRAPHS (20-150+ words each, even larger with more words and new lines, like descriptive writing).

Return JSON array with EXACT format:
[{{"index": {start_idx}, "region_id": "0", "type": "a long descriptive phrase or paragraph describing the underground region", "original_type": "cavern"}}, ...]

EXAMPLES of what you should generate (or even larger, with more words and new lines):
- "a chamber where whispers from medieval heads map abstract organic structures across flat surfaces that echo with the voices of entities beyond human comprehension"
- "the place where skin crawlers with transcendental layers refuse to dance while holding golden treasures that burn with the fire of a thousand suns hidden in their depths"
- "a cavern where linguistic theories crawl over cold carpets in holes that are also warm because they are information itself made manifest as physical matter"
- "the territory where dwarf heads whisper secrets about layers in a skin crawler that mints tokens of memory and forgetfulness in equal measure"

Entries (i=index, id=region_id, type=current_type, depth=depth):
{json.dumps(entries_info, separators=(',', ':'), ensure_ascii=False)}

CRITICAL REQUIREMENTS:
1. Return EXACT "index" and "region_id" from input
2. Generate LONG descriptive phrases/paragraphs (20-150+ words, even larger), NOT short names like "mythical_cavern"
3. Can include newlines for longer, more elaborate descriptions
4. Write in lowercase, natural language, poetic and descriptive
5. Each type should read like a sentence or paragraph describing a place in a story
6. Follow the creative theme: {prompt}
7. Be creative and varied - each region should have unique, elaborate description"""
        
        self.log(f"Batch {batch_num + 1}/{num_batches} starting API call (using prompt: '{prompt[:50]}...')")
        batch_start_time = time.time()
        result = self.call_deepseek_api(system_prompt, user_prompt_full, api_key, model)
        batch_elapsed = time.time() - batch_start_time
        
        parsed_results = []
        if result:
            try:
                json_match = re.search(r'\[.*\]', result, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    parsed = json.loads(json_str)
                    parsed_results = parsed
                    self.log(f"✓ Batch {batch_num + 1}: Parsed {len(parsed)} entries successfully ({batch_elapsed:.1f}s)")
                else:
                    self.log(f"⚠ WARNING: Batch {batch_num + 1}: No JSON found in response ({batch_elapsed:.1f}s)")
            except Exception as e:
                self.log(f"✗ ERROR: Batch {batch_num + 1}: Failed to parse JSON - {e} ({batch_elapsed:.1f}s)")
        else:
            self.log(f"✗ ERROR: Batch {batch_num + 1}: No result from API ({batch_elapsed:.1f}s)")
        
        return batch_num, parsed_results
    
    def _generate_types_with_ai_thread(self, prompts: List[str], batch_size: int, max_batches: int, concurrency: int):
        """Genera tipos en thread separado con llamadas HTTP concurrentes"""
        
        self.log(f"Starting type generation with batch_size={batch_size}, max_batches={max_batches}, concurrency={concurrency}")
        self.log(f"Using {len(prompts)} different prompt(s) for variety")
        self.root.after(0, lambda: self.status_label.config(text="Generando tipos con AI..."))
        
        all_generated = []
        total_entries = len(self.entries)
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
        self.log(f"  Concurrent API calls: {concurrency}")
        self.log(f"  Prompts available: {len(prompts)}")
        self.log(f"  Entries to process: {actual_processable:,} ({100*actual_processable/total_entries:.1f}% of total)")
        if actual_processable < total_entries:
            self.log(f"  ⚠ WARNING: {total_entries - actual_processable:,} entries will NOT be processed")
        self.log(f"=" * 60)
        
        try:
            api_key = self.api_key_var.get() if hasattr(self, 'api_key_var') else self.api_key
            model = self.model_var.get() if hasattr(self, 'model_var') else self.model
        except:
            api_key = self.api_key if hasattr(self, 'api_key') else ""
            model = self.model if hasattr(self, 'model') else "deepseek-chat"
        
        # Prompt del sistema optimizado - GENERA FRASES/PÁRRAFOS LARGOS, NO NOMBRES CORTOS
        system_prompt = """You are a creative writer for underground regions in a fantasy/speculative world. Generate LONG DESCRIPTIVE PHRASES OR PARAGRAPHS (like descriptive writing, not short names) for underground territories.

FORMAT: Return ONLY JSON array. Each object: {"index": N, "region_id": "ID", "type": "long descriptive phrase or paragraph", "original_type": "old_type"}

CRITICAL RULES:
- Generate LONG descriptive phrases or short paragraphs (20-150+ words, even larger with more words and new lines), NOT short names
- Examples of GOOD formats (or even larger):
  * "a cavern where daggers forged from meteoric iron bypass magical protections and ancient curses lie embedded in the crystalline walls that whisper forgotten languages to those who dare to listen"
  * "a candle whose smoke induces permanent sleep within crystalline formations that glow with the memories of those who have entered this realm of eternal dreaming"
  * "the whispering chamber where medieval heads speak secrets to abstract morphologies that map themselves across the flat surfaces of entities beyond human comprehension"
  * "the organic map structure where navigation surfaces become entities that crawl and whisper secrets about the deep structures of reality itself"
  * "the place where skin crawlers with transcendental layers dance with golden treasures while refusing to return home because the state has abandoned them"
- Write in lowercase, use natural language, be poetic and descriptive
- Each type should be a COMPLETE DESCRIPTIVE PHRASE OR PARAGRAPH, like narrative writing
- Can include newlines for longer descriptions
- Match entry count EXACTLY. Include exact "index" and "region_id" from input.
- Follow user's creative theme. Write as if describing a location in a story."""
        
        # Preparar batches con prompts rotativos para variedad
        batch_tasks = []
        for batch_num in range(num_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, total_entries)
            # Rotar prompts para variedad
            prompt = prompts[batch_num % len(prompts)]
            batch_tasks.append((batch_num, start_idx, end_idx, prompt))
        
        # Procesar batches concurrentemente usando ThreadPoolExecutor - MÚLTIPLES LLAMADAS EN PARALELO
        self.log(f"=" * 70)
        self.log(f"Starting CONCURRENT processing of {num_batches} batches")
        self.log(f"  → Maximum {concurrency} parallel HTTP API calls at the same time")
        self.log(f"  → Batches will be processed SIMULTANEOUSLY, NOT sequentially")
        self.log(f"  → This will be MUCH faster than processing one by one")
        self.log(f"=" * 70)
        start_time = time.time()
        
        results_dict = {}  # Dict para mantener orden: {batch_num: results}
        
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            # Enviar TODOS los batches al mismo tiempo - ThreadPoolExecutor gestiona la concurrencia
            # Solo {concurrency} batches se ejecutarán simultáneamente, los demás esperarán en cola
            self.log(f"Submitting all {num_batches} batches to thread pool executor...")
            future_to_batch = {}
            for batch_num, start_idx, end_idx, prompt in batch_tasks:
                future = executor.submit(
                    self._process_single_batch, 
                    batch_num, start_idx, end_idx, prompt, 
                    api_key, model, system_prompt, 
                    total_entries, num_batches
                )
                future_to_batch[future] = batch_num
            
            self.log(f"  ✓ All {num_batches} batches submitted successfully")
            self.log(f"  → ThreadPoolExecutor will execute up to {concurrency} batches concurrently")
            self.log(f"  → Remaining batches will wait in queue and start as slots become available")
            self.log("")
            
            # Recolectar resultados conforme completan (en cualquier orden)
            # as_completed() devuelve futures conforme terminan, sin importar el orden
            completed = 0
            remaining = len(future_to_batch)
            
            for future in as_completed(future_to_batch):
                batch_num = future_to_batch[future]
                completed += 1
                remaining -= 1
                try:
                    batch_num_result, parsed_results = future.result()
                    results_dict[batch_num_result] = parsed_results
                    self.log(f"✓ Completed batch {batch_num_result + 1}/{num_batches} ({completed}/{len(future_to_batch)} done, {remaining} still processing)")
                except Exception as e:
                    import traceback
                    self.log(f"✗ ERROR: Batch {batch_num + 1} raised exception: {e}")
                    self.log(f"  Traceback: {traceback.format_exc()}")
        
        # Ordenar resultados por batch_num para mantener orden
        for batch_num in sorted(results_dict.keys()):
            all_generated.extend(results_dict[batch_num])
        
        elapsed_time = time.time() - start_time
        self.log(f"All batches completed in {elapsed_time:.2f} seconds ({num_batches} batches with {concurrency} concurrent calls)")
        
        # Mostrar resultados
        def show_results():
            if all_generated:
                result_text = json.dumps(all_generated, indent=2, ensure_ascii=False)
                self.ai_result_text.delete(1.0, tk.END)
                self.ai_result_text.insert(1.0, result_text)
                self.ai_generated_data = all_generated
                self.log(f"SUCCESS: Generated {len(all_generated)} types total in {elapsed_time:.2f}s")
                messagebox.showinfo("Éxito", f"Generados {len(all_generated)} tipos en {num_batches} batches ({elapsed_time:.1f}s). Revisa y aplica.")
            else:
                self.log("ERROR: No types were generated")
                messagebox.showwarning("Advertencia", "No se generaron tipos. Revisa los logs.")
            
            self.status_label.config(text="Listo")
        
        self.root.after(0, show_results)
    
    def apply_ai_types(self):
        """Aplica los tipos generados por AI"""
        if not self.ai_generated_data:
            messagebox.showwarning("Advertencia", "No hay tipos generados. Genera primero.")
            return
        
        self.log("=" * 60)
        self.log("APPLYING AI-GENERATED TYPES...")
        generated = self.ai_generated_data
        self.log(f"Total generated entries: {len(generated)}")
        self.log(f"Total loaded entries: {len(self.entries)}")
        
        applied = 0
        skipped = 0
        
        # Crear mapa por region_id para búsqueda rápida
        entries_by_id = {entry.region_id: entry for entry in self.entries}
        
        for gen_entry in generated:
            region_id = gen_entry.get("region_id")
            
            if not region_id:
                skipped += 1
                self.log(f"  ✗ Entry: No 'region_id' field")
                continue
            
            entry = entries_by_id.get(region_id)
            if not entry:
                skipped += 1
                self.log(f"  ✗ Region ID {region_id}: Not found in loaded entries")
                continue
            
            if "type" not in gen_entry:
                skipped += 1
                self.log(f"  ✗ Region ID {region_id}: No 'type' field")
                continue
            
            old_type = entry.type
            new_type = gen_entry["type"].strip()
            
            if not new_type:
                skipped += 1
                self.log(f"  ✗ Region ID {region_id}: Empty type")
                continue
            
            entry.type = new_type
            entry.modified = True
            applied += 1
            
            self.log(f"  ✓ Region ID {region_id}: '{old_type}' → '{new_type}'")
        
        self.update_tree()
        self.log("")
        self.log(f"SUCCESS: Applied {applied} types, skipped {skipped}")
        self.log("=" * 60)
        
        if applied == 0:
            messagebox.showwarning("Advertencia", "No se aplicaron cambios. Revisa los logs.")
        else:
            result_msg = f"✅ Aplicados {applied} tipos ({skipped} omitidos)\n\n"
            result_msg += "⚠️ IMPORTANTE: Los cambios están en memoria.\n"
            result_msg += "Haz clic en '💾 Guardar Cambios' para escribir el archivo al disco."
            messagebox.showinfo("Éxito", result_msg)
    
    def save_changes(self):
        """Guarda todos los cambios al archivo JSON"""
        if not self.current_file_path:
            messagebox.showwarning("Advertencia", "No hay archivo cargado")
            return
        
        modified_entries = [e for e in self.entries if e.modified]
        if not modified_entries:
            messagebox.showinfo("Info", "No hay cambios para guardar")
            return
        
        self.log("=" * 60)
        self.log("Starting save process...")
        self.log(f"Modified entries: {len(modified_entries)}")
        
        file_path = Path(self.current_file_path)
        
        try:
            # Leer JSON
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                data = json.load(f)
            
            # Crear backup
            backup_path = file_path.with_suffix(file_path.suffix + '.bak')
            import shutil
            shutil.copy2(file_path, backup_path)
            self.log(f"Created backup: {backup_path.name}")
            
            # Crear mapa de cambios
            changes_by_id = {entry.region_id: entry.type for entry in modified_entries}
            
            # Aplicar cambios
            if "underground_regions" in data and isinstance(data["underground_regions"], list):
                for region in data["underground_regions"]:
                    region_id = region.get("id")
                    if region_id in changes_by_id:
                        old_type = region.get("type", "")
                        new_type = changes_by_id[region_id]
                        region["type"] = new_type
                        self.log(f"  Updated region ID {region_id}: '{old_type}' → '{new_type}'")
            
            # Escribir JSON
            with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            
            # Marcar como no modificados
            for entry in modified_entries:
                entry.modified = False
            
            self.update_tree()
            self.log(f"SUCCESS: Saved {len(modified_entries)} changes")
            self.log("=" * 60)
            messagebox.showinfo("Éxito", f"💾 Guardados {len(modified_entries)} cambios\n\nBackup creado: {backup_path.name}")
            self.status_label.config(text=f"Guardados {len(modified_entries)} cambios")
            
        except Exception as e:
            error_msg = f"Error guardando: {e}"
            self.log(f"ERROR: {error_msg}")
            messagebox.showerror("Error", error_msg)

def main():
    root = tk.Tk()
    app = UndergroundTypeEditor(root)
    root.mainloop()

if __name__ == "__main__":
    main()

