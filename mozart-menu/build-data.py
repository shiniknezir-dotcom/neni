#!/usr/bin/env python3
"""Assemble menu-data.js from the bilingual section files.

Usage: python3 build-data.py <workdir>
  <workdir>/menu-de.json         canonical German menu (info + legend + section order)
  <workdir>/sections/<id>.json   bilingual section files
Writes mozart-menu/menu-data.js and prints a summary. Also writes data/menu.json (the same data as plain JSON).
"""
import json, os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = sys.argv[1]
de = json.load(open(os.path.join(WORK, "menu-de.json"), encoding="utf-8"))

# Food vs drinks and the "tempo" eyebrow shown above each section title (musical markings; language-neutral)
GROUP = {
    "fruehstueck": "food", "eier": "food", "kleiner-hunger": "food", "ofenkartoffel": "food", "flammkuchen": "food",
    "essen": "food", "hauptspeisen": "food", "suesses": "food",
}
TEMPO = {
    "fruehstueck": "Ouvertüre", "eier": "Allegro", "kleiner-hunger": "Intermezzo", "ofenkartoffel": "Divertimento",
    "flammkuchen": "Capriccio", "essen": "Sinfonia", "hauptspeisen": "Finale", "suesses": "Dolce",
    "kaffee": "Andante", "heisses": "Con calore", "tee": "Adagio", "gesund": "Vivace", "saftbar": "Giocoso",
    "erfrischendes": "Scherzo", "prosecco": "Brillante", "biere": "Maestoso", "weine-international": "Cantabile",
    "weine-franken-offen": "Serenade", "weine-franken-flaschen": "Sonate", "grappa-obstbrand": "Con fuoco",
    "whisky": "Grave", "cocktails": "Eine kleine Nachtmusik",
}
# English for the printed legend (standard EU allergen wording)
LEGEND_EN = {
    "A": "with colouring", "B": "with preservatives", "C": "contains caffeine", "D": "contains quinine",
    "E": "with sweeteners", "F": "contains a source of phenylalanine", "G": "with antioxidants",
    "1": "cereals containing gluten*", "1a": "wheat", "1b": "rye", "1c": "barley", "2": "crustaceans*", "3": "eggs*",
    "4": "fish*", "5": "peanuts*", "6": "soybeans*", "7": "milk incl. lactose*", "8": "nuts*", "8a": "almonds",
    "8b": "hazelnuts", "8c": "walnuts", "8d": "macadamia", "9": "celery*", "10": "mustard*", "11": "sesame seeds*",
    "12": "sulphur dioxide and sulphites*", "13": "lupin*", "14": "molluscs*",
}

def bil(v):
    if isinstance(v, dict):
        return {"de": v.get("de", "") or "", "en": v.get("en", "") or v.get("de", "") or ""}
    return {"de": v or "", "en": v or ""}

def norm_code(c):
    return re.sub(r"[)\s]", "", str(c))

sections = []
missing = []
for s in de["sections"]:
    p = os.path.join(WORK, "sections", f"{s['id']}.json")
    if not os.path.exists(p):
        missing.append(s["id"]); continue
    b = json.load(open(p, encoding="utf-8"))
    sec = {
        "id": s["id"], "group": GROUP.get(s["id"], "drinks"), "tempo": TEMPO.get(s["id"], ""),
        "title": bil(b.get("title")), "subtitle": bil(b.get("subtitle")), "note": bil(b.get("note")),
        "side_text": bil(b.get("side_text")), "source_pages": b.get("source_pages", s.get("source_pages", [])),
        "groups": [],
    }
    for g in b.get("groups", []):
        grp = {"title": bil(g.get("title")), "note": bil(g.get("note")), "items": []}
        for it in g.get("items", []):
            prices = []
            for pr in it.get("prices", []) or []:
                if pr is None: continue
                price = pr.get("price")
                if isinstance(price, str):
                    price = float(price.replace(",", ".")) if price.strip() else None
                prices.append({"size": pr.get("size", "") or "", "price": price})
            grp["items"].append({
                "name": bil(it.get("name")), "description": bil(it.get("description")),
                "allergens": (it.get("allergens") or "").replace(" ", ""), "prices": prices,
                "tags": it.get("tags", []) or [], "uncertain": bool(it.get("uncertain")), "remark": it.get("remark", "") or "",
            })
        sec["groups"].append(grp)
    sections.append(sec)

legend = de.get("legend", {})
out = {
    "info": {
        **de.get("info", {}),
        "hours": {"de": de.get("info", {}).get("hours", "Montag bis Sonntag 9.00 bis 23.00"), "en": "Monday to Sunday 9 am – 11 pm"},
    },
    "legend": {
        "allergens": [{"code": norm_code(e["code"]), "de": e["text"], "en": LEGEND_EN.get(norm_code(e["code"]), e["text"])} for e in legend.get("allergens", [])],
        "additives": [{"code": norm_code(e["code"]), "de": e["text"], "en": LEGEND_EN.get(norm_code(e["code"]), e["text"])} for e in legend.get("additives", [])],
        "footnote": {"de": legend.get("footnote", "* und daraus gewonnene Erzeugnisse"), "en": "* and products made from them"},
    },
    "sections": sections,
}
os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
json.dump(out, open(os.path.join(HERE, "data", "menu.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
with open(os.path.join(HERE, "menu-data.js"), "w", encoding="utf-8") as f:
    f.write("/* Mozart café · bistro · bar — menu data (German + English).\n   Edit data/menu.json and run build-data.py, or edit this file directly: every text has a de and an en value. */\n")
    f.write("window.MOZART_MENU = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")

n_items = sum(len(g["items"]) for s in sections for g in s["groups"])
unc = [(s["id"], it["name"]["de"], it["remark"]) for s in sections for g in s["groups"] for it in g["items"] if it["uncertain"]]
print(f"{len(sections)} sections, {n_items} items; missing section files: {missing or 'none'}")
print(f"{len(unc)} items flagged uncertain:")
for u in unc: print("  -", u[0], "|", u[1], "|", u[2])
