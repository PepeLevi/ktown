# Key Files for Legends Mode Modding

A quick reference guide for modifying Dwarf Fortress v53.03 to customize world generation, Legends mode content, and the generation of books, writings, and names.

---

## 📋 Table of Contents

- [Entities & Civilizations](#entities--civilizations)
- [Books & Writings](#books--writings)
- [Historical Events & Legends Mode Text](#historical-events--legends-mode-text)
- [Names & Naming Conventions](#names--naming-conventions)
- [Historical Figures & Creatures](#historical-figures--creatures)
- [Object Categories & Names](#object-categories--names)
- [Terrain, Materials & World Generation](#terrain-materials--world-generation)
- [Procedural Generation Scripts](#procedural-generation-scripts)

---

## 🏛️ Entities & Civilizations

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_entities/objects/entity_default.txt` | Modify civilization names, behaviors, and how they appear in historical events |

---

## 📚 Books & Writings

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_text/objects/text_book_art.txt` | Templates for artistic book titles (poems, songs) |
| `df_53_03_win/data/vanilla/vanilla_text/objects/text_book_instruction.txt` | Templates for instructional book titles (treatises, guides) |
| `df_53_03_win/data/vanilla/vanilla_items/objects/item_tool.txt` | Book item names (scrolls, codices, quires) |

---

## 📜 Historical Events & Legends Mode Text

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_text/objects/text_hist_fig_slayer.txt` | Text for historical figures who slay creatures |
| `df_53_03_win/data/vanilla/vanilla_text/objects/text_general.txt` | General phrases used in historical narratives |
| `df_53_03_win/data/vanilla/vanilla_text/objects/text_secret_death.txt` | Secret death descriptions |
| `df_53_03_win/data/vanilla/vanilla_text/objects/text_curse.txt` | Cursing and negative event text |
| `df_53_03_win/data/vanilla/vanilla_text/objects/text_positive.txt` | Positive event descriptions |

---

## 🔤 Names & Naming Conventions

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_languages/objects/language_words.txt` | **Vocabulary for all generated names** (affects everything) |
| `df_53_03_win/data/vanilla/vanilla_languages/objects/language_DWARF.txt` | Dwarf-specific naming patterns |
| `df_53_03_win/data/vanilla/vanilla_languages/objects/language_ELF.txt` | Elf-specific naming patterns |
| `df_53_03_win/data/vanilla/vanilla_languages/objects/language_GOBLIN.txt` | Goblin-specific naming patterns |
| `df_53_03_win/data/vanilla/vanilla_languages/objects/language_HUMAN.txt` | Human-specific naming patterns |

---

## 🐉 Historical Figures & Creatures

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_creatures/objects/creature_standard.txt` | Standard creatures that appear in history |
| `df_53_03_win/data/vanilla/vanilla_creatures/objects/creature_large_*.txt` | Megabeasts and titans (notable historical figures) |

---

## 🗡️ Object Categories & Names

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_items/objects/item_*.txt` | All item category files (weapons, armor, food, etc.) - Modify category names that appear in historical references |

---

## 🌍 Terrain, Materials & World Generation

> **⚠️ CRITICAL:** These files directly control what appears in the generated world!

### Materials

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_layer.txt` | **Stone layers, sedimentary rocks, aquifers** - CRITICAL for terrain generation |
| `df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_mineral.txt` | Igneous/metamorphic stones, ores, minerals - Controls resource distribution |
| `df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_soil.txt` | Soil types (clay, loam, sand, etc.) - Affects farming and terrain |
| `df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_gem.txt` | Gemstones and precious stones - Controls gem availability |
| `df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_metal.txt` | Metals and alloys - Controls metal availability |
| `df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_other.txt` | Other inorganic materials (ceramics, etc.) |
| `df_53_03_win/data/vanilla/vanilla_materials/objects/material_template_default.txt` | Material templates used by other materials |

### Plants

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_plants/objects/plant_standard.txt` | **Standard plants, mushrooms, crops** - CRITICAL for world vegetation |
| `df_53_03_win/data/vanilla/vanilla_plants/objects/plant_grasses.txt` | Grasses and small plants - Affects biome appearance |
| `df_53_03_win/data/vanilla/vanilla_plants/objects/plant_new_trees.txt` | Trees and wood types - Controls forest composition |
| `df_53_03_win/data/vanilla/vanilla_plants/objects/plant_crops.txt` | Farmable crops - Controls available crops |
| `df_53_03_win/data/vanilla/vanilla_plants/objects/plant_garden.txt` | Garden plants and herbs |

---

## ⚙️ Procedural Generation Scripts

> **⚠️ Advanced:** These are Lua scripts. Modify only if you understand Lua programming.

| File | Purpose |
|------|---------|
| `df_53_03_win/data/vanilla/vanilla_procedural/scripts/generators/materials.lua` | Procedural material generation |
| `df_53_03_win/data/vanilla/vanilla_procedural/scripts/generators/creatures.lua` | Procedural creature generation |
| `df_53_03_win/data/vanilla/vanilla_procedural/scripts/generators/entities.lua` | Procedural entity/civilization generation |
| `df_53_03_win/data/vanilla/vanilla_procedural/scripts/generators/interactions.lua` | Procedural interaction generation |

---

## 💡 Important Notes

### Text Placeholders

All text files use placeholders that get filled in during world generation:

- `[NAME]` - Names of people, places, or things
- `[ADJ]` - Adjectives
- `[NOUN]` - Nouns
- `[CONTEXT:HIST_FIG:...]` - Historical figure context variables

Modify the templates to change how events, books, and historical figures are described in Legends mode.

### World Generation

**Terrain and material files directly control what appears in the generated world!** Modify these to change the physical world structure, available resources, and biome composition.

---

## 📖 Related Documentation

For more detailed information, see:
- [MODDING_GUIDE.md](./MODDING_GUIDE.md) - Comprehensive modding guide with detailed explanations
- [Dwarf Fortress Modding Wiki](https://dwarffortresswiki.org/index.php/Modding)

