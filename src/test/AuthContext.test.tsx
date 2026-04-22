import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthProvider } from '../contexts/AuthContext'

describe('AuthContext', () => {
  it('renders without crashing', () => {
    render(
      <AuthProvider>
        <div>Test</div>
      </AuthProvider>
    )
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})