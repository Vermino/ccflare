# ccflare Desktop Icons

This directory should contain the application icons in the following formats:

## Required Icons

- `32x32.png` - 32x32 pixel PNG icon
- `128x128.png` - 128x128 pixel PNG icon  
- `128x128@2x.png` - 256x256 pixel PNG icon (2x scale)
- `icon.icns` - macOS ICNS icon bundle
- `icon.ico` - Windows ICO icon file

## Icon Guidelines

- Use the ccflare shield/proxy theme
- Colors: Primary blue (#3b82f6) with dark accents
- Style: Modern, clean, recognizable at small sizes
- Include transparency where appropriate

## Generating Icons

You can use tools like:
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [tauri-icon](https://github.com/tauri-apps/tauri-icon)
- [icon-gen](https://www.npmjs.com/package/icon-gen)

## Temporary Workaround

For development, you can disable icon requirements in `tauri.conf.json` by removing the `icon` array from the `bundle` section.