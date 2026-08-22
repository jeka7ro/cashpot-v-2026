import os
import glob
import requests
import json
import time

files = sorted(glob.glob('./Craiova_Short/*.pdf'))
urls = {}

print("Uploading short Craiova contracts to tmpfiles.org...")
for fpath in files:
    fname = os.path.basename(fpath)
    print(f"Uploading {fname}...")
    try:
        with open(fpath, 'rb') as f:
            res = requests.post('https://tmpfiles.org/api/v1/upload', files={'file': f})
            if res.status_code == 200:
                data = res.json()
                if data.get('status') == 'success':
                    # To get direct download link, replace tmpfiles.org/ with tmpfiles.org/dl/
                    dl_url = data['data']['url'].replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/')
                    urls[fname] = dl_url
                    print(f"Uploaded successfully: {dl_url}")
                else:
                    print(f"Failed to parse success: {data}")
            else:
                print(f"Failed to upload {fname}, status code {res.status_code}: {res.text}")
        # Sleep 1s to avoid rate limiting
        time.sleep(1)
    except Exception as e:
        print(f"Error uploading {fname}: {e}")

with open('craiova_links.json', 'w') as out:
    json.dump(urls, out, indent=2)

print("\nAll uploads finished! Saved links to craiova_links.json")
