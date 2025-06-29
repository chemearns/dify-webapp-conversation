import { API_PREFIX } from '@/config'
import Toast from '@/app/components/base/toast'
import type { AnnotationReply, MessageEnd, MessageReplace, ThoughtItem } from '@/app/components/chat/type'
import type { VisionFile } from '@/types/app'
import { error, log } from '@/utils/iframe-diagnostics'

// Session storage for iframe context
const getSessionId = () => {
  if (typeof window !== 'undefined') {
    let sessionId = localStorage.getItem('dify_session_id')
    if (!sessionId) {
      sessionId = `iframe-session-${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem('dify_session_id', sessionId)
    }
    return sessionId
  }
  return null
}

const storeSessionId = (id: string) => {
  if (typeof window !== 'undefined')
    localStorage.setItem('dify_session_id', id)
}

const TIME_OUT = 100000

const ContentType = {
  json: 'application/json',
  stream: 'text/event-stream',
  form: 'application/x-www-form-urlencoded; charset=UTF-8',
  download: 'application/octet-stream', // for download
}

const getBaseHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': ContentType.json,
  }

  const sessionId = getSessionId()
  if (sessionId)
    headers['x-session-id'] = sessionId

  return headers
}

const baseOptions = {
  method: 'GET',
  mode: 'cors',
  credentials: 'include', // always send cookies、HTTP Basic authentication.
  headers: new Headers(getBaseHeaders()),
  redirect: 'follow',
}

export type WorkflowStartedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    workflow_id: string
    sequence_number: number
    created_at: number
  }
}

export type WorkflowFinishedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    workflow_id: string
    status: string
    outputs: any
    error: string
    elapsed_time: number
    total_tokens: number
    total_steps: number
    created_at: number
    finished_at: number
  }
}

export type NodeStartedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    node_id: string
    node_type: string
    index: number
    predecessor_node_id?: string
    inputs: any
    created_at: number
    extras?: any
  }
}

export type NodeFinishedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    node_id: string
    node_type: string
    index: number
    predecessor_node_id?: string
    inputs: any
    process_data: any
    outputs: any
    status: string
    error: string
    elapsed_time: number
    execution_metadata: {
      total_tokens: number
      total_price: number
      currency: string
    }
    created_at: number
  }
}

export type IOnDataMoreInfo = {
  conversationId?: string
  taskId?: string
  messageId: string
  errorMessage?: string
  errorCode?: string
}

export type IOnData = (message: string, isFirstMessage: boolean, moreInfo: IOnDataMoreInfo) => void
export type IOnThought = (though: ThoughtItem) => void
export type IOnFile = (file: VisionFile) => void
export type IOnMessageEnd = (messageEnd: MessageEnd) => void
export type IOnMessageReplace = (messageReplace: MessageReplace) => void
export type IOnAnnotationReply = (messageReplace: AnnotationReply) => void
export type IOnCompleted = (hasError?: boolean) => void
export type IOnError = (msg: string, code?: string) => void
export type IOnWorkflowStarted = (workflowStarted: WorkflowStartedResponse) => void
export type IOnWorkflowFinished = (workflowFinished: WorkflowFinishedResponse) => void
export type IOnNodeStarted = (nodeStarted: NodeStartedResponse) => void
export type IOnNodeFinished = (nodeFinished: NodeFinishedResponse) => void

type IOtherOptions = {
  isPublicAPI?: boolean
  bodyStringify?: boolean
  needAllResponseContent?: boolean
  deleteContentType?: boolean
  onData?: IOnData // for stream
  onThought?: IOnThought
  onFile?: IOnFile
  onMessageEnd?: IOnMessageEnd
  onMessageReplace?: IOnMessageReplace
  onError?: IOnError
  onCompleted?: IOnCompleted // for stream
  getAbortController?: (abortController: AbortController) => void
  onWorkflowStarted?: IOnWorkflowStarted
  onWorkflowFinished?: IOnWorkflowFinished
  onNodeStarted?: IOnNodeStarted
  onNodeFinished?: IOnNodeFinished
}

function unicodeToChar(text: string) {
  return text.replace(/\\u[0-9a-f]{4}/g, (_match, p1) => {
    return String.fromCharCode(parseInt(p1, 16))
  })
}

const handleStream = (
  response: Response,
  onData: IOnData,
  onCompleted?: IOnCompleted,
  onThought?: IOnThought,
  onMessageEnd?: IOnMessageEnd,
  onMessageReplace?: IOnMessageReplace,
  onFile?: IOnFile,
  onWorkflowStarted?: IOnWorkflowStarted,
  onWorkflowFinished?: IOnWorkflowFinished,
  onNodeStarted?: IOnNodeStarted,
  onNodeFinished?: IOnNodeFinished,
) => {
  if (!response.ok)
    throw new Error('Network response was not ok')

  const reader = response.body?.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let bufferObj: Record<string, any>
  let isFirstMessage = true

  let chunkCount = 0
  let totalBytesReceived = 0
  let messagesProcessed = 0

  function read() {
    let hasError = false
    reader?.read().then((result: any) => {
      chunkCount++
      if (result.done) {
        log('=== STREAM READER COMPLETED ===', {
          totalChunks: chunkCount,
          totalBytes: totalBytesReceived,
          messagesProcessed,
          timestamp: Date.now(),
        })

        try {
          if (onCompleted) {
            log('Calling onCompleted callback from handleStream')
            onCompleted && onCompleted()
            log('onCompleted callback executed successfully from handleStream')
          }
        }
        catch (e) {
          error('ERROR executing onCompleted callback in handleStream', e)
        }
        return
      }
      if (result.value)
        totalBytesReceived += result.value.length

      buffer += decoder.decode(result.value, { stream: true })
      const lines = buffer.split('\n')
      try {
        lines.forEach((message) => {
          if (message.startsWith('data: ')) { // check if it starts with data:
            messagesProcessed++
            try {
              bufferObj = JSON.parse(message.substring(6)) as Record<string, any>// remove data: and parse as json
            }
            catch (e) {
              // mute handle message cut off
              onData('', isFirstMessage, {
                conversationId: bufferObj?.conversation_id,
                messageId: bufferObj?.message_id,
              })
              return
            }
            if (bufferObj.status === 400 || !bufferObj.event) {
              onData('', false, {
                conversationId: undefined,
                messageId: '',
                errorMessage: bufferObj?.message,
                errorCode: bufferObj?.code,
              })
              hasError = true
              onCompleted?.(true)
              return
            }
            if (bufferObj.event === 'message' || bufferObj.event === 'agent_message') {
              // Optional: Log chunk progress every 10 chunks
              if (chunkCount % 10 === 0) {
                log(`Processing chunk #${chunkCount}`, {
                  totalBytes: totalBytesReceived,
                  messagesProcessed,
                  answerLength: bufferObj.answer?.length || 0,
                })
              }
              // can not use format here. Because message is splited.
              onData(unicodeToChar(bufferObj.answer), isFirstMessage, {
                conversationId: bufferObj.conversation_id,
                taskId: bufferObj.task_id,
                messageId: bufferObj.id,
              })
              isFirstMessage = false
            }
            else if (bufferObj.event === 'agent_thought') {
              onThought?.(bufferObj as ThoughtItem)
            }
            else if (bufferObj.event === 'message_file') {
              onFile?.(bufferObj as VisionFile)
            }
            else if (bufferObj.event === 'message_end') {
              onMessageEnd?.(bufferObj as MessageEnd)
            }
            else if (bufferObj.event === 'message_replace') {
              onMessageReplace?.(bufferObj as MessageReplace)
            }
            else if (bufferObj.event === 'workflow_started') {
              onWorkflowStarted?.(bufferObj as WorkflowStartedResponse)
            }
            else if (bufferObj.event === 'workflow_finished') {
              onWorkflowFinished?.(bufferObj as WorkflowFinishedResponse)
            }
            else if (bufferObj.event === 'node_started') {
              onNodeStarted?.(bufferObj as NodeStartedResponse)
            }
            else if (bufferObj.event === 'node_finished') {
              onNodeFinished?.(bufferObj as NodeFinishedResponse)
            }
          }
        })
        buffer = lines[lines.length - 1]
      }
      catch (e) {
        error('Error processing stream chunk', {
          chunkNumber: chunkCount,
          error: e,
          totalBytes: totalBytesReceived,
        })
        onData('', false, {
          conversationId: undefined,
          messageId: '',
          errorMessage: `${e}`,
        })
        hasError = true
        onCompleted?.(true)
        return
      }
      if (!hasError)
        read()
    }).catch((readError) => {
      error('Error in reader.read()', {
        chunkNumber: chunkCount,
        readError: readError?.toString(),
        totalBytes: totalBytesReceived,
      })

      hasError = true
      onCompleted?.(true)
    })
  }
  read()
}

const baseFetch = (url: string, fetchOptions: any, { needAllResponseContent }: IOtherOptions) => {
  const requestId = `fetch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
  const options = Object.assign({}, baseOptions, fetchOptions)

  const urlPrefix = API_PREFIX

  let urlWithPrefix = `${urlPrefix}${url.startsWith('/') ? url : `/${url}`}`

  log('baseFetch starting', {
    requestId,
    url: urlWithPrefix,
    method: options.method,
    hasBody: !!options.body,
    isInIframe: window !== window.parent,
    timestamp: Date.now(),
  })

  const { method, params, body } = options
  // handle query
  if (method === 'GET' && params) {
    const paramsArray: string[] = []
    Object.keys(params).forEach(key =>
      paramsArray.push(`${key}=${encodeURIComponent(params[key])}`),
    )
    if (urlWithPrefix.search(/\?/) === -1)
      urlWithPrefix += `?${paramsArray.join('&')}`

    else
      urlWithPrefix += `&${paramsArray.join('&')}`

    delete options.params
  }

  if (body)
    options.body = JSON.stringify(body)

  log('About to call globalThis.fetch', {
    requestId,
    finalUrl: urlWithPrefix,
    optionsKeys: Object.keys(options),
    timestamp: Date.now(),
  })

  // Handle timeout
  return Promise.race([
    new Promise((resolve, reject) => {
      setTimeout(() => {
        error('Request timeout reached', {
          requestId,
          url: urlWithPrefix,
          timeout: TIME_OUT,
          timestamp: Date.now(),
        })

        reject(new Error('request timeout'))
      }, TIME_OUT)
    }),
    new Promise((resolve, reject) => {
      log('Calling globalThis.fetch now', {
        requestId,
        timestamp: Date.now(),
      })

      globalThis.fetch(urlWithPrefix, options)
        .then((res: any) => {
          log('globalThis.fetch returned', {
            requestId,
            status: res.status,
            statusText: res.statusText,
            ok: res.ok,
            headers: Object.fromEntries(res.headers.entries()),
            timestamp: Date.now(),
          })

          const resClone = res.clone()

          // Error handler
          if (!/^(2|3)\d{2}$/.test(res.status)) {
            error('Non-success HTTP status', {
              requestId,
              status: res.status,
              statusText: res.statusText,
              timestamp: Date.now(),
            })

            try {
              const bodyJson = res.json()
              switch (res.status) {
                case 401: {
                  Toast.notify({ type: 'error', message: 'Invalid token' })
                  return
                }
                default:
                  // eslint-disable-next-line no-new
                  new Promise(() => {
                    bodyJson.then((data: any) => {
                      error('Error response body', {
                        requestId,
                        errorData: data,
                        timestamp: Date.now(),
                      })

                      Toast.notify({ type: 'error', message: data.message })
                    })
                  })
              }
            }
            catch (e) {
              error('Failed to parse error response', {
                requestId,
                parseError: e?.toString(),
                timestamp: Date.now(),
              })

              Toast.notify({ type: 'error', message: `${e}` })
            }

            return Promise.reject(resClone)
          }

          // handle delete api. Delete api not return content.
          if (res.status === 204) {
            log('Request completed with 204 status', { requestId })
            resolve({ result: 'success' })
            return
          }

          // return data
          log('About to parse response data', {
            requestId,
            contentType: options.headers.get('Content-type'),
            timestamp: Date.now(),
          })

          // return data
          const data = options.headers.get('Content-type') === ContentType.download ? res.blob() : res.json()

          data.then((parsedData: any) => {
            log('Response data parsed successfully', {
              requestId,
              dataType: typeof parsedData,
              hasData: !!parsedData,
              timestamp: Date.now(),
            })
            resolve(needAllResponseContent ? resClone : parsedData)
          }).catch((parseError: any) => {
            error('Failed to parse response data', {
              requestId,
              parseError: parseError?.toString(),
              timestamp: Date.now(),
            })
            reject(parseError)
          })

          // resolve(needAllResponseContent ? resClone : data)
        })
        .catch((fetchError) => {
          error('globalThis.fetch threw error', {
            requestId,
            fetchError: fetchError?.toString(),
            stack: fetchError instanceof Error ? fetchError.stack : undefined,
            timestamp: Date.now(),
          })
          Toast.notify({ type: 'error', message: fetchError })
          reject(fetchError)
        })
    }),
  ])
}

export const upload = (fetchOptions: any): Promise<any> => {
  const urlPrefix = API_PREFIX
  const urlWithPrefix = `${urlPrefix}/file-upload`
  const defaultOptions = {
    method: 'POST',
    url: `${urlWithPrefix}`,
    data: {},
  }
  const options = {
    ...defaultOptions,
    ...fetchOptions,
  }
  return new Promise((resolve, reject) => {
    const xhr = options.xhr
    xhr.open(options.method, options.url)
    for (const key in options.headers)
      xhr.setRequestHeader(key, options.headers[key])

    xhr.withCredentials = true
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200)
          resolve({ id: xhr.response })
        else
          reject(xhr)
      }
    }
    xhr.upload.onprogress = options.onprogress
    xhr.send(options.data)
  })
}

export const ssePost = (
  url: string,
  fetchOptions: any,
  {
    onData,
    onCompleted,
    onThought,
    onFile,
    onMessageEnd,
    onMessageReplace,
    onWorkflowStarted,
    onWorkflowFinished,
    onNodeStarted,
    onNodeFinished,
    onError,
  }: IOtherOptions,
) => {
  log('ssePost called with callbacks', {
    hasOnData: !!onData,
    hasOnCompleted: !!onCompleted,
    hasOnError: !!onError,
    onCompletedType: typeof onCompleted,
    url,
  })

  const options = Object.assign({}, baseOptions, {
    method: 'POST',
  }, fetchOptions)

  const urlPrefix = API_PREFIX
  const urlWithPrefix = `${urlPrefix}${url.startsWith('/') ? url : `/${url}`}`

  const { body } = options
  if (body)
    options.body = JSON.stringify(body)

  globalThis.fetch(urlWithPrefix, options)
    .then((res: any) => {
      if (!/^(2|3)\d{2}$/.test(res.status)) {
        // eslint-disable-next-line no-new
        new Promise(() => {
          res.json().then((data: any) => {
            Toast.notify({ type: 'error', message: data.message || 'Server Error' })
          })
        })
        onError?.('Server Error')
        return
      }
      log('About to call handleStream with onCompleted callback', {
        hasOnCompleted: !!onCompleted,
        onCompletedFunction: onCompleted?.toString().substring(0, 100),
      })
      return handleStream(res, (str: string, isFirstMessage: boolean, moreInfo: IOnDataMoreInfo) => {
        if (moreInfo.errorMessage) {
          Toast.notify({ type: 'error', message: moreInfo.errorMessage })
          return
        }
        onData?.(str, isFirstMessage, moreInfo)
      }, () => {
        log('=== ssePost onCompleted wrapper called ===', {
          hasMainOnCompleted: !!onCompleted,
          timestamp: Date.now(),
        })
        try {
          if (onCompleted) {
            log('Calling main component onCompleted from ssePost wrapper')
            onCompleted()
            log('Main component onCompleted returned from ssePost wrapper')
          }
          else {
            error('onCompleted callback is null/undefined in ssePost wrapper')
          }
        }
        catch (e) {
          error('ERROR calling main onCompleted from ssePost wrapper', {
            error: e?.toString(),
            stack: e instanceof Error ? e.stack : undefined,
          })
        }
      }, onThought, onMessageEnd, onMessageReplace, onFile, onWorkflowStarted, onWorkflowFinished, onNodeStarted, onNodeFinished)
    }).catch((e) => {
      error('ssePost fetch error', e)
      Toast.notify({ type: 'error', message: e })
      onError?.(e)
    })
}

export const request = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

  log('Base request called', {
    requestId,
    url,
    method: (options as any)?.method || 'GET',
    isInIframe: window !== window.parent,
    timestamp: Date.now(),
  })

  return baseFetch(url, options, otherOptions || {})
    .then((result) => {
      log('Base request completed', {
        requestId,
        url,
        success: true,
        resultType: typeof result,
        hasData: result && typeof result === 'object' && 'data' in result,
        timestamp: Date.now(),
      })
      return result
    })
    .catch((err) => {
      error('Base request failed', {
        requestId,
        url,
        error: err?.toString(),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: Date.now(),
      })
      throw err
    })
  // return baseFetch(url, options, otherOptions || {})
}

export const get = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'GET' }), otherOptions)
}

export const post = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'POST' }), otherOptions)
}

export const put = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'PUT' }), otherOptions)
}

export const del = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'DELETE' }), otherOptions)
}
