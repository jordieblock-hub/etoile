import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY secret not set in Supabase.')

    const { occasion, isClosetPiece, pieceName, closetItems, preferences, inspoPhotoCount } = await req.json()
    const aesthetic = preferences?.aestheticAnalysis

    const closetList = closetItems?.length
      ? closetItems.map((i: any) => `- ${i.name} (${i.category})${i.brand ? ' by ' + i.brand : ''}`).join('\n')
      : '(no items added yet)'

    const budget = preferences?.budget || 'mid'

    // Budget-to-retailer mapping — enforced as a hard rule
    const BUDGET_CONFIG: Record<string, { label: string; retailers: string; priceRange: string }> = {
      low: {
        label: 'under $50 per piece',
        retailers: 'Zara, ASOS, H&M, Mango, Urban Outfitters, Topshop',
        priceRange: '$15–$50',
      },
      mid: {
        label: '$50–$150 per piece',
        retailers: 'Shopbop, Revolve, Nordstrom, & Other Stories, Sandro, Maje, Reformation, Madewell, Banana Republic, Arket, COS',
        priceRange: '$50–$150',
      },
      medium: {
        label: '$50–$150 per piece',
        retailers: 'Shopbop, Revolve, Nordstrom, & Other Stories, Sandro, Maje, Reformation, Madewell, Banana Republic, Arket, COS',
        priceRange: '$50–$150',
      },
      high: {
        label: '$150+ per piece',
        retailers: 'Net-a-Porter, SSENSE, Mytheresa, The Row, Totême, Jacquemus, Isabel Marant, Acne Studios, Sandro (high end)',
        priceRange: '$150–$800',
      },
    }

    const budgetConfig = BUDGET_CONFIG[budget] || BUDGET_CONFIG['mid']

    const brandsLoved = preferences?.brandsLiked?.length
      ? `Prioritize these brands: ${preferences.brandsLiked.join(', ')}`
      : 'No brand preference specified'

    const brandsAvoided = preferences?.brandsDisliked?.length
      ? `NEVER suggest these brands: ${preferences.brandsDisliked.join(', ')}`
      : ''

    const colorsIn = preferences?.colorsLove?.length
      ? preferences.colorsLove.join(', ')
      : 'any'

    const colorsOut = preferences?.colorsAvoid?.length
      ? preferences.colorsAvoid.join(', ')
      : 'none'

    const fitPref = preferences?.fit?.length
      ? preferences.fit.join(', ')
      : 'any'

    const photoNote = inspoPhotoCount > 0
      ? `The user has ${inspoPhotoCount} inspiration photos (indexed 0–${inspoPhotoCount - 1}). For each look, return a "photoIndex" (integer) picking which photo best matches that look's mood.`
      : ''

    // Random seed to prevent repeated identical responses
    const seed = Math.random().toString(36).slice(2, 8)

    const prompt = `You are ÉTOILE, a luxury fashion AI stylist. Seed: ${seed}. Generate exactly 3 distinct outfit looks.

OCCASION: ${isClosetPiece ? `Style the closet piece "${pieceName}" 3 different ways` : `"${occasion}"`}
Every styling decision — silhouette, formality, color, fabric — must serve this occasion. A beach look and office look share zero pieces.

USER PROFILE:
- Aesthetic: ${aesthetic ? `"${aesthetic.aestheticTitle}" — ${aesthetic.description}` : 'not specified'}
- Keywords: ${aesthetic?.keywords?.join(', ') || 'none'}
- Colors they love: ${colorsIn}
- Colors they avoid (NEVER USE): ${colorsOut}
- Fit preference: ${fitPref}
- ${brandsLoved}
- ${brandsAvoided}

BUDGET: ${budgetConfig.label}
Allowed retailers: ${budgetConfig.retailers}
Every non-closet piece must be priced ${budgetConfig.priceRange}. No exceptions.

THEIR CLOSET:
${closetList}

STRICT RULES — every rule is mandatory:

1. BUDGET IS ABSOLUTE: Every shopping suggestion must come from the allowed retailers above and be priced within ${budgetConfig.priceRange}. If you suggest a piece outside this range, the response fails. Do not suggest luxury brands for a low budget or fast fashion for a high budget.

2. SEARCH URLS must be specific: build the search query from brand + item name so the user lands on exactly what you described. Use these URL formats (replace TERM with URL-encoded brand+item, spaces as +):
   - Shopbop: https://www.shopbop.com/search/results.jsp?q=TERM
   - Revolve: https://www.revolve.com/search/?q=TERM
   - Nordstrom: https://www.nordstrom.com/sr?keyword=TERM
   - Net-a-Porter: https://www.net-a-porter.com/en-us/shop/search?q=TERM
   - SSENSE: https://www.ssense.com/en-us/women/search?q=TERM
   - Mytheresa: https://www.mytheresa.com/us/en/women/search?q=TERM
   - Zara: https://www.zara.com/us/en/search?searchTerm=TERM
   - ASOS: https://www.asos.com/search/?q=TERM
   - Mango: https://shop.mango.com/us/search?q=TERM
   - & Other Stories: https://www.stories.com/en/search?q=TERM
   - Sandro: https://us.sandro-paris.com/search?q=TERM
   - Maje: https://us.maje.com/search?q=TERM
   - Reformation: https://www.thereformation.com/search?q=TERM
   - Arket: https://www.arket.com/en_usd/search?q=TERM
   - COS: https://www.cos.com/en_usd/search.html?q=TERM
   Example: if you suggest "Reformation Lexi midi dress in black", shopUrl = https://www.thereformation.com/search?q=Reformation+Lexi+midi+dress+black

3. COLORS: Use only colors from their "colors they love" list, plus neutrals (black/white/beige/gray/cream) as fillers. NEVER use a color from "colors they avoid" — not even in accessories.

4. FIT: Every piece must match the user's fit preference. Oversized → relaxed/boxy. Tailored → structured/fitted. Flowy → draped/loose. Apply to every single piece.

5. BRANDS: Always suggest brands the user loves when possible. The suggested retailer must carry the suggested brand.

6. SPECIFICITY: Name the exact item — brand + style + color (e.g. "Sandro pleated midi skirt in ecru" not "white skirt"). This is what makes the search URL work.

7. 3 looks must be genuinely different — different silhouettes, color stories, energy. Not just color swaps.

8. Include a realistic price estimate matching the budget range.
${photoNote}

Return ONLY valid JSON — no markdown, no explanation:
{
  "looks": [
    {
      "name": "Look name",
      "caption": "Editorial caption in quotes, max 18 words, Vogue-style",
      "occasionLabel": "brief occasion label",
      "gradient": "linear-gradient(135deg, #hex1, #hex2)",
      "photoIndex": 0,
      "pieces": [
        {
          "slot": "TOP",
          "name": "Item name",
          "fromCloset": true,
          "closetItemName": "Exact name from closet list"
        },
        {
          "slot": "SHOES",
          "name": "Brand + specific item name + color",
          "fromCloset": false,
          "shopUrl": "https://exact-search-url-for-this-item",
          "retailer": "Retailer Name",
          "price": "$85"
        }
      ]
    }
  ]
}`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await anthropicRes.json()
    if (data.error) throw new Error(data.error.message)

    const text = data.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in Claude response.')
    const parsed = JSON.parse(match[0])
    if (!parsed.looks?.length) throw new Error('No looks returned.')

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
