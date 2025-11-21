import sys
import json
import os
import asyncio
import aiohttp
from pathlib import Path

# Testing limit - set to a small number for testing, or None to process all
TEST_LIMIT = 60

# Batch size for API calls
BATCH_SIZE = 30

# Rate limiting - adjust based on API limits
MAX_CONCURRENT_REQUESTS = 30
REQUEST_DELAY = 0.1  # seconds between requests

# max tokens per call. limits cost and time
MAX_TOKENS = 500 # default was 2000

# amount of words the model should aim for. decrease so it doesnt cut the text off when it runs out of tokens
MAX_WORDS = 300

SKIPPING_WORK_TYPES = []
# SKIPPING_WORK_TYPES = ['Poem', 'MusicalComposition', 'Choreography']


def load_api_config():
    """Load API configuration from config_api.json in repo root"""
    repo_root = Path(__file__).parent.parent.parent
    config_path = repo_root / "config_api.json"
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"Error loading API config: {e}")
        return None

def build_prompt(book_entry, all_books_data, config):
    """Build a prompt for generating book content based on the book's context"""
    context = book_entry.get('context_points', {})
    title = book_entry.get('title', 'Untitled')
    work_type = context.get('work_type', 'Unknown')
    
    prompt_parts = [f"Generate the full text content for a {work_type} titled '{title}'."]
    
    # Add author information
    author = context.get('author', {})
    if author:
        author_name = author.get('name', 'Unknown')
        author_race = author.get('race', 'Unknown')
        author_id = book_entry.get('author_hfid', 'Unknown')
        author_civ = author.get('civilization', 'Unknown')
        author_civ_id = author.get('civilization_id', 'Unknown')
        prompt_parts.append(f"Author: {author_name} ({author_race}), historical_figure_id:{author_id})")
        if author_civ and author_civ != 'UNKNOWN':
            prompt_parts.append(f"Civilization: {author_civ}, civilization_id:{author_civ_id}")
    
    # Add page count
    page_count = context.get('page_count', 1)
    prompt_parts.append(f"Length: {page_count} page(s)")
    
    # Add poetic form if applicable
    poetic_form = context.get('poetic_form', '')
    if poetic_form:
        if isinstance(poetic_form, dict):
            # Handle dict format with name, mood, features, etc.
            form_name = poetic_form.get('name', '')
            form_mood = poetic_form.get('mood', '')
            form_features = poetic_form.get('features', {})
            
            form_parts = []
            if form_name:
                form_parts.append(form_name)
            if form_mood and form_mood is not False:
                form_parts.append(f"mood: {form_mood}")
            if form_features:
                feature_list = []
                if isinstance(form_features, dict):
                    for feat_key, feat_value in form_features.items():
                        if isinstance(feat_value, str):
                            feature_list.append(feat_value)
                        elif isinstance(feat_value, (int, float)):
                            feature_list.append(str(feat_value))
                elif isinstance(form_features, list):
                    feature_list = [str(f) for f in form_features if f]
                if feature_list:
                    form_parts.append(f"features: {', '.join(feature_list)}")
            
            if form_parts:
                prompt_parts.append(f"Poetic form: {'; '.join(form_parts)}")
        elif isinstance(poetic_form, str) and poetic_form not in ('NONE', '10', '19', ''):
            prompt_parts.append(f"Poetic form: {poetic_form}")
    
    # Add styles
    styles = context.get('styles', {})
    if styles:
        style_descriptions = []
        for style_key, style_data in styles.items():
            if isinstance(style_data, dict):
                style_name = style_data.get('style', '')
                strength = style_data.get('strength', 0)
                if style_name:
                    style_descriptions.append(f"{style_name} (strength: {strength})")
        if style_descriptions:
            prompt_parts.append(f"Writing styles: {', '.join(style_descriptions)}")
    
    # Handle references - check for written content references
    references = context.get('references', {})
    written_content_refs = []
    
    if references:
        # Handle both dict and list formats
        if isinstance(references, dict):
            ref_items = references.items()
        elif isinstance(references, list):
            ref_items = enumerate(references)
        else:
            ref_items = []
        
        for ref_key, ref_data in ref_items:
            if isinstance(ref_data, dict):
                ref_type = ref_data.get('reference_type', '')
                if ref_type == 'written content':
                    written_content_id = ref_data.get('written_content_id')
                    if written_content_id is not None and all_books_data:
                        # Look up the referenced work
                        ref_id_str = str(written_content_id)
                        if ref_id_str in all_books_data:
                            if all_books_data[ref_id_str].get('text_content', '') == '':
                                print("oops generating necessary reference first: ", ref_id_str)
                                # Note: first i made this already get the reference.
                                # now im making it wait so it first does all the books without 
                                # written content references and then it takes the rest in a next pass.
                                return(False)
                            written_content_refs.append([ref_id_str, all_books_data[ref_id_str]])
    
    # Add information about referenced written works
    if written_content_refs:
        prompt_parts.append("\nThis work references the following written work(s):")
        for ref_work in written_content_refs:
            ref_context = ref_work[1].get('context_points', {})
            ref_title = ref_work[1].get('title', 'Untitled')
            ref_work_type = ref_context.get('work_type', 'Unknown')
            
            ref_info = [f"  - '{ref_title}' ({ref_work_type}) written_work_id:{ref_work[0]}"]
            
            # Add referenced work's author
            ref_author = ref_context.get('author', {})
            if ref_author:
                ref_author_name = ref_author.get('name', 'Unknown')
                ref_author_race = ref_author.get('race', 'Unknown')
                ref_info.append(f"    Author: {ref_author_name} ({ref_author_race})")
            
            # Add referenced work's page count
            ref_page_count = ref_context.get('page_count', 1)
            ref_info.append(f"    Length: {ref_page_count} page(s)")
            
            # Add referenced work's poetic form if applicable
            ref_poetic_form = ref_context.get('poetic_form', '')
            if ref_poetic_form:
                if isinstance(ref_poetic_form, dict):
                    # Handle dict format with name, mood, features, etc.
                    ref_form_name = ref_poetic_form.get('name', '')
                    ref_form_mood = ref_poetic_form.get('mood', '')
                    ref_form_features = ref_poetic_form.get('features', {})
                    
                    ref_form_parts = []
                    if ref_form_name:
                        ref_form_parts.append(ref_form_name)
                    if ref_form_mood and ref_form_mood is not False:
                        ref_form_parts.append(f"mood: {ref_form_mood}")
                    if ref_form_features:
                        ref_feature_list = []
                        if isinstance(ref_form_features, dict):
                            for ref_feat_key, ref_feat_value in ref_form_features.items():
                                if isinstance(ref_feat_value, str):
                                    ref_feature_list.append(ref_feat_value)
                                elif isinstance(ref_feat_value, (int, float)):
                                    ref_feature_list.append(str(ref_feat_value))
                        elif isinstance(ref_form_features, list):
                            ref_feature_list = [str(f) for f in ref_form_features if f]
                        if ref_feature_list:
                            ref_form_parts.append(f"features: {', '.join(ref_feature_list)}")
                    
                    if ref_form_parts:
                        ref_info.append(f"    Poetic form: {'; '.join(ref_form_parts)}")
                elif isinstance(ref_poetic_form, str) and ref_poetic_form not in ('NONE', '10', '19', ''):
                    ref_info.append(f"    Poetic form: {ref_poetic_form}")
            
            # Add referenced work's styles
            ref_styles = ref_context.get('styles', {})
            if ref_styles:
                ref_style_descriptions = []
                for ref_style_key, ref_style_data in ref_styles.items():
                    if isinstance(ref_style_data, dict):
                        ref_style_name = ref_style_data.get('style', '')
                        ref_strength = ref_style_data.get('strength', 0)
                        if ref_style_name:
                            ref_style_descriptions.append(f"{ref_style_name} (strength: {ref_strength})")
                if ref_style_descriptions:
                    ref_info.append(f"    Writing styles: {', '.join(ref_style_descriptions)}")
            
            prompt_parts.append("\n".join(ref_info))
            
            # Add referenced work's text content if available
            ref_text_content = ref_work[1].get('text_content', '')
            if ref_text_content and ref_text_content.strip():
                prompt_parts.append(f"    Full text of '{ref_title}':")
                prompt_parts.append(f"    {ref_text_content}")
    
    # Add other references (non-written content) if any
    if references:
        has_other_refs = False
        if isinstance(references, dict):
            ref_items = references.items()
        elif isinstance(references, list):
            ref_items = enumerate(references)
        else:
            ref_items = []
        
        for ref_key, ref_data in ref_items:
            if isinstance(ref_data, dict):
                ref_type = ref_data.get('reference_type', '')
                if ref_type == 'knowledge':
                    prompt_parts.append("\nThe work is an academic work concerning the topic(s) of: ")
                    for topic_key, topic in ref_data.get('topics', 'unknown').items():
                        prompt_parts.append(topic + ', ')
                elif ref_type == 'historical event':
                    prompt_parts.append("\nThe work references a historical event in the year " + str(ref_data.get('event').get('year', 'unkown')) if  ref_data.get('event', False) else 'Unknown' + '. historical_event_id:' + str(ref_data.get('event').get('id', 'unkown')))
                elif ref_type == 'site':
                    prompt_parts.append("\nThe work references the location " + ref_data.get('site').get('site_name')  + '. site_id:' + str(ref_data.get('site').get('id')))
                elif ref_type == 'value level':
                    level = 'strongly' if ref_data.get('level', 0) > 25 else 'mildly' 
                    prompt_parts.append("\nThe work " + level + " emphasizes the value of " + ref_data.get('value','unkown'))
                else:
                    has_other_refs = True
                    break
        
        # if has_other_refs:
        #     prompt_parts.append("\nThe work may also reference historical events, sites, or other knowledge.")
    
    prompt_parts.append(f"\nGenerate the complete text content for this work, matching the style and length appropriate for the given context. Only write the text itself, and try to stick to {MAX_WORDS} words: for longer works write only an excerpt or preface. Whenever mentioning information that has an associated ID, create a hyperlink in the text using HTML syntax mentioning the type of reference (historical figure, civilization, written work, etc.) and the corresponding ID, for example: <a href=\"historical_figure_id/456\">Alex Jones</a>. Do not make up hyperlinks with IDs that are not explicitly in the prompt.")
    
    return "\n".join(prompt_parts)

async def call_deepseek_api(session, prompt, config, semaphore):
    """Make an async API call to DeepSeek to generate book content"""
    async with semaphore:
        try:
            headers = {
                "Content-Type": "application/json",
            }
            
            # Add API key to headers if provided
            if config.get('deepseek_api_key'):
                headers["Authorization"] = f"Bearer {config['deepseek_api_key']}"
            
            payload = {
                "model": config.get('deepseek_model', 'deepseek-chat'),
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.7,
                "max_tokens": MAX_TOKENS
            }
            
            async with session.post(
                config.get('deepseek_base_url'),
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=60)
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    if 'choices' in result and len(result['choices']) > 0:
                        content = result['choices'][0]['message']['content']
                        return content.strip()
                    else:
                        print(f"Unexpected API response format: {result}")
                        return None
                else:
                    print(f"API call failed with status {response.status}: {await response.text()}")
                    return None
                    
        except Exception as e:
            print(f"Error calling DeepSeek API: {e}")
            return None
        finally:
            # Small delay to respect rate limits
            await asyncio.sleep(REQUEST_DELAY)

async def process_batch(session, batch, data, config, semaphore):
    """Process a batch of books concurrently"""
    tasks = []
    
    for key, book_entry, prompt in batch:
        print(f"  Generating content for book {key}: '{book_entry.get('title', 'Untitled')}'")
        print(prompt)
        
        task = call_deepseek_api(session, prompt, config, semaphore)
        tasks.append((key, task))
    
    # Wait for all API calls to complete
    results = []
    for key, task in tasks:
        content = await task
        results.append((key, content))
    
    # Update data with results
    for key, content in results:
        if content:
            data[key]['text_content'] = content
            print(f"    ✓ Success for {key}")
        else:
            print(f"    ✗ Failed to generate content for {key}")
    
    return len([r for r in results if r[1] is not None]), len([r for r in results if r[1] is None])

async def process_books_async(json_path, config):
    """Process books in the JSON file asynchronously, generating content for those with empty text_content"""
    # Load the JSON file
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return False
    
    if 'data' not in data:
        print("JSON file missing 'data' key")
        return False
    
    # Find books with empty text_content
    books_to_process = []
    for key, book_entry in data['data'].items():
        text_content = book_entry.get('text_content', '')
        if (not text_content or text_content.strip() == '') and book_entry.get('context_points', '').get('work_type') not in SKIPPING_WORK_TYPES:
            books_to_process.append((key, book_entry))
    
    if not books_to_process:
        print("No books with empty text_content found")
        return True
    
    print(f"Found {len(books_to_process)} books with empty text_content")
    
    # Apply test limit if set
    if TEST_LIMIT:
        # books_to_process = books_to_process[len(books_to_process)-TEST_LIMIT:]
        books_to_process = books_to_process[:TEST_LIMIT]
        print(f"Processing {len(books_to_process)} books (TEST_LIMIT={TEST_LIMIT})")
    
    # Build prompts for all books first
    print("Building prompts for all books...")
    books_with_prompts = []
    for key, book_entry in books_to_process:
        if data['data'][key].get('text_content', '') != '':
            print(f"Book {key} already filled, skipping")
            continue
        prompt = build_prompt(book_entry, data['data'], config)

        # if it relies on an unwritten reference im telling it to skip for now
        if not prompt: 
            continue

        books_with_prompts.append((key, book_entry, prompt))
    
    # Set up semaphore for rate limiting
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    # Process books in batches
    total_processed = 0
    total_failed = 0
    
    async with aiohttp.ClientSession() as session:
        for i in range(0, len(books_with_prompts), BATCH_SIZE):
            batch = books_with_prompts[i:i + BATCH_SIZE]
            print(f"\nProcessing batch {i // BATCH_SIZE + 1} ({len(batch)} books)...")
            
            processed, failed = await process_batch(session, batch, data['data'], config, semaphore)
            total_processed += processed
            total_failed += failed
            
            # Save after each batch to avoid losing progress
            try:
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                with open('enhanced_books_backup.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"  Saved progress after batch")
            except Exception as e:
                print(f"  Error saving JSON: {e}")
    
    print(f"\nCompleted: {total_processed} successful, {total_failed} failed, out of {len(books_to_process)} total books")

    if(len(books_to_process) > total_processed):
        print("doing another recursion for references")
        await process_books_async(json_path, config)

    return True

async def main_async():
    if len(sys.argv) < 2:
        print("Usage: python request_book_content.py <save_path>")
        return
    
    # Get the save path (spaces are replaced with + in the lua script)
    save_path = sys.argv[1].replace('+', ' ')
    json_path = os.path.join(save_path, 'enhanced_books.json')
    
    print(f"Processing books from: {json_path}")
    
    # Check if JSON file exists
    if not os.path.exists(json_path):
        print(f"JSON file not found: {json_path}")
        return
    
    # Load API configuration
    config = load_api_config()
    if not config:
        print("Failed to load API configuration")
        return
    
    # Process the books asynchronously
    await process_books_async(json_path, config)

def main():
    # Run the async main function
    asyncio.run(main_async())

if __name__ == "__main__":
    main()