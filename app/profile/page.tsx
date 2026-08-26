'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const STYLES_OPTIONS = [
  'Сучасне мистецтво', 'Сучасний живопис', 'Авторський стиль Solarism / Солярісм', 
  'Символізм', 'Фігуративний / напівзображальний пейзаж', 'Абстрактні елементи'
]

const TECHNIQUES_OPTIONS = [
  'Акрил', 'Олія', 'Змішана техніка', 'Сусальне золото / поталь', 'Фактурний живопис', 'Багатошаровий живопис'
]

const MATERIALS_OPTIONS = [
  'акрилова фарба', 'олійна фарба', 'золота поталь', 'текстурна паста', 'полотно'
]

const THEMES_OPTIONS = [
  'Світло', 'Природа', 'Пейзаж', 'Світанок', 'Сонячне світло', 'Вода', 'Дерева', 
  'Березовий гай', 'Українська культурна спадщина', 'Українська історія', 'Пам’ять', 'Надія', 'Зв’язок людини з природою'
]

const WORK_TYPES_OPTIONS = [
  'оригінальні картини', 'унікальні твори', 'твори на замовлення', 
  'твори для дизайну інтер’єру', 'твори для просторів гостинності', 'твори для корпоративних просторів'
]

const SPACES_OPTIONS = [
  'приватний інтер’єр', 'готель', 'ресторан', 'офіс', 
  'медичний простір', 'beauty-простір', 'громадський простір', 'галерея'
]

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [artistLevel, setArtistLevel] = useState('вільний художник')
  const [countries, setCountries] = useState<string[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Стан для робіт портфоліо
  const [artworks, setArtworks] = useState<any[]>([])
  const [editingArtId, setEditingArtId] = useState<string | null>(null)
  
  // Поля форми картини
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

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setBio(profile.bio || '')
        setArtistLevel(profile.artist_level || 'вільний художник')
        setNotificationsEnabled(profile.notifications_enabled ?? true)
        
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
      // Редагування існуючої картини
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
      // Додавання нової картини
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
    
    // Прокрутка до форми редагування
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
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#ffffff' }}>Комерційний профіль POVODYR</h1>
          <button 
            onClick={() => { window.location.href = '/dashboard' }}
            style={{ backgroundColor: '#334155', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            ← Назад
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Загальна інформація */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>👤 Загальна інформація</h3>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Повне ім'я *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Біографія та концепція (CV / Bio)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Рівень митця *</label>
              <select
                value={artistLevel}
                onChange={(e) => setArtistLevel(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
              >
                <option value="вільний художник">вільний художник</option>
                <option value="початківець">початківець</option>
                <option value="професіонал">професіонал</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Країни пошуку можливостей</label>
              <div style={{ display: 'flex', gap: 16 }}>
                {['Україна', 'ЄС', 'США'].map((c) => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={countries.includes(c)}
                      onChange={() => handleCountryToggle(c)}
                    />
                    <span style={{ fontSize: 13 }}>{c}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* РОЗШИРЕНЕ ПОРТФОЛІО */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>🎨 Розширене портфоліо робіт</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Кожна робота містить клікабельне посилання на фото, формати та контекст для точного матчингу POVODYR з комерційними запитами.
            </p>

            {/* Список робіт */}
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

            {/* Форма додавання / редагування картини */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
                  {editingArtId ? '✏️ Редагувати обраний твір' : '+ Додати новий твір у портфоліо'}
                </span>
                {editingArtId && (
                  <button 
                    onClick={resetArtForm}
                    style={{ backgroundColor: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Скасувати редагування
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Назва картини (напр. Сновидіння)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
                />
                <input
                  type="url"
                  placeholder="Клікабельне посилання на фото (URL)"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  style={{ flex: 3, padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
                />
              </div>

              {/* Прев'ю фото у формі */}
              {newImageUrl.trim() && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', padding: 8, borderRadius: 8, border: '1px solid #334155' }}>
                  <img 
                    src={newImageUrl} 
                    alt="Прев'ю" 
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} 
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                  />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Прев'ю зображення за посиланням вище</span>
                </div>
              )}

              {/* Розміри та формат */}
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Основний формат (напр. 80х100 см)"
                  value={newFormatSize}
                  onChange={(e) => setNewFormatSize(e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder="Макс. формат (напр. 150х200 см)"
                  value={newMaxSize}
                  onChange={(e) => setNewMaxSize(e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
                />
                <select
                  value={newSizeCategory}
                  onChange={(e) => setNewSizeCategory(e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
                >
                  <option value="small">small (малий)</option>
                  <option value="medium">medium (середній)</option>
                  <option value="large">large (великий)</option>
                  <option value="oversized">oversized (надвеликий)</option>
                </select>
              </div>

              <div style={{ fontSize: 12, color: '#94a3b8' }}>Мінімальний формат за замовчуванням: 30 × 40 см</div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={newLargeFormat} onChange={(e) => setNewLargeFormat(e.target.checked)} />
                Можливе виконання великих форматів (на замовлення)
              </label>

              {/* Стилі твору */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Стиль / напрям:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STYLES_OPTIONS.map(st => (
                    <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #334155' }}>
                      <input type="checkbox" checked={newStyles.includes(st)} onChange={() => handleToggle(newStyles, setNewStyles, st)} />
                      {st}
                    </label>
                  ))}
                </div>
              </div>

              {/* Основні техніки */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Основні техніки:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TECHNIQUES_OPTIONS.map(tech => (
                    <label key={tech} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #334155' }}>
                      <input type="checkbox" checked={newTechniques.includes(tech)} onChange={() => handleToggle(newTechniques, setNewTechniques, tech)} />
                      {tech}
                    </label>
                  ))}
                </div>
              </div>

              {/* Матеріали */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Матеріали:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {MATERIALS_OPTIONS.map(mat => (
                    <label key={mat} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #334155' }}>
                      <input type="checkbox" checked={newMaterials.includes(mat)} onChange={() => handleToggle(newMaterials, setNewMaterials, mat)} />
                      {mat}
                    </label>
                  ))}
                </div>
              </div>

              {/* Основні теми */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Основні теми:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {THEMES_OPTIONS.map(th => (
                    <label key={th} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #334155' }}>
                      <input type="checkbox" checked={newThemes.includes(th)} onChange={() => handleToggle(newThemes, setNewThemes, th)} />
                      {th}
                    </label>
                  ))}
                </div>
              </div>

              {/* Типи робіт */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Типи робіт:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {WORK_TYPES_OPTIONS.map(wt => (
                    <label key={wt} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #334155' }}>
                      <input type="checkbox" checked={newWorkTypes.includes(wt)} onChange={() => handleToggle(newWorkTypes, setNewWorkTypes, wt)} />
                      {wt}
                    </label>
                  ))}
                </div>
              </div>

              {/* Комерційні простори */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#34d399', display: 'block', marginBottom: 4 }}>Для яких комерційних просторів підходить ця робота?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SPACES_OPTIONS.map(space => (
                    <label key={space} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #059669' }}>
                      <input type="checkbox" checked={newSpaces.includes(space)} onChange={() => handleToggle(newSpaces, setNewSpaces, space)} />
                      {space}
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveArtwork}
                style={{ backgroundColor: editingArtId ? '#059669' : '#2563eb', color: '#ffffff', border: 'none', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 8 }}
              >
                {editingArtId ? '💾 Оновити твір у портфоліо' : '+ Зберегти роботу з повним комерційним контекстом'}
              </button>
            </div>
          </div>

          {/* Сповіщення та збереження */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
              />
              <span style={{ fontSize: 14 }}>Отримувати щоденні сповіщення від POVODYR</span>
            </label>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontWeight: 700,
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            {saving ? 'Збереження...' : 'Зберегти зміни профілю'}
          </button>

        </div>
      </div>
    </div>
  )
}
