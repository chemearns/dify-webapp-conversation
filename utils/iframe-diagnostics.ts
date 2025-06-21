export class IframeDiagnostics {
  private static logs: any[] = []

  static isInIframe(): boolean {
    try {
      return window !== window.parent
    }
    catch (e) { return true }
  }

  static log(message: string, data?: any): void {
    const entry = {
      timestamp: new Date().toISOString(),
      context: this.isInIframe() ? '[IFRAME]' : '[DIRECT]',
      message,
      data,
    }
    this.logs.push(entry)
    console.log(`${entry.context} ${message}`, data)
  }

  static error(message: string, error?: any): void {
    const entry = {
      timestamp: new Date().toISOString(),
      context: this.isInIframe() ? '[IFRAME]' : '[DIRECT]',
      message,
      error: error?.toString(),
      stack: error?.stack,
    }
    this.logs.push(entry)
    console.error(`${entry.context} ${message}`, error)
  }

  static getLogs(): any[] { return [...this.logs] }
  static clearLogs(): void { this.logs = [] }
  static exportLogs(): string { return JSON.stringify(this.logs, null, 2) }
}

export const log = (message: string, data?: any) => IframeDiagnostics.log(message, data)
export const error = (message: string, err?: any) => IframeDiagnostics.error(message, err)
