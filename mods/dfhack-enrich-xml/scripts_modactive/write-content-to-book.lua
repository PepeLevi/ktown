--@enable = true
--@module = true

local json = require('json')
local eventful = require('plugins.eventful')
local repeatUtil = require('repeat-util')

-- okieeee next steps so i dont forget
-- instead of generating random content fill it with as many contextual factors about the book as possible
-- then write a python script that will request the content from deepseek using those factors
-- somehow catch and include references to previous work
-- put a guard on it for now so it only enriches a few per run for testing

-- -- DECLARE VARIABLES -- --
local GLOBAL_KEY = 'write-content-to-book'

-- Custom table to store our enhanced book data
local JSON_FILENAME = 'enhanced_books.json'
local script_path = '../mods/dfhack-enrich-xml/request_book_content.py'
enhanced_books = enhanced_books or {data = {}}
enhanced_books.data = enhanced_books.data or {}

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

local function get_author_info(author_hfid)
    if not author_hfid or author_hfid == -1 then
        return {race = "UNKNOWN", civilization = "UNKNOWN", name = "UNKNOWN"}
    end
    
    local hf = df.historical_figure.find(author_hfid)
    if not hf then
        return {race = "UNKNOWN", civilization = "UNKNOWN", name = "UNKNOWN"}
    end
    
    local race = "UNKNOWN"
    local civ = "UNKNOWN"
    local name = "UNKNOWN"
    
    -- Get race name safely
    if hf.race and df.creature_raw.find(hf.race) then
        race = df.creature_raw.find(hf.race).name[0] or "UNKNOWN"
    end
    
    -- Get civilization name safely
    if hf.civ_id and hf.civ_id ~= -1 then
        local civ_ent = df.historical_entity.find(hf.civ_id)
        if civ_ent and civ_ent.name then
            civ = civ_ent.name.has_name and civ_ent.name.first_name or "UNKNOWN_CIV"
        end
    end
    
    -- Get author name safely
    if hf.name then
        name = dfhack.TranslateName(hf.name) or "UNKNOWN"
    end
    
    return {
        race = race,
        civilization = civ,
        name = name,
        hf_id = author_hfid
    }
end

local function get_reference_info(v)
    if not v then
        return nil
    end
    
    if tostring(v._type) ==  "<type: general_ref_written_contentst>" then
        return {
            reference_type = "written content",
        } -- not implemented
    end
    if tostring(v._type) ==  "<type: general_ref_knowledge_scholar_flagst>" then
        return {
            reference_type = "knowledge",
        } -- not implemented
    end
    if tostring(v._type) ==  "<type: general_ref_value_levelst>" then
        return {
            reference_type = "value level",
        } -- not implemented
    end
    if tostring(v._type) ==  "<type: general_ref_sitest>" then
        return {
            reference_type = "site",
        } -- not implemented
    end
    if tostring(v._type) ==  "<type: general_ref_historical_eventst>" then
        return {
            reference_type = "historical event",
        } -- not implemented
    end
    
    return {}
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
        author = get_author_info(written_content.author),
        references = get_references(written_content.refs),
        poetic_form = written_content.poetic_form and df.poetic_form[written_content.poetic_form] or tostring(written_content.poetic_form) or "NONE",
        styles = get_styles(written_content.styles, written_content.style_strength) or {}
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
    
    -- Debug output to verify we're capturing the right data
    print(("Recorded written work %d: %s"):format(
        written_content.id, 
        enhanced_books.data[key].title
    ))
    print(("  Type: %s, Author: %s"):format(
        enhanced_books.data[key].context_points.work_type,
        enhanced_books.data[key].context_points.quality,
        enhanced_books.data[key].context_points.author.name
    ))
    
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

        -- uncomment for documentation
        -- if(_ % 50 == 0) then
        --     print("written work:")
        --     for k, v in pairs(wc) do
        --         print(k, v)
        --     end
            
        --     if(wc.refs ~= nil) then
        --         print("refs:")
        --         for k, v in pairs(wc.refs) do
        --             print(v._type, tostring(v._type) == "<type: general_ref_written_contentst>")
        --             for k2, v2 in pairs(v) do
        --                 print(k2, v2)
        --             end
        --         end
        --     end
            
        --     if(wc.ref_aux ~= nil) then
        --         print("refs aux:")
        --         for k, v in pairs(wc.ref_aux) do
        --             print(v)
        --         end
        --     end
            
        --     if(wc.styles ~= nil) then
        --         print("styles:")
        --         for k, v in pairs(wc.styles) do
        --             print(v)
        --         end
        --     end

        --     if(wc.style_strength ~= nil) then
        --         print("style strength:")
        --         for k, v in pairs(wc.style_strength) do
        --             print(k, v)
        --         end
        --     end
        -- end

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
    repeatUtil.scheduleEvery(GLOBAL_KEY, 100, 'frames', function()
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

                os.execute('python ' .. script_path .. " " .. dfhack.getSavePath():gsub("%s", "+"))
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