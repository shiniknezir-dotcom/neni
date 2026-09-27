# **Claude Code + Higgsfield — The Complete UGC Pipeline**

Automate AI image generation, Seedance 2.0 video creation, and full UGC ad pipelines with Playwright browser automation. 19 ready-to-use skills.

---

## **Quick Install**

Paste this into Claude Code:

```
Install the Higgsfield skills pack: clone https://github.com/AKCodez/higgsfield-claude-skills into a temp folder, copy every subfolder (not the README) into .claude/skills/, then install Playwright MCP with `claude mcp add playwright npx @playwright/mcp@latest` if it isn't already installed. Confirm when done.
```

That's it. Claude handles the rest. When it finishes you'll have 19 slash commands ready to use.

> **Prerequisites**: [Node.js](https://nodejs.org) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`npm i -g @anthropic-ai/claude-code`) must be installed first. You also need a free [Higgsfield](https://higgsfield.ai) account.

---

## **What You Get**

### **19 Slash Commands**

| Category | Commands | What They Do |
|---|---|---|
| **UGC Pipeline** | `/ugc-hot-girl`, `/higgsfield-image-auto`, `/ugc-video-auto` | End-to-end UGC ad creation — character image → video |
| **Video Automation** | `/seedance-auto-generate` | Automates Seedance 2.0 video generation via Playwright |
| **Creative Styles** | `/01-cinematic`, `/02-3d-cgi`, `/03-cartoon`, `/04-comic-to-video`, `/05-fight-scenes`, `/08-anime-action` | 6 artistic style prompt generators |
| **Commercial** | `/06-motion-design-ad`, `/07-ecommerce-ad`, `/09-product-360`, `/11-social-hook`, `/12-brand-story` | 5 marketing-focused prompt generators |
| **Industry** | `/10-music-video`, `/13-fashion-lookbook`, `/14-food-beverage`, `/15-real-estate` | 4 vertical-specific prompt generators |

### **Optional: 6 Hostinger MCP Servers**

A ready-made `.mcp.json` that lets Claude deploy sites, manage domains and DNS, and drive your VPS on Hostinger. See [Optional: Hostinger MCP Servers](#optional-hostinger-mcp-servers).

---

## **The UGC Pipeline**

The main workflow. Generate a character, create an image, produce a video — all automated.

### **One-Shot (full pipeline)**

```
/ugc-video-auto

Create a UGC ad video with an attractive girl promoting my new vitamin C serum.
TikTok format, testimonial style.
```

Claude will:
1. Generate a photorealistic character image on Soul 2.0
2. Navigate to the Seedance 2.0 video page
3. Select the image from your generations
4. Write a UGC video prompt
5. Set ratio to 9:16 for TikTok
6. Ask for your confirmation, then click Generate

### **Step-by-Step (more control)**

**Step 1 — Generate the character prompt:**
```
/ugc-hot-girl

I need a girl for my skincare brand, early 20s, beauty/wellness vibe
```

**Step 2 — Create the image on Higgsfield:**
```
/higgsfield-image-auto

Use that prompt to generate the image on Soul 2.0
```

**Step 3 — Create the video:**
```
/seedance-auto-generate

Take that image and create a UGC testimonial video, 9:16 for TikTok
```

---

## **Using the Prompt Skills**

The 15 prompt engineering skills turn Claude into a specialized director for each video style. Each one generates **15-25 line production-grade Seedance 2.0 prompts** with:

- **2-second hook framework** — scroll-stopping openers
- **Timeline segmentation** — beat-by-beat breakdown up to 15s
- **Camera movement encyclopedia** — 15-20+ techniques
- **Lighting & atmosphere** — mood-setting setups
- **Sound design** — ambient, foley, music guidance
- **5+ example prompts** — ready to use

### **Examples**

```
/15-real-estate
Create a cinematic property tour for this luxury home [attach image]
```

```
/07-ecommerce-ad
TikTok ad for my wireless earbuds, premium unboxing feel
```

```
/01-cinematic
Epic opening shot, dramatic noir lighting, anamorphic lens
```

```
/08-anime-action
Turn this character art into a shonen-style battle scene [attach image]
```

---

## **Batch Runs**

Generate multiple assets in one session:

```
Generate 5 different UGC characters using /ugc-hot-girl and /higgsfield-image-auto:
1. Beauty/skincare — dewy, fresh-faced
2. Fitness — athletic, post-workout glow
3. Fashion — editorial, confident
4. Lifestyle — casual, girl-next-door
5. Luxury — elegant, minimal glam

Soul 2.0, 3:4 portrait, 2K. Update SESSION-RESUME.md after each.
```

### **Crash Recovery**

For long batch sessions, keep a `SESSION-RESUME.md` in your project:

```markdown
# Session Resume

## Progress

| # | Character | Image | Video | Status |
|---|-----------|-------|-------|--------|
| 1 | Beauty girl | ✓ | ✓ | Done |
| 2 | Fitness girl | ✓ | Pending | In Progress |
| 3 | Luxury girl | Pending | Pending | Queued |

## Next: #2 — video generation step
```

If Claude crashes:
```
Read SESSION-RESUME.md and continue from where we left off.
```

---

## **Optional: CLAUDE.md Configuration**

Add a `CLAUDE.md` to your project root for persistent settings across sessions:

```markdown
# Higgsfield UGC Pipeline

## Default Image Settings
- Model: Soul 2.0
- Aspect ratio: 3:4
- Resolution: 2K

## Default Video Settings
- Model: Seedance 2.0
- Duration: 8s
- Ratio: 9:16 (TikTok/Reels)
- Resolution: 720p

## Workflow Rules
- Always clear the prompt bar via JS before typing a new prompt
- Always screenshot after clearing to confirm it's empty
- Always ask for confirmation before clicking Generate
- Use @image1 in video prompts to reference the uploaded image
```

---

## **Optional: Hostinger MCP Servers**

Ship what you generate. This repo includes a `.mcp.json` that connects Claude Code to your Hostinger account through six [official Hostinger MCP servers](https://github.com/hostinger/api-mcp-server), so Claude can deploy landing pages, point domains, edit DNS, and manage the VPS that hosts your finished ads — without leaving the terminal.

| Server | Tools | What It Covers |
|---|---|---|
| `hostinger-hosting` | 74 | Websites, static / Node.js / WordPress deploys, files, databases, cron jobs, SSL, redirects, PHP settings |
| `hostinger-domains` | 41 | Availability checks, name suggestions, purchase, transfers, nameservers, forwarding, WHOIS profiles |
| `hostinger-dns` | 8 | DNS records, validation, snapshots and restore |
| `hostinger-billing` | 9 | Catalog, orders, subscriptions, auto-renewal, payment methods |
| `hostinger-reach` | 52 | Reach email marketing — contacts, segments, tags, campaigns, automations, templates |
| `hostinger-vps` | 64 | Virtual machines, snapshots, backups, firewall, SSH keys, Docker projects, monitoring |

> Tool counts are from `@hostinger/mcp` 1.63.4. All six run locally over stdio via `npx --package=@hostinger/mcp@latest`, so there is nothing to install beyond Node.js 20+.

### **Setup**

1. **Create an API token** in hPanel: [Profile → Account Information → API](https://hpanel.hostinger.com/profile/api) → **Generate new token**. Copy it — it is shown only once.
2. **Export it** in the shell you launch Claude Code from (add the line to `~/.zshrc` or `~/.bashrc` to make it permanent):
   ```bash
   export HOSTINGER_API_TOKEN=your-token-here
   ```
3. **Open Claude Code in this folder** and approve the project MCP servers when prompted.
4. **Run `/mcp`** — all six `hostinger-*` servers should show as connected.

The token never lives in the repo. `.mcp.json` references it as `${HOSTINGER_API_TOKEN:-}`, which Claude Code expands from your environment at launch. If the variable is unset, the servers fall back to a one-time browser OAuth sign-in on the first Hostinger tool call, and the credentials are shared across all six.

### **Use Them in Every Project**

Register the servers at user scope so they follow you outside this folder:

```bash
claude mcp add --scope user --env HOSTINGER_API_TOKEN=your-token-here hostinger-hosting -- npx --package=@hostinger/mcp@latest hostinger-hosting-mcp
```

Repeat for `domains`, `dns`, `billing`, `reach`, and `vps`, changing both the server name and the binary.

### **Other MCP Clients**

For Claude Desktop, Cursor, or any client that reads an `mcpServers` block, paste this into its config and replace `your-token-here`:

```json
{
  "mcpServers": {
    "hostinger-hosting": {
      "command": "npx",
      "args": ["--package=@hostinger/mcp@latest", "hostinger-hosting-mcp"],
      "env": { "HOSTINGER_API_TOKEN": "your-token-here" }
    },
    "hostinger-domains": {
      "command": "npx",
      "args": ["--package=@hostinger/mcp@latest", "hostinger-domains-mcp"],
      "env": { "HOSTINGER_API_TOKEN": "your-token-here" }
    },
    "hostinger-dns": {
      "command": "npx",
      "args": ["--package=@hostinger/mcp@latest", "hostinger-dns-mcp"],
      "env": { "HOSTINGER_API_TOKEN": "your-token-here" }
    },
    "hostinger-billing": {
      "command": "npx",
      "args": ["--package=@hostinger/mcp@latest", "hostinger-billing-mcp"],
      "env": { "HOSTINGER_API_TOKEN": "your-token-here" }
    },
    "hostinger-reach": {
      "command": "npx",
      "args": ["--package=@hostinger/mcp@latest", "hostinger-reach-mcp"],
      "env": { "HOSTINGER_API_TOKEN": "your-token-here" }
    },
    "hostinger-vps": {
      "command": "npx",
      "args": ["--package=@hostinger/mcp@latest", "hostinger-vps-mcp"],
      "env": { "HOSTINGER_API_TOKEN": "your-token-here" }
    }
  }
}
```

> **Don't need all six?** `hostinger-api-mcp` from the same package bundles every tool into one server, and Hostinger also runs a hosted remote server: `claude mcp add --transport http hostinger https://mcp.hostinger.com`. More groups — `mail`, `wordpress`, `ecommerce`, `horizons`, `agency-hosting` — follow the same `hostinger-<group>-mcp` pattern.

---

## **Technical Details**

### **How Image → Video Works**

No downloading or re-uploading needed. Higgsfield connects them internally:

1. Generate an image on `/image/soul-v2`
2. Go to `/create/video?model=seedance_2_0`
3. Click upload area → **Image Generations** tab
4. Click your image → green checkmark appears
5. Press Escape → image loads into the video form

### **The Prompt Bar Fix**

When running batches, the prompt bar doesn't always clear between generations. The skills handle this automatically, but if you're doing manual work:

**Image page** (standard input):
```javascript
const input = document.querySelector('[id="hf:tour-image-prompt"]');
input.value = '';
input.dispatchEvent(new Event('input', { bubbles: true }));
```

**Video page** (Lexical editor):
```javascript
const editor = document.querySelector('[data-lexical-editor]');
editor.focus();
document.execCommand('selectAll');
document.execCommand('delete');
```

### **Model URLs**

| Model | URL Path |
|---|---|
| Soul 2.0 (best for portraits) | `/image/soul-v2` |
| Soul Cinema | `/image/soul-cinematic` |
| Nano Banana Pro (best 4K) | `/image/nano-banana-pro` |
| Nano Banana 2 (fast) | `/image/nano-banana-2` |
| Seedance 2.0 (video) | `/create/video?model=seedance_2_0` |

---

## **Common Issues**

| Issue | Fix |
|---|---|
| `/mcp` doesn't show playwright | Run `claude mcp add playwright npx '@playwright/mcp@latest'` and restart |
| Claude opens a new browser window | Normal — Playwright uses its own controlled browser |
| Prompt bar not clearing between prompts | Add the JS clear to your CLAUDE.md. Claude skips it if not explicit |
| Image doesn't load into video form | Make sure it shows a green checkmark before pressing Escape |
| Lexical editor won't accept typed text | Use `slowly: true`. The Lexical editor needs keypress events |
| Image prompt bar missing | Intermittent platform bug. Refresh the page |
| Not logged in | Log in manually in the Playwright browser window |
| Hostinger servers show `⏸ Pending approval` or are missing from `/mcp` | Run `claude` from the repo folder and accept the project MCP servers when prompted; `claude mcp list` shows their status |
| Hostinger tools fail with `401` | The token is wrong, expired, or not exported in the shell that launched Claude Code. Regenerate it in hPanel and `export HOSTINGER_API_TOKEN=...` |
| A browser opens asking you to sign in to Hostinger | `HOSTINGER_API_TOKEN` is unset, so the server is using OAuth. Sign in once, or export the token to skip it |

---

## **All Skills Reference**

### **Automation**

| Command | Description |
|---|---|
| `/ugc-hot-girl` | Generates image prompts for attractive female UGC characters |
| `/higgsfield-image-auto` | Playwright automation for Higgsfield image generation |
| `/seedance-auto-generate` | Playwright automation for Seedance 2.0 video generation |
| `/ugc-video-auto` | Full end-to-end pipeline — image → video in one command |

### **Prompt Engineering (15 styles)**

| Command | Style | Best For |
|---|---|---|
| `/01-cinematic` | Cinematic Film | Dramatic lighting, anamorphic, noir, epic |
| `/02-3d-cgi` | 3D CGI | Pixar, Unreal Engine, ray tracing |
| `/03-cartoon` | Cartoon & Animation | Cel-shaded, hand-drawn, vector, watercolor |
| `/04-comic-to-video` | Comic to Video | Manga, webtoons, graphic novels |
| `/05-fight-scenes` | Fight & Action | Martial arts, chase scenes, superhero battles |
| `/06-motion-design-ad` | Motion Design Ad | SaaS launches, feature showcases, app promos |
| `/07-ecommerce-ad` | E-Commerce Ad | Product ads, fashion, beauty, TikTok Shop |
| `/08-anime-action` | Anime | Shonen, mecha, magical girl, anime openings |
| `/09-product-360` | Product 360° | Turntable, multi-angle, product reveal |
| `/10-music-video` | Music Video | Beat-synced, performance, concert visuals |
| `/11-social-hook` | Social Hook | TikTok, Reels, Shorts, scroll-stopping hooks |
| `/12-brand-story` | Brand Story | Origin stories, company culture, founder stories |
| `/13-fashion-lookbook` | Fashion Lookbook | Model walks, outfit showcases, runway clips |
| `/14-food-beverage` | Food & Beverage | Restaurant promos, recipe content, food ASMR |
| `/15-real-estate` | Real Estate | Property tours, architecture, interior design |

> Prompt skills adapted from [beshuaxian/higgsfield-seedance2-jineng](https://github.com/beshuaxian/higgsfield-seedance2-jineng). Automation skills by [@AKCodez](https://github.com/AKCodez).

---

## **The Core Idea**

`CLAUDE.md` defines the rules. Skills define the expertise. Playwright gives Claude hands.

Instead of:

> Idea → write prompt → open Higgsfield → paste → configure → generate → wait → download → open video tab → upload → write video prompt → configure → generate → wait

You get:

> **Idea → Claude → done**

Define it once. Run it forever.
