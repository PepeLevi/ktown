import requests
import json
import time

# Test API call
api_key = "sk-52e21581484c4edfa96d0b3932eed47a"
base_url = "https://api.deepseek.com/v1/chat/completions"
model = "deepseek-chat"

system_prompt = """Generate Dwarf Fortress names following theme: "based on quotes spinoza"

Each "part" must be a complete long phrase or sentence. Create unique variations based on the theme.

Output JSON format: [{"index":N,"type":"TYPE","parts":["phrase1","phrase2","phrase3"]}]
Parts count: NAME/CASTE_NAME/NAME_*=3, NOUN/T_WORD=2, ADJ/STATE_NAME*=1, SQUAD=3(keep number), PLANT_NAME=3, VERB=5, CDI_VERB=2-3"""

user_prompt = """THEME: based on quotes spinoza

Generate long phrases based on this theme. Each part must be unique and substantial.

Input: [[0,"NAME"],[1,"CASTE_NAME"],[2,"GENERAL_CHILD_NAME"]]
Output: JSON array with same count. Format: [{"index":N,"type":"TYPE","parts":["phrase1","phrase2","phrase3"]}]

Parts: NAME/CASTE_NAME/NAME_*=3, NOUN/T_WORD=2, ADJ/STATE_NAME*=1, SQUAD=3(keep number), PLANT_NAME=3, VERB=5, CDI_VERB=2-3"""

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

data = {
    "model": model,
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ],
    "temperature": 0.7,
    "max_tokens": 4000
}

print("Testing API call...")
print(f"URL: {base_url}")
print(f"Model: {model}")
print(f"System prompt length: {len(system_prompt)} chars")
print(f"User prompt length: {len(user_prompt)} chars")
print("\nSending request...")

start_time = time.time()

try:
    response = requests.post(base_url, headers=headers, json=data, timeout=120)
    elapsed = time.time() - start_time
    
    print(f"\nResponse time: {elapsed:.2f} seconds")
    print(f"Status code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        print(f"\nResponse length: {len(content)} characters")
        print(f"\nFirst 500 chars of response:")
        print(content[:500])
        print(f"\nLast 500 chars of response:")
        print(content[-500:])
        
        # Try to parse as JSON
        try:
            parsed = json.loads(content)
            print(f"\n✓ Successfully parsed as JSON")
            print(f"Type: {type(parsed)}")
            if isinstance(parsed, list):
                print(f"Array length: {len(parsed)}")
        except json.JSONDecodeError as e:
            print(f"\n✗ Failed to parse as JSON: {e}")
            # Try to find JSON in response
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                print(f"\nFound JSON-like structure, trying to parse...")
                try:
                    parsed = json.loads(json_match.group())
                    print(f"✓ Successfully parsed found JSON")
                except:
                    print(f"✗ Still failed to parse")
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    elapsed = time.time() - start_time
    print(f"\nError after {elapsed:.2f} seconds: {e}")
    import traceback
    traceback.print_exc()

