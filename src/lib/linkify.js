/**
 * 把渲染后的正文里的政策名称变成可点链接。
 * 只处理文本节点，跳过链接、代码块与标题，避免二次嵌套。
 */
export function linkifyPolicies(html, re, linkMap, selfId = null) {
  if (typeof DOMParser === 'undefined' || !html) return html

  const doc = new DOMParser().parseFromString(`<div id="__root__">${html}</div>`, 'text/html')
  const root = doc.getElementById('__root__')
  if (!root) return html

  const SKIP = new Set(['A', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'H4'])
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const targets = []

  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.nodeValue
    if (!text || text.length < 4) continue
    if (node.parentElement && SKIP.has(node.parentElement.tagName)) continue

    // 用同一个正则判断是否命中；split 会带捕获组，长度必然大于 1
    const parts = text.split(re)
    if (parts.length <= 1) continue
    targets.push({ node, parts })
  }

  for (const { node, parts } of targets) {
    const frag = doc.createDocumentFragment()
    for (const part of parts) {
      if (!part) continue
      const id = linkMap[part]
      if (id && id !== selfId) {
        const a = doc.createElement('a')
        a.className = 'inline-link'
        a.setAttribute('data-policy-id', id)
        a.textContent = part
        frag.appendChild(a)
      } else {
        frag.appendChild(doc.createTextNode(part))
      }
    }
    node.parentNode.replaceChild(frag, node)
  }

  return root.innerHTML
}

/** 事件委托：点击正文里的政策链接 */
export function handlePolicyLinkClick(event, navigate) {
  const el = event.target && event.target.closest ? event.target.closest('a[data-policy-id]') : null
  if (!el) return
  event.preventDefault()
  event.stopPropagation()
  navigate(el.getAttribute('data-policy-id'))
}
