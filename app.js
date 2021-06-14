/* global WordFreq, WordCloud, DOMParser, fetch, articleElement */

const utlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/

const deTag = html => new DOMParser().parseFromString(html, 'text/html').body.textContent || ''

// Create an options object for initialization
const wordfreqOptions = { workerUrl: 'lib/wordfreq.worker.js' }

;(async () => {
  const response = await fetch('https://api.joinmastodon.org/servers')
  const communities = await response.json()
  // console.log(communities)
  communities.sort((a, b) => b.last_week_users - a.last_week_users)

  const biggestSize = communities[0].last_week_users

  for (const community of communities) {
    const sizeWidth = 100.0 * community.last_week_users / biggestSize
    const sectionElment = document.createElement('section')
    // console.log(community)
    articleElement.insertAdjacentElement('beforeend', sectionElment)
    sectionElment.insertAdjacentHTML('beforeend',
        `
        <h2>${community.domain}</h2>
        <p style="width:${sizeWidth}vw;height:2em;background:red">
        ${community.last_week_users} users last week
        </p>
        `
    )
    try {
      const apiResponse = await fetch(`https://${community.domain}/api/v1/timelines/public?limit=100`)
      const timeline = await apiResponse.json()
      // console.log(timeline)
      const wordfreq = WordFreq(wordfreqOptions)
      for (const toot of timeline) {
        sectionElment.insertAdjacentHTML('beforeend', `
              <img src="${toot.account.avatar}">
            `
        )
        const text = deTag(toot.content).split(utlPattern).join(' ')
        // console.log(text)
        wordfreq.process(text)
      }
      wordfreq.getList(list => {
        // console.log(list)
        const canvasElement = document.createElement('canvas')
        canvasElement.setAttribute('width', window.innerWidth)
        canvasElement.setAttribute('height', window.innerWidth / 2)
        const canvasWidth = canvasElement.width
        sectionElment.insertAdjacentElement('beforeend', canvasElement)
        WordCloud(canvasElement, {
          list,
          shrinkToFit: true,
          gridSize: Math.round(16 * canvasWidth / 1024),
          weightFactor: size => Math.pow(size, 2.3) * canvasWidth / 1024,
          fontFamily: 'Times, serif',
          color: (word, weight) => (weight === list[0][1]) ? '#f02222' : '#c09292',
          rotateRatio: 0.5,
          rotationSteps: 2,
          backgroundColor: '#ffe0e0'
        })
      })
    } catch (e) {
      sectionElment.insertAdjacentHTML('beforeend', `
              <p>${e}</p>
            `
      )
    }
  }
})()
