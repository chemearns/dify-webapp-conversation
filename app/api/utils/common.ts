import { type NextRequest } from 'next/server'
import { ChatClient } from 'dify-client'
import { v4 } from 'uuid'
import { API_KEY, API_URL, APP_ID } from '@/config'

const userPrefix = `user_${APP_ID}:`

export const getInfo = (request: NextRequest) => {
  const sessionId = request.cookies.get('session_id')?.value
                  || request.headers.get('x-session-id')
                  || v4()
  const user = userPrefix + sessionId
  return {
    sessionId,
    user,
  }
}

export const setSession = (sessionId: string) => {
  // return { 'Set-Cookie': `session_id=${sessionId}` }
  return {
    'Set-Cookie': `session_id=${sessionId}; SameSite=None; Secure; Path=/; Max-Age=86400`,
  }
}

export const client = new ChatClient(API_KEY, API_URL || undefined)
