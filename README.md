# Wayward Tarnished Library Studio

A browser-based editor for creating Wayward Tarnished enemy libraries. It runs entirely in the browser and is designed for GitHub Pages.

## What it edits

- Fixed Tarnished builds with level-based equipment loadouts.
- Strength-style random class pools, grouped into weapons, catalysts, complete armor presets, talismans, spells and Ashes of War.
- Per-choice minimum level and selection weight (defaults: level 1, weight 10, as in the mod).
- Consumables: the shared pool and how many different ones each Tarnished carries, plus per-entry **Use shared pool**, **Carry none** and **Own list** states. Only goods the player-like AI can use (`EquipParamGoods.aiUseJudgeId`) are offered, with counts capped at the stack size.
- Item pickers with game icons for weapons, armor, talismans, spells, Ashes of War and consumables. Ashes of War are grouped by whether they fit the chosen weapon and affinity; affinity and upgrade limits follow the weapon.
- Starting classes, roles, level range, selection weight, attribute growth and runtime flags.
- Names and title patterns.
- AI personalities: each Tarnished's styles, the library of vanilla styles (a named NPC invader's personality SpEffect) and custom personalities (per-action odds written into one of the mod's five personality slots). Every style and personality has a description, shown on hover; descriptions are saved as TOML comments, since the mod rejects unknown keys. Replacing a personality in a slot moves the Tarnished that used it to the new one, and validation warns when a personality would compete with `base.toml` for a slot.
- Greeting and victory gestures with explicit **Inherit shared**, **Never** and **Custom selection** states.
- Shared names and gesture pools.
- Complete TOML source for templates, faces, custom attributes and future format fields.

The app automatically stores an unfinished draft in browser storage. **Open** reads a local `.toml` file; **Download TOML** validates and exports the current library. No file is installed into the mod automatically.

## Development

Requirements: Node.js 22 and pnpm 10.

```text
pnpm install
pnpm dev
pnpm test
pnpm run build
```

The production site is written to `dist`. The Vite base path is relative, so the same build works at a GitHub project Pages URL or another static host.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` validates and builds the app on every push to `main`, then deploys `dist` with GitHub Pages. In the repository, choose **Settings → Pages → Source: GitHub Actions** once if GitHub does not select it automatically.

## License

The source code is released under the [MIT License](LICENSE).

Elden Ring and its item names, icons and other game data are the property of FROM SOFTWARE Inc. and Bandai Namco Entertainment. The icons in `public/catalog/icons.db` and the item data in `public/catalog/items.json` were extracted from the game and are not covered by the MIT License. This is an unofficial fan project, not affiliated with or endorsed by either company.
