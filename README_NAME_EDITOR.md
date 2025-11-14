# Dwarf Fortress Name Editor

Editor gráfico para cambiar todos los nombres en los archivos de modding de Dwarf Fortress.

## Características

- ✅ Parsea correctamente diferentes formatos de archivos:
  - **Criaturas**: `[NAME:singular:plural:adjective]` y `[CASTE_NAME:...]`
  - **Items**: `[NAME:singular:plural]`
  - **Entidades**: `[NAME:singular:plural]` y `[SQUAD:number:singular:plural]`
- ✅ Interfaz gráfica intuitiva con árbol de archivos
- ✅ Botón para randomizar todos los nombres con caracteres ASCII aleatorios
- ✅ Botón para randomizar nombre individual
- ✅ Guarda cambios en los archivos originales
- ✅ Muestra información de contexto para cada entrada

## Requisitos

- Python 3.6 o superior
- tkinter (viene incluido con Python en la mayoría de sistemas)

## Uso

1. Ejecuta el script:
   ```bash
   python df_name_editor.py
   ```

2. **Seleccionar directorio base**: Haz clic en "Seleccionar Directorio Base" y elige la carpeta `df_53_03_win/data/vanilla`

3. **Cargar archivos**: Haz clic en "Cargar Archivos" para escanear todos los archivos y extraer los nombres

4. **Editar nombres**:
   - Selecciona una entrada en el árbol de la izquierda
   - Edita los campos en el panel derecho
   - Haz clic en "Aplicar Cambios"

5. **Randomizar**:
   - **Randomizar Este**: Randomiza solo el nombre seleccionado
   - **🎲 Randomizar Todos los Nombres**: Randomiza TODAS las entradas cargadas

6. **Guardar**: Haz clic en "💾 Guardar Cambios" para escribir los cambios a los archivos

## Archivos que se cargan

El script carga automáticamente:

- `creature_standard.txt` - Nombres de criaturas (dwarf, human, elf, goblin, etc.)
- `item_*.txt` - Nombres de items (armas, armaduras, herramientas, etc.)
- `entity_default.txt` - Nombres de posiciones y squads

## Formato de nombres randomizados

Los nombres randomizados usan caracteres ASCII aleatorios:
- Letras (a-z, A-Z)
- Números (0-9)
- Caracteres especiales: çñáéíóúàèìòùâêîôûäëïöü
- Longitud aleatoria entre 5-12 caracteres

Ejemplo: `djq832dçc`, `K7mP9x`, `ñá3FgH2`

## Notas importantes

⚠️ **Haz backup de tus archivos antes de usar el editor**

⚠️ **Genera un nuevo mundo** después de cambiar los nombres para que los cambios se reflejen en el juego

⚠️ Los cambios se guardan directamente en los archivos originales

## Solución de problemas

- Si no ves las entradas: Verifica que el directorio base sea correcto (`df_53_03_win/data/vanilla`)
- Si hay errores al guardar: Verifica que tengas permisos de escritura en los archivos
- Si faltan archivos: Algunos archivos pueden no existir en tu instalación, el script los ignora automáticamente

