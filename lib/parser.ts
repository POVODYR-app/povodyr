export async function parseArtFineNationHTML(logs: string[] = []): Promise<ParsedOpportunity[]> {
  const targetUrl = 'https://artfinenation.com'
  const opportunities: ParsedOpportunity[] = []
  let textContent = ''

  // 1. Спроба через Jina Reader (очищені заголовки)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 7000)

    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
      next: { revalidate: 0 }
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      textContent = await res.text()
      logs.push(`Контент Art Fine Nation отримано через Jina. Довжина: ${textContent.length} символів`)
    } else {
      logs.push(`Jina Reader повернув статус: ${res.status}`)
    }
  } catch (e) {
    logs.push('Jina Reader не відповів вчасно. Перехід на Microlink...')
  }

  // 2. Резервна спроба через Microlink API (ідеально для Google Sites)
  if (!textContent) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 7000)

      const microUrl = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&prerender=true`
      const res = await fetch(microUrl, {
        signal: controller.signal,
        next: { revalidate: 0 }
      })

      clearTimeout(timeoutId)

      if (res.ok) {
        const json = await res.json()
        const title = json.data?.title || ''
        const description = json.data?.description || ''
        textContent = `${title}\n${description}`
        logs.push(`Отримано метадані Google Sites через Microlink`)
      }
    } catch (e) {
      logs.push('Резервний сервіс Microlink не відповів.')
    }
  }

  // Парсинг отриманого тексту
  if (textContent && textContent.length > 50) {
    const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean)

    lines.forEach((line) => {
      const isRelevant = /open\s*call|конкурс|виставка|грант|резиденція|митці|художники/i.test(line)

      if (isRelevant && line.length >= 15 && line.length <= 250) {
        const cleanTitle = line
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/^#+\s*/, '')
          .trim()

        if (!opportunities.some(item => item.title === cleanTitle)) {
          opportunities.push({
            source_name: 'Art Fine Nation',
            title: cleanTitle,
            link: targetUrl,
            source_url: targetUrl,
            type: 'Open Call',
            deadline: null,
            country: 'Україна',
            is_free: true,
            cost_amount: 0,
            cost_currency: 'UAH',
            genres: ['Образотворче мистецтво', 'Живопис'],
            techniques: [],
            artist_levels: ['Emerging', 'Mid-Career', 'Established'],
            age_restrictions: 'None',
            languages: ['uk'],
            ukrainians_eligible: true,
            raw_description: `Опубліковано на платформі Art Fine Nation: ${cleanTitle}`,
          })
        }
      }
    })
  }

  return opportunities
}

export async function parseRssSources(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const sources = [
    { url: 'https://www.resartis.org/feed/', name: 'Res Artis' },
    { url: 'https://www.transartists.org/en/rss.xml', name: 'TransArtists' },
    { url: 'https://www.e-flux.com/announcements/rss', name: 'E-Flux' }
  ]

  for (const source of sources) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal,
        next: { revalidate: 0 }
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        console.error(`RSS ${source.name} повернув статус: ${res.status}`)
        continue
      }

      const xml = await res.text()
      const $ = cheerio.load(xml, { xmlMode: true })

      $('item, entry').each((_, element) => {
        const title = $(element).find('title').text().trim()
        const link = $(element).find('link').attr('href') || $(element).find('link').text().trim()
        const description = $(element).find('description, summary, content').text().replace(/<[^>]+>/g, '').trim()

        if (title && link) {
          opportunities.push({
            source_name: source.name,
            title: title.substring(0, 150),
            link: link,
            source_url: link,
            type: 'Open Call',
            deadline: null,
            country: 'International',
            is_free: true,
            cost_amount: 0,
            cost_currency: 'EUR',
            genres: ['Visual Art', 'Painting'],
            techniques: [],
            artist_levels: ['Emerging', 'Mid-Career'],
            age_restrictions: 'None',
            languages: ['en'],
            ukrainians_eligible: true,
            raw_description: description.substring(0, 500) || title,
          })
        }
      })
    } catch (err: any) {
      console.error(`Помилка RSS ${source.name}: ${err.message}`)
    }
  }

  return opportunities
}
