import { Corpus, Doc } from './tfidf.js'

/* global DOMParser, fetch, articleElement */

const URL_PATTERN = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/
const WORD_COUNT = 50

const deTag = html => new DOMParser().parseFromString(html, 'text/html').body.textContent || ''

const durationS = ms => {
  if (ms < 100) {
    return Math.round(ms) + ' milliseconds'
  }
  const s = ms / 1000.0
  if (s < 120) {
    return Math.round(s) + ' seconds'
  }
  const m = s / 60.0
  if (m < 120) {
    return Math.round(m) + ' minutes'
  }
  const h = m / 60.0
  if (h < 48) {
    return Math.round(h) + ' hours'
  }
  const d = h / 24
  if (d < 14) {
    return Math.round(d) + ' days'
  }
  const w = d / 7
  if (w < 8) {
    return Math.round(w) + ' weeks'
  }
  const y = d / 365.24
  const mon = y * 12 // approx
  if (mon < 24) {
    return Math.round(mon) + ' months'
  }
  return Math.round(y) + ' years'
}

const corpus = new Corpus()

fetch('https://api.joinmastodon.org/servers')
  .then(response => response.json())
  .then(communities => {
    communities.sort((a, b) => b.last_week_users - a.last_week_users)

    const biggestSize = communities[0].last_week_users

    const progressElement = document.createElement('progress')
    progressElement.max = communities.length
    articleElement.insertAdjacentElement('beforeend', progressElement)

    const doms = []
    let count = 0
    for (const community of communities) {
      const sizeWidth = 100.0 * community.last_week_users / biggestSize
      const sectionElment = document.createElement('section')
      articleElement.insertAdjacentElement('beforeend', sectionElment)
      const url = `https://${community.domain}/about`
      sectionElment.insertAdjacentHTML('beforeend',
      `
      <h2><a href="${url}">${community.domain}</a></h2>
      <figure>
      <a href="${url}"><img src="${community.proxied_thumbnail}"></a>
      </figure>
      <div class="bar" style="width:${sizeWidth}vw"></div>
      <p>${community.description} (${community.category})</p>
      `
      )
      doms.push({ community, sectionElment })
    }
    const promises = []
    const later = []
    for (const { community, sectionElment } of doms) {
      promises.push(fetch(`https://${community.domain}/api/v1/timelines/public?local=true&limit=100`)
        .then(apiResponse => apiResponse.json())
        .then(timeline => {
          progressElement.value = ++count
          if (timeline.length === 0) {
            console.warn('No toots from', community.domain)
            return
          }
          const doc = new Doc(corpus)
          sectionElment.insertAdjacentHTML('beforeend', `
            <h3>Recent posters</h3>
          `)
          let oldestTimeMs = Date.now()
          let tootCount = 0
          for (const toot of timeline) {
            sectionElment.insertAdjacentHTML('beforeend', `
              <a href="${toot.account.url}"><img src="${toot.account.avatar_static}"></a>
            `
            )
            const text = deTag(toot.content).split(URL_PATTERN).join(' ')
            doc.addText(text)
            oldestTimeMs = Date.parse(toot.created_at)
            ++tootCount
          }
          sectionElment.insertAdjacentHTML('beforeend', `
            <h3>Recent images</h3>
          `)
          for (const toot of timeline) {
            const images = toot.media_attachments.filter(a => a.type === 'image').map(a => a.preview_url)
            for (const image of images) {
              sectionElment.insertAdjacentHTML('beforeend', `
                <a href="${toot.url}"><img class="media" src="${image}"></a>
                `
              )
            }
          }
          const durationMs = Date.now() - oldestTimeMs

          later.push({ doc, sectionElment, tootCount, durationMs, community })
          progressElement.max = communities.length + later.length
        }).catch(e => {
          progressElement.value = ++count
          console.warn('Ignoring', community.domain, e)
        }))
    }
    Promise.allSettled(promises).then(() => {
      for (const { doc, sectionElment, tootCount, durationMs, community } of later) {
        progressElement.value = ++count
        sectionElment.insertAdjacentHTML('beforeend', `
          <h3>Words in recent posts</h3>
        `)
        for (const [term, value] of doc.list(WORD_COUNT)) {
          sectionElment.insertAdjacentHTML('beforeend', `
            <span style="font-size:${value * 100}px">${term}</span>
          `
          )
        }
        if (tootCount > 0 && durationMs > 0) {
          sectionElment.insertAdjacentHTML('beforeend', `
          <p>${community.last_week_users} users last week, with
             ${durationS(durationMs / tootCount)} average time between toots
             in the last ${durationS(durationMs)}</p>
          `)
        }
      }
      progressElement.remove()
    })
  })
