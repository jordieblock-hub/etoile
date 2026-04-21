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

    const BUDGET_LABEL: Record<string, string> = {
      low:    'under $50 per piece — suggest Zara, ASOS, H&M, Mango',
      mid:    '$50–150 per piece — Shopbop, Revolve, Nordstrom, & Other Stories',
      medium: '$50–150 per piece — Shopbop, Revolve, Nordstrom, & Other Stories',
      high:   '$150+ per piece — Net-a-Porter, SSENSE, Mytheresa, The Row',
    }

    const photoNote = inspoPhotoCount > 0
      ? `The user has ${inspoPhotoCount} inspiration photos (indexed 0–${inspoPhotoCount - 1}). For each look, return a "photoIndex" (integer) picking which photo best matches that look's mood.`
      : ''

    const stylingRequest = isClosetPiece
      ? `Build 3 complete outfits around the user's specific closet piece: "${pieceName}". Each look should show a different way to style this piece.`
      : `Style the user for: "${occasion}". This specific occasion is THE primary creative brief — every choice (silhouette, color, formality, vibe) must serve this occasion. Do NOT generate generic "everyday" looks.`

    // Random seed to prevent repeated identical responses
    const seed = Math.random().toString(36).slice(2, 8)

    const prompt = `You are ÉTOILE, a luxury fashion AI stylist. Seed: ${seed}. Generate exactly 3 distinct outfit looks.

OCCASION (primary brief): ${isClosetPiece ? `Style the piece "${pieceName}"` : `"${occasion}"`}
This is not a suggestion — the occasion defines EVERYTHING. A "beach day" look and a "job interview" look should share zero pieces.

USER AESTHETIC:
- Style: ${aesthetic ? `"${aesthetic.aestheticTitle}" — ${aesthetic.description}` : 'not provided'}
- Keywords: ${aesthetic?.keywords?.join(', ') || 'none'}
- Palette: ${aesthetic?.colorPalette?.join(', ') || 'none'}
- Budget: ${BUDGET_LABEL[preferences?.budget] || 'flexible'}
- Loves: ${preferences?.brandsLiked?.join(', ') || 'no preference'}
- Avoids: ${preferences?.brandsDisliked?.join(', ') || 'none'}
- Colors in: ${preferences?.colorsLove?.join(', ') || 'any'}
- Colors out: ${preferences?.colorsAvoid?.join(', ') || 'none'}
- Fit: ${preferences?.fit?.join(', ') || 'any'}

THEIR CLOSET:
${closetList}

STRICT RULES — violating any of these is a failure:
1. The 3 looks must be genuinely distinct — different silhouettes, different energy, not just color swaps.
2. Occasion-appropriateness is absolute. A beach look and a job interview look share zero pieces.
3. COLORS: Every piece must be in a color the user loves, OR a neutral (black/white/beige/gray/cream). NEVER use colors they avoid — not even accessories.
4. BRANDS: Shopping suggestions MUST prioritize brands they love. NEVER suggest brands they avoid under any circumstances.
5. FIT: Every silhouette must match their fit preferences. If they want Oversized → loose, relaxed cuts. Tailored → structured, fitted. Flowy → draped, loose. Apply this to every single piece.
6. For non-closet pieces: suggest real specific items (e.g. "Totême ribbed tank" not just "white tank"), with retailer search URLs.
7. Retailer URL formats (replace TERM with + for spaces): Net-a-Porter: https://www.net-a-porter.com/en-us/shop/search?q=TERM | SSENSE: https://www.ssense.com/en-us/women/search?q=TERM | Shopbop: https://www.shopbop.com/search/results.jsp?q=TERM | Mytheresa: https://www.mytheresa.com/us/en/women/search?q=TERM | Revolve: https://www.revolve.com/search/?q=TERM | Nordstrom: https://www.nordstrom.com/sr?keyword=TERM | Zara: https://www.zara.com/us/en/search?searchTerm=TERM | ASOS: https://www.asos.com/search/?q=TERM | Mango: https://shop.mango.com/us/search?q=TERM
8. gradient: 2 muted hex colors from the look's actual color palette (must reflect the color choices above).
9. caption: editorial, max 18 words, sounds like Vogue, in quotes.
10. Look names: evocative & occasion-specific (e.g. "The After-Hours Escape", "The Rooftop Arrival").
${photoNote}

Return ONLY valid JSON:
{
  "looks": [
    {
      "name": "Look name",
      "caption": "Editorial caption",
      "occasionLabel": "brief label",
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
          "name": "Specific brand + item",
          "fromCloset": false,
          "shopUrl": "https://...",
          "retailer": "Retailer Name",
          "price": "$180"
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
        max_tokens: 4000,
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
