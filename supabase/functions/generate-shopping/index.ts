import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY secret not set.')

    const { closetItems, preferences } = await req.json()
    const aesthetic = preferences?.aestheticAnalysis
    const budget = preferences?.budget || 'mid'
    const seed = Math.random().toString(36).slice(2, 8)

    const BUDGET_CONFIG: Record<string, { label: string; retailers: string; priceRange: string }> = {
      low:    { label: 'under $50',    retailers: 'Zara, ASOS, H&M, Mango, Urban Outfitters',                                                          priceRange: '$15–$50'   },
      mid:    { label: '$50–$150',     retailers: 'Shopbop, Revolve, Nordstrom, Reformation, Madewell, Free People',                                   priceRange: '$50–$150'  },
      medium: { label: '$50–$150',     retailers: 'Shopbop, Revolve, Nordstrom, Reformation, Madewell, Free People',                                   priceRange: '$50–$150'  },
      high:   { label: '$150–$800',    retailers: 'Net-a-Porter, SSENSE, Mytheresa, Shopbop, Revolve, Nordstrom',                                      priceRange: '$150–$800' },
    }
    const bc = BUDGET_CONFIG[budget] || BUDGET_CONFIG['mid']

    const closetList = closetItems?.length
      ? closetItems.map((i: any) => `- ${i.name} (${i.category})`).join('\n')
      : '(empty)'

    const brandsLoved = preferences?.brandsLiked?.length
      ? `Prioritize: ${preferences.brandsLiked.join(', ')}`
      : ''
    const brandsAvoided = preferences?.brandsDisliked?.length
      ? `NEVER suggest: ${preferences.brandsDisliked.join(', ')}`
      : ''
    const colorsIn  = preferences?.colorsLove?.length  ? preferences.colorsLove.join(', ')  : 'any'
    const colorsOut = preferences?.colorsAvoid?.length ? preferences.colorsAvoid.join(', ') : 'none'
    const fitPref   = preferences?.fit?.length         ? preferences.fit.join(', ')         : 'any'

    const prompt = `You are ÉTOILE, a luxury fashion AI stylist. Seed: ${seed}.
Generate exactly 8 curated shopping picks personalized to this user.

USER PROFILE:
- Aesthetic: ${aesthetic ? `"${aesthetic.aestheticTitle}" — ${aesthetic.description}` : 'not specified'}
- Keywords: ${aesthetic?.keywords?.join(', ') || 'none'}
- Colors they love: ${colorsIn}
- Colors to avoid (NEVER USE): ${colorsOut}
- Fit preference: ${fitPref}
- ${brandsLoved}
- ${brandsAvoided}

BUDGET: ${bc.label} per piece
Allowed retailers: ${bc.retailers}
All prices must be within ${bc.priceRange}.

THEIR CLOSET (what they already own — do NOT recommend duplicates):
${closetList}

RULES:
1. Every pick must fill a gap or complement what they own — explain why in the "note" field.
2. Budget is absolute — stay within ${bc.priceRange} at the allowed retailers only.
3. Vary categories: include tops, bottoms, shoes, outerwear, bags, accessories — no more than 2 per category.
4. Colors must be from their loved list + neutrals (black/white/beige/cream/gray). Never use avoided colors.
5. SEARCH URLS — use ONLY these verified formats (replace TERM with category + color + attribute):
   - Shopbop: https://www.shopbop.com/search/results.jsp?q=TERM
   - Revolve: https://www.revolve.com/search/?q=TERM
   - Nordstrom: https://www.nordstrom.com/sr?keyword=TERM
   - Net-a-Porter: https://www.net-a-porter.com/en-us/shop/search?q=TERM
   - SSENSE: https://www.ssense.com/en-us/women/search?q=TERM
   - Zara: https://www.zara.com/us/en/search?searchTerm=TERM
   - ASOS: https://www.asos.com/search/?q=TERM
   - Reformation: https://www.thereformation.com/search?q=TERM
   - Madewell: https://www.madewell.com/search?Ntt=TERM
   - Free People: https://www.freepeople.com/search/?q=TERM
   - Google Shopping (fallback): https://www.google.com/search?tbm=shop&q=TERM
   DO NOT use Arket, COS, Mango, Sandro, Maje — their URLs cause 404s.
6. Search terms must be findable attribute-based queries, NOT specific model names/SKUs.
7. badge must be one of: "Closes Gap", "Pinterest Match", "Stylist Pick", "Budget Alt", "Color Story", "Wardrobe Essential"
8. gradient must be a CSS linear-gradient using 2 hex colors that evoke the item's color.
9. slot must be one of: TOP, BOTTOM, DRESS, OUTERWEAR, SHOES, BAG, JEWELRY, ACCESSORIES

Return ONLY valid JSON:
{
  "stylistNote": "One editorial sentence (max 25 words) summarizing the edit's theme",
  "picks": [
    {
      "slot": "TOP",
      "brand": "Brand Name",
      "name": "Editorial item name",
      "retailer": "Retailer Name",
      "price": "$85",
      "badge": "Closes Gap",
      "note": "Why this fills a gap or matches their style (max 10 words)",
      "shopUrl": "https://verified-search-url",
      "gradient": "linear-gradient(135deg, #hex1, #hex2)"
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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await anthropicRes.json()
    if (data.error) throw new Error(data.error.message)

    const text = data.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response.')
    const parsed = JSON.parse(match[0])
    if (!parsed.picks?.length) throw new Error('No picks returned.')

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
