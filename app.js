import { Corpus, Doc } from './tfidf.js'

/* global DOMParser, fetch, articleElement */

const utlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/

const deTag = html => new DOMParser().parseFromString(html, 'text/html').body.textContent || ''

const corpus = new Corpus()

fetch('https://api.joinmastodon.org/servers')
  .then(response => response.json())
  .then(communities => {
    communities.sort((a, b) => b.last_week_users - a.last_week_users)

    const biggestSize = communities[0].last_week_users

    const progressElement = document.createElement('progress')
    progressElement.max = communities.length
    articleElement.insertAdjacentElement('beforeend', progressElement)

    const later = []

    let count = 0
    const promises = []
    for (const community of communities) {
      promises.push(fetch(`https://${community.domain}/api/v1/timelines/public?local=true&limit=100`)
        .then(apiResponse => apiResponse.json())
        .then(timeline => {
          progressElement.value = ++count
          if (timeline.length === 0) {
            console.warn('No toots from', community.domain)
            return
          }
          const sizeWidth = 100.0 * community.last_week_users / biggestSize
          const sectionElment = document.createElement('section')
          articleElement.insertAdjacentElement('beforeend', sectionElment)
          sectionElment.insertAdjacentHTML('beforeend',
          `
          <h2>${community.domain}</h2>
          <div class="bar" style="width:${sizeWidth}vw"></div>
          <p>${community.last_week_users} users last week</p>
          `
          )
          const doc = new Doc(corpus)
          for (const toot of timeline) {
            sectionElment.insertAdjacentHTML('beforeend', `
              <img src="${toot.account.avatar}">
            `
            )
            const text = deTag(toot.content).split(utlPattern).join(' ')
            doc.addText(text)
          }
          later.push({ doc, sectionElment })
        }).catch(e => {
          progressElement.value = ++count
          console.warn('Ignoring', community.domain, e)
        }))
    }
    Promise.allSettled(promises).then(() => {
      for (const { doc, sectionElment } of later) {
        for (const [term, value] of doc.list()) {
          sectionElment.insertAdjacentHTML('beforeend', `
            <span style="font-size:${value * 100}px">${term}</span>
          `
          )
        }
      }
    })
  })
