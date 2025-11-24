import xmltodict
import json
import os
import pandas as pd
import numpy as np

def attach_books_to_historical_figures(df_world_dict, json_books_arg):
    """ Nests the JSON book to the historic figure (author) that wrote it :3 """
    global df_books_flat

    if not json_books_arg:
        df_books_flat = None
        # create the book key regardless of if it's empty
        hf_container = df_world_dict.setdefault('historical_figures', {})
        hf_container.setdefault('books', {})
        return

    # create df to transpose > json > df again. looks off but it works & makes sense on code logic
    df_books = pd.DataFrame(json_books['data']).T
    json_struct = json.loads(df_books.to_json(orient="records"))
    df_books_flat = pd.json_normalize(json_struct)

    books_map = {}
    for _, row in df_books_flat.iterrows():
        author_id = row.get('author_hfid')
        if pd.isna(author_id):
            continue
        try: # id type inconsistent across jsons, so standarized through str
            key = str(int(float(author_id)))
        except Exception:
            key = str(author_id)

        book_rec = {
            'title': row.get('title'),
            'text_content': row.get('text_content'),
            'written_content_id': row.get('written_content_id'),
            'type': row.get('type')
        }
        books_map.setdefault(key, []).append(book_rec)

    # modify only historic_figures
    hf_container = df_world_dict.setdefault('historical_figures', {})

    hist_list = hf_container.get('historical_figure')
    single = isinstance(hist_list, dict)

    if hist_list is None:
        hist_list = []
    elif single:
        hist_list = [hist_list]

    # create an empty list for hf regardless of the existence of authorship (it prevents issues)
    for hf in hist_list:
        if isinstance(hf, dict):
            hf.setdefault('books', [])

    for hf in hist_list:
        hf_id = hf.get('id') if isinstance(hf, dict) else None
        if hf_id is None:
            hf_key = None
        else:
            try:
                hf_key = str(int(float(hf_id)))
            except Exception:
                hf_key = str(hf_id)
        # map book list again and link w/ authors
        if isinstance(hf, dict):
            hf['books'] = books_map.get(hf_key, [])
    if single and hist_list:
        hf_container['historical_figure'] = hist_list[0]
    else:
        hf_container['historical_figure'] = hist_list
        
### MAIN SCRIPT ### 

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # https://stackoverflow.com/a/38412504
FILES_PATH = os.path.join(BASE_DIR, "files")
JSON_PATH = os.path.join(FILES_PATH, "jsons")

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

    # elif entry == "enhanced_books.json":
    #     print(f"loading in {entry} !!")
    #     with open(full_path, encoding='UTF-8') as f:
    #         json_books = json.load(f)

# this is gonna be our output json with all the shit in it.
# this approach is different from the old one. were not removing stuff from the old files were selectively putting the shit we want into a new one.
queen_json = {}

queen_json["regions"] = json_legends.get('df_world').get('regions')
queen_json["sites"] = json_legends.get('df_world').get('sites').get('site')

sites_plus_length = len(json_legends_plus.get('df_world').get('sites').get('site'))

#so we fill the site object with all the other shit
for site in queen_json['sites']:
    if(int(site['id']) < sites_plus_length):
        site_plus = json_legends_plus.get('df_world').get('sites').get('site')[int(site['id'])]
        if 'structures' in site_plus:
            for structure in site_plus['structures']['structure']:
                # structure = site_plus['structures']
                historical_figures = []
                if 'inhabitant' in structure:
                    #check if its a list or array
                    if isinstance(structure['inhabitant'], str):
                        historical_figures.add(json_legends.get('df_world').get('historical_figures').get('historical_figure')[int(structure['inhabitant'])])
                    else:
                        for figure in structure['inhabitant']:
                            historical_figures.add(json_legends.get('df_world').get('historical_figures').get('historical_figure')[int(figure)])
                structure["historical_figures"] = historical_figures
                site["structures"] = structure
    

# # get df_world from the parsed legends safely
# json_legends_new = json_legends.get('df_world', {})

# if json_legends_plus is not None:
#     json_legends_plus_new = json_legends_plus.get('df_world', {})
#     # remove raw creature data to save space
#     json_legends_plus_new.pop('creature_raw', None)
# else:
#     # keep an empty structure if no legends_plus present
#     # it just makes things easier for later lol
#     json_legends_plus_new = {}

# # process books data if available
# if json_books is not None:
#     attach_books_to_historical_figures(json_legends_new, json_books)

# # Source - https://stackoverflow.com/a
# # Posted by phihag, modified by community. See post 'Timeline' for change history
# # Retrieved 2025-11-16, License - CC BY-SA 4.0

if not os.path.exists(JSON_PATH):
    os.mkdir(JSON_PATH)

with open(f'{JSON_PATH}/queen.json', 'w', encoding='utf-8') as f:
    json.dump(queen_json, f, ensure_ascii=False, indent=4)

print("finito")