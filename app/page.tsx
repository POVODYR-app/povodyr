export default function HomePage() {
  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>POVODYR</h1>
      <p style={{ fontSize: '18px', color: '#555', marginBottom: '30px' }}>
        Цифровий асистент для українських художників.<br />
        POVODYR бачить можливості. Художник обирає шлях.
      </p>

      <div style={{ display: 'flex', gap: '12px' }}>
        <a 
          href="/login" 
          style={{ 
            padding: '12px 24px', 
            backgroundColor: '#000', 
            color: '#fff', 
            textDecoration: 'none',
            borderRadius: '8px'
          }}
        >
          Увійти
        </a>
        <a 
          href="/register" 
          style={{ 
            padding: '12px 24px', 
            backgroundColor: '#f0f0f0', 
            color: '#000', 
            textDecoration: 'none',
            borderRadius: '8px'
          }}
        >
          Зареєструватися
        </a>
      </div>
    </main>
  )
}
