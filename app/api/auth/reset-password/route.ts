
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PasswordResetService } from '@/lib/services/password-reset-service'
import { UserService } from '@/lib/services/user-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Validate token
    const resetToken = await PasswordResetService.validateToken(token)

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // UserService.update hashes the password itself — pass plaintext
    await UserService.update(resetToken.userId, { password })

    // Mark token as used
    await PasswordResetService.markAsUsed(resetToken.id)

    return NextResponse.json({
      message: 'Password reset successfully. You can now login with your new password.',
    })
  } catch (error: any) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
