import axe from 'axe-core'
const visible = (e: Element) =>
  e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
export function challenge() {
  const elements = Array.from(
    document.querySelectorAll('h1,h2,h3,legend,iframe[title],[role=heading]'),
  ).filter(visible)
  const found = elements.some((e) =>
    /human verification|verify (?:that )?you are human|captcha/i.test(
      e.getAttribute('title') ?? e.textContent ?? '',
    ),
  )
  if (!found) return []
  const alt = Array.from(document.querySelectorAll('button,a,[role=button]'))
    .filter(visible)
    .some((e) =>
      /audio|accessible verification|accessible alternative/i.test(
        e.textContent ?? '',
      ),
    )
  return [
    'Human verification required. Complete the website’s checkpoint yourself.' +
      (alt ? ' An official accessible alternative is visible.' : ''),
  ]
}
export async function inspectBarriers() {
  try {
    const report = await axe.run(document, {
      iframes: false,
      runOnly: {
        type: 'rule',
        values: [
          'button-name',
          'label',
          'link-name',
          'tabindex',
          'nested-interactive',
        ],
      },
      resultTypes: ['violations'],
    })
    return report.violations.flatMap((v) =>
      v.nodes.length ? [v.help + ' (' + v.nodes.length + ')'] : [],
    )
  } catch {
    return ['Accessibility scan unavailable on this page.']
  }
}
