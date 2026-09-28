"""Export the item rules the build preview needs from regulation.bin into public/catalog/rules.json.

The preview mirrors the mod's build resolution (src/library.rs), which reads these params:
weapon and spell requirements, equip weights, catalyst types, paired weapons (two-handed by the mod),
talisman groups and which Ashes of War fit which weapons.

Usage: python scripts/export_rules.py <Wayward Tarnished repo> [regulation.bin]
"""
import json
import os
import sys

MOD = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "Wayward Tarnished")
sys.path.insert(0, os.path.join(MOD, "research"))
if len(sys.argv) > 2:
    sys.argv = [sys.argv[0], sys.argv[2]]
else:
    sys.argv = [sys.argv[0]]
import check_library  # noqa: E402  (reads sys.argv for the regulation path)

OUTPUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "catalog", "rules.json")


def main():
    version, files = check_library.load_params()
    read = lambda name: check_library.read(files, name, version)
    reinforce = read("ReinforceParamWeapon")
    maximum = lambda row: max((level for level in range(26) if row["reinforceTypeId"] + level in reinforce), default=0)
    weapons = {}
    for row_id, row in read("EquipParamWeapon").items():
        if row_id <= 0 or row_id % 100:
            continue
        weapons[row_id] = [row["properStrength"], row["properAgility"], row["properMagic"], row["properFaith"],
                           row["properLuck"], round(row["weight"], 2), row["wepType"], row["gemMountType"], maximum(row),
                           1 if row["isDualBlade"] else 0]
    spells = {}
    for row_id, row in read("Magic").items():
        if row_id <= 0:
            continue
        spells[row_id] = [row["requirementIntellect"], row["requirementFaith"], row["requirementLuck"],
                          row["ezStateBehaviorType"], 1 if check_library.heals(row) else 0]
    armor = {row_id: round(row["weight"], 2) for row_id, row in read("EquipParamProtector").items() if row_id > 0}
    talismans = {row_id: row["accessoryGroup"] for row_id, row in read("EquipParamAccessory").items() if row_id > 0}
    gems = {}
    for row_id, row in read("EquipParamGem").items():
        if row_id <= 0 or row["sortId"] == 999999:
            continue
        types = [kind for kind, flag in check_library.MOUNT_FLAGS.items() if row.get(f"canMountWep_{flag}") == 1]
        affinities = sum(1 << index for index in range(24) if row.get(f"configurableWepAttr{index:02d}") == 1)
        gems[row_id] = [types, affinities]
    rules = {"version": version, "weapons": weapons, "spells": spells, "armor": armor, "talismans": talismans, "gems": gems}
    with open(OUTPUT, "w", encoding="utf-8") as output:
        json.dump(rules, output, separators=(",", ":"))
    print(f"{OUTPUT}: {len(weapons)} weapons, {len(spells)} spells, {len(armor)} armor, {len(talismans)} talismans, {len(gems)} ashes")


if __name__ == "__main__":
    main()
