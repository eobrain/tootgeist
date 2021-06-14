/* global DOMParser, fetch, articleElement */

const utlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/

const deTag = html => new DOMParser().parseFromString(html, 'text/html').body.textContent || ''

class Terms {
  constructor () {
    this.terms = {}
    this.count = 0
  }

  addTerm (term) {
    if (this.terms[term]) {
      this.terms[term].count++
    } else {
      this.terms[term] = { count: 1 }
    }
    this.count++
  }
}

class Corpus extends Terms {
  constructor () {
    super()
    this.docs = []
  }

  addDoc (doc) {
    this.docs.push(doc)
  }

  inverseDocFrequency (term) {
    let docsWithTerm = 0
    for (const doc of this.docs) {
      if (doc.terms[term]) {
        ++docsWithTerm
      }
    }
    return Math.log(1.0 * this.docs.length / docsWithTerm)
  }
}

class Doc extends Terms {
  constructor (corpus) {
    super()
    this.corpus = corpus
    this.terms = {}
    corpus.addDoc(this)
  }

  addText (text) {
    for (const term of text.split(/[\W0-9_]+/)) {
      this.corpus.addTerm(term)
      this.addTerm(term)
    }
  }

  termFrequency (term) {
    return 1.0 * this.terms[term].count / this.count
  }

  tfIdf (term) {
    return this.termFrequency(term) * this.corpus.inverseDocFrequency(term)
  }

  list () {
    const unscaled = Object.keys(this.terms).map(term => [term, this.tfIdf(term)]).filter(([_, value]) => value > 0)
    if (unscaled.length === 0) {
      return unscaled
    }
    unscaled.sort((a, b) => b[1] - a[1])
    return unscaled.slice(0, 20).map(([term, value]) => [term, value / unscaled[0][1]])
  }
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
