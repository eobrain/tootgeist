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

export class Corpus extends Terms {
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

export class Doc extends Terms {
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
