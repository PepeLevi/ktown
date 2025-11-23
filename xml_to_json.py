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
        
### MAIN SCRIPT

# define paths
# https://stackoverflow.com/a/38412504
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILES_PATH = os.path.join(BASE_DIR, "files")
JSON_PATH = os.path.join(FILES_PATH, "jsons")

# # create variables to hold the json data
# json_legends = None
# json_legends_plus = None
# json_books = None
# df_books_flat = None

# /!\ for the script to work, the XML files need to be on the files/ folder. /!\
for entry in os.listdir(FILES_PATH):
    full_path = os.path.join(FILES_PATH, entry)
    if not os.path.isfile(full_path):
        continue

    if entry.endswith('legends.xml'):
        print(f"processing {entry} !!")
        with open(full_path, encoding='cp437', errors='ignore') as f:
            xml_legends = f.read()
            json_legends = xmltodict.parse(xml_legends)

    elif entry.endswith('legends_plus.xml'):
        print(f"processing {entry} !!")
        with open(full_path, encoding='UTF-8', errors='ignore') as f:
            xml_legends_plus = f.read()
            json_legends_plus = xmltodict.parse(xml_legends_plus)

    elif entry == "enhanced_books.json":
        print(f"processing {entry} !!")
        with open(full_path, encoding='UTF-8') as f:
            json_books = json.load(f)

# get df_world from the parsed legends safely
json_legends_new = json_legends.get('df_world', {})

if json_legends_plus is not None:
    json_legends_plus_new = json_legends_plus.get('df_world', {})
    # remove raw creature data to save space
    json_legends_plus_new.pop('creature_raw', None)
else:
    # keep an empty structure if no legends_plus present
    # it just makes things easier for later lol
    json_legends_plus_new = {}

# process books data if available
if json_books is not None:
    attach_books_to_historical_figures(json_legends_new, json_books)
    # json_legends_new['historical_figures'].pop('books', None)

json_encod_dict = {
   'json_map': {'encoding': 'utf-8', 'data': json_legends_new},
   'json_map_plus': {'encoding': 'utf-8', 'data': json_legends_plus_new},
}

# # Source - https://stackoverflow.com/a
# # Posted by phihag, modified by community. See post 'Timeline' for change history
# # Retrieved 2025-11-16, License - CC BY-SA 4.0

if not os.path.exists(JSON_PATH):
    os.mkdir(JSON_PATH)

for j, e in json_encod_dict.items():
    with open(f'{JSON_PATH}/{j}.json', 'w', encoding=e['encoding']) as f:
        json.dump(e['data'], f, ensure_ascii=False, indent=4)