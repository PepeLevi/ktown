import xmltodict
import json
import os
import math
import random
        
### MAIN SCRIPT ### 

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # https://stackoverflow.com/a/38412504
FILES_PATH = os.path.join(BASE_DIR, "files")
JSON_PATH = os.path.join(FILES_PATH, "jsons")


def process_structure(structure):
    historical_figures = []
    if 'inhabitant' in structure:
        #check if its a list or array
        if isinstance(structure['inhabitant'], str):
            inhabitant = json_legends.get('df_world').get('historical_figures').get('historical_figure')[int(structure['inhabitant'])]
            historical_figures.append(inhabitant)
            inhabitant["assigned"] = True
        else:
            for figure in structure['inhabitant']:
                inhabitant = json_legends.get('df_world').get('historical_figures').get('historical_figure')[int(figure)]
                historical_figures.append(inhabitant)
                inhabitant["assigned"] = True
    structure["historical_figures"] = historical_figures
    return structure

def artifact_has_written_content(artifact, written_content_id):
    if not 'item' in artifact:
        return False
    if 'writing_written_content_id' in artifact['item']:
        return str(artifact['item']['writing_written_content_id']) == str(written_content_id)
    if 'page_written_content_id' in artifact['item']:
        return str(artifact['item']['page_written_content_id']) == str(written_content_id)
    return False

def get_hf_by_id(hfid):
    for site in queen_json['sites']:
        if 'historical_figures' in site:
            for hf in site['historical_figures']:
                if(str(hf['id']) == str(hfid)):
                    return hf
        if 'structures' not in site:
            continue
        for structure in site['structures']:
            if 'historical_figures' not in structure:
                continue
            for hf in structure['historical_figures']:
                if(str(hf['id']) == str(hfid)):
                    return hf
                
def try_assign_book_to_hf(hfid, book):
    holder = get_hf_by_id(hfid)
    if not holder:
        return False # since we're searching in the nested folder structure this should exclude any hfs that arent in a site
    if not 'books' in holder:
        holder["books"] = []
    holder["books"].append(book)
    return True

def find_site_by_entity(entity_id):
    for site in queen_json['sites']:
        if 'cur_owner_id' not in site:
            continue
        if str(site['cur_owner_id']) == str(entity_id):
            return site
    for site in queen_json['sites']:
        if 'civ_id' not in site:
            continue
        if str(site['civ_id']) == str(entity_id):
            return site
    return None


# ---------- START CODE EXECUTION ----------- #


# /!\ for the script to work, the XML files need to be on the files/ folder. /!\
for entry in os.listdir(FILES_PATH):
    full_path = os.path.join(FILES_PATH, entry)
    if not os.path.isfile(full_path):
        continue

    if entry.endswith('legends.xml'):
        print(f"loading in {entry} !!")
        with open(full_path, encoding='cp437', errors='ignore') as f:
            json_legends = xmltodict.parse(f.read())

    elif entry.endswith('legends_plus.xml'):
        print(f"loading in {entry} !!")
        with open(full_path, encoding='UTF-8', errors='ignore') as f:
            json_legends_plus = xmltodict.parse(f.read())

    elif entry == "enhanced_books.json":
        print(f"loading in {entry} !!")
        with open(full_path, encoding='UTF-8') as f:
            json_books = json.load(f)

# this is gonna be our output json with all the shit in it.
# this approach is different from the old one. were not removing stuff from the old files were selectively putting the shit we want into a new one.
queen_json = {}

queen_json["name"] = json_legends_plus.get('df_world').get('name')
queen_json["altname"] = json_legends_plus.get('df_world').get('altname')
queen_json["regions"] = json_legends.get('df_world').get('regions').get('region')
queen_json["underground_regions"] = json_legends.get('df_world').get('underground_regions').get('underground_region')
queen_json["sites"] = json_legends.get('df_world').get('sites').get('site')

# get coords from legends plus
for region in queen_json['regions']:
    region_plus = json_legends_plus.get('df_world').get('regions').get('region')[int(region['id'])]
    region['coords'] = region_plus['coords']
for region in queen_json['underground_regions']:
    region_plus = json_legends_plus.get('df_world').get('underground_regions').get('underground_region')[int(region['id'])]
    region['coords'] = region_plus['coords']

# so we fill the site object with all the other shit
sites_plus_length = len(json_legends_plus.get('df_world').get('sites').get('site'))
for site in queen_json['sites']:
    # so right now we're only assining HFs to structures that have them as an inhabitant which is shitt
    if(int(site['id']) < sites_plus_length):
        site_plus = json_legends_plus.get('df_world').get('sites').get('site')[int(site['id'])-1]
        if 'civ_id' in site_plus:
            site['civ_id'] = site_plus['civ_id']
        if 'cur_owner_id' in site_plus:
            site['cur_owner_id'] = site_plus['cur_owner_id']
        if 'structures' in site_plus:
            site["structures"] = []
            if isinstance(site_plus['structures']['structure'], list):
                for structure in site_plus['structures']['structure']:
                    site["structures"].append(process_structure(structure))
            else:
                site["structures"].append(process_structure(site_plus['structures']['structure']))

print("total hf", len(json_legends.get('df_world').get('historical_figures').get('historical_figure')))
assigned_hf_1 = 0
assigned_hf_2 = 0
assigned_hf_3 = 0

for historical_figure in json_legends.get('df_world').get('historical_figures').get('historical_figure'):
    if 'assigned' in historical_figure:
        assigned_hf_1 += 1
        continue
    if 'site_link' in historical_figure:
        site = queen_json.get('sites')[int(historical_figure['site_link']['site_id'])-1]
        if not 'historical_figures' in site:
            site["historical_figures"] = []
        site["historical_figures"].append(historical_figure)
        assigned_hf_2 += 1
        continue
    if 'entity_link' in historical_figure:
        entity = None
        if not isinstance(historical_figure['entity_link'], list): 
            entity = historical_figure['entity_link']['entity_id']
        else:
            entities = list(filter(lambda e: e['link_type'] != 'enemy',  # should enemies be filtered idk
            historical_figure['entity_link']))
            if len(entities) > 0:
                entity = historical_figure['entity_link'][0]['entity_id']
        if not entity: continue
        site = find_site_by_entity(entity)
        if not site: continue
        if not 'historical_figures' in site:
            site["historical_figures"] = []
        site["historical_figures"].append(historical_figure)
        assigned_hf_3 += 1
        continue

print("figures assigned by inhabitant: ", assigned_hf_1)
print("figures assigned by site-link: ", assigned_hf_2)
print("figures assigned by entity: ", assigned_hf_3)


found_artifacts = 0
found_holder_links = 0
found_artifact_links = 0
found_author_links = 0

print("total books: ", len(json_books['data']))

for book in json_books['data']:
    assigned_book = False

    # first try to locate by artifact because its the most true (ie the physical object of the book)
    artifacts = list(filter(
        lambda a: artifact_has_written_content(a, book['written_content_id']), 
        json_legends['df_world']['artifacts']['artifact']))
    if len(artifacts) != 0 and artifacts[0]:
        artifact = artifacts[0]
        if artifact:
            found_artifacts += 1
            if 'holder_hfid' in artifact:
                assigned_book = try_assign_book_to_hf(artifact['holder_hfid'], book)
                found_holder_links += 1 if assigned_book else 0
            elif 'structure_local_id' in artifact:
                site = queen_json.get('sites')[int(artifact['site_id'])-1]
                structure = site.get('structures')[int(artifact['structure_local_id'])]
                if not 'books' in structure:
                    structure["books"] = []
                structure["books"].append(book)
                assigned_book = True
            elif 'site_id' in artifact:
                site = queen_json.get('sites')[int(artifact['site_id'])-1]
                if not 'books' in site:
                    site["books"] = []
                site["books"].append(book)
                assigned_book = True
    found_artifact_links += 1 if assigned_book else 0

    # if that fails try to assign by author
    if not assigned_book:
        assigned_book = try_assign_book_to_hf(book['author_hfid'], book)
        found_author_links += 1 if assigned_book else 0

    # if that fails too assign it to a random site (home to the same civ/entity?)
    if not assigned_book:
        site = queen_json.get('sites')[math.floor(random.random() * len(queen_json.get('sites')))]
        if not 'books' in site:
            site["books"] = []
        site["books"].append(book)
        assigned_book = True
    
print("total found artifacts ", found_artifacts)
print("artifact links ", found_artifact_links)
print("holder links", found_holder_links)
print("author links", found_author_links)

def translate_event_to_string(event):
    return_value = {}
    # GADEA STRING FILLING TREE GOES HERE



    # DAVID generic default return code
    if 'event_string' not in return_value:
        string = ""
        for (key, value) in event.items():
            string += str(key) + ":" + str(value) + ", "
        return_value['event_string'] = string

    return_value['hf_links'] = event.items()
    return_value['site_links'] = event
    return return_value

historical_events = []
#start adding historical events to shit
# my proposal: -save them in an array as a single string with hyperlinks -give sites/figures a list of historical_event ids
for event in json_legends.get('df_world').get('historical_events').get('historical_event'):
    historical_events.append(translate_event_to_string(event))
    # for related_objects:
    #     add_event_link_to_object(event['id'])

if not os.path.exists(JSON_PATH):
    os.mkdir(JSON_PATH)

with open(f'{JSON_PATH}/queen.json', 'w', encoding='utf-8') as f:
    json.dump(queen_json, f, ensure_ascii=False, indent=4)

print("replacing double strings")

with open(f'{JSON_PATH}/queen.json', encoding="utf-8") as f:
    s = f.read()

with open(f'{JSON_PATH}/queen.json', 'w', encoding="utf-8") as f:
    s = s.replace("the the", "the")
    s = s.replace("the The", "the")
    s = s.replace("The the", "The")
    s = s.replace("The The", "The")
    f.write(s)

print("finito")