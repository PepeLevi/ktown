--@enable = true
--@module = true


-- IMPORTS -- 
local utils = require('utils')
local event = require('plugins.eventful')
local repeatUtil = require('repeat-util')
local json = require('json')
local scriptmanager = require('script-manager')


-- -- DECLARE VARIABLES -- --
local path = scriptmanager.getModStatePath('write-content-to-book')
local GLOBAL_KEY = 'write-content-to-book'

-- Custom table to store our enhanced book data
local jsonpath = 'enhanced_books.json'
enhanced_books = json.open(path .. jsonpath)

local world = df.global.world

local save_count = save_count or 0


-- SHIT I NEED FOR THIS TO RUN IN THE BACKGROUND

local function get_default_state()
    return {
        enabled=false,
        count=0,
    }
end

state = state or get_default_state()

function isEnabled()
    return state.enabled
end

-- -- persisting a table with numeric keys results in a json array with a huge number of null entries
-- -- therefore, we convert the keys to strings for persistence
-- local function to_persist(persistable)
--     local persistable_count= {}
--     for k, v in pairs(persistable) do
--         persistable_ignored[tostring(k)] = v
--     end
--     return persistable_ignored
-- end

-- -- loads both from the older array format and the new string table format
-- local function from_persist(persistable)
--     if not persistable then
--         return
--     end
--     local ret = {}
--     for k, v in pairs(persistable) do
--         ret[tonumber(k)] = v
--     end
--     return ret
-- end

function persist_state()
    if(dfhack.persistent.getWorldData(GLOBAL_KEY, {}).enabled ~= nil) then
        print('saving')
        dfhack.persistent.saveWorldData(GLOBAL_KEY, {
            enabled=state.enabled,
            count=state.count,
        })  
    end
end

--- Load the saved state of the script
local function load_state()
    -- load persistent data
    local persisted_data = dfhack.persistent.getWorldData(GLOBAL_KEY, {})
    state.enabled = persisted_data.enabled or state.enabled
    state.count = persisted_data.count or state.count
    return state
end


--######
--Functions
--######


-- stolen from exportlegends

-- wrapper that returns "unknown N" for df.enum_type[BAD_VALUE],
-- instead of returning nil or causing an error
local df_enums = {} --as:df
setmetatable(df_enums, {
    __index = function(self, enum)
        if not df[enum] or df[enum]._kind ~= 'enum-type' then
            error('invalid enum: ' .. enum)
        end
        local t = {}
        setmetatable(t, {
            __index = function(self, k)
                return df[enum][k] or ('unknown ' .. k)
            end
        })
        return t
    end,
    __newindex = function() error('read-only') end
})

-- Track if we're in worldgen -> i broke this so just DONT RUN IT after worldgen
local in_worldgen = dfhack.world.ReadWorldFolder()

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

-- -- Hook historical artifact creation using eventful
-- event.registerSidebarCreature("item", function(id)
--     -- This is a generic hook - we need to check if it's actually a historical artifact
--     -- For worldgen, we need a different approach
-- end)

-- Better approach: Hook into the end of worldgen to process all artifacts
local function processExistingArtifacts()
    if not df.global.world then return end
    
    local world = df.global.world
    if not world.artifacts then return end
    
    local artifacts = world.artifacts.all
    if not artifacts then return end
    
    for _, artifact in ipairs(artifacts) do
        -- Check if this is a written artifact we haven't processed
        if artifact and artifact.item and (df_enums.item_type[artifact.item:getType()] == "BOOK") then
            if not enhanced_books.data[artifact.id] then
                -- Generate and store enhanced content
                local text_content = generateBookContent(artifact)
                
                enhanced_books.data[artifact.id] = {
                    text_content = text_content,
                    artifact_id = artifact.id,
                    -- form = artifact.form,
                    -- style = artifact.style,
                    -- skill_taught = artifact.skill_taught,
                    -- subject = artifact.subject,
                    name = artifact.name and tostring(artifact.name) or "Unknown"
                }
                
                print(("Enhanced book %d: %s"):format(artifact.id, enhanced_books.data[artifact.id].name))
            end
        end
    end
end


local function escape_xml(str)
    return str:gsub('&', '&amp;'):gsub('<', '&lt;'):gsub('>', '&gt;')
end

-- Save enhanced data to file
function saveEnhancedBooksData()
    print("saving books data")
    enhanced_books:write()
    print(("Saved enhanced books data for %d books to "):format(
        #enhanced_books, jsonpath))
    return true
end

-- -- Final save when worldgen completes (if we can detect it)
-- dfhack.onStateChange.worldgenBookHook = function(code)
--     if code == SC_WORLD_LOADED then
--         print("World loaded - performing final save of enhanced books data")
--         processExistingArtifacts()
--         saveEnhancedBooksData()
--     end
-- end

-- Utility function to get enhanced content for an artifact
function getEnhancedBookContent(artifact_id)
    return enhanced_books.data[artifact_id]
end


local function start()
    -- Main execution logic
    if dfhack.world.ReadWorldFolder() then
        -- We're in worldgen - process existing artifacts
        print("Processing artifacts during worldgen...")
        processExistingArtifacts()
        saveEnhancedBooksData()
        
    else
        print("No world loaded")
    end
    
    -- timeout appears not to work in menu?
    repeatUtil.scheduleEvery(GLOBAL_KEY, 100, 'frames', function()
        save_count = save_count + 1
        print("loop repeat count")
        print(save_count)
        
        if dfhack.world.ReadWorldFolder() then
            processExistingArtifacts()
            if(save_count % 10 == 0) then
                saveEnhancedBooksData()
            end
        end
    end)
end

local function stop()
    repeatUtil.cancel(GLOBAL_KEY)
    print("loop repeat count:")
    print(save_count)
end

function enable()
    state.enabled = true
    persist_state()
    start()
end

function disable()
    state.enabled = false
    stop()
    persist_state()
end

-- Also add this to handle DFHack's enable/disable system --
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

-- -- Export functions for other scripts
-- return {
--     getEnhancedBookContent = getEnhancedBookContent,
--     enhanced_books = enhanced_books,
--     saveEnhancedBooksData = saveEnhancedBooksData,
--     loadEnhancedBooksData = loadEnhancedBooksData,
--     processExistingArtifacts = processExistingArtifacts
-- }