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
            inhabitant = json_legends_clean.get('historical_figures').get('historical_figure')[int(structure['inhabitant'])]
            historical_figures.append(inhabitant)
            inhabitant["assigned"] = True
        else:
            for figure in structure['inhabitant']:
                inhabitant = json_legends_clean.get('historical_figures').get('historical_figure')[int(figure)]
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

# this is gonna be our output json with all the s**t in it.
# this approach is different from the old one. were not removing stuff from the old files were selectively putting the s**t we want into a new one.
queen_json = {}

json_legends_plus_clean = json_legends_plus.get('df_world')
json_legends_clean = json_legends.get('df_world')

queen_json["name"] = json_legends_plus_clean.get('name')
queen_json["altname"] = json_legends_plus_clean.get('altname')
queen_json["regions"] = json_legends_clean.get('regions').get('region')
queen_json["underground_regions"] = json_legends_clean.get('underground_regions').get('underground_region')
queen_json["sites"] = json_legends_clean.get('sites').get('site')

# get coords from legends plus
for region in queen_json['regions']:
    region_plus = json_legends_plus_clean.get('regions').get('region')[int(region['id'])]
    region['coords'] = region_plus['coords']
for region in queen_json['underground_regions']:
    region_plus = json_legends_plus_clean.get('underground_regions').get('underground_region')[int(region['id'])]
    region['coords'] = region_plus['coords']

# so we fill the site object with all the other s**t
sites_plus_length = len(json_legends_plus_clean.get('sites').get('site'))
for site in queen_json['sites']:
    # so right now we're only assining HFs to structures that have them as an inhabitant which is s**tt
    if(int(site['id']) < sites_plus_length):
        site_plus = json_legends_plus_clean.get('sites').get('site')[int(site['id'])-1]
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

print("- total hf", len(json_legends_clean.get('historical_figures').get('historical_figure')))
assigned_hf_1 = 0
assigned_hf_2 = 0
assigned_hf_3 = 0

for historical_figure in json_legends_clean.get('historical_figures').get('historical_figure'):
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

print("- figures assigned by inhabitant: ", assigned_hf_1)
print("- figures assigned by site-link: ", assigned_hf_2)
print("- figures assigned by entity: ", assigned_hf_3)

found_artifacts = 0
found_holder_links = 0
found_artifact_links = 0
found_author_links = 0

print("- total books: ", len(json_books['data']))

for bookkey, book in json_books['data'].items():
    assigned_book = False

    # first try to locate by artifact because its the most true (ie the physical object of the book)
    artifacts = list(filter(
        lambda a: artifact_has_written_content(a, book['written_content_id']), 
        json_legends_clean['artifacts']['artifact']))
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
    
print("- total found artifacts ", found_artifacts)
print("- artifact links ", found_artifact_links)
print("- holder links", found_holder_links)
print("- author links", found_author_links)

def translate_event_to_string(event):
    return_value = {}
    
    # bc hf ids are dynamic based on event type we need to store them in a dict and iterate through them
    events_hf_id = {
        'competition': ['winner_hfid', 'competitor_hfid'],
        'hf wounded': ['woundee_hfid', 'wounder_hfid'],
        'add hf hf link': ['hfid', 'hfid_target'],
        'hf convicted': ['convicted_hfid', 'fooled_hfid', 'framer_hfid'],
        'remove hf hf link': ['hfid', 'hfid_target'],
        'hf learns secret': ['student_hfid', 'teacher_hfid'],
        'hf relationship denied': ['seeker_hfid', 'target_hfid'],
        'attacked site': ['attacker_general_hfid', 'defender_general_hfid'],
        'hf abducted': ['target_hfid', 'snatcher_hfid'],
        'changed creature type': ['changee_hfid', 'changer_hfid'],
        'hfs formed intrigue relationship': ['target_hfid', 'corruptor_hfid', 'lure_hfid'],
        'failed intrigue corruption': ['target_hfid', 'corruptor_hfid', 'lure_hfid'],
        'hfs formed reputation relationship': ['hfid1', 'hfid2'],
        'entity overthrown': ['overthrown_hfid', 'pos_taker_hfid', 'instigator_hfid', 'conspirator_hfid'],
        'failed frame attempt': ['target_hfid', 'fooled_hfid', 'framer_hfid', 'plotter_hfid'],
        'entity persecuted': ['persecutor_hfid', 'expelled_hfid', 'property_confiscated_from_hfid'],
        'field battle': ['attacker_general_hfid', 'defender_general_hfid'],
        'hf revived': ['hfid', 'actor_hfid']
    }
    
    event_connectors = {
        'competition': ['desiring against', 'mirroring inversely', 'cathecting toward', 'deterritorializing with', 'sublimating through', 'projecting upon', 'becoming-other to', 'jouissance versus', 'folding away from', 'rhizomatically opposing'],
        'hf wounded': ['inscribing upon', 'castrating through', 'marking the Real of', 'intensifying into', 'wounding the symbolic of', 'cutting flows of', 'traumatizing', 'piercing the imaginary of', 'rupturing', 'severing lines-of-flight from'],
        'add hf hf link': ['desiring-machines with', 'suturing to', 'assemblaging with', 'transference toward', 'deterritorializing alongside', 'folding into', 'rhizome-connecting', 'mirroring', 'symbiosis with', 'cathexis toward'],
        'hf convicted': ['foreclosing with', 'paranoiac alongside', 'triangulating between', 'trapped in symbolic of', 'scapegoating through', 'Oedipalizing via', 'caught in Name-of-Father with', 'projection between', 'abjecting through', 'shadow-meeting'],
        'remove hf hf link': ['decathecting from', 'deterritorializing away', 'severing assemblage with', 'foreclosing', 'repressing away from', 'unfolding from', 'cutting body-without-organs from', 'abjecting', 'splitting from objet petit a of', 'death-drive from'],
        'hf learns secret': ['initiated beneath', 'unconscious-transfer from', 'gnosis through', 'hermetic with', 'unveiling via', 'psychopomp guided by', 'decoded by', 'hierophant under', 'unconscious revealed by', 'mystery-transmission from'],
        'hf relationship denied': ['foreclosed by', 'negating the desire of', 'impossible Real rejected by', 'lack affirmed by', 'castrated by refusal of', 'void encountered with', 'abjected by', 'Tower-struck by', 'death card turned by', 'jouissance denied by'],
        'attacked site': ['war-machine versus', 'striated confronting', 'molar opposing', 'death-drive clashing', 'Thanatos engaging', 'aggressive-cathexis toward', 'Mars ascending against', 'Tower-moment with', 'smooth-space colliding', 'chariot reversed to'],
        'hf abducted': ['captured by desiring-machine of', 'stolen into assemblage of', 'reterritorialized by', 'possessed by libidinal economy of', 'seized into Symbolic of', 'Devil-bound to', 'enchained by', 'consumed by body-without-organs of', 'incorporated into', 'subsumed by flows of'],
        'changed creature type': ['becoming-animal through', 'metamorphosis via sorcery of', 'molecular-transformed by', 'transmuted by alchemy of', 'death-and-rebirth under', 'pharmakonic shift by', 'deterritorialized absolutely by', 'magician-worked by', 'threshold-crossed through', 'schizoid-flow altered by'],
        'hfs formed intrigue relationship': ['libidinal conspiracy with', 'unconscious pact between', 'Moon-card weaving', 'shadow-alliance entwining', 'paranoid-machine linking', 'occult geometry binding', 'secret-society formed with', 'hermetic knot between', 'spectral-bond to', 'conspiratorial assemblage'],
        'failed intrigue corruption': ['resisting libidinal capture by', 'foreclosing seduction of', 'refusing reterritorialization by', 'rejecting Devil-pact with', 'escaping desiring-production of', 'negating sublimation by', 'deterritorializing away from trap of', 'severing manipulation of', 'breaking enchantment of', 'line-of-flight from'],
        'hfs formed reputation relationship': ['semiotically entangled with', 'signifier-chained to', 'imaginary-construct alongside', 'reputation-assemblage with', 'symbolic-network connected to', 'collective-unconscious linked', 'fame-rhizome touching', 'archetypal resonance with', 'judgment-card reflected by', 'renown-machine producing with'],
        'entity overthrown': ['supplanted in Name-of-Father by', 'dethroned through death-drive of', 'castration enacted by', 'molar-structure collapsed by', 'Emperor-toppled by', 'sovereign-power seized by', 'Oedipal displacement via', 'smooth-space opened by', 'striated-order broken by', 'regime-change through'],
        'failed frame attempt': ['projection-failure toward', 'paranoid-delusion targeting', 'failed-signification against', 'collapsed-narrative toward', 'Moon-reversed scheming', 'thwarted-semiotics against', 'unsuccessful-encoding of', 'shadow-projection failing on', 'symbolic-trap avoided by', 'misrecognition attempting'],
        'entity persecuted': ['scapegoat-mechanism upon', 'abjection-process targeting', 'paranoid-aggression toward', 'expelled from body-without-organs by', 'purified through sacrifice of', 'Devil-projection onto', 'othering-drive against', 'violent-reterritorialization of', 'casting-out performed by', 'pharmakos-making by'],
        'field battle': ['war-machine collision with', 'Thanatos-expression meeting', 'violent-assemblage engaging', 'death-drive manifesting against', 'Mars-conjunct opposing', 'striated-warfare with', 'aggressive-flows clashing', 'Tower-energy confronting', 'molar-conflict between', 'combat-intensity versus'],
        'hf revived': ['resurrected through sorcery of', 'recalled from death-space by', 'reanimated via necromantic', 'Judgment-reversed through', 'death-and-rebirth cycle by', 'returned from Real by', 'spectral-recall via', 'undead-becoming through', 'life-flow restored by', 'boundary-crossed back through']
    }
    
    # dict events that involve sites
    site_wc_events = {
        'hf destroyed site': ['attacker_hfid', 'site_id'],
        'entity incorporated': ['leader_hfid', 'site_id'],
        'hf attacked site': ['attacker_hfid', 'site_id'],
        'hf preach': ['speaker_hfid', 'site_hfid'],
        'hf confronted': ['hfid', 'site_id'],
        'site dispute': ['site_id_1', 'site_id_2'],
        'gamble': ['gambler_hfid', 'site_id'],
        'created site': ['builder_hfid', 'site_id'],
        'created structure': ['builder_hfid', 'site_id'],
        'hf died': ['hfid', 'slayer_hfid', 'site_id'],
        'change hf state': ['hfid', 'site_id'],
        'created world construction': ['wcid', 'master_wcid', 'site_id1', 'site_id2'],
        'hf recruited unit type for entity': ['hfid', 'site_id'],
        'modified building': ['modifier_hfid', 'site_id'],
        'building profile acquired': ['acquirer_hfid', 'site_id'],
        'written content composed': ['hfid', 'site_id', 'wc_id'],
        'change hf body state': ['hfid', 'site_id']
    }
    
    site_wc_connectors = {
        'hf destroyed site': ['annihilating through death-drive of', 'demolishing smooth-space via', 'razing symbolic-order through', 'Tower-collapse enacted by', 'apocalyptic-flow channeled by', 'destructive-cathexis from', 'war-machine unleashed by', 'dissolving assemblage through', 'violent deterritorialization by', 'entropic manifestation of'],
        'entity incorporated': ['absorbing into body-without-organs via', 'subsuming territory through', 'Oedipal-capture by', 'incorporated into Empire by', 'reterritorialized under sovereign', 'swallowed by molar-structure of', 'assimilated into Symbolic of', 'Emperor-card claimed by', 'annexed into assemblage by', 'integrated through power of'],
        'hf attacked site': ['aggressing upon territory through', 'striking at striated-space via', 'war-machine targeting', 'Mars-energy directed by', 'violent-flow channeled by', 'aggressive-cathexis toward space from', 'attacking assemblage through', 'Tower-moment initiated by', 'invading smooth-space via', 'hostile-intensity from'],
        'hf preach': ['proclaiming at sacred-site through', 'Word-transmission at', 'hierophant-speaking at', 'preaching logos from', 'prophetic-utterance at site by', 'evangelical-assemblage at', 'holy discourse at via', 'Hermit-wisdom shared at by', 'spiritual-flow emanating at from', 'sermon-intensity at through'],
        'hf confronted': ['confronting authority at', 'challenging molar-structure at through', 'defying striated-order at via', 'opposing regime at by', 'resisting at site through', 'rebellious-cathexis at from', 'standing against power at via', 'strength-card manifesting at through', 'insurrection at by', 'contestation at from'],
        'site dispute': ['territorialized conflict between', 'warring assemblages of', 'contesting smooth-spaces', 'rivalry-machine connecting', 'opposed flows between', 'dialectical tension between', 'competitive-cathexis linking', 'Two of Swords between', 'disputed boundary between', 'antagonistic territories'],
        'gamble': ['chance-taking at by', 'Wheel-of-Fortune spinning at through', 'risk-assemblage at via', 'gambling-drive at from', 'fortune-seeking at by', 'aleatory-moment at through', 'betting libidinal-economy at via', 'probability-flux at from', 'wagering intensities at by', 'luck-testing at through'],
        'created site': ['founding territorial-assemblage through', 'establishing striated-space via', 'building world-construction through', 'erecting structure by', 'manifesting place via', 'creative-production of space by', 'territorializing through', 'Magician-manifesting site via', 'architectural-desire of', 'spatial-genesis through'],
        'created structure': ['constructing edifice at via', 'building architectural-assemblage at through', 'erecting monument at by', 'manifesting structure at via', 'creating spatial-machine at through', 'architectural-production at by', 'material-assemblage at via', 'Tower-building at through', 'structuring space at by', 'edifice-becoming at via'],
        'hf died': ['death-event at involving', 'final-severance at through', 'Death-card manifest at via', 'life-extinguished at by', 'mortality-realized at through', 'thanatos-culmination at via', 'perishing at by', 'death-assemblage at linking', 'final-deterritorialization at through', 'cessation at via'],
        'change hf state': ['transformation at of', 'state-shift at affecting', 'metamorphic-event at involving', 'Temperance-change at of', 'condition-altered at for', 'becoming-other at of', 'status-flux at affecting', 'ontological-shift at of', 'transformation-intensity at for', 'state-assemblage changing at'],
        'created world construction': ['cosmic-construction linking', 'world-making assemblage connecting', 'architectural-rhizome between', 'construction-network linking', 'built-environment web connecting', 'spatial-matrix linking', 'World-card manifest linking', 'infrastructural-assemblage between', 'construction-flows connecting', 'built-topology linking'],
        'hf recruited unit type for entity': ['military-assemblage at through', 'recruiting war-machine at via', 'gathering forces at by', 'conscription-event at through', 'soldier-production at by', 'martial-cathexis at via', 'army-building at through', 'militant-assemblage at from', 'recruiting-intensity at by', 'warrior-gathering at via'],
        'modified building': ['altering structure at via', 'transforming edifice at through', 'modifying architectural-assemblage at by', 'reshaping built-space at via', 'renovation-event at through', 'structural-metamorphosis at by', 'rebuilding-assemblage at via', 'architectural-flux at from', 'structure-becoming at through', 'spatial-modification at by'],
        'building profile acquired': ['acquiring architectural-knowledge at through', 'learning structural-form at via', 'mastering building-assemblage at by', 'obtaining construction-gnosis at through', 'architectural-initiation at via', 'building-wisdom acquired at by', 'structural-understanding at from', 'construction-knowledge at through', 'architectural-mastery at via', 'building-profile absorbed at by'],
        'written content composed': ['text-production at linking', 'writing-assemblage at connecting', 'authored-work at via', 'literary-creation at by', 'textual-inscription at through', 'composed-content at linking', 'scribed-work at via', 'written-assemblage at from', 'document-genesis at by', 'text-manifesting at through'],
        'change hf body state': ['corporeal-transformation at of', 'body-metamorphosis at affecting', 'physical-alteration at of', 'flesh-becoming at for', 'bodily-flux at involving', 'somatic-shift at of', 'embodied-change at affecting', 'body-assemblage altered at for', 'physical-state changed at of', 'corporeal-flux at involving']
}
    
    return_value = {}
    event_type = event.get('type')
    
    historical_figures_list = json_legends_clean.get('historical_figures').get('historical_figure')
    hf_name_ids = {hf['id']: hf.get('name', 'Nameless One') for hf in historical_figures_list}
    
    sites_list = json_legends_clean.get('sites').get('site')
    site_name_ids = {site['id']: site.get('name', 'Nameless Place') for site in sites_list}
    
    wc_list = json_legends_clean.get('written_contents', {}).get('written_content', [])
    wc_name_ids = {wc['id']: wc.get('title', 'Nameless Work') for wc in wc_list} if isinstance(wc_list, list) else {}
    
    # hf-hf only events:
    if event_type and event_type in events_hf_id:
        hf_id_keys = events_hf_id[event_type]
        connectors_event = event_connectors.get(event_type, [])
        hf_id_values = [event.get(key) for key in hf_id_keys]
        string = ""
        counter = 0
        total_hf_keys = len(hf_id_keys)
        
        for hf_key, hf_value in zip(hf_id_keys, hf_id_values):
            if hf_value is None:
                continue
            if isinstance(hf_value, list):
                # use the value position (i) as a counter to add connectors between multiple hfs
                for i, v in enumerate(hf_value):
                    hf_name = hf_name_ids.get(str(v), "Nameless One")
                    string += f'<a href="historical_figure_id/{v}">{hf_name}</a>'
                    if i < len(hf_value)-1:
                        # we need the 'and' in case is a list for the str to make sense yk
                        string += ' and ' + f'{random.choice(connectors_event)} '
            else:
                hf_name = hf_name_ids.get(str(hf_value), "Nameless One")
                string += f'<a href="historical_figure_id/{hf_value}">{hf_name}</a>'
            counter += 1
            if counter < total_hf_keys:
                string += f' {random.choice(connectors_event)} '
        if string:
            return_value['event_string'] = string
    
    # hf + site/wc mixed events or only site/wc events
    elif event_type and event_type in site_wc_events:
        keys_list = site_wc_events[event_type]
        connectors = site_wc_connectors.get(event_type, ['at', 'in', 'within'])
        string = ""
        counter = 0
        total_keys = len(keys_list)
        
        for key in keys_list:
            value = event.get(key)
            if value is None:
                continue
            
            # detect id type by key name
            if 'hfid' in key or 'hf_id' in key:
                # if its a historical figure
                if isinstance(value, list):
                    for i, v in enumerate(value):
                        hf_name = hf_name_ids.get(str(v), f"hf {v}")
                        string += f'<a href="historical_figure_id/{v}">{hf_name}</a>'
                        if i < len(value)-1:
                            string += ' and '
                else:
                    hf_name = hf_name_ids.get(str(value), f"hf {value}")
                    string += f'<a href="historical_figure_id/{value}">{hf_name}</a>'
            
            elif 'site_id' in key or 'site_hfid' in key or key.startswith('site_'):
                # site
                if isinstance(value, list):
                    for i, v in enumerate(value):
                        site_name = site_name_ids.get(str(v), f"site {v}")
                        string += f'<a href="site_id/{v}">{site_name}</a>'
                        if i < len(value)-1:
                            string += ' and '
                else:
                    site_name = site_name_ids.get(str(value), f"site {value}")
                    string += f'<a href="site_id/{value}">{site_name}</a>'
            
            elif 'wc' in key or 'written_content' in key:
                #  written content / book
                if isinstance(value, list):
                    for i, v in enumerate(value):
                        wc_title = wc_name_ids.get(str(v), f"text {v}")
                        string += f'<a href="written_work_id/{v}">{wc_title}</a>'
                        if i < len(value)-1:
                            string += ' and '
                else:
                    wc_title = wc_name_ids.get(str(value), f"text {value}")
                    string += f'<a href="written_work_id/{value}">{wc_title}</a>'
            
            else:
                # generic fallback, AI suggestion
                string += f'{key}:{value}'
            
            counter += 1
            if counter < total_keys:
                string += f' {random.choice(connectors)} '
        
        if string:
            return_value['event_string'] = string.strip()
    
    if 'hf_links' not in return_value:
        return_value['hf_links'] = list(filter(lambda p: 'hfid' in p[0], event.items()))
    if 'site_links' not in return_value:
        return_value['site_links'] = list(filter(lambda p: 'site_id' in p[0], event.items()))
    
    return return_value

event_counter = 0
queen_json["historical_events"] = []
# start adding historical events to s**t
for event in json_legends_clean.get('historical_events').get('historical_event'):
    if event_counter%1000 == 0:
        print(event_counter, " historical events processed")
    event_counter += 1
    event_data = translate_event_to_string(event)
    
    if 'event_string' in event_data:
        event_entry = {}
        event_entry['string'] = event_data['event_string']
        event_entry['id'] = event['id']
        queen_json["historical_events"].append(event_entry)

    for k, hf_id in event_data['hf_links']:
        if isinstance(hf_id, list):
            for id in hf_id:
                hf = get_hf_by_id(id)
                if not hf: continue
                if 'historical_events' not in hf:
                    hf['historical_events'] = []
                hf['historical_events'].append(event['id'])
            continue

        hf = get_hf_by_id(hf_id)
        if not hf: continue
        if 'historical_events' not in hf:
            hf['historical_events'] = []
        hf['historical_events'].append(event['id'])
    for k, site_id in event_data['site_links']:
        site = queen_json['sites'][int(site_id)-1]
        if 'historical_events' not in site:
            site['historical_events'] = []
        site['historical_events'].append(event['id'])
    
if not os.path.exists(JSON_PATH):
    os.mkdir(JSON_PATH)

with open(f'{JSON_PATH}/queen.json', 'w', encoding='utf-8') as f:
    json.dump(queen_json, f, ensure_ascii=False, indent=4)

with open(f'{JSON_PATH}/queen.json', encoding="utf-8") as f:
    s = f.read()

with open(f'{JSON_PATH}/queen.json', 'w', encoding="utf-8") as f:
    s = s.replace("the the", "the")
    s = s.replace("the The", "the")
    s = s.replace("The the", "The")
    s = s.replace("The The", "The")
    f.write(s)
print("done, queen! .json <3")