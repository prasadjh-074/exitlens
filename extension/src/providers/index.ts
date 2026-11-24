// A future consent-gated backend can implement these contracts. No remote transport is configured.
import type { Candidate, Terms } from '../types'
export interface PlanningProvider {
  extractTerms(approvedExcerpt: string): Promise<Partial<Terms>>
  classifyButton(approvedName: string): Promise<string | null>
  rankCandidates(approved: ReadonlyArray<Candidate>): Promise<readonly number[]>
  explainBarrier(approvedBarrier: string): Promise<string>
}
export interface SpeechProvider {
  speak(approvedText: string): Promise<void>
  stop(): void
}
export const nativeSpeech: SpeechProvider = {
  async speak(text) {
    if (!('speechSynthesis' in window))
      throw Error('Speech is unavailable. All guidance is available as text.')
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.localService && v.lang.startsWith('en'))
    if (!voice)
      throw Error('No local English voice is available. Use the written guide.')
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
  },
  stop() {
    window.speechSynthesis?.cancel()
  },
}
