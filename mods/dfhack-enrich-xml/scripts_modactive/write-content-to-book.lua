--@enable = true
--@module = true

local json = require('json')
local eventful = require('plugins.eventful')
local repeatUtil = require('repeat-util')

-- okieeee next steps so i dont forget
-- implement dance form and entity reference
-- more hist events

-- -- DECLARE VARIABLES -- --
local GLOBAL_KEY = 'write-content-to-book'

-- Custom table to store our enhanced book data
local JSON_FILENAME = 'enhanced_books.json'
local script_path = '../mods/dfhack-enrich-xml/request_book_content.py'
enhanced_books = enhanced_books or {data = {}}
enhanced_books.data = enhanced_books.data or {}


local DEATH_TYPES = {
 [0] = 'OLD_AGE','HUNGER','THIRST','SHOT','BLEED','DROWN','SUFFOCATE','STRUCK_DOWN','SCUTTLE','COLLISION','MAGMA','MAGMA_MIST','DRAGONFIRE','FIRE','SCALD','CAVEIN','DRAWBRIDGE','FALLING_ROCKS','CHASM','CAGE','MURDER','TRAP','VANISH','QUIT','ABANDON','HEAT','COLD','SPIKE','ENCASE_LAVA','ENCASE_MAGMA','ENCASE_ICE','BEHEAD','CRUCIFY','BURY_ALIVE','DROWN_ALT','BURN_ALIVE','FEED_TO_BEASTS','HACK_TO_PIECES','LEAVE_OUT_IN_AIR','BOIL','MELT','CONDENSE','SOLIDIFY','INFECTION','MEMORIALIZE','SCARE','DARKNESS','COLLAPSE','DRAIN_BLOOD','SLAUGHTER','VEHICLE','FALLING_OBJECT'
}

-- SHIT I NEED FOR THIS TO RUN IN THE BACKGROUND
local function get_default_state()
    return {
        enabled = false,
        count = 0,
        books_without_content = 0,
    }
end

state = state or get_default_state()
local state_entry

local function is_world_available()
    return dfhack.isWorldLoaded() or dfhack.isMapLoaded()
end

local function get_json_path()
    local save_path = dfhack.getSavePath()
    if save_path and save_path ~= '' then
        return save_path .. '/' .. JSON_FILENAME
    end
    return JSON_FILENAME
end

local function ensure_state_entry()
    if not is_world_available() then
        return nil
    end
    if state_entry then
        state_entry:get()
        return state_entry
    end
    state_entry = dfhack.persistent.get(GLOBAL_KEY)
    if not state_entry then
        state_entry = dfhack.persistent.save({
            key = GLOBAL_KEY,
            ints = {state.enabled and 1 or 0, state.count or 0, state.books_without_content or 0},
        })
    end
    return state_entry
end

function isEnabled()
    return state.enabled
end

local function get_name_custom(name)
    word = ""
    for k, v in pairs(name.words) do
        if v > -1 then
            word = word .. string.sub(df.language_word.find(v).str[0].value, 7,-2)
        end
    end 
    return word
end

local function persist_state()
    if not is_world_available() then return end
    local entry = ensure_state_entry()
    if not entry then return end
    entry.ints[1] = state.enabled and 1 or 0
    entry.ints[2] = state.count or 0
    entry.ints[3] = state.books_without_content or 0
    entry:save()
    print('saving state - enabled: ' .. tostring(state.enabled) .. ', count: ' .. state.count)
end

local function load_state()
    if not is_world_available() then
        state_entry = nil
        return state
    end
    state_entry = dfhack.persistent.get(GLOBAL_KEY)
    if state_entry then
        state.enabled = (state_entry.ints[1] or 0) ~= 0
        state.count = state_entry.ints[2] or 0
    else
        ensure_state_entry()
    end
    return state
end

-- Save enhanced data to file
local function ensure_save_dir()
    local save_path = dfhack.getSavePath()
    if save_path and save_path ~= '' and not dfhack.filesystem.exists(save_path) then
        dfhack.filesystem.mkdir(save_path)
    end
end

function saveEnhancedBooksData()
    local target_path = get_json_path()
    print("saving books data to " .. target_path)
    ensure_save_dir()
    local ok, err = pcall(json.encode_file, {data = enhanced_books.data}, target_path, {pretty=false})
    if ok then
        print(("Saved enhanced books data for %d entries"):format(count_table_keys(enhanced_books.data)))
        return true
    end
    print("Failed to save enhanced books data: " .. tostring(err))
    return false
end

-- Load enhanced data from file
function loadEnhancedBooksData()
    local path = get_json_path()
    local ok, decoded = pcall(json.decode_file, path)
    if ok and type(decoded) == 'table' and type(decoded.data) == 'table' then
        enhanced_books.data = decoded.data
        print(("Loaded enhanced books data for %d entries"):format(count_table_keys(enhanced_books.data)))
        return
    end
    enhanced_books.data = enhanced_books.data or {}
    if not ok then
        print("No existing enhanced books data found (" .. tostring(decoded) .. ")")
    else
        print("No existing enhanced books data found")
    end
end

-- Helper function to count table keys
function count_table_keys(t)
    local count = 0
    for _ in pairs(t) do count = count + 1 end
    return count
end

--######
--Functions
--######

local function get_hf_info(hfid)
    if not hfid or hfid == -1 then
        return {race = "UNKNOWN", civilization = "UNKNOWN", name = "UNKNOWN"}
    end
    
    local hf = df.historical_figure.find(hfid)
    if not hf then
        return {race = "UNKNOWN", civilization = "UNKNOWN", civilization_id="UNKNOWN", name = "UNKNOWN", hf_id = "UNKNOWN"}
    end
    
    local race = "UNKNOWN"
    local civ = "UNKNOWN"
    local civilization_id = "UNKNOWN"
    local name = "UNKNOWN"
    
    -- Get race name safely
    if hf.race and df.creature_raw.find(hf.race) then
        race = df.creature_raw.find(hf.race).name[0] or "UNKNOWN"
    end
    
    -- Get civilization name safely
    if hf.civ_id and hf.civ_id ~= -1 then
        local civ_ent = df.historical_entity.find(hf.civ_id)
        if civ_ent and civ_ent.name then
            -- civ = civ_ent.name.has_name and dfhack.TranslateName(civ_ent.name) or "UNKNOWN_CIV"
            civ = civ_ent.name.has_name and get_name_custom(civ_ent.name) or "UNKNOWN_CIV"
            civilization_id = hf.civ_id
        end
    end
    
    -- Get author name safely
    if hf.name then
        -- name = dfhack.TranslateName(hf.name) or "UNKNOWN"
        name = get_name_custom(hf.name) or "UNKNOWN"
    end
    
    return {
        race = race,
        civilization = civ,
        name = name,
        civilization_id = civilization_id,
        hf_id = hfid
    }
end

local function get_site(site_id)
    if not site_id then
        return nil
    end

    site = df.world_site.find(site_id)
    print("getting site: ", site)
    
    -- for k, v in pairs(site) do
    --     print(k, v)
    -- end -- theres a lot here i can also do civilization, population, buildings, year founded

    return {
        -- site_name = site ~= nil and dfhack.TranslateName(site.name) or "UNKNOWN",
        site_name = site ~= nil and get_name_custom(site.name) or "UNKNOWN",
        id = site_id
    }
end

local function get_historical_event(event_id)
    if not event_id then
        return nil
    end

    event_object = df.history_event.find(event_id)
    -- print("getting historical event: ", event_object)
    -- for k, v in pairs(event_object) do
    --     print(k, v)
    -- end
    
    if df.history_event_hist_figure_diedst:is_instance(event_object) then
        for k, v in pairs(event_object.weapon) do
            print(k, v)
        end
        return {
            year = event_object.year,
            victim = get_hf_info(event_object.victim_hf),
            slayer = get_hf_info(event_object.slayer_hf),
            site = get_site(event_object.site),
            death_cause = DEATH_TYPES[event_object.death_cause],
        }
    end
    -- if df.history_event_written_content_composedst:is_instance(event_object) then
    --     return { year = event_object.year, } --NOT IMPLEMENTED
    -- end
    -- if df.history_event_hist_figure_simple_battle_eventst:is_instance(event_object) then
    --     return { year = event_object.year, } --NOT IMPLEMENTED
    -- end
    
    return {
        year = event_object.year,
        type = tostring(event_object._type),
        id = event_id
    }
end

local function analyze_knowledge(knowledge)
    if not knowledge then
        return nil
    end
    
    -- print("analyzing knowledge", knowledge.flag_data["flags_" .. knowledge.flag_type])

    local topics = {}
    local i = 0
    for k, v in pairs(knowledge.flag_data["flags_" .. knowledge.flag_type]) do
        -- print(k, v)
        if v then
            topics[i] = k
            i = i + 1
        end
    end

    return topics
end

local function get_reference_info(v)
    if not v then
        return nil
    end
    
    if tostring(v._type) ==  "<type: general_ref_written_contentst>" then
        return {
            reference_type = "written content",
            written_content_id = v.written_content_id
        }
    end
    if tostring(v._type) ==  "<type: general_ref_knowledge_scholar_flagst>" then
        return {
            reference_type = "knowledge",
            topics = analyze_knowledge(v.knowledge)
        } -- not done
    end
    if tostring(v._type) ==  "<type: general_ref_value_levelst>" then
        -- print("value level", df.value_type[v.value])
        return {
            reference_type = "value level",
            value = df.value_type[v.value],
            level = v.level
        } -- not tested
    end
    if tostring(v._type) ==  "<type: general_ref_sitest>" then
        return {
            reference_type = "site",
            site = get_site(v.site_id)
        } -- not implemented
    end
    if tostring(v._type) ==  "<type: general_ref_historical_eventst>" then
        return {
            reference_type = "historical event",
            event = get_historical_event(v.event_id)
        } -- not done
    end
    if tostring(v._type) ==  "<type: general_ref_dance_formst>" then
        print("reference info:", v)
        for k2, v2 in pairs(v) do
            print(k2, v2)
        end
        return {
            reference_type = "dance form",
        } -- not implemented
    end
    if tostring(v._type) ==  "<type: general_ref_entity>" then
        print("reference info:", v)
        for k2, v2 in pairs(v) do
            print(k2, v2)
        end
        return {
            reference_type = "entity",
        } -- not implemented
    end
    
    return {reference_type = "unknown reference: " .. tostring(v._type)}
end

local function get_references(reference_list)
    references = {}
    
    for k, v in pairs(reference_list) do
        references[k] = get_reference_info(v)
    end

    return references
end

local function get_styles(style_list, style_strengths)
    if style_list == nil or style_strengths == nil then
        return nil
    end

    local styles = {}
    
    for k, v in pairs(style_list) do
        styles[k] = {
            style = (df.written_content_style[v] or tostring(v)) or "UNKNOWN",
            strength = 0
        }
    end
    for k, v in pairs(style_strengths) do
        styles[k].strength= style_strengths[k]
    end

    return styles
end

local function get_poetic_form(poetic_form_id)
    if poetic_form_id == nil or poetic_form_id == -1 or poetic_form_id >= #df.global.world.poetic_forms.all then
        return nil
    end

    -- -- ALL THIS POETRY SHIT IS TOO COMPLICATED. LEAVE FOR LATER.
    
    poetic_form = df.global.world.poetic_forms.all[poetic_form_id]

    poetic_form_features = {
        -- name =  dfhack.TranslateName(poetic_form.name)  or "UNKNOWN",
        name =  get_name_custom(poetic_form.name)  or "UNKNOWN",
        poetic_form_id = poetic_form_id,
        feet_per_line = poetic_form.each_line_feet > -1 and poetic_form.each_line_feet,
        pattern_per_line = poetic_form.each_line_pattern > -1 and poetic_form.each_line_pattern,
        caesura_position_on_line = poetic_form.every_line_caesura_position > -1 and poetic_form.every_line_caesura_position,
        mood = poetic_form.mood > -1 and df.mood_type[poetic_form.mood],
        features = {},

    }
    
    -- for k, v in pairs(poetic_form) do
    --     print(k, v)
    -- end
    -- print("name:")
    -- for k, v in pairs(poetic_form.name.words) do
    --     print(k, v)
    -- end
    -- for k, v in pairs(poetic_form.name.parts_of_speech) do
    --     print(k, v)
    -- end
    -- for k, v in pairs(poetic_form.parts) do
    --     print(k, v)
    --     for k2, v2 in pairs(v) do
    --         print(k2, v2)
    --     end
    -- end
    -- print("common features")
    -- for k, v in pairs(poetic_form.common_features) do
    --     for k2, v2 in pairs(v) do
    --         print(k2, v2)
    --     end
    -- end
    local i=0
    for k, v in pairs(poetic_form.features) do
        if v then
            poetic_form_features.features[i] = k
            i = i + 1
        end
    end
    -- NOT USING FLAGS AND PERSPECTIVES RN

    return poetic_form_features
end

local function get_quality_level(quality)
    if quality == nil then
        return "UNKNOWN"
    end
    if quality < 20 then
        return "LOW"
    end
    if quality < 100 then
        return "AVERAGE"
    end
    if quality < 200 then
        return "HIGH"
    end
    
    return "VERY HIGH"
end

local function annotate_entry(entry, written_content, item_quality)
    if not written_content then
        return entry
    end
    
    entry.title = written_content.title and written_content.title ~= '' and written_content.title or ("Untitled #" .. written_content.id)
    entry.type = written_content.type and (df.written_content_type[written_content.type] or tostring(written_content.type)) or "UNKNOWN"
    entry.author_hfid = written_content.author or -1

    -- Enhanced context points for AI generation - ONLY using actual game data
    entry.context_points = {
        work_type = entry.type,
        -- quality = get_quality_level(item_quality),
        -- quality = get_quality_level(written_content.author_roll or 0),
        page_count = written_content.page_end - written_content.page_start + 1,
        author = get_hf_info(written_content.author),
        references = get_references(written_content.refs),
        -- poetic_form = written_content.poetic_form > -1 and df.global.world.poetic_forms.all[written_content.poetic_form] or tostring(written_content.poetic_form) or "NONE",
        styles = get_styles(written_content.styles, written_content.style_strength) or {},
        poetic_form = get_poetic_form(written_content.poetic_form),
    }
    
    -- -- Additional metadata with safe access
    -- entry.metadata = {
    --     -- world_id = df.global.world and df.global.world.world_data and df.global.world.world_data.id or -1,
    --     creation_tick = written_content.creation_tick or -1,
    --     flags = written_content.flags and {
    --         has_introduction = written_content.flags.has_introduction or false,
    --         has_conclusion = written_content.flags.has_conclusion or false,
    --         incomplete = written_content.flags.incomplete or false
    --     } or {}
    -- }
    
    return entry
end

local function record_written_work(written_content, source, item_quality)
    if not written_content then
        return false
    end
    
    local key = tostring(written_content.id)
    if enhanced_books.data[key] then
        return false
    end
    
    local entry = {
        text_content = "",  -- Empty for now, will be filled by AI
        written_content_id = written_content.id,
        -- source = source or 'scan',
        -- timestamp = os.time(),  -- Record when we captured this data
        -- item_quality = item_quality or -1  -- Store the actual item quality
    }
    
    enhanced_books.data[key] = annotate_entry(entry, written_content, item_quality)
    state.count = state.count + 1
    
    -- -- Debug output to verify we're capturing the right data FIXME UNCOMMENT LATER!!!
    -- print(("Recorded written work %d: %s"):format(
    --     written_content.id, 
    --     enhanced_books.data[key].title
    -- ))
    -- print(("  Type: %s, Author: %s"):format(
    --     enhanced_books.data[key].context_points.work_type,
    --     enhanced_books.data[key].context_points.quality,
    --     enhanced_books.data[key].context_points.author.name
    -- ))
    
    return true
end

local function extract_written_content(item)
    if not item or not item.general_refs then
        return nil
    end
    for _, ref in ipairs(item.general_refs) do
        if df.general_ref_written_contentst:is_instance(ref) then
            return df.written_content.find(ref.written_content_id)
        end
    end
end

-- Update the handle_item_created function to pass item quality
local function handle_item_created(item_id) --fortress mode only
    print("handle_item_created!")
    if not state.enabled then
        return
    end
    local item = df.item.find(item_id)
    if not item then
        return
    end
    
    -- Get the item quality before extracting written content
    local item_quality = item.quality or -1
    
    local written_content = extract_written_content(item)
    if record_written_work(written_content, 'event', item_quality) then
        if state.count % 25 == 0 then
            saveEnhancedBooksData()
        end
        persist_state()
    end
end

local function register_item_listener()
    if event_registered then
        return
    end
    eventful.enableEvent(eventful.eventType.ITEM_CREATED, 1)
    eventful.onItemCreated[GLOBAL_KEY] = handle_item_created
    event_registered = true
    print("write-content-to-book: item creation listener registered")
end

local function unregister_item_listener()
    if not event_registered then
        return
    end
    eventful.onItemCreated[GLOBAL_KEY] = nil
    event_registered = false
    print("write-content-to-book: item creation listener removed")
end

-- Update the scanning function to handle cases where we don't have item quality
local function processWrittenWorks()
    if not df.global.world or not df.global.world.written_contents then return end
    local contents = df.global.world.written_contents.all
    if not contents then return end

    local scanned = #contents
    local new_entries = 0

    for _, wc in ipairs(contents) do

        if wc and record_written_work(wc, 'scan', -1) then  -- Use -1 for unknown quality in scans
            new_entries = new_entries + 1
            if new_entries <= 5 then
                local key = tostring(wc.id)
                print(("Enhanced written work %d: %s"):format(
                    wc.id, enhanced_books.data[key].title))
            end
        end
    end

    print(("Processed %d written works (%d new)"):format(scanned, new_entries))
    print("books_without_content: " .. state.books_without_content)
end

local function start()
    enhanced_books = {data = {}}

    -- Always register the event listener (works in fortress mode)
    register_item_listener()
    
    print("write-content-to-book starting (polling + events)")
    loadEnhancedBooksData()
    
    -- Initial scan
    if df.global.world and df.global.world.written_contents then
        processWrittenWorks()
        saveEnhancedBooksData()
    end

    state.count = 0
    state.books_without_content = 0
    persist_state()
    
    -- Polling timer that works during worldgen
    print("scheduling polling timer")
    repeatUtil.scheduleEvery(GLOBAL_KEY, 25, 'frames', function()
        state.count = state.count + 1
        print("loop repeat count: " .. state.count)
        
        -- Check if world exists (works during worldgen)
        if df.global.world and df.global.world.written_contents then
            local before_count = count_table_keys(enhanced_books.data)
            processWrittenWorks()
            local after_count = count_table_keys(enhanced_books.data)
            
            if after_count > before_count then
                state.books_without_content = state.books_without_content + (after_count - before_count)
                print("Saving enhanced books data (count: " .. state.count .. ")")
                saveEnhancedBooksData()

                -- UNCOMMENT TO WRITE BOOK CONTENTS
                os.execute('python ' .. script_path .. " " .. dfhack.getSavePath():gsub("%s", "+"))
                loadEnhancedBooksData()
                state.books_without_content = 0
            end
        end
        
        -- Persist state periodically
        if state.count % 50 == 0 then
            persist_state()
        end
    end)
    
    print("Polling timer scheduled successfully")
end

local function stop()
    unregister_item_listener()
    repeatUtil.cancel(GLOBAL_KEY)
    if is_world_available() then
        saveEnhancedBooksData()
    end
    persist_state()
    print("write-content-to-book stopped at count: " .. state.count)
end

function enable()
    if state.enabled then
        print("write-content-to-book already enabled")
        return
    end
    load_state()
    state.enabled = true
    persist_state()
    if is_world_available() then
        start()
    else
        print("Enabled - waiting for world generation/load")
    end
end

function disable()
    if not state.enabled then
        print("write-content-to-book already disabled")
        return
    end
    state.enabled = false
    stop()
end

function status()
    print("Script Status:")
    print("  Enabled: " .. tostring(state.enabled))
    print("  Listener active: " .. tostring(event_registered))
    print("  World available: " .. tostring(is_world_available()))
    print("  Entries tracked: " .. count_table_keys(enhanced_books.data))
    print("  Processed count: " .. state.count)
end

-- Initialize
dfhack.onStateChange[GLOBAL_KEY] = function(code)
    if code == SC_WORLD_LOADED then
        print("World loaded - syncing write-content-to-book state")
        load_state()
        loadEnhancedBooksData()
        if state.enabled then
            start()
        end
    elseif code == SC_WORLD_UNLOADED then
        print("World unloaded - removing write-content-to-book listeners")
        print("Saving enhanced books data (count: " .. state.count .. ")")
        saveEnhancedBooksData()
        stop()
        state_entry = nil
    end
end

load_state()
if is_world_available() then
    loadEnhancedBooksData()
end

-- Also add this to handle DFHack's enable/disable system
if dfhack_flags.module then
    return
end

if dfhack_flags.enable then
    if dfhack_flags.enable_state then
        enable()
    else
        disable()
    end
end