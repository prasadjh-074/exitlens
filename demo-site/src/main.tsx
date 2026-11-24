import { isDemoStudioPath } from '../../extension/src/types'

if (isDemoStudioPath(location.pathname)) {
  document.title = 'ExitLens · Interactive demo'
  void import('./studio')
} else {
  document.title = 'Stillframe · Streaming sandbox'
  void import('./stillframe')
}
