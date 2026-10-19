// A small "back" pill: a project's pages go to the project, a project goes to the hub.
(() => {
  const isIndex = /\/(index\.html)?$/.test(location.pathname)
  const add = () => {
    const a = document.createElement('a')
    a.href = isIndex ? '../index.html' : 'index.html'
    a.textContent = isIndex ? '← Hub' : '← Projecte'
    a.setAttribute('style', 'position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99;font:600 13px/1 system-ui,sans-serif;padding:10px 14px;border-radius:999px;background:#1b2320;color:#f4f5f1;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.18);opacity:.92')
    document.body.append(a)
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add)
})()
