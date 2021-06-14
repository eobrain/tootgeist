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

    const doms = []
    let count = 0
    for (const community of communities) {
      const sizeWidth = 100.0 * community.last_week_users / biggestSize
      const sectionElment = document.createElement('section')
      articleElement.insertAdjacentElement('beforeend', sectionElment)
      sectionElment.insertAdjacentHTML('beforeend',
      `
      <h2>${community.domain}</h2>
      <figure>
      <img src="${community.proxied_thumbnail}">
      </figure>
      <div class="bar" style="width:${sizeWidth}vw"></div>
      <p>${community.last_week_users} users last week</p>
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
          for (const toot of timeline) {
            sectionElment.insertAdjacentHTML('beforeend', `
              <a href="${toot.account.url}"><img src="${toot.account.avatar_static}"></a>
            `
            )
            const text = deTag(toot.content).split(utlPattern).join(' ')
            doc.addText(text)
          }
          sectionElment.insertAdjacentHTML('beforeend', `
            <h3>Recent images</h3>
          `)
          for (const toot of timeline) {
            console.log(toot)
            const images = toot.media_attachments.filter(a => a.type === 'image').map(a => a.preview_url)
            for (const image of images) {
              sectionElment.insertAdjacentHTML('beforeend', `
                <a href="${toot.url}"><img class="media" src="${image}"></a>
                `
              )
            }
          }
          later.push({ doc, sectionElment })
        }).catch(e => {
          progressElement.value = ++count
          console.warn('Ignoring', community.domain, e)
        }))
    }
    Promise.allSettled(promises).then(() => {
      for (const { doc, sectionElment } of later) {
        sectionElment.insertAdjacentHTML('beforeend', `
          <h3>Words in recent posts</h3>
        `)
        for (const [term, value] of doc.list()) {
          sectionElment.insertAdjacentHTML('beforeend', `
            <span style="font-size:${value * 100}px">${term}</span>
          `
          )
        }
      }
    })
  })
