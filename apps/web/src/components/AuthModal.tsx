import { useState } from 'react'
import { api, type User } from '../api'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (user: User) => void
  isCheckoutTrigger?: boolean
}

export default function AuthModal({
  open,
  onClose,
  onSuccess,
  isCheckoutTrigger = false,
}: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const resetForm = () => {
    setUsername('')
    setPhone('')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setShowPassword(false)
  }

  const handleSwitchTab = (newTab: 'login' | 'register') => {
    setTab(newTab)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanUser = username.trim()
    const cleanPhone = phone.trim()

    if (tab === 'login') {
      if (!cleanUser || !password) {
        setError('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu')
        return
      }

      setLoading(true)
      try {
        const res = await api.auth.login({ username: cleanUser, password })
        resetForm()
        onSuccess(res.user)
        onClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Đăng nhập không thành công, vui lòng thử lại')
      } finally {
        setLoading(false)
      }
    } else {
      // TAB REGISTER (Option A: username, phone, password, confirmPassword)
      if (!cleanUser || cleanUser.length < 3) {
        setError('Tên tài khoản phải có ít nhất 3 ký tự')
        return
      }

      if (!cleanPhone || cleanPhone.length < 9) {
        setError('Vui lòng nhập số điện thoại hợp lệ (9 - 11 chữ số) để nhân viên gọi tư vấn')
        return
      }

      if (!password || password.length < 6) {
        setError('Mật khẩu phải từ 6 ký tự trở lên để đảm bảo an toàn')
        return
      }

      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp! Vui lòng nhập lại chính xác.')
        return
      }

      setLoading(true)
      try {
        const res = await api.auth.register({
          username: cleanUser,
          phone: cleanPhone,
          password,
        })
        resetForm()
        onSuccess(res.user)
        onClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Đăng ký không thành công, vui lòng thử lại')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Nút đóng */}
        <button className="auth-close-btn" onClick={onClose} aria-label="Đóng cửa sổ">
          ✕
        </button>

        {/* Tabs chuyển đổi Đăng nhập / Đăng ký */}
        <div className="auth-tabs-header">
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => handleSwitchTab('login')}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => handleSwitchTab('register')}
          >
            Tạo tài khoản mới
          </button>
        </div>

        {/* Form Body */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error-alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Tên tài khoản</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">👤</span>
              <input
                type="text"
                className="auth-input"
                placeholder={tab === 'login' ? 'Nhập tên tài khoản của bạn' : 'Tên tài khoản (từ 3 ký tự)'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          {tab === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Số điện thoại nhận tư vấn & giao hàng</label>
              <div className="auth-input-wrapper">
                <span className="auth-field-icon">📞</span>
                <input
                  type="tel"
                  className="auth-input"
                  placeholder="Ví dụ: 0987654321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  disabled={loading}
                />
              </div>
              <small className="auth-field-hint">
                * Nhân viên tư vấn MOBIX sẽ gọi xác nhận qua số này sau khi đặt hàng.
              </small>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Mật khẩu</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder={tab === 'login' ? 'Nhập mật khẩu' : 'Mật khẩu từ 6 ký tự'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Ẩn / Hiện mật khẩu"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {tab === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Nhập lại mật khẩu</label>
              <div className="auth-input-wrapper">
                <span className="auth-field-icon">🔑</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Nhập lại chính xác mật khẩu trên"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="auth-loading-spinner">Đang xử lý...</span>
            ) : tab === 'login' ? (
              'Đăng nhập ngay 🚀'
            ) : (
              'Đăng ký tài khoản 🎉'
            )}
          </button>

          <div className="auth-switch-footer">
            {tab === 'login' ? (
              <p>
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  className="auth-link-action"
                  onClick={() => handleSwitchTab('register')}
                >
                  Đăng ký ngay
                </button>
              </p>
            ) : (
              <p>
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  className="auth-link-action"
                  onClick={() => handleSwitchTab('login')}
                >
                  Đăng nhập
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
