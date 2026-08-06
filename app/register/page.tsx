export default function RegisterPage() {
  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '20px' }}>Реєстрація</h1>
      
      <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>Email</label>
          <input 
            type="email" 
            placeholder="your@email.com"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>Пароль</label>
          <input 
            type="password" 
            placeholder="••••••••"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
        </div>

        <button 
          type="submit"
          style={{ 
            padding: '12px', 
            backgroundColor: '#000', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Зареєструватися
        </button>
      </form>

      <p style={{ marginTop: '20px', fontSize: '14px' }}>
        Вже є акаунт? <a href="/login">Увійти</a>
      </p>
    </main>
  )
}
