import xmltodict
import json
import os
import pandas as pd
import numpy as np

FILES_PATH = "files/"
JSON_PATH = FILES_PATH + 'jsons/'

# /!\ for the script to work, the XML files need to be on the root folder
for file in os.listdir(FILES_PATH):
    if file.endswith('legends.xml'):
        with open(os.path.join(FILES_PATH, file), encoding='cp437') as f:
            xml_normal = f.read()
            json_legends = xmltodict.parse(xml_normal)
            
    if file.endswith('legends_plus.xml'):
        with open(os.path.join(FILES_PATH, file), encoding='UTF-8') as f:
            xml_legends = f.read()
            json_xml_plus = xmltodict.parse(xml_legends)
    
    if file == "enhanced_books.json":
        with open(os.path.join(FILES_PATH, file), encoding='UTF-8') as f:
            json_books = json.load(f)
            df_books = pd.DataFrame(json_books['data']).T
            # Source - https://stackoverflow.com/a
            # Posted by staonas, modified by community. See post 'Timeline' for change history
            # Retrieved 2025-11-19, License - CC BY-SA 4.0

            json_struct = json.loads(df_books.to_json(orient="records"))
            df_books_flat = pd.json_normalize(json_struct)
            df_books_flat = df_books_flat[['written_content_id', 'author_hfid', "context_points.author.name", "title", "text_content"]]
            if not os.path.exists(JSON_PATH):
                os.mkdir(JSON_PATH)
                
            df_books_flat.to_json(
                os.path.join(JSON_PATH,"enriched_books.json"),
                orient="records",
                force_ascii=False,
                indent=4
            )

# access to the data stored on the dict 
json_legends_plus_new = json_xml_plus['df_world']

# # remove data that we won't use
json_legends_plus_new.pop('creature_raw')

json_encod_dict = {
   'json_map': {'encoding': 'cp437', 'data': json_legends},
   'json_map_plus': {'encoding': 'utf-8', 'data': json_legends_plus_new},
   
}

# # Source - https://stackoverflow.com/a
# # Posted by phihag, modified by community. See post 'Timeline' for change history
# # Retrieved 2025-11-16, License - CC BY-SA 4.0

if not os.path.exists(JSON_PATH):
    os.mkdir(JSON_PATH)

for j, e in json_encod_dict.items():
    with open(f'{JSON_PATH}{j}.json', 'w', encoding=e['encoding']) as f:
        json.dump(e['data'], f, ensure_ascii=False, indent=4)