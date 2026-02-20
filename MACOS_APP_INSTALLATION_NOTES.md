# macOS App Installation Best Practices

## Critical: Use `ditto` for Copying .app Bundles

When installing macOS applications from DMG files, **always use `ditto`** instead of `cp` to preserve code signatures and avoid Gatekeeper issues.

### Correct Method
```bash
ditto "/Volumes/App Name/App.app" "/Applications/App.app"
```

### Why `ditto` is Required

1. **Preserves Extended Attributes**: Code signature metadata is stored in extended attributes
2. **Maintains Code Signing**: Prevents "app is damaged" Gatekeeper warnings
3. **Complete Bundle Copy**: Handles all special macOS bundle structures correctly

### Why `cp -rp` is Insufficient

- `cp -rp` preserves permissions and timestamps only
- Does NOT preserve extended attributes (where code signatures live)
- Can break code signatures and trigger Gatekeeper warnings
- May cause apps to fail with "app is damaged" errors

### Installation Process Example

```bash
# 1. Download and mount DMG
hdiutil attach /path/to/app.dmg

# 2. Remove old version if exists
rm -rf /Applications/App.app

# 3. Copy using ditto (CRITICAL)
ditto "/Volumes/App Name/App.app" "/Applications/App.app"

# 4. Unmount DMG
hdiutil detach /dev/diskX

# 5. Launch app
open /Applications/App.app
```

### Verification

Check code signature is preserved:
```bash
codesign -vvv --deep --strict /Applications/App.app
```

Should show: "valid on disk" and "satisfies its Designated Requirement"

### Troubleshooting

If app still won't open:
```bash
# Remove quarantine flag if present
xattr -d com.apple.quarantine /Applications/App.app

# Or manually approve in System Preferences > Security & Privacy
```

## References

- Apple Developer Documentation: [Code Signing Requirements](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- macOS Security Guide: [Gatekeeper and App Signing](https://support.apple.com/guide/security/sec55e0b2e4b/web)
