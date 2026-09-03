'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TelegramConnect from '../../components/TelegramConnect'
import NotificationsModal from '../../components/NotificationsModal'
import FollowUpAlerts from '../../components/FollowUpAlerts'
import ApplicationsTrackerModal from '../../components/ApplicationsTrackerModal'
import { calculateMatch, ArtistProfile, Opportunity as MatchOpportunity } from '../../lib/matchEngine'
import { isRealBuyerRequest } from '../../lib/commercialDemandGate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Opportunity {
  id: string
  title: string
  description?: string | null
  raw_description?: string | null
  created_at: string
  deadline?: string | null
  source_url?: string | null
  link?: string | null
  link_url?: string | null
  url?: string | null
  country?: string | null
  type?: string | null
  is_free?: boolean | null
  cost_amount?: number | string | null
  fee_amount?: number | string | null
  org_fee?: number | string | null
  techniques?: any
  genres?: any
  themes?: any
  eligible_countries?: any
  required_level?: string | null
}

type MatchedArtwork = {
  title: string
  score: number
  reasons: string[]
}

function emptyArtistProfile(): ArtistProfile {
  return {
    name: '',
    country: 'Україна',
    city: '',
    artistic_styles: [],
    techniques: [],
    materials: [],
    themes: [],
    series: [],
    professional_level: '',
    target_countries: [],
    preferred_opportunity_types: ['exhibition', 'open_call', 'competition', 'residency', 'grant'],
  }
}

function toArray(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((i) => String(i).trim()).filter(Boolean)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((i) => String(i).trim()).filter(Boolean)
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return []
}

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => String(s).trim()).filter(Boolean)))
}

function tokenizeQueryText(raw: string): string[] {
  return String(raw || '')
    .toLowerCase()
    .replace(/[«»""()[\].,;:!?/\\|+*_—–-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
}

function shortRequestSummary(request: any): string {
  const text = String(request?.what_is_needed || request?.description || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  return text.length > 180 ? `${text.slice(0, 177)}…` : text
}

function scoreArtworkAgainstRequest(art: any, queryText: string): MatchedArtwork {
  const title = String(art?.title || '').trim()
  const themes = toArray(art?.themes)
  const styles = toArray(art?.styles)
  const techniques = toArray(art?.techniques_list || art?.techniques)
  const workTypes = toArray(art?.work_types)
  const spaces = toArray(art?.suitable_spaces)
  const materials = toArray(art?.materials)
  const query = String(queryText || '').toLowerCase()
  const tokens = tokenizeQueryText(query)
  const reasons: string[] = []
  let score = 0

  const registerHit = (label: string, values: string[], weight: number) => {
    values.forEach((value) => {
      const v = String(value || '').trim()
      if (!v) return
      const low = v.toLowerCase()
      const parts = low.split(/\s+/).filter((p) => p.length >= 4)
      const tokenHit = tokens.some((t) => low.includes(t) || t.includes(low))
      const phraseHit = query.includes(low) || parts.some((p) => query.includes(p))
      if (tokenHit || phraseHit) {
        score += weight
        if (reasons.length < 3) reasons.push(`${label}: ${v}`)
      }
    })
  }

  registerHit('тема', themes, 3)
  registerHit('простір', spaces, 3)
  registerHit('техніка', techniques, 2)
  registerHit('стиль', styles, 2)
  registerHit('тип', workTypes, 2)
  registerHit('матеріал', materials, 1)

  if (title) {
    const lowTitle = title.toLowerCase()
    if (tokens.some((t) => lowTitle.includes(t))) {
      score += 2
      if (reasons.length < 3) reasons.push(`назва: ${title}`)
    }
  }

  return {
    title: title || 'Без назви',
    score,
    reasons: uniqueStrings(reasons).slice(0, 3),
  }
}

function matchArtworksToRequest(artworks: any[], request: any): MatchedArtwork[] {
  const queryText = [
    request?.title || '',
    request?.description || '',
    request?.what_is_needed || '',
  ].join(' ')

  return (Array.isArray(artworks) ? artworks : [])
    .map((art) => scoreArtworkAgainstRequest(art, queryText))
    .filter((row) => row.score > 0 && row.title && row.title !== 'Без назви')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

function formatMatchedWorksLine(matched: MatchedArtwork[]): string {
  if (!matched.length) return ''
  return matched
    .map((row) => {
      const why = row.reasons.length ? ` — ${row.reasons.join('; ')}` : ''
      return `«${row.title}»${why}`
    })
    .join('; ')
}

function portfolioSummaryLine(artworks: any[]): string {
  const list = Array.isArray(artworks) ? artworks : []
  if (!list.length) return ''
  const styles = uniqueStrings(list.flatMap((a) => toArray(a.styles))).slice(0, 3)
  const techniques = uniqueStrings(list.flatMap((a) => toArray(a.techniques_list || a.techniques))).slice(0, 3)
  const themes = uniqueStrings(list.flatMap((a) => toArray(a.themes))).slice(0, 3)
  const parts = [
    styles.length ? `стилі: ${styles.join(', ')}` : '',
    techniques.length ? `техніки: ${techniques.join(', ')}` : '',
    themes.length ? `теми: ${themes.join(', ')}` : '',
  ].filter(Boolean)
  return parts.length ? `З портфоліо: ${parts.join('; ')}.` : ''
}

function isFreshMatchingRequest(reqItem: any, now = Date.now()): boolean {
  const added = Date.parse(String(reqItem?.created_at || reqItem?.date_added || ''))
  if (Number.isFinite(added) && now - added > 45 * 24 * 60 * 60 * 1000) return false

  const url = String(reqItem?.source_url || '').toLowerCase()
  if (!url) return false
  if (url.indexOf('instagram.com/') !== -1) return false
  if (url.indexOf('e-lot.com.ua') !== -1) return false

  return isRealBuyerRequest({
    title: reqItem?.title,
    description: reqItem?.description,
    what_is_needed: reqItem?.what_is_needed,
    organization: reqItem?.organization,
    source_url: reqItem?.source_url,
    deadline: reqItem?.deadline,
  })
}
const PIPELINE_STATUSES = ['FOUND', 'INTERESTED', 'PREPARING', 'SUBMITTED', 'WAITING', 'SELECTED', 'REJECTED']

function isPipelineApplicationStatus(status: unknown): boolean {
  const key = String(status || '').trim().toUpperCase()
  return PIPELINE_STATUSES.indexOf(key) !== -1
}
export default function DashboardPage() {
  const [userName, setUserName] = useState('')
  const [userObj, setUserObj] = useState<{ id: string; telegram_chat_id?: string | null } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCommercialModalOpen, setIsCommercialModalOpen] = useState(false)
  const [isMatchingWorksOpen, setIsMatchingWorksOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dailyCount, setDailyCount] = useState<number>(0)
  const [monthlyMatchedCount, setMonthlyMatchedCount] = useState<number>(0)
  const [upcomingDeadlinesCount, setUpcomingDeadlinesCount] = useState<number>(0)
  const [modalOpportunities, setModalOpportunities] = useState<any[]>([])
  const [commercialOpportunities, setCommercialOpportunities] = useState<any[]>([])
  const [savedItemsForAlerts, setSavedItemsForAlerts] = useState<any[]>([])  
  const [isApplicationsModalOpen, setIsApplicationsModalOpen] = useState(false)
  const [applicationItems, setApplicationItems] = useState<any[]>([])
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false)
  const [recentRelevantOpps, setRecentRelevantOpps] = useState<any[]>([])
  const [hasNoRecentRelevant, setHasNoRecentRelevant] = useState(false)
  const [isTop3Open, setIsTop3Open] = useState(true)
  const [generatingProposalId, setGeneratingProposalId] = useState<string | null>(null)
  const [generatingMatchingWorksId, setGeneratingMatchingWorksId] = useState<string | null>(null)
  const [proposalModalData, setProposalModalData] = useState<{ title: string; text: string; contactPerson?: string; organization?: string } | null>(null)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [userArtworks, setUserArtworks] = useState<any[]>([])

  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) {
        setLoading(false)
        return
      }

      let artistProfileData: ArtistProfile = emptyArtistProfile()

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profile?.full_name) setUserName(profile.full_name)
      setUserObj({
        id: user.id,
        telegram_chat_id: profile?.telegram_chat_id || null,
      })

      if (profile) {
        artistProfileData = {
          ...emptyArtistProfile(),
          name: profile.full_name || '',
          country: 'Україна',
          techniques: toArray(profile.profile_techniques || profile.techniques),
          professional_level: profile.artist_level || '',
          target_countries: toArray(profile.search_countries),
        }
      }

      const { data: artProfile } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (artProfile) {
        artistProfileData = {
          name: artProfile.name || artistProfileData.name,
          country: artProfile.country || artistProfileData.country,
          city: artProfile.city || artistProfileData.city,
          artistic_styles: toArray(artProfile.artistic_styles).length ? toArray(artProfile.artistic_styles) : artistProfileData.artistic_styles,
          techniques: toArray(artProfile.techniques).length ? toArray(artProfile.techniques) : artistProfileData.techniques,
          materials: toArray(artProfile.materials).length ? toArray(artProfile.materials) : artistProfileData.materials,
          themes: toArray(artProfile.themes).length ? toArray(artProfile.themes) : artistProfileData.themes,
          series: toArray(artProfile.series).length ? toArray(artProfile.series) : artistProfileData.series,
          professional_level: artProfile.professional_level || artistProfileData.professional_level,
          target_countries: toArray(artProfile.target_countries).length ? toArray(artProfile.target_countries) : artistProfileData.target_countries,
          preferred_opportunity_types: toArray(artProfile.preferred_opportunity_types).length
            ? toArray(artProfile.preferred_opportunity_types)
            : artistProfileData.preferred_opportunity_types,
        }
      }

      const { data: works } = await supabase
        .from('artist_artworks')
        .select('*')
        .eq('user_id', user.id)

      if (works && isMounted) {
        setUserArtworks(works)

        const workStyles = works.flatMap((w: any) => toArray(w.styles))
        const workTechs = works.flatMap((w: any) => toArray(w.techniques_list || w.techniques))
        const workMaterials = works.flatMap((w: any) => toArray(w.materials))
        const workThemes = works.flatMap((w: any) => toArray(w.themes))
        const workTitles = works.map((w: any) => w.title).filter(Boolean)

        artistProfileData = {
          ...artistProfileData,
          artistic_styles: artistProfileData.artistic_styles.length ? artistProfileData.artistic_styles : workStyles,
          techniques: artistProfileData.techniques.length ? artistProfileData.techniques : workTechs,
          materials: artistProfileData.materials.length ? artistProfileData.materials : workMaterials,
          themes: artistProfileData.themes.length ? artistProfileData.themes : workThemes,
          series: artistProfileData.series.length ? artistProfileData.series : workTitles.slice(0, 5),
        }
      }

      const { data: savedOpps } = await supabase
        .from('saved_opportunities')
        .select('*, opportunity:opportunities(*)')
        .eq('user_id', user.id)

      if (savedOpps && isMounted) {
        const submittedOnly = savedOpps.filter((item: any) =>
          item.status === 'submitted' || item.status === 'applied' || item.is_submitted === true || item.applied === true
        )
        setSavedItemsForAlerts(submittedOnly)
      }
      if (savedOpps && isMounted) {
        const submittedOnly = savedOpps.filter((item: any) =>
          item.status === 'submitted' || item.status === 'applied' || item.is_submitted === true || item.applied === true
        )
        setSavedItemsForAlerts(submittedOnly)
        setApplicationItems(savedOpps.filter((item: any) => isPipelineApplicationStatus(item.status)))
      }
      const { data: commOpps } = await supabase
        .from('commercial_opportunities')
        .select('*')
        .order('date_added', { ascending: false })

      if (commOpps && isMounted) {
        const withSource = commOpps.filter((comm: any) => isValidHttpUrl(comm.source_url))
        const formattedComm = withSource.map((comm: any) => {
          const mappedCommOpp: MatchOpportunity = {
            id: comm.id,
            title: comm.title,
            type: 'commercial',
            eligible_countries: [comm.country || 'Україна'],
            deadline: comm.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            fee: 0,
            currency: comm.currency || 'UAH',
            techniques: [],
            themes: [],
          }
          const match = calculateMatch(artistProfileData, mappedCommOpp)
          return {
            id: comm.id,
            title: comm.title,
            description: comm.description || '',
            what_is_needed: comm.what_is_needed || '',
            budget: comm.budget,
            currency: comm.currency || 'UAH',
            organization: comm.organization || 'Партнерський проєкт',
            contact_person: comm.contact_person || 'Менеджер проєкту',
            contact_method: comm.contact_method || 'artfinenation@gmail.com',
            source_url: String(comm.source_url).trim(),
            created_at: comm.date_added || new Date().toISOString(),
            deadline: comm.deadline || undefined,
            matchScore: match.score > 0 ? match.score : 85,
            matchReasons: match.reasons,
          }
        })
        setCommercialOpportunities(formattedComm.filter((item) => isFreshMatchingRequest(item)))
      }

      try {
        const res = await fetch(`/api/user-stats?user_id=${user.id}`)
        const json = await res.json()
        if (json.success && isMounted) {
          setDailyCount(json.daily_count || 0)
          setMonthlyMatchedCount(json.monthly_matched_count || 0)
          setUpcomingDeadlinesCount(json.upcoming_deadlines_count || 0)
        }
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token
        if (accessToken) {
          await fetch('/api/refresh-digest', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + accessToken },
          })
        }

        const { data: digestProfile } = await supabase
          .from('profiles')
          .select('digest_opportunity_ids')
          .eq('id', user.id)
          .maybeSingle()
        const rawDigestIds = digestProfile?.digest_opportunity_ids
        let digestIds: string[] = []
        if (Array.isArray(rawDigestIds)) {
          digestIds = rawDigestIds.map((id: any) => String(id)).filter(Boolean)
        } else if (typeof rawDigestIds === 'string' && rawDigestIds.trim()) {
          try {
            const parsed = JSON.parse(rawDigestIds)
            if (Array.isArray(parsed)) {
              digestIds = parsed.map((id: any) => String(id)).filter(Boolean)
            }
          } catch {
            digestIds = []
          }
        }

        if (digestIds.length === 0) {
          setModalOpportunities([])
          setRecentRelevantOpps([])
          setHasNoRecentRelevant(true)
        } else {
          const { data: opps } = await supabase
            .from('opportunities')
            .select('*')
            .in('id', digestIds)
            .eq('is_active', true)

          if (opps && isMounted) {
            const formattedOpps = opps.map((opp: Opportunity) => {
              const mappedOpp: MatchOpportunity = {
                id: opp.id,
                title: opp.title,
                type: opp.type || 'open_call',
                eligible_countries: opp.eligible_countries || ['Україна', 'Worldwide'],
                deadline: opp.deadline || new Date().toISOString(),
                fee: Number(opp.fee_amount || opp.cost_amount || opp.org_fee || 0),
                currency: 'USD',
                techniques: Array.isArray(opp.techniques) ? opp.techniques : [],
                themes: Array.isArray(opp.themes) ? opp.themes : [],
                required_level: opp.required_level || undefined,
              }
              const match = calculateMatch(artistProfileData, mappedOpp)
              return {
                id: opp.id,
                title: opp.title,
                description: opp.raw_description || opp.description || '',
                created_at: opp.created_at || new Date().toISOString(),
                deadline: opp.deadline || undefined,
                link_url: opp.source_url || opp.link || opp.link_url || opp.url || undefined,
                matchScore: match.score,
                matchReasons: match.reasons,
                recommendedAction: match.recommendedAction,
              }
            })

            const order = new Map(digestIds.map((id, index) => [id, index]))
            formattedOpps.sort((a, b) => {
              const ai = order.has(a.id) ? (order.get(a.id) as number) : 999
              const bi = order.has(b.id) ? (order.get(b.id) as number) : 999
              if (ai !== bi) return ai - bi
              return (b.matchScore || 0) - (a.matchScore || 0)
            })

                const listingTitleRe = /актуальний open call та події|актуальні гранти та конкурсні програми|worldwide network open calls|grants database|eu supports ukraine through culture|swiss arts council residencies|selected artists in residence|selected projects/i
            const visibleOpps = formattedOpps.filter((item) => !listingTitleRe.test(String(item.title || '')))
                        setModalOpportunities(visibleOpps)
            setHasNoRecentRelevant(visibleOpps.length === 0)
            setRecentRelevantOpps(visibleOpps)
          } else if (isMounted) {
            setModalOpportunities([])
            setRecentRelevantOpps([])
            setHasNoRecentRelevant(true)
          }
        }
      } catch (err) {
        console.error('Помилка завантаження статистики:', err)
      }

      if (isMounted) setLoading(false)
    }

    loadDashboardData()
    return () => {
      isMounted = false
    }
  }, [])

  const buildProfileSnapshot = () => {
    const works = Array.isArray(userArtworks) ? userArtworks.slice(0, 8) : []
    return {
      full_name: userName || '',
      artworks: works.map((art: any) => ({
        title: art.title || '',
        styles: art.styles || [],
        techniques_list: art.techniques_list || art.techniques || [],
        materials: art.materials || [],
        themes: art.themes || [],
        work_types: art.work_types || [],
        format_size: art.format_size || art.size_category || '',
      })),
    }
  }

  const handleGenerateProposal = async (opp: any) => {
    setGeneratingProposalId(opp.id)
    try {
      const res = await fetch('/api/generate-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opp.id,
          opportunityTitle: opp.title,
          opportunityDescription: `${opp.description} ${opp.what_is_needed ? 'Що потрібно: ' + opp.what_is_needed : ''}`,
          matchReasons: opp.matchReasons || [],
          userId: userObj?.id,
          profileSnapshot: buildProfileSnapshot(),
          contactPerson: opp.contact_person,
          organization: opp.organization,
          isCommercial: !!opp.budget || !!opp.organization,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Помилка сервера: ${res.status}`)
      }
      setProposalModalData({
        title: `Пакет документів / пропозиція для: ${opp.title}`,
        text: data.text,
        contactPerson: opp.contact_person,
        organization: opp.organization
      })
    } catch (err: any) {
      console.error('Помилка генерації:', err)
      alert(`Не вдалося згенерувати: ${err.message || 'Невідома помилка'}`)
    } finally {
      setGeneratingProposalId(null)
    }
  }

  const handleGenerateMatchingWorks = async (reqItem: any, matchedWorks: MatchedArtwork[]) => {
    setGeneratingMatchingWorksId(reqItem.id)
    try {
      const selectedLine = formatMatchedWorksLine(matchedWorks)
      const descParts = [
        reqItem.description || '',
        reqItem.what_is_needed ? `Вимоги: ${reqItem.what_is_needed}` : '',
        selectedLine
          ? `Рекомендовані твори (лише ці title з портфоліо, інші не вигадуй): ${selectedLine}`
          : '',
      ].filter(Boolean)

      const res = await fetch('/api/generate-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: reqItem.id,
          opportunityTitle: `Добір робіт під запит: ${reqItem.title}`,
          opportunityDescription: descParts.join(' '),
          matchReasons: matchedWorks.length
            ? matchedWorks.map((w) => `«${w.title}»: ${w.reasons.join(', ')}`)
            : (reqItem.matchReasons || []),
          userId: userObj?.id,
          profileSnapshot: buildProfileSnapshot(),
          contactPerson: reqItem.contact_person,
          organization: reqItem.organization,
          isCommercial: true,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Помилка сервера: ${res.status}`)
      }
      setProposalModalData({
        title: `Презентація робіт для: ${reqItem.title}`,
        text: data.text,
        contactPerson: reqItem.contact_person,
        organization: reqItem.organization
      })
    } catch (err: any) {
      console.error('Помилка генерації презентації:', err)
      alert(`Не вдалося згенерувати презентацію: ${err.message || 'Невідома помилка'}`)
    } finally {
      setGeneratingMatchingWorksId(null)
    }
  }

  const handleSendFeedback = async (type: string) => {
    if (!userObj?.id || !proposalModalData) return
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: userObj.id,
        comment: type,
        feedback_text: type,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      alert('Дякую! Ваш відгук збережено. POVODYR стане точнішим.')
    } catch (err) {
      console.error('Помилка збереження feedback:', err)
      alert('Не вдалося зберегти відгук')
    }
  }

    const getDeadlineDetails = (deadlineStr?: string) => {
    if (!deadlineStr) return { indicator: '🟢', label: 'Довгострокова можливість' }
    const deadlineDate = new Date(deadlineStr)
    const today = new Date()
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 7 && diffDays >= 0) {
      return { indicator: '🔴', label: `Дедлайн через ${diffDays} дн. (до 7 днів)` }
    } else if (diffDays > 7 && diffDays <= 30) {
      return { indicator: '🟡', label: `Дедлайн через ${diffDays} дн. (8–30 днів)` }
    } else if (diffDays > 30 && diffDays <= 90) {
      return { indicator: '🔵', label: `Дедлайн через ${diffDays} дн. (31–90 днів)` }
    } else if (diffDays < 0) {
      return { indicator: '⚪', label: 'Термін подачі вийшов' }
    } else {
      return { indicator: '🟢', label: `Дедлайн через ${diffDays} дн. (довгострокова)` }
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: '#0f172a',
        color: 'white',
        padding: '20px 16px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Вітаю{userName ? `, ${userName}` : ''}!
          </h1>
                              <button
            onClick={() => setIsDeadlineModalOpen(true)}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundColor: '#1e293b',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              WebkitTextFillColor: '#ffffff',
              lineHeight: 1.2,
            }}
          >
            <span>🔔</span>
            <span style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>
              {upcomingDeadlinesCount} DEADLINE
            </span>
            <span style={{ display: 'flex', gap: 2, fontSize: '12px' }}>
              {Array.from(new Set(
                applicationItems
                  .map((item: any) => getDeadlineDetails(item.opportunity?.deadline).indicator)
              )).join('')}
            </span>
          </button>
        </div>

        {userObj && <TelegramConnect user={userObj} />}
        <FollowUpAlerts savedItems={savedItemsForAlerts} />

        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 4, fontSize: '14px', fontWeight: 600, color: '#38bdf8' }}>
            🧭 ЗНАЙШОВ ДЛЯ ВАС
          </div>
          <div style={{ marginBottom: 8, fontSize: '12px', color: '#94a3b8' }}>
            Конкурси · виставки · гранти · резиденції
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              width: '100%',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 16,
              padding: 16,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            📂 ВІДІБРАВ ДЛЯ ВАС
          </button>
          <div style={{ marginTop: 6, fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
            Усі знайдені та відібрані пропозиції за останні 7 днів
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 4, fontSize: '14px', fontWeight: 600, color: '#34d399' }}>
            🖼️ ЗНАЙШОВ, ХТО ШУКАЄ
          </div>
          <div style={{ marginBottom: 8, fontSize: '12px', color: '#94a3b8' }}>
            Покупці · дизайнери · галереї · готелі · ресторани · колекціонери
          </div>
          <button
            onClick={() => setIsCommercialModalOpen(true)}
            style={{
              width: '100%',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: 16,
              padding: 16,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            🤝 ЗНАЙШОВ, ХТО ШУКАЄ АРТ ПАРТНЕРА
          </button>
          <div style={{ marginTop: 6, fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
            Бренди · дизайнери · простори · культурні та комерційні проєкти
          </div>
        </div>

        <div style={{ marginBottom: 20, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
          <button
            onClick={() => setIsTop3Open(!isTop3Open)}
            style={{
              width: '100%',
              backgroundColor: '#1e293b',
              border: 'none',
              padding: '16px',
              color: '#f8fafc',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'left'
            }}
          >
            <span>✨ СЬОГОДНІ Я ЗНАЙШОВ ДЛЯ ВАС</span>
            <span style={{ fontSize: '14px', color: '#38bdf8' }}>{isTop3Open ? '▲ Згорнути' : '▼ Розгорнути'}</span>
          </button>
          {isTop3Open && (
            <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: 4 }}>
                3 найкращі знахідки дня
              </div>
              {loading ? (
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 16, textAlign: 'center', color: '#94a3b8' }}>
                  Завантаження можливостей...
                </div>
              ) : hasNoRecentRelevant ? (
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, marginBottom: 12 }}>
                    «Нових можливостей для вашого поточного профілю не знайдено за останні 7 днів.»
                  </p>
                  <button
                    onClick={() => window.location.href = '/profile'}
                    style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Змінити критерії в профілі
                  </button>
                </div>
              ) : (
                recentRelevantOpps.slice(0, 3).map((opp) => {
                  const deadlineInfo = getDeadlineDetails(opp.deadline)
                  const isExpanded = expandedCardId === opp.id
                  return (
                    <div
                      key={opp.id}
                      style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 6, fontSize: '12px', color: '#cbd5e1' }}>
                        <span>{deadlineInfo.indicator}</span>
                        <span>{deadlineInfo.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                          Відповідає на {opp.matchScore}%
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>{opp.title}</h4>
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {opp.description}
                      </p>
                      <button
                        onClick={() => setExpandedCardId(isExpanded ? null : opp.id)}
                        style={{
                          width: '100%',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 8,
                          padding: '8px 10px',
                          color: '#38bdf8',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginBottom: '8px',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>Чому POVODYR рекомендує це мені?</span>
                        <span>{isExpanded ? '▲' : '▼'}</span>
                      </button>
                      {isExpanded && (
                        <div style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: '8px', marginBottom: '8px', fontSize: '11px', color: '#e2e8f0', border: '1px solid #334155' }}>
                          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#38bdf8' }}>Критерії збігу:</p>
                          <ul style={{ margin: 0, paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <li>✓ техніка відповідає вимогам</li>
                            <li>✓ тематика відповідає творчій практиці</li>
                            <li>✓ географічні вимоги виконані</li>
                          </ul>
                          {opp.matchReasons && opp.matchReasons.length > 0 && (
                            <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '10px' }}>
                              Деталі: {opp.matchReasons.join('. ')}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleGenerateProposal(opp)}
                        disabled={generatingProposalId === opp.id}
                        style={{
                          width: '100%',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginBottom: '8px',
                          textAlign: 'center'
                        }}
                      >
                        {generatingProposalId === opp.id ? '⏳ Генерація пакету документів...' : '📄 Згенерувати пакет документів'}
                      </button>
                      {opp.link_url && (
                        <a
                          href={opp.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            textDecoration: 'none',
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textAlign: 'center',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          🔗 Перейти до першоджерела
                        </a>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
          <button
            onClick={() => setIsMatchingWorksOpen(!isMatchingWorksOpen)}
            style={{
              width: '100%',
              backgroundColor: '#1e293b',
              border: 'none',
              padding: '16px',
              color: '#f8fafc',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'left'
            }}
          >
            <span>🎨 ПІДІБРАВ ВАШІ РОБОТИ</span>
            <span style={{ fontSize: '14px', color: '#38bdf8' }}>{isMatchingWorksOpen ? '▲ Згорнути' : '▼ Розгорнути'}</span>
          </button>
          {isMatchingWorksOpen && (
            <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                Під актуальні запити покупців, дизайнерів, галерей та інших замовників
              </p>
              {(() => {
                if (loading) {
                  return (
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                      Аналіз творчої практики...
                    </div>
                  )
                }

                if (!userArtworks || userArtworks.length === 0) {
                  return (
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                        Щоб підібрати конкретні твори під запит, додайте роботи в профіль.
                      </p>
                      <button
                        onClick={() => { window.location.href = '/profile' }}
                        style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Додати роботи в профіль
                      </button>
                    </div>
                  )
                }

                const matchingWorkCards = commercialOpportunities
                  .filter((reqItem) => isValidHttpUrl(reqItem.source_url))
                  .filter((reqItem) => isFreshMatchingRequest(reqItem))
                  .map((reqItem) => ({
                    reqItem,
                    matched: matchArtworksToRequest(userArtworks, reqItem),
                    summary: shortRequestSummary(reqItem),
                  }))
                  .filter((row) => row.matched.length > 0)
                  .slice(0, 3)

                const portfolioLine = portfolioSummaryLine(userArtworks)

                if (!matchingWorkCards.length) {
                  return (
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                      Немає активних запитів для підбору робіт.
                    </div>
                  )
                }

                return (
                  <>
                    {portfolioLine ? (
                      <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                        {portfolioLine}
                      </p>
                    ) : null}
                    {matchingWorkCards.map(({ reqItem, matched, summary }) => {
                      const isGeneratingThis = generatingMatchingWorksId === reqItem.id
                      return (
                        <div key={`match-work-${reqItem.id}`} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                          <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: 4, fontWeight: 600 }}>
                            Запит: {reqItem.title}
                          </div>
                          {summary ? (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: 8, lineHeight: 1.4 }}>
                              Коротко: {summary}
                            </div>
                          ) : null}
                          <div style={{ fontSize: '11px', color: '#e2e8f0', marginBottom: 8, backgroundColor: '#1e293b', padding: 8, borderRadius: 8, lineHeight: 1.45 }}>
                            <span style={{ color: '#34d399', fontWeight: 600 }}>Рекомендовані твори: </span>
                            {formatMatchedWorksLine(matched)}
                          </div>
                          <a
                            href={reqItem.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#2563eb',
                              color: '#fff',
                              textDecoration: 'none',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              textAlign: 'center',
                              width: '100%',
                              boxSizing: 'border-box',
                              marginBottom: '8px'
                            }}
                          >
                            Відкрити запит
                          </a>
                          <button
                            onClick={() => handleGenerateMatchingWorks(reqItem, matched)}
                            disabled={isGeneratingThis}
                            style={{
                              width: '100%',
                              backgroundColor: isGeneratingThis ? '#047857' : '#059669',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: isGeneratingThis ? 'not-allowed' : 'pointer',
                              textAlign: 'center',
                              opacity: isGeneratingThis ? 0.8 : 1
                            }}
                          >
                            ✨ Формувати презентацію робіт
                          </button>
                          {isGeneratingThis && (
                            <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600, textAlign: 'center', marginTop: '6px' }}>
                              Зачекайте, я формую
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 4, fontSize: '14px', fontWeight: 600, color: '#38bdf8' }}>
            📋 ВІДСТЕЖУЮ ВАШІ ЗАЯВКИ
          </div>
          <div style={{ marginBottom: 8, fontSize: '12px', color: '#94a3b8' }}>
            Статус · дедлайн · результат
          </div>
          <button
            onClick={() => setIsApplicationsModalOpen(true)}
            style={{
              width: '100%',
              backgroundColor: '#1e293b',
              color: 'white',
              border: '1px solid #334155',
              borderRadius: 16,
              padding: 16,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
         📋ВАШІ ЗАЯВКИ ТА РЕЗУЛЬТАТИ ({applicationItems.length})
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 4, fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
            👤 ЗАПАМ'ЯТАВ ПРО ВАС
          </div>
          <div style={{ marginBottom: 8, fontSize: '12px', color: '#94a3b8' }}>
            Ваш профіль · стиль · техніка · теми · цілі
          </div>
          <button
            onClick={() => window.location.href = '/profile'}
            style={{
              width: '100%',
              backgroundColor: '#1e293b',
              color: 'white',
              border: '1px solid #334155',
              borderRadius: 16,
              padding: 16,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            ✏️ ДОДАЙТЕ ПРО СЕБЕ
          </button>
          <div style={{ marginTop: 6, fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
            Чим більше POVODYR знає про вас, тим точніше він шукає.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, borderTop: '1px solid #1e293b', paddingTop: 24 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, letterSpacing: '1px' }}>POVODYR</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#94a3b8' }}>
            Ви створюєте картини. POVODYR допомагає їм знайти шлях.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <img
              src="/icon-192.jpg"
              alt="POVODYR logo"
              style={{ width: 60, height: 'auto', borderRadius: 12, border: '1px solid #334155' }}
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
        </div>

        <NotificationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          notifications={modalOpportunities}
          title="ВІДІБРАВ ДЛЯ ВАС"
        />
                <NotificationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          notifications={modalOpportunities}
          title="ВІДІБРАВ ДЛЯ ВАС"
        />

                <ApplicationsTrackerModal
          isOpen={isApplicationsModalOpen}
          onClose={() => setIsApplicationsModalOpen(false)}
          items={applicationItems}
          onStatusChange={(savedId, newStatus) => {
            setApplicationItems((prev) => prev.map((item: any) => (
              item.id === savedId ? { ...item, status: newStatus } : item
            )))
          }}
        />

        {isDeadlineModalOpen && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, padding: 16,
            }}
            onClick={() => setIsDeadlineModalOpen(false)}
          >
            <div
              style={{
                backgroundColor: '#1a1d2d',
                border: '1px solid #334155',
                borderRadius: 16,
                width: '100%',
                maxWidth: 560,
                maxHeight: '85vh',
                overflowY: 'auto',
                color: '#fff',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #334155' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>ДЕДЛАЙНИ</h2>
                <button
                  onClick={() => setIsDeadlineModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 24, cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: 16 }}>
                {applicationItems.filter((item: any) => item.opportunity?.deadline).length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 8px', fontSize: 14 }}>
                    Немає заявок із дедлайном.
                  </div>
                ) : (
                  applicationItems
                    .filter((item: any) => item.opportunity?.deadline)
                    .map((item: any) => {
                      const info = getDeadlineDetails(item.opportunity?.deadline)
                      const d = new Date(item.opportunity.deadline)
                      const dateLabel = Number.isNaN(d.getTime())
                        ? 'не вказано'
                        : d.toLocaleDateString('uk-UA')
                      return (
                        <div
                          key={item.id}
                          style={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>{info.indicator}</span>
                            <span style={{ fontSize: 12, color: '#cbd5e1' }}>{info.label}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            {item.opportunity?.title || 'Можливість без назви'}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            Дата: {dateLabel}
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>
        )}
        {isCommercialModalOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16
          }}>
            <div style={{
              backgroundColor: '#1e293b', border: '1px solid #334155',
              borderRadius: 16, padding: 20, width: '100%', maxWidth: 440,
              maxHeight: '85dvh', overflowY: 'auto', color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#34d399' }}>🤝 ЗНАЙШОВ, ХТО ШУКАЄ АРТ ПАРТНЕРА</h3>
                <button
                  onClick={() => setIsCommercialModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: 16 }}>
                Запити від інтер'єрних студій, готелів, галерей та приватних колекціонерів на придбання та розміщення картин.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {commercialOpportunities.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>Наразі немає активних комерційних запитів.</p>
                ) : (
                  commercialOpportunities.map((comm: any) => (
                    <div key={comm.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '11px', color: '#38bdf8' }}>
                        <span>Відповідає на {comm.matchScore}%</span>
                        <span>Бюджет: {comm.budget} {comm.currency}</span>
                      </div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>{comm.title}</h4>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{comm.description}</p>
                      {comm.what_is_needed && (
                        <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#34d399', lineHeight: 1.3 }}>
                          <strong>Вимоги:</strong> {comm.what_is_needed}
                        </p>
                      )}
                      <div style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: '8px', marginBottom: '10px', fontSize: '11px', border: '1px solid #334155' }}>
                        <div style={{ color: '#f8fafc', fontWeight: 600, marginBottom: 2 }}>🏢 Замовник: {comm.organization}</div>
                        <div style={{ color: '#cbd5e1' }}>👤 Контактна особа: {comm.contact_person}</div>
                      </div>
                      <a
                        href={comm.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          textDecoration: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textAlign: 'center',
                          width: '100%',
                          boxSizing: 'border-box',
                          marginBottom: '8px'
                        }}
                      >
                        🔗 Відкрити запит замовника
                      </a>
                      <button
                        onClick={() => handleGenerateProposal(comm)}
                        disabled={generatingProposalId === comm.id}
                        style={{
                          width: '100%',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        {generatingProposalId === comm.id ? '⏳ Генерація пропозиції...' : '✍️ Підготувати пропозицію та контакти'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {proposalModalData && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16
          }}>
            <div style={{
              backgroundColor: '#1e293b', border: '1px solid #334155',
              borderRadius: 16, padding: 20, width: '100%', maxWidth: 440,
              maxHeight: '85dvh', overflowY: 'auto', color: '#fff'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#38bdf8' }}>
                {proposalModalData.title}
              </h3>
              {proposalModalData.organization && (
                <div style={{ backgroundColor: '#0f172a', padding: 8, borderRadius: 8, marginBottom: 10, fontSize: '12px', border: '1px solid #334155' }}>
                  <div style={{ color: '#34d399', fontWeight: 600 }}>Замовник: {proposalModalData.organization}</div>
                  <div style={{ color: '#cbd5e1' }}>Контактна особа: {proposalModalData.contactPerson}</div>
                </div>
              )}
              <textarea
                value={proposalModalData.text}
                onChange={(e) => setProposalModalData({ ...proposalModalData, text: e.target.value })}
                style={{
                  width: '100%', height: 160, backgroundColor: '#0f172a',
                  color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8,
                  padding: 10, fontSize: '13px', resize: 'none', boxSizing: 'border-box',
                  marginBottom: 12, outline: 'none'
                }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(proposalModalData.text)
                    alert('Текст скопійовано до буферу обміну!')
                  }}
                  style={{
                    backgroundColor: '#334155', color: '#fff', border: '1px solid #475569',
                    borderRadius: 8, padding: '10px 8px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <span>📋</span> Копіювати текст
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([proposalModalData.text], { type: 'text/plain;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'proposal.txt'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{
                    backgroundColor: '#334155', color: '#fff', border: '1px solid #475569',
                    borderRadius: 8, padding: '10px 8px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <span>💾</span> Завантажити (.txt)
                </button>
              </div>
              <div style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 10, color: '#e2e8f0' }}>
                  Як вам цей варіант?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => handleSendFeedback('Добре, можна використовувати')}
                    style={{
                      backgroundColor: '#059669', color: 'white', border: 'none',
                      borderRadius: 8, padding: '10px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    ✅ Добре, можна використовувати
                  </button>
                  <button
                    onClick={() => handleSendFeedback('Потрібно змінити тон / зробити більш особистим')}
                    style={{
                      backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #475569',
                      borderRadius: 8, padding: '10px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    ✏️ Потрібно змінити тон
                  </button>
                  <button
                    onClick={() => handleSendFeedback('Занадто офіційно / канцелярсько')}
                    style={{
                      backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #475569',
                      borderRadius: 8, padding: '10px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    📄 Занадто офіційно
                  </button>
                  <button
                    onClick={() => handleSendFeedback('Не підходить взагалі')}
                    style={{
                      backgroundColor: '#1e293b', color: '#f87171', border: '1px solid #475569',
                      borderRadius: 8, padding: '10px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    ❌ Не підходить
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <a
                  href={`mailto:artfinenation@gmail.com?subject=${encodeURIComponent(proposalModalData.title)}&body=${encodeURIComponent(proposalModalData.text)}`}
                  style={{
                    flex: 1, backgroundColor: '#059669', color: '#fff', textDecoration: 'none',
                    borderRadius: 8, padding: '10px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxSizing: 'border-box'
                  }}
                >
                  <span>✉️</span> Написати замовнику
                </a>
              </div>
              <button
                onClick={() => setProposalModalData(null)}
                style={{
                  width: '100%', backgroundColor: '#1e293b', color: '#94a3b8',
                  border: '1px solid #334155', borderRadius: 8, padding: '8px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Закрити вікно
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
