# Wayward Tarnished Library Studio

A browser-based editor for creating Wayward Tarnished enemy libraries. It runs entirely in the browser and is designed for GitHub Pages.

## What it edits

- Fixed Tarnished builds with level loadouts. Every slot holds one item or a weighted list of options (one is picked per Tarnished); armor is picked per piece or as whole sets; loadouts that share a level are weighted variants; arrows and bolts; a great rune (or options, with "No great rune" among them).
- Strength-style random class pools, grouped into weapons, catalysts, complete armor presets, talismans, spells, Ashes of War and great runes.
- Great runes: Godrick's, Radahn's, Morgott's, Rykard's, Mohg's and Malenia's, with their effect shown beside each; the mod applies the effect from the Tarnished's arrival, as after a Rune Arc. An option's level is a hard limit: a great rune never comes before it.
- Per-choice minimum level and selection weight (defaults: level 1, weight 10, as in the mod).
- Consumables: the shared pool and how many different ones each Tarnished carries (shared or per entry), plus per-entry **Use shared pool**, **Carry none** and **Own list** states. Only goods the player-like AI can use (`EquipParamGoods.aiUseJudgeId`) are offered, with counts capped at the stack size.
- Item pickers with game icons for weapons, armor, talismans, spells, Ashes of War, ammunition and consumables. Ashes of War are grouped by whether they fit the chosen weapon and affinity; affinity and upgrade limits follow the weapon.
- Starting classes or custom starting attributes, roles (invader, hunter, host, cooperator and summon; hunters can also be summoned), level range, PvP damage and the Shadow of the Erdtree flag. Without the DLC the mod leaves its items out of every entry; the flag leaves out a whole entry built around them, and validation warns when an entry without it would have nothing left to fight with.
- How often each Tarnished appears: a selection weight or a fixed `chance` per entry, `[chances]` percentages for the named, fixed-build and class-library groups, and a table of every entry's odds per role and player level, as the mod computes them.
- Attributes: growth weights with their share of the points, `[[tarnished.stats]]` stat plans by level, and a guide with examples and the soft caps. **Preview growth** shows the attributes at every level, split into class, gear requirements, stat plan and growth.
- **Test build** creates one complete Tarnished the way the mod does in game (level spread, loadout or class-library draw within its points, requirements, stat plan, growth, weapon upgrades, style, gestures, consumables), so a build can be checked before it is installed. **Roll who appears** draws the entry by the odds first. A switch builds it as for a player without Shadow of the Erdtree, and a **two-handed** tag marks a paired weapon (fists, claws, perfume bottles, ...) the mod makes it two-hand.
- Names (the shared names, one list for either sex, or a list per sex) and title patterns with a count each (a title listed twice comes twice as often; a plain `{name}` gives the bare name).
- AI personalities: each Tarnished's styles, the library of vanilla styles (a named NPC invader's personality SpEffect) and any number of custom personalities. A Tarnished gets one of its styles at random each time it appears; the only limit is that the Tarnished in your world at the same moment can use at most five different custom personalities between them (vanilla styles have no limit), and the page explains this with an example. The personality editor explains every action and how its number is used: main actions are weighted choices, reactions share a 1–100 roll, and chances are percentages. Every style and personality has a description, shown on hover; descriptions are saved as TOML comments, since the mod rejects unknown keys. **Presets**: the styles and personalities of the mod's base.toml, and any you save in this browser (new personalities are saved by default, others with the star), are offered in every file you open or start, even a new one; a preset goes into a file only when one of its Tarnished uses it, and **Download TOML** adds any a file uses but does not define.
- Greeting and victory gestures with explicit **Inherit shared**, **Never** and **Custom selection** states.
- Shared names and gesture pools.
- Complete TOML source for templates, faces, custom attributes and future format fields.

The app automatically stores an unfinished draft in browser storage. **Open** reads a local `.toml` file; **Download TOML** validates and exports the current library. No file is installed into the mod automatically.

## Item rules

The test builds need weapon and spell requirements, equip weights, catalyst types, talisman groups and Ash of War compatibility. `public/catalog/rules.json` holds them, exported from the game's `regulation.bin` with the mod's own param reader:

```text
python scripts/export_rules.py "../Wayward Tarnished" [path\to\regulation.bin]
```

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

Elden Ring and its item names, icons and other game data are the property of FROM SOFTWARE Inc. and Bandai Namco Entertainment. The icons in `public/catalog/icons.db` and the item data in `public/catalog/items.json` and `public/catalog/rules.json` were extracted from the game and are not covered by the MIT License. This is an unofficial fan project, not affiliated with or endorsed by either company.
