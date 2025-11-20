# Dwarf Fortress Modding Guide: World Generation, Legends Mode, and Text Generation

This guide outlines the key files you need to modify to customize world generation, Legends mode content, and the generation of books, writings, and names in Dwarf Fortress v53.03.

**Based on actual game folder structure in `df_53_03_win/`**

## Directory Structure

Dwarf Fortress mod files are located in:
- `df_53_03_win/data/vanilla/vanilla_entities/objects/` - Civilization definitions
- `df_53_03_win/data/vanilla/vanilla_languages/objects/` - Language and word files
- `df_53_03_win/data/vanilla/vanilla_text/objects/` - Text generation files (books, dialogues, historical events)
- `df_53_03_win/data/vanilla/vanilla_items/objects/` - Item definitions and categories
- `df_53_03_win/data/vanilla/vanilla_creatures/objects/` - Creature and historical figure definitions
- `df_53_03_win/data/init/` - Initialization files

---

## 1. World Generation

**Note**: In Dwarf Fortress v53, world generation parameters are set through the game's UI when creating a new world. There is no `world_gen.txt` file in the `data/init/` directory. World generation settings are configured during world creation in the game interface.

**What You Can Control**:
- History length (years of world history)
- Number of civilizations
- Number of sites (fortresses, towns, etc.)
- Number of megabeasts and titans
- Number of historical events

**Impact**: Longer histories and more entities create richer Legends mode content with more events, figures, and writings.

**Reference**: [World Generation - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/World_generation)

---

## 2. Entity and Civilization Files

### `df_53_03_win/data/vanilla/vanilla_entities/objects/entity_default.txt`
**Purpose**: Defines civilizations, their structures, behaviors, and cultural practices.

**What to Modify**:
- Entity names and descriptions
- Cultural preferences and values
- Historical behaviors and interactions
- Entity-specific naming conventions
- Language associations
- Permitted items and materials

**Impact**: Changes how civilizations develop, interact, and generate historical events in Legends mode. This directly affects what appears in historical narratives and writings.

**Reference**: [Entity token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Entity_token)

---

## 3. Text Generation and Naming Files

### `df_53_03_win/data/vanilla/vanilla_text/objects/` Directory

#### `text_book_art.txt`
**Purpose**: Templates for naming poems, songs, and artistic books.

**What to Modify**:
- Book title templates (e.g., "The [ADJ] [NO_ART_NAME]", "[NAME] and the [NOUN]")
- Naming patterns for artistic works
- References to historical events and figures using placeholders like `[NAME]`, `[ADJ]`, `[NOUN]`

**Example Structure**: Contains templates like "The Birth of [NAME]", "My Friend [NAME]", etc.

**Reference**: [Book - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Book)

#### `text_book_instruction.txt`
**Purpose**: Templates for naming instructional books and technical writings.

**What to Modify**:
- Instructional book title patterns (e.g., "A Treatise on [NAME]", "An Introduction to [NAME]")
- Technical writing naming conventions
- Academic and scholarly book formats

**Reference**: [Book - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Book)

#### Historical Event Text Files

**Key Files for Legends Mode Content**:

- **`text_hist_fig_slayer.txt`** - Text templates for historical figures who slay creatures
  - Example: "It is I that felled [CONTEXT:HIST_FIG:TRANS_NAME] the [CONTEXT:HIST_FIG:RACE]"
  
- **`text_general.txt`** - General phrases used in historical narratives
  - Contains phrases like "whose cries for mercy went unheeded by my wrath"
  - Used in various historical event descriptions

- **`text_secret_death.txt`** - Text for secret deaths and mysterious events

- **`text_curse.txt`** - Cursing and negative event descriptions

- **`text_positive.txt`** - Positive event descriptions

**What to Modify**: All text templates that use placeholders like `[CONTEXT:HIST_FIG:...]`, `[NAME]`, etc. to customize how historical events are described in Legends mode.

#### Dialogue and Speech Files

**Location**: `df_53_03_win/data/vanilla/vanilla_text/objects/` and `df_53_03_win/data/vanilla/vanilla_creatures/objects/`

**Key Files**:
- `text_greet.txt` - Greeting dialogues
- `text_greet_reply.txt` - Reply dialogues
- `text_family_relationship_*.txt` - Family relationship descriptions
- `text_*_profession*.txt` - Profession-related text (hunting, mercenary, thief, etc.)
- `text_justification_*.txt` - Justification text for actions

**Purpose**: Define sentences and phrases used in:
- Adventure mode dialogues
- Historical event descriptions
- Character speech patterns
- Legends mode narratives

**Impact**: Changes how books are named, how historical events are described in Legends mode, and how characters speak about historical events.

**Reference**: [Speech file - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Speech_file)

---

## 4. Language and Word Files

### `df_53_03_win/data/vanilla/vanilla_languages/objects/language_words.txt`
**Purpose**: Defines vocabulary used in generated languages for all civilizations.

**What to Modify**:
- Word roots and meanings
- Language vocabulary
- Naming conventions
- Word categories (nouns, adjectives, verbs, etc.)

**Impact**: Changes how names, book titles, and historical references are generated across all languages. This affects every generated name in the game.

**Reference**: [Language token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Language_token)

### `df_53_03_win/data/vanilla/vanilla_languages/objects/language_SYM.txt`
**Purpose**: Defines symbols and writing systems used in the game.

**What to Modify**:
- Writing system symbols
- Character sets
- Script appearance
- Symbol categories

**Impact**: Changes the visual appearance of written text in books and writings.

**Reference**: [Language token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Language_token)

### Civilization-Specific Language Files

**Files**:
- `df_53_03_win/data/vanilla/vanilla_languages/objects/language_DWARF.txt`
- `df_53_03_win/data/vanilla/vanilla_languages/objects/language_ELF.txt`
- `df_53_03_win/data/vanilla/vanilla_languages/objects/language_GOBLIN.txt`
- `df_53_03_win/data/vanilla/vanilla_languages/objects/language_HUMAN.txt`

**Purpose**: Define language-specific characteristics for each civilization.

**What to Modify**:
- Language structure
- Phonetic rules
- Naming patterns specific to each race

**Impact**: Changes how names and words are generated for specific civilizations, affecting historical figure names and book titles in Legends mode.

---

## 5. Creature and Historical Figure Files

### `df_53_03_win/data/vanilla/vanilla_creatures/objects/creature_standard.txt`
**Purpose**: Defines standard creatures including dwarves, elves, humans, goblins, and other common creatures that appear in history.

**What to Modify**:
- Creature names and descriptions
- Historical figure characteristics
- Creature attributes that affect historical events

**Impact**: Influences which figures appear in Legends mode and how they're described in historical events and writings.

**Reference**: [Creature token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Creature_token)

### Other Creature Files

**Location**: `df_53_03_win/data/vanilla/vanilla_creatures/objects/`

**Key Files for Historical Figures**:
- `creature_large_*.txt` - Large creatures (megabeasts, titans)
- `creature_fanciful.txt` - Fanciful creatures
- `creature_equipment.txt` - Equipment-related creatures
- Various biome-specific creature files

**What to Modify**:
- Creature names that appear in historical events
- Descriptions used in Legends mode
- Attributes that make creatures notable in history

**Impact**: Changes which creatures become historical figures and how they're referenced in books and writings.

**Reference**: [Creature token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Creature_token)

---

## 6. Item and Object Category Files

### `df_53_03_win/data/vanilla/vanilla_items/objects/item_*.txt` files
**Purpose**: Define items, their categories, and properties.

**Key Files**:
- **`item_tool.txt`** - Tools including scrolls, codices, quires (books)
  - **Critical for book generation**: Contains definitions for book items
  - Modify names of book types (scroll, codex, quire)
  
- **`item_weapon.txt`** - Weapons
  - Weapon names and categories
  
- **`item_armor.txt`** - Armor
  - Armor names and categories
  
- **`item_food.txt`** - Food items
- **`item_ammo.txt`** - Ammunition
- **`item_shield.txt`** - Shields
- **`item_helm.txt`** - Helmets
- **`item_gloves.txt`** - Gloves
- **`item_pants.txt`** - Pants
- **`item_shoes.txt`** - Shoes
- **`item_toy.txt`** - Toys
- **`item_trapcomp.txt`** - Trap components
- **`item_siegeammo.txt`** - Siege ammunition

**What to Modify**:
- Item names (appear in historical references)
- Category names (how items are classified)
- Object descriptions
- Book-related items (scrolls, codices, quires) - **especially important for writings**

**Impact**: Changes how objects are named and categorized throughout the game and in historical references. Book item names directly affect how writings are described in Legends mode.

**Reference**: [Item token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Item_token)

---

## 7. Terrain, Materials, and World Generation Objects

### **CRITICAL FOR WORLD GENERATION** - These files control the physical world that gets generated.

### `df_53_03_win/data/vanilla/vanilla_materials/objects/` Directory

#### `inorganic_stone_layer.txt`
**Purpose**: Defines sedimentary and layer stones that form the geological structure of the world.

**What to Modify**:
- Stone names (sandstone, limestone, shale, etc.)
- Stone properties (density, melting points, colors)
- Aquifer designations (`[AQUIFER]` tag)
- Sedimentary layer types
- Ocean depth designations (`[SEDIMENTARY_OCEAN_SHALLOW]`, `[SEDIMENTARY_OCEAN_DEEP]`)

**Impact**: Controls what stones appear in different biomes and terrain types. Affects world generation, mining, and terrain features.

**Reference**: [Inorganic token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Inorganic_token)

#### `inorganic_stone_mineral.txt`
**Purpose**: Defines igneous and metamorphic stones (granite, marble, etc.) and mineral ores.

**What to Modify**:
- Igneous stone names and properties
- Metamorphic stone names and properties
- Ore names and properties
- Metal associations
- Material values

**Impact**: Controls what minerals and ores are available in the world, affecting resource distribution and world generation.

**Reference**: [Inorganic token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Inorganic_token)

#### `inorganic_stone_soil.txt`
**Purpose**: Defines soil types (clay, loam, sand, etc.) that affect farming and terrain.

**What to Modify**:
- Soil type names (clay, sandy clay, loam, etc.)
- Soil densities
- Aquifer designations
- Soil colors and properties

**Impact**: Controls soil distribution across biomes, affects farming capabilities, and influences terrain generation.

**Reference**: [Inorganic token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Inorganic_token)

#### `inorganic_stone_gem.txt`
**Purpose**: Defines gemstones and precious stones found in the world.

**What to Modify**:
- Gem names and types
- Gem properties and values
- Gem colors and appearances
- Rarity settings

**Impact**: Controls what gems appear in the world, affecting trade, crafting, and world generation.

**Reference**: [Inorganic token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Inorganic_token)

#### `inorganic_metal.txt`
**Purpose**: Defines metals and alloys available in the world.

**What to Modify**:
- Metal names (iron, steel, bronze, etc.)
- Metal properties (density, melting points, material values)
- Alloy definitions
- Metal colors and appearances

**Impact**: Controls what metals are available for crafting, affects world generation and resource distribution.

**Reference**: [Inorganic token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Inorganic_token)

#### `inorganic_other.txt`
**Purpose**: Defines other inorganic materials (ceramics, plaster, glazes, etc.).

**What to Modify**:
- Material names and properties
- Ceramic types
- Special material properties

**Impact**: Affects crafting materials and world generation.

**Reference**: [Inorganic token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Inorganic_token)

#### `material_template_default.txt`
**Purpose**: Defines material templates used by other material definitions.

**What to Modify**:
- Template properties
- Base material characteristics
- Shared material attributes

**Impact**: Changes to templates affect all materials that use them.

**Reference**: [Material template - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Material_template)

---

### `df_53_03_win/data/vanilla/vanilla_plants/objects/` Directory

#### `plant_standard.txt`
**Purpose**: Defines standard plants, mushrooms, and crops that grow in the world.

**What to Modify**:
- Plant names (plump helmet, cave wheat, etc.)
- Plant growth properties
- Edible properties
- Material properties
- Growth duration and values

**Impact**: Controls what plants are available for farming and gathering. Affects world generation, biomes, and food production.

**Reference**: [Plant token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Plant_token)

#### `plant_grasses.txt`
**Purpose**: Defines grasses and small plants that grow in various biomes.

**What to Modify**:
- Grass names and types
- Biome associations
- Growth properties
- Material properties

**Impact**: Controls vegetation in different biomes, affects world appearance and ecosystem.

**Reference**: [Plant token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Plant_token)

#### `plant_new_trees.txt`
**Purpose**: Defines trees that grow in the world.

**What to Modify**:
- Tree names (oak, pine, maple, etc.)
- Tree growth properties
- Wood material properties
- Biome associations
- Tree sizes and lifespans

**Impact**: Controls forest composition, affects world generation, biomes, and available wood types.

**Reference**: [Plant token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Plant_token)

#### `plant_crops.txt`
**Purpose**: Defines crops that can be farmed.

**What to Modify**:
- Crop names
- Growth seasons
- Crop properties
- Food and seed materials

**Impact**: Controls available crops for farming, affects food production and world generation.

**Reference**: [Plant token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Plant_token)

#### `plant_garden.txt`
**Purpose**: Defines garden plants and herbs.

**What to Modify**:
- Garden plant names
- Plant properties
- Growth characteristics

**Impact**: Controls garden plants available in the world.

**Reference**: [Plant token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Plant_token)

---

### Procedural Generation Scripts

**Location**: `df_53_03_win/data/vanilla/vanilla_procedural/scripts/generators/`

**Purpose**: Lua scripts that control procedural generation of materials, creatures, entities, and interactions during world generation.

**Key Files**:
- `materials.lua` - Procedural material generation
- `creatures.lua` - Procedural creature generation
- `entities.lua` - Procedural entity/civilization generation
- `interactions.lua` - Procedural interaction generation
- `items.lua` - Procedural item generation
- `language.lua` - Procedural language generation
- `divine.lua` - Divine material generation
- `evil.lua` - Evil creature/material generation

**Note**: These are advanced Lua scripts. Modify with caution and only if you understand Lua programming.

**Impact**: Directly controls how random materials, creatures, and entities are generated during world creation.

**Reference**: [Procedural generation - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Procedural_generation)

---

## 8. Historical Events and Legends Export

### Legends Mode Export
**Location**: Generated in `df_53_03_win/` directory after exporting from Legends Mode
**File**: `region1-00250-01-01-legends.xml` (or similar, format: `region[#]-[year]-[month]-[day]-legends.xml`)

**Purpose**: Contains exported world history data in XML format.

**Note**: This is primarily for analysis, but understanding its structure helps guide modding decisions. You can see how your text modifications appear in actual Legends mode exports.

**Usage**:
1. Generate a world in Dwarf Fortress
2. Enter Legends mode
3. Press `x` to export to XML
4. Analyze the structure to understand how events, figures, and writings are generated
5. Check how your text file modifications appear in the exported data

**Reference**: [World History file - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/World_History_file)

---

## 9. Additional Modding Tokens (from Wiki)

Based on the Dwarf Fortress modding wiki, you may also need to modify:

### Entity Tokens
- `[ENTITY]` - Civilization definitions
- `[LANGUAGE]` - Language definitions  
- `[WORD]` - Word definitions for naming
- `[TRANSLATION]` - Translation definitions

**Reference**: [Entity token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Entity_token)

### Interaction Tokens
- `[INTERACTION]` - Defines interactions that can generate historical events
- Located in: `df_53_03_win/data/vanilla/vanilla_interactions/objects/interaction_standard.txt`

**Reference**: [Interaction token - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Interaction_token)

### Reaction Tokens
- `[REACTION]` - Defines crafting reactions that can create books and writings
- Located in: `df_53_03_win/data/vanilla/vanilla_reactions/objects/`

**Reference**: [Reaction - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Reaction)

---

## Recommended Modding Workflow

1. **Backup Original Files**: Always backup files before modifying
   ```
   Copy entire df_53_03_win/data/vanilla/ directory as backup
   ```

2. **Start with World Generation** (via game UI):
   - Create a new world with desired history length and entity counts
   - Note: World generation is done through the game interface, not a file

3. **Modify Entity Definitions**:
   - Edit `df_53_03_win/data/vanilla/vanilla_entities/objects/entity_default.txt` to customize civilizations
   - Adjust cultural behaviors and naming

4. **Modify Terrain and World Generation Objects** (CRITICAL):
   - Edit material files in `df_53_03_win/data/vanilla/vanilla_materials/objects/`:
     - `inorganic_stone_layer.txt` - Stone layers and geology
     - `inorganic_stone_mineral.txt` - Minerals and ores
     - `inorganic_stone_soil.txt` - Soil types
     - `inorganic_stone_gem.txt` - Gemstones
     - `inorganic_metal.txt` - Metals
     - `inorganic_other.txt` - Other materials
   - Edit plant files in `df_53_03_win/data/vanilla/vanilla_plants/objects/`:
     - `plant_standard.txt` - Standard plants and crops
     - `plant_grasses.txt` - Grasses
     - `plant_new_trees.txt` - Trees
     - `plant_crops.txt` - Crops
     - `plant_garden.txt` - Garden plants

5. **Customize Text Generation** (Most Important for Your Goals):
   - Edit book title files:
     - `df_53_03_win/data/vanilla/vanilla_text/objects/text_book_art.txt`
     - `df_53_03_win/data/vanilla/vanilla_text/objects/text_book_instruction.txt`
   - Modify historical event text files:
     - `df_53_03_win/data/vanilla/vanilla_text/objects/text_hist_fig_slayer.txt`
     - `df_53_03_win/data/vanilla/vanilla_text/objects/text_general.txt`
     - `df_53_03_win/data/vanilla/vanilla_text/objects/text_secret_death.txt`
     - `df_53_03_win/data/vanilla/vanilla_text/objects/text_curse.txt`
     - `df_53_03_win/data/vanilla/vanilla_text/objects/text_positive.txt`
   - Modify speech files for dialogue and descriptions
   - Adjust language files for naming conventions

6. **Update Object Names and Categories**:
   - Modify item files in `df_53_03_win/data/vanilla/vanilla_items/objects/` to change names and categories
   - **Especially important**: `item_tool.txt` for book item names
   - Update creature files for historical figures

7. **Test in Legends Mode**:
   - Generate new worlds
   - Enter Legends mode
   - Press `x` to export Legends data
   - Verify changes appear in historical events, books, and writings
   - Check the exported XML file to see how your modifications appear

---

## Key Files Summary

| File | Full Path | Purpose |
|------|-----------|---------|
| `entity_default.txt` | `df_53_03_win/data/vanilla/vanilla_entities/objects/` | Civilization definitions |
| `text_book_art.txt` | `df_53_03_win/data/vanilla/vanilla_text/objects/` | Artistic book titles |
| `text_book_instruction.txt` | `df_53_03_win/data/vanilla/vanilla_text/objects/` | Instructional book titles |
| `text_hist_fig_slayer.txt` | `df_53_03_win/data/vanilla/vanilla_text/objects/` | Historical figure slayer text |
| `text_general.txt` | `df_53_03_win/data/vanilla/vanilla_text/objects/` | General historical event phrases |
| `text_secret_death.txt` | `df_53_03_win/data/vanilla/vanilla_text/objects/` | Secret death descriptions |
| `text_curse.txt` | `df_53_03_win/data/vanilla/vanilla_text/objects/` | Cursing text |
| `text_positive.txt` | `df_53_03_win/data/vanilla/vanilla_text/objects/` | Positive event text |
| `language_words.txt` | `df_53_03_win/data/vanilla/vanilla_languages/objects/` | Language vocabulary |
| `language_SYM.txt` | `df_53_03_win/data/vanilla/vanilla_languages/objects/` | Writing system symbols |
| `language_DWARF.txt` | `df_53_03_win/data/vanilla/vanilla_languages/objects/` | Dwarf language |
| `language_ELF.txt` | `df_53_03_win/data/vanilla/vanilla_languages/objects/` | Elf language |
| `language_GOBLIN.txt` | `df_53_03_win/data/vanilla/vanilla_languages/objects/` | Goblin language |
| `language_HUMAN.txt` | `df_53_03_win/data/vanilla/vanilla_languages/objects/` | Human language |
| `creature_standard.txt` | `df_53_03_win/data/vanilla/vanilla_creatures/objects/` | Creature and historical figure definitions |
| `item_tool.txt` | `df_53_03_win/data/vanilla/vanilla_items/objects/` | Tools and book items |
| Speech files | `df_53_03_win/data/vanilla/vanilla_text/objects/` | Dialogue and description templates |

---

## References and Wiki Links

### Main Modding Resources
- **[Modding - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Modding)** - Main modding guide
- **[Bay 12 Games Modding Guide](https://bay12games.com/dwarves/modding_guide.html)** - Official modding guide from developers

### Specific Token Documentation
- **[Entity token](https://dwarffortresswiki.org/index.php/Entity_token)** - Civilization definitions
- **[Creature token](https://dwarffortresswiki.org/index.php/Creature_token)** - Creature and historical figure definitions
- **[Language token](https://dwarffortresswiki.org/index.php/Language_token)** - Language and word definitions
- **[Item token](https://dwarffortresswiki.org/index.php/Item_token)** - Item definitions
- **[Interaction token](https://dwarffortresswiki.org/index.php/Interaction_token)** - Interaction definitions
- **[Reaction](https://dwarffortresswiki.org/index.php/Reaction)** - Crafting reaction definitions

### Text and Writing Resources
- **[Book - Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/Book)** - Book generation and naming
- **[Speech file](https://dwarffortresswiki.org/index.php/Speech_file)** - Speech and dialogue templates
- **[World History file](https://dwarffortresswiki.org/index.php/World_History_file)** - Legends mode export format

### World Generation
- **[World generation](https://dwarffortresswiki.org/index.php/World_generation)** - World generation mechanics

### Advanced Modding
- **[DFHack Documentation](https://dwarffortresswiki.org/index.php/Utility:DFHack)** - Advanced modding tool
- **[Modding pitfalls](https://dwarffortresswiki.org/index.php/Modding_pitfalls)** - Common modding mistakes to avoid

---

## Next Steps

1. **Locate your game folder**: `df_53_03_win/`
2. **Navigate to the data folder**: `df_53_03_win/data/vanilla/`
3. **Create backups**: Copy the entire `vanilla/` directory before making any changes
4. **Start with entity definitions**: 
   - Edit `vanilla_entities/objects/entity_default.txt` for basic customization
5. **Focus on text generation** (most important for your goals):
   - Edit `vanilla_text/objects/text_book_art.txt` and `text_book_instruction.txt` for book titles
   - Edit `vanilla_text/objects/text_hist_fig_slayer.txt`, `text_general.txt`, etc. for historical event descriptions
6. **Modify language files**: 
   - Edit `vanilla_languages/objects/language_words.txt` for vocabulary
   - Edit civilization-specific language files for race-specific naming
7. **Update item names**: 
   - Edit `vanilla_items/objects/item_tool.txt` for book item names
   - Edit other item files for category names
8. **Test changes**: 
   - Generate new worlds through the game UI
   - Enter Legends mode and press `x` to export
   - Check the exported XML file to verify your modifications appear correctly

---

## Quick Recap: Key Files for Legends Mode Modding

### **Entities & Civilizations**
- **`df_53_03_win/data/vanilla/vanilla_entities/objects/entity_default.txt`**
  - Modify civilization names, behaviors, and how they appear in historical events

### **Books & Writings**
- **`df_53_03_win/data/vanilla/vanilla_text/objects/text_book_art.txt`**
  - Templates for artistic book titles (poems, songs)
- **`df_53_03_win/data/vanilla/vanilla_text/objects/text_book_instruction.txt`**
  - Templates for instructional book titles (treatises, guides)
- **`df_53_03_win/data/vanilla/vanilla_items/objects/item_tool.txt`**
  - Book item names (scrolls, codices, quires)

### **Historical Events & Legends Mode Text**
- **`df_53_03_win/data/vanilla/vanilla_text/objects/text_hist_fig_slayer.txt`**
  - Text for historical figures who slay creatures
- **`df_53_03_win/data/vanilla/vanilla_text/objects/text_general.txt`**
  - General phrases used in historical narratives
- **`df_53_03_win/data/vanilla/vanilla_text/objects/text_secret_death.txt`**
  - Secret death descriptions
- **`df_53_03_win/data/vanilla/vanilla_text/objects/text_curse.txt`**
  - Cursing and negative event text
- **`df_53_03_win/data/vanilla/vanilla_text/objects/text_positive.txt`**
  - Positive event descriptions

### **Names & Naming Conventions**
- **`df_53_03_win/data/vanilla/vanilla_languages/objects/language_words.txt`**
  - Vocabulary for all generated names (affects everything)
- **`df_53_03_win/data/vanilla/vanilla_languages/objects/language_DWARF.txt`**
- **`df_53_03_win/data/vanilla/vanilla_languages/objects/language_ELF.txt`**
- **`df_53_03_win/data/vanilla/vanilla_languages/objects/language_GOBLIN.txt`**
- **`df_53_03_win/data/vanilla/vanilla_languages/objects/language_HUMAN.txt`**
  - Race-specific naming patterns

### **Historical Figures & Creatures**
- **`df_53_03_win/data/vanilla/vanilla_creatures/objects/creature_standard.txt`**
  - Standard creatures that appear in history
- **`df_53_03_win/data/vanilla/vanilla_creatures/objects/creature_large_*.txt`**
  - Megabeasts and titans (notable historical figures)

### **Object Categories & Names**
- **`df_53_03_win/data/vanilla/vanilla_items/objects/item_*.txt`**
  - All item category files (weapons, armor, food, etc.)
  - Modify category names that appear in historical references

### **Terrain, Materials & World Generation** (CRITICAL)
- **`df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_layer.txt`**
  - Stone layers, sedimentary rocks, aquifers
- **`df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_mineral.txt`**
  - Igneous/metamorphic stones, ores, minerals
- **`df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_soil.txt`**
  - Soil types (clay, loam, sand, etc.)
- **`df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_stone_gem.txt`**
  - Gemstones and precious stones
- **`df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_metal.txt`**
  - Metals and alloys
- **`df_53_03_win/data/vanilla/vanilla_materials/objects/inorganic_other.txt`**
  - Other inorganic materials (ceramics, etc.)
- **`df_53_03_win/data/vanilla/vanilla_plants/objects/plant_standard.txt`**
  - Standard plants, mushrooms, crops
- **`df_53_03_win/data/vanilla/vanilla_plants/objects/plant_grasses.txt`**
  - Grasses and small plants
- **`df_53_03_win/data/vanilla/vanilla_plants/objects/plant_new_trees.txt`**
  - Trees and wood types
- **`df_53_03_win/data/vanilla/vanilla_plants/objects/plant_crops.txt`**
  - Farmable crops
- **`df_53_03_win/data/vanilla/vanilla_plants/objects/plant_garden.txt`**
  - Garden plants and herbs

**Remember**: All text files use placeholders like `[NAME]`, `[ADJ]`, `[NOUN]`, `[CONTEXT:HIST_FIG:...]` that get filled in during world generation. Modify the templates to change how events, books, and historical figures are described in Legends mode. **Terrain and material files directly control what appears in the generated world!**

