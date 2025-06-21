import type { IOnCompleted, IOnData, IOnError, IOnFile, IOnMessageEnd, IOnMessageReplace, IOnNodeFinished, IOnNodeStarted, IOnThought, IOnWorkflowFinished, IOnWorkflowStarted } from './base'
import { get, post, ssePost } from './base'
import type { Feedbacktype } from '@/types/app'
import { error, log } from '@/utils/iframe-diagnostics'

export const sendChatMessage = async (
  body: Record<string, any>,
  {
    onData,
    onCompleted,
    onThought,
    onFile,
    onError,
    getAbortController,
    onMessageEnd,
    onMessageReplace,
    onWorkflowStarted,
    onNodeStarted,
    onNodeFinished,
    onWorkflowFinished,
  }: {
    onData: IOnData
    onCompleted: IOnCompleted
    onFile: IOnFile
    onThought: IOnThought
    onMessageEnd: IOnMessageEnd
    onMessageReplace: IOnMessageReplace
    onError: IOnError
    getAbortController?: (abortController: AbortController) => void
    onWorkflowStarted: IOnWorkflowStarted
    onNodeStarted: IOnNodeStarted
    onNodeFinished: IOnNodeFinished
    onWorkflowFinished: IOnWorkflowFinished
  },
) => {
  return ssePost('chat-messages', {
    body: {
      ...body,
      response_mode: 'streaming',
    },
  }, { onData, onCompleted, onThought, onFile, onError, getAbortController, onMessageEnd, onMessageReplace, onNodeStarted, onWorkflowStarted, onWorkflowFinished, onNodeFinished })
}

export const fetchConversations = async () => {
  log('fetchConversations called', {
    isInIframe: window !== window.parent,
    timestamp: Date.now(),
  })

  try {
    log('About to call get() for conversations')
    const result = await get('conversations', { params: { limit: 100, first_id: '' } })
    log('fetchConversations completed successfully', {
      resultType: typeof result,
      hasData: !!(result as any)?.data,
      timestamp: Date.now(),
    })
    return result
  }
  catch (err) {
    error('fetchConversations failed', {
      error: err?.toString(),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: Date.now(),
    })
    throw err
  }
}

export const fetchChatList = async (conversationId: string) => {
  return get('messages', { params: { conversation_id: conversationId, limit: 20, last_id: '' } })
}

// init value. wait for server update
export const fetchAppParams = async () => {
  return get('parameters')
}

export const updateFeedback = async ({ url, body }: { url: string; body: Feedbacktype }) => {
  return post(url, { body })
}

export const generationConversationName = async (id: string) => {
  log('generationConversationName called', {
    conversationId: id,
    isInIframe: window !== window.parent,
    timestamp: Date.now(),
  })

  try {
    log('About to call post() for conversation name generation')
    const result = await post(`conversations/${id}/name`, { body: { auto_generate: true } })
    log('generationConversationName completed successfully', {
      resultType: typeof result,
      hasData: !!(result as any)?.data,
      timestamp: Date.now(),
    })
    return result
  }
  catch (err) {
    error('generationConversationName failed', {
      error: err?.toString(),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: Date.now(),
    })
    throw err
  }
  // return post(`conversations/${id}/name`, { body: { auto_generate: true } })
}
