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

    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) throw new Error('No image provided.')

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `You are a luxury fashion stylist analyzing a Pinterest board screenshot.

Do two things:

1. Describe the person's fashion aesthetic (mood, color palette, silhouettes, fabrics, styling habits).

2. Identify up to 9 individual fashion pin images visible in the screenshot. For each pin, return its approximate position as a fraction of the total image dimensions (0.0–1.0). Focus on pins showing outfits, clothing, or styled looks — skip text cards, home decor, or food. Prioritize the most visually distinct and fashion-forward pins. Spread picks across different areas of the board.

Return ONLY a JSON object, no text before or after:
{
  "aestheticTitle": "2-4 word title for their aesthetic (e.g. 'Parisian Off-Duty')",
  "description": "3-4 sentence rich description for use by an AI fashion stylist",
  "colorPalette": ["#hexcolor1", "#hexcolor2", "#hexcolor3", "#hexcolor4"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "pins": [
    { "x": 0.01, "y": 0.02, "w": 0.30, "h": 0.28 },
    { "x": 0.35, "y": 0.00, "w": 0.30, "h": 0.32 },
    { "x": 0.68, "y": 0.01, "w": 0.30, "h": 0.25 }
  ]
}
Each pin: x/y = top-left corner as fraction of image width/height, w/h = width/height as fraction. Ensure pins don't extend past 1.0.`,
              },
            ],
          },
        ],
      }),
    })

    const data = await anthropicRes.json()
    if (data.error) throw new Error(data.error.message)

    const text = data.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in response.')
    const parsed = JSON.parse(match[0])

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
