import sys
import json
import os
import requests
from pathlib import Path

# Testing limit - set to a small number for testing, or None to process all
TEST_LIMIT = 5

# Batch size for API calls
BATCH_SIZE = 5

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

def build_prompt(book_entry):
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
        author_civ = author.get('civilization', 'Unknown')
        prompt_parts.append(f"Author: {author_name} ({author_race})")
        if author_civ and author_civ != 'UNKNOWN':
            prompt_parts.append(f"Civilization: {author_civ}")
    
    # Add page count
    page_count = context.get('page_count', 1)
    prompt_parts.append(f"Length: {page_count} page(s)")
    
    # Add poetic form if applicable
    poetic_form = context.get('poetic_form', '')
    if poetic_form and poetic_form != 'NONE' and poetic_form != '10' and poetic_form != '19':
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
    
    # Add references if any
    references = context.get('references', [])
    if references and len(references) > 0:
        prompt_parts.append("The work may reference historical events, sites, or other works.")
    
    prompt_parts.append("\nGenerate the complete text content for this work, matching the style and length appropriate for the given context.")
    
    return "\n".join(prompt_parts)

def call_deepseek_api(prompt, config):
    """Make an API call to DeepSeek to generate book content"""
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
            "max_tokens": 2000
        }
        
        response = requests.post(
            config.get('deepseek_base_url'),
            headers=headers,
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'choices' in result and len(result['choices']) > 0:
                content = result['choices'][0]['message']['content']
                return content.strip()
            else:
                print(f"Unexpected API response format: {result}")
                return None
        else:
            print(f"API call failed with status {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        print(f"Error calling DeepSeek API: {e}")
        return None

def process_books(json_path, config):
    """Process books in the JSON file, generating content for those with empty text_content"""
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
        if not text_content or text_content.strip() == '':
            books_to_process.append((key, book_entry))
    
    if not books_to_process:
        print("No books with empty text_content found")
        return True
    
    print(f"Found {len(books_to_process)} books with empty text_content")
    
    # Apply test limit if set
    if TEST_LIMIT:
        books_to_process = books_to_process[:TEST_LIMIT]
        print(f"Processing {len(books_to_process)} books (TEST_LIMIT={TEST_LIMIT})")
    
    # Process books in batches
    processed_count = 0
    failed_count = 0
    
    for i in range(0, len(books_to_process), BATCH_SIZE):
        batch = books_to_process[i:i + BATCH_SIZE]
        print(f"\nProcessing batch {i // BATCH_SIZE + 1} ({len(batch)} books)...")
        
        for key, book_entry in batch:
            print(f"  Generating content for book {key}: '{book_entry.get('title', 'Untitled')}'")
            
            prompt = build_prompt(book_entry)
            content = call_deepseek_api(prompt, config)
            
            if content:
                data['data'][key]['text_content'] = content
                processed_count += 1
                print(f"    ✓ Success")
            else:
                failed_count += 1
                print(f"    ✗ Failed to generate content")
        
        # Save after each batch to avoid losing progress
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  Saved progress after batch")
        except Exception as e:
            print(f"  Error saving JSON: {e}")
    
    print(f"\nCompleted: {processed_count} successful, {failed_count} failed")
    return True

def main():
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
    
    # Process the books
    process_books(json_path, config)

if __name__ == "__main__":
    main()
