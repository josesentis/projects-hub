// Renders the prototype screens (*.dc.html, from the Design canvases) without
// the canvas editor: the <x-dc> markup is a template with {{holes}},
// <sc-for list as> and <sc-if value>, filled by the page's Component class
// (renderVals, state, setState). Event attributes like onClick="{{fn}}" bind fn.
(() => {
  const style = document.createElement('style')
  style.textContent = 'x-dc{display:none}'
  document.head.append(style)

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {} }
    setState(patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); this._render?.() }
    renderVals() { return {} }
  }

  const HOLE = /\{\{\s*([\w$.]+)\s*\}\}/g
  const ONLY = /^\s*\{\{\s*([\w$.]+)\s*\}\}\s*$/
  const lookup = (path, scope) => {
    if (path === 'true') return true
    if (path === 'false') return false
    return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), scope)
  }
  const fill = (s, scope) => s.replace(HOLE, (_, p) => { const v = lookup(p, scope); return v == null ? '' : String(v) })
  const raw = (s, scope) => { const m = ONLY.exec(s || ''); return m ? lookup(m[1], scope) : s }

  function render(node, scope, out) {
    if (node.nodeType === Node.TEXT_NODE) { out.append(document.createTextNode(fill(node.data, scope))); return }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const tag = node.localName
    if (tag === 'sc-for') {
      const list = raw(node.getAttribute('list'), scope) || []
      const as = node.getAttribute('as') || 'item'
      Array.from(list).forEach((item, index) => { for (const c of node.childNodes) render(c, { ...scope, [as]: item, index }, out) })
      return
    }
    if (tag === 'sc-if') {
      if (raw(node.getAttribute('value'), scope)) for (const c of node.childNodes) render(c, scope, out)
      return
    }
    const el = node.namespaceURI === 'http://www.w3.org/1999/xhtml' ? document.createElement(tag) : document.createElementNS(node.namespaceURI, node.tagName)
    for (const a of node.attributes) {
      if (a.name.startsWith('hint-')) continue
      if (a.name.startsWith('on')) {
        const fn = raw(a.value, scope)
        if (typeof fn === 'function') el.addEventListener(a.name.slice(2), fn)
        continue
      }
      el.setAttribute(a.name, fill(a.value, scope))
    }
    for (const c of node.childNodes) render(c, scope, el)
    out.append(el)
  }

  function boot() {
    const x = document.querySelector('x-dc')
    if (!x) return
    const helmet = x.querySelector('helmet')
    if (helmet) document.head.append(...helmet.childNodes)
    const src = document.querySelector('script[type="text/x-dc"]')?.textContent || 'class Component extends DCLogic {}'
    const Component = new Function('DCLogic', src + '\n;return Component')(DCLogic)
    const comp = new Component({})
    const root = document.createElement('div')
    root.className = 'dc-root'
    x.after(root)
    x.remove() // the template stays in memory; only the rendered copy is on the page
    comp._render = () => {
      const vals = comp.renderVals() || {}
      const frag = document.createDocumentFragment()
      for (const c of x.childNodes) if (c !== helmet) render(c, vals, frag)
      root.replaceChildren(frag)
    }
    comp._render()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
