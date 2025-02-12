const fs = require('fs')
const path = require('path')

let extractPayload = function(html, route){
  let chunks = html.split('<script>window.__NUXT__=')
  let pre = chunks[0]
  let payload = chunks[1].split('</script>').shift()
  let post = chunks[1].split('</script>').slice(1).join('</script>')
  let path = route === '/' ? '' : route

  return {
    html: pre + '<script defer src="' + path + '/payload.js"></script>' + post,
    payload
  }
}

let getAbsoluteDir = function(root, route) {
  let normalizedRoute = route[0] === '/' ? route : '/' + route
  return root + normalizedRoute
}

let writePayload = function(payload, route, root){
  let dir = getAbsoluteDir(root, route)

  let subpath = root
  for(let subdir of route.split('/')){
    if(subdir){
      subpath += '/' + subdir
      if (!fs.existsSync(subpath)) fs.mkdirSync(subpath);
    }
  }

  fs.writeFile(path.resolve(dir, 'payload.js'), 'window.__NUXT__=' + payload, 'utf8', function (err) {
    if (err) return console.error(err);
  });

  let data = eval('('+payload+')')

  // if routes are nested, merge them into one object
  let availableData = data.data
    .filter(d => Object.keys(d).length > 0)
    .reduce((prev, current) => {
      const colidingKey = Object.keys(prev).find(key => Object.keys(current).includes(key))
      if(colidingKey) 
        console.error('Payload-extractor fails to extract nested routes data correctly because two routes have same field returned by asyncData: ' + colidingKey)
      if(Object.keys(current).length > 1) 
        console.warn('Payload-extractor had to duplicate some nested routes data in extracted payload')
      return { ...prev, ...current }
    }, {})

  fs.writeFile(path.resolve(dir, 'payload.json'), availableData ? JSON.stringify(availableData) : '', 'utf8', function (err) {
    if (err) return console.error(err);
  });
}

module.exports = function extractor({ blacklist }) {
  this.nuxt.hook('generate:page', async page => {
    if(!this.nuxt.options.generate.subFolders) throw new Error('generate.subFolders should be true for nuxt-payload-extractor');
    if(blacklist && blacklist.includes(page.route)) return page;

    let { html, payload } = extractPayload(page.html, page.route)
    writePayload(payload, page.route, this.nuxt.options.generate.dir)

    page.html = html

    return page
  })

  this.addPlugin({
    src: path.resolve(__dirname, 'plugin.js'),
  })
}

module.exports.meta = require('../package.json')
