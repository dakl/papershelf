import json

with open('releases.json', 'r') as f:
    releases = json.load(f)

print("Version | Published Date | DMG Downloads | ZIP Downloads | Total")
print("---|---|---|---|---")

for release in releases:
    tag_name = release['tag_name']
    published_at = release['published_at']
    
    dmg_downloads = 0
    zip_downloads = 0
    
    for asset in release['assets']:
        if asset['name'].endswith('.dmg'):
            dmg_downloads = asset['download_count']
        elif asset['name'].endswith('.zip'):
            zip_downloads = asset['download_count']
    
    total = dmg_downloads + zip_downloads
    print(f"{tag_name} | {published_at} | {dmg_downloads} | {zip_downloads} | {total}")
