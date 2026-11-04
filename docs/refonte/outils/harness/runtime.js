// Mini-moteur de rendu des .dc.html pour contrôle local (pas le vrai runtime : même syntaxe, même CSS).
(function () {
  function get(scope, path) {
    var parts = String(path).trim().split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function evalExpr(scope, expr) {
    expr = String(expr).trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (expr[0] === '!') return !evalExpr(scope, expr.slice(1));
    return get(scope, expr);
  }
  function unwrap(v) { return String(v || '').replace(/^\s*\{\{/, '').replace(/\}\}\s*$/, ''); }
  function interp(str, scope) {
    return str.replace(/\{\{([\s\S]+?)\}\}/g, function (_, e) {
      var v = evalExpr(scope, e);
      return v == null ? '' : String(v);
    });
  }
  function processChildren(parent, scope, out) {
    var kids = Array.prototype.slice.call(parent.childNodes);
    for (var i = 0; i < kids.length; i++) {
      var r = processNode(kids[i], scope);
      for (var j = 0; j < r.length; j++) out.push(r[j]);
    }
  }
  function processNode(node, scope) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      return [document.createTextNode(t.indexOf('{{') >= 0 ? interp(t, scope) : t)];
    }
    if (node.nodeType !== 1) return [];
    var tag = node.localName;
    var out = [];
    if (tag === 'sc-if') {
      if (evalExpr(scope, unwrap(node.getAttribute('value')))) processChildren(node, scope, out);
      return out;
    }
    if (tag === 'sc-for') {
      var list = evalExpr(scope, unwrap(node.getAttribute('list'))) || [];
      var as = node.getAttribute('as') || 'item';
      list.forEach(function (it, i) {
        var s = Object.assign({}, scope);
        s[as] = it; s.$index = i;
        processChildren(node, s, out);
      });
      return out;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a];
      var name = at.name, value = at.value;
      if (/^on/i.test(name)) {
        var m = value.match(/^\s*\{\{([\s\S]+)\}\}\s*$/);
        if (m) {
          var fn = evalExpr(scope, m[1]);
          if (typeof fn === 'function') { el.__h = el.__h || {}; el.__h[name.slice(2).toLowerCase()] = fn; }
        }
        continue;
      }
      el.setAttribute(name, value.indexOf('{{') >= 0 ? interp(value, scope) : value);
    }
    var sub = [];
    processChildren(node, scope, sub);
    for (var k = 0; k < sub.length; k++) el.appendChild(sub[k]);
    return [el];
  }

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; this.__pending = false; }
    setState(p, cb) {
      var next = typeof p === 'function' ? p(this.state) : p;
      this.state = Object.assign({}, this.state, next);
      schedule();
      if (cb) cb();
    }
    forceUpdate() { schedule(); }
    componentDidMount() {}
    componentWillUnmount() {}
    renderVals() { return {}; }
  }

  var logic, root, tplHtml;
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(function () { scheduled = false; render(); });
  }
  // Les nœuds sont conservés d'un rendu à l'autre (comme avec React) : focus, survol, transitions,
  // animations et IntersectionObserver restent fidèles au vrai moteur.
  function bind(el) {
    if (!el.__h) return;
    el.__b = el.__b || {};
    Object.keys(el.__h).forEach(function (evt) {
      if (el.__b[evt]) return;
      el.__b[evt] = true;
      el.addEventListener(evt, function (e) { var f = el.__h && el.__h[evt]; if (f) f.call(el, e); });
    });
  }
  function bindTree(n) {
    if (n.nodeType !== 1) return;
    bind(n);
    for (var c = n.firstChild; c; c = c.nextSibling) bindTree(c);
  }
  function syncAttrs(old, nu) {
    var i, a;
    for (i = 0; i < nu.attributes.length; i++) {
      a = nu.attributes[i];
      if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
    }
    for (i = old.attributes.length - 1; i >= 0; i--) {
      a = old.attributes[i];
      if (!nu.hasAttribute(a.name)) old.removeAttribute(a.name);
    }
  }
  function morph(parent, newNodes) {
    var oldKids = Array.prototype.slice.call(parent.childNodes);
    for (var i = 0; i < newNodes.length; i++) {
      var nu = newNodes[i], old = oldKids[i];
      if (!old) { parent.appendChild(nu); bindTree(nu); continue; }
      if (old.nodeType === 3 && nu.nodeType === 3) { if (old.nodeValue !== nu.nodeValue) old.nodeValue = nu.nodeValue; continue; }
      if (old.nodeType === 1 && nu.nodeType === 1 && old.localName === nu.localName && old.namespaceURI === nu.namespaceURI) {
        syncAttrs(old, nu);
        old.__h = nu.__h;
        bind(old);
        morph(old, Array.prototype.slice.call(nu.childNodes));
        continue;
      }
      parent.replaceChild(nu, old);
      bindTree(nu);
    }
    while (parent.childNodes.length > newNodes.length) parent.removeChild(parent.lastChild);
  }
  function render() {
    var vals = logic.renderVals();
    var tpl = document.createElement('template');
    tpl.innerHTML = tplHtml;
    var out = [];
    processChildren(tpl.content, vals, out);
    morph(root, out);
  }

  window.__boot = function (tpl, code, props) {
    tplHtml = tpl;
    root = document.getElementById('root');
    var Component = new Function('DCLogic', 'StreamableLogic', 'React', code + '\n;return (typeof Component!=="undefined"&&Component)||undefined;')(DCLogic, DCLogic, {});
    logic = new Component(props);
    render();
    logic.componentDidMount();
    window.__logic = logic;
  };
})();
