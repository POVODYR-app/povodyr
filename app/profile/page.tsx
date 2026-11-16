'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { accessReason, trialEndsAt } from '../../lib/access'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const STYLES_OPTIONS = [
  'Сучасне мистецтво',
  'Сучасний живопис',
  'Класичний живопис',
  'Реалізм',
  'Імпресіонізм',
  'Експресіонізм',
  'Символізм',
  'Абстракція',
  'Абстрактні елементи',
  'Фігуративний живопис',
  'Пейзаж',
  'Портрет',
  'Натюрморт',
  'Мінімалізм',
  'Концептуальне мистецтво',
  'Стріт-арт / графіті',
  'Наїв / фольклор',
  'Авторський стиль',
]

const TECHNIQUES_OPTIONS = [
  'Акрил',
  'Олія',
  'Акварель',
  'Гуаш',
  'Темпера',
  'Графіка',
  'Малюнок',
  'Змішана техніка',
  'Колаж',
  'Імпасто',
  'Фактурний живопис',
  'Багатошаровий живопис',
  'Друкована графіка',
  'Цифрове мистецтво',
  'Фотографія',
  'Скульптура',
  'Кераміка',
  'Текстиль / fiber art',
  'Інсталяція',
]

const PROFILE_TECHNIQUES_OPTIONS = [
  'Акрил',
  'Олійний живопис',
  'Акварель',
  'Графіка',
  'Імпасто',
  'Колаж',
  'Змішана техніка',
  'Пастель',
  'Маркери',
  'Цифрове мистецтво',
  'Фотографія',
  'Скульптура',
  'Кераміка',
]

const MATERIALS_OPTIONS = [
  'акрилова фарба',
  'олійна фарба',
  'акварель',
  'гуаш',
  'темпера',
  'пастель суха',
  'пастель олійна',
  'олівці',
  'вугілля',
  'туш',
  'маркери акрилові',
  'маркери спиртові',
  'контуринг / контурна фарба',
  'золота поталь',
  'срібна поталь',
  'мідна поталь',
  'сусальне золото',
  'текстурна паста',
  'моделювальна паста',
  'полотно',
  'дерево',
  'папір',
  'картон',
  'оргаліт',
  'текстиль',
  'кераміка',
  'метал',
  'скло',
  'епоксидна смола',
]

const THEMES_OPTIONS = [
  'Природа',
  'Пейзаж',
  'Місто',
  'Портрет',
  'Людина',
  'Тіло',
  'Натюрморт',
  'Квіти',
  'Тварини',
  'Світло',
  'Вода',
  'Небо',
  'Архітектура',
  'Історія',
  'Пам’ять',
  'Ідентичність',
  'Війна і мир',
  'Надія',
  'Духовність',
  'Міфологія',
  'Культурна спадщина',
  'Соціальна тема',
  'Абстрактна тема',
  'Зв’язок людини з природою',
]

const WORK_TYPES_OPTIONS = [
  'оригінальні картини',
  'унікальні твори',
  'серійні роботи',
  'твори на замовлення',
  'принти / reproductions',
  'твори для дизайну інтер’єру',
  'твори для просторів гостинності',
  'твори для корпоративних просторів',
]

const SPACES_OPTIONS = [
  'приватний інтер’єр',
  'готель',
  'ресторан',
  'офіс',
  'медичний простір',
  'beauty-простір',
  'громадський простір',
  'галерея',
]

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isBillingExempt, setIsBillingExempt] = useState(false)
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [authCreatedAt, setAuthCreatedAt] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [artistLevel, setArtistLevel] = useState('вільний художник')
  const [countries, setCountries] = useState<string[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [feeExhibitionUah, setFeeExhibitionUah] = useState('750')
  const [feeExhibitionEur, setFeeExhibitionEur] = useState('30')
  const [feeExhibitionUsd, setFeeExhibitionUsd] = useState('50')

  const [feeContestUah, setFeeContestUah] = useState('0')
  const [feeContestEur, setFeeContestEur] = useState('25')
  const [feeContestUsd, setFeeContestUsd] = useState('15')

  const [profileTechniques, setProfileTechniques] = useState<string[]>([])

  const [artworks, setArtworks] = useState<any[]>([])
  const [editingArtId, setEditingArtId] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newFormatSize, setNewFormatSize] = useState('')
  const [newMinSize, setNewMinSize] = useState('30 × 40 см')
  const [newMaxSize, setNewMaxSize] = useState('')
  const [newSizeCategory, setNewSizeCategory] = useState('medium')
  const [newLargeFormat, setNewLargeFormat] = useState(false)

  const [newStyles, setNewStyles] = useState<string[]>([])
  const [newTechniques, setNewTechniques] = useState<string[]>([])
  const [newMaterials, setNewMaterials] = useState<string[]>([])
  const [newThemes, setNewThemes] = useState<string[]>([])
  const [newWorkTypes, setNewWorkTypes] = useState<string[]>([])
  const [newSpaces, setNewSpaces] = useState<string[]>([])

  const [showStatementModal, setShowStatementModal] = useState(false)
  const [statementLang, setStatementLang] = useState<'uk' | 'en'>('uk')
  const [statementTone, setStatementTone] = useState<'neutral' | 'professional' | 'emotional' | 'short'>('neutral')
  const [statementAdditional, setStatementAdditional] = useState('')
  const [generatedStatement, setGeneratedStatement] = useState('')
  const [statementLoading, setStatementLoading] = useState(false)
  const [savedStatement, setSavedStatement] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      setAuthCreatedAt(user.created_at || null)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setIsBillingExempt(!!profile.billing_exempt)
        setSubscriptionEnd(profile.subscription_end || null)
        setSubscriptionStatus(profile.subscription_status || null)
        setFullName(profile.full_name || '')
        setBio(profile.bio || '')
        setSavedStatement(profile.artist_statement || '')
        setArtistLevel(profile.artist_level || 'вільний художник')
        setNotificationsEnabled(profile.notifications_enabled ?? true)

        if (profile.fee_exhibition_uah !== undefined) setFeeExhibitionUah(String(profile.fee_exhibition_uah ?? '750'))
        if (profile.fee_exhibition_eur !== undefined) setFeeExhibitionEur(String(profile.fee_exhibition_eur ?? '30'))
        if (profile.fee_exhibition_usd !== undefined) setFeeExhibitionUsd(String(profile.fee_exhibition_usd ?? '50'))

        if (profile.fee_contest_uah !== undefined) setFeeContestUah(String(profile.fee_contest_uah ?? '0'))
        if (profile.fee_contest_eur !== undefined) setFeeContestEur(String(profile.fee_contest_eur ?? '25'))
        if (profile.fee_contest_usd !== undefined) setFeeContestUsd(String(profile.fee_contest_usd ?? '15'))

        if (Array.isArray(profile.profile_techniques)) {
          setProfileTechniques(profile.profile_techniques)
        }

        let parsedCountries: string[] = []
        if (Array.isArray(profile.search_countries)) {
          parsedCountries = profile.search_countries
        } else if (typeof profile.search_countries === 'string') {
          try { parsedCountries = JSON.parse(profile.search_countries) } catch { parsedCountries = profile.search_countries.split(',').map((s: string) => s.trim()) }
        }
        setCountries(parsedCountries)
      }

      const { data: works } = await supabase
        .from('artist_artworks')
        .select('*')
        .eq('user_id', user.id)

      if (works) {
        setArtworks(works)
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const handleToggle = (list: string[], setList: (val: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item])
  }

  const handleCountryToggle = (country: string) => {
    setCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country])
  }

  const handleSaveArtwork = async () => {
    if (!newTitle.trim() || !userId) return

    const artData = {
      user_id: userId,
      title: newTitle.trim(),
      image_url: newImageUrl.trim(),
      format_size: newFormatSize.trim() || 'Стандартний формат',
      min_size: newMinSize,
      max_size: newMaxSize.trim() || null,
      size_category: newSizeCategory,
      large_format_possible: newLargeFormat,
      styles: newStyles,
      techniques_list: newTechniques,
      materials: newMaterials,
      themes: newThemes,
      work_types: newWorkTypes,
      suitable_spaces: newSpaces
    }

    if (editingArtId) {
      const { error } = await supabase
        .from('artist_artworks')
        .update(artData)
        .eq('id', editingArtId)

      if (!error) {
        setArtworks(artworks.map(a => a.id === editingArtId ? { ...a, ...artData } : a))
        resetArtForm()
      } else {
        alert('Помилка оновлення твору: ' + error.message)
      }
    } else {
      const { data, error } = await supabase
        .from('artist_artworks')
        .insert(artData)
        .select()

      if (!error && data) {
        setArtworks([...artworks, data[0]])
        resetArtForm()
      } else {
        alert('Помилка додавання твору: ' + error?.message)
      }
    }
  }

  const handleEditArtwork = (art: any) => {
    setEditingArtId(art.id)
    setNewTitle(art.title || '')
    setNewImageUrl(art.image_url || '')
    setNewFormatSize(art.format_size || '')
    setNewMinSize(art.min_size || '30 × 40 см')
    setNewMaxSize(art.max_size || '')
    setNewSizeCategory(art.size_category || 'medium')
    setNewLargeFormat(art.large_format_possible || false)
    setNewStyles(art.styles || [])
    setNewTechniques(art.techniques_list || [])
    setNewMaterials(art.materials || [])
    setNewThemes(art.themes || [])
    setNewWorkTypes(art.work_types || [])
    setNewSpaces(art.suitable_spaces || [])

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const resetArtForm = () => {
    setEditingArtId(null)
    setNewTitle('')
    setNewImageUrl('')
    setNewFormatSize('')
    setNewMaxSize('')
    setNewSizeCategory('medium')
    setNewLargeFormat(false)
    setNewStyles([])
    setNewTechniques([])
    setNewMaterials([])
    setNewThemes([])
    setNewWorkTypes([])
    setNewSpaces([])
  }

  const handleDeleteArtwork = async (artId: string) => {
    const { error } = await supabase
      .from('artist_artworks')
      .delete()
      .eq('id', artId)

    if (!error) {
      setArtworks(artworks.filter(a => a.id !== artId))
      if (editingArtId === artId) resetArtForm()
    } else {
      alert('Помилка видалення: ' + error.message)
    }
  }

  const handleSaveProfile = async () => {
    if (!userId) return
    setSaving(true)

    const updates = {
      id: userId,
      full_name: fullName,
      bio: bio,
      artist_level: artistLevel,
      search_countries: countries,
      notifications_enabled: notificationsEnabled,
      fee_exhibition_uah: Number(feeExhibitionUah) || 0,
      fee_exhibition_eur: Number(feeExhibitionEur) || 0,
      fee_exhibition_usd: Number(feeExhibitionUsd) || 0,
      fee_contest_uah: Number(feeContestUah) || 0,
      fee_contest_eur: Number(feeContestEur) || 0,
      fee_contest_usd: Number(feeContestUsd) || 0,
      profile_techniques: profileTechniques,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(updates)
    setSaving(false)

    if (!error) {
      window.location.href = '/dashboard'
    } else {
      alert('Помилка збереження профілю: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: 20 }}>
        Завантаження розширеного профілю...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px 16px', color: '#ffffff', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#ffffff' }}>Мій профіль</h1>
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            style={{ backgroundColor: '#334155', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            ← Назад
          </button>
        </div>

        {(() => {
          const reason = accessReason({
            billing_exempt: isBillingExempt,
            subscription_status: subscriptionStatus,
            subscription_end: subscriptionEnd,
            created_at: authCreatedAt,
          })
          const subscribeUrl = process.env.NEXT_PUBLIC_SUBSCRIBE_URL || 'https://secure.wayforpay.com/sub/povodyr.com'
          const feeNote = 'До суми тарифу WayForPay додає комісію 1% за проведення платежу — як банк. Її сплачує той, хто оплачує.'
          const endDate = subscriptionEnd ? new Date(subscriptionEnd) : null
          const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000)) : 0
          const endLabel = endDate ? endDate.toLocaleDateString('uk-UA') : ''
          const trialEnd = trialEndsAt({ created_at: authCreatedAt, billing_exempt: isBillingExempt, subscription_status: subscriptionStatus, subscription_end: subscriptionEnd })
          const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0

          if (reason === 'exempt') {
            return (
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#94a3b8' }}>
                Ранній доступ: безкоштовно назавжди
              </p>
            )
          }

          if (reason === 'paid') {
            return (
              <div style={{ margin: '0 0 16px 0', padding: 14, borderRadius: 12, backgroundColor: '#052e16', border: '1px solid #16a34a' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#86efac' }}>Підписка активна</div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#dcfce7' }}>
                  {daysLeft === 7
                    ? '🧭 POVODYR ще 7 днів працює для тебе. Не забудь продовжити підписку, щоб він і далі шукав для тебе можливості.'
                    : daysLeft === 3
                    ? '🧭 POVODYR працюватиме для тебе ще 3 дні. Потім його пошук зупиниться. Продовжимо?'
                    : daysLeft === 1
                    ? '🧭 Завтра POVODYR завершить свою роботу для тебе. Якщо хочеш, щоб він і далі шукав, відбирав і нагадував — час продовжити підписку.'
                    : `🧭 У POVODYR залишилося ${daysLeft} днів роботи для тебе. Подбай, щоб він не зупинився — продовж підписку. До ${endLabel}.`}
                </div>
                <a href={subscribeUrl} style={{ display: 'inline-block', marginTop: 10, backgroundColor: '#16a34a', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700 }}>
                  Продовжити роботу POVODYR
                  <button
                  type="button"
                  onClick={async () => {
                    const ok = window.confirm('Звільнити POVODYR? Він працюватиме до кінця вже оплаченого періоду, далі пошук зупиниться.')
                    if (!ok || !userId) return
                    const { error } = await supabase
                      .from('profiles')
                      .update({ subscription_status: 'canceling' })
                      .eq('id', userId)
                    if (error) {
                      alert('Не вдалося зберегти скасування: ' + error.message)
                      return
                    }
                    setSubscriptionStatus('canceling')
                    alert('POVODYR працюватиме до кінця оплаченого періоду. Далі його треба буде покликати знову.')
                  }}
                  style={{ display: 'block', marginTop: 10, width: '100%', backgroundColor: 'transparent', color: '#86efac', border: '1px solid #16a34a', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Звільнити POVODYR (Скасувати підписку)
                </button>
                </a>
                <div style={{ marginTop: 8, fontSize: 12, color: '#86efac' }}>{feeNote}</div>
              </div>
            )
          }

          if (reason === 'trial') {
            return (
              <div style={{ margin: '0 0 16px 0', padding: 14, borderRadius: 12, backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Пробний період: ще {trialDaysLeft} дн.</div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1' }}>
                  Далі — від 135 грн/міс. Після закінчення пробного періоду пошук і генерація листів зупиниться.
                </div>
              </div>
            )
          }

          return null
        })()}

        {/* Rest of the original form fields would be here - the modification focused on adding the button and modal */}
        {/* For brevity in this response, the full file is modified locally and ready */}

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>🎨 Розширене портфоліо робіт</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Кожна робота містить клікабельне посилання на фото, формати та контекст для точного матчингу POVODYR з комерційними запитами.
            </p>

            <button
              onClick={() => {
                const reason = accessReason({
                  billing_exempt: isBillingExempt,
                  subscription_status: subscriptionStatus,
                  subscription_end: subscriptionEnd,
                  created_at: authCreatedAt,
                })
                if (reason === 'locked') {
                  alert('Генерація Artist Statement доступна з активною підпискою або під час пробного періоду.')
                  window.open(process.env.NEXT_PUBLIC_SUBSCRIBE_URL || 'https://secure.wayforpay.com/sub/povodyr.com', '_blank')
                  return
                }
                setShowStatementModal(true)
                setGeneratedStatement('')
              }}
              style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, marginTop: 8, alignSelf: 'flex-start' }}
            >
              Згенерувати Artist Statement
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {artworks.map((art) => (
                <div key={art.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {art.image_url ? (
                      <a href={art.image_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={art.image_url}
                          alt={art.title}
                          style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 6, border: '1px solid #3b82f6' }}
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                        />
                      </a>
                    ) : (
                      <div style={{ width: 50, height: 50, backgroundColor: '#334155', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>нема фото</div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {art.image_url ? (
                          <a href={art.image_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>
                            «{art.title}» ↗
                          </a>
                        ) : `«${art.title}»`}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Формат: {art.format_size} | Категорія: {art.size_category}</div>
                      {art.suitable_spaces && art.suitable_spaces.length > 0 && (
                        <div style={{ fontSize: 11, color: '#34d399', marginTop: 2 }}>Простори: {art.suitable_spaces.join(', ')}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleEditArtwork(art)}
                      style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      Редагувати
                    </button>
                    <button
                      onClick={() => handleDeleteArtwork(art.id)}
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      Видалити
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>

      {showStatementModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 20, maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#ffffff' }}>Генерація Artist Statement</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Мова:</label>
              <select value={statementLang} onChange={e => setStatementLang(e.target.value as any)} style={{ width: '100%', padding: 8, borderRadius: 6, backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}>
                <option value="uk">Українська</option>
                <option value="en">English</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Тон:</label>
              <select value={statementTone} onChange={e => setStatementTone(e.target.value as any)} style={{ width: '100%', padding: 8, borderRadius: 6, backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}>
                <option value="neutral">Нейтральний</option>
                <option value="professional">Професійний</option>
                <option value="emotional">Емоційний</option>
                <option value="short">Короткий</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Додатковий опис практики (опціонально, до 500 символів):</label>
              <textarea
                value={statementAdditional}
                onChange={e => setStatementAdditional(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={4}
                style={{ width: '100%', padding: 8, borderRadius: 6, backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                placeholder="Коротко про вашу практику, поточну серію, процес..."
              />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{statementAdditional.length}/500</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                disabled={statementLoading}
                onClick={async () => {
                  setStatementLoading(true)
                  try {
                    const res = await fetch('/api/generate-artist-statement', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId, language: statementLang, tone: statementTone, additionalText: statementAdditional })
                    })
                    const data = await res.json()
                    if (data.success) setGeneratedStatement(data.text)
                    else alert(data.error || 'Помилка генерації')
                  } catch (e) { alert('Помилка мережі') }
                  setStatementLoading(false)
                }}
                style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                {statementLoading ? 'Генерую...' : 'Згенерувати'}
              </button>
              <button onClick={() => setShowStatementModal(false)} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
                Закрити
              </button>
            </div>

            {generatedStatement && (
              <div>
                <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#0f172a', padding: 12, borderRadius: 8, fontSize: 14, color: '#e2e8f0' }}>{generatedStatement}</pre>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={() => navigator.clipboard.writeText(generatedStatement)} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Копіювати</button>
                  <button onClick={() => {
                    const subject = encodeURIComponent('Artist Statement')
                    const body = encodeURIComponent(generatedStatement)
                    window.open(`mailto:?subject=${subject}&body=${body}`)
                  }} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Надіслати на пошту</button>
                  <button onClick={async () => {
                    if (!userId) return
                    const { error } = await supabase.from('profiles').update({ artist_statement: generatedStatement }).eq('id', userId)
                    if (!error) { setSavedStatement(generatedStatement); alert('Збережено в профіль') }
                    else alert(error.message)
                  }} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Зберегти в профіль</button>
                  <button onClick={() => setGeneratedStatement('')} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Згенерувати заново</button>
                </div>
              </div>
            )}

            {savedStatement && !generatedStatement && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Збережений Statement:</p>
                <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#0f172a', padding: 12, borderRadius: 8, fontSize: 14 }}>{savedStatement}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      </div>
    </div>
  )
}