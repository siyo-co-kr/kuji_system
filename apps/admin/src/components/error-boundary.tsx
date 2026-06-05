'use client'
import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">페이지 오류가 발생했습니다</h2>
            <p className="text-sm text-gray-500 mb-4">
              {this.state.error?.message ?? '알 수 없는 오류입니다.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <RefreshCw size={14} />
              다시 시도
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
