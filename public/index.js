var Index = (function () {
  "use strict";

  function noop() {}
  function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
      loc: { file, line, column, char },
    };
  }
  function run(fn) {
    return fn();
  }
  function blank_object() {
    return Object.create(null);
  }
  function run_all(fns) {
    fns.forEach(run);
  }
  function is_function(thing) {
    return typeof thing === "function";
  }
  function safe_not_equal(a, b) {
    return a != a
      ? b == b
      : a !== b || (a && typeof a === "object") || typeof a === "function";
  }
  let src_url_equal_anchor;
  function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
      src_url_equal_anchor = document.createElement("a");
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
  }
  function is_empty(obj) {
    return Object.keys(obj).length === 0;
  }

  // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
  // at the end of hydration without touching the remaining nodes.
  let is_hydrating = false;
  function start_hydrating() {
    is_hydrating = true;
  }
  function end_hydrating() {
    is_hydrating = false;
  }
  function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
      const mid = low + ((high - low) >> 1);
      if (key(mid) <= value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
  function init_hydrate(target) {
    if (target.hydrate_init) return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === "HEAD") {
      const myChildren = [];
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (node.claim_order !== undefined) {
          myChildren.push(node);
        }
      }
      children = myChildren;
    }
    /*
     * Reorder claimed children optimally.
     * We can reorder claimed children optimally by finding the longest subsequence of
     * nodes that are already claimed in order and only moving the rest. The longest
     * subsequence subsequence of nodes that are claimed in order can be found by
     * computing the longest increasing subsequence of .claim_order values.
     *
     * This algorithm is optimal in generating the least amount of reorder operations
     * possible.
     *
     * Proof:
     * We know that, given a set of reordering operations, the nodes that do not move
     * always form an increasing subsequence, since they do not move among each other
     * meaning that they must be already ordered among each other. Thus, the maximal
     * set of nodes that do not move form a longest increasing subsequence.
     */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
      const current = children[i].claim_order;
      // Find the largest subsequence length such that it ends in a value less than our current value
      // upper_bound returns first greater value, so we subtract one
      // with fast path for when we are on the current longest subsequence
      const seqLen =
        (longest > 0 && children[m[longest]].claim_order <= current
          ? longest + 1
          : upper_bound(
              1,
              longest,
              (idx) => children[m[idx]].claim_order,
              current
            )) - 1;
      p[i] = m[seqLen] + 1;
      const newLen = seqLen + 1;
      // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
      m[newLen] = i;
      longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
      lis.push(children[cur - 1]);
      for (; last >= cur; last--) {
        toMove.push(children[last]);
      }
      last--;
    }
    for (; last >= 0; last--) {
      toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
      while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
        j++;
      }
      const anchor = j < lis.length ? lis[j] : null;
      target.insertBefore(toMove[i], anchor);
    }
  }
  function append_hydration(target, node) {
    if (is_hydrating) {
      init_hydrate(target);
      if (
        target.actual_end_child === undefined ||
        (target.actual_end_child !== null &&
          target.actual_end_child.parentElement !== target)
      ) {
        target.actual_end_child = target.firstChild;
      }
      // Skip nodes of undefined ordering
      while (
        target.actual_end_child !== null &&
        target.actual_end_child.claim_order === undefined
      ) {
        target.actual_end_child = target.actual_end_child.nextSibling;
      }
      if (node !== target.actual_end_child) {
        // We only insert if the ordering of this node should be modified or the parent node is not target
        if (node.claim_order !== undefined || node.parentNode !== target) {
          target.insertBefore(node, target.actual_end_child);
        }
      } else {
        target.actual_end_child = node.nextSibling;
      }
    } else if (node.parentNode !== target || node.nextSibling !== null) {
      target.appendChild(node);
    }
  }
  function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
      append_hydration(target, node);
    } else if (node.parentNode !== target || node.nextSibling != anchor) {
      target.insertBefore(node, anchor || null);
    }
  }
  function detach(node) {
    node.parentNode.removeChild(node);
  }
  function element(name) {
    return document.createElement(name);
  }
  function text(data) {
    return document.createTextNode(data);
  }
  function space() {
    return text(" ");
  }
  function attr(node, attribute, value) {
    if (value == null) node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
      node.setAttribute(attribute, value);
  }
  function children(element) {
    return Array.from(element.childNodes);
  }
  function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
      nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
  }
  function claim_node(
    nodes,
    predicate,
    processNode,
    createNode,
    dontUpdateLastIndex = false
  ) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
      // We first try to find an element after the previous one
      for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
        const node = nodes[i];
        if (predicate(node)) {
          const replacement = processNode(node);
          if (replacement === undefined) {
            nodes.splice(i, 1);
          } else {
            nodes[i] = replacement;
          }
          if (!dontUpdateLastIndex) {
            nodes.claim_info.last_index = i;
          }
          return node;
        }
      }
      // Otherwise, we try to find one before
      // We iterate in reverse so that we don't go too far back
      for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
        const node = nodes[i];
        if (predicate(node)) {
          const replacement = processNode(node);
          if (replacement === undefined) {
            nodes.splice(i, 1);
          } else {
            nodes[i] = replacement;
          }
          if (!dontUpdateLastIndex) {
            nodes.claim_info.last_index = i;
          } else if (replacement === undefined) {
            // Since we spliced before the last_index, we decrease it
            nodes.claim_info.last_index--;
          }
          return node;
        }
      }
      // If we can't find any matching node, we create a new one
      return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
  }
  function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(
      nodes,
      (node) => node.nodeName === name,
      (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
          const attribute = node.attributes[j];
          if (!attributes[attribute.name]) {
            remove.push(attribute.name);
          }
        }
        remove.forEach((v) => node.removeAttribute(v));
        return undefined;
      },
      () => create_element(name)
    );
  }
  function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
  }
  function claim_text(nodes, data) {
    return claim_node(
      nodes,
      (node) => node.nodeType === 3,
      (node) => {
        const dataStr = "" + data;
        if (node.data.startsWith(dataStr)) {
          if (node.data.length !== dataStr.length) {
            return node.splitText(dataStr.length);
          }
        } else {
          node.data = dataStr;
        }
      },
      () => text(data),
      true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
  }
  function claim_space(nodes) {
    return claim_text(nodes, " ");
  }
  function custom_event(type, detail, bubbles = false) {
    const e = document.createEvent("CustomEvent");
    e.initCustomEvent(type, bubbles, false, detail);
    return e;
  }

  let current_component;
  function set_current_component(component) {
    current_component = component;
  }

  const dirty_components = [];
  const binding_callbacks = [];
  const render_callbacks = [];
  const flush_callbacks = [];
  const resolved_promise = Promise.resolve();
  let update_scheduled = false;
  function schedule_update() {
    if (!update_scheduled) {
      update_scheduled = true;
      resolved_promise.then(flush);
    }
  }
  function add_render_callback(fn) {
    render_callbacks.push(fn);
  }
  let flushing = false;
  const seen_callbacks = new Set();
  function flush() {
    if (flushing) return;
    flushing = true;
    do {
      // first, call beforeUpdate functions
      // and update components
      for (let i = 0; i < dirty_components.length; i += 1) {
        const component = dirty_components[i];
        set_current_component(component);
        update(component.$$);
      }
      set_current_component(null);
      dirty_components.length = 0;
      while (binding_callbacks.length) binding_callbacks.pop()();
      // then, once components are updated, call
      // afterUpdate functions. This may cause
      // subsequent updates...
      for (let i = 0; i < render_callbacks.length; i += 1) {
        const callback = render_callbacks[i];
        if (!seen_callbacks.has(callback)) {
          // ...so guard against infinite loops
          seen_callbacks.add(callback);
          callback();
        }
      }
      render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
      flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
  }
  function update($$) {
    if ($$.fragment !== null) {
      $$.update();
      run_all($$.before_update);
      const dirty = $$.dirty;
      $$.dirty = [-1];
      $$.fragment && $$.fragment.p($$.ctx, dirty);
      $$.after_update.forEach(add_render_callback);
    }
  }
  const outroing = new Set();
  function transition_in(block, local) {
    if (block && block.i) {
      outroing.delete(block);
      block.i(local);
    }
  }
  function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
      // onMount happens before the initial afterUpdate
      add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
          on_destroy.push(...new_on_destroy);
        } else {
          // Edge case - component was destroyed immediately,
          // most likely as a result of a binding initialising
          run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
      });
    }
    after_update.forEach(add_render_callback);
  }
  function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
      run_all($$.on_destroy);
      $$.fragment && $$.fragment.d(detaching);
      // TODO null out other refs, including component.$$ (but need to
      // preserve final state?)
      $$.on_destroy = $$.fragment = null;
      $$.ctx = [];
    }
  }
  function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
      dirty_components.push(component);
      schedule_update();
      component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
  }
  function init(
    component,
    options,
    instance,
    create_fragment,
    not_equal,
    props,
    append_styles,
    dirty = [-1]
  ) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = (component.$$ = {
      fragment: null,
      ctx: null,
      // state
      props,
      update: noop,
      not_equal,
      bound: blank_object(),
      // lifecycle
      on_mount: [],
      on_destroy: [],
      on_disconnect: [],
      before_update: [],
      after_update: [],
      context: new Map(
        parent_component ? parent_component.$$.context : options.context || []
      ),
      // everything else
      callbacks: blank_object(),
      dirty,
      skip_bound: false,
      root: options.target || parent_component.$$.root,
    });
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
      ? instance(component, options.props || {}, (i, ret, ...rest) => {
          const value = rest.length ? rest[0] : ret;
          if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
            if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
            if (ready) make_dirty(component, i);
          }
          return ret;
        })
      : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
      if (options.hydrate) {
        start_hydrating();
        const nodes = children(options.target);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        $$.fragment && $$.fragment.l(nodes);
        nodes.forEach(detach);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        $$.fragment && $$.fragment.c();
      }
      if (options.intro) transition_in(component.$$.fragment);
      mount_component(
        component,
        options.target,
        options.anchor,
        options.customElement
      );
      end_hydrating();
      flush();
    }
    set_current_component(parent_component);
  }
  /**
   * Base class for Svelte components. Used when dev=false.
   */
  class SvelteComponent {
    $destroy() {
      destroy_component(this, 1);
      this.$destroy = noop;
    }
    $on(type, callback) {
      const callbacks =
        this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
      callbacks.push(callback);
      return () => {
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
      };
    }
    $set($$props) {
      if (this.$$set && !is_empty($$props)) {
        this.$$.skip_bound = true;
        this.$$set($$props);
        this.$$.skip_bound = false;
      }
    }
  }

  function dispatch_dev(type, detail) {
    document.dispatchEvent(
      custom_event(type, Object.assign({ version: "3.42.4" }, detail), true)
    );
  }
  function append_hydration_dev(target, node) {
    dispatch_dev("SvelteDOMInsert", { target, node });
    append_hydration(target, node);
  }
  function insert_hydration_dev(target, node, anchor) {
    dispatch_dev("SvelteDOMInsert", { target, node, anchor });
    insert_hydration(target, node, anchor);
  }
  function detach_dev(node) {
    dispatch_dev("SvelteDOMRemove", { node });
    detach(node);
  }
  function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
      dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
    else dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
  }
  function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
      if (!~keys.indexOf(slot_key)) {
        console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
      }
    }
  }
  /**
   * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
   */
  class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
      if (!options || (!options.target && !options.$$inline)) {
        throw new Error("'target' is a required option");
      }
      super();
    }
    $destroy() {
      super.$destroy();
      this.$destroy = () => {
        console.warn("Component was already destroyed"); // eslint-disable-line no-console
      };
    }
    $capture_state() {}
    $inject_state() {}
  }

  /* public/index.html generated by Svelte v3.42.4 */

  const file = "public/index.html";

  function create_fragment(ctx) {
    let _DOCTYPE;
    let t0;
    let html;
    let head;
    let meta0;
    let t1;
    let meta1;
    let t2;
    let link0;
    let t3;
    let link1;
    let t4;
    let link2;
    let t5;
    let script0;
    let script0_src_value;
    let t6;
    let body;
    let t7;
    let script1;
    let script1_src_value;
    let t8;
    let script2;
    let script2_src_value;

    const block = {
      c: function create() {
        _DOCTYPE = element("!DOCTYPE");
        t0 = space();
        html = element("html");
        head = element("head");
        meta0 = element("meta");
        t1 = space();
        meta1 = element("meta");
        t2 = space();
        link0 = element("link");
        t3 = space();
        link1 = element("link");
        t4 = space();
        link2 = element("link");
        t5 = space();
        script0 = element("script");
        t6 = space();
        body = element("body");
        t7 = space();
        script1 = element("script");
        t8 = space();
        script2 = element("script");
        this.h();
      },
      l: function claim(nodes) {
        _DOCTYPE = claim_element(nodes, "!DOCTYPE", { html: true });
        t0 = claim_space(nodes);
        html = claim_element(nodes, "HTML", { lang: true });
        var html_nodes = children(html);
        head = claim_element(html_nodes, "HEAD", {});
        var head_nodes = children(head);
        meta0 = claim_element(head_nodes, "META", { charset: true });
        t1 = claim_space(head_nodes);
        meta1 = claim_element(head_nodes, "META", {
          name: true,
          content: true,
        });
        t2 = claim_space(head_nodes);
        link0 = claim_element(head_nodes, "LINK", {
          rel: true,
          type: true,
          href: true,
        });
        t3 = claim_space(head_nodes);
        link1 = claim_element(head_nodes, "LINK", { rel: true, href: true });
        t4 = claim_space(head_nodes);
        link2 = claim_element(head_nodes, "LINK", { rel: true, href: true });
        t5 = claim_space(head_nodes);
        script0 = claim_element(head_nodes, "SCRIPT", { src: true });
        var script0_nodes = children(script0);
        script0_nodes.forEach(detach_dev);
        head_nodes.forEach(detach_dev);
        t6 = claim_space(html_nodes);
        body = claim_element(html_nodes, "BODY", {});
        children(body).forEach(detach_dev);
        t7 = claim_space(html_nodes);
        script1 = claim_element(html_nodes, "SCRIPT", { src: true });
        var script1_nodes = children(script1);
        script1_nodes.forEach(detach_dev);
        t8 = claim_space(html_nodes);
        script2 = claim_element(html_nodes, "SCRIPT", { src: true });
        var script2_nodes = children(script2);
        script2_nodes.forEach(detach_dev);
        html_nodes.forEach(detach_dev);
        this.h();
      },
      h: function hydrate() {
        attr_dev(_DOCTYPE, "html", "");
        add_location(_DOCTYPE, file, 0, 0, 0);
        attr_dev(meta0, "charset", "utf-8");
        add_location(meta0, file, 3, 4, 46);
        attr_dev(meta1, "name", "viewport");
        attr_dev(meta1, "content", "width=device-width,initial-scale=1");
        add_location(meta1, file, 4, 4, 75);
        attr_dev(link0, "rel", "icon");
        attr_dev(link0, "type", "image/png");
        attr_dev(link0, "href", "/favicon.png");
        add_location(link0, file, 6, 4, 150);
        attr_dev(link1, "rel", "stylesheet");
        attr_dev(link1, "href", "/global.css");
        add_location(link1, file, 7, 4, 211);
        attr_dev(link2, "rel", "stylesheet");
        attr_dev(link2, "href", "/build/bundle.css");
        add_location(link2, file, 8, 4, 260);
        script0.defer = true;
        if (
          !src_url_equal(script0.src, (script0_src_value = "/build/bundle.js"))
        )
          attr_dev(script0, "src", script0_src_value);
        add_location(script0, file, 10, 4, 316);
        add_location(head, file, 2, 2, 35);
        add_location(body, file, 13, 2, 376);
        if (
          !src_url_equal(
            script1.src,
            (script1_src_value = "http://code.jquery.com/jquery-latest.min.js")
          )
        )
          attr_dev(script1, "src", script1_src_value);
        add_location(script1, file, 14, 2, 392);
        if (!src_url_equal(script2.src, (script2_src_value = "../chat.js")))
          attr_dev(script2, "src", script2_src_value);
        add_location(script2, file, 15, 2, 462);
        attr_dev(html, "lang", "en");
        add_location(html, file, 1, 0, 16);
      },
      m: function mount(target, anchor) {
        insert_hydration_dev(target, _DOCTYPE, anchor);
        insert_hydration_dev(target, t0, anchor);
        insert_hydration_dev(target, html, anchor);
        append_hydration_dev(html, head);
        append_hydration_dev(head, meta0);
        append_hydration_dev(head, t1);
        append_hydration_dev(head, meta1);
        append_hydration_dev(head, t2);
        append_hydration_dev(head, link0);
        append_hydration_dev(head, t3);
        append_hydration_dev(head, link1);
        append_hydration_dev(head, t4);
        append_hydration_dev(head, link2);
        append_hydration_dev(head, t5);
        append_hydration_dev(head, script0);
        append_hydration_dev(html, t6);
        append_hydration_dev(html, body);
        append_hydration_dev(html, t7);
        append_hydration_dev(html, script1);
        append_hydration_dev(html, t8);
        append_hydration_dev(html, script2);
      },
      p: noop,
      i: noop,
      o: noop,
      d: function destroy(detaching) {
        if (detaching) detach_dev(_DOCTYPE);
        if (detaching) detach_dev(t0);
        if (detaching) detach_dev(html);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance($$self, $$props) {
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Public", slots, []);
    const writable_props = [];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Public> was created with unknown prop '${key}'`);
    });

    return [];
  }

  class Public extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance, create_fragment, safe_not_equal, {});

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Public",
        options,
        id: create_fragment.name,
      });
    }
  }

  return Public;
})();
