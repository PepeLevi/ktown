--@enable = true
--@module = true

local json = require('json')
local eventful = require('plugins.eventful')
local repeatUtil = require('repeat-util')

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
        ungenerated_count = 0,
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
            ints = {state.enabled and 1 or 0, state.count or 0, state.ungenerated_count or 0},
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
    entry.ints[3] = state.ungenerated_count or 0
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

-- wrapper that returns "unknown N" for df.enum_type[BAD_VALUE],
-- instead of returning nil or causing an error
function generateBookContent(artifact)
    -- Simple random text generation - replace with your logic
    local words = {"the", "and", "for", "was", "with", "that", "this", "from", "have", "were",
                  "knowledge", "ancient", "secret", "power", "magic", "forbidden", "lost",
                  "truth", "wisdom", "scroll", "tome", "codex", "manuscript", "library"}
    
    local content = ""
    local paragraph_count = math.random(3, 10)
    
    for p = 1, paragraph_count do
        local sentence_count = math.random(3, 8)
        for s = 1, sentence_count do
            local word_count = math.random(5, 15)
            for w = 1, word_count do
                content = content .. words[math.random(1, #words)]
                if w < word_count then content = content .. " " end
            end
            content = content .. ". "
        end
        content = content .. "\n\n"
    end
    
    return content
end

local function annotate_entry(entry, written_content)
    entry.title = written_content.title ~= '' and written_content.title or ("Untitled #" .. written_content.id)
    entry.type = df.written_content_type[written_content.type] or tostring(written_content.type)
    entry.author_hfid = written_content.author
    entry.author_roll = written_content.author_roll
    return entry
end

local function record_written_work(written_content, source)
    if not written_content then
        return false
    end
    local key = tostring(written_content.id)
    if enhanced_books.data[key] then
        return false
    end
    local entry = {
        text_content = generateBookContent(written_content),
        written_content_id = written_content.id,
        source = source or 'scan',
    }
    enhanced_books.data[key] = annotate_entry(entry, written_content)
    state.count = state.count + 1
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

local function handle_item_created(item_id) --fortress mode only
    print("handle_item_created!")
    if not state.enabled then
        return
    end
    local item = df.item.find(item_id)
    if not item then
        return
    end
    local written_content = extract_written_content(item)
    if record_written_work(written_content, 'event') then
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

local function processWrittenWorks()
    if not df.global.world or not df.global.world.written_contents then return end
    local contents = df.global.world.written_contents.all
    if not contents then return end

    local scanned = #contents
    local new_entries = 0

    for _, wc in ipairs(contents) do
        if wc and record_written_work(wc, 'scan') then
            new_entries = new_entries + 1
            if new_entries <= 5 then
                local key = tostring(wc.id)
                print(("Enhanced written work %d: %s"):format(
                    wc.id, enhanced_books.data[key].title))
            end
        end
    end

    print(("Processed %d written works (%d new)"):format(scanned, new_entries))
    print("ungenerated_count: " .. state.ungenerated_count)
end

local function start()

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
    state.ungenerated_count = 0
    persist_state()
    
    -- Polling timer that works during worldgen
    print("scheduling polling timer")
    repeatUtil.scheduleEvery(GLOBAL_KEY, 10, 'frames', function()
        state.count = state.count + 1
        print("loop repeat count: " .. state.count)
        
        -- Check if world exists (works during worldgen)
        if df.global.world and df.global.world.written_contents then
            local before_count = count_table_keys(enhanced_books.data)
            processWrittenWorks()
            local after_count = count_table_keys(enhanced_books.data)
            
            if after_count > before_count then
                state.ungenerated_count = state.ungenerated_count + (after_count - before_count)
                print("Saving enhanced books data (count: " .. state.count .. ")")
                saveEnhancedBooksData()

                if state.ungenerated_count > 100 then
                    os.execute('python ' .. script_path)
                    state.ungenerated_count = 0
                end
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