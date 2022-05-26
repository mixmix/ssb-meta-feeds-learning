const Stack = require('secret-stack')
const caps = require('ssb-caps')
const Keys = require('ssb-keys')
const { join } = require('path')
const { promisify: p } = require('util')
const { where, and, type, toPromise } = require('ssb-db2/operators')

function createSSB () {
  const stack = Stack({ caps })
    .use(require('ssb-db2'))
    .use(require('ssb-meta-feeds'))

  const path = join(__dirname, 'db')

  return stack({
    path,
    keys: Keys.loadOrCreateSync(join(path, 'secret'))
  })
}

async function main () {
  const ssb = createSSB()

  await logger(ssb)
  const loadFeed = await LoadFeed(ssb)
  const chessFeed = await loadFeed({ purpose: 'chess' })

  await p(ssb.db.publishAs)(chessFeed.keys, {
    type: 'chess/init',
    name: 'my first chess game'
  })

  await p(ssb.db.publishAs)(chessFeed.keys, {
    type: 'chess/init',
    name: 'my first private game',
    recps: [chessFeed.keys.id]
  })
    .catch(err => console.error('UH OH', err))

  const result = await ssb.db.query(
    where(type('chess/init')),
    toPromise()
  )
  console.log(JSON.stringify(result, null, 2))
  ssb.close()
}

main()

async function LoadFeed (ssb) {
  const rootFeed = await p(ssb.metafeeds.findOrCreate)()
  console.log('Root Feed:', rootFeed)

  return async function loadFeed (details) {
    if (!details.metafeed) details.metafeed = rootFeed
    if (!details.format) details.format = 'classic'

    const feed = await p(ssb.metafeeds.findOrCreate)(
      details.metafeed,
      IsFeed(details),
      {
        feedpurpose: details.purpose,
        feedformat: details.format,
        metadata: details.metadata
      }
    )
    console.log(`${details.purpose} Feed:`, feed)

    // feed.publish = (content, cb) => ssb.db.publishAs(feed.keys, content, cb)

    return feed
  }

  function IsFeed (details) {
    return (feed) => {
      return (
        feed.feedpurpose === details.purpose &&
        feed.feedformat === details.format
      )
    }
  }
}

async function logger (ssb) {
  console.log('ssb.id', ssb.id)
  console.log('-----------------------')

  ssb.db.post(m => {
    console.log(m.value.sequence, m.value.author)
    console.log(JSON.stringify(m.value.content, null, 2))
  })
}
