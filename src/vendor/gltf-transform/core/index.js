var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// (disabled):fs
var require_fs = __commonJS({
  "(disabled):fs"() {
  }
});

// (disabled):path
var require_path = __commonJS({
  "(disabled):path"() {
  }
});

// node_modules/@gltf-transform/core/node_modules/property-graph/dist/property-graph.modern.js
var EventDispatcher = class {
  constructor() {
    this._listeners = {};
  }
  addEventListener(type, listener) {
    const listeners = this._listeners;
    if (listeners[type] === void 0) {
      listeners[type] = [];
    }
    if (listeners[type].indexOf(listener) === -1) {
      listeners[type].push(listener);
    }
    return this;
  }
  removeEventListener(type, listener) {
    if (this._listeners === void 0) return this;
    const listeners = this._listeners;
    const listenerArray = listeners[type];
    if (listenerArray !== void 0) {
      const index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
    return this;
  }
  dispatchEvent(event) {
    if (this._listeners === void 0) return this;
    const listeners = this._listeners;
    const listenerArray = listeners[event.type];
    if (listenerArray !== void 0) {
      const array = listenerArray.slice(0);
      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, event);
      }
    }
    return this;
  }
  dispose() {
    for (const key in this._listeners) {
      delete this._listeners[key];
    }
  }
};
var GraphEdge = class extends EventDispatcher {
  constructor(_name, _parent, _child, _attributes = {}) {
    super();
    this._name = void 0;
    this._parent = void 0;
    this._child = void 0;
    this._attributes = void 0;
    this._disposed = false;
    this._name = _name;
    this._parent = _parent;
    this._child = _child;
    this._attributes = _attributes;
    if (!_parent.isOnGraph(_child)) {
      throw new Error("Cannot connect disconnected graphs.");
    }
  }
  /** Name. */
  getName() {
    return this._name;
  }
  /** Owner node. */
  getParent() {
    return this._parent;
  }
  /** Resource node. */
  getChild() {
    return this._child;
  }
  /**
   * Sets the child node.
   *
   * @internal Only {@link Graph} implementations may safely call this method directly. Use
   * 	{@link Property.swap} or {@link Graph.swapChild} instead.
   */
  setChild(child) {
    this._child = child;
    return this;
  }
  /** Attributes of the graph node relationship. */
  getAttributes() {
    return this._attributes;
  }
  /** Destroys a (currently intact) edge, updating both the graph and the owner. */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.dispatchEvent({
      type: "dispose",
      target: this
    });
    super.dispose();
  }
  /** Whether this link has been destroyed. */
  isDisposed() {
    return this._disposed;
  }
};
var Graph = class extends EventDispatcher {
  constructor(...args) {
    super(...args);
    this._emptySet = /* @__PURE__ */ new Set();
    this._edges = /* @__PURE__ */ new Set();
    this._parentEdges = /* @__PURE__ */ new Map();
    this._childEdges = /* @__PURE__ */ new Map();
  }
  /** Returns a list of all parent->child edges on this graph. */
  listEdges() {
    return Array.from(this._edges);
  }
  /** Returns a list of all edges on the graph having the given node as their child. */
  listParentEdges(node) {
    return Array.from(this._childEdges.get(node) || this._emptySet);
  }
  /** Returns a list of parent nodes for the given child node. */
  listParents(node) {
    return this.listParentEdges(node).map((edge) => edge.getParent());
  }
  /** Returns a list of all edges on the graph having the given node as their parent. */
  listChildEdges(node) {
    return Array.from(this._parentEdges.get(node) || this._emptySet);
  }
  /** Returns a list of child nodes for the given parent node. */
  listChildren(node) {
    return this.listChildEdges(node).map((edge) => edge.getChild());
  }
  disconnectParents(node, filter) {
    let edges = this.listParentEdges(node);
    if (filter) {
      edges = edges.filter((edge) => filter(edge.getParent()));
    }
    edges.forEach((edge) => edge.dispose());
    return this;
  }
  /**
   * Creates a {@link GraphEdge} connecting two {@link GraphNode} instances. Edge is returned
   * for the caller to store.
   * @param a Owner
   * @param b Resource
   */
  createEdge(name, a, b, attributes) {
    return this._registerEdge(new GraphEdge(name, a, b, attributes));
  }
  /**********************************************************************************************
   * Internal.
   */
  /** @hidden */
  _registerEdge(edge) {
    this._edges.add(edge);
    const parent = edge.getParent();
    if (!this._parentEdges.has(parent)) this._parentEdges.set(parent, /* @__PURE__ */ new Set());
    this._parentEdges.get(parent).add(edge);
    const child = edge.getChild();
    if (!this._childEdges.has(child)) this._childEdges.set(child, /* @__PURE__ */ new Set());
    this._childEdges.get(child).add(edge);
    edge.addEventListener("dispose", () => this._removeEdge(edge));
    return edge;
  }
  /**
   * Removes the {@link GraphEdge} from the {@link Graph}. This method should only
   * be invoked by the onDispose() listener created in {@link _registerEdge()}. The
   * public method of removing an edge is {@link GraphEdge.dispose}.
   */
  _removeEdge(edge) {
    this._edges.delete(edge);
    this._parentEdges.get(edge.getParent()).delete(edge);
    this._childEdges.get(edge.getChild()).delete(edge);
    return this;
  }
};
function _extends() {
  _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends.apply(this, arguments);
}
var RefList = class {
  constructor(refs) {
    this.list = [];
    if (refs) {
      for (const ref of refs) {
        this.list.push(ref);
      }
    }
  }
  add(ref) {
    this.list.push(ref);
  }
  remove(ref) {
    const index = this.list.indexOf(ref);
    if (index >= 0) this.list.splice(index, 1);
  }
  removeChild(child) {
    const refs = [];
    for (const ref of this.list) {
      if (ref.getChild() === child) {
        refs.push(ref);
      }
    }
    for (const ref of refs) {
      this.remove(ref);
    }
    return refs;
  }
  listRefsByChild(child) {
    const refs = [];
    for (const ref of this.list) {
      if (ref.getChild() === child) {
        refs.push(ref);
      }
    }
    return refs;
  }
  values() {
    return this.list;
  }
};
var RefSet = class {
  constructor(refs) {
    this.set = /* @__PURE__ */ new Set();
    this.map = /* @__PURE__ */ new Map();
    if (refs) {
      for (const ref of refs) {
        this.add(ref);
      }
    }
  }
  add(ref) {
    const child = ref.getChild();
    this.removeChild(child);
    this.set.add(ref);
    this.map.set(child, ref);
  }
  remove(ref) {
    this.set.delete(ref);
    this.map.delete(ref.getChild());
  }
  removeChild(child) {
    const ref = this.map.get(child) || null;
    if (ref) this.remove(ref);
    return ref;
  }
  getRefByChild(child) {
    return this.map.get(child) || null;
  }
  values() {
    return Array.from(this.set);
  }
};
var RefMap = class {
  constructor(map) {
    this.map = {};
    if (map) {
      Object.assign(this.map, map);
    }
  }
  set(key, child) {
    this.map[key] = child;
  }
  delete(key) {
    delete this.map[key];
  }
  get(key) {
    return this.map[key] || null;
  }
  keys() {
    return Object.keys(this.map);
  }
  values() {
    return Object.values(this.map);
  }
};
var $attributes = /* @__PURE__ */ Symbol("attributes");
var $immutableKeys = /* @__PURE__ */ Symbol("immutableKeys");
var GraphNode = class _GraphNode extends EventDispatcher {
  /**
   * Internal graph used to search and maintain references.
   * @hidden
   */
  /**
   * Attributes (literal values and GraphNode references) associated with this instance. For each
   * GraphNode reference, the attributes stores a {@link GraphEdge}. List and Map references are
   * stored as arrays and dictionaries of edges.
   * @internal
   */
  /**
   * Attributes included with `getDefaultAttributes` are considered immutable, and cannot be
   * modifed by `.setRef()`, `.copy()`, or other GraphNode methods. Both the edges and the
   * properties will be disposed with the parent GraphNode.
   *
   * Currently, only single-edge references (getRef/setRef) are supported as immutables.
   *
   * @internal
   */
  constructor(graph) {
    super();
    this._disposed = false;
    this.graph = void 0;
    this[$attributes] = void 0;
    this[$immutableKeys] = void 0;
    this.graph = graph;
    this[$immutableKeys] = /* @__PURE__ */ new Set();
    this[$attributes] = this._createAttributes();
  }
  /**
   * Returns default attributes for the graph node. Subclasses having any attributes (either
   * literal values or references to other graph nodes) must override this method. Literal
   * attributes should be given their default values, if any. References should generally be
   * initialized as empty (Ref → null, RefList → [], RefMap → {}) and then modified by setters.
   *
   * Any single-edge references (setRef) returned by this method will be considered immutable,
   * to be owned by and disposed with the parent node. Multi-edge references (addRef, removeRef,
   * setRefMap) cannot be returned as default attributes.
   */
  getDefaults() {
    return {};
  }
  /**
   * Constructs and returns an object used to store a graph nodes attributes. Compared to the
   * default Attributes interface, this has two distinctions:
   *
   * 1. Slots for GraphNode<T> objects are replaced with slots for GraphEdge<this, GraphNode<T>>
   * 2. GraphNode<T> objects provided as defaults are considered immutable
   *
   * @internal
   */
  _createAttributes() {
    const defaultAttributes = this.getDefaults();
    const attributes = {};
    for (const key in defaultAttributes) {
      const value = defaultAttributes[key];
      if (value instanceof _GraphNode) {
        const ref = this.graph.createEdge(key, this, value);
        ref.addEventListener("dispose", () => value.dispose());
        this[$immutableKeys].add(key);
        attributes[key] = ref;
      } else {
        attributes[key] = value;
      }
    }
    return attributes;
  }
  /** @internal Returns true if two nodes are on the same {@link Graph}. */
  isOnGraph(other) {
    return this.graph === other.graph;
  }
  /** Returns true if the node has been permanently removed from the graph. */
  isDisposed() {
    return this._disposed;
  }
  /**
   * Removes both inbound references to and outbound references from this object. At the end
   * of the process the object holds no references, and nothing holds references to it. A
   * disposed object is not reusable.
   */
  dispose() {
    if (this._disposed) return;
    this.graph.listChildEdges(this).forEach((edge) => edge.dispose());
    this.graph.disconnectParents(this);
    this._disposed = true;
    this.dispatchEvent({
      type: "dispose"
    });
  }
  /**
   * Removes all inbound references to this object. At the end of the process the object is
   * considered 'detached': it may hold references to child resources, but nothing holds
   * references to it. A detached object may be re-attached.
   */
  detach() {
    this.graph.disconnectParents(this);
    return this;
  }
  /**
   * Transfers this object's references from the old node to the new one. The old node is fully
   * detached from this parent at the end of the process.
   *
   * @hidden
   */
  swap(prevValue, nextValue) {
    for (const attribute in this[$attributes]) {
      const value = this[$attributes][attribute];
      if (value instanceof GraphEdge) {
        const ref = value;
        if (ref.getChild() === prevValue) {
          this.setRef(attribute, nextValue, ref.getAttributes());
        }
      } else if (value instanceof RefList) {
        for (const ref of value.listRefsByChild(prevValue)) {
          const refAttributes = ref.getAttributes();
          this.removeRef(attribute, prevValue);
          this.addRef(attribute, nextValue, refAttributes);
        }
      } else if (value instanceof RefSet) {
        const ref = value.getRefByChild(prevValue);
        if (ref) {
          const refAttributes = ref.getAttributes();
          this.removeRef(attribute, prevValue);
          this.addRef(attribute, nextValue, refAttributes);
        }
      } else if (value instanceof RefMap) {
        for (const key of value.keys()) {
          const ref = value.get(key);
          if (ref.getChild() === prevValue) {
            this.setRefMap(attribute, key, nextValue, ref.getAttributes());
          }
        }
      }
    }
    return this;
  }
  /**********************************************************************************************
   * Literal attributes.
   */
  /** @hidden */
  get(attribute) {
    return this[$attributes][attribute];
  }
  /** @hidden */
  set(attribute, value) {
    this[$attributes][attribute] = value;
    return this.dispatchEvent({
      type: "change",
      attribute
    });
  }
  /**********************************************************************************************
   * Ref: 1:1 graph node references.
   */
  /** @hidden */
  getRef(attribute) {
    const ref = this[$attributes][attribute];
    return ref ? ref.getChild() : null;
  }
  /** @hidden */
  setRef(attribute, value, attributes) {
    if (this[$immutableKeys].has(attribute)) {
      throw new Error(`Cannot overwrite immutable attribute, "${attribute}".`);
    }
    const prevRef = this[$attributes][attribute];
    if (prevRef) prevRef.dispose();
    if (!value) return this;
    const ref = this.graph.createEdge(attribute, this, value, attributes);
    ref.addEventListener("dispose", () => {
      delete this[$attributes][attribute];
      this.dispatchEvent({
        type: "change",
        attribute
      });
    });
    this[$attributes][attribute] = ref;
    return this.dispatchEvent({
      type: "change",
      attribute
    });
  }
  /**********************************************************************************************
   * RefList: 1:many graph node references.
   */
  /** @hidden */
  listRefs(attribute) {
    const refs = this.assertRefList(attribute);
    return refs.values().map((ref) => ref.getChild());
  }
  /** @hidden */
  addRef(attribute, value, attributes) {
    const ref = this.graph.createEdge(attribute, this, value, attributes);
    const refs = this.assertRefList(attribute);
    refs.add(ref);
    ref.addEventListener("dispose", () => {
      refs.remove(ref);
      this.dispatchEvent({
        type: "change",
        attribute
      });
    });
    return this.dispatchEvent({
      type: "change",
      attribute
    });
  }
  /** @hidden */
  removeRef(attribute, value) {
    const refs = this.assertRefList(attribute);
    if (refs instanceof RefList) {
      for (const ref of refs.removeChild(value)) {
        ref.dispose();
      }
    } else {
      const ref = refs.removeChild(value);
      if (ref) ref.dispose();
    }
    return this;
  }
  /** @hidden */
  assertRefList(attribute) {
    const list = this[$attributes][attribute];
    if (list instanceof RefList || list instanceof RefSet) {
      return list;
    }
    throw new Error(`Expected RefList or RefSet for attribute "${attribute}"`);
  }
  /**********************************************************************************************
   * RefMap: Named 1:many (map) graph node references.
   */
  /** @hidden */
  listRefMapKeys(attribute) {
    return this.assertRefMap(attribute).keys();
  }
  /** @hidden */
  listRefMapValues(attribute) {
    return this.assertRefMap(attribute).values().map((ref) => ref.getChild());
  }
  /** @hidden */
  getRefMap(attribute, key) {
    const refMap = this.assertRefMap(attribute);
    const ref = refMap.get(key);
    return ref ? ref.getChild() : null;
  }
  /** @hidden */
  setRefMap(attribute, key, value, metadata) {
    const refMap = this.assertRefMap(attribute);
    const prevRef = refMap.get(key);
    if (prevRef) prevRef.dispose();
    if (!value) return this;
    metadata = Object.assign(metadata || {}, {
      key
    });
    const ref = this.graph.createEdge(attribute, this, value, _extends({}, metadata, {
      key
    }));
    ref.addEventListener("dispose", () => {
      refMap.delete(key);
      this.dispatchEvent({
        type: "change",
        attribute,
        key
      });
    });
    refMap.set(key, ref);
    return this.dispatchEvent({
      type: "change",
      attribute,
      key
    });
  }
  /** @hidden */
  assertRefMap(attribute) {
    const map = this[$attributes][attribute];
    if (map instanceof RefMap) {
      return map;
    }
    throw new Error(`Expected RefMap for attribute "${attribute}"`);
  }
  /**********************************************************************************************
   * Events.
   */
  /**
   * Dispatches an event on the GraphNode, and on the associated
   * Graph. Event types on the graph are prefixed, `"node:[type]"`.
   */
  dispatchEvent(event) {
    super.dispatchEvent(_extends({}, event, {
      target: this
    }));
    this.graph.dispatchEvent(_extends({}, event, {
      target: this,
      type: `node:${event.type}`
    }));
    return this;
  }
};

// node_modules/@gltf-transform/core/dist/index.modern.js
var VERSION = `v${"4.0.0"}`;
var GLB_BUFFER = "@glb.bin";
var PropertyType;
(function(PropertyType2) {
  PropertyType2["ACCESSOR"] = "Accessor";
  PropertyType2["ANIMATION"] = "Animation";
  PropertyType2["ANIMATION_CHANNEL"] = "AnimationChannel";
  PropertyType2["ANIMATION_SAMPLER"] = "AnimationSampler";
  PropertyType2["BUFFER"] = "Buffer";
  PropertyType2["CAMERA"] = "Camera";
  PropertyType2["MATERIAL"] = "Material";
  PropertyType2["MESH"] = "Mesh";
  PropertyType2["PRIMITIVE"] = "Primitive";
  PropertyType2["PRIMITIVE_TARGET"] = "PrimitiveTarget";
  PropertyType2["NODE"] = "Node";
  PropertyType2["ROOT"] = "Root";
  PropertyType2["SCENE"] = "Scene";
  PropertyType2["SKIN"] = "Skin";
  PropertyType2["TEXTURE"] = "Texture";
  PropertyType2["TEXTURE_INFO"] = "TextureInfo";
})(PropertyType || (PropertyType = {}));
var VertexLayout;
(function(VertexLayout2) {
  VertexLayout2["INTERLEAVED"] = "interleaved";
  VertexLayout2["SEPARATE"] = "separate";
})(VertexLayout || (VertexLayout = {}));
var BufferViewUsage$1;
(function(BufferViewUsage2) {
  BufferViewUsage2["ARRAY_BUFFER"] = "ARRAY_BUFFER";
  BufferViewUsage2["ELEMENT_ARRAY_BUFFER"] = "ELEMENT_ARRAY_BUFFER";
  BufferViewUsage2["INVERSE_BIND_MATRICES"] = "INVERSE_BIND_MATRICES";
  BufferViewUsage2["OTHER"] = "OTHER";
  BufferViewUsage2["SPARSE"] = "SPARSE";
})(BufferViewUsage$1 || (BufferViewUsage$1 = {}));
var TextureChannel;
(function(TextureChannel2) {
  TextureChannel2[TextureChannel2["R"] = 4096] = "R";
  TextureChannel2[TextureChannel2["G"] = 256] = "G";
  TextureChannel2[TextureChannel2["B"] = 16] = "B";
  TextureChannel2[TextureChannel2["A"] = 1] = "A";
})(TextureChannel || (TextureChannel = {}));
var Format;
(function(Format2) {
  Format2["GLTF"] = "GLTF";
  Format2["GLB"] = "GLB";
})(Format || (Format = {}));
var ComponentTypeToTypedArray = {
  "5120": Int8Array,
  "5121": Uint8Array,
  "5122": Int16Array,
  "5123": Uint16Array,
  "5125": Uint32Array,
  "5126": Float32Array
};
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function() {
  var y = 0, i = arguments.length;
  while (i--) {
    y += arguments[i] * arguments[i];
  }
  return Math.sqrt(y);
};
function create() {
  var out = new ARRAY_TYPE(3);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  return out;
}
function length(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return Math.hypot(x, y, z);
}
function transformMat4(out, a, m) {
  var x = a[0], y = a[1], z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
(function() {
  var vec = create();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 3;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }
    return a;
  };
})();
function getBounds(node) {
  const resultBounds = createBounds();
  const parents = node.propertyType === PropertyType.NODE ? [node] : node.listChildren();
  for (const parent of parents) {
    parent.traverse((node2) => {
      const mesh = node2.getMesh();
      if (!mesh) return;
      const meshBounds = getMeshBounds(mesh, node2.getWorldMatrix());
      if (meshBounds.min.every(isFinite) && meshBounds.max.every(isFinite)) {
        expandBounds(meshBounds.min, resultBounds);
        expandBounds(meshBounds.max, resultBounds);
      }
    });
  }
  return resultBounds;
}
function getMeshBounds(mesh, worldMatrix) {
  const meshBounds = createBounds();
  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute("POSITION");
    const indices = prim.getIndices();
    if (!position) continue;
    let localPos = [0, 0, 0];
    let worldPos = [0, 0, 0];
    for (let i = 0, il = indices ? indices.getCount() : position.getCount(); i < il; i++) {
      const index = indices ? indices.getScalar(i) : i;
      localPos = position.getElement(index, localPos);
      worldPos = transformMat4(worldPos, localPos, worldMatrix);
      expandBounds(worldPos, meshBounds);
    }
  }
  return meshBounds;
}
function expandBounds(point, target) {
  for (let i = 0; i < 3; i++) {
    target.min[i] = Math.min(point[i], target.min[i]);
    target.max[i] = Math.max(point[i], target.max[i]);
  }
}
function createBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
}
var BufferUtils = class {
  /** Creates a byte array from a Data URI. */
  static createBufferFromDataURI(dataURI) {
    if (typeof Buffer === "undefined") {
      const byteString = atob(dataURI.split(",")[1]);
      const ia = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return ia;
    } else {
      const data = dataURI.split(",")[1];
      const isBase64 = dataURI.indexOf("base64") >= 0;
      return Buffer.from(data, isBase64 ? "base64" : "utf8");
    }
  }
  /** Encodes text to a byte array. */
  static encodeText(text) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(text);
    }
    return Buffer.from(text);
  }
  /** Decodes a byte array to text. */
  static decodeText(array) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(array);
    }
    return Buffer.from(array).toString("utf8");
  }
  /**
   * Concatenates N byte arrays.
   */
  static concat(arrays) {
    let totalByteLength = 0;
    for (const array of arrays) {
      totalByteLength += array.byteLength;
    }
    const result = new Uint8Array(totalByteLength);
    let byteOffset = 0;
    for (const array of arrays) {
      result.set(array, byteOffset);
      byteOffset += array.byteLength;
    }
    return result;
  }
  /**
   * Pads a Uint8Array to the next 4-byte boundary.
   *
   * Reference: [glTF → Data Alignment](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#data-alignment)
   */
  static pad(srcArray, paddingByte = 0) {
    const paddedLength = this.padNumber(srcArray.byteLength);
    if (paddedLength === srcArray.byteLength) return srcArray;
    const dstArray = new Uint8Array(paddedLength);
    dstArray.set(srcArray);
    if (paddingByte !== 0) {
      for (let i = srcArray.byteLength; i < paddedLength; i++) {
        dstArray[i] = paddingByte;
      }
    }
    return dstArray;
  }
  /** Pads a number to 4-byte boundaries. */
  static padNumber(v) {
    return Math.ceil(v / 4) * 4;
  }
  /** Returns true if given byte array instances are equal. */
  static equals(a, b) {
    if (a === b) return true;
    if (a.byteLength !== b.byteLength) return false;
    let i = a.byteLength;
    while (i--) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  /**
   * Returns a Uint8Array view of a typed array, with the same underlying ArrayBuffer.
   *
   * A shorthand for:
   *
   * ```js
   * const buffer = new Uint8Array(
   * 	array.buffer,
   * 	array.byteOffset + byteOffset,
   * 	Math.min(array.byteLength, byteLength)
   * );
   * ```
   *
   */
  static toView(a, byteOffset = 0, byteLength = Infinity) {
    return new Uint8Array(a.buffer, a.byteOffset + byteOffset, Math.min(a.byteLength, byteLength));
  }
  static assertView(view) {
    if (view && !ArrayBuffer.isView(view)) {
      throw new Error(`Method requires Uint8Array parameter; received "${typeof view}".`);
    }
    return view;
  }
};
var ColorUtils = class {
  /**
   * Converts sRGB hexadecimal to linear components.
   * @typeParam T vec3 or vec4 linear components.
   */
  static hexToFactor(hex, target) {
    hex = Math.floor(hex);
    const _target = target;
    _target[0] = (hex >> 16 & 255) / 255;
    _target[1] = (hex >> 8 & 255) / 255;
    _target[2] = (hex & 255) / 255;
    return this.convertSRGBToLinear(target, target);
  }
  /**
   * Converts linear components to sRGB hexadecimal.
   * @typeParam T vec3 or vec4 linear components.
   */
  static factorToHex(factor) {
    const target = [...factor];
    const [r, g, b] = this.convertLinearToSRGB(factor, target);
    return r * 255 << 16 ^ g * 255 << 8 ^ b * 255 << 0;
  }
  /**
   * Converts sRGB components to linear components.
   * @typeParam T vec3 or vec4 linear components.
   */
  static convertSRGBToLinear(source, target) {
    const _source = source;
    const _target = target;
    for (let i = 0; i < 3; i++) {
      _target[i] = _source[i] < 0.04045 ? _source[i] * 0.0773993808 : Math.pow(_source[i] * 0.9478672986 + 0.0521327014, 2.4);
    }
    return target;
  }
  /**
   * Converts linear components to sRGB components.
   * @typeParam T vec3 or vec4 linear components.
   */
  static convertLinearToSRGB(source, target) {
    const _source = source;
    const _target = target;
    for (let i = 0; i < 3; i++) {
      _target[i] = _source[i] < 31308e-7 ? _source[i] * 12.92 : 1.055 * Math.pow(_source[i], 0.41666) - 0.055;
    }
    return target;
  }
};
var JPEGImageUtils = class {
  match(array) {
    return array.length >= 3 && array[0] === 255 && array[1] === 216 && array[2] === 255;
  }
  getSize(array) {
    let view = new DataView(array.buffer, array.byteOffset + 4);
    let i, next;
    while (view.byteLength) {
      i = view.getUint16(0, false);
      validateJPEGBuffer(view, i);
      next = view.getUint8(i + 1);
      if (next === 192 || next === 193 || next === 194) {
        return [view.getUint16(i + 7, false), view.getUint16(i + 5, false)];
      }
      view = new DataView(array.buffer, view.byteOffset + i + 2);
    }
    throw new TypeError("Invalid JPG, no size found");
  }
  getChannels(_buffer) {
    return 3;
  }
};
var PNGImageUtils = class _PNGImageUtils {
  match(array) {
    return array.length >= 8 && array[0] === 137 && array[1] === 80 && array[2] === 78 && array[3] === 71 && array[4] === 13 && array[5] === 10 && array[6] === 26 && array[7] === 10;
  }
  getSize(array) {
    const view = new DataView(array.buffer, array.byteOffset);
    const magic = BufferUtils.decodeText(array.slice(12, 16));
    if (magic === _PNGImageUtils.PNG_FRIED_CHUNK_NAME) {
      return [view.getUint32(32, false), view.getUint32(36, false)];
    }
    return [view.getUint32(16, false), view.getUint32(20, false)];
  }
  getChannels(_buffer) {
    return 4;
  }
};
PNGImageUtils.PNG_FRIED_CHUNK_NAME = "CgBI";
var ImageUtils = class {
  /** Registers support for a new image format; useful for certain extensions. */
  static registerFormat(mimeType, impl) {
    this.impls[mimeType] = impl;
  }
  /**
   * Returns detected MIME type of the given image buffer. Note that for image
   * formats with support provided by extensions, the extension must be
   * registered with an I/O class before it can be detected by ImageUtils.
   */
  static getMimeType(buffer) {
    for (const mimeType in this.impls) {
      if (this.impls[mimeType].match(buffer)) {
        return mimeType;
      }
    }
    return null;
  }
  /** Returns the dimensions of the image. */
  static getSize(buffer, mimeType) {
    if (!this.impls[mimeType]) return null;
    return this.impls[mimeType].getSize(buffer);
  }
  /**
   * Returns a conservative estimate of the number of channels in the image. For some image
   * formats, the method may return 4 indicating the possibility of an alpha channel, without
   * the ability to guarantee that an alpha channel is present.
   */
  static getChannels(buffer, mimeType) {
    if (!this.impls[mimeType]) return null;
    return this.impls[mimeType].getChannels(buffer);
  }
  /** Returns a conservative estimate of the GPU memory required by this image. */
  static getVRAMByteLength(buffer, mimeType) {
    if (!this.impls[mimeType]) return null;
    if (this.impls[mimeType].getVRAMByteLength) {
      return this.impls[mimeType].getVRAMByteLength(buffer);
    }
    let uncompressedBytes = 0;
    const channels = 4;
    const resolution = this.getSize(buffer, mimeType);
    if (!resolution) return null;
    while (resolution[0] > 1 || resolution[1] > 1) {
      uncompressedBytes += resolution[0] * resolution[1] * channels;
      resolution[0] = Math.max(Math.floor(resolution[0] / 2), 1);
      resolution[1] = Math.max(Math.floor(resolution[1] / 2), 1);
    }
    uncompressedBytes += 1 * 1 * channels;
    return uncompressedBytes;
  }
  /** Returns the preferred file extension for the given MIME type. */
  static mimeTypeToExtension(mimeType) {
    if (mimeType === "image/jpeg") return "jpg";
    return mimeType.split("/").pop();
  }
  /** Returns the MIME type for the given file extension. */
  static extensionToMimeType(extension) {
    if (extension === "jpg") return "image/jpeg";
    if (!extension) return "";
    return `image/${extension}`;
  }
};
ImageUtils.impls = {
  "image/jpeg": new JPEGImageUtils(),
  "image/png": new PNGImageUtils()
};
function validateJPEGBuffer(view, i) {
  if (i > view.byteLength) {
    throw new TypeError("Corrupt JPG, exceeded buffer limits");
  }
  if (view.getUint8(i) !== 255) {
    throw new TypeError("Invalid JPG, marker table corrupted");
  }
  return view;
}
var FileUtils = class {
  /**
   * Extracts the basename from a file path, e.g. "folder/model.glb" -> "model".
   * See: {@link HTTPUtils.basename}
   */
  static basename(uri) {
    const fileName = uri.split(/[\\/]/).pop();
    return fileName.substring(0, fileName.lastIndexOf("."));
  }
  /**
   * Extracts the extension from a file path, e.g. "folder/model.glb" -> "glb".
   * See: {@link HTTPUtils.extension}
   */
  static extension(uri) {
    if (uri.startsWith("data:image/")) {
      const mimeType = uri.match(/data:(image\/\w+)/)[1];
      return ImageUtils.mimeTypeToExtension(mimeType);
    } else if (uri.startsWith("data:model/gltf+json")) {
      return "gltf";
    } else if (uri.startsWith("data:model/gltf-binary")) {
      return "glb";
    } else if (uri.startsWith("data:application/")) {
      return "bin";
    }
    return uri.split(/[\\/]/).pop().split(/[.]/).pop();
  }
};
function isObject(o) {
  return Object.prototype.toString.call(o) === "[object Object]";
}
function isPlainObject(o) {
  if (isObject(o) === false) return false;
  const ctor = o.constructor;
  if (ctor === void 0) return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false) return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
var _class;
var Verbosity;
(function(Verbosity2) {
  Verbosity2[Verbosity2["SILENT"] = 4] = "SILENT";
  Verbosity2[Verbosity2["ERROR"] = 3] = "ERROR";
  Verbosity2[Verbosity2["WARN"] = 2] = "WARN";
  Verbosity2[Verbosity2["INFO"] = 1] = "INFO";
  Verbosity2[Verbosity2["DEBUG"] = 0] = "DEBUG";
})(Verbosity || (Verbosity = {}));
var Logger = class _Logger {
  /** Constructs a new Logger instance. */
  constructor(verbosity) {
    this.verbosity = void 0;
    this.verbosity = verbosity;
  }
  /** Logs an event at level {@link Logger.Verbosity.DEBUG}. */
  debug(text) {
    if (this.verbosity <= _Logger.Verbosity.DEBUG) {
      console.debug(text);
    }
  }
  /** Logs an event at level {@link Logger.Verbosity.INFO}. */
  info(text) {
    if (this.verbosity <= _Logger.Verbosity.INFO) {
      console.info(text);
    }
  }
  /** Logs an event at level {@link Logger.Verbosity.WARN}. */
  warn(text) {
    if (this.verbosity <= _Logger.Verbosity.WARN) {
      console.warn(text);
    }
  }
  /** Logs an event at level {@link Logger.Verbosity.ERROR}. */
  error(text) {
    if (this.verbosity <= _Logger.Verbosity.ERROR) {
      console.error(text);
    }
  }
};
_class = Logger;
Logger.Verbosity = Verbosity;
Logger.DEFAULT_INSTANCE = new _class(_class.Verbosity.INFO);
function determinant(a) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32;
  return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
}
function multiply(out, a, b) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
function getScaling(out, mat) {
  var m11 = mat[0];
  var m12 = mat[1];
  var m13 = mat[2];
  var m21 = mat[4];
  var m22 = mat[5];
  var m23 = mat[6];
  var m31 = mat[8];
  var m32 = mat[9];
  var m33 = mat[10];
  out[0] = Math.hypot(m11, m12, m13);
  out[1] = Math.hypot(m21, m22, m23);
  out[2] = Math.hypot(m31, m32, m33);
  return out;
}
function getRotation(out, mat) {
  var scaling = new ARRAY_TYPE(3);
  getScaling(scaling, mat);
  var is1 = 1 / scaling[0];
  var is2 = 1 / scaling[1];
  var is3 = 1 / scaling[2];
  var sm11 = mat[0] * is1;
  var sm12 = mat[1] * is2;
  var sm13 = mat[2] * is3;
  var sm21 = mat[4] * is1;
  var sm22 = mat[5] * is2;
  var sm23 = mat[6] * is3;
  var sm31 = mat[8] * is1;
  var sm32 = mat[9] * is2;
  var sm33 = mat[10] * is3;
  var trace = sm11 + sm22 + sm33;
  var S = 0;
  if (trace > 0) {
    S = Math.sqrt(trace + 1) * 2;
    out[3] = 0.25 * S;
    out[0] = (sm23 - sm32) / S;
    out[1] = (sm31 - sm13) / S;
    out[2] = (sm12 - sm21) / S;
  } else if (sm11 > sm22 && sm11 > sm33) {
    S = Math.sqrt(1 + sm11 - sm22 - sm33) * 2;
    out[3] = (sm23 - sm32) / S;
    out[0] = 0.25 * S;
    out[1] = (sm12 + sm21) / S;
    out[2] = (sm31 + sm13) / S;
  } else if (sm22 > sm33) {
    S = Math.sqrt(1 + sm22 - sm11 - sm33) * 2;
    out[3] = (sm31 - sm13) / S;
    out[0] = (sm12 + sm21) / S;
    out[1] = 0.25 * S;
    out[2] = (sm23 + sm32) / S;
  } else {
    S = Math.sqrt(1 + sm33 - sm11 - sm22) * 2;
    out[3] = (sm12 - sm21) / S;
    out[0] = (sm31 + sm13) / S;
    out[1] = (sm23 + sm32) / S;
    out[2] = 0.25 * S;
  }
  return out;
}
var MathUtils = class _MathUtils {
  static identity(v) {
    return v;
  }
  static eq(a, b, tolerance = 1e-5) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > tolerance) return false;
    }
    return true;
  }
  static clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
  // TODO(perf): Compare performance if we replace the switch with individual functions.
  static decodeNormalizedInt(i, componentType) {
    switch (componentType) {
      case 5126:
        return i;
      case 5123:
        return i / 65535;
      case 5121:
        return i / 255;
      case 5122:
        return Math.max(i / 32767, -1);
      case 5120:
        return Math.max(i / 127, -1);
      default:
        throw new Error("Invalid component type.");
    }
  }
  // TODO(perf): Compare performance if we replace the switch with individual functions.
  static encodeNormalizedInt(f, componentType) {
    switch (componentType) {
      case 5126:
        return f;
      case 5123:
        return Math.round(_MathUtils.clamp(f, 0, 1) * 65535);
      case 5121:
        return Math.round(_MathUtils.clamp(f, 0, 1) * 255);
      case 5122:
        return Math.round(_MathUtils.clamp(f, -1, 1) * 32767);
      case 5120:
        return Math.round(_MathUtils.clamp(f, -1, 1) * 127);
      default:
        throw new Error("Invalid component type.");
    }
  }
  /**
   * Decompose a mat4 to TRS properties.
   *
   * Equivalent to the Matrix4 decompose() method in three.js, and intentionally not using the
   * gl-matrix version. See: https://github.com/toji/gl-matrix/issues/408
   *
   * @param srcMat Matrix element, to be decomposed to TRS properties.
   * @param dstTranslation Translation element, to be overwritten.
   * @param dstRotation Rotation element, to be overwritten.
   * @param dstScale Scale element, to be overwritten.
   */
  static decompose(srcMat, dstTranslation, dstRotation, dstScale) {
    let sx = length([srcMat[0], srcMat[1], srcMat[2]]);
    const sy = length([srcMat[4], srcMat[5], srcMat[6]]);
    const sz = length([srcMat[8], srcMat[9], srcMat[10]]);
    const det = determinant(srcMat);
    if (det < 0) sx = -sx;
    dstTranslation[0] = srcMat[12];
    dstTranslation[1] = srcMat[13];
    dstTranslation[2] = srcMat[14];
    const _m1 = srcMat.slice();
    const invSX = 1 / sx;
    const invSY = 1 / sy;
    const invSZ = 1 / sz;
    _m1[0] *= invSX;
    _m1[1] *= invSX;
    _m1[2] *= invSX;
    _m1[4] *= invSY;
    _m1[5] *= invSY;
    _m1[6] *= invSY;
    _m1[8] *= invSZ;
    _m1[9] *= invSZ;
    _m1[10] *= invSZ;
    getRotation(dstRotation, _m1);
    dstScale[0] = sx;
    dstScale[1] = sy;
    dstScale[2] = sz;
  }
  /**
   * Compose TRS properties to a mat4.
   *
   * Equivalent to the Matrix4 compose() method in three.js, and intentionally not using the
   * gl-matrix version. See: https://github.com/toji/gl-matrix/issues/408
   *
   * @param srcTranslation Translation element of matrix.
   * @param srcRotation Rotation element of matrix.
   * @param srcScale Scale element of matrix.
   * @param dstMat Matrix element, to be modified and returned.
   * @returns dstMat, overwritten to mat4 equivalent of given TRS properties.
   */
  static compose(srcTranslation, srcRotation, srcScale, dstMat) {
    const te = dstMat;
    const x = srcRotation[0], y = srcRotation[1], z = srcRotation[2], w = srcRotation[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = srcScale[0], sy = srcScale[1], sz = srcScale[2];
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = srcTranslation[0];
    te[13] = srcTranslation[1];
    te[14] = srcTranslation[2];
    te[15] = 1;
    return te;
  }
};
function equalsRef(refA, refB) {
  if (!!refA !== !!refB) return false;
  const a = refA.getChild();
  const b = refB.getChild();
  return a === b || a.equals(b);
}
function equalsRefSet(refSetA, refSetB) {
  if (!!refSetA !== !!refSetB) return false;
  const refValuesA = refSetA.values();
  const refValuesB = refSetB.values();
  if (refValuesA.length !== refValuesB.length) return false;
  for (let i = 0; i < refValuesA.length; i++) {
    const a = refValuesA[i];
    const b = refValuesB[i];
    if (a.getChild() === b.getChild()) continue;
    if (!a.getChild().equals(b.getChild())) return false;
  }
  return true;
}
function equalsRefMap(refMapA, refMapB) {
  if (!!refMapA !== !!refMapB) return false;
  const keysA = refMapA.keys();
  const keysB = refMapB.keys();
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const refA = refMapA.get(key);
    const refB = refMapB.get(key);
    if (!!refA !== !!refB) return false;
    const a = refA.getChild();
    const b = refB.getChild();
    if (a === b) continue;
    if (!a.equals(b)) return false;
  }
  return true;
}
function equalsArray(a, b) {
  if (a === b) return true;
  if (!!a !== !!b || !a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function equalsObject(_a, _b) {
  if (_a === _b) return true;
  if (!!_a !== !!_b) return false;
  if (!isPlainObject(_a) || !isPlainObject(_b)) {
    return _a === _b;
  }
  const a = _a;
  const b = _b;
  let numKeysA = 0;
  let numKeysB = 0;
  let key;
  for (key in a) numKeysA++;
  for (key in b) numKeysB++;
  if (numKeysA !== numKeysB) return false;
  for (key in a) {
    const valueA = a[key];
    const valueB = b[key];
    if (isArray(valueA) && isArray(valueB)) {
      if (!equalsArray(valueA, valueB)) return false;
    } else if (isPlainObject(valueA) && isPlainObject(valueB)) {
      if (!equalsObject(valueA, valueB)) return false;
    } else {
      if (valueA !== valueB) return false;
    }
  }
  return true;
}
function isArray(value) {
  return Array.isArray(value) || ArrayBuffer.isView(value);
}
var ALPHABET = "23456789abdegjkmnpqrvwxyzABDEGJKMNPQRVWXYZ";
var UNIQUE_RETRIES = 999;
var ID_LENGTH = 6;
var previousIDs = /* @__PURE__ */ new Set();
var generateOne = function generateOne2() {
  let rtn = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    rtn += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return rtn;
};
var uuid = function uuid2() {
  for (let retries = 0; retries < UNIQUE_RETRIES; retries++) {
    const id = generateOne();
    if (!previousIDs.has(id)) {
      previousIDs.add(id);
      return id;
    }
  }
  return "";
};
var NULL_DOMAIN = "https://null.example";
var HTTPUtils = class {
  static dirname(path) {
    const index = path.lastIndexOf("/");
    if (index === -1) return "./";
    return path.substring(0, index + 1);
  }
  /**
   * Extracts the basename from a URL, e.g. "folder/model.glb" -> "model".
   * See: {@link FileUtils.basename}
   */
  static basename(uri) {
    return FileUtils.basename(new URL(uri, NULL_DOMAIN).pathname);
  }
  /**
   * Extracts the extension from a URL, e.g. "folder/model.glb" -> "glb".
   * See: {@link FileUtils.extension}
   */
  static extension(uri) {
    return FileUtils.extension(new URL(uri, NULL_DOMAIN).pathname);
  }
  static resolve(base, path) {
    if (!this.isRelativePath(path)) return path;
    const stack = base.split("/");
    const parts = path.split("/");
    stack.pop();
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === ".") continue;
      if (parts[i] === "..") {
        stack.pop();
      } else {
        stack.push(parts[i]);
      }
    }
    return stack.join("/");
  }
  /**
   * Returns true for URLs containing a protocol, and false for both
   * absolute and relative paths.
   */
  static isAbsoluteURL(path) {
    return this.PROTOCOL_REGEXP.test(path);
  }
  /**
   * Returns true for paths that are declared relative to some unknown base
   * path. For example, "foo/bar/" is relative both "/foo/bar/" is not.
   */
  static isRelativePath(path) {
    return !/^(?:[a-zA-Z]+:)?\//.test(path);
  }
};
HTTPUtils.DEFAULT_INIT = {};
HTTPUtils.PROTOCOL_REGEXP = /^[a-zA-Z]+:\/\//;
var COPY_IDENTITY = (t) => t;
var EMPTY_SET = /* @__PURE__ */ new Set();
var Property = class extends GraphNode {
  /** @hidden */
  constructor(graph, name = "") {
    super(graph);
    this[$attributes]["name"] = name;
    this.init();
    this.dispatchEvent({
      type: "create"
    });
  }
  /**
   * Returns the Graph associated with this Property. For internal use.
   * @hidden
   * @experimental
   */
  getGraph() {
    return this.graph;
  }
  /**
   * Returns default attributes for the property. Empty lists and maps should be initialized
   * to empty arrays and objects. Always invoke `super.getDefaults()` and extend the result.
   */
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      name: "",
      extras: {}
    });
  }
  /** @hidden */
  set(attribute, value) {
    if (Array.isArray(value)) value = value.slice();
    return super.set(attribute, value);
  }
  /**********************************************************************************************
   * Name.
   */
  /**
   * Returns the name of this property. While names are not required to be unique, this is
   * encouraged, and non-unique names will be overwritten in some tools. For custom data about
   * a property, prefer to use Extras.
   */
  getName() {
    return this.get("name");
  }
  /**
   * Sets the name of this property. While names are not required to be unique, this is
   * encouraged, and non-unique names will be overwritten in some tools. For custom data about
   * a property, prefer to use Extras.
   */
  setName(name) {
    return this.set("name", name);
  }
  /**********************************************************************************************
   * Extras.
   */
  /**
   * Returns a reference to the Extras object, containing application-specific data for this
   * Property. Extras should be an Object, not a primitive value, for best portability.
   */
  getExtras() {
    return this.get("extras");
  }
  /**
   * Updates the Extras object, containing application-specific data for this Property. Extras
   * should be an Object, not a primitive value, for best portability.
   */
  setExtras(extras) {
    return this.set("extras", extras);
  }
  /**********************************************************************************************
   * Graph state.
   */
  /**
   * Makes a copy of this property, with the same resources (by reference) as the original.
   */
  clone() {
    const PropertyClass = this.constructor;
    return new PropertyClass(this.graph).copy(this, COPY_IDENTITY);
  }
  /**
   * Copies all data from another property to this one. Child properties are copied by reference,
   * unless a 'resolve' function is given to override that.
   * @param other Property to copy references from.
   * @param resolve Function to resolve each Property being transferred. Default is identity.
   */
  copy(other, resolve = COPY_IDENTITY) {
    for (const key in this[$attributes]) {
      const value = this[$attributes][key];
      if (value instanceof GraphEdge) {
        if (!this[$immutableKeys].has(key)) {
          value.dispose();
        }
      } else if (value instanceof RefList || value instanceof RefSet) {
        for (const ref of value.values()) {
          ref.dispose();
        }
      } else if (value instanceof RefMap) {
        for (const ref of value.values()) {
          ref.dispose();
        }
      }
    }
    for (const key in other[$attributes]) {
      const thisValue = this[$attributes][key];
      const otherValue = other[$attributes][key];
      if (otherValue instanceof GraphEdge) {
        if (this[$immutableKeys].has(key)) {
          const ref = thisValue;
          ref.getChild().copy(resolve(otherValue.getChild()), resolve);
        } else {
          this.setRef(key, resolve(otherValue.getChild()), otherValue.getAttributes());
        }
      } else if (otherValue instanceof RefSet || otherValue instanceof RefList) {
        for (const ref of otherValue.values()) {
          this.addRef(key, resolve(ref.getChild()), ref.getAttributes());
        }
      } else if (otherValue instanceof RefMap) {
        for (const subkey of otherValue.keys()) {
          const ref = otherValue.get(subkey);
          this.setRefMap(key, subkey, resolve(ref.getChild()), ref.getAttributes());
        }
      } else if (isPlainObject(otherValue)) {
        this[$attributes][key] = JSON.parse(JSON.stringify(otherValue));
      } else if (Array.isArray(otherValue) || otherValue instanceof ArrayBuffer || ArrayBuffer.isView(otherValue)) {
        this[$attributes][key] = otherValue.slice();
      } else {
        this[$attributes][key] = otherValue;
      }
    }
    return this;
  }
  /**
   * Returns true if two properties are deeply equivalent, recursively comparing the attributes
   * of the properties. Optionally, a 'skip' set may be included, specifying attributes whose
   * values should not be considered in the comparison.
   *
   * Example: Two {@link Primitive Primitives} are equivalent if they have accessors and
   * materials with equivalent content — but not necessarily the same specific accessors
   * and materials.
   */
  equals(other, skip = EMPTY_SET) {
    if (this === other) return true;
    if (this.propertyType !== other.propertyType) return false;
    for (const key in this[$attributes]) {
      if (skip.has(key)) continue;
      const a = this[$attributes][key];
      const b = other[$attributes][key];
      if (a instanceof GraphEdge || b instanceof GraphEdge) {
        if (!equalsRef(a, b)) {
          return false;
        }
      } else if (a instanceof RefSet || b instanceof RefSet || a instanceof RefList || b instanceof RefList) {
        if (!equalsRefSet(a, b)) {
          return false;
        }
      } else if (a instanceof RefMap || b instanceof RefMap) {
        if (!equalsRefMap(a, b)) {
          return false;
        }
      } else if (isPlainObject(a) || isPlainObject(b)) {
        if (!equalsObject(a, b)) return false;
      } else if (isArray(a) || isArray(b)) {
        if (!equalsArray(a, b)) return false;
      } else {
        if (a !== b) return false;
      }
    }
    return true;
  }
  detach() {
    this.graph.disconnectParents(this, (n) => n.propertyType !== "Root");
    return this;
  }
  /**
   * Returns a list of all properties that hold a reference to this property. For example, a
   * material may hold references to various textures, but a texture does not hold references
   * to the materials that use it.
   *
   * It is often necessary to filter the results for a particular type: some resources, like
   * {@link Accessor}s, may be referenced by different types of properties. Most properties
   * include the {@link Root} as a parent, which is usually not of interest.
   *
   * Usage:
   *
   * ```ts
   * const materials = texture
   * 	.listParents()
   * 	.filter((p) => p instanceof Material)
   * ```
   */
  listParents() {
    return this.graph.listParents(this);
  }
};
var ExtensibleProperty = class extends Property {
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      extensions: new RefMap()
    });
  }
  /** Returns an {@link ExtensionProperty} attached to this Property, if any. */
  getExtension(name) {
    return this.getRefMap("extensions", name);
  }
  /**
   * Attaches the given {@link ExtensionProperty} to this Property. For a given extension, only
   * one ExtensionProperty may be attached to any one Property at a time.
   */
  setExtension(name, extensionProperty) {
    if (extensionProperty) extensionProperty._validateParent(this);
    return this.setRefMap("extensions", name, extensionProperty);
  }
  /** Lists all {@link ExtensionProperty} instances attached to this Property. */
  listExtensions() {
    return this.listRefMapValues("extensions");
  }
};
var Accessor = class _Accessor extends ExtensibleProperty {
  /**********************************************************************************************
   * Instance.
   */
  init() {
    this.propertyType = PropertyType.ACCESSOR;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      array: null,
      type: _Accessor.Type.SCALAR,
      componentType: _Accessor.ComponentType.FLOAT,
      normalized: false,
      sparse: false,
      buffer: null
    });
  }
  /**********************************************************************************************
   * Static.
   */
  /** Returns size of a given element type, in components. */
  static getElementSize(type) {
    switch (type) {
      case _Accessor.Type.SCALAR:
        return 1;
      case _Accessor.Type.VEC2:
        return 2;
      case _Accessor.Type.VEC3:
        return 3;
      case _Accessor.Type.VEC4:
        return 4;
      case _Accessor.Type.MAT2:
        return 4;
      case _Accessor.Type.MAT3:
        return 9;
      case _Accessor.Type.MAT4:
        return 16;
      default:
        throw new Error("Unexpected type: " + type);
    }
  }
  /** Returns size of a given component type, in bytes. */
  static getComponentSize(componentType) {
    switch (componentType) {
      case _Accessor.ComponentType.BYTE:
        return 1;
      case _Accessor.ComponentType.UNSIGNED_BYTE:
        return 1;
      case _Accessor.ComponentType.SHORT:
        return 2;
      case _Accessor.ComponentType.UNSIGNED_SHORT:
        return 2;
      case _Accessor.ComponentType.UNSIGNED_INT:
        return 4;
      case _Accessor.ComponentType.FLOAT:
        return 4;
      default:
        throw new Error("Unexpected component type: " + componentType);
    }
  }
  /**********************************************************************************************
   * Min/max bounds.
   */
  /**
   * Minimum value of each component in this attribute. Unlike in a final glTF file, values
   * returned by this method will reflect the minimum accounting for {@link .normalized}
   * state.
   */
  getMinNormalized(target) {
    const normalized = this.getNormalized();
    const elementSize = this.getElementSize();
    const componentType = this.getComponentType();
    this.getMin(target);
    if (normalized) {
      for (let j = 0; j < elementSize; j++) {
        target[j] = MathUtils.decodeNormalizedInt(target[j], componentType);
      }
    }
    return target;
  }
  /**
   * Minimum value of each component in this attribute. Values returned by this method do not
   * reflect normalization: use {@link .getMinNormalized} in that case.
   */
  getMin(target) {
    const array = this.getArray();
    const count = this.getCount();
    const elementSize = this.getElementSize();
    for (let j = 0; j < elementSize; j++) target[j] = Infinity;
    for (let i = 0; i < count * elementSize; i += elementSize) {
      for (let j = 0; j < elementSize; j++) {
        const value = array[i + j];
        if (Number.isFinite(value)) {
          target[j] = Math.min(target[j], value);
        }
      }
    }
    return target;
  }
  /**
   * Maximum value of each component in this attribute. Unlike in a final glTF file, values
   * returned by this method will reflect the minimum accounting for {@link .normalized}
   * state.
   */
  getMaxNormalized(target) {
    const normalized = this.getNormalized();
    const elementSize = this.getElementSize();
    const componentType = this.getComponentType();
    this.getMax(target);
    if (normalized) {
      for (let j = 0; j < elementSize; j++) {
        target[j] = MathUtils.decodeNormalizedInt(target[j], componentType);
      }
    }
    return target;
  }
  /**
   * Maximum value of each component in this attribute. Values returned by this method do not
   * reflect normalization: use {@link .getMinNormalized} in that case.
   */
  getMax(target) {
    const array = this.get("array");
    const count = this.getCount();
    const elementSize = this.getElementSize();
    for (let j = 0; j < elementSize; j++) target[j] = -Infinity;
    for (let i = 0; i < count * elementSize; i += elementSize) {
      for (let j = 0; j < elementSize; j++) {
        const value = array[i + j];
        if (Number.isFinite(value)) {
          target[j] = Math.max(target[j], value);
        }
      }
    }
    return target;
  }
  /**********************************************************************************************
   * Layout.
   */
  /**
   * Number of elements in the accessor. An array of length 30, containing 10 `VEC3` elements,
   * will have a count of 10.
   */
  getCount() {
    const array = this.get("array");
    return array ? array.length / this.getElementSize() : 0;
  }
  /** Type of element stored in the accessor. `VEC2`, `VEC3`, etc. */
  getType() {
    return this.get("type");
  }
  /**
   * Sets type of element stored in the accessor. `VEC2`, `VEC3`, etc. Array length must be a
   * multiple of the component size (`VEC2` = 2, `VEC3` = 3, ...) for the selected type.
   */
  setType(type) {
    return this.set("type", type);
  }
  /**
   * Number of components in each element of the accessor. For example, the element size of a
   * `VEC2` accessor is 2. This value is determined automatically based on array length and
   * accessor type, specified with {@link Accessor.setType setType()}.
   */
  getElementSize() {
    return _Accessor.getElementSize(this.get("type"));
  }
  /**
   * Size of each component (a value in the raw array), in bytes. For example, the
   * `componentSize` of data backed by a `float32` array is 4 bytes.
   */
  getComponentSize() {
    return this.get("array").BYTES_PER_ELEMENT;
  }
  /**
   * Component type (float32, uint16, etc.). This value is determined automatically, and can only
   * be modified by replacing the underlying array.
   */
  getComponentType() {
    return this.get("componentType");
  }
  /**********************************************************************************************
   * Normalization.
   */
  /**
   * Specifies whether integer data values should be normalized (true) to [0, 1] (for unsigned
   * types) or [-1, 1] (for signed types), or converted directly (false) when they are accessed.
   * This property is defined only for accessors that contain vertex attributes or animation
   * output data.
   */
  getNormalized() {
    return this.get("normalized");
  }
  /**
   * Specifies whether integer data values should be normalized (true) to [0, 1] (for unsigned
   * types) or [-1, 1] (for signed types), or converted directly (false) when they are accessed.
   * This property is defined only for accessors that contain vertex attributes or animation
   * output data.
   */
  setNormalized(normalized) {
    return this.set("normalized", normalized);
  }
  /**********************************************************************************************
   * Data access.
   */
  /**
   * Returns the scalar element value at the given index. For
   * {@link Accessor.getNormalized normalized} integer accessors, values are
   * decoded and returned in floating-point form.
   */
  getScalar(index) {
    const elementSize = this.getElementSize();
    const componentType = this.getComponentType();
    const array = this.getArray();
    if (this.getNormalized()) {
      return MathUtils.decodeNormalizedInt(array[index * elementSize], componentType);
    }
    return array[index * elementSize];
  }
  /**
   * Assigns the scalar element value at the given index. For
   * {@link Accessor.getNormalized normalized} integer accessors, "value" should be
   * given in floating-point form — it will be integer-encoded before writing
   * to the underlying array.
   */
  setScalar(index, x) {
    const elementSize = this.getElementSize();
    const componentType = this.getComponentType();
    const array = this.getArray();
    if (this.getNormalized()) {
      array[index * elementSize] = MathUtils.encodeNormalizedInt(x, componentType);
    } else {
      array[index * elementSize] = x;
    }
    return this;
  }
  /**
   * Returns the vector or matrix element value at the given index. For
   * {@link Accessor.getNormalized normalized} integer accessors, values are
   * decoded and returned in floating-point form.
   *
   * Example:
   *
   * ```javascript
   * import { add } from 'gl-matrix/add';
   *
   * const element = [];
   * const offset = [1, 1, 1];
   *
   * for (let i = 0; i < accessor.getCount(); i++) {
   * 	accessor.getElement(i, element);
   * 	add(element, element, offset);
   * 	accessor.setElement(i, element);
   * }
   * ```
   */
  getElement(index, target) {
    const normalized = this.getNormalized();
    const elementSize = this.getElementSize();
    const componentType = this.getComponentType();
    const array = this.getArray();
    for (let i = 0; i < elementSize; i++) {
      if (normalized) {
        target[i] = MathUtils.decodeNormalizedInt(array[index * elementSize + i], componentType);
      } else {
        target[i] = array[index * elementSize + i];
      }
    }
    return target;
  }
  /**
   * Assigns the vector or matrix element value at the given index. For
   * {@link Accessor.getNormalized normalized} integer accessors, "value" should be
   * given in floating-point form — it will be integer-encoded before writing
   * to the underlying array.
   *
   * Example:
   *
   * ```javascript
   * import { add } from 'gl-matrix/add';
   *
   * const element = [];
   * const offset = [1, 1, 1];
   *
   * for (let i = 0; i < accessor.getCount(); i++) {
   * 	accessor.getElement(i, element);
   * 	add(element, element, offset);
   * 	accessor.setElement(i, element);
   * }
   * ```
   */
  setElement(index, value) {
    const normalized = this.getNormalized();
    const elementSize = this.getElementSize();
    const componentType = this.getComponentType();
    const array = this.getArray();
    for (let i = 0; i < elementSize; i++) {
      if (normalized) {
        array[index * elementSize + i] = MathUtils.encodeNormalizedInt(value[i], componentType);
      } else {
        array[index * elementSize + i] = value[i];
      }
    }
    return this;
  }
  /**********************************************************************************************
   * Raw data storage.
   */
  /**
   * Specifies whether the accessor should be stored sparsely. When written to a glTF file, sparse
   * accessors store only values that differ from base values. When loaded in glTF Transform (or most
   * runtimes) a sparse accessor can be treated like any other accessor. Currently, glTF Transform always
   * uses zeroes for the base values when writing files.
   * @experimental
   */
  getSparse() {
    return this.get("sparse");
  }
  /**
   * Specifies whether the accessor should be stored sparsely. When written to a glTF file, sparse
   * accessors store only values that differ from base values. When loaded in glTF Transform (or most
   * runtimes) a sparse accessor can be treated like any other accessor. Currently, glTF Transform always
   * uses zeroes for the base values when writing files.
   * @experimental
   */
  setSparse(sparse) {
    return this.set("sparse", sparse);
  }
  /** Returns the {@link Buffer} into which this accessor will be organized. */
  getBuffer() {
    return this.getRef("buffer");
  }
  /** Assigns the {@link Buffer} into which this accessor will be organized. */
  setBuffer(buffer) {
    return this.setRef("buffer", buffer);
  }
  /** Returns the raw typed array underlying this accessor. */
  getArray() {
    return this.get("array");
  }
  /** Assigns the raw typed array underlying this accessor. */
  setArray(array) {
    this.set("componentType", array ? arrayToComponentType(array) : _Accessor.ComponentType.FLOAT);
    this.set("array", array);
    return this;
  }
  /** Returns the total bytelength of this accessor, exclusive of padding. */
  getByteLength() {
    const array = this.get("array");
    return array ? array.byteLength : 0;
  }
};
Accessor.Type = {
  /** Scalar, having 1 value per element. */
  SCALAR: "SCALAR",
  /** 2-component vector, having 2 components per element. */
  VEC2: "VEC2",
  /** 3-component vector, having 3 components per element. */
  VEC3: "VEC3",
  /** 4-component vector, having 4 components per element. */
  VEC4: "VEC4",
  /** 2x2 matrix, having 4 components per element. */
  MAT2: "MAT2",
  /** 3x3 matrix, having 9 components per element. */
  MAT3: "MAT3",
  /** 4x3 matrix, having 16 components per element. */
  MAT4: "MAT4"
};
Accessor.ComponentType = {
  /**
   * 1-byte signed integer, stored as
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int8Array Int8Array}.
   */
  BYTE: 5120,
  /**
   * 1-byte unsigned integer, stored as
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array Uint8Array}.
   */
  UNSIGNED_BYTE: 5121,
  /**
   * 2-byte signed integer, stored as
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int16Array Int16Array}.
   */
  SHORT: 5122,
  /**
   * 2-byte unsigned integer, stored as
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array Uint16Array}.
   */
  UNSIGNED_SHORT: 5123,
  /**
   * 4-byte unsigned integer, stored as
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array Uint32Array}.
   */
  UNSIGNED_INT: 5125,
  /**
   * 4-byte floating point number, stored as
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array Float32Array}.
   */
  FLOAT: 5126
};
function arrayToComponentType(array) {
  switch (array.constructor) {
    case Float32Array:
      return Accessor.ComponentType.FLOAT;
    case Uint32Array:
      return Accessor.ComponentType.UNSIGNED_INT;
    case Uint16Array:
      return Accessor.ComponentType.UNSIGNED_SHORT;
    case Uint8Array:
      return Accessor.ComponentType.UNSIGNED_BYTE;
    case Int16Array:
      return Accessor.ComponentType.SHORT;
    case Int8Array:
      return Accessor.ComponentType.BYTE;
    default:
      throw new Error("Unknown accessor componentType.");
  }
}
var Animation = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.ANIMATION;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      channels: new RefSet(),
      samplers: new RefSet()
    });
  }
  /** Adds an {@link AnimationChannel} to this Animation. */
  addChannel(channel) {
    return this.addRef("channels", channel);
  }
  /** Removes an {@link AnimationChannel} from this Animation. */
  removeChannel(channel) {
    return this.removeRef("channels", channel);
  }
  /** Lists {@link AnimationChannel}s in this Animation. */
  listChannels() {
    return this.listRefs("channels");
  }
  /** Adds an {@link AnimationSampler} to this Animation. */
  addSampler(sampler) {
    return this.addRef("samplers", sampler);
  }
  /** Removes an {@link AnimationSampler} from this Animation. */
  removeSampler(sampler) {
    return this.removeRef("samplers", sampler);
  }
  /** Lists {@link AnimationSampler}s in this Animation. */
  listSamplers() {
    return this.listRefs("samplers");
  }
};
var AnimationChannel = class extends ExtensibleProperty {
  /**********************************************************************************************
   * Instance.
   */
  init() {
    this.propertyType = PropertyType.ANIMATION_CHANNEL;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      targetPath: null,
      targetNode: null,
      sampler: null
    });
  }
  /**********************************************************************************************
   * Properties.
   */
  /**
   * Path (property) animated on the target {@link Node}. Supported values include:
   * `translation`, `rotation`, `scale`, or `weights`.
   */
  getTargetPath() {
    return this.get("targetPath");
  }
  /**
   * Path (property) animated on the target {@link Node}. Supported values include:
   * `translation`, `rotation`, `scale`, or `weights`.
   */
  setTargetPath(targetPath) {
    return this.set("targetPath", targetPath);
  }
  /** Target {@link Node} animated by the channel. */
  getTargetNode() {
    return this.getRef("targetNode");
  }
  /** Target {@link Node} animated by the channel. */
  setTargetNode(targetNode) {
    return this.setRef("targetNode", targetNode);
  }
  /**
   * Keyframe data input/output values for the channel. Must be attached to the same
   * {@link Animation}.
   */
  getSampler() {
    return this.getRef("sampler");
  }
  /**
   * Keyframe data input/output values for the channel. Must be attached to the same
   * {@link Animation}.
   */
  setSampler(sampler) {
    return this.setRef("sampler", sampler);
  }
};
AnimationChannel.TargetPath = {
  /** Channel targets {@link Node.setTranslation}. */
  TRANSLATION: "translation",
  /** Channel targets {@link Node.setRotation}. */
  ROTATION: "rotation",
  /** Channel targets {@link Node.setScale}. */
  SCALE: "scale",
  /** Channel targets {@link Node.setWeights}, affecting {@link PrimitiveTarget} weights. */
  WEIGHTS: "weights"
};
var AnimationSampler = class _AnimationSampler extends ExtensibleProperty {
  /**********************************************************************************************
   * Instance.
   */
  init() {
    this.propertyType = PropertyType.ANIMATION_SAMPLER;
  }
  getDefaultAttributes() {
    return Object.assign(super.getDefaults(), {
      interpolation: _AnimationSampler.Interpolation.LINEAR,
      input: null,
      output: null
    });
  }
  /**********************************************************************************************
   * Static.
   */
  /** Interpolation mode: `STEP`, `LINEAR`, or `CUBICSPLINE`. */
  getInterpolation() {
    return this.get("interpolation");
  }
  /** Interpolation mode: `STEP`, `LINEAR`, or `CUBICSPLINE`. */
  setInterpolation(interpolation) {
    return this.set("interpolation", interpolation);
  }
  /** Times for each keyframe, in seconds. */
  getInput() {
    return this.getRef("input");
  }
  /** Times for each keyframe, in seconds. */
  setInput(input) {
    return this.setRef("input", input, {
      usage: BufferViewUsage$1.OTHER
    });
  }
  /**
   * Values for each keyframe. For `CUBICSPLINE` interpolation, output also contains in/out
   * tangents.
   */
  getOutput() {
    return this.getRef("output");
  }
  /**
   * Values for each keyframe. For `CUBICSPLINE` interpolation, output also contains in/out
   * tangents.
   */
  setOutput(output) {
    return this.setRef("output", output, {
      usage: BufferViewUsage$1.OTHER
    });
  }
};
AnimationSampler.Interpolation = {
  /** Animated values are linearly interpolated between keyframes. */
  LINEAR: "LINEAR",
  /** Animated values remain constant from one keyframe until the next keyframe. */
  STEP: "STEP",
  /** Animated values are interpolated according to given cubic spline tangents. */
  CUBICSPLINE: "CUBICSPLINE"
};
var Buffer$1 = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.BUFFER;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      uri: ""
    });
  }
  /**
   * Returns the URI (or filename) of this buffer (e.g. 'myBuffer.bin'). URIs are strongly
   * encouraged to be relative paths, rather than absolute. Use of a protocol (like `file://`)
   * is possible for custom applications, but will limit the compatibility of the asset with most
   * tools.
   *
   * Buffers commonly use the extension `.bin`, though this is not required.
   */
  getURI() {
    return this.get("uri");
  }
  /**
   * Sets the URI (or filename) of this buffer (e.g. 'myBuffer.bin'). URIs are strongly
   * encouraged to be relative paths, rather than absolute. Use of a protocol (like `file://`)
   * is possible for custom applications, but will limit the compatibility of the asset with most
   * tools.
   *
   * Buffers commonly use the extension `.bin`, though this is not required.
   */
  setURI(uri) {
    return this.set("uri", uri);
  }
};
var Camera = class _Camera extends ExtensibleProperty {
  /**********************************************************************************************
   * Instance.
   */
  init() {
    this.propertyType = PropertyType.CAMERA;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      // Common.
      type: _Camera.Type.PERSPECTIVE,
      znear: 0.1,
      zfar: 100,
      // Perspective.
      aspectRatio: null,
      yfov: Math.PI * 2 * 50 / 360,
      // 50º
      // Orthographic.
      xmag: 1,
      ymag: 1
    });
  }
  /**********************************************************************************************
   * Common.
   */
  /** Specifies if the camera uses a perspective or orthographic projection. */
  getType() {
    return this.get("type");
  }
  /** Specifies if the camera uses a perspective or orthographic projection. */
  setType(type) {
    return this.set("type", type);
  }
  /** Floating-point distance to the near clipping plane. */
  getZNear() {
    return this.get("znear");
  }
  /** Floating-point distance to the near clipping plane. */
  setZNear(znear) {
    return this.set("znear", znear);
  }
  /**
   * Floating-point distance to the far clipping plane. When defined, zfar must be greater than
   * znear. If zfar is undefined, runtime must use infinite projection matrix.
   */
  getZFar() {
    return this.get("zfar");
  }
  /**
   * Floating-point distance to the far clipping plane. When defined, zfar must be greater than
   * znear. If zfar is undefined, runtime must use infinite projection matrix.
   */
  setZFar(zfar) {
    return this.set("zfar", zfar);
  }
  /**********************************************************************************************
   * Perspective.
   */
  /**
   * Floating-point aspect ratio of the field of view. When undefined, the aspect ratio of the
   * canvas is used.
   */
  getAspectRatio() {
    return this.get("aspectRatio");
  }
  /**
   * Floating-point aspect ratio of the field of view. When undefined, the aspect ratio of the
   * canvas is used.
   */
  setAspectRatio(aspectRatio) {
    return this.set("aspectRatio", aspectRatio);
  }
  /** Floating-point vertical field of view in radians. */
  getYFov() {
    return this.get("yfov");
  }
  /** Floating-point vertical field of view in radians. */
  setYFov(yfov) {
    return this.set("yfov", yfov);
  }
  /**********************************************************************************************
   * Orthographic.
   */
  /**
   * Floating-point horizontal magnification of the view, and half the view's width
   * in world units.
   */
  getXMag() {
    return this.get("xmag");
  }
  /**
   * Floating-point horizontal magnification of the view, and half the view's width
   * in world units.
   */
  setXMag(xmag) {
    return this.set("xmag", xmag);
  }
  /**
   * Floating-point vertical magnification of the view, and half the view's height
   * in world units.
   */
  getYMag() {
    return this.get("ymag");
  }
  /**
   * Floating-point vertical magnification of the view, and half the view's height
   * in world units.
   */
  setYMag(ymag) {
    return this.set("ymag", ymag);
  }
};
Camera.Type = {
  /** A perspective camera representing a perspective projection matrix. */
  PERSPECTIVE: "perspective",
  /** An orthographic camera representing an orthographic projection matrix. */
  ORTHOGRAPHIC: "orthographic"
};
var ExtensionProperty = class extends Property {
  /** @hidden */
  _validateParent(parent) {
    if (!this.parentTypes.includes(parent.propertyType)) {
      throw new Error(`Parent "${parent.propertyType}" invalid for child "${this.propertyType}".`);
    }
  }
};
ExtensionProperty.EXTENSION_NAME = void 0;
var TextureInfo = class _TextureInfo extends ExtensibleProperty {
  /**********************************************************************************************
   * Instance.
   */
  init() {
    this.propertyType = PropertyType.TEXTURE_INFO;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      texCoord: 0,
      magFilter: null,
      minFilter: null,
      wrapS: _TextureInfo.WrapMode.REPEAT,
      wrapT: _TextureInfo.WrapMode.REPEAT
    });
  }
  /**********************************************************************************************
   * Texture coordinates.
   */
  /** Returns the texture coordinate (UV set) index for the texture. */
  getTexCoord() {
    return this.get("texCoord");
  }
  /** Sets the texture coordinate (UV set) index for the texture. */
  setTexCoord(texCoord) {
    return this.set("texCoord", texCoord);
  }
  /**********************************************************************************************
   * Min/mag filter.
   */
  /** Returns the magnification filter applied to the texture. */
  getMagFilter() {
    return this.get("magFilter");
  }
  /** Sets the magnification filter applied to the texture. */
  setMagFilter(magFilter) {
    return this.set("magFilter", magFilter);
  }
  /** Sets the minification filter applied to the texture. */
  getMinFilter() {
    return this.get("minFilter");
  }
  /** Returns the minification filter applied to the texture. */
  setMinFilter(minFilter) {
    return this.set("minFilter", minFilter);
  }
  /**********************************************************************************************
   * UV wrapping.
   */
  /** Returns the S (U) wrapping mode for UVs used by the texture. */
  getWrapS() {
    return this.get("wrapS");
  }
  /** Sets the S (U) wrapping mode for UVs used by the texture. */
  setWrapS(wrapS) {
    return this.set("wrapS", wrapS);
  }
  /** Returns the T (V) wrapping mode for UVs used by the texture. */
  getWrapT() {
    return this.get("wrapT");
  }
  /** Sets the T (V) wrapping mode for UVs used by the texture. */
  setWrapT(wrapT) {
    return this.set("wrapT", wrapT);
  }
};
TextureInfo.WrapMode = {
  /** */
  CLAMP_TO_EDGE: 33071,
  /** */
  MIRRORED_REPEAT: 33648,
  /** */
  REPEAT: 10497
};
TextureInfo.MagFilter = {
  /** */
  NEAREST: 9728,
  /** */
  LINEAR: 9729
};
TextureInfo.MinFilter = {
  /** */
  NEAREST: 9728,
  /** */
  LINEAR: 9729,
  /** */
  NEAREST_MIPMAP_NEAREST: 9984,
  /** */
  LINEAR_MIPMAP_NEAREST: 9985,
  /** */
  NEAREST_MIPMAP_LINEAR: 9986,
  /** */
  LINEAR_MIPMAP_LINEAR: 9987
};
var {
  R,
  G,
  B,
  A
} = TextureChannel;
var Material = class _Material extends ExtensibleProperty {
  /**********************************************************************************************
   * Instance.
   */
  init() {
    this.propertyType = PropertyType.MATERIAL;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      alphaMode: _Material.AlphaMode.OPAQUE,
      alphaCutoff: 0.5,
      doubleSided: false,
      baseColorFactor: [1, 1, 1, 1],
      baseColorTexture: null,
      baseColorTextureInfo: new TextureInfo(this.graph, "baseColorTextureInfo"),
      emissiveFactor: [0, 0, 0],
      emissiveTexture: null,
      emissiveTextureInfo: new TextureInfo(this.graph, "emissiveTextureInfo"),
      normalScale: 1,
      normalTexture: null,
      normalTextureInfo: new TextureInfo(this.graph, "normalTextureInfo"),
      occlusionStrength: 1,
      occlusionTexture: null,
      occlusionTextureInfo: new TextureInfo(this.graph, "occlusionTextureInfo"),
      roughnessFactor: 1,
      metallicFactor: 1,
      metallicRoughnessTexture: null,
      metallicRoughnessTextureInfo: new TextureInfo(this.graph, "metallicRoughnessTextureInfo")
    });
  }
  /**********************************************************************************************
   * Double-sided / culling.
   */
  /** Returns true when both sides of triangles should be rendered. May impact performance. */
  getDoubleSided() {
    return this.get("doubleSided");
  }
  /** Sets whether to render both sides of triangles. May impact performance. */
  setDoubleSided(doubleSided) {
    return this.set("doubleSided", doubleSided);
  }
  /**********************************************************************************************
   * Alpha.
   */
  /** Returns material alpha, equivalent to baseColorFactor[3]. */
  getAlpha() {
    return this.get("baseColorFactor")[3];
  }
  /** Sets material alpha, equivalent to baseColorFactor[3]. */
  setAlpha(alpha) {
    const baseColorFactor = this.get("baseColorFactor").slice();
    baseColorFactor[3] = alpha;
    return this.set("baseColorFactor", baseColorFactor);
  }
  /**
   * Returns the mode of the material's alpha channels, which are provided by `baseColorFactor`
   * and `baseColorTexture`.
   *
   * - `OPAQUE`: Alpha value is ignored and the rendered output is fully opaque.
   * - `BLEND`: Alpha value is used to determine the transparency each pixel on a surface, and
   * 	the fraction of surface vs. background color in the final result. Alpha blending creates
   *	significant edge cases in realtime renderers, and some care when structuring the model is
   * 	necessary for good results. In particular, transparent geometry should be kept in separate
   * 	meshes or primitives from opaque geometry. The `depthWrite` or `zWrite` settings in engines
   * 	should usually be disabled on transparent materials.
   * - `MASK`: Alpha value is compared against `alphaCutoff` threshold for each pixel on a
   * 	surface, and the pixel is either fully visible or fully discarded based on that cutoff.
   * 	This technique is useful for things like leafs/foliage, grass, fabric meshes, and other
   * 	surfaces where no semitransparency is needed. With a good choice of `alphaCutoff`, surfaces
   * 	that don't require semitransparency can avoid the performance penalties and visual issues
   * 	involved with `BLEND` transparency.
   *
   * Reference:
   * - [glTF → material.alphaMode](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#materialalphamode)
   */
  getAlphaMode() {
    return this.get("alphaMode");
  }
  /** Sets the mode of the material's alpha channels. See {@link Material.getAlphaMode getAlphaMode} for details. */
  setAlphaMode(alphaMode) {
    return this.set("alphaMode", alphaMode);
  }
  /** Returns the visibility threshold; applied only when `.alphaMode='MASK'`. */
  getAlphaCutoff() {
    return this.get("alphaCutoff");
  }
  /** Sets the visibility threshold; applied only when `.alphaMode='MASK'`. */
  setAlphaCutoff(alphaCutoff) {
    return this.set("alphaCutoff", alphaCutoff);
  }
  /**********************************************************************************************
   * Base color.
   */
  /**
   * Base color / albedo factor; Linear-sRGB components.
   * See {@link Material.getBaseColorTexture getBaseColorTexture}.
   */
  getBaseColorFactor() {
    return this.get("baseColorFactor");
  }
  /**
   * Base color / albedo factor; Linear-sRGB components.
   * See {@link Material.getBaseColorTexture getBaseColorTexture}.
   */
  setBaseColorFactor(baseColorFactor) {
    return this.set("baseColorFactor", baseColorFactor);
  }
  /**
   * Base color / albedo. The visible color of a non-metallic surface under constant ambient
   * light would be a linear combination (multiplication) of its vertex colors, base color
   * factor, and base color texture. Lighting, and reflections in metallic or smooth surfaces,
   * also effect the final color. The alpha (`.a`) channel of base color factors and textures
   * will have varying effects, based on the setting of {@link Material.getAlphaMode getAlphaMode}.
   *
   * Reference:
   * - [glTF → material.pbrMetallicRoughness.baseColorFactor](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#pbrmetallicroughnessbasecolorfactor)
   */
  getBaseColorTexture() {
    return this.getRef("baseColorTexture");
  }
  /**
   * Settings affecting the material's use of its base color texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getBaseColorTextureInfo() {
    return this.getRef("baseColorTexture") ? this.getRef("baseColorTextureInfo") : null;
  }
  /** Sets base color / albedo texture. See {@link Material.getBaseColorTexture getBaseColorTexture}. */
  setBaseColorTexture(texture) {
    return this.setRef("baseColorTexture", texture, {
      channels: R | G | B | A,
      isColor: true
    });
  }
  /**********************************************************************************************
   * Emissive.
   */
  /** Emissive color; Linear-sRGB components. See {@link Material.getEmissiveTexture getEmissiveTexture}. */
  getEmissiveFactor() {
    return this.get("emissiveFactor");
  }
  /** Emissive color; Linear-sRGB components. See {@link Material.getEmissiveTexture getEmissiveTexture}. */
  setEmissiveFactor(emissiveFactor) {
    return this.set("emissiveFactor", emissiveFactor);
  }
  /**
   * Emissive texture. Emissive color is added to any base color of the material, after any
   * lighting/shadowing are applied. An emissive color does not inherently "glow", or affect
   * objects around it at all. To create that effect, most viewers must also enable a
   * post-processing effect called "bloom".
   *
   * Reference:
   * - [glTF → material.emissiveTexture](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#materialemissivetexture)
   */
  getEmissiveTexture() {
    return this.getRef("emissiveTexture");
  }
  /**
   * Settings affecting the material's use of its emissive texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getEmissiveTextureInfo() {
    return this.getRef("emissiveTexture") ? this.getRef("emissiveTextureInfo") : null;
  }
  /** Sets emissive texture. See {@link Material.getEmissiveTexture getEmissiveTexture}. */
  setEmissiveTexture(texture) {
    return this.setRef("emissiveTexture", texture, {
      channels: R | G | B,
      isColor: true
    });
  }
  /**********************************************************************************************
   * Normal.
   */
  /** Normal (surface detail) factor; linear multiplier. Affects `.normalTexture`. */
  getNormalScale() {
    return this.get("normalScale");
  }
  /** Normal (surface detail) factor; linear multiplier. Affects `.normalTexture`. */
  setNormalScale(scale) {
    return this.set("normalScale", scale);
  }
  /**
   * Normal (surface detail) texture.
   *
   * A tangent space normal map. The texture contains RGB components. Each texel represents the
   * XYZ components of a normal vector in tangent space. Red [0 to 255] maps to X [-1 to 1].
   * Green [0 to 255] maps to Y [-1 to 1]. Blue [128 to 255] maps to Z [1/255 to 1]. The normal
   * vectors use OpenGL conventions where +X is right and +Y is up. +Z points toward the viewer.
   *
   * Reference:
   * - [glTF → material.normalTexture](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#materialnormaltexture)
   */
  getNormalTexture() {
    return this.getRef("normalTexture");
  }
  /**
   * Settings affecting the material's use of its normal texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getNormalTextureInfo() {
    return this.getRef("normalTexture") ? this.getRef("normalTextureInfo") : null;
  }
  /** Sets normal (surface detail) texture. See {@link Material.getNormalTexture getNormalTexture}. */
  setNormalTexture(texture) {
    return this.setRef("normalTexture", texture, {
      channels: R | G | B
    });
  }
  /**********************************************************************************************
   * Occlusion.
   */
  /** (Ambient) Occlusion factor; linear multiplier. Affects `.occlusionTexture`. */
  getOcclusionStrength() {
    return this.get("occlusionStrength");
  }
  /** Sets (ambient) occlusion factor; linear multiplier. Affects `.occlusionTexture`. */
  setOcclusionStrength(strength) {
    return this.set("occlusionStrength", strength);
  }
  /**
   * (Ambient) Occlusion texture, generally used for subtle 'baked' shadowing effects that are
   * independent of an object's position, such as shading in inset areas and corners. Direct
   * lighting is not affected by occlusion, so at least one indirect light source must be present
   * in the scene for occlusion effects to be visible.
   *
   * The occlusion values are sampled from the R channel. Higher values indicate areas that
   * should receive full indirect lighting and lower values indicate no indirect lighting.
   *
   * Reference:
   * - [glTF → material.occlusionTexture](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#materialocclusiontexture)
   */
  getOcclusionTexture() {
    return this.getRef("occlusionTexture");
  }
  /**
   * Settings affecting the material's use of its occlusion texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getOcclusionTextureInfo() {
    return this.getRef("occlusionTexture") ? this.getRef("occlusionTextureInfo") : null;
  }
  /** Sets (ambient) occlusion texture. See {@link Material.getOcclusionTexture getOcclusionTexture}. */
  setOcclusionTexture(texture) {
    return this.setRef("occlusionTexture", texture, {
      channels: R
    });
  }
  /**********************************************************************************************
   * Metallic / roughness.
   */
  /**
   * Roughness factor; linear multiplier. Affects roughness channel of
   * `metallicRoughnessTexture`. See {@link Material.getMetallicRoughnessTexture getMetallicRoughnessTexture}.
   */
  getRoughnessFactor() {
    return this.get("roughnessFactor");
  }
  /**
   * Sets roughness factor; linear multiplier. Affects roughness channel of
   * `metallicRoughnessTexture`. See {@link Material.getMetallicRoughnessTexture getMetallicRoughnessTexture}.
   */
  setRoughnessFactor(factor) {
    return this.set("roughnessFactor", factor);
  }
  /**
   * Metallic factor; linear multiplier. Affects roughness channel of
   * `metallicRoughnessTexture`. See {@link Material.getMetallicRoughnessTexture getMetallicRoughnessTexture}.
   */
  getMetallicFactor() {
    return this.get("metallicFactor");
  }
  /**
   * Sets metallic factor; linear multiplier. Affects roughness channel of
   * `metallicRoughnessTexture`. See {@link Material.getMetallicRoughnessTexture getMetallicRoughnessTexture}.
   */
  setMetallicFactor(factor) {
    return this.set("metallicFactor", factor);
  }
  /**
   * Metallic roughness texture. The metalness values are sampled from the B channel. The
   * roughness values are sampled from the G channel. When a material is fully metallic,
   * or nearly so, it may require image-based lighting (i.e. an environment map) or global
   * illumination to appear well-lit.
   *
   * Reference:
   * - [glTF → material.pbrMetallicRoughness.metallicRoughnessTexture](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#pbrmetallicroughnessmetallicroughnesstexture)
   */
  getMetallicRoughnessTexture() {
    return this.getRef("metallicRoughnessTexture");
  }
  /**
   * Settings affecting the material's use of its metallic/roughness texture. If no texture is
   * attached, {@link TextureInfo} is `null`.
   */
  getMetallicRoughnessTextureInfo() {
    return this.getRef("metallicRoughnessTexture") ? this.getRef("metallicRoughnessTextureInfo") : null;
  }
  /**
   * Sets metallic/roughness texture.
   * See {@link Material.getMetallicRoughnessTexture getMetallicRoughnessTexture}.
   */
  setMetallicRoughnessTexture(texture) {
    return this.setRef("metallicRoughnessTexture", texture, {
      channels: G | B
    });
  }
};
Material.AlphaMode = {
  /**
   * The alpha value is ignored and the rendered output is fully opaque
   */
  OPAQUE: "OPAQUE",
  /**
   * The rendered output is either fully opaque or fully transparent depending on the alpha
   * value and the specified alpha cutoff value
   */
  MASK: "MASK",
  /**
   * The alpha value is used to composite the source and destination areas. The rendered
   * output is combined with the background using the normal painting operation (i.e. the
   * Porter and Duff over operator)
   */
  BLEND: "BLEND"
};
var Mesh = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.MESH;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      weights: [],
      primitives: new RefSet()
    });
  }
  /** Adds a {@link Primitive} to the mesh's draw call list. */
  addPrimitive(primitive) {
    return this.addRef("primitives", primitive);
  }
  /** Removes a {@link Primitive} from the mesh's draw call list. */
  removePrimitive(primitive) {
    return this.removeRef("primitives", primitive);
  }
  /** Lists {@link Primitive} draw calls of the mesh. */
  listPrimitives() {
    return this.listRefs("primitives");
  }
  /**
   * Initial weights of each {@link PrimitiveTarget} on this mesh. Each {@link Primitive} must
   * have the same number of targets. Most engines only support 4-8 active morph targets at a
   * time.
   */
  getWeights() {
    return this.get("weights");
  }
  /**
   * Initial weights of each {@link PrimitiveTarget} on this mesh. Each {@link Primitive} must
   * have the same number of targets. Most engines only support 4-8 active morph targets at a
   * time.
   */
  setWeights(weights) {
    return this.set("weights", weights);
  }
};
var Node = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.NODE;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
      weights: [],
      camera: null,
      mesh: null,
      skin: null,
      children: new RefSet()
    });
  }
  copy(other, resolve = COPY_IDENTITY) {
    if (resolve === COPY_IDENTITY) throw new Error("Node cannot be copied.");
    return super.copy(other, resolve);
  }
  /**********************************************************************************************
   * Local transform.
   */
  /** Returns the translation (position) of this Node in local space. */
  getTranslation() {
    return this.get("translation");
  }
  /** Returns the rotation (quaternion) of this Node in local space. */
  getRotation() {
    return this.get("rotation");
  }
  /** Returns the scale of this Node in local space. */
  getScale() {
    return this.get("scale");
  }
  /** Sets the translation (position) of this Node in local space. */
  setTranslation(translation) {
    return this.set("translation", translation);
  }
  /** Sets the rotation (quaternion) of this Node in local space. */
  setRotation(rotation) {
    return this.set("rotation", rotation);
  }
  /** Sets the scale of this Node in local space. */
  setScale(scale) {
    return this.set("scale", scale);
  }
  /** Returns the local matrix of this Node. */
  getMatrix() {
    return MathUtils.compose(this.get("translation"), this.get("rotation"), this.get("scale"), []);
  }
  /** Sets the local matrix of this Node. Matrix will be decomposed to TRS properties. */
  setMatrix(matrix) {
    const translation = this.get("translation").slice();
    const rotation = this.get("rotation").slice();
    const scale = this.get("scale").slice();
    MathUtils.decompose(matrix, translation, rotation, scale);
    return this.set("translation", translation).set("rotation", rotation).set("scale", scale);
  }
  /**********************************************************************************************
   * World transform.
   */
  /** Returns the translation (position) of this Node in world space. */
  getWorldTranslation() {
    const t = [0, 0, 0];
    MathUtils.decompose(this.getWorldMatrix(), t, [0, 0, 0, 1], [1, 1, 1]);
    return t;
  }
  /** Returns the rotation (quaternion) of this Node in world space. */
  getWorldRotation() {
    const r = [0, 0, 0, 1];
    MathUtils.decompose(this.getWorldMatrix(), [0, 0, 0], r, [1, 1, 1]);
    return r;
  }
  /** Returns the scale of this Node in world space. */
  getWorldScale() {
    const s = [1, 1, 1];
    MathUtils.decompose(this.getWorldMatrix(), [0, 0, 0], [0, 0, 0, 1], s);
    return s;
  }
  /** Returns the world matrix of this Node. */
  getWorldMatrix() {
    const ancestors = [];
    for (let node = this; node != null; node = node.getParentNode()) {
      ancestors.push(node);
    }
    let ancestor;
    const worldMatrix = ancestors.pop().getMatrix();
    while (ancestor = ancestors.pop()) {
      multiply(worldMatrix, worldMatrix, ancestor.getMatrix());
    }
    return worldMatrix;
  }
  /**********************************************************************************************
   * Scene hierarchy.
   */
  /**
   * Adds the given Node as a child of this Node.
   *
   * Requirements:
   *
   * 1. Nodes MAY be root children of multiple {@link Scene Scenes}
   * 2. Nodes MUST NOT be children of >1 Node
   * 3. Nodes MUST NOT be children of both Nodes and {@link Scene Scenes}
   *
   * The `addChild` method enforces these restrictions automatically, and will
   * remove the new child from previous parents where needed. This behavior
   * may change in future major releases of the library.
   */
  addChild(child) {
    const parentNode = child.getParentNode();
    if (parentNode) parentNode.removeChild(child);
    for (const parent of child.listParents()) {
      if (parent.propertyType === PropertyType.SCENE) {
        parent.removeChild(child);
      }
    }
    return this.addRef("children", child);
  }
  /** Removes a Node from this Node's child Node list. */
  removeChild(child) {
    return this.removeRef("children", child);
  }
  /** Lists all child Nodes of this Node. */
  listChildren() {
    return this.listRefs("children");
  }
  /**
   * Returns the Node's unique parent Node within the scene graph. If the
   * Node has no parents, or is a direct child of the {@link Scene}
   * ("root node"), this method returns null.
   *
   * Unrelated to {@link Property.listParents}, which lists all resource
   * references from properties of any type ({@link Skin}, {@link Root}, ...).
   */
  getParentNode() {
    for (const parent of this.listParents()) {
      if (parent.propertyType === PropertyType.NODE) {
        return parent;
      }
    }
    return null;
  }
  /**********************************************************************************************
   * Attachments.
   */
  /** Returns the {@link Mesh}, if any, instantiated at this Node. */
  getMesh() {
    return this.getRef("mesh");
  }
  /**
   * Sets a {@link Mesh} to be instantiated at this Node. A single mesh may be instatiated by
   * multiple Nodes; reuse of this sort is strongly encouraged.
   */
  setMesh(mesh) {
    return this.setRef("mesh", mesh);
  }
  /** Returns the {@link Camera}, if any, instantiated at this Node. */
  getCamera() {
    return this.getRef("camera");
  }
  /** Sets a {@link Camera} to be instantiated at this Node. */
  setCamera(camera) {
    return this.setRef("camera", camera);
  }
  /** Returns the {@link Skin}, if any, instantiated at this Node. */
  getSkin() {
    return this.getRef("skin");
  }
  /** Sets a {@link Skin} to be instantiated at this Node. */
  setSkin(skin) {
    return this.setRef("skin", skin);
  }
  /**
   * Initial weights of each {@link PrimitiveTarget} for the mesh instance at this Node.
   * Most engines only support 4-8 active morph targets at a time.
   */
  getWeights() {
    return this.get("weights");
  }
  /**
   * Initial weights of each {@link PrimitiveTarget} for the mesh instance at this Node.
   * Most engines only support 4-8 active morph targets at a time.
   */
  setWeights(weights) {
    return this.set("weights", weights);
  }
  /**********************************************************************************************
   * Helpers.
   */
  /** Visits this {@link Node} and its descendants, top-down. */
  traverse(fn) {
    fn(this);
    for (const child of this.listChildren()) child.traverse(fn);
    return this;
  }
};
var Primitive = class _Primitive extends ExtensibleProperty {
  /**********************************************************************************************
   * Instance.
   */
  init() {
    this.propertyType = PropertyType.PRIMITIVE;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      mode: _Primitive.Mode.TRIANGLES,
      material: null,
      indices: null,
      attributes: new RefMap(),
      targets: new RefSet()
    });
  }
  /**********************************************************************************************
   * Primitive data.
   */
  /** Returns an {@link Accessor} with indices of vertices to be drawn. */
  getIndices() {
    return this.getRef("indices");
  }
  /**
   * Sets an {@link Accessor} with indices of vertices to be drawn. In `TRIANGLES` draw mode,
   * each set of three indices define a triangle. The front face has a counter-clockwise (CCW)
   * winding order.
   */
  setIndices(indices) {
    return this.setRef("indices", indices, {
      usage: BufferViewUsage$1.ELEMENT_ARRAY_BUFFER
    });
  }
  /** Returns a vertex attribute as an {@link Accessor}. */
  getAttribute(semantic) {
    return this.getRefMap("attributes", semantic);
  }
  /**
   * Sets a vertex attribute to an {@link Accessor}. All attributes must have the same vertex
   * count.
   */
  setAttribute(semantic, accessor) {
    return this.setRefMap("attributes", semantic, accessor, {
      usage: BufferViewUsage$1.ARRAY_BUFFER
    });
  }
  /**
   * Lists all vertex attribute {@link Accessor}s associated with the primitive, excluding any
   * attributes used for morph targets. For example, `[positionAccessor, normalAccessor,
   * uvAccessor]`. Order will be consistent with the order returned by {@link .listSemantics}().
   */
  listAttributes() {
    return this.listRefMapValues("attributes");
  }
  /**
   * Lists all vertex attribute semantics associated with the primitive, excluding any semantics
   * used for morph targets. For example, `['POSITION', 'NORMAL', 'TEXCOORD_0']`. Order will be
   * consistent with the order returned by {@link .listAttributes}().
   */
  listSemantics() {
    return this.listRefMapKeys("attributes");
  }
  /** Returns the material used to render the primitive. */
  getMaterial() {
    return this.getRef("material");
  }
  /** Sets the material used to render the primitive. */
  setMaterial(material) {
    return this.setRef("material", material);
  }
  /**********************************************************************************************
   * Mode.
   */
  /**
   * Returns the GPU draw mode (`TRIANGLES`, `LINES`, `POINTS`...) as a WebGL enum value.
   *
   * Reference:
   * - [glTF → `primitive.mode`](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#primitivemode)
   */
  getMode() {
    return this.get("mode");
  }
  /**
   * Sets the GPU draw mode (`TRIANGLES`, `LINES`, `POINTS`...) as a WebGL enum value.
   *
   * Reference:
   * - [glTF → `primitive.mode`](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#primitivemode)
   */
  setMode(mode) {
    return this.set("mode", mode);
  }
  /**********************************************************************************************
   * Morph targets.
   */
  /** Lists all morph targets associated with the primitive. */
  listTargets() {
    return this.listRefs("targets");
  }
  /**
   * Adds a morph target to the primitive. All primitives in the same mesh must have the same
   * number of targets.
   */
  addTarget(target) {
    return this.addRef("targets", target);
  }
  /**
   * Removes a morph target from the primitive. All primitives in the same mesh must have the same
   * number of targets.
   */
  removeTarget(target) {
    return this.removeRef("targets", target);
  }
};
Primitive.Mode = {
  /** Draw single points. */
  POINTS: 0,
  /** Draw lines. Each vertex connects to the one after it. */
  LINES: 1,
  /**
   * Draw lines. Each set of two vertices is treated as a separate line segment.
   * @deprecated See {@link https://github.com/KhronosGroup/glTF/issues/1883 KhronosGroup/glTF#1883}.
   */
  LINE_LOOP: 2,
  /** Draw a connected group of line segments from the first vertex to the last,  */
  LINE_STRIP: 3,
  /** Draw triangles. Each set of three vertices creates a separate triangle. */
  TRIANGLES: 4,
  /** Draw a connected strip of triangles. */
  TRIANGLE_STRIP: 5,
  /**
   * Draw a connected group of triangles. Each vertex connects to the previous and the first
   * vertex in the fan.
   * @deprecated See {@link https://github.com/KhronosGroup/glTF/issues/1883 KhronosGroup/glTF#1883}.
   */
  TRIANGLE_FAN: 6
};
var PrimitiveTarget = class extends Property {
  init() {
    this.propertyType = PropertyType.PRIMITIVE_TARGET;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      attributes: new RefMap()
    });
  }
  /** Returns a morph target vertex attribute as an {@link Accessor}. */
  getAttribute(semantic) {
    return this.getRefMap("attributes", semantic);
  }
  /**
   * Sets a morph target vertex attribute to an {@link Accessor}.
   */
  setAttribute(semantic, accessor) {
    return this.setRefMap("attributes", semantic, accessor, {
      usage: BufferViewUsage$1.ARRAY_BUFFER
    });
  }
  /**
   * Lists all morph target vertex attribute {@link Accessor}s associated. Order will be
   * consistent with the order returned by {@link .listSemantics}().
   */
  listAttributes() {
    return this.listRefMapValues("attributes");
  }
  /**
   * Lists all morph target vertex attribute semantics associated. Order will be
   * consistent with the order returned by {@link .listAttributes}().
   */
  listSemantics() {
    return this.listRefMapKeys("attributes");
  }
};
function _extends2() {
  _extends2 = Object.assign ? Object.assign.bind() : function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends2.apply(this, arguments);
}
var Scene = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.SCENE;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      children: new RefSet()
    });
  }
  copy(other, resolve = COPY_IDENTITY) {
    if (resolve === COPY_IDENTITY) throw new Error("Scene cannot be copied.");
    return super.copy(other, resolve);
  }
  /**
   * Adds a {@link Node} to the Scene.
   *
   * Requirements:
   *
   * 1. Nodes MAY be root children of multiple {@link Scene Scenes}
   * 2. Nodes MUST NOT be children of >1 Node
   * 3. Nodes MUST NOT be children of both Nodes and {@link Scene Scenes}
   *
   * The `addChild` method enforces these restrictions automatically, and will
   * remove the new child from previous parents where needed. This behavior
   * may change in future major releases of the library.
   */
  addChild(node) {
    const parentNode = node.getParentNode();
    if (parentNode) parentNode.removeChild(node);
    return this.addRef("children", node);
  }
  /** Removes a {@link Node} from the Scene. */
  removeChild(node) {
    return this.removeRef("children", node);
  }
  /**
   * Lists all direct child {@link Node Nodes} in the Scene. Indirect
   * descendants (children of children) are not returned, but may be
   * reached recursively or with {@link Scene.traverse} instead.
   */
  listChildren() {
    return this.listRefs("children");
  }
  /** Visits each {@link Node} in the Scene, including descendants, top-down. */
  traverse(fn) {
    for (const node of this.listChildren()) node.traverse(fn);
    return this;
  }
};
var Skin = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.SKIN;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      skeleton: null,
      inverseBindMatrices: null,
      joints: new RefSet()
    });
  }
  /**
   * {@link Node} used as a skeleton root. The node must be the closest common root of the joints
   * hierarchy or a direct or indirect parent node of the closest common root.
   */
  getSkeleton() {
    return this.getRef("skeleton");
  }
  /**
   * {@link Node} used as a skeleton root. The node must be the closest common root of the joints
   * hierarchy or a direct or indirect parent node of the closest common root.
   */
  setSkeleton(skeleton) {
    return this.setRef("skeleton", skeleton);
  }
  /**
   * {@link Accessor} containing the floating-point 4x4 inverse-bind matrices. The default is
   * that each matrix is a 4x4 identity matrix, which implies that inverse-bind matrices were
   * pre-applied.
   */
  getInverseBindMatrices() {
    return this.getRef("inverseBindMatrices");
  }
  /**
   * {@link Accessor} containing the floating-point 4x4 inverse-bind matrices. The default is
   * that each matrix is a 4x4 identity matrix, which implies that inverse-bind matrices were
   * pre-applied.
   */
  setInverseBindMatrices(inverseBindMatrices) {
    return this.setRef("inverseBindMatrices", inverseBindMatrices, {
      usage: BufferViewUsage$1.INVERSE_BIND_MATRICES
    });
  }
  /** Adds a joint {@link Node} to this {@link Skin}. */
  addJoint(joint) {
    return this.addRef("joints", joint);
  }
  /** Removes a joint {@link Node} from this {@link Skin}. */
  removeJoint(joint) {
    return this.removeRef("joints", joint);
  }
  /** Lists joints ({@link Node}s used as joints or bones) in this {@link Skin}. */
  listJoints() {
    return this.listRefs("joints");
  }
};
var Texture = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.TEXTURE;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      image: null,
      mimeType: "",
      uri: ""
    });
  }
  /**********************************************************************************************
   * MIME type / format.
   */
  /** Returns the MIME type for this texture ('image/jpeg' or 'image/png'). */
  getMimeType() {
    return this.get("mimeType") || ImageUtils.extensionToMimeType(FileUtils.extension(this.get("uri")));
  }
  /**
   * Sets the MIME type for this texture ('image/jpeg' or 'image/png'). If the texture does not
   * have a URI, a MIME type is required for correct export.
   */
  setMimeType(mimeType) {
    return this.set("mimeType", mimeType);
  }
  /**********************************************************************************************
   * URI / filename.
   */
  /** Returns the URI (e.g. 'path/to/file.png') for this texture. */
  getURI() {
    return this.get("uri");
  }
  /**
   * Sets the URI (e.g. 'path/to/file.png') for this texture. If the texture does not have a MIME
   * type, a URI is required for correct export.
   */
  setURI(uri) {
    this.set("uri", uri);
    const mimeType = ImageUtils.extensionToMimeType(FileUtils.extension(uri));
    if (mimeType) this.set("mimeType", mimeType);
    return this;
  }
  /**********************************************************************************************
   * Image data.
   */
  /** Returns the raw image data for this texture. */
  getImage() {
    return this.get("image");
  }
  /** Sets the raw image data for this texture. */
  setImage(image) {
    return this.set("image", BufferUtils.assertView(image));
  }
  /** Returns the size, in pixels, of this texture. */
  getSize() {
    const image = this.get("image");
    if (!image) return null;
    return ImageUtils.getSize(image, this.getMimeType());
  }
};
var Root = class extends ExtensibleProperty {
  init() {
    this.propertyType = PropertyType.ROOT;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      asset: {
        generator: `glTF-Transform ${VERSION}`,
        version: "2.0"
      },
      defaultScene: null,
      accessors: new RefSet(),
      animations: new RefSet(),
      buffers: new RefSet(),
      cameras: new RefSet(),
      materials: new RefSet(),
      meshes: new RefSet(),
      nodes: new RefSet(),
      scenes: new RefSet(),
      skins: new RefSet(),
      textures: new RefSet()
    });
  }
  /** @internal */
  constructor(graph) {
    super(graph);
    this._extensions = /* @__PURE__ */ new Set();
    graph.addEventListener("node:create", (event) => {
      this._addChildOfRoot(event.target);
    });
  }
  clone() {
    throw new Error("Root cannot be cloned.");
  }
  copy(other, resolve = COPY_IDENTITY) {
    if (resolve === COPY_IDENTITY) throw new Error("Root cannot be copied.");
    this.set("asset", _extends2({}, other.get("asset")));
    this.setName(other.getName());
    this.setExtras(_extends2({}, other.getExtras()));
    this.setDefaultScene(other.getDefaultScene() ? resolve(other.getDefaultScene()) : null);
    for (const extensionName of other.listRefMapKeys("extensions")) {
      const otherExtension = other.getExtension(extensionName);
      this.setExtension(extensionName, resolve(otherExtension));
    }
    return this;
  }
  _addChildOfRoot(child) {
    if (child instanceof Scene) {
      this.addRef("scenes", child);
    } else if (child instanceof Node) {
      this.addRef("nodes", child);
    } else if (child instanceof Camera) {
      this.addRef("cameras", child);
    } else if (child instanceof Skin) {
      this.addRef("skins", child);
    } else if (child instanceof Mesh) {
      this.addRef("meshes", child);
    } else if (child instanceof Material) {
      this.addRef("materials", child);
    } else if (child instanceof Texture) {
      this.addRef("textures", child);
    } else if (child instanceof Animation) {
      this.addRef("animations", child);
    } else if (child instanceof Accessor) {
      this.addRef("accessors", child);
    } else if (child instanceof Buffer$1) {
      this.addRef("buffers", child);
    }
    return this;
  }
  /**
   * Returns the `asset` object, which specifies the target glTF version of the asset. Additional
   * metadata can be stored in optional properties such as `generator` or `copyright`.
   *
   * Reference: [glTF → Asset](https://github.com/KhronosGroup/gltf/blob/main/specification/2.0/README.md#asset)
   */
  getAsset() {
    return this.get("asset");
  }
  /**********************************************************************************************
   * Extensions.
   */
  /** Lists all {@link Extension Extensions} enabled for this root. */
  listExtensionsUsed() {
    return Array.from(this._extensions);
  }
  /** Lists all {@link Extension Extensions} enabled and required for this root. */
  listExtensionsRequired() {
    return this.listExtensionsUsed().filter((extension) => extension.isRequired());
  }
  /** @internal */
  _enableExtension(extension) {
    this._extensions.add(extension);
    return this;
  }
  /** @internal */
  _disableExtension(extension) {
    this._extensions.delete(extension);
    return this;
  }
  /**********************************************************************************************
   * Properties.
   */
  /** Lists all {@link Scene} properties associated with this root. */
  listScenes() {
    return this.listRefs("scenes");
  }
  /** Default {@link Scene} associated with this root. */
  setDefaultScene(defaultScene) {
    return this.setRef("defaultScene", defaultScene);
  }
  /** Default {@link Scene} associated with this root. */
  getDefaultScene() {
    return this.getRef("defaultScene");
  }
  /** Lists all {@link Node} properties associated with this root. */
  listNodes() {
    return this.listRefs("nodes");
  }
  /** Lists all {@link Camera} properties associated with this root. */
  listCameras() {
    return this.listRefs("cameras");
  }
  /** Lists all {@link Skin} properties associated with this root. */
  listSkins() {
    return this.listRefs("skins");
  }
  /** Lists all {@link Mesh} properties associated with this root. */
  listMeshes() {
    return this.listRefs("meshes");
  }
  /** Lists all {@link Material} properties associated with this root. */
  listMaterials() {
    return this.listRefs("materials");
  }
  /** Lists all {@link Texture} properties associated with this root. */
  listTextures() {
    return this.listRefs("textures");
  }
  /** Lists all {@link Animation} properties associated with this root. */
  listAnimations() {
    return this.listRefs("animations");
  }
  /** Lists all {@link Accessor} properties associated with this root. */
  listAccessors() {
    return this.listRefs("accessors");
  }
  /** Lists all {@link Buffer} properties associated with this root. */
  listBuffers() {
    return this.listRefs("buffers");
  }
};
var Document = class _Document {
  /**
   * Returns the Document associated with a given Graph, if any.
   * @hidden
   * @experimental
   */
  static fromGraph(graph) {
    return _Document._GRAPH_DOCUMENTS.get(graph) || null;
  }
  /** Creates a new Document, representing an empty glTF asset. */
  constructor() {
    this._graph = new Graph();
    this._root = new Root(this._graph);
    this._logger = Logger.DEFAULT_INSTANCE;
    _Document._GRAPH_DOCUMENTS.set(this._graph, this);
  }
  /** Returns the glTF {@link Root} property. */
  getRoot() {
    return this._root;
  }
  /**
   * Returns the {@link Graph} representing connectivity of resources within this document.
   * @hidden
   */
  getGraph() {
    return this._graph;
  }
  /** Returns the {@link Logger} instance used for any operations performed on this document. */
  getLogger() {
    return this._logger;
  }
  /**
   * Overrides the {@link Logger} instance used for any operations performed on this document.
   *
   * Usage:
   *
   * ```ts
   * doc
   * 	.setLogger(new Logger(Logger.Verbosity.SILENT))
   * 	.transform(dedup(), weld());
   * ```
   */
  setLogger(logger) {
    this._logger = logger;
    return this;
  }
  /**
   * Clones this Document, copying all resources within it.
   * @deprecated Use 'cloneDocument(document)' from '@gltf-transform/functions'.
   * @hidden
   * @internal
   */
  clone() {
    throw new Error(`Use 'cloneDocument(source)' from '@gltf-transform/functions'.`);
  }
  /**
   * Merges the content of another Document into this one, without affecting the original.
   * @deprecated Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.
   * @hidden
   * @internal
   */
  merge(_other) {
    throw new Error(`Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.`);
  }
  /**
   * Applies a series of modifications to this document. Each transformation is asynchronous,
   * takes the {@link Document} as input, and returns nothing. Transforms are applied in the
   * order given, which may affect the final result.
   *
   * Usage:
   *
   * ```ts
   * await doc.transform(
   * 	dedup(),
   * 	prune()
   * );
   * ```
   *
   * @param transforms List of synchronous transformation functions to apply.
   */
  async transform(...transforms) {
    const stack = transforms.map((fn) => fn.name);
    for (const transform of transforms) {
      await transform(this, {
        stack
      });
    }
    return this;
  }
  /**********************************************************************************************
   * Extension factory method.
   */
  /**
   * Creates a new {@link Extension}, for the extension type of the given constructor. If the
   * extension is already enabled for this Document, the previous Extension reference is reused.
   */
  createExtension(ctor) {
    const extensionName = ctor.EXTENSION_NAME;
    const prevExtension = this.getRoot().listExtensionsUsed().find((ext) => ext.extensionName === extensionName);
    return prevExtension || new ctor(this);
  }
  /**********************************************************************************************
   * Property factory methods.
   */
  /** Creates a new {@link Scene} attached to this document's {@link Root}. */
  createScene(name = "") {
    return new Scene(this._graph, name);
  }
  /** Creates a new {@link Node} attached to this document's {@link Root}. */
  createNode(name = "") {
    return new Node(this._graph, name);
  }
  /** Creates a new {@link Camera} attached to this document's {@link Root}. */
  createCamera(name = "") {
    return new Camera(this._graph, name);
  }
  /** Creates a new {@link Skin} attached to this document's {@link Root}. */
  createSkin(name = "") {
    return new Skin(this._graph, name);
  }
  /** Creates a new {@link Mesh} attached to this document's {@link Root}. */
  createMesh(name = "") {
    return new Mesh(this._graph, name);
  }
  /**
   * Creates a new {@link Primitive}. Primitives must be attached to a {@link Mesh}
   * for use and export; they are not otherwise associated with a {@link Root}.
   */
  createPrimitive() {
    return new Primitive(this._graph);
  }
  /**
   * Creates a new {@link PrimitiveTarget}, or morph target. Targets must be attached to a
   * {@link Primitive} for use and export; they are not otherwise associated with a {@link Root}.
   */
  createPrimitiveTarget(name = "") {
    return new PrimitiveTarget(this._graph, name);
  }
  /** Creates a new {@link Material} attached to this document's {@link Root}. */
  createMaterial(name = "") {
    return new Material(this._graph, name);
  }
  /** Creates a new {@link Texture} attached to this document's {@link Root}. */
  createTexture(name = "") {
    return new Texture(this._graph, name);
  }
  /** Creates a new {@link Animation} attached to this document's {@link Root}. */
  createAnimation(name = "") {
    return new Animation(this._graph, name);
  }
  /**
   * Creates a new {@link AnimationChannel}. Channels must be attached to an {@link Animation}
   * for use and export; they are not otherwise associated with a {@link Root}.
   */
  createAnimationChannel(name = "") {
    return new AnimationChannel(this._graph, name);
  }
  /**
   * Creates a new {@link AnimationSampler}. Samplers must be attached to an {@link Animation}
   * for use and export; they are not otherwise associated with a {@link Root}.
   */
  createAnimationSampler(name = "") {
    return new AnimationSampler(this._graph, name);
  }
  /** Creates a new {@link Accessor} attached to this document's {@link Root}. */
  createAccessor(name = "", buffer = null) {
    if (!buffer) {
      buffer = this.getRoot().listBuffers()[0];
    }
    return new Accessor(this._graph, name).setBuffer(buffer);
  }
  /** Creates a new {@link Buffer} attached to this document's {@link Root}. */
  createBuffer(name = "") {
    return new Buffer$1(this._graph, name);
  }
};
Document._GRAPH_DOCUMENTS = /* @__PURE__ */ new WeakMap();
var Extension = class {
  /** @hidden */
  constructor(document) {
    this.extensionName = "";
    this.prereadTypes = [];
    this.prewriteTypes = [];
    this.readDependencies = [];
    this.writeDependencies = [];
    this.document = void 0;
    this.required = false;
    this.properties = /* @__PURE__ */ new Set();
    this._listener = void 0;
    this.document = document;
    document.getRoot()._enableExtension(this);
    this._listener = (_event) => {
      const event = _event;
      const target = event.target;
      if (target instanceof ExtensionProperty && target.extensionName === this.extensionName) {
        if (event.type === "node:create") this._addExtensionProperty(target);
        if (event.type === "node:dispose") this._removeExtensionProperty(target);
      }
    };
    const graph = document.getGraph();
    graph.addEventListener("node:create", this._listener);
    graph.addEventListener("node:dispose", this._listener);
  }
  /** Disables and removes the extension from the Document. */
  dispose() {
    this.document.getRoot()._disableExtension(this);
    const graph = this.document.getGraph();
    graph.removeEventListener("node:create", this._listener);
    graph.removeEventListener("node:dispose", this._listener);
    for (const property of this.properties) {
      property.dispose();
    }
  }
  /** @hidden Performs first-time setup for the extension. Must be idempotent. */
  static register() {
  }
  /**
   * Indicates to the client whether it is OK to load the asset when this extension is not
   * recognized. Optional extensions are generally preferred, if there is not a good reason
   * to require a client to completely fail when an extension isn't known.
   */
  isRequired() {
    return this.required;
  }
  /**
   * Indicates to the client whether it is OK to load the asset when this extension is not
   * recognized. Optional extensions are generally preferred, if there is not a good reason
   * to require a client to completely fail when an extension isn't known.
   */
  setRequired(required) {
    this.required = required;
    return this;
  }
  /**
   * Lists all {@link ExtensionProperty} instances associated with, or created by, this
   * extension. Includes only instances that are attached to the Document's graph; detached
   * instances will be excluded.
   */
  listProperties() {
    return Array.from(this.properties);
  }
  /**********************************************************************************************
   * ExtensionProperty management.
   */
  /** @internal */
  _addExtensionProperty(property) {
    this.properties.add(property);
    return this;
  }
  /** @internal */
  _removeExtensionProperty(property) {
    this.properties.delete(property);
    return this;
  }
  /**********************************************************************************************
   * I/O implementation.
   */
  /** @hidden Installs dependencies required by the extension. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  install(key, dependency) {
    return this;
  }
  /**
   * Used by the {@link PlatformIO} utilities when reading a glTF asset. This method may
   * optionally be implemented by an extension, and should then support any property type
   * declared by the Extension's {@link Extension.prereadTypes} list. The Extension will
   * be given a ReaderContext instance, and is expected to update either the context or its
   * {@link JSONDocument} with resources known to the Extension. *Most extensions don't need to
   * implement this.*
   * @hidden
   */
  preread(_readerContext, _propertyType) {
    return this;
  }
  /**
   * Used by the {@link PlatformIO} utilities when writing a glTF asset. This method may
   * optionally be implemented by an extension, and should then support any property type
   * declared by the Extension's {@link Extension.prewriteTypes} list. The Extension will
   * be given a WriterContext instance, and is expected to update either the context or its
   * {@link JSONDocument} with resources known to the Extension. *Most extensions don't need to
   * implement this.*
   * @hidden
   */
  prewrite(_writerContext, _propertyType) {
    return this;
  }
};
Extension.EXTENSION_NAME = void 0;
var ReaderContext = class {
  constructor(jsonDoc) {
    this.jsonDoc = void 0;
    this.buffers = [];
    this.bufferViews = [];
    this.bufferViewBuffers = [];
    this.accessors = [];
    this.textures = [];
    this.textureInfos = /* @__PURE__ */ new Map();
    this.materials = [];
    this.meshes = [];
    this.cameras = [];
    this.nodes = [];
    this.skins = [];
    this.animations = [];
    this.scenes = [];
    this.jsonDoc = jsonDoc;
  }
  setTextureInfo(textureInfo, textureInfoDef) {
    this.textureInfos.set(textureInfo, textureInfoDef);
    if (textureInfoDef.texCoord !== void 0) {
      textureInfo.setTexCoord(textureInfoDef.texCoord);
    }
    if (textureInfoDef.extras !== void 0) {
      textureInfo.setExtras(textureInfoDef.extras);
    }
    const textureDef = this.jsonDoc.json.textures[textureInfoDef.index];
    if (textureDef.sampler === void 0) return;
    const samplerDef = this.jsonDoc.json.samplers[textureDef.sampler];
    if (samplerDef.magFilter !== void 0) {
      textureInfo.setMagFilter(samplerDef.magFilter);
    }
    if (samplerDef.minFilter !== void 0) {
      textureInfo.setMinFilter(samplerDef.minFilter);
    }
    if (samplerDef.wrapS !== void 0) {
      textureInfo.setWrapS(samplerDef.wrapS);
    }
    if (samplerDef.wrapT !== void 0) {
      textureInfo.setWrapT(samplerDef.wrapT);
    }
  }
};
var DEFAULT_OPTIONS = {
  logger: Logger.DEFAULT_INSTANCE,
  extensions: [],
  dependencies: {}
};
var GLTFReader = class {
  static read(jsonDoc, _options = DEFAULT_OPTIONS) {
    const options = _extends2({}, DEFAULT_OPTIONS, _options);
    const {
      json
    } = jsonDoc;
    const document = new Document().setLogger(options.logger);
    this.validate(jsonDoc, options);
    const context = new ReaderContext(jsonDoc);
    const assetDef = json.asset;
    const asset = document.getRoot().getAsset();
    if (assetDef.copyright) asset.copyright = assetDef.copyright;
    if (assetDef.extras) asset.extras = assetDef.extras;
    if (json.extras !== void 0) {
      document.getRoot().setExtras(_extends2({}, json.extras));
    }
    const extensionsUsed = json.extensionsUsed || [];
    const extensionsRequired = json.extensionsRequired || [];
    options.extensions.sort((a, b) => a.EXTENSION_NAME > b.EXTENSION_NAME ? 1 : -1);
    for (const Extension2 of options.extensions) {
      if (extensionsUsed.includes(Extension2.EXTENSION_NAME)) {
        const extension = document.createExtension(Extension2).setRequired(extensionsRequired.includes(Extension2.EXTENSION_NAME));
        for (const key of extension.readDependencies) {
          extension.install(key, options.dependencies[key]);
        }
      }
    }
    const bufferDefs = json.buffers || [];
    document.getRoot().listExtensionsUsed().filter((extension) => extension.prereadTypes.includes(PropertyType.BUFFER)).forEach((extension) => extension.preread(context, PropertyType.BUFFER));
    context.buffers = bufferDefs.map((bufferDef) => {
      const buffer = document.createBuffer(bufferDef.name);
      if (bufferDef.extras) buffer.setExtras(bufferDef.extras);
      if (bufferDef.uri && bufferDef.uri.indexOf("__") !== 0) {
        buffer.setURI(bufferDef.uri);
      }
      return buffer;
    });
    const bufferViewDefs = json.bufferViews || [];
    context.bufferViewBuffers = bufferViewDefs.map((bufferViewDef, index) => {
      if (!context.bufferViews[index]) {
        const bufferDef = jsonDoc.json.buffers[bufferViewDef.buffer];
        const resource = bufferDef.uri ? jsonDoc.resources[bufferDef.uri] : jsonDoc.resources[GLB_BUFFER];
        const byteOffset = bufferViewDef.byteOffset || 0;
        context.bufferViews[index] = BufferUtils.toView(resource, byteOffset, bufferViewDef.byteLength);
      }
      return context.buffers[bufferViewDef.buffer];
    });
    const accessorDefs = json.accessors || [];
    context.accessors = accessorDefs.map((accessorDef) => {
      const buffer = context.bufferViewBuffers[accessorDef.bufferView];
      const accessor = document.createAccessor(accessorDef.name, buffer).setType(accessorDef.type);
      if (accessorDef.extras) accessor.setExtras(accessorDef.extras);
      if (accessorDef.normalized !== void 0) {
        accessor.setNormalized(accessorDef.normalized);
      }
      if (accessorDef.bufferView === void 0) return accessor;
      accessor.setArray(getAccessorArray(accessorDef, context));
      return accessor;
    });
    const imageDefs = json.images || [];
    const textureDefs = json.textures || [];
    document.getRoot().listExtensionsUsed().filter((extension) => extension.prereadTypes.includes(PropertyType.TEXTURE)).forEach((extension) => extension.preread(context, PropertyType.TEXTURE));
    context.textures = imageDefs.map((imageDef) => {
      const texture = document.createTexture(imageDef.name);
      if (imageDef.extras) texture.setExtras(imageDef.extras);
      if (imageDef.bufferView !== void 0) {
        const bufferViewDef = json.bufferViews[imageDef.bufferView];
        const bufferDef = jsonDoc.json.buffers[bufferViewDef.buffer];
        const bufferData = bufferDef.uri ? jsonDoc.resources[bufferDef.uri] : jsonDoc.resources[GLB_BUFFER];
        const byteOffset = bufferViewDef.byteOffset || 0;
        const byteLength = bufferViewDef.byteLength;
        const imageData = bufferData.slice(byteOffset, byteOffset + byteLength);
        texture.setImage(imageData);
      } else if (imageDef.uri !== void 0) {
        texture.setImage(jsonDoc.resources[imageDef.uri]);
        if (imageDef.uri.indexOf("__") !== 0) {
          texture.setURI(imageDef.uri);
        }
      }
      if (imageDef.mimeType !== void 0) {
        texture.setMimeType(imageDef.mimeType);
      } else if (imageDef.uri) {
        const extension = FileUtils.extension(imageDef.uri);
        texture.setMimeType(ImageUtils.extensionToMimeType(extension));
      }
      return texture;
    });
    document.getRoot().listExtensionsUsed().filter((extension) => extension.prereadTypes.includes(PropertyType.MATERIAL)).forEach((extension) => extension.preread(context, PropertyType.MATERIAL));
    const materialDefs = json.materials || [];
    context.materials = materialDefs.map((materialDef) => {
      const material = document.createMaterial(materialDef.name);
      if (materialDef.extras) material.setExtras(materialDef.extras);
      if (materialDef.alphaMode !== void 0) {
        material.setAlphaMode(materialDef.alphaMode);
      }
      if (materialDef.alphaCutoff !== void 0) {
        material.setAlphaCutoff(materialDef.alphaCutoff);
      }
      if (materialDef.doubleSided !== void 0) {
        material.setDoubleSided(materialDef.doubleSided);
      }
      const pbrDef = materialDef.pbrMetallicRoughness || {};
      if (pbrDef.baseColorFactor !== void 0) {
        material.setBaseColorFactor(pbrDef.baseColorFactor);
      }
      if (materialDef.emissiveFactor !== void 0) {
        material.setEmissiveFactor(materialDef.emissiveFactor);
      }
      if (pbrDef.metallicFactor !== void 0) {
        material.setMetallicFactor(pbrDef.metallicFactor);
      }
      if (pbrDef.roughnessFactor !== void 0) {
        material.setRoughnessFactor(pbrDef.roughnessFactor);
      }
      if (pbrDef.baseColorTexture !== void 0) {
        const textureInfoDef = pbrDef.baseColorTexture;
        const texture = context.textures[textureDefs[textureInfoDef.index].source];
        material.setBaseColorTexture(texture);
        context.setTextureInfo(material.getBaseColorTextureInfo(), textureInfoDef);
      }
      if (materialDef.emissiveTexture !== void 0) {
        const textureInfoDef = materialDef.emissiveTexture;
        const texture = context.textures[textureDefs[textureInfoDef.index].source];
        material.setEmissiveTexture(texture);
        context.setTextureInfo(material.getEmissiveTextureInfo(), textureInfoDef);
      }
      if (materialDef.normalTexture !== void 0) {
        const textureInfoDef = materialDef.normalTexture;
        const texture = context.textures[textureDefs[textureInfoDef.index].source];
        material.setNormalTexture(texture);
        context.setTextureInfo(material.getNormalTextureInfo(), textureInfoDef);
        if (materialDef.normalTexture.scale !== void 0) {
          material.setNormalScale(materialDef.normalTexture.scale);
        }
      }
      if (materialDef.occlusionTexture !== void 0) {
        const textureInfoDef = materialDef.occlusionTexture;
        const texture = context.textures[textureDefs[textureInfoDef.index].source];
        material.setOcclusionTexture(texture);
        context.setTextureInfo(material.getOcclusionTextureInfo(), textureInfoDef);
        if (materialDef.occlusionTexture.strength !== void 0) {
          material.setOcclusionStrength(materialDef.occlusionTexture.strength);
        }
      }
      if (pbrDef.metallicRoughnessTexture !== void 0) {
        const textureInfoDef = pbrDef.metallicRoughnessTexture;
        const texture = context.textures[textureDefs[textureInfoDef.index].source];
        material.setMetallicRoughnessTexture(texture);
        context.setTextureInfo(material.getMetallicRoughnessTextureInfo(), textureInfoDef);
      }
      return material;
    });
    document.getRoot().listExtensionsUsed().filter((extension) => extension.prereadTypes.includes(PropertyType.MESH)).forEach((extension) => extension.preread(context, PropertyType.MESH));
    const meshDefs = json.meshes || [];
    document.getRoot().listExtensionsUsed().filter((extension) => extension.prereadTypes.includes(PropertyType.PRIMITIVE)).forEach((extension) => extension.preread(context, PropertyType.PRIMITIVE));
    context.meshes = meshDefs.map((meshDef) => {
      const mesh = document.createMesh(meshDef.name);
      if (meshDef.extras) mesh.setExtras(meshDef.extras);
      if (meshDef.weights !== void 0) {
        mesh.setWeights(meshDef.weights);
      }
      const primitiveDefs = meshDef.primitives || [];
      primitiveDefs.forEach((primitiveDef) => {
        const primitive = document.createPrimitive();
        if (primitiveDef.extras) primitive.setExtras(primitiveDef.extras);
        if (primitiveDef.material !== void 0) {
          primitive.setMaterial(context.materials[primitiveDef.material]);
        }
        if (primitiveDef.mode !== void 0) {
          primitive.setMode(primitiveDef.mode);
        }
        for (const [semantic, index] of Object.entries(primitiveDef.attributes || {})) {
          primitive.setAttribute(semantic, context.accessors[index]);
        }
        if (primitiveDef.indices !== void 0) {
          primitive.setIndices(context.accessors[primitiveDef.indices]);
        }
        const targetNames = meshDef.extras && meshDef.extras.targetNames || [];
        const targetDefs = primitiveDef.targets || [];
        targetDefs.forEach((targetDef, targetIndex) => {
          const targetName = targetNames[targetIndex] || targetIndex.toString();
          const target = document.createPrimitiveTarget(targetName);
          for (const [semantic, accessorIndex] of Object.entries(targetDef)) {
            target.setAttribute(semantic, context.accessors[accessorIndex]);
          }
          primitive.addTarget(target);
        });
        mesh.addPrimitive(primitive);
      });
      return mesh;
    });
    const cameraDefs = json.cameras || [];
    context.cameras = cameraDefs.map((cameraDef) => {
      const camera = document.createCamera(cameraDef.name).setType(cameraDef.type);
      if (cameraDef.extras) camera.setExtras(cameraDef.extras);
      if (cameraDef.type === Camera.Type.PERSPECTIVE) {
        const perspectiveDef = cameraDef.perspective;
        camera.setYFov(perspectiveDef.yfov);
        camera.setZNear(perspectiveDef.znear);
        if (perspectiveDef.zfar !== void 0) {
          camera.setZFar(perspectiveDef.zfar);
        }
        if (perspectiveDef.aspectRatio !== void 0) {
          camera.setAspectRatio(perspectiveDef.aspectRatio);
        }
      } else {
        const orthoDef = cameraDef.orthographic;
        camera.setZNear(orthoDef.znear).setZFar(orthoDef.zfar).setXMag(orthoDef.xmag).setYMag(orthoDef.ymag);
      }
      return camera;
    });
    const nodeDefs = json.nodes || [];
    document.getRoot().listExtensionsUsed().filter((extension) => extension.prereadTypes.includes(PropertyType.NODE)).forEach((extension) => extension.preread(context, PropertyType.NODE));
    context.nodes = nodeDefs.map((nodeDef) => {
      const node = document.createNode(nodeDef.name);
      if (nodeDef.extras) node.setExtras(nodeDef.extras);
      if (nodeDef.translation !== void 0) {
        node.setTranslation(nodeDef.translation);
      }
      if (nodeDef.rotation !== void 0) {
        node.setRotation(nodeDef.rotation);
      }
      if (nodeDef.scale !== void 0) {
        node.setScale(nodeDef.scale);
      }
      if (nodeDef.matrix !== void 0) {
        const translation = [0, 0, 0];
        const rotation = [0, 0, 0, 1];
        const scale = [1, 1, 1];
        MathUtils.decompose(nodeDef.matrix, translation, rotation, scale);
        node.setTranslation(translation);
        node.setRotation(rotation);
        node.setScale(scale);
      }
      if (nodeDef.weights !== void 0) {
        node.setWeights(nodeDef.weights);
      }
      return node;
    });
    const skinDefs = json.skins || [];
    context.skins = skinDefs.map((skinDef) => {
      const skin = document.createSkin(skinDef.name);
      if (skinDef.extras) skin.setExtras(skinDef.extras);
      if (skinDef.inverseBindMatrices !== void 0) {
        skin.setInverseBindMatrices(context.accessors[skinDef.inverseBindMatrices]);
      }
      if (skinDef.skeleton !== void 0) {
        skin.setSkeleton(context.nodes[skinDef.skeleton]);
      }
      for (const nodeIndex of skinDef.joints) {
        skin.addJoint(context.nodes[nodeIndex]);
      }
      return skin;
    });
    nodeDefs.map((nodeDef, nodeIndex) => {
      const node = context.nodes[nodeIndex];
      const children = nodeDef.children || [];
      children.forEach((childIndex) => node.addChild(context.nodes[childIndex]));
      if (nodeDef.mesh !== void 0) node.setMesh(context.meshes[nodeDef.mesh]);
      if (nodeDef.camera !== void 0) node.setCamera(context.cameras[nodeDef.camera]);
      if (nodeDef.skin !== void 0) node.setSkin(context.skins[nodeDef.skin]);
    });
    const animationDefs = json.animations || [];
    context.animations = animationDefs.map((animationDef) => {
      const animation = document.createAnimation(animationDef.name);
      if (animationDef.extras) animation.setExtras(animationDef.extras);
      const samplerDefs = animationDef.samplers || [];
      const samplers = samplerDefs.map((samplerDef) => {
        const sampler = document.createAnimationSampler().setInput(context.accessors[samplerDef.input]).setOutput(context.accessors[samplerDef.output]).setInterpolation(samplerDef.interpolation || AnimationSampler.Interpolation.LINEAR);
        if (samplerDef.extras) sampler.setExtras(samplerDef.extras);
        animation.addSampler(sampler);
        return sampler;
      });
      const channels = animationDef.channels || [];
      channels.forEach((channelDef) => {
        const channel = document.createAnimationChannel().setSampler(samplers[channelDef.sampler]).setTargetPath(channelDef.target.path);
        if (channelDef.target.node !== void 0) channel.setTargetNode(context.nodes[channelDef.target.node]);
        if (channelDef.extras) channel.setExtras(channelDef.extras);
        animation.addChannel(channel);
      });
      return animation;
    });
    const sceneDefs = json.scenes || [];
    document.getRoot().listExtensionsUsed().filter((extension) => extension.prereadTypes.includes(PropertyType.SCENE)).forEach((extension) => extension.preread(context, PropertyType.SCENE));
    context.scenes = sceneDefs.map((sceneDef) => {
      const scene = document.createScene(sceneDef.name);
      if (sceneDef.extras) scene.setExtras(sceneDef.extras);
      const children = sceneDef.nodes || [];
      children.map((nodeIndex) => context.nodes[nodeIndex]).forEach((node) => scene.addChild(node));
      return scene;
    });
    if (json.scene !== void 0) {
      document.getRoot().setDefaultScene(context.scenes[json.scene]);
    }
    document.getRoot().listExtensionsUsed().forEach((extension) => extension.read(context));
    accessorDefs.forEach((accessorDef, index) => {
      const accessor = context.accessors[index];
      const hasSparseValues = !!accessorDef.sparse;
      const isZeroFilled = !accessorDef.bufferView && !accessor.getArray();
      if (hasSparseValues || isZeroFilled) {
        accessor.setSparse(true).setArray(getSparseArray(accessorDef, context));
      }
    });
    return document;
  }
  static validate(jsonDoc, options) {
    const json = jsonDoc.json;
    if (json.asset.version !== "2.0") {
      throw new Error(`Unsupported glTF version, "${json.asset.version}".`);
    }
    if (json.extensionsRequired) {
      for (const extensionName of json.extensionsRequired) {
        if (!options.extensions.find((extension) => extension.EXTENSION_NAME === extensionName)) {
          throw new Error(`Missing required extension, "${extensionName}".`);
        }
      }
    }
    if (json.extensionsUsed) {
      for (const extensionName of json.extensionsUsed) {
        if (!options.extensions.find((extension) => extension.EXTENSION_NAME === extensionName)) {
          options.logger.warn(`Missing optional extension, "${extensionName}".`);
        }
      }
    }
  }
};
function getInterleavedArray(accessorDef, context) {
  const jsonDoc = context.jsonDoc;
  const bufferView = context.bufferViews[accessorDef.bufferView];
  const bufferViewDef = jsonDoc.json.bufferViews[accessorDef.bufferView];
  const TypedArray = ComponentTypeToTypedArray[accessorDef.componentType];
  const elementSize = Accessor.getElementSize(accessorDef.type);
  const componentSize = TypedArray.BYTES_PER_ELEMENT;
  const accessorByteOffset = accessorDef.byteOffset || 0;
  const array = new TypedArray(accessorDef.count * elementSize);
  const view = new DataView(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
  const byteStride = bufferViewDef.byteStride;
  for (let i = 0; i < accessorDef.count; i++) {
    for (let j = 0; j < elementSize; j++) {
      const byteOffset = accessorByteOffset + i * byteStride + j * componentSize;
      let value;
      switch (accessorDef.componentType) {
        case Accessor.ComponentType.FLOAT:
          value = view.getFloat32(byteOffset, true);
          break;
        case Accessor.ComponentType.UNSIGNED_INT:
          value = view.getUint32(byteOffset, true);
          break;
        case Accessor.ComponentType.UNSIGNED_SHORT:
          value = view.getUint16(byteOffset, true);
          break;
        case Accessor.ComponentType.UNSIGNED_BYTE:
          value = view.getUint8(byteOffset);
          break;
        case Accessor.ComponentType.SHORT:
          value = view.getInt16(byteOffset, true);
          break;
        case Accessor.ComponentType.BYTE:
          value = view.getInt8(byteOffset);
          break;
        default:
          throw new Error(`Unexpected componentType "${accessorDef.componentType}".`);
      }
      array[i * elementSize + j] = value;
    }
  }
  return array;
}
function getAccessorArray(accessorDef, context) {
  const jsonDoc = context.jsonDoc;
  const bufferView = context.bufferViews[accessorDef.bufferView];
  const bufferViewDef = jsonDoc.json.bufferViews[accessorDef.bufferView];
  const TypedArray = ComponentTypeToTypedArray[accessorDef.componentType];
  const elementSize = Accessor.getElementSize(accessorDef.type);
  const componentSize = TypedArray.BYTES_PER_ELEMENT;
  const elementStride = elementSize * componentSize;
  if (bufferViewDef.byteStride !== void 0 && bufferViewDef.byteStride !== elementStride) {
    return getInterleavedArray(accessorDef, context);
  }
  const byteOffset = bufferView.byteOffset + (accessorDef.byteOffset || 0);
  const byteLength = accessorDef.count * elementSize * componentSize;
  return new TypedArray(bufferView.buffer.slice(byteOffset, byteOffset + byteLength));
}
function getSparseArray(accessorDef, context) {
  const TypedArray = ComponentTypeToTypedArray[accessorDef.componentType];
  const elementSize = Accessor.getElementSize(accessorDef.type);
  let array;
  if (accessorDef.bufferView !== void 0) {
    array = getAccessorArray(accessorDef, context);
  } else {
    array = new TypedArray(accessorDef.count * elementSize);
  }
  const sparseDef = accessorDef.sparse;
  if (!sparseDef) return array;
  const count = sparseDef.count;
  const indicesDef = _extends2({}, accessorDef, sparseDef.indices, {
    count,
    type: "SCALAR"
  });
  const valuesDef = _extends2({}, accessorDef, sparseDef.values, {
    count
  });
  const indices = getAccessorArray(indicesDef, context);
  const values = getAccessorArray(valuesDef, context);
  for (let i = 0; i < indicesDef.count; i++) {
    for (let j = 0; j < elementSize; j++) {
      array[indices[i] * elementSize + j] = values[i * elementSize + j];
    }
  }
  return array;
}
var BufferViewTarget;
(function(BufferViewTarget2) {
  BufferViewTarget2[BufferViewTarget2["ARRAY_BUFFER"] = 34962] = "ARRAY_BUFFER";
  BufferViewTarget2[BufferViewTarget2["ELEMENT_ARRAY_BUFFER"] = 34963] = "ELEMENT_ARRAY_BUFFER";
})(BufferViewTarget || (BufferViewTarget = {}));
var WriterContext = class {
  constructor(_doc, jsonDoc, options) {
    this._doc = void 0;
    this.jsonDoc = void 0;
    this.options = void 0;
    this.accessorIndexMap = /* @__PURE__ */ new Map();
    this.animationIndexMap = /* @__PURE__ */ new Map();
    this.bufferIndexMap = /* @__PURE__ */ new Map();
    this.cameraIndexMap = /* @__PURE__ */ new Map();
    this.skinIndexMap = /* @__PURE__ */ new Map();
    this.materialIndexMap = /* @__PURE__ */ new Map();
    this.meshIndexMap = /* @__PURE__ */ new Map();
    this.nodeIndexMap = /* @__PURE__ */ new Map();
    this.imageIndexMap = /* @__PURE__ */ new Map();
    this.textureDefIndexMap = /* @__PURE__ */ new Map();
    this.textureInfoDefMap = /* @__PURE__ */ new Map();
    this.samplerDefIndexMap = /* @__PURE__ */ new Map();
    this.sceneIndexMap = /* @__PURE__ */ new Map();
    this.imageBufferViews = [];
    this.otherBufferViews = /* @__PURE__ */ new Map();
    this.otherBufferViewsIndexMap = /* @__PURE__ */ new Map();
    this.extensionData = {};
    this.bufferURIGenerator = void 0;
    this.imageURIGenerator = void 0;
    this.logger = void 0;
    this._accessorUsageMap = /* @__PURE__ */ new Map();
    this.accessorUsageGroupedByParent = /* @__PURE__ */ new Set(["ARRAY_BUFFER"]);
    this.accessorParents = /* @__PURE__ */ new Map();
    this._doc = _doc;
    this.jsonDoc = jsonDoc;
    this.options = options;
    const root = _doc.getRoot();
    const numBuffers = root.listBuffers().length;
    const numImages = root.listTextures().length;
    this.bufferURIGenerator = new UniqueURIGenerator(numBuffers > 1, () => options.basename || "buffer");
    this.imageURIGenerator = new UniqueURIGenerator(numImages > 1, (texture) => getSlot(_doc, texture) || options.basename || "texture");
    this.logger = _doc.getLogger();
  }
  /**
   * Creates a TextureInfo definition, and any Texture or Sampler definitions it requires. If
   * possible, Texture and Sampler definitions are shared.
   */
  createTextureInfoDef(texture, textureInfo) {
    const samplerDef = {
      magFilter: textureInfo.getMagFilter() || void 0,
      minFilter: textureInfo.getMinFilter() || void 0,
      wrapS: textureInfo.getWrapS(),
      wrapT: textureInfo.getWrapT()
    };
    const samplerKey = JSON.stringify(samplerDef);
    if (!this.samplerDefIndexMap.has(samplerKey)) {
      this.samplerDefIndexMap.set(samplerKey, this.jsonDoc.json.samplers.length);
      this.jsonDoc.json.samplers.push(samplerDef);
    }
    const textureDef = {
      source: this.imageIndexMap.get(texture),
      sampler: this.samplerDefIndexMap.get(samplerKey)
    };
    const textureKey = JSON.stringify(textureDef);
    if (!this.textureDefIndexMap.has(textureKey)) {
      this.textureDefIndexMap.set(textureKey, this.jsonDoc.json.textures.length);
      this.jsonDoc.json.textures.push(textureDef);
    }
    const textureInfoDef = {
      index: this.textureDefIndexMap.get(textureKey)
    };
    if (textureInfo.getTexCoord() !== 0) {
      textureInfoDef.texCoord = textureInfo.getTexCoord();
    }
    if (Object.keys(textureInfo.getExtras()).length > 0) {
      textureInfoDef.extras = textureInfo.getExtras();
    }
    this.textureInfoDefMap.set(textureInfo, textureInfoDef);
    return textureInfoDef;
  }
  createPropertyDef(property) {
    const def = {};
    if (property.getName()) {
      def.name = property.getName();
    }
    if (Object.keys(property.getExtras()).length > 0) {
      def.extras = property.getExtras();
    }
    return def;
  }
  createAccessorDef(accessor) {
    const accessorDef = this.createPropertyDef(accessor);
    accessorDef.type = accessor.getType();
    accessorDef.componentType = accessor.getComponentType();
    accessorDef.count = accessor.getCount();
    const needsBounds = this._doc.getGraph().listParentEdges(accessor).some((edge) => edge.getName() === "attributes" && edge.getAttributes().key === "POSITION" || edge.getName() === "input");
    if (needsBounds) {
      accessorDef.max = accessor.getMax([]).map(Math.fround);
      accessorDef.min = accessor.getMin([]).map(Math.fround);
    }
    if (accessor.getNormalized()) {
      accessorDef.normalized = accessor.getNormalized();
    }
    return accessorDef;
  }
  createImageData(imageDef, data, texture) {
    if (this.options.format === Format.GLB) {
      this.imageBufferViews.push(data);
      imageDef.bufferView = this.jsonDoc.json.bufferViews.length;
      this.jsonDoc.json.bufferViews.push({
        buffer: 0,
        byteOffset: -1,
        // determined while iterating buffers, in Writer.ts.
        byteLength: data.byteLength
      });
    } else {
      const extension = ImageUtils.mimeTypeToExtension(texture.getMimeType());
      imageDef.uri = this.imageURIGenerator.createURI(texture, extension);
      this.jsonDoc.resources[imageDef.uri] = data;
    }
  }
  /**
   * Returns implicit usage type of the given accessor, related to grouping accessors into
   * buffer views. Usage is a superset of buffer view target, including ARRAY_BUFFER and
   * ELEMENT_ARRAY_BUFFER, but also usages that do not match GPU buffer view targets such as
   * IBMs. Additional usages are defined by extensions, like `EXT_mesh_gpu_instancing`.
   */
  getAccessorUsage(accessor) {
    const cachedUsage = this._accessorUsageMap.get(accessor);
    if (cachedUsage) return cachedUsage;
    if (accessor.getSparse()) return BufferViewUsage$1.SPARSE;
    for (const edge of this._doc.getGraph().listParentEdges(accessor)) {
      const {
        usage
      } = edge.getAttributes();
      if (usage) return usage;
      if (edge.getParent().propertyType !== PropertyType.ROOT) {
        this.logger.warn(`Missing attribute ".usage" on edge, "${edge.getName()}".`);
      }
    }
    return BufferViewUsage$1.OTHER;
  }
  /**
   * Sets usage for the given accessor. Some accessor types must be grouped into
   * buffer views with like accessors. This includes the specified buffer view "targets", but
   * also implicit usage like IBMs or instanced mesh attributes. If unspecified, an accessor
   * will be grouped with other accessors of unspecified usage.
   */
  addAccessorToUsageGroup(accessor, usage) {
    const prevUsage = this._accessorUsageMap.get(accessor);
    if (prevUsage && prevUsage !== usage) {
      throw new Error(`Accessor with usage "${prevUsage}" cannot be reused as "${usage}".`);
    }
    this._accessorUsageMap.set(accessor, usage);
    return this;
  }
};
WriterContext.BufferViewTarget = BufferViewTarget;
WriterContext.BufferViewUsage = BufferViewUsage$1;
WriterContext.USAGE_TO_TARGET = {
  [BufferViewUsage$1.ARRAY_BUFFER]: BufferViewTarget.ARRAY_BUFFER,
  [BufferViewUsage$1.ELEMENT_ARRAY_BUFFER]: BufferViewTarget.ELEMENT_ARRAY_BUFFER
};
var UniqueURIGenerator = class {
  constructor(multiple, basename) {
    this.multiple = void 0;
    this.basename = void 0;
    this.counter = {};
    this.multiple = multiple;
    this.basename = basename;
  }
  createURI(object, extension) {
    if (object.getURI()) {
      return object.getURI();
    } else if (!this.multiple) {
      return `${this.basename(object)}.${extension}`;
    } else {
      const basename = this.basename(object);
      this.counter[basename] = this.counter[basename] || 1;
      return `${basename}_${this.counter[basename]++}.${extension}`;
    }
  }
};
function getSlot(document, texture) {
  const edge = document.getGraph().listParentEdges(texture).find((edge2) => edge2.getParent() !== document.getRoot());
  return edge ? edge.getName().replace(/texture$/i, "") : "";
}
var {
  BufferViewUsage
} = WriterContext;
var {
  UNSIGNED_INT,
  UNSIGNED_SHORT,
  UNSIGNED_BYTE
} = Accessor.ComponentType;
var GLTFWriter = class {
  static write(doc, options) {
    const graph = doc.getGraph();
    const root = doc.getRoot();
    const json = {
      asset: _extends2({
        generator: `glTF-Transform ${VERSION}`
      }, root.getAsset()),
      extras: _extends2({}, root.getExtras())
    };
    const jsonDoc = {
      json,
      resources: {}
    };
    const context = new WriterContext(doc, jsonDoc, options);
    const logger = options.logger || Logger.DEFAULT_INSTANCE;
    const extensionsRegistered = new Set(options.extensions.map((ext) => ext.EXTENSION_NAME));
    const extensionsUsed = doc.getRoot().listExtensionsUsed().filter((ext) => extensionsRegistered.has(ext.extensionName)).sort((a, b) => a.extensionName > b.extensionName ? 1 : -1);
    const extensionsRequired = doc.getRoot().listExtensionsRequired().filter((ext) => extensionsRegistered.has(ext.extensionName)).sort((a, b) => a.extensionName > b.extensionName ? 1 : -1);
    if (extensionsUsed.length < doc.getRoot().listExtensionsUsed().length) {
      logger.warn("Some extensions were not registered for I/O, and will not be written.");
    }
    for (const extension of extensionsUsed) {
      for (const key of extension.writeDependencies) {
        extension.install(key, options.dependencies[key]);
      }
    }
    function concatAccessors(accessors, bufferIndex, bufferByteOffset, bufferViewTarget) {
      const buffers = [];
      let byteLength = 0;
      for (const accessor of accessors) {
        const accessorDef = context.createAccessorDef(accessor);
        accessorDef.bufferView = json.bufferViews.length;
        const accessorArray = accessor.getArray();
        const data = BufferUtils.pad(BufferUtils.toView(accessorArray));
        accessorDef.byteOffset = byteLength;
        byteLength += data.byteLength;
        buffers.push(data);
        context.accessorIndexMap.set(accessor, json.accessors.length);
        json.accessors.push(accessorDef);
      }
      const bufferViewData = BufferUtils.concat(buffers);
      const bufferViewDef = {
        buffer: bufferIndex,
        byteOffset: bufferByteOffset,
        byteLength: bufferViewData.byteLength
      };
      if (bufferViewTarget) bufferViewDef.target = bufferViewTarget;
      json.bufferViews.push(bufferViewDef);
      return {
        buffers,
        byteLength
      };
    }
    function interleaveAccessors(accessors, bufferIndex, bufferByteOffset) {
      const vertexCount = accessors[0].getCount();
      let byteStride = 0;
      for (const accessor of accessors) {
        const accessorDef = context.createAccessorDef(accessor);
        accessorDef.bufferView = json.bufferViews.length;
        accessorDef.byteOffset = byteStride;
        const elementSize = accessor.getElementSize();
        const componentSize = accessor.getComponentSize();
        byteStride += BufferUtils.padNumber(elementSize * componentSize);
        context.accessorIndexMap.set(accessor, json.accessors.length);
        json.accessors.push(accessorDef);
      }
      const byteLength = vertexCount * byteStride;
      const buffer = new ArrayBuffer(byteLength);
      const view = new DataView(buffer);
      for (let i = 0; i < vertexCount; i++) {
        let vertexByteOffset = 0;
        for (const accessor of accessors) {
          const elementSize = accessor.getElementSize();
          const componentSize = accessor.getComponentSize();
          const componentType = accessor.getComponentType();
          const array = accessor.getArray();
          for (let j = 0; j < elementSize; j++) {
            const viewByteOffset = i * byteStride + vertexByteOffset + j * componentSize;
            const value = array[i * elementSize + j];
            switch (componentType) {
              case Accessor.ComponentType.FLOAT:
                view.setFloat32(viewByteOffset, value, true);
                break;
              case Accessor.ComponentType.BYTE:
                view.setInt8(viewByteOffset, value);
                break;
              case Accessor.ComponentType.SHORT:
                view.setInt16(viewByteOffset, value, true);
                break;
              case Accessor.ComponentType.UNSIGNED_BYTE:
                view.setUint8(viewByteOffset, value);
                break;
              case Accessor.ComponentType.UNSIGNED_SHORT:
                view.setUint16(viewByteOffset, value, true);
                break;
              case Accessor.ComponentType.UNSIGNED_INT:
                view.setUint32(viewByteOffset, value, true);
                break;
              default:
                throw new Error("Unexpected component type: " + componentType);
            }
          }
          vertexByteOffset += BufferUtils.padNumber(elementSize * componentSize);
        }
      }
      const bufferViewDef = {
        buffer: bufferIndex,
        byteOffset: bufferByteOffset,
        byteLength,
        byteStride,
        target: WriterContext.BufferViewTarget.ARRAY_BUFFER
      };
      json.bufferViews.push(bufferViewDef);
      return {
        byteLength,
        buffers: [new Uint8Array(buffer)]
      };
    }
    function concatSparseAccessors(accessors, bufferIndex, bufferByteOffset) {
      const buffers = [];
      let byteLength = 0;
      const sparseData = /* @__PURE__ */ new Map();
      let maxIndex = -Infinity;
      let needSparseWarning = false;
      for (const accessor of accessors) {
        const accessorDef = context.createAccessorDef(accessor);
        json.accessors.push(accessorDef);
        context.accessorIndexMap.set(accessor, json.accessors.length - 1);
        const indices = [];
        const values = [];
        const el = [];
        const base = new Array(accessor.getElementSize()).fill(0);
        for (let i = 0, il = accessor.getCount(); i < il; i++) {
          accessor.getElement(i, el);
          if (MathUtils.eq(el, base, 0)) continue;
          maxIndex = Math.max(i, maxIndex);
          indices.push(i);
          for (let j = 0; j < el.length; j++) values.push(el[j]);
        }
        const count = indices.length;
        const data = {
          accessorDef,
          count
        };
        sparseData.set(accessor, data);
        if (count === 0) continue;
        if (count > accessor.getCount() / 2) {
          needSparseWarning = true;
        }
        const ValueArray = ComponentTypeToTypedArray[accessor.getComponentType()];
        data.indices = indices;
        data.values = new ValueArray(values);
      }
      if (!Number.isFinite(maxIndex)) {
        return {
          buffers,
          byteLength
        };
      }
      if (needSparseWarning) {
        logger.warn(`Some sparse accessors have >50% non-zero elements, which may increase file size.`);
      }
      const IndexArray = maxIndex < 255 ? Uint8Array : maxIndex < 65535 ? Uint16Array : Uint32Array;
      const IndexComponentType = maxIndex < 255 ? UNSIGNED_BYTE : maxIndex < 65535 ? UNSIGNED_SHORT : UNSIGNED_INT;
      const indicesBufferViewDef = {
        buffer: bufferIndex,
        byteOffset: bufferByteOffset + byteLength,
        byteLength: 0
      };
      for (const accessor of accessors) {
        const data = sparseData.get(accessor);
        if (data.count === 0) continue;
        data.indicesByteOffset = indicesBufferViewDef.byteLength;
        const buffer = BufferUtils.pad(BufferUtils.toView(new IndexArray(data.indices)));
        buffers.push(buffer);
        byteLength += buffer.byteLength;
        indicesBufferViewDef.byteLength += buffer.byteLength;
      }
      json.bufferViews.push(indicesBufferViewDef);
      const indicesBufferViewIndex = json.bufferViews.length - 1;
      const valuesBufferViewDef = {
        buffer: bufferIndex,
        byteOffset: bufferByteOffset + byteLength,
        byteLength: 0
      };
      for (const accessor of accessors) {
        const data = sparseData.get(accessor);
        if (data.count === 0) continue;
        data.valuesByteOffset = valuesBufferViewDef.byteLength;
        const buffer = BufferUtils.pad(BufferUtils.toView(data.values));
        buffers.push(buffer);
        byteLength += buffer.byteLength;
        valuesBufferViewDef.byteLength += buffer.byteLength;
      }
      json.bufferViews.push(valuesBufferViewDef);
      const valuesBufferViewIndex = json.bufferViews.length - 1;
      for (const accessor of accessors) {
        const data = sparseData.get(accessor);
        if (data.count === 0) continue;
        data.accessorDef.sparse = {
          count: data.count,
          indices: {
            bufferView: indicesBufferViewIndex,
            byteOffset: data.indicesByteOffset,
            componentType: IndexComponentType
          },
          values: {
            bufferView: valuesBufferViewIndex,
            byteOffset: data.valuesByteOffset
          }
        };
      }
      return {
        buffers,
        byteLength
      };
    }
    json.accessors = [];
    json.bufferViews = [];
    json.samplers = [];
    json.textures = [];
    json.images = root.listTextures().map((texture, textureIndex) => {
      const imageDef = context.createPropertyDef(texture);
      if (texture.getMimeType()) {
        imageDef.mimeType = texture.getMimeType();
      }
      const image = texture.getImage();
      if (image) {
        context.createImageData(imageDef, image, texture);
      }
      context.imageIndexMap.set(texture, textureIndex);
      return imageDef;
    });
    extensionsUsed.filter((extension) => extension.prewriteTypes.includes(PropertyType.ACCESSOR)).forEach((extension) => extension.prewrite(context, PropertyType.ACCESSOR));
    root.listAccessors().forEach((accessor) => {
      const groupByParent = context.accessorUsageGroupedByParent;
      const accessorParents = context.accessorParents;
      if (context.accessorIndexMap.has(accessor)) return;
      const usage = context.getAccessorUsage(accessor);
      context.addAccessorToUsageGroup(accessor, usage);
      if (groupByParent.has(usage)) {
        const parent = graph.listParents(accessor).find((parent2) => parent2.propertyType !== PropertyType.ROOT);
        accessorParents.set(accessor, parent);
      }
    });
    extensionsUsed.filter((extension) => extension.prewriteTypes.includes(PropertyType.BUFFER)).forEach((extension) => extension.prewrite(context, PropertyType.BUFFER));
    const hasBinaryResources = root.listAccessors().length > 0 || root.listTextures().length > 0 || context.otherBufferViews.size > 0;
    if (hasBinaryResources && root.listBuffers().length === 0) {
      throw new Error("Buffer required for Document resources, but none was found.");
    }
    json.buffers = [];
    root.listBuffers().forEach((buffer, index) => {
      const bufferDef = context.createPropertyDef(buffer);
      const groupByParent = context.accessorUsageGroupedByParent;
      const accessors = buffer.listParents().filter((property) => property instanceof Accessor);
      const uniqueParents = new Set(accessors.map((accessor) => context.accessorParents.get(accessor)));
      const parentToIndex = new Map(Array.from(uniqueParents).map((parent, index2) => [parent, index2]));
      const accessorGroups = {};
      for (const accessor of accessors) {
        var _key;
        if (context.accessorIndexMap.has(accessor)) continue;
        const usage = context.getAccessorUsage(accessor);
        let key = usage;
        if (groupByParent.has(usage)) {
          const parent = context.accessorParents.get(accessor);
          key += `:${parentToIndex.get(parent)}`;
        }
        accessorGroups[_key = key] || (accessorGroups[_key] = {
          usage,
          accessors: []
        });
        accessorGroups[key].accessors.push(accessor);
      }
      const buffers = [];
      const bufferIndex = json.buffers.length;
      let bufferByteLength = 0;
      for (const {
        usage,
        accessors: groupAccessors
      } of Object.values(accessorGroups)) {
        if (usage === BufferViewUsage.ARRAY_BUFFER && options.vertexLayout === VertexLayout.INTERLEAVED) {
          const result = interleaveAccessors(groupAccessors, bufferIndex, bufferByteLength);
          bufferByteLength += result.byteLength;
          buffers.push(...result.buffers);
        } else if (usage === BufferViewUsage.ARRAY_BUFFER) {
          for (const accessor of groupAccessors) {
            const result = interleaveAccessors([accessor], bufferIndex, bufferByteLength);
            bufferByteLength += result.byteLength;
            buffers.push(...result.buffers);
          }
        } else if (usage === BufferViewUsage.SPARSE) {
          const result = concatSparseAccessors(groupAccessors, bufferIndex, bufferByteLength);
          bufferByteLength += result.byteLength;
          buffers.push(...result.buffers);
        } else if (usage === BufferViewUsage.ELEMENT_ARRAY_BUFFER) {
          const target = WriterContext.BufferViewTarget.ELEMENT_ARRAY_BUFFER;
          const result = concatAccessors(groupAccessors, bufferIndex, bufferByteLength, target);
          bufferByteLength += result.byteLength;
          buffers.push(...result.buffers);
        } else {
          const result = concatAccessors(groupAccessors, bufferIndex, bufferByteLength);
          bufferByteLength += result.byteLength;
          buffers.push(...result.buffers);
        }
      }
      if (context.imageBufferViews.length && index === 0) {
        for (let i = 0; i < context.imageBufferViews.length; i++) {
          json.bufferViews[json.images[i].bufferView].byteOffset = bufferByteLength;
          bufferByteLength += context.imageBufferViews[i].byteLength;
          buffers.push(context.imageBufferViews[i]);
          if (bufferByteLength % 8) {
            const imagePadding = 8 - bufferByteLength % 8;
            bufferByteLength += imagePadding;
            buffers.push(new Uint8Array(imagePadding));
          }
        }
      }
      if (context.otherBufferViews.has(buffer)) {
        for (const data of context.otherBufferViews.get(buffer)) {
          json.bufferViews.push({
            buffer: bufferIndex,
            byteOffset: bufferByteLength,
            byteLength: data.byteLength
          });
          context.otherBufferViewsIndexMap.set(data, json.bufferViews.length - 1);
          bufferByteLength += data.byteLength;
          buffers.push(data);
        }
      }
      if (bufferByteLength) {
        let uri;
        if (options.format === Format.GLB) {
          uri = GLB_BUFFER;
        } else {
          uri = context.bufferURIGenerator.createURI(buffer, "bin");
          bufferDef.uri = uri;
        }
        bufferDef.byteLength = bufferByteLength;
        jsonDoc.resources[uri] = BufferUtils.concat(buffers);
      }
      json.buffers.push(bufferDef);
      context.bufferIndexMap.set(buffer, index);
    });
    if (root.listAccessors().find((a) => !a.getBuffer())) {
      logger.warn("Skipped writing one or more Accessors: no Buffer assigned.");
    }
    extensionsUsed.filter((extension) => extension.prewriteTypes.includes(PropertyType.MATERIAL)).forEach((extension) => extension.prewrite(context, PropertyType.MATERIAL));
    json.materials = root.listMaterials().map((material, index) => {
      const materialDef = context.createPropertyDef(material);
      if (material.getAlphaMode() !== Material.AlphaMode.OPAQUE) {
        materialDef.alphaMode = material.getAlphaMode();
      }
      if (material.getAlphaMode() === Material.AlphaMode.MASK) {
        materialDef.alphaCutoff = material.getAlphaCutoff();
      }
      if (material.getDoubleSided()) materialDef.doubleSided = true;
      materialDef.pbrMetallicRoughness = {};
      if (!MathUtils.eq(material.getBaseColorFactor(), [1, 1, 1, 1])) {
        materialDef.pbrMetallicRoughness.baseColorFactor = material.getBaseColorFactor();
      }
      if (!MathUtils.eq(material.getEmissiveFactor(), [0, 0, 0])) {
        materialDef.emissiveFactor = material.getEmissiveFactor();
      }
      if (material.getRoughnessFactor() !== 1) {
        materialDef.pbrMetallicRoughness.roughnessFactor = material.getRoughnessFactor();
      }
      if (material.getMetallicFactor() !== 1) {
        materialDef.pbrMetallicRoughness.metallicFactor = material.getMetallicFactor();
      }
      if (material.getBaseColorTexture()) {
        const texture = material.getBaseColorTexture();
        const textureInfo = material.getBaseColorTextureInfo();
        materialDef.pbrMetallicRoughness.baseColorTexture = context.createTextureInfoDef(texture, textureInfo);
      }
      if (material.getEmissiveTexture()) {
        const texture = material.getEmissiveTexture();
        const textureInfo = material.getEmissiveTextureInfo();
        materialDef.emissiveTexture = context.createTextureInfoDef(texture, textureInfo);
      }
      if (material.getNormalTexture()) {
        const texture = material.getNormalTexture();
        const textureInfo = material.getNormalTextureInfo();
        const textureInfoDef = context.createTextureInfoDef(texture, textureInfo);
        if (material.getNormalScale() !== 1) {
          textureInfoDef.scale = material.getNormalScale();
        }
        materialDef.normalTexture = textureInfoDef;
      }
      if (material.getOcclusionTexture()) {
        const texture = material.getOcclusionTexture();
        const textureInfo = material.getOcclusionTextureInfo();
        const textureInfoDef = context.createTextureInfoDef(texture, textureInfo);
        if (material.getOcclusionStrength() !== 1) {
          textureInfoDef.strength = material.getOcclusionStrength();
        }
        materialDef.occlusionTexture = textureInfoDef;
      }
      if (material.getMetallicRoughnessTexture()) {
        const texture = material.getMetallicRoughnessTexture();
        const textureInfo = material.getMetallicRoughnessTextureInfo();
        materialDef.pbrMetallicRoughness.metallicRoughnessTexture = context.createTextureInfoDef(texture, textureInfo);
      }
      context.materialIndexMap.set(material, index);
      return materialDef;
    });
    extensionsUsed.filter((extension) => extension.prewriteTypes.includes(PropertyType.MESH)).forEach((extension) => extension.prewrite(context, PropertyType.MESH));
    json.meshes = root.listMeshes().map((mesh, index) => {
      const meshDef = context.createPropertyDef(mesh);
      let targetNames = null;
      meshDef.primitives = mesh.listPrimitives().map((primitive) => {
        const primitiveDef = {
          attributes: {}
        };
        primitiveDef.mode = primitive.getMode();
        const material = primitive.getMaterial();
        if (material) {
          primitiveDef.material = context.materialIndexMap.get(material);
        }
        if (Object.keys(primitive.getExtras()).length) {
          primitiveDef.extras = primitive.getExtras();
        }
        const indices = primitive.getIndices();
        if (indices) {
          primitiveDef.indices = context.accessorIndexMap.get(indices);
        }
        for (const semantic of primitive.listSemantics()) {
          primitiveDef.attributes[semantic] = context.accessorIndexMap.get(primitive.getAttribute(semantic));
        }
        for (const target of primitive.listTargets()) {
          const targetDef = {};
          for (const semantic of target.listSemantics()) {
            targetDef[semantic] = context.accessorIndexMap.get(target.getAttribute(semantic));
          }
          primitiveDef.targets = primitiveDef.targets || [];
          primitiveDef.targets.push(targetDef);
        }
        if (primitive.listTargets().length && !targetNames) {
          targetNames = primitive.listTargets().map((target) => target.getName());
        }
        return primitiveDef;
      });
      if (mesh.getWeights().length) {
        meshDef.weights = mesh.getWeights();
      }
      if (targetNames) {
        meshDef.extras = meshDef.extras || {};
        meshDef.extras["targetNames"] = targetNames;
      }
      context.meshIndexMap.set(mesh, index);
      return meshDef;
    });
    json.cameras = root.listCameras().map((camera, index) => {
      const cameraDef = context.createPropertyDef(camera);
      cameraDef.type = camera.getType();
      if (cameraDef.type === Camera.Type.PERSPECTIVE) {
        cameraDef.perspective = {
          znear: camera.getZNear(),
          zfar: camera.getZFar(),
          yfov: camera.getYFov()
        };
        const aspectRatio = camera.getAspectRatio();
        if (aspectRatio !== null) {
          cameraDef.perspective.aspectRatio = aspectRatio;
        }
      } else {
        cameraDef.orthographic = {
          znear: camera.getZNear(),
          zfar: camera.getZFar(),
          xmag: camera.getXMag(),
          ymag: camera.getYMag()
        };
      }
      context.cameraIndexMap.set(camera, index);
      return cameraDef;
    });
    json.nodes = root.listNodes().map((node, index) => {
      const nodeDef = context.createPropertyDef(node);
      if (!MathUtils.eq(node.getTranslation(), [0, 0, 0])) {
        nodeDef.translation = node.getTranslation();
      }
      if (!MathUtils.eq(node.getRotation(), [0, 0, 0, 1])) {
        nodeDef.rotation = node.getRotation();
      }
      if (!MathUtils.eq(node.getScale(), [1, 1, 1])) {
        nodeDef.scale = node.getScale();
      }
      if (node.getWeights().length) {
        nodeDef.weights = node.getWeights();
      }
      context.nodeIndexMap.set(node, index);
      return nodeDef;
    });
    json.skins = root.listSkins().map((skin, index) => {
      const skinDef = context.createPropertyDef(skin);
      const inverseBindMatrices = skin.getInverseBindMatrices();
      if (inverseBindMatrices) {
        skinDef.inverseBindMatrices = context.accessorIndexMap.get(inverseBindMatrices);
      }
      const skeleton = skin.getSkeleton();
      if (skeleton) {
        skinDef.skeleton = context.nodeIndexMap.get(skeleton);
      }
      skinDef.joints = skin.listJoints().map((joint) => context.nodeIndexMap.get(joint));
      context.skinIndexMap.set(skin, index);
      return skinDef;
    });
    root.listNodes().forEach((node, index) => {
      const nodeDef = json.nodes[index];
      const mesh = node.getMesh();
      if (mesh) {
        nodeDef.mesh = context.meshIndexMap.get(mesh);
      }
      const camera = node.getCamera();
      if (camera) {
        nodeDef.camera = context.cameraIndexMap.get(camera);
      }
      const skin = node.getSkin();
      if (skin) {
        nodeDef.skin = context.skinIndexMap.get(skin);
      }
      if (node.listChildren().length > 0) {
        nodeDef.children = node.listChildren().map((node2) => context.nodeIndexMap.get(node2));
      }
    });
    json.animations = root.listAnimations().map((animation, index) => {
      const animationDef = context.createPropertyDef(animation);
      const samplerIndexMap = /* @__PURE__ */ new Map();
      animationDef.samplers = animation.listSamplers().map((sampler, samplerIndex) => {
        const samplerDef = context.createPropertyDef(sampler);
        samplerDef.input = context.accessorIndexMap.get(sampler.getInput());
        samplerDef.output = context.accessorIndexMap.get(sampler.getOutput());
        samplerDef.interpolation = sampler.getInterpolation();
        samplerIndexMap.set(sampler, samplerIndex);
        return samplerDef;
      });
      animationDef.channels = animation.listChannels().map((channel) => {
        const channelDef = context.createPropertyDef(channel);
        channelDef.sampler = samplerIndexMap.get(channel.getSampler());
        channelDef.target = {
          node: context.nodeIndexMap.get(channel.getTargetNode()),
          path: channel.getTargetPath()
        };
        return channelDef;
      });
      context.animationIndexMap.set(animation, index);
      return animationDef;
    });
    json.scenes = root.listScenes().map((scene, index) => {
      const sceneDef = context.createPropertyDef(scene);
      sceneDef.nodes = scene.listChildren().map((node) => context.nodeIndexMap.get(node));
      context.sceneIndexMap.set(scene, index);
      return sceneDef;
    });
    const defaultScene = root.getDefaultScene();
    if (defaultScene) {
      json.scene = root.listScenes().indexOf(defaultScene);
    }
    json.extensionsUsed = extensionsUsed.map((ext) => ext.extensionName);
    json.extensionsRequired = extensionsRequired.map((ext) => ext.extensionName);
    extensionsUsed.forEach((extension) => extension.write(context));
    clean(json);
    return jsonDoc;
  }
};
function clean(object) {
  const unused = [];
  for (const key in object) {
    const value = object[key];
    if (Array.isArray(value) && value.length === 0) {
      unused.push(key);
    } else if (value === null || value === "") {
      unused.push(key);
    } else if (value && typeof value === "object" && Object.keys(value).length === 0) {
      unused.push(key);
    }
  }
  for (const key of unused) {
    delete object[key];
  }
}
var ChunkType;
(function(ChunkType2) {
  ChunkType2[ChunkType2["JSON"] = 1313821514] = "JSON";
  ChunkType2[ChunkType2["BIN"] = 5130562] = "BIN";
})(ChunkType || (ChunkType = {}));
var PlatformIO = class {
  constructor() {
    this._logger = Logger.DEFAULT_INSTANCE;
    this._extensions = /* @__PURE__ */ new Set();
    this._dependencies = {};
    this._vertexLayout = VertexLayout.INTERLEAVED;
    this.lastReadBytes = 0;
    this.lastWriteBytes = 0;
  }
  /** Sets the {@link Logger} used by this I/O instance. Defaults to Logger.DEFAULT_INSTANCE. */
  setLogger(logger) {
    this._logger = logger;
    return this;
  }
  /** Registers extensions, enabling I/O class to read and write glTF assets requiring them. */
  registerExtensions(extensions) {
    for (const extension of extensions) {
      this._extensions.add(extension);
      extension.register();
    }
    return this;
  }
  /** Registers dependencies used (e.g. by extensions) in the I/O process. */
  registerDependencies(dependencies) {
    Object.assign(this._dependencies, dependencies);
    return this;
  }
  /**
   * Sets the vertex layout method used by this I/O instance. Defaults to
   * VertexLayout.INTERLEAVED.
   */
  setVertexLayout(layout) {
    this._vertexLayout = layout;
    return this;
  }
  /**********************************************************************************************
   * Public Read API.
   */
  /** Reads a {@link Document} from the given URI. */
  async read(uri) {
    return await this.readJSON(await this.readAsJSON(uri));
  }
  /** Loads a URI and returns a {@link JSONDocument} struct, without parsing. */
  async readAsJSON(uri) {
    const view = await this.readURI(uri, "view");
    this.lastReadBytes = view.byteLength;
    const jsonDoc = isGLB(view) ? this._binaryToJSON(view) : {
      json: JSON.parse(BufferUtils.decodeText(view)),
      resources: {}
    };
    await this._readResourcesExternal(jsonDoc, this.dirname(uri));
    this._readResourcesInternal(jsonDoc);
    return jsonDoc;
  }
  /** Converts glTF-formatted JSON and a resource map to a {@link Document}. */
  async readJSON(jsonDoc) {
    jsonDoc = this._copyJSON(jsonDoc);
    this._readResourcesInternal(jsonDoc);
    return GLTFReader.read(jsonDoc, {
      extensions: Array.from(this._extensions),
      dependencies: this._dependencies,
      logger: this._logger
    });
  }
  /** Converts a GLB-formatted Uint8Array to a {@link JSONDocument}. */
  async binaryToJSON(glb) {
    const jsonDoc = this._binaryToJSON(BufferUtils.assertView(glb));
    this._readResourcesInternal(jsonDoc);
    const json = jsonDoc.json;
    if (json.buffers && json.buffers.some((bufferDef) => isExternalBuffer(jsonDoc, bufferDef))) {
      throw new Error("Cannot resolve external buffers with binaryToJSON().");
    } else if (json.images && json.images.some((imageDef) => isExternalImage(jsonDoc, imageDef))) {
      throw new Error("Cannot resolve external images with binaryToJSON().");
    }
    return jsonDoc;
  }
  /** Converts a GLB-formatted Uint8Array to a {@link Document}. */
  async readBinary(glb) {
    return this.readJSON(await this.binaryToJSON(BufferUtils.assertView(glb)));
  }
  /**********************************************************************************************
   * Public Write API.
   */
  /** Converts a {@link Document} to glTF-formatted JSON and a resource map. */
  async writeJSON(doc, _options = {}) {
    if (_options.format === Format.GLB && doc.getRoot().listBuffers().length > 1) {
      throw new Error("GLB must have 0\u20131 buffers.");
    }
    return GLTFWriter.write(doc, {
      format: _options.format || Format.GLTF,
      basename: _options.basename || "",
      logger: this._logger,
      vertexLayout: this._vertexLayout,
      dependencies: _extends2({}, this._dependencies),
      extensions: Array.from(this._extensions)
    });
  }
  /** Converts a {@link Document} to a GLB-formatted Uint8Array. */
  async writeBinary(doc) {
    const {
      json,
      resources
    } = await this.writeJSON(doc, {
      format: Format.GLB
    });
    const header = new Uint32Array([1179937895, 2, 12]);
    const jsonText = JSON.stringify(json);
    const jsonChunkData = BufferUtils.pad(BufferUtils.encodeText(jsonText), 32);
    const jsonChunkHeader = BufferUtils.toView(new Uint32Array([jsonChunkData.byteLength, 1313821514]));
    const jsonChunk = BufferUtils.concat([jsonChunkHeader, jsonChunkData]);
    header[header.length - 1] += jsonChunk.byteLength;
    const binBuffer = Object.values(resources)[0];
    if (!binBuffer || !binBuffer.byteLength) {
      return BufferUtils.concat([BufferUtils.toView(header), jsonChunk]);
    }
    const binChunkData = BufferUtils.pad(binBuffer, 0);
    const binChunkHeader = BufferUtils.toView(new Uint32Array([binChunkData.byteLength, 5130562]));
    const binChunk = BufferUtils.concat([binChunkHeader, binChunkData]);
    header[header.length - 1] += binChunk.byteLength;
    return BufferUtils.concat([BufferUtils.toView(header), jsonChunk, binChunk]);
  }
  /**********************************************************************************************
   * Internal.
   */
  async _readResourcesExternal(jsonDoc, base) {
    var _this = this;
    const images = jsonDoc.json.images || [];
    const buffers = jsonDoc.json.buffers || [];
    const pendingResources = [...images, ...buffers].map(async function(resource) {
      const uri = resource.uri;
      if (!uri || uri.match(/data:/)) return Promise.resolve();
      jsonDoc.resources[uri] = await _this.readURI(_this.resolve(base, uri), "view");
      _this.lastReadBytes += jsonDoc.resources[uri].byteLength;
    });
    await Promise.all(pendingResources);
  }
  _readResourcesInternal(jsonDoc) {
    function resolveResource(resource) {
      if (!resource.uri) return;
      if (resource.uri in jsonDoc.resources) {
        BufferUtils.assertView(jsonDoc.resources[resource.uri]);
        return;
      }
      if (resource.uri.match(/data:/)) {
        const resourceUUID = `__${uuid()}.${FileUtils.extension(resource.uri)}`;
        jsonDoc.resources[resourceUUID] = BufferUtils.createBufferFromDataURI(resource.uri);
        resource.uri = resourceUUID;
      }
    }
    const images = jsonDoc.json.images || [];
    images.forEach((image) => {
      if (image.bufferView === void 0 && image.uri === void 0) {
        throw new Error("Missing resource URI or buffer view.");
      }
      resolveResource(image);
    });
    const buffers = jsonDoc.json.buffers || [];
    buffers.forEach(resolveResource);
  }
  /**
   * Creates a shallow copy of glTF-formatted {@link JSONDocument}.
   *
   * Images, Buffers, and Resources objects are deep copies so that PlatformIO can safely
   * modify them during the parsing process. Other properties are shallow copies, and buffers
   * are passed by reference.
   */
  _copyJSON(jsonDoc) {
    const {
      images,
      buffers
    } = jsonDoc.json;
    jsonDoc = {
      json: _extends2({}, jsonDoc.json),
      resources: _extends2({}, jsonDoc.resources)
    };
    if (images) {
      jsonDoc.json.images = images.map((image) => _extends2({}, image));
    }
    if (buffers) {
      jsonDoc.json.buffers = buffers.map((buffer) => _extends2({}, buffer));
    }
    return jsonDoc;
  }
  /** Internal version of binaryToJSON; does not warn about external resources. */
  _binaryToJSON(glb) {
    if (!isGLB(glb)) {
      throw new Error("Invalid glTF 2.0 binary.");
    }
    const jsonChunkHeader = new Uint32Array(glb.buffer, glb.byteOffset + 12, 2);
    if (jsonChunkHeader[1] !== ChunkType.JSON) {
      throw new Error("Missing required GLB JSON chunk.");
    }
    const jsonByteOffset = 20;
    const jsonByteLength = jsonChunkHeader[0];
    const jsonText = BufferUtils.decodeText(BufferUtils.toView(glb, jsonByteOffset, jsonByteLength));
    const json = JSON.parse(jsonText);
    const binByteOffset = jsonByteOffset + jsonByteLength;
    if (glb.byteLength <= binByteOffset) {
      return {
        json,
        resources: {}
      };
    }
    const binChunkHeader = new Uint32Array(glb.buffer, glb.byteOffset + binByteOffset, 2);
    if (binChunkHeader[1] !== ChunkType.BIN) {
      throw new Error("Expected GLB BIN in second chunk.");
    }
    const binByteLength = binChunkHeader[0];
    const binBuffer = BufferUtils.toView(glb, binByteOffset + 8, binByteLength);
    return {
      json,
      resources: {
        [GLB_BUFFER]: binBuffer
      }
    };
  }
};
function isExternalBuffer(jsonDocument, bufferDef) {
  return bufferDef.uri !== void 0 && !(bufferDef.uri in jsonDocument.resources);
}
function isExternalImage(jsonDocument, imageDef) {
  return imageDef.uri !== void 0 && !(imageDef.uri in jsonDocument.resources) && imageDef.bufferView === void 0;
}
function isGLB(view) {
  if (view.byteLength < 3 * Uint32Array.BYTES_PER_ELEMENT) return false;
  const header = new Uint32Array(view.buffer, view.byteOffset, 3);
  return header[0] === 1179937895 && header[1] === 2;
}
var NodeIO = class extends PlatformIO {
  /**
   * Constructs a new NodeIO service. Instances are reusable. By default, only NodeIO can only
   * read/write paths on disk. To enable HTTP requests, provide a Fetch API implementation and
   * enable {@link NodeIO.setAllowNetwork setAllowNetwork}.
   *
   * @param fetch Implementation of Fetch API.
   * @param fetchConfig Configuration object for Fetch API.
   */
  constructor(_fetch = null, _fetchConfig = HTTPUtils.DEFAULT_INIT) {
    super();
    this._fetch = void 0;
    this._fetchConfig = void 0;
    this._init = void 0;
    this._fetchEnabled = false;
    this._fetch = _fetch;
    this._fetchConfig = _fetchConfig;
    this._init = this.init();
  }
  async init() {
    if (this._init) return this._init;
    return Promise.all([Promise.resolve().then(() => __toESM(require_fs(), 1)), Promise.resolve().then(() => __toESM(require_path(), 1))]).then(([fs, path]) => {
      this._fs = fs.promises;
      this._path = path;
    });
  }
  setAllowNetwork(allow) {
    if (allow && !this._fetch) {
      throw new Error("NodeIO requires a Fetch API implementation for HTTP requests.");
    }
    this._fetchEnabled = allow;
    return this;
  }
  async readURI(uri, type) {
    await this.init();
    if (HTTPUtils.isAbsoluteURL(uri)) {
      if (!this._fetchEnabled || !this._fetch) {
        throw new Error("Network request blocked. Allow HTTP requests explicitly, if needed.");
      }
      const response = await this._fetch(uri, this._fetchConfig);
      switch (type) {
        case "view":
          return new Uint8Array(await response.arrayBuffer());
        case "text":
          return response.text();
      }
    } else {
      switch (type) {
        case "view":
          return this._fs.readFile(uri);
        case "text":
          return this._fs.readFile(uri, "utf8");
      }
    }
  }
  resolve(base, path) {
    if (HTTPUtils.isAbsoluteURL(base) || HTTPUtils.isAbsoluteURL(path)) {
      return HTTPUtils.resolve(base, path);
    }
    return this._path.resolve(base, decodeURIComponent(path));
  }
  dirname(uri) {
    if (HTTPUtils.isAbsoluteURL(uri)) {
      return HTTPUtils.dirname(uri);
    }
    return this._path.dirname(uri);
  }
  /**********************************************************************************************
   * Public.
   */
  /** Writes a {@link Document} instance to a local path. */
  async write(uri, doc) {
    await this.init();
    const isGLB2 = !!uri.match(/\.glb$/);
    await (isGLB2 ? this._writeGLB(uri, doc) : this._writeGLTF(uri, doc));
  }
  /**********************************************************************************************
   * Private.
   */
  /** @internal */
  async _writeGLTF(uri, doc) {
    var _this = this;
    this.lastWriteBytes = 0;
    const {
      json,
      resources
    } = await this.writeJSON(doc, {
      format: Format.GLTF,
      basename: FileUtils.basename(uri)
    });
    const {
      _fs: fs,
      _path: path
    } = this;
    const dir = path.dirname(uri);
    const jsonContent = JSON.stringify(json, null, 2);
    await fs.writeFile(uri, jsonContent);
    this.lastWriteBytes += jsonContent.length;
    for (const batch of listBatches(Object.keys(resources), 10)) {
      await Promise.all(batch.map(async function(resourceURI) {
        if (HTTPUtils.isAbsoluteURL(resourceURI)) {
          if (HTTPUtils.extension(resourceURI) === "bin") {
            throw new Error(`Cannot write buffer to path "${resourceURI}".`);
          }
          return;
        }
        const resourcePath = path.join(dir, decodeURIComponent(resourceURI));
        await fs.mkdir(path.dirname(resourcePath), {
          recursive: true
        });
        await fs.writeFile(resourcePath, resources[resourceURI]);
        _this.lastWriteBytes += resources[resourceURI].byteLength;
      }));
    }
  }
  /** @internal */
  async _writeGLB(uri, doc) {
    const buffer = Buffer.from(await this.writeBinary(doc));
    await this._fs.writeFile(uri, buffer);
    this.lastWriteBytes = buffer.byteLength;
  }
};
function listBatches(array, batchSize) {
  const batches = [];
  for (let i = 0, il = array.length; i < il; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize && i + j < il; j++) {
      batch.push(array[i + j]);
    }
    batches.push(batch);
  }
  return batches;
}
var DenoIO = class extends PlatformIO {
  constructor(path) {
    super();
    this._path = void 0;
    this._path = path;
  }
  async readURI(uri, type) {
    switch (type) {
      case "view":
        return Deno.readFile(uri);
      case "text":
        return Deno.readTextFile(uri);
    }
  }
  resolve(base, path) {
    return this._path.resolve(base, decodeURIComponent(path));
  }
  dirname(uri) {
    return this._path.dirname(uri);
  }
};
var WebIO = class extends PlatformIO {
  /**
   * Constructs a new WebIO service. Instances are reusable.
   * @param fetchConfig Configuration object for Fetch API.
   */
  constructor(fetchConfig = HTTPUtils.DEFAULT_INIT) {
    super();
    this._fetchConfig = void 0;
    this._fetchConfig = fetchConfig;
  }
  async readURI(uri, type) {
    const response = await fetch(uri, this._fetchConfig);
    switch (type) {
      case "view":
        return new Uint8Array(await response.arrayBuffer());
      case "text":
        return response.text();
    }
  }
  resolve(base, path) {
    return HTTPUtils.resolve(base, path);
  }
  dirname(uri) {
    return HTTPUtils.dirname(uri);
  }
};
export {
  Accessor,
  Animation,
  AnimationChannel,
  AnimationSampler,
  Buffer$1 as Buffer,
  BufferUtils,
  COPY_IDENTITY,
  Camera,
  ColorUtils,
  ComponentTypeToTypedArray,
  DenoIO,
  Document,
  ExtensibleProperty,
  Extension,
  ExtensionProperty,
  FileUtils,
  Format,
  GLB_BUFFER,
  Graph,
  GraphEdge,
  HTTPUtils,
  ImageUtils,
  Logger,
  Material,
  MathUtils,
  Mesh,
  Node,
  NodeIO,
  PlatformIO,
  Primitive,
  PrimitiveTarget,
  Property,
  PropertyType,
  ReaderContext,
  RefList,
  RefMap,
  RefSet,
  Root,
  Scene,
  Skin,
  Texture,
  TextureChannel,
  TextureInfo,
  VERSION,
  Verbosity,
  VertexLayout,
  WebIO,
  WriterContext,
  getBounds,
  uuid
};
