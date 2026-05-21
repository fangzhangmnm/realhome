// node_modules/@gltf-transform/extensions/dist/index.modern.js
import { ExtensionProperty, PropertyType, RefMap, Extension, BufferUtils, WriterContext, Primitive, Root, AnimationSampler, AnimationChannel, Accessor, MathUtils, GLB_BUFFER, ImageUtils, getBounds, TextureInfo, TextureChannel, RefSet } from "@gltf-transform/core";

// node_modules/@gltf-transform/extensions/node_modules/ktx-parse/dist/ktx-parse.modern.js
var KHR_SUPERCOMPRESSION_NONE = 0;
var KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT = 0;
var KHR_DF_VENDORID_KHRONOS = 0;
var KHR_DF_VERSION = 2;
var KHR_DF_MODEL_UNSPECIFIED = 0;
var KHR_DF_MODEL_ETC1S = 163;
var KHR_DF_MODEL_UASTC = 166;
var KHR_DF_FLAG_ALPHA_STRAIGHT = 0;
var KHR_DF_TRANSFER_SRGB = 2;
var KHR_DF_PRIMARIES_BT709 = 1;
var KHR_DF_SAMPLE_DATATYPE_SIGNED = 64;
var VK_FORMAT_UNDEFINED = 0;
var KTX2Container = class {
  constructor() {
    this.vkFormat = VK_FORMAT_UNDEFINED;
    this.typeSize = 1;
    this.pixelWidth = 0;
    this.pixelHeight = 0;
    this.pixelDepth = 0;
    this.layerCount = 0;
    this.faceCount = 1;
    this.supercompressionScheme = KHR_SUPERCOMPRESSION_NONE;
    this.levels = [];
    this.dataFormatDescriptor = [{
      vendorId: KHR_DF_VENDORID_KHRONOS,
      descriptorType: KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT,
      descriptorBlockSize: 0,
      versionNumber: KHR_DF_VERSION,
      colorModel: KHR_DF_MODEL_UNSPECIFIED,
      colorPrimaries: KHR_DF_PRIMARIES_BT709,
      transferFunction: KHR_DF_TRANSFER_SRGB,
      flags: KHR_DF_FLAG_ALPHA_STRAIGHT,
      texelBlockDimension: [0, 0, 0, 0],
      bytesPlane: [0, 0, 0, 0, 0, 0, 0, 0],
      samples: []
    }];
    this.keyValue = {};
    this.globalData = null;
  }
};
var BufferReader = class {
  constructor(data, byteOffset, byteLength, littleEndian) {
    this._dataView = void 0;
    this._littleEndian = void 0;
    this._offset = void 0;
    this._dataView = new DataView(data.buffer, data.byteOffset + byteOffset, byteLength);
    this._littleEndian = littleEndian;
    this._offset = 0;
  }
  _nextUint8() {
    const value = this._dataView.getUint8(this._offset);
    this._offset += 1;
    return value;
  }
  _nextUint16() {
    const value = this._dataView.getUint16(this._offset, this._littleEndian);
    this._offset += 2;
    return value;
  }
  _nextUint32() {
    const value = this._dataView.getUint32(this._offset, this._littleEndian);
    this._offset += 4;
    return value;
  }
  _nextUint64() {
    const left = this._dataView.getUint32(this._offset, this._littleEndian);
    const right = this._dataView.getUint32(this._offset + 4, this._littleEndian);
    const value = left + 2 ** 32 * right;
    this._offset += 8;
    return value;
  }
  _nextInt32() {
    const value = this._dataView.getInt32(this._offset, this._littleEndian);
    this._offset += 4;
    return value;
  }
  _nextUint8Array(len) {
    const value = new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + this._offset, len);
    this._offset += len;
    return value;
  }
  _skip(bytes) {
    this._offset += bytes;
    return this;
  }
  _scan(maxByteLength, term = 0) {
    const byteOffset = this._offset;
    let byteLength = 0;
    while (this._dataView.getUint8(this._offset) !== term && byteLength < maxByteLength) {
      byteLength++;
      this._offset++;
    }
    if (byteLength < maxByteLength) this._offset++;
    return new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + byteOffset, byteLength);
  }
};
var NUL = new Uint8Array([0]);
var KTX2_ID = [
  // '´', 'K', 'T', 'X', '2', '0', 'ª', '\r', '\n', '\x1A', '\n'
  171,
  75,
  84,
  88,
  32,
  50,
  48,
  187,
  13,
  10,
  26,
  10
];
function decodeText(buffer) {
  return new TextDecoder().decode(buffer);
}
function read(data) {
  const id = new Uint8Array(data.buffer, data.byteOffset, KTX2_ID.length);
  if (id[0] !== KTX2_ID[0] || // '´'
  id[1] !== KTX2_ID[1] || // 'K'
  id[2] !== KTX2_ID[2] || // 'T'
  id[3] !== KTX2_ID[3] || // 'X'
  id[4] !== KTX2_ID[4] || // ' '
  id[5] !== KTX2_ID[5] || // '2'
  id[6] !== KTX2_ID[6] || // '0'
  id[7] !== KTX2_ID[7] || // 'ª'
  id[8] !== KTX2_ID[8] || // '\r'
  id[9] !== KTX2_ID[9] || // '\n'
  id[10] !== KTX2_ID[10] || // '\x1A'
  id[11] !== KTX2_ID[11]) {
    throw new Error("Missing KTX 2.0 identifier.");
  }
  const container = new KTX2Container();
  const headerByteLength = 17 * Uint32Array.BYTES_PER_ELEMENT;
  const headerReader = new BufferReader(data, KTX2_ID.length, headerByteLength, true);
  container.vkFormat = headerReader._nextUint32();
  container.typeSize = headerReader._nextUint32();
  container.pixelWidth = headerReader._nextUint32();
  container.pixelHeight = headerReader._nextUint32();
  container.pixelDepth = headerReader._nextUint32();
  container.layerCount = headerReader._nextUint32();
  container.faceCount = headerReader._nextUint32();
  const levelCount = headerReader._nextUint32();
  container.supercompressionScheme = headerReader._nextUint32();
  const dfdByteOffset = headerReader._nextUint32();
  const dfdByteLength = headerReader._nextUint32();
  const kvdByteOffset = headerReader._nextUint32();
  const kvdByteLength = headerReader._nextUint32();
  const sgdByteOffset = headerReader._nextUint64();
  const sgdByteLength = headerReader._nextUint64();
  const levelByteLength = levelCount * 3 * 8;
  const levelReader = new BufferReader(data, KTX2_ID.length + headerByteLength, levelByteLength, true);
  for (let i = 0; i < levelCount; i++) {
    container.levels.push({
      levelData: new Uint8Array(data.buffer, data.byteOffset + levelReader._nextUint64(), levelReader._nextUint64()),
      uncompressedByteLength: levelReader._nextUint64()
    });
  }
  const dfdReader = new BufferReader(data, dfdByteOffset, dfdByteLength, true);
  const dfd = {
    vendorId: dfdReader._skip(
      4
      /* totalSize */
    )._nextUint16(),
    descriptorType: dfdReader._nextUint16(),
    versionNumber: dfdReader._nextUint16(),
    descriptorBlockSize: dfdReader._nextUint16(),
    colorModel: dfdReader._nextUint8(),
    colorPrimaries: dfdReader._nextUint8(),
    transferFunction: dfdReader._nextUint8(),
    flags: dfdReader._nextUint8(),
    texelBlockDimension: [dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8()],
    bytesPlane: [dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8()],
    samples: []
  };
  const sampleStart = 6;
  const sampleWords = 4;
  const numSamples = (dfd.descriptorBlockSize / 4 - sampleStart) / sampleWords;
  for (let i = 0; i < numSamples; i++) {
    const sample = {
      bitOffset: dfdReader._nextUint16(),
      bitLength: dfdReader._nextUint8(),
      channelType: dfdReader._nextUint8(),
      samplePosition: [dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8()],
      sampleLower: -Infinity,
      sampleUpper: Infinity
    };
    if (sample.channelType & KHR_DF_SAMPLE_DATATYPE_SIGNED) {
      sample.sampleLower = dfdReader._nextInt32();
      sample.sampleUpper = dfdReader._nextInt32();
    } else {
      sample.sampleLower = dfdReader._nextUint32();
      sample.sampleUpper = dfdReader._nextUint32();
    }
    dfd.samples[i] = sample;
  }
  container.dataFormatDescriptor.length = 0;
  container.dataFormatDescriptor.push(dfd);
  const kvdReader = new BufferReader(data, kvdByteOffset, kvdByteLength, true);
  while (kvdReader._offset < kvdByteLength) {
    const keyValueByteLength = kvdReader._nextUint32();
    const keyData = kvdReader._scan(keyValueByteLength);
    const key = decodeText(keyData);
    container.keyValue[key] = kvdReader._nextUint8Array(keyValueByteLength - keyData.byteLength - 1);
    if (key.match(/^ktx/i)) {
      const text = decodeText(container.keyValue[key]);
      container.keyValue[key] = text.substring(0, text.lastIndexOf("\0"));
    }
    const kvPadding = keyValueByteLength % 4 ? 4 - keyValueByteLength % 4 : 0;
    kvdReader._skip(kvPadding);
  }
  if (sgdByteLength <= 0) return container;
  const sgdReader = new BufferReader(data, sgdByteOffset, sgdByteLength, true);
  const endpointCount = sgdReader._nextUint16();
  const selectorCount = sgdReader._nextUint16();
  const endpointsByteLength = sgdReader._nextUint32();
  const selectorsByteLength = sgdReader._nextUint32();
  const tablesByteLength = sgdReader._nextUint32();
  const extendedByteLength = sgdReader._nextUint32();
  const imageDescs = [];
  for (let i = 0; i < levelCount; i++) {
    imageDescs.push({
      imageFlags: sgdReader._nextUint32(),
      rgbSliceByteOffset: sgdReader._nextUint32(),
      rgbSliceByteLength: sgdReader._nextUint32(),
      alphaSliceByteOffset: sgdReader._nextUint32(),
      alphaSliceByteLength: sgdReader._nextUint32()
    });
  }
  const endpointsByteOffset = sgdByteOffset + sgdReader._offset;
  const selectorsByteOffset = endpointsByteOffset + endpointsByteLength;
  const tablesByteOffset = selectorsByteOffset + selectorsByteLength;
  const extendedByteOffset = tablesByteOffset + tablesByteLength;
  const endpointsData = new Uint8Array(data.buffer, data.byteOffset + endpointsByteOffset, endpointsByteLength);
  const selectorsData = new Uint8Array(data.buffer, data.byteOffset + selectorsByteOffset, selectorsByteLength);
  const tablesData = new Uint8Array(data.buffer, data.byteOffset + tablesByteOffset, tablesByteLength);
  const extendedData = new Uint8Array(data.buffer, data.byteOffset + extendedByteOffset, extendedByteLength);
  container.globalData = {
    endpointCount,
    selectorCount,
    imageDescs,
    endpointsData,
    selectorsData,
    tablesData,
    extendedData
  };
  return container;
}

// node_modules/@gltf-transform/extensions/dist/index.modern.js
var EXT_MESH_GPU_INSTANCING = "EXT_mesh_gpu_instancing";
var EXT_MESHOPT_COMPRESSION = "EXT_meshopt_compression";
var EXT_TEXTURE_WEBP = "EXT_texture_webp";
var EXT_TEXTURE_AVIF = "EXT_texture_avif";
var KHR_DRACO_MESH_COMPRESSION = "KHR_draco_mesh_compression";
var KHR_LIGHTS_PUNCTUAL = "KHR_lights_punctual";
var KHR_MATERIALS_ANISOTROPY = "KHR_materials_anisotropy";
var KHR_MATERIALS_CLEARCOAT = "KHR_materials_clearcoat";
var KHR_MATERIALS_DIFFUSE_TRANSMISSION = "KHR_materials_diffuse_transmission";
var KHR_MATERIALS_DISPERSION = "KHR_materials_dispersion";
var KHR_MATERIALS_EMISSIVE_STRENGTH = "KHR_materials_emissive_strength";
var KHR_MATERIALS_IOR = "KHR_materials_ior";
var KHR_MATERIALS_IRIDESCENCE = "KHR_materials_iridescence";
var KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS = "KHR_materials_pbrSpecularGlossiness";
var KHR_MATERIALS_SHEEN = "KHR_materials_sheen";
var KHR_MATERIALS_SPECULAR = "KHR_materials_specular";
var KHR_MATERIALS_TRANSMISSION = "KHR_materials_transmission";
var KHR_MATERIALS_UNLIT = "KHR_materials_unlit";
var KHR_MATERIALS_VOLUME = "KHR_materials_volume";
var KHR_MATERIALS_VARIANTS = "KHR_materials_variants";
var KHR_MESH_QUANTIZATION = "KHR_mesh_quantization";
var KHR_TEXTURE_BASISU = "KHR_texture_basisu";
var KHR_TEXTURE_TRANSFORM = "KHR_texture_transform";
var KHR_XMP_JSON_LD = "KHR_xmp_json_ld";
var INSTANCE_ATTRIBUTE = "INSTANCE_ATTRIBUTE";
var InstancedMesh = class extends ExtensionProperty {
  init() {
    this.extensionName = EXT_MESH_GPU_INSTANCING;
    this.propertyType = "InstancedMesh";
    this.parentTypes = [PropertyType.NODE];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      attributes: new RefMap()
    });
  }
  /** Returns an instance attribute as an {@link Accessor}. */
  getAttribute(semantic) {
    return this.getRefMap("attributes", semantic);
  }
  /**
   * Sets an instance attribute to an {@link Accessor}. All attributes must have the same
   * instance count.
   */
  setAttribute(semantic, accessor) {
    return this.setRefMap("attributes", semantic, accessor, {
      usage: INSTANCE_ATTRIBUTE
    });
  }
  /**
   * Lists all instance attributes {@link Accessor}s associated with the InstancedMesh. Order
   * will be consistent with the order returned by {@link .listSemantics}().
   */
  listAttributes() {
    return this.listRefMapValues("attributes");
  }
  /**
   * Lists all instance attribute semantics associated with the primitive. Order will be
   * consistent with the order returned by {@link .listAttributes}().
   */
  listSemantics() {
    return this.listRefMapKeys("attributes");
  }
};
InstancedMesh.EXTENSION_NAME = EXT_MESH_GPU_INSTANCING;
var NAME$o = EXT_MESH_GPU_INSTANCING;
var EXTMeshGPUInstancing = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$o;
    this.provideTypes = [PropertyType.NODE];
    this.prewriteTypes = [PropertyType.ACCESSOR];
  }
  /** Creates a new InstancedMesh property for use on a {@link Node}. */
  createInstancedMesh() {
    return new InstancedMesh(this.document.getGraph());
  }
  /** @hidden */
  read(context) {
    const jsonDoc = context.jsonDoc;
    const nodeDefs = jsonDoc.json.nodes || [];
    nodeDefs.forEach((nodeDef, nodeIndex) => {
      if (!nodeDef.extensions || !nodeDef.extensions[NAME$o]) return;
      const instancedMeshDef = nodeDef.extensions[NAME$o];
      const instancedMesh = this.createInstancedMesh();
      for (const semantic in instancedMeshDef.attributes) {
        instancedMesh.setAttribute(semantic, context.accessors[instancedMeshDef.attributes[semantic]]);
      }
      context.nodes[nodeIndex].setExtension(NAME$o, instancedMesh);
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    context.accessorUsageGroupedByParent.add(INSTANCE_ATTRIBUTE);
    for (const prop of this.properties) {
      for (const attribute of prop.listAttributes()) {
        context.addAccessorToUsageGroup(attribute, INSTANCE_ATTRIBUTE);
      }
    }
    return this;
  }
  /** @hidden */
  write(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listNodes().forEach((node) => {
      const instancedMesh = node.getExtension(NAME$o);
      if (instancedMesh) {
        const nodeIndex = context.nodeIndexMap.get(node);
        const nodeDef = jsonDoc.json.nodes[nodeIndex];
        const instancedMeshDef = {
          attributes: {}
        };
        instancedMesh.listSemantics().forEach((semantic) => {
          const attribute = instancedMesh.getAttribute(semantic);
          instancedMeshDef.attributes[semantic] = context.accessorIndexMap.get(attribute);
        });
        nodeDef.extensions = nodeDef.extensions || {};
        nodeDef.extensions[NAME$o] = instancedMeshDef;
      }
    });
    return this;
  }
};
EXTMeshGPUInstancing.EXTENSION_NAME = NAME$o;
function _extends() {
  _extends = Object.assign ? Object.assign.bind() : function(target) {
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
var EncoderMethod$1;
(function(EncoderMethod2) {
  EncoderMethod2["QUANTIZE"] = "quantize";
  EncoderMethod2["FILTER"] = "filter";
})(EncoderMethod$1 || (EncoderMethod$1 = {}));
var MeshoptMode;
(function(MeshoptMode2) {
  MeshoptMode2["ATTRIBUTES"] = "ATTRIBUTES";
  MeshoptMode2["TRIANGLES"] = "TRIANGLES";
  MeshoptMode2["INDICES"] = "INDICES";
})(MeshoptMode || (MeshoptMode = {}));
var MeshoptFilter;
(function(MeshoptFilter2) {
  MeshoptFilter2["NONE"] = "NONE";
  MeshoptFilter2["OCTAHEDRAL"] = "OCTAHEDRAL";
  MeshoptFilter2["QUATERNION"] = "QUATERNION";
  MeshoptFilter2["EXPONENTIAL"] = "EXPONENTIAL";
})(MeshoptFilter || (MeshoptFilter = {}));
var {
  BYTE,
  SHORT,
  FLOAT
} = Accessor.ComponentType;
var {
  encodeNormalizedInt,
  decodeNormalizedInt
} = MathUtils;
function prepareAccessor(accessor, encoder, mode, filterOptions) {
  const {
    filter,
    bits
  } = filterOptions;
  const result = {
    array: accessor.getArray(),
    byteStride: accessor.getElementSize() * accessor.getComponentSize(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized()
  };
  if (mode !== MeshoptMode.ATTRIBUTES) return result;
  if (filter !== MeshoptFilter.NONE) {
    let array = accessor.getNormalized() ? decodeNormalizedIntArray(accessor) : new Float32Array(result.array);
    switch (filter) {
      case MeshoptFilter.EXPONENTIAL:
        result.byteStride = accessor.getElementSize() * 4;
        result.componentType = FLOAT;
        result.normalized = false;
        result.array = encoder.encodeFilterExp(array, accessor.getCount(), result.byteStride, bits);
        break;
      case MeshoptFilter.OCTAHEDRAL:
        result.byteStride = bits > 8 ? 8 : 4;
        result.componentType = bits > 8 ? SHORT : BYTE;
        result.normalized = true;
        array = accessor.getElementSize() === 3 ? padNormals(array) : array;
        result.array = encoder.encodeFilterOct(array, accessor.getCount(), result.byteStride, bits);
        break;
      case MeshoptFilter.QUATERNION:
        result.byteStride = 8;
        result.componentType = SHORT;
        result.normalized = true;
        result.array = encoder.encodeFilterQuat(array, accessor.getCount(), result.byteStride, bits);
        break;
      default:
        throw new Error("Invalid filter.");
    }
    result.min = accessor.getMin([]);
    result.max = accessor.getMax([]);
    if (accessor.getNormalized()) {
      result.min = result.min.map((v) => decodeNormalizedInt(v, accessor.getComponentType()));
      result.max = result.max.map((v) => decodeNormalizedInt(v, accessor.getComponentType()));
    }
    if (result.normalized) {
      result.min = result.min.map((v) => encodeNormalizedInt(v, result.componentType));
      result.max = result.max.map((v) => encodeNormalizedInt(v, result.componentType));
    }
  } else if (result.byteStride % 4) {
    result.array = padArrayElements(result.array, accessor.getElementSize());
    result.byteStride = result.array.byteLength / accessor.getCount();
  }
  return result;
}
function decodeNormalizedIntArray(attribute) {
  const componentType = attribute.getComponentType();
  const srcArray = attribute.getArray();
  const dstArray = new Float32Array(srcArray.length);
  for (let i = 0; i < srcArray.length; i++) {
    dstArray[i] = decodeNormalizedInt(srcArray[i], componentType);
  }
  return dstArray;
}
function padArrayElements(srcArray, elementSize) {
  const byteStride = BufferUtils.padNumber(srcArray.BYTES_PER_ELEMENT * elementSize);
  const elementStride = byteStride / srcArray.BYTES_PER_ELEMENT;
  const elementCount = srcArray.length / elementSize;
  const dstArray = new srcArray.constructor(elementCount * elementStride);
  for (let i = 0; i * elementSize < srcArray.length; i++) {
    for (let j = 0; j < elementSize; j++) {
      dstArray[i * elementStride + j] = srcArray[i * elementSize + j];
    }
  }
  return dstArray;
}
function padNormals(srcArray) {
  const dstArray = new Float32Array(srcArray.length * 4 / 3);
  for (let i = 0, il = srcArray.length / 3; i < il; i++) {
    dstArray[i * 4] = srcArray[i * 3];
    dstArray[i * 4 + 1] = srcArray[i * 3 + 1];
    dstArray[i * 4 + 2] = srcArray[i * 3 + 2];
  }
  return dstArray;
}
function getMeshoptMode(accessor, usage) {
  if (usage === WriterContext.BufferViewUsage.ELEMENT_ARRAY_BUFFER) {
    const isTriangles = accessor.listParents().some((parent) => {
      return parent instanceof Primitive && parent.getMode() === Primitive.Mode.TRIANGLES;
    });
    return isTriangles ? MeshoptMode.TRIANGLES : MeshoptMode.INDICES;
  }
  return MeshoptMode.ATTRIBUTES;
}
function getMeshoptFilter(accessor, doc) {
  const refs = doc.getGraph().listParentEdges(accessor).filter((edge) => !(edge.getParent() instanceof Root));
  for (const ref of refs) {
    const refName = ref.getName();
    const refKey = ref.getAttributes().key || "";
    const isDelta = ref.getParent().propertyType === PropertyType.PRIMITIVE_TARGET;
    if (refName === "indices") return {
      filter: MeshoptFilter.NONE
    };
    if (refName === "attributes") {
      if (refKey === "POSITION") return {
        filter: MeshoptFilter.NONE
      };
      if (refKey === "TEXCOORD_0") return {
        filter: MeshoptFilter.NONE
      };
      if (refKey.startsWith("JOINTS_")) return {
        filter: MeshoptFilter.NONE
      };
      if (refKey.startsWith("WEIGHTS_")) return {
        filter: MeshoptFilter.NONE
      };
      if (refKey === "NORMAL" || refKey === "TANGENT") {
        return isDelta ? {
          filter: MeshoptFilter.NONE
        } : {
          filter: MeshoptFilter.OCTAHEDRAL,
          bits: 8
        };
      }
    }
    if (refName === "output") {
      const targetPath = getTargetPath(accessor);
      if (targetPath === "rotation") return {
        filter: MeshoptFilter.QUATERNION,
        bits: 16
      };
      if (targetPath === "translation") return {
        filter: MeshoptFilter.EXPONENTIAL,
        bits: 12
      };
      if (targetPath === "scale") return {
        filter: MeshoptFilter.EXPONENTIAL,
        bits: 12
      };
      return {
        filter: MeshoptFilter.NONE
      };
    }
    if (refName === "input") return {
      filter: MeshoptFilter.NONE
    };
    if (refName === "inverseBindMatrices") return {
      filter: MeshoptFilter.NONE
    };
  }
  return {
    filter: MeshoptFilter.NONE
  };
}
function getTargetPath(accessor) {
  for (const sampler of accessor.listParents()) {
    if (!(sampler instanceof AnimationSampler)) continue;
    for (const channel of sampler.listParents()) {
      if (!(channel instanceof AnimationChannel)) continue;
      return channel.getTargetPath();
    }
  }
  return null;
}
function isFallbackBuffer(bufferDef) {
  if (!bufferDef.extensions || !bufferDef.extensions[EXT_MESHOPT_COMPRESSION]) return false;
  const fallbackDef = bufferDef.extensions[EXT_MESHOPT_COMPRESSION];
  return !!fallbackDef.fallback;
}
var NAME$n = EXT_MESHOPT_COMPRESSION;
var DEFAULT_ENCODER_OPTIONS$1 = {
  method: EncoderMethod$1.QUANTIZE
};
var EXTMeshoptCompression = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$n;
    this.prereadTypes = [PropertyType.BUFFER, PropertyType.PRIMITIVE];
    this.prewriteTypes = [PropertyType.BUFFER, PropertyType.ACCESSOR];
    this.readDependencies = ["meshopt.decoder"];
    this.writeDependencies = ["meshopt.encoder"];
    this._decoder = null;
    this._decoderFallbackBufferMap = /* @__PURE__ */ new Map();
    this._encoder = null;
    this._encoderOptions = DEFAULT_ENCODER_OPTIONS$1;
    this._encoderFallbackBuffer = null;
    this._encoderBufferViews = {};
    this._encoderBufferViewData = {};
    this._encoderBufferViewAccessors = {};
  }
  /** @hidden */
  install(key, dependency) {
    if (key === "meshopt.decoder") {
      this._decoder = dependency;
    }
    if (key === "meshopt.encoder") {
      this._encoder = dependency;
    }
    return this;
  }
  /**
   * Configures Meshopt options for quality/compression tuning. The two methods rely on different
   * pre-processing before compression, and should be compared on the basis of (a) quality/loss
   * and (b) final asset size after _also_ applying a lossless compression such as gzip or brotli.
   *
   * - QUANTIZE: Default. Pre-process with {@link quantize quantize()} (lossy to specified
   * 	precision) before applying lossless Meshopt compression. Offers a considerable compression
   * 	ratio with or without further supercompression. Equivalent to `gltfpack -c`.
   * - FILTER: Pre-process with lossy filters to improve compression, before applying lossless
   *	Meshopt compression. While output may initially be larger than with the QUANTIZE method,
   *	this method will benefit more from supercompression (e.g. gzip or brotli). Equivalent to
   * 	`gltfpack -cc`.
   *
   * Output with the FILTER method will generally be smaller after supercompression (e.g. gzip or
   * brotli) is applied, but may be larger than QUANTIZE output without it. Decoding is very fast
   * with both methods.
   *
   * Example:
   *
   * ```ts
   * import { EXTMeshoptCompression } from '@gltf-transform/extensions';
   *
   * doc.createExtension(EXTMeshoptCompression)
   * 	.setRequired(true)
   * 	.setEncoderOptions({
   * 		method: EXTMeshoptCompression.EncoderMethod.QUANTIZE
   * 	});
   * ```
   */
  setEncoderOptions(options) {
    this._encoderOptions = _extends({}, DEFAULT_ENCODER_OPTIONS$1, options);
    return this;
  }
  /**********************************************************************************************
   * Decoding.
   */
  /** @internal Checks preconditions, decodes buffer views, and creates decoded primitives. */
  preread(context, propertyType) {
    if (!this._decoder) {
      if (!this.isRequired()) return this;
      throw new Error(`[${NAME$n}] Please install extension dependency, "meshopt.decoder".`);
    }
    if (!this._decoder.supported) {
      if (!this.isRequired()) return this;
      throw new Error(`[${NAME$n}]: Missing WASM support.`);
    }
    if (propertyType === PropertyType.BUFFER) {
      this._prereadBuffers(context);
    } else if (propertyType === PropertyType.PRIMITIVE) {
      this._prereadPrimitives(context);
    }
    return this;
  }
  /** @internal Decode buffer views. */
  _prereadBuffers(context) {
    const jsonDoc = context.jsonDoc;
    const viewDefs = jsonDoc.json.bufferViews || [];
    viewDefs.forEach((viewDef, index) => {
      if (!viewDef.extensions || !viewDef.extensions[NAME$n]) return;
      const meshoptDef = viewDef.extensions[NAME$n];
      const byteOffset = meshoptDef.byteOffset || 0;
      const byteLength = meshoptDef.byteLength || 0;
      const count = meshoptDef.count;
      const stride = meshoptDef.byteStride;
      const result = new Uint8Array(count * stride);
      const bufferDef = jsonDoc.json.buffers[meshoptDef.buffer];
      const resource = bufferDef.uri ? jsonDoc.resources[bufferDef.uri] : jsonDoc.resources[GLB_BUFFER];
      const source = BufferUtils.toView(resource, byteOffset, byteLength);
      this._decoder.decodeGltfBuffer(result, count, stride, source, meshoptDef.mode, meshoptDef.filter);
      context.bufferViews[index] = result;
    });
  }
  /**
   * Mark fallback buffers and replacements.
   *
   * Note: Alignment with primitives is arbitrary; this just needs to happen
   * after Buffers have been parsed.
   * @internal
   */
  _prereadPrimitives(context) {
    const jsonDoc = context.jsonDoc;
    const viewDefs = jsonDoc.json.bufferViews || [];
    viewDefs.forEach((viewDef) => {
      if (!viewDef.extensions || !viewDef.extensions[NAME$n]) return;
      const meshoptDef = viewDef.extensions[NAME$n];
      const buffer = context.buffers[meshoptDef.buffer];
      const fallbackBuffer = context.buffers[viewDef.buffer];
      const fallbackBufferDef = jsonDoc.json.buffers[viewDef.buffer];
      if (isFallbackBuffer(fallbackBufferDef)) {
        this._decoderFallbackBufferMap.set(fallbackBuffer, buffer);
      }
    });
  }
  /** @hidden Removes Fallback buffers, if extension is required. */
  read(_context) {
    if (!this.isRequired()) return this;
    for (const [fallbackBuffer, buffer] of this._decoderFallbackBufferMap) {
      for (const parent of fallbackBuffer.listParents()) {
        if (parent instanceof Accessor) {
          parent.swap(fallbackBuffer, buffer);
        }
      }
      fallbackBuffer.dispose();
    }
    return this;
  }
  /**********************************************************************************************
   * Encoding.
   */
  /** @internal Claims accessors that can be compressed and writes compressed buffer views. */
  prewrite(context, propertyType) {
    if (propertyType === PropertyType.ACCESSOR) {
      this._prewriteAccessors(context);
    } else if (propertyType === PropertyType.BUFFER) {
      this._prewriteBuffers(context);
    }
    return this;
  }
  /** @internal Claims accessors that can be compressed. */
  _prewriteAccessors(context) {
    const json = context.jsonDoc.json;
    const encoder = this._encoder;
    const options = this._encoderOptions;
    const graph = this.document.getGraph();
    const fallbackBuffer = this.document.createBuffer();
    const fallbackBufferIndex = this.document.getRoot().listBuffers().indexOf(fallbackBuffer);
    let nextID = 1;
    const parentToID = /* @__PURE__ */ new Map();
    const getParentID = (property) => {
      for (const parent of graph.listParents(property)) {
        if (parent.propertyType === PropertyType.ROOT) continue;
        let id = parentToID.get(property);
        if (id === void 0) parentToID.set(property, id = nextID++);
        return id;
      }
      return -1;
    };
    this._encoderFallbackBuffer = fallbackBuffer;
    this._encoderBufferViews = {};
    this._encoderBufferViewData = {};
    this._encoderBufferViewAccessors = {};
    for (const accessor of this.document.getRoot().listAccessors()) {
      if (getTargetPath(accessor) === "weights") continue;
      if (accessor.getSparse()) continue;
      const usage = context.getAccessorUsage(accessor);
      const parentID = context.accessorUsageGroupedByParent.has(usage) ? getParentID(accessor) : null;
      const mode = getMeshoptMode(accessor, usage);
      const filter = options.method === EncoderMethod$1.FILTER ? getMeshoptFilter(accessor, this.document) : {
        filter: MeshoptFilter.NONE
      };
      const preparedAccessor = prepareAccessor(accessor, encoder, mode, filter);
      const {
        array,
        byteStride
      } = preparedAccessor;
      const buffer = accessor.getBuffer();
      if (!buffer) throw new Error(`${NAME$n}: Missing buffer for accessor.`);
      const bufferIndex = this.document.getRoot().listBuffers().indexOf(buffer);
      const key = [usage, parentID, mode, filter.filter, byteStride, bufferIndex].join(":");
      let bufferView = this._encoderBufferViews[key];
      let bufferViewData = this._encoderBufferViewData[key];
      let bufferViewAccessors = this._encoderBufferViewAccessors[key];
      if (!bufferView || !bufferViewData) {
        bufferViewAccessors = this._encoderBufferViewAccessors[key] = [];
        bufferViewData = this._encoderBufferViewData[key] = [];
        bufferView = this._encoderBufferViews[key] = {
          buffer: fallbackBufferIndex,
          target: WriterContext.USAGE_TO_TARGET[usage],
          byteOffset: 0,
          byteLength: 0,
          byteStride: usage === WriterContext.BufferViewUsage.ARRAY_BUFFER ? byteStride : void 0,
          extensions: {
            [NAME$n]: {
              buffer: bufferIndex,
              byteOffset: 0,
              byteLength: 0,
              mode,
              filter: filter.filter !== MeshoptFilter.NONE ? filter.filter : void 0,
              byteStride,
              count: 0
            }
          }
        };
      }
      const accessorDef = context.createAccessorDef(accessor);
      accessorDef.componentType = preparedAccessor.componentType;
      accessorDef.normalized = preparedAccessor.normalized;
      accessorDef.byteOffset = bufferView.byteLength;
      if (accessorDef.min && preparedAccessor.min) accessorDef.min = preparedAccessor.min;
      if (accessorDef.max && preparedAccessor.max) accessorDef.max = preparedAccessor.max;
      context.accessorIndexMap.set(accessor, json.accessors.length);
      json.accessors.push(accessorDef);
      bufferViewAccessors.push(accessorDef);
      bufferViewData.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
      bufferView.byteLength += array.byteLength;
      bufferView.extensions.EXT_meshopt_compression.count += accessor.getCount();
    }
  }
  /** @internal Writes compressed buffer views. */
  _prewriteBuffers(context) {
    const encoder = this._encoder;
    for (const key in this._encoderBufferViews) {
      const bufferView = this._encoderBufferViews[key];
      const bufferViewData = this._encoderBufferViewData[key];
      const buffer = this.document.getRoot().listBuffers()[bufferView.extensions[NAME$n].buffer];
      const otherBufferViews = context.otherBufferViews.get(buffer) || [];
      const {
        count,
        byteStride,
        mode
      } = bufferView.extensions[NAME$n];
      const srcArray = BufferUtils.concat(bufferViewData);
      const dstArray = encoder.encodeGltfBuffer(srcArray, count, byteStride, mode);
      const compressedData = BufferUtils.pad(dstArray);
      bufferView.extensions[NAME$n].byteLength = dstArray.byteLength;
      bufferViewData.length = 0;
      bufferViewData.push(compressedData);
      otherBufferViews.push(compressedData);
      context.otherBufferViews.set(buffer, otherBufferViews);
    }
  }
  /** @hidden Puts encoded data into glTF output. */
  write(context) {
    let fallbackBufferByteOffset = 0;
    for (const key in this._encoderBufferViews) {
      const bufferView = this._encoderBufferViews[key];
      const bufferViewData = this._encoderBufferViewData[key][0];
      const bufferViewIndex = context.otherBufferViewsIndexMap.get(bufferViewData);
      const bufferViewAccessors = this._encoderBufferViewAccessors[key];
      for (const accessorDef of bufferViewAccessors) {
        accessorDef.bufferView = bufferViewIndex;
      }
      const finalBufferViewDef = context.jsonDoc.json.bufferViews[bufferViewIndex];
      const compressedByteOffset = finalBufferViewDef.byteOffset || 0;
      Object.assign(finalBufferViewDef, bufferView);
      finalBufferViewDef.byteOffset = fallbackBufferByteOffset;
      const bufferViewExtensionDef = finalBufferViewDef.extensions[NAME$n];
      bufferViewExtensionDef.byteOffset = compressedByteOffset;
      fallbackBufferByteOffset += BufferUtils.padNumber(bufferView.byteLength);
    }
    const fallbackBuffer = this._encoderFallbackBuffer;
    const fallbackBufferIndex = context.bufferIndexMap.get(fallbackBuffer);
    const fallbackBufferDef = context.jsonDoc.json.buffers[fallbackBufferIndex];
    fallbackBufferDef.byteLength = fallbackBufferByteOffset;
    fallbackBufferDef.extensions = {
      [NAME$n]: {
        fallback: true
      }
    };
    fallbackBuffer.dispose();
    return this;
  }
};
EXTMeshoptCompression.EXTENSION_NAME = NAME$n;
EXTMeshoptCompression.EncoderMethod = EncoderMethod$1;
var NAME$m = EXT_TEXTURE_AVIF;
var AVIFImageUtils = class {
  match(array) {
    return array.length >= 12 && BufferUtils.decodeText(array.slice(4, 12)) === "ftypavif";
  }
  /**
   * Probes size of AVIF or HEIC image. Assumes a single static image, without
   * orientation or other metadata that would affect dimensions.
   */
  getSize(array) {
    if (!this.match(array)) return null;
    const view = new DataView(array.buffer, array.byteOffset, array.byteLength);
    let box = unbox(view, 0);
    if (!box) return null;
    let offset = box.end;
    while (box = unbox(view, offset)) {
      if (box.type === "meta") {
        offset = box.start + 4;
      } else if (box.type === "iprp" || box.type === "ipco") {
        offset = box.start;
      } else if (box.type === "ispe") {
        return [view.getUint32(box.start + 4), view.getUint32(box.start + 8)];
      } else if (box.type === "mdat") {
        break;
      } else {
        offset = box.end;
      }
    }
    return null;
  }
  getChannels(_buffer) {
    return 4;
  }
};
var EXTTextureAVIF = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$m;
    this.prereadTypes = [PropertyType.TEXTURE];
  }
  /** @hidden */
  static register() {
    ImageUtils.registerFormat("image/avif", new AVIFImageUtils());
  }
  /** @hidden */
  preread(context) {
    const textureDefs = context.jsonDoc.json.textures || [];
    textureDefs.forEach((textureDef) => {
      if (textureDef.extensions && textureDef.extensions[NAME$m]) {
        textureDef.source = textureDef.extensions[NAME$m].source;
      }
    });
    return this;
  }
  /** @hidden */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  read(context) {
    return this;
  }
  /** @hidden */
  write(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listTextures().forEach((texture) => {
      if (texture.getMimeType() === "image/avif") {
        const imageIndex = context.imageIndexMap.get(texture);
        const textureDefs = jsonDoc.json.textures || [];
        textureDefs.forEach((textureDef) => {
          if (textureDef.source === imageIndex) {
            textureDef.extensions = textureDef.extensions || {};
            textureDef.extensions[NAME$m] = {
              source: textureDef.source
            };
            delete textureDef.source;
          }
        });
      }
    });
    return this;
  }
};
EXTTextureAVIF.EXTENSION_NAME = NAME$m;
function unbox(data, offset) {
  if (data.byteLength < 4 + offset) return null;
  const size = data.getUint32(offset);
  if (data.byteLength < size + offset || size < 8) return null;
  return {
    type: BufferUtils.decodeText(new Uint8Array(data.buffer, data.byteOffset + offset + 4, 4)),
    start: offset + 8,
    end: offset + size
  };
}
var NAME$l = EXT_TEXTURE_WEBP;
var WEBPImageUtils = class {
  match(array) {
    return array.length >= 12 && array[8] === 87 && array[9] === 69 && array[10] === 66 && array[11] === 80;
  }
  getSize(array) {
    const RIFF = BufferUtils.decodeText(array.slice(0, 4));
    const WEBP = BufferUtils.decodeText(array.slice(8, 12));
    if (RIFF !== "RIFF" || WEBP !== "WEBP") return null;
    const view = new DataView(array.buffer, array.byteOffset);
    let offset = 12;
    while (offset < view.byteLength) {
      const chunkId = BufferUtils.decodeText(new Uint8Array([view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3)]));
      const chunkByteLength = view.getUint32(offset + 4, true);
      if (chunkId === "VP8 ") {
        const width = view.getInt16(offset + 14, true) & 16383;
        const height = view.getInt16(offset + 16, true) & 16383;
        return [width, height];
      } else if (chunkId === "VP8L") {
        const b0 = view.getUint8(offset + 9);
        const b1 = view.getUint8(offset + 10);
        const b2 = view.getUint8(offset + 11);
        const b3 = view.getUint8(offset + 12);
        const width = 1 + ((b1 & 63) << 8 | b0);
        const height = 1 + ((b3 & 15) << 10 | b2 << 2 | (b1 & 192) >> 6);
        return [width, height];
      }
      offset += 8 + chunkByteLength + chunkByteLength % 2;
    }
    return null;
  }
  getChannels(_buffer) {
    return 4;
  }
};
var EXTTextureWebP = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$l;
    this.prereadTypes = [PropertyType.TEXTURE];
  }
  /** @hidden */
  static register() {
    ImageUtils.registerFormat("image/webp", new WEBPImageUtils());
  }
  /** @hidden */
  preread(context) {
    const textureDefs = context.jsonDoc.json.textures || [];
    textureDefs.forEach((textureDef) => {
      if (textureDef.extensions && textureDef.extensions[NAME$l]) {
        textureDef.source = textureDef.extensions[NAME$l].source;
      }
    });
    return this;
  }
  /** @hidden */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  read(context) {
    return this;
  }
  /** @hidden */
  write(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listTextures().forEach((texture) => {
      if (texture.getMimeType() === "image/webp") {
        const imageIndex = context.imageIndexMap.get(texture);
        const textureDefs = jsonDoc.json.textures || [];
        textureDefs.forEach((textureDef) => {
          if (textureDef.source === imageIndex) {
            textureDef.extensions = textureDef.extensions || {};
            textureDef.extensions[NAME$l] = {
              source: textureDef.source
            };
            delete textureDef.source;
          }
        });
      }
    });
    return this;
  }
};
EXTTextureWebP.EXTENSION_NAME = NAME$l;
var NAME$k = KHR_DRACO_MESH_COMPRESSION;
var decoderModule;
var COMPONENT_ARRAY;
var DATA_TYPE;
function decodeGeometry(decoder, data) {
  const buffer = new decoderModule.DecoderBuffer();
  try {
    buffer.Init(data, data.length);
    const geometryType = decoder.GetEncodedGeometryType(buffer);
    if (geometryType !== decoderModule.TRIANGULAR_MESH) {
      throw new Error(`[${NAME$k}] Unknown geometry type.`);
    }
    const dracoMesh = new decoderModule.Mesh();
    const status = decoder.DecodeBufferToMesh(buffer, dracoMesh);
    if (!status.ok() || dracoMesh.ptr === 0) {
      throw new Error(`[${NAME$k}] Decoding failure.`);
    }
    return dracoMesh;
  } finally {
    decoderModule.destroy(buffer);
  }
}
function decodeIndex(decoder, mesh) {
  const numFaces = mesh.num_faces();
  const numIndices = numFaces * 3;
  let ptr;
  let indices;
  if (mesh.num_points() <= 65534) {
    const byteLength = numIndices * Uint16Array.BYTES_PER_ELEMENT;
    ptr = decoderModule._malloc(byteLength);
    decoder.GetTrianglesUInt16Array(mesh, byteLength, ptr);
    indices = new Uint16Array(decoderModule.HEAPU16.buffer, ptr, numIndices).slice();
  } else {
    const byteLength = numIndices * Uint32Array.BYTES_PER_ELEMENT;
    ptr = decoderModule._malloc(byteLength);
    decoder.GetTrianglesUInt32Array(mesh, byteLength, ptr);
    indices = new Uint32Array(decoderModule.HEAPU32.buffer, ptr, numIndices).slice();
  }
  decoderModule._free(ptr);
  return indices;
}
function decodeAttribute(decoder, mesh, attribute, accessorDef) {
  const dataType = DATA_TYPE[accessorDef.componentType];
  const ArrayCtor = COMPONENT_ARRAY[accessorDef.componentType];
  const numComponents = attribute.num_components();
  const numPoints = mesh.num_points();
  const numValues = numPoints * numComponents;
  const byteLength = numValues * ArrayCtor.BYTES_PER_ELEMENT;
  const ptr = decoderModule._malloc(byteLength);
  decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, dataType, byteLength, ptr);
  const array = new ArrayCtor(decoderModule.HEAPF32.buffer, ptr, numValues).slice();
  decoderModule._free(ptr);
  return array;
}
function initDecoderModule(_decoderModule) {
  decoderModule = _decoderModule;
  COMPONENT_ARRAY = {
    [Accessor.ComponentType.FLOAT]: Float32Array,
    [Accessor.ComponentType.UNSIGNED_INT]: Uint32Array,
    [Accessor.ComponentType.UNSIGNED_SHORT]: Uint16Array,
    [Accessor.ComponentType.UNSIGNED_BYTE]: Uint8Array,
    [Accessor.ComponentType.SHORT]: Int16Array,
    [Accessor.ComponentType.BYTE]: Int8Array
  };
  DATA_TYPE = {
    [Accessor.ComponentType.FLOAT]: decoderModule.DT_FLOAT32,
    [Accessor.ComponentType.UNSIGNED_INT]: decoderModule.DT_UINT32,
    [Accessor.ComponentType.UNSIGNED_SHORT]: decoderModule.DT_UINT16,
    [Accessor.ComponentType.UNSIGNED_BYTE]: decoderModule.DT_UINT8,
    [Accessor.ComponentType.SHORT]: decoderModule.DT_INT16,
    [Accessor.ComponentType.BYTE]: decoderModule.DT_INT8
  };
}
var encoderModule;
var EncoderMethod;
(function(EncoderMethod2) {
  EncoderMethod2[EncoderMethod2["EDGEBREAKER"] = 1] = "EDGEBREAKER";
  EncoderMethod2[EncoderMethod2["SEQUENTIAL"] = 0] = "SEQUENTIAL";
})(EncoderMethod || (EncoderMethod = {}));
var AttributeEnum;
(function(AttributeEnum2) {
  AttributeEnum2["POSITION"] = "POSITION";
  AttributeEnum2["NORMAL"] = "NORMAL";
  AttributeEnum2["COLOR"] = "COLOR";
  AttributeEnum2["TEX_COORD"] = "TEX_COORD";
  AttributeEnum2["GENERIC"] = "GENERIC";
})(AttributeEnum || (AttributeEnum = {}));
var DEFAULT_QUANTIZATION_BITS = {
  [AttributeEnum.POSITION]: 14,
  [AttributeEnum.NORMAL]: 10,
  [AttributeEnum.COLOR]: 8,
  [AttributeEnum.TEX_COORD]: 12,
  [AttributeEnum.GENERIC]: 12
};
var DEFAULT_ENCODER_OPTIONS = {
  decodeSpeed: 5,
  encodeSpeed: 5,
  method: EncoderMethod.EDGEBREAKER,
  quantizationBits: DEFAULT_QUANTIZATION_BITS,
  quantizationVolume: "mesh"
};
function initEncoderModule(_encoderModule) {
  encoderModule = _encoderModule;
}
function encodeGeometry(prim, _options = DEFAULT_ENCODER_OPTIONS) {
  const options = _extends({}, DEFAULT_ENCODER_OPTIONS, _options);
  options.quantizationBits = _extends({}, DEFAULT_QUANTIZATION_BITS, _options.quantizationBits);
  const builder = new encoderModule.MeshBuilder();
  const mesh = new encoderModule.Mesh();
  const encoder = new encoderModule.ExpertEncoder(mesh);
  const attributeIDs = {};
  const dracoBuffer = new encoderModule.DracoInt8Array();
  const hasMorphTargets = prim.listTargets().length > 0;
  let hasSparseAttributes = false;
  for (const semantic of prim.listSemantics()) {
    const attribute = prim.getAttribute(semantic);
    if (attribute.getSparse()) {
      hasSparseAttributes = true;
      continue;
    }
    const attributeEnum = getAttributeEnum(semantic);
    const attributeID = addAttribute(builder, attribute.getComponentType(), mesh, encoderModule[attributeEnum], attribute.getCount(), attribute.getElementSize(), attribute.getArray());
    if (attributeID === -1) throw new Error(`Error compressing "${semantic}" attribute.`);
    attributeIDs[semantic] = attributeID;
    if (options.quantizationVolume === "mesh" || semantic !== "POSITION") {
      encoder.SetAttributeQuantization(attributeID, options.quantizationBits[attributeEnum]);
    } else if (typeof options.quantizationVolume === "object") {
      const {
        quantizationVolume
      } = options;
      const range = Math.max(quantizationVolume.max[0] - quantizationVolume.min[0], quantizationVolume.max[1] - quantizationVolume.min[1], quantizationVolume.max[2] - quantizationVolume.min[2]);
      encoder.SetAttributeExplicitQuantization(attributeID, options.quantizationBits[attributeEnum], attribute.getElementSize(), quantizationVolume.min, range);
    } else {
      throw new Error("Invalid quantization volume state.");
    }
  }
  const indices = prim.getIndices();
  if (!indices) throw new EncodingError("Primitive must have indices.");
  builder.AddFacesToMesh(mesh, indices.getCount() / 3, indices.getArray());
  encoder.SetSpeedOptions(options.encodeSpeed, options.decodeSpeed);
  encoder.SetTrackEncodedProperties(true);
  if (options.method === EncoderMethod.SEQUENTIAL || hasMorphTargets || hasSparseAttributes) {
    encoder.SetEncodingMethod(encoderModule.MESH_SEQUENTIAL_ENCODING);
  } else {
    encoder.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);
  }
  const byteLength = encoder.EncodeToDracoBuffer(!(hasMorphTargets || hasSparseAttributes), dracoBuffer);
  if (byteLength <= 0) throw new EncodingError("Error applying Draco compression.");
  const data = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; ++i) {
    data[i] = dracoBuffer.GetValue(i);
  }
  const numVertices = encoder.GetNumberOfEncodedPoints();
  const numIndices = encoder.GetNumberOfEncodedFaces() * 3;
  encoderModule.destroy(dracoBuffer);
  encoderModule.destroy(mesh);
  encoderModule.destroy(builder);
  encoderModule.destroy(encoder);
  return {
    numVertices,
    numIndices,
    data,
    attributeIDs
  };
}
function getAttributeEnum(semantic) {
  if (semantic === "POSITION") {
    return AttributeEnum.POSITION;
  } else if (semantic === "NORMAL") {
    return AttributeEnum.NORMAL;
  } else if (semantic.startsWith("COLOR_")) {
    return AttributeEnum.COLOR;
  } else if (semantic.startsWith("TEXCOORD_")) {
    return AttributeEnum.TEX_COORD;
  }
  return AttributeEnum.GENERIC;
}
function addAttribute(builder, componentType, mesh, attribute, count, itemSize, array) {
  switch (componentType) {
    case Accessor.ComponentType.UNSIGNED_BYTE:
      return builder.AddUInt8Attribute(mesh, attribute, count, itemSize, array);
    case Accessor.ComponentType.BYTE:
      return builder.AddInt8Attribute(mesh, attribute, count, itemSize, array);
    case Accessor.ComponentType.UNSIGNED_SHORT:
      return builder.AddUInt16Attribute(mesh, attribute, count, itemSize, array);
    case Accessor.ComponentType.SHORT:
      return builder.AddInt16Attribute(mesh, attribute, count, itemSize, array);
    case Accessor.ComponentType.UNSIGNED_INT:
      return builder.AddUInt32Attribute(mesh, attribute, count, itemSize, array);
    case Accessor.ComponentType.FLOAT:
      return builder.AddFloatAttribute(mesh, attribute, count, itemSize, array);
    default:
      throw new Error(`Unexpected component type, "${componentType}".`);
  }
}
var EncodingError = class extends Error {
};
var NAME$j = KHR_DRACO_MESH_COMPRESSION;
var KHRDracoMeshCompression = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$j;
    this.prereadTypes = [PropertyType.PRIMITIVE];
    this.prewriteTypes = [PropertyType.ACCESSOR];
    this.readDependencies = ["draco3d.decoder"];
    this.writeDependencies = ["draco3d.encoder"];
    this._decoderModule = null;
    this._encoderModule = null;
    this._encoderOptions = {};
  }
  /** @hidden */
  install(key, dependency) {
    if (key === "draco3d.decoder") {
      this._decoderModule = dependency;
      initDecoderModule(this._decoderModule);
    }
    if (key === "draco3d.encoder") {
      this._encoderModule = dependency;
      initEncoderModule(this._encoderModule);
    }
    return this;
  }
  /**
   * Sets Draco compression options. Compression does not take effect until the Document is
   * written with an I/O class.
   *
   * Defaults:
   * ```
   * decodeSpeed?: number = 5;
   * encodeSpeed?: number = 5;
   * method?: EncoderMethod = EncoderMethod.EDGEBREAKER;
   * quantizationBits?: {[ATTRIBUTE_NAME]: bits};
   * quantizationVolume?: 'mesh' | 'scene' | bbox = 'mesh';
   * ```
   */
  setEncoderOptions(options) {
    this._encoderOptions = options;
    return this;
  }
  /** @hidden */
  preread(context) {
    if (!this._decoderModule) {
      throw new Error(`[${NAME$j}] Please install extension dependency, "draco3d.decoder".`);
    }
    const logger = this.document.getLogger();
    const jsonDoc = context.jsonDoc;
    const dracoMeshes = /* @__PURE__ */ new Map();
    try {
      const meshDefs = jsonDoc.json.meshes || [];
      for (const meshDef of meshDefs) {
        for (const primDef of meshDef.primitives) {
          if (!primDef.extensions || !primDef.extensions[NAME$j]) continue;
          const dracoDef = primDef.extensions[NAME$j];
          let [decoder, dracoMesh] = dracoMeshes.get(dracoDef.bufferView) || [];
          if (!dracoMesh || !decoder) {
            const bufferViewDef = jsonDoc.json.bufferViews[dracoDef.bufferView];
            const bufferDef = jsonDoc.json.buffers[bufferViewDef.buffer];
            const resource = bufferDef.uri ? jsonDoc.resources[bufferDef.uri] : jsonDoc.resources[GLB_BUFFER];
            const byteOffset = bufferViewDef.byteOffset || 0;
            const byteLength = bufferViewDef.byteLength;
            const compressedData = BufferUtils.toView(resource, byteOffset, byteLength);
            decoder = new this._decoderModule.Decoder();
            dracoMesh = decodeGeometry(decoder, compressedData);
            dracoMeshes.set(dracoDef.bufferView, [decoder, dracoMesh]);
            logger.debug(`[${NAME$j}] Decompressed ${compressedData.byteLength} bytes.`);
          }
          for (const semantic in primDef.attributes) {
            const accessorDef = context.jsonDoc.json.accessors[primDef.attributes[semantic]];
            const dracoAttribute = decoder.GetAttributeByUniqueId(dracoMesh, dracoDef.attributes[semantic]);
            const attributeArray = decodeAttribute(decoder, dracoMesh, dracoAttribute, accessorDef);
            context.accessors[primDef.attributes[semantic]].setArray(attributeArray);
          }
          if (primDef.indices !== void 0) {
            context.accessors[primDef.indices].setArray(decodeIndex(decoder, dracoMesh));
          }
        }
      }
    } finally {
      for (const [decoder, dracoMesh] of Array.from(dracoMeshes.values())) {
        this._decoderModule.destroy(decoder);
        this._decoderModule.destroy(dracoMesh);
      }
    }
    return this;
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  prewrite(context, _propertyType) {
    if (!this._encoderModule) {
      throw new Error(`[${NAME$j}] Please install extension dependency, "draco3d.encoder".`);
    }
    const logger = this.document.getLogger();
    logger.debug(`[${NAME$j}] Compression options: ${JSON.stringify(this._encoderOptions)}`);
    const primitiveHashMap = listDracoPrimitives(this.document);
    const primitiveEncodingMap = /* @__PURE__ */ new Map();
    let quantizationVolume = "mesh";
    if (this._encoderOptions.quantizationVolume === "scene") {
      if (this.document.getRoot().listScenes().length !== 1) {
        logger.warn(`[${NAME$j}]: quantizationVolume=scene requires exactly 1 scene.`);
      } else {
        quantizationVolume = getBounds(this.document.getRoot().listScenes().pop());
      }
    }
    for (const prim of Array.from(primitiveHashMap.keys())) {
      const primHash = primitiveHashMap.get(prim);
      if (!primHash) throw new Error("Unexpected primitive.");
      if (primitiveEncodingMap.has(primHash)) {
        primitiveEncodingMap.set(primHash, primitiveEncodingMap.get(primHash));
        continue;
      }
      const indices = prim.getIndices();
      const accessorDefs = context.jsonDoc.json.accessors;
      let encodedPrim;
      try {
        encodedPrim = encodeGeometry(prim, _extends({}, this._encoderOptions, {
          quantizationVolume
        }));
      } catch (e) {
        if (e instanceof EncodingError) {
          logger.warn(`[${NAME$j}]: ${e.message} Skipping primitive compression.`);
          continue;
        }
        throw e;
      }
      primitiveEncodingMap.set(primHash, encodedPrim);
      const indicesDef = context.createAccessorDef(indices);
      indicesDef.count = encodedPrim.numIndices;
      context.accessorIndexMap.set(indices, accessorDefs.length);
      accessorDefs.push(indicesDef);
      if (encodedPrim.numVertices > 65534 && indicesDef.componentType !== Accessor.ComponentType.UNSIGNED_INT) {
        indicesDef.componentType = Accessor.ComponentType.UNSIGNED_INT;
      }
      for (const semantic of prim.listSemantics()) {
        const attribute = prim.getAttribute(semantic);
        if (encodedPrim.attributeIDs[semantic] === void 0) continue;
        const attributeDef = context.createAccessorDef(attribute);
        attributeDef.count = encodedPrim.numVertices;
        context.accessorIndexMap.set(attribute, accessorDefs.length);
        accessorDefs.push(attributeDef);
      }
      const buffer = prim.getAttribute("POSITION").getBuffer() || this.document.getRoot().listBuffers()[0];
      if (!context.otherBufferViews.has(buffer)) context.otherBufferViews.set(buffer, []);
      context.otherBufferViews.get(buffer).push(encodedPrim.data);
    }
    logger.debug(`[${NAME$j}] Compressed ${primitiveHashMap.size} primitives.`);
    context.extensionData[NAME$j] = {
      primitiveHashMap,
      primitiveEncodingMap
    };
    return this;
  }
  /** @hidden */
  write(context) {
    const dracoContext = context.extensionData[NAME$j];
    for (const mesh of this.document.getRoot().listMeshes()) {
      const meshDef = context.jsonDoc.json.meshes[context.meshIndexMap.get(mesh)];
      for (let i = 0; i < mesh.listPrimitives().length; i++) {
        const prim = mesh.listPrimitives()[i];
        const primDef = meshDef.primitives[i];
        const primHash = dracoContext.primitiveHashMap.get(prim);
        if (!primHash) continue;
        const encodedPrim = dracoContext.primitiveEncodingMap.get(primHash);
        if (!encodedPrim) continue;
        primDef.extensions = primDef.extensions || {};
        primDef.extensions[NAME$j] = {
          bufferView: context.otherBufferViewsIndexMap.get(encodedPrim.data),
          attributes: encodedPrim.attributeIDs
        };
      }
    }
    if (!dracoContext.primitiveHashMap.size) {
      const json = context.jsonDoc.json;
      json.extensionsUsed = (json.extensionsUsed || []).filter((name) => name !== NAME$j);
      json.extensionsRequired = (json.extensionsRequired || []).filter((name) => name !== NAME$j);
    }
    return this;
  }
};
KHRDracoMeshCompression.EXTENSION_NAME = NAME$j;
KHRDracoMeshCompression.EncoderMethod = EncoderMethod;
function listDracoPrimitives(doc) {
  const logger = doc.getLogger();
  const included = /* @__PURE__ */ new Set();
  const excluded = /* @__PURE__ */ new Set();
  let nonIndexed = 0;
  let nonTriangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (!prim.getIndices()) {
        excluded.add(prim);
        nonIndexed++;
      } else if (prim.getMode() !== Primitive.Mode.TRIANGLES) {
        excluded.add(prim);
        nonTriangles++;
      } else {
        included.add(prim);
      }
    }
  }
  if (nonIndexed > 0) {
    logger.warn(`[${NAME$j}] Skipping Draco compression of ${nonIndexed} non-indexed primitives.`);
  }
  if (nonTriangles > 0) {
    logger.warn(`[${NAME$j}] Skipping Draco compression of ${nonTriangles} non-TRIANGLES primitives.`);
  }
  const accessors = doc.getRoot().listAccessors();
  const accessorIndices = /* @__PURE__ */ new Map();
  for (let i = 0; i < accessors.length; i++) accessorIndices.set(accessors[i], i);
  const includedAccessors = /* @__PURE__ */ new Map();
  const includedHashKeys = /* @__PURE__ */ new Set();
  const primToHashKey = /* @__PURE__ */ new Map();
  for (const prim of Array.from(included)) {
    let hashKey = createHashKey(prim, accessorIndices);
    if (includedHashKeys.has(hashKey)) {
      primToHashKey.set(prim, hashKey);
      continue;
    }
    if (includedAccessors.has(prim.getIndices())) {
      const indices = prim.getIndices();
      const dstIndices = indices.clone();
      accessorIndices.set(dstIndices, doc.getRoot().listAccessors().length - 1);
      prim.swap(indices, dstIndices);
    }
    for (const attribute of prim.listAttributes()) {
      if (includedAccessors.has(attribute)) {
        const dstAttribute = attribute.clone();
        accessorIndices.set(dstAttribute, doc.getRoot().listAccessors().length - 1);
        prim.swap(attribute, dstAttribute);
      }
    }
    hashKey = createHashKey(prim, accessorIndices);
    includedHashKeys.add(hashKey);
    primToHashKey.set(prim, hashKey);
    includedAccessors.set(prim.getIndices(), hashKey);
    for (const attribute of prim.listAttributes()) {
      includedAccessors.set(attribute, hashKey);
    }
  }
  for (const accessor of Array.from(includedAccessors.keys())) {
    const parentTypes = new Set(accessor.listParents().map((prop) => prop.propertyType));
    if (parentTypes.size !== 2 || !parentTypes.has(PropertyType.PRIMITIVE) || !parentTypes.has(PropertyType.ROOT)) {
      throw new Error(`[${NAME$j}] Compressed accessors must only be used as indices or vertex attributes.`);
    }
  }
  for (const prim of Array.from(included)) {
    const hashKey = primToHashKey.get(prim);
    const indices = prim.getIndices();
    if (includedAccessors.get(indices) !== hashKey || prim.listAttributes().some((attr) => includedAccessors.get(attr) !== hashKey)) {
      throw new Error(`[${NAME$j}] Draco primitives must share all, or no, accessors.`);
    }
  }
  for (const prim of Array.from(excluded)) {
    const indices = prim.getIndices();
    if (includedAccessors.has(indices) || prim.listAttributes().some((attr) => includedAccessors.has(attr))) {
      throw new Error(`[${NAME$j}] Accessor cannot be shared by compressed and uncompressed primitives.`);
    }
  }
  return primToHashKey;
}
function createHashKey(prim, indexMap) {
  const hashElements = [];
  const indices = prim.getIndices();
  hashElements.push(indexMap.get(indices));
  for (const attribute of prim.listAttributes()) {
    hashElements.push(indexMap.get(attribute));
  }
  return hashElements.sort().join("|");
}
var Light = class _Light extends ExtensionProperty {
  /**********************************************************************************************
   * INSTANCE.
   */
  init() {
    this.extensionName = KHR_LIGHTS_PUNCTUAL;
    this.propertyType = "Light";
    this.parentTypes = [PropertyType.NODE];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      color: [1, 1, 1],
      intensity: 1,
      type: _Light.Type.POINT,
      range: null,
      innerConeAngle: 0,
      outerConeAngle: Math.PI / 4
    });
  }
  /**********************************************************************************************
   * COLOR.
   */
  /** Light color; Linear-sRGB components. */
  getColor() {
    return this.get("color");
  }
  /** Light color; Linear-sRGB components. */
  setColor(color) {
    return this.set("color", color);
  }
  /**********************************************************************************************
   * INTENSITY.
   */
  /**
   * Brightness of light. Units depend on the type of light: point and spot lights use luminous
   * intensity in candela (lm/sr) while directional lights use illuminance in lux (lm/m2).
   */
  getIntensity() {
    return this.get("intensity");
  }
  /**
   * Brightness of light. Units depend on the type of light: point and spot lights use luminous
   * intensity in candela (lm/sr) while directional lights use illuminance in lux (lm/m2).
   */
  setIntensity(intensity) {
    return this.set("intensity", intensity);
  }
  /**********************************************************************************************
   * TYPE.
   */
  /** Type. */
  getType() {
    return this.get("type");
  }
  /** Type. */
  setType(type) {
    return this.set("type", type);
  }
  /**********************************************************************************************
   * RANGE.
   */
  /**
   * Hint defining a distance cutoff at which the light's intensity may be considered to have
   * reached zero. Supported only for point and spot lights. Must be > 0. When undefined, range
   * is assumed to be infinite.
   */
  getRange() {
    return this.get("range");
  }
  /**
   * Hint defining a distance cutoff at which the light's intensity may be considered to have
   * reached zero. Supported only for point and spot lights. Must be > 0. When undefined, range
   * is assumed to be infinite.
   */
  setRange(range) {
    return this.set("range", range);
  }
  /**********************************************************************************************
   * SPOT LIGHT PROPERTIES
   */
  /**
   * Angle, in radians, from centre of spotlight where falloff begins. Must be >= 0 and
   * < outerConeAngle.
   */
  getInnerConeAngle() {
    return this.get("innerConeAngle");
  }
  /**
   * Angle, in radians, from centre of spotlight where falloff begins. Must be >= 0 and
   * < outerConeAngle.
   */
  setInnerConeAngle(angle) {
    return this.set("innerConeAngle", angle);
  }
  /**
   * Angle, in radians, from centre of spotlight where falloff ends. Must be > innerConeAngle and
   * <= PI / 2.0.
   */
  getOuterConeAngle() {
    return this.get("outerConeAngle");
  }
  /**
   * Angle, in radians, from centre of spotlight where falloff ends. Must be > innerConeAngle and
   * <= PI / 2.0.
   */
  setOuterConeAngle(angle) {
    return this.set("outerConeAngle", angle);
  }
};
Light.EXTENSION_NAME = KHR_LIGHTS_PUNCTUAL;
Light.Type = {
  POINT: "point",
  SPOT: "spot",
  DIRECTIONAL: "directional"
};
var NAME$i = KHR_LIGHTS_PUNCTUAL;
var KHRLightsPunctual = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$i;
  }
  /** Creates a new punctual Light property for use on a {@link Node}. */
  createLight(name = "") {
    return new Light(this.document.getGraph(), name);
  }
  /** @hidden */
  read(context) {
    const jsonDoc = context.jsonDoc;
    if (!jsonDoc.json.extensions || !jsonDoc.json.extensions[NAME$i]) return this;
    const rootDef = jsonDoc.json.extensions[NAME$i];
    const lightDefs = rootDef.lights || [];
    const lights = lightDefs.map((lightDef) => {
      var _lightDef$spot, _lightDef$spot2;
      const light = this.createLight().setName(lightDef.name || "").setType(lightDef.type);
      if (lightDef.color !== void 0) light.setColor(lightDef.color);
      if (lightDef.intensity !== void 0) light.setIntensity(lightDef.intensity);
      if (lightDef.range !== void 0) light.setRange(lightDef.range);
      if (((_lightDef$spot = lightDef.spot) == null ? void 0 : _lightDef$spot.innerConeAngle) !== void 0) {
        light.setInnerConeAngle(lightDef.spot.innerConeAngle);
      }
      if (((_lightDef$spot2 = lightDef.spot) == null ? void 0 : _lightDef$spot2.outerConeAngle) !== void 0) {
        light.setOuterConeAngle(lightDef.spot.outerConeAngle);
      }
      return light;
    });
    jsonDoc.json.nodes.forEach((nodeDef, nodeIndex) => {
      if (!nodeDef.extensions || !nodeDef.extensions[NAME$i]) return;
      const lightNodeDef = nodeDef.extensions[NAME$i];
      context.nodes[nodeIndex].setExtension(NAME$i, lights[lightNodeDef.light]);
    });
    return this;
  }
  /** @hidden */
  write(context) {
    const jsonDoc = context.jsonDoc;
    if (this.properties.size === 0) return this;
    const lightDefs = [];
    const lightIndexMap = /* @__PURE__ */ new Map();
    for (const property of this.properties) {
      const light = property;
      const lightDef = {
        type: light.getType()
      };
      if (!MathUtils.eq(light.getColor(), [1, 1, 1])) lightDef.color = light.getColor();
      if (light.getIntensity() !== 1) lightDef.intensity = light.getIntensity();
      if (light.getRange() != null) lightDef.range = light.getRange();
      if (light.getName()) lightDef.name = light.getName();
      if (light.getType() === Light.Type.SPOT) {
        lightDef.spot = {
          innerConeAngle: light.getInnerConeAngle(),
          outerConeAngle: light.getOuterConeAngle()
        };
      }
      lightDefs.push(lightDef);
      lightIndexMap.set(light, lightDefs.length - 1);
    }
    this.document.getRoot().listNodes().forEach((node) => {
      const light = node.getExtension(NAME$i);
      if (light) {
        const nodeIndex = context.nodeIndexMap.get(node);
        const nodeDef = jsonDoc.json.nodes[nodeIndex];
        nodeDef.extensions = nodeDef.extensions || {};
        nodeDef.extensions[NAME$i] = {
          light: lightIndexMap.get(light)
        };
      }
    });
    jsonDoc.json.extensions = jsonDoc.json.extensions || {};
    jsonDoc.json.extensions[NAME$i] = {
      lights: lightDefs
    };
    return this;
  }
};
KHRLightsPunctual.EXTENSION_NAME = NAME$i;
var {
  R: R$7,
  G: G$7,
  B: B$5
} = TextureChannel;
var Anisotropy = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_ANISOTROPY;
    this.propertyType = "Anisotropy";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      anisotropyStrength: 0,
      anisotropyRotation: 0,
      anisotropyTexture: null,
      anisotropyTextureInfo: new TextureInfo(this.graph, "anisotropyTextureInfo")
    });
  }
  /**********************************************************************************************
   * Anisotropy strength.
   */
  /** Anisotropy strength. */
  getAnisotropyStrength() {
    return this.get("anisotropyStrength");
  }
  /** Anisotropy strength. */
  setAnisotropyStrength(strength) {
    return this.set("anisotropyStrength", strength);
  }
  /**********************************************************************************************
   * Anisotropy rotation.
   */
  /** Anisotropy rotation; linear multiplier. */
  getAnisotropyRotation() {
    return this.get("anisotropyRotation");
  }
  /** Anisotropy rotation; linear multiplier. */
  setAnisotropyRotation(rotation) {
    return this.set("anisotropyRotation", rotation);
  }
  /**********************************************************************************************
   * Anisotropy texture.
   */
  /**
   * Anisotropy texture. Red and green channels represent the anisotropy
   * direction in [-1, 1] tangent, bitangent space, to be rotated by
   * anisotropyRotation. The blue channel contains strength as [0, 1] to be
   * multiplied by anisotropyStrength.
   */
  getAnisotropyTexture() {
    return this.getRef("anisotropyTexture");
  }
  /**
   * Settings affecting the material's use of its anisotropy texture. If no
   * texture is attached, {@link TextureInfo} is `null`.
   */
  getAnisotropyTextureInfo() {
    return this.getRef("anisotropyTexture") ? this.getRef("anisotropyTextureInfo") : null;
  }
  /** Anisotropy texture. See {@link Anisotropy.getAnisotropyTexture getAnisotropyTexture}. */
  setAnisotropyTexture(texture) {
    return this.setRef("anisotropyTexture", texture, {
      channels: R$7 | G$7 | B$5
    });
  }
};
Anisotropy.EXTENSION_NAME = KHR_MATERIALS_ANISOTROPY;
var NAME$h = KHR_MATERIALS_ANISOTROPY;
var KHRMaterialsAnisotropy = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$h;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Anisotropy property for use on a {@link Material}. */
  createAnisotropy() {
    return new Anisotropy(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$h]) {
        const anisotropy = this.createAnisotropy();
        context.materials[materialIndex].setExtension(NAME$h, anisotropy);
        const anisotropyDef = materialDef.extensions[NAME$h];
        if (anisotropyDef.anisotropyStrength !== void 0) {
          anisotropy.setAnisotropyStrength(anisotropyDef.anisotropyStrength);
        }
        if (anisotropyDef.anisotropyRotation !== void 0) {
          anisotropy.setAnisotropyRotation(anisotropyDef.anisotropyRotation);
        }
        if (anisotropyDef.anisotropyTexture !== void 0) {
          const textureInfoDef = anisotropyDef.anisotropyTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          anisotropy.setAnisotropyTexture(texture);
          context.setTextureInfo(anisotropy.getAnisotropyTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const anisotropy = material.getExtension(NAME$h);
      if (anisotropy) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const anisotropyDef = materialDef.extensions[NAME$h] = {};
        if (anisotropy.getAnisotropyStrength() > 0) {
          anisotropyDef.anisotropyStrength = anisotropy.getAnisotropyStrength();
        }
        if (anisotropy.getAnisotropyRotation() !== 0) {
          anisotropyDef.anisotropyRotation = anisotropy.getAnisotropyRotation();
        }
        if (anisotropy.getAnisotropyTexture()) {
          const texture = anisotropy.getAnisotropyTexture();
          const textureInfo = anisotropy.getAnisotropyTextureInfo();
          anisotropyDef.anisotropyTexture = context.createTextureInfoDef(texture, textureInfo);
        }
      }
    });
    return this;
  }
};
KHRMaterialsAnisotropy.EXTENSION_NAME = NAME$h;
var {
  R: R$6,
  G: G$6,
  B: B$4
} = TextureChannel;
var Clearcoat = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_CLEARCOAT;
    this.propertyType = "Clearcoat";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      clearcoatFactor: 0,
      clearcoatTexture: null,
      clearcoatTextureInfo: new TextureInfo(this.graph, "clearcoatTextureInfo"),
      clearcoatRoughnessFactor: 0,
      clearcoatRoughnessTexture: null,
      clearcoatRoughnessTextureInfo: new TextureInfo(this.graph, "clearcoatRoughnessTextureInfo"),
      clearcoatNormalScale: 1,
      clearcoatNormalTexture: null,
      clearcoatNormalTextureInfo: new TextureInfo(this.graph, "clearcoatNormalTextureInfo")
    });
  }
  /**********************************************************************************************
   * Clearcoat.
   */
  /** Clearcoat; linear multiplier. See {@link Clearcoat.getClearcoatTexture getClearcoatTexture}. */
  getClearcoatFactor() {
    return this.get("clearcoatFactor");
  }
  /** Clearcoat; linear multiplier. See {@link Clearcoat.getClearcoatTexture getClearcoatTexture}. */
  setClearcoatFactor(factor) {
    return this.set("clearcoatFactor", factor);
  }
  /**
   * Clearcoat texture; linear multiplier. The `r` channel of this texture specifies an amount
   * [0-1] of coating over the surface of the material, which may have its own roughness and
   * normal map properties.
   */
  getClearcoatTexture() {
    return this.getRef("clearcoatTexture");
  }
  /**
   * Settings affecting the material's use of its clearcoat texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getClearcoatTextureInfo() {
    return this.getRef("clearcoatTexture") ? this.getRef("clearcoatTextureInfo") : null;
  }
  /** Sets clearcoat texture. See {@link Clearcoat.getClearcoatTexture getClearcoatTexture}. */
  setClearcoatTexture(texture) {
    return this.setRef("clearcoatTexture", texture, {
      channels: R$6
    });
  }
  /**********************************************************************************************
   * Clearcoat roughness.
   */
  /**
   * Clearcoat roughness; linear multiplier.
   * See {@link Clearcoat.getClearcoatRoughnessTexture getClearcoatRoughnessTexture}.
   */
  getClearcoatRoughnessFactor() {
    return this.get("clearcoatRoughnessFactor");
  }
  /**
   * Clearcoat roughness; linear multiplier.
   * See {@link Clearcoat.getClearcoatRoughnessTexture getClearcoatRoughnessTexture}.
   */
  setClearcoatRoughnessFactor(factor) {
    return this.set("clearcoatRoughnessFactor", factor);
  }
  /**
   * Clearcoat roughness texture; linear multiplier. The `g` channel of this texture specifies
   * roughness, independent of the base layer's roughness.
   */
  getClearcoatRoughnessTexture() {
    return this.getRef("clearcoatRoughnessTexture");
  }
  /**
   * Settings affecting the material's use of its clearcoat roughness texture. If no texture is
   * attached, {@link TextureInfo} is `null`.
   */
  getClearcoatRoughnessTextureInfo() {
    return this.getRef("clearcoatRoughnessTexture") ? this.getRef("clearcoatRoughnessTextureInfo") : null;
  }
  /**
   * Sets clearcoat roughness texture.
   * See {@link Clearcoat.getClearcoatRoughnessTexture getClearcoatRoughnessTexture}.
   */
  setClearcoatRoughnessTexture(texture) {
    return this.setRef("clearcoatRoughnessTexture", texture, {
      channels: G$6
    });
  }
  /**********************************************************************************************
   * Clearcoat normals.
   */
  /** Clearcoat normal scale. See {@link Clearcoat.getClearcoatNormalTexture getClearcoatNormalTexture}. */
  getClearcoatNormalScale() {
    return this.get("clearcoatNormalScale");
  }
  /** Clearcoat normal scale. See {@link Clearcoat.getClearcoatNormalTexture getClearcoatNormalTexture}. */
  setClearcoatNormalScale(scale) {
    return this.set("clearcoatNormalScale", scale);
  }
  /**
   * Clearcoat normal map. Independent of the material base layer normal map.
   */
  getClearcoatNormalTexture() {
    return this.getRef("clearcoatNormalTexture");
  }
  /**
   * Settings affecting the material's use of its clearcoat normal texture. If no texture is
   * attached, {@link TextureInfo} is `null`.
   */
  getClearcoatNormalTextureInfo() {
    return this.getRef("clearcoatNormalTexture") ? this.getRef("clearcoatNormalTextureInfo") : null;
  }
  /** Sets clearcoat normal texture. See {@link Clearcoat.getClearcoatNormalTexture getClearcoatNormalTexture}. */
  setClearcoatNormalTexture(texture) {
    return this.setRef("clearcoatNormalTexture", texture, {
      channels: R$6 | G$6 | B$4
    });
  }
};
Clearcoat.EXTENSION_NAME = KHR_MATERIALS_CLEARCOAT;
var NAME$g = KHR_MATERIALS_CLEARCOAT;
var KHRMaterialsClearcoat = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$g;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Clearcoat property for use on a {@link Material}. */
  createClearcoat() {
    return new Clearcoat(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$g]) {
        const clearcoat = this.createClearcoat();
        context.materials[materialIndex].setExtension(NAME$g, clearcoat);
        const clearcoatDef = materialDef.extensions[NAME$g];
        if (clearcoatDef.clearcoatFactor !== void 0) {
          clearcoat.setClearcoatFactor(clearcoatDef.clearcoatFactor);
        }
        if (clearcoatDef.clearcoatRoughnessFactor !== void 0) {
          clearcoat.setClearcoatRoughnessFactor(clearcoatDef.clearcoatRoughnessFactor);
        }
        if (clearcoatDef.clearcoatTexture !== void 0) {
          const textureInfoDef = clearcoatDef.clearcoatTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          clearcoat.setClearcoatTexture(texture);
          context.setTextureInfo(clearcoat.getClearcoatTextureInfo(), textureInfoDef);
        }
        if (clearcoatDef.clearcoatRoughnessTexture !== void 0) {
          const textureInfoDef = clearcoatDef.clearcoatRoughnessTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          clearcoat.setClearcoatRoughnessTexture(texture);
          context.setTextureInfo(clearcoat.getClearcoatRoughnessTextureInfo(), textureInfoDef);
        }
        if (clearcoatDef.clearcoatNormalTexture !== void 0) {
          const textureInfoDef = clearcoatDef.clearcoatNormalTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          clearcoat.setClearcoatNormalTexture(texture);
          context.setTextureInfo(clearcoat.getClearcoatNormalTextureInfo(), textureInfoDef);
          if (textureInfoDef.scale !== void 0) {
            clearcoat.setClearcoatNormalScale(textureInfoDef.scale);
          }
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const clearcoat = material.getExtension(NAME$g);
      if (clearcoat) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const clearcoatDef = materialDef.extensions[NAME$g] = {
          clearcoatFactor: clearcoat.getClearcoatFactor(),
          clearcoatRoughnessFactor: clearcoat.getClearcoatRoughnessFactor()
        };
        if (clearcoat.getClearcoatTexture()) {
          const texture = clearcoat.getClearcoatTexture();
          const textureInfo = clearcoat.getClearcoatTextureInfo();
          clearcoatDef.clearcoatTexture = context.createTextureInfoDef(texture, textureInfo);
        }
        if (clearcoat.getClearcoatRoughnessTexture()) {
          const texture = clearcoat.getClearcoatRoughnessTexture();
          const textureInfo = clearcoat.getClearcoatRoughnessTextureInfo();
          clearcoatDef.clearcoatRoughnessTexture = context.createTextureInfoDef(texture, textureInfo);
        }
        if (clearcoat.getClearcoatNormalTexture()) {
          const texture = clearcoat.getClearcoatNormalTexture();
          const textureInfo = clearcoat.getClearcoatNormalTextureInfo();
          clearcoatDef.clearcoatNormalTexture = context.createTextureInfoDef(texture, textureInfo);
          if (clearcoat.getClearcoatNormalScale() !== 1) {
            clearcoatDef.clearcoatNormalTexture.scale = clearcoat.getClearcoatNormalScale();
          }
        }
      }
    });
    return this;
  }
};
KHRMaterialsClearcoat.EXTENSION_NAME = NAME$g;
var {
  R: R$5,
  G: G$5,
  B: B$3,
  A: A$3
} = TextureChannel;
var DiffuseTransmission = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_DIFFUSE_TRANSMISSION;
    this.propertyType = "DiffuseTransmission";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      diffuseTransmissionFactor: 0,
      diffuseTransmissionTexture: null,
      diffuseTransmissionTextureInfo: new TextureInfo(this.graph, "diffuseTransmissionTextureInfo"),
      diffuseTransmissionColorFactor: [1, 1, 1],
      diffuseTransmissionColorTexture: null,
      diffuseTransmissionColorTextureInfo: new TextureInfo(this.graph, "diffuseTransmissionColorTextureInfo")
    });
  }
  /**********************************************************************************************
   * Diffuse transmission.
   */
  /**
   * Percentage of reflected, non-specularly reflected light that is transmitted through the
   * surface via the Lambertian diffuse transmission, i.e., the strength of the diffuse
   * transmission effect.
   */
  getDiffuseTransmissionFactor() {
    return this.get("diffuseTransmissionFactor");
  }
  /**
   * Percentage of reflected, non-specularly reflected light that is transmitted through the
   * surface via the Lambertian diffuse transmission, i.e., the strength of the diffuse
   * transmission effect.
   */
  setDiffuseTransmissionFactor(factor) {
    return this.set("diffuseTransmissionFactor", factor);
  }
  /**
   * Texture that defines the strength of the diffuse transmission effect, stored in the alpha (A)
   * channel. Will be multiplied by the diffuseTransmissionFactor.
   */
  getDiffuseTransmissionTexture() {
    return this.getRef("diffuseTransmissionTexture");
  }
  /**
   * Settings affecting the material's use of its diffuse transmission texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getDiffuseTransmissionTextureInfo() {
    return this.getRef("diffuseTransmissionTexture") ? this.getRef("diffuseTransmissionTextureInfo") : null;
  }
  /**
   * Texture that defines the strength of the diffuse transmission effect, stored in the alpha (A)
   * channel. Will be multiplied by the diffuseTransmissionFactor.
   */
  setDiffuseTransmissionTexture(texture) {
    return this.setRef("diffuseTransmissionTexture", texture, {
      channels: A$3
    });
  }
  /**********************************************************************************************
   * Diffuse transmission color.
   */
  /** Color of the transmitted light; Linear-sRGB components. */
  getDiffuseTransmissionColorFactor() {
    return this.get("diffuseTransmissionColorFactor");
  }
  /** Color of the transmitted light; Linear-sRGB components. */
  setDiffuseTransmissionColorFactor(factor) {
    return this.set("diffuseTransmissionColorFactor", factor);
  }
  /**
   * Texture that defines the color of the transmitted light, stored in the RGB channels and
   * encoded in sRGB. This texture will be multiplied by diffuseTransmissionColorFactor.
   */
  getDiffuseTransmissionColorTexture() {
    return this.getRef("diffuseTransmissionColorTexture");
  }
  /**
   * Settings affecting the material's use of its diffuse transmission color texture. If no
   * texture is attached, {@link TextureInfo} is `null`.
   */
  getDiffuseTransmissionColorTextureInfo() {
    return this.getRef("diffuseTransmissionColorTexture") ? this.getRef("diffuseTransmissionColorTextureInfo") : null;
  }
  /**
   * Texture that defines the color of the transmitted light, stored in the RGB channels and
   * encoded in sRGB. This texture will be multiplied by diffuseTransmissionColorFactor.
   */
  setDiffuseTransmissionColorTexture(texture) {
    return this.setRef("diffuseTransmissionColorTexture", texture, {
      channels: R$5 | G$5 | B$3
    });
  }
};
DiffuseTransmission.EXTENSION_NAME = KHR_MATERIALS_DIFFUSE_TRANSMISSION;
var NAME$f = KHR_MATERIALS_DIFFUSE_TRANSMISSION;
var KHRMaterialsDiffuseTransmission = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$f;
  }
  /** Creates a new DiffuseTransmission property for use on a {@link Material}. */
  createDiffuseTransmission() {
    return new DiffuseTransmission(this.document.getGraph());
  }
  /** @hidden */
  read(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$f]) {
        const transmission = this.createDiffuseTransmission();
        context.materials[materialIndex].setExtension(NAME$f, transmission);
        const transmissionDef = materialDef.extensions[NAME$f];
        if (transmissionDef.diffuseTransmissionFactor !== void 0) {
          transmission.setDiffuseTransmissionFactor(transmissionDef.diffuseTransmissionFactor);
        }
        if (transmissionDef.diffuseTransmissionColorFactor !== void 0) {
          transmission.setDiffuseTransmissionColorFactor(transmissionDef.diffuseTransmissionColorFactor);
        }
        if (transmissionDef.diffuseTransmissionTexture !== void 0) {
          const textureInfoDef = transmissionDef.diffuseTransmissionTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          transmission.setDiffuseTransmissionTexture(texture);
          context.setTextureInfo(transmission.getDiffuseTransmissionTextureInfo(), textureInfoDef);
        }
        if (transmissionDef.diffuseTransmissionColorTexture !== void 0) {
          const textureInfoDef = transmissionDef.diffuseTransmissionColorTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          transmission.setDiffuseTransmissionColorTexture(texture);
          context.setTextureInfo(transmission.getDiffuseTransmissionColorTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  write(context) {
    const jsonDoc = context.jsonDoc;
    for (const material of this.document.getRoot().listMaterials()) {
      const transmission = material.getExtension(NAME$f);
      if (!transmission) continue;
      const materialIndex = context.materialIndexMap.get(material);
      const materialDef = jsonDoc.json.materials[materialIndex];
      materialDef.extensions = materialDef.extensions || {};
      const transmissionDef = materialDef.extensions[NAME$f] = {
        diffuseTransmissionFactor: transmission.getDiffuseTransmissionFactor(),
        diffuseTransmissionColorFactor: transmission.getDiffuseTransmissionColorFactor()
      };
      if (transmission.getDiffuseTransmissionTexture()) {
        const texture = transmission.getDiffuseTransmissionTexture();
        const textureInfo = transmission.getDiffuseTransmissionTextureInfo();
        transmissionDef.diffuseTransmissionTexture = context.createTextureInfoDef(texture, textureInfo);
      }
      if (transmission.getDiffuseTransmissionColorTexture()) {
        const texture = transmission.getDiffuseTransmissionColorTexture();
        const textureInfo = transmission.getDiffuseTransmissionColorTextureInfo();
        transmissionDef.diffuseTransmissionColorTexture = context.createTextureInfoDef(texture, textureInfo);
      }
    }
    return this;
  }
};
KHRMaterialsDiffuseTransmission.EXTENSION_NAME = NAME$f;
var Dispersion = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_DISPERSION;
    this.propertyType = "Dispersion";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      dispersion: 0
    });
  }
  /**********************************************************************************************
   * Dispersion.
   */
  /** Dispersion. */
  getDispersion() {
    return this.get("dispersion");
  }
  /** Dispersion. */
  setDispersion(dispersion) {
    return this.set("dispersion", dispersion);
  }
};
Dispersion.EXTENSION_NAME = KHR_MATERIALS_DISPERSION;
var NAME$e = KHR_MATERIALS_DISPERSION;
var KHRMaterialsDispersion = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$e;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Dispersion property for use on a {@link Material}. */
  createDispersion() {
    return new Dispersion(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$e]) {
        const dispersion = this.createDispersion();
        context.materials[materialIndex].setExtension(NAME$e, dispersion);
        const dispersionDef = materialDef.extensions[NAME$e];
        if (dispersionDef.dispersion !== void 0) {
          dispersion.setDispersion(dispersionDef.dispersion);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const dispersion = material.getExtension(NAME$e);
      if (dispersion) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[NAME$e] = {
          dispersion: dispersion.getDispersion()
        };
      }
    });
    return this;
  }
};
KHRMaterialsDispersion.EXTENSION_NAME = NAME$e;
var EmissiveStrength = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_EMISSIVE_STRENGTH;
    this.propertyType = "EmissiveStrength";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      emissiveStrength: 1
    });
  }
  /**********************************************************************************************
   * EmissiveStrength.
   */
  /** EmissiveStrength. */
  getEmissiveStrength() {
    return this.get("emissiveStrength");
  }
  /** EmissiveStrength. */
  setEmissiveStrength(strength) {
    return this.set("emissiveStrength", strength);
  }
};
EmissiveStrength.EXTENSION_NAME = KHR_MATERIALS_EMISSIVE_STRENGTH;
var NAME$d = KHR_MATERIALS_EMISSIVE_STRENGTH;
var KHRMaterialsEmissiveStrength = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$d;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new EmissiveStrength property for use on a {@link Material}. */
  createEmissiveStrength() {
    return new EmissiveStrength(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$d]) {
        const emissiveStrength = this.createEmissiveStrength();
        context.materials[materialIndex].setExtension(NAME$d, emissiveStrength);
        const emissiveStrengthDef = materialDef.extensions[NAME$d];
        if (emissiveStrengthDef.emissiveStrength !== void 0) {
          emissiveStrength.setEmissiveStrength(emissiveStrengthDef.emissiveStrength);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const emissiveStrength = material.getExtension(NAME$d);
      if (emissiveStrength) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[NAME$d] = {
          emissiveStrength: emissiveStrength.getEmissiveStrength()
        };
      }
    });
    return this;
  }
};
KHRMaterialsEmissiveStrength.EXTENSION_NAME = NAME$d;
var IOR = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_IOR;
    this.propertyType = "IOR";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      ior: 1.5
    });
  }
  /**********************************************************************************************
   * IOR.
   */
  /** IOR. */
  getIOR() {
    return this.get("ior");
  }
  /** IOR. */
  setIOR(ior) {
    return this.set("ior", ior);
  }
};
IOR.EXTENSION_NAME = KHR_MATERIALS_IOR;
var NAME$c = KHR_MATERIALS_IOR;
var KHRMaterialsIOR = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$c;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new IOR property for use on a {@link Material}. */
  createIOR() {
    return new IOR(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$c]) {
        const ior = this.createIOR();
        context.materials[materialIndex].setExtension(NAME$c, ior);
        const iorDef = materialDef.extensions[NAME$c];
        if (iorDef.ior !== void 0) {
          ior.setIOR(iorDef.ior);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const ior = material.getExtension(NAME$c);
      if (ior) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[NAME$c] = {
          ior: ior.getIOR()
        };
      }
    });
    return this;
  }
};
KHRMaterialsIOR.EXTENSION_NAME = NAME$c;
var {
  R: R$4,
  G: G$4
} = TextureChannel;
var Iridescence = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_IRIDESCENCE;
    this.propertyType = "Iridescence";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      iridescenceFactor: 0,
      iridescenceTexture: null,
      iridescenceTextureInfo: new TextureInfo(this.graph, "iridescenceTextureInfo"),
      iridescenceIOR: 1.3,
      iridescenceThicknessMinimum: 100,
      iridescenceThicknessMaximum: 400,
      iridescenceThicknessTexture: null,
      iridescenceThicknessTextureInfo: new TextureInfo(this.graph, "iridescenceThicknessTextureInfo")
    });
  }
  /**********************************************************************************************
   * Iridescence.
   */
  /** Iridescence; linear multiplier. See {@link Iridescence.getIridescenceTexture getIridescenceTexture}. */
  getIridescenceFactor() {
    return this.get("iridescenceFactor");
  }
  /** Iridescence; linear multiplier. See {@link Iridescence.getIridescenceTexture getIridescenceTexture}. */
  setIridescenceFactor(factor) {
    return this.set("iridescenceFactor", factor);
  }
  /**
   * Iridescence intensity.
   *
   * Only the red (R) channel is used for iridescence intensity, but this texture may optionally
   * be packed with additional data in the other channels.
   */
  getIridescenceTexture() {
    return this.getRef("iridescenceTexture");
  }
  /**
   * Settings affecting the material's use of its iridescence texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getIridescenceTextureInfo() {
    return this.getRef("iridescenceTexture") ? this.getRef("iridescenceTextureInfo") : null;
  }
  /** Iridescence intensity. See {@link Iridescence.getIridescenceTexture getIridescenceTexture}. */
  setIridescenceTexture(texture) {
    return this.setRef("iridescenceTexture", texture, {
      channels: R$4
    });
  }
  /**********************************************************************************************
   * Iridescence IOR.
   */
  /** Index of refraction of the dielectric thin-film layer. */
  getIridescenceIOR() {
    return this.get("iridescenceIOR");
  }
  /** Index of refraction of the dielectric thin-film layer. */
  setIridescenceIOR(ior) {
    return this.set("iridescenceIOR", ior);
  }
  /**********************************************************************************************
   * Iridescence thickness.
   */
  /** Minimum thickness of the thin-film layer, in nanometers (nm). */
  getIridescenceThicknessMinimum() {
    return this.get("iridescenceThicknessMinimum");
  }
  /** Minimum thickness of the thin-film layer, in nanometers (nm). */
  setIridescenceThicknessMinimum(thickness) {
    return this.set("iridescenceThicknessMinimum", thickness);
  }
  /** Maximum thickness of the thin-film layer, in nanometers (nm). */
  getIridescenceThicknessMaximum() {
    return this.get("iridescenceThicknessMaximum");
  }
  /** Maximum thickness of the thin-film layer, in nanometers (nm). */
  setIridescenceThicknessMaximum(thickness) {
    return this.set("iridescenceThicknessMaximum", thickness);
  }
  /**
   * The green channel of this texture defines the thickness of the
   * thin-film layer by blending between the minimum and maximum thickness.
   */
  getIridescenceThicknessTexture() {
    return this.getRef("iridescenceThicknessTexture");
  }
  /**
   * Settings affecting the material's use of its iridescence thickness texture.
   * If no texture is attached, {@link TextureInfo} is `null`.
   */
  getIridescenceThicknessTextureInfo() {
    return this.getRef("iridescenceThicknessTexture") ? this.getRef("iridescenceThicknessTextureInfo") : null;
  }
  /**
   * Sets iridescence thickness texture.
   * See {@link Iridescence.getIridescenceThicknessTexture getIridescenceThicknessTexture}.
   */
  setIridescenceThicknessTexture(texture) {
    return this.setRef("iridescenceThicknessTexture", texture, {
      channels: G$4
    });
  }
};
Iridescence.EXTENSION_NAME = KHR_MATERIALS_IRIDESCENCE;
var NAME$b = KHR_MATERIALS_IRIDESCENCE;
var KHRMaterialsIridescence = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$b;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Iridescence property for use on a {@link Material}. */
  createIridescence() {
    return new Iridescence(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$b]) {
        const iridescence = this.createIridescence();
        context.materials[materialIndex].setExtension(NAME$b, iridescence);
        const iridescenceDef = materialDef.extensions[NAME$b];
        if (iridescenceDef.iridescenceFactor !== void 0) {
          iridescence.setIridescenceFactor(iridescenceDef.iridescenceFactor);
        }
        if (iridescenceDef.iridescenceIor !== void 0) {
          iridescence.setIridescenceIOR(iridescenceDef.iridescenceIor);
        }
        if (iridescenceDef.iridescenceThicknessMinimum !== void 0) {
          iridescence.setIridescenceThicknessMinimum(iridescenceDef.iridescenceThicknessMinimum);
        }
        if (iridescenceDef.iridescenceThicknessMaximum !== void 0) {
          iridescence.setIridescenceThicknessMaximum(iridescenceDef.iridescenceThicknessMaximum);
        }
        if (iridescenceDef.iridescenceTexture !== void 0) {
          const textureInfoDef = iridescenceDef.iridescenceTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          iridescence.setIridescenceTexture(texture);
          context.setTextureInfo(iridescence.getIridescenceTextureInfo(), textureInfoDef);
        }
        if (iridescenceDef.iridescenceThicknessTexture !== void 0) {
          const textureInfoDef = iridescenceDef.iridescenceThicknessTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          iridescence.setIridescenceThicknessTexture(texture);
          context.setTextureInfo(iridescence.getIridescenceThicknessTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const iridescence = material.getExtension(NAME$b);
      if (iridescence) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const iridescenceDef = materialDef.extensions[NAME$b] = {};
        if (iridescence.getIridescenceFactor() > 0) {
          iridescenceDef.iridescenceFactor = iridescence.getIridescenceFactor();
        }
        if (iridescence.getIridescenceIOR() !== 1.3) {
          iridescenceDef.iridescenceIor = iridescence.getIridescenceIOR();
        }
        if (iridescence.getIridescenceThicknessMinimum() !== 100) {
          iridescenceDef.iridescenceThicknessMinimum = iridescence.getIridescenceThicknessMinimum();
        }
        if (iridescence.getIridescenceThicknessMaximum() !== 400) {
          iridescenceDef.iridescenceThicknessMaximum = iridescence.getIridescenceThicknessMaximum();
        }
        if (iridescence.getIridescenceTexture()) {
          const texture = iridescence.getIridescenceTexture();
          const textureInfo = iridescence.getIridescenceTextureInfo();
          iridescenceDef.iridescenceTexture = context.createTextureInfoDef(texture, textureInfo);
        }
        if (iridescence.getIridescenceThicknessTexture()) {
          const texture = iridescence.getIridescenceThicknessTexture();
          const textureInfo = iridescence.getIridescenceThicknessTextureInfo();
          iridescenceDef.iridescenceThicknessTexture = context.createTextureInfoDef(texture, textureInfo);
        }
      }
    });
    return this;
  }
};
KHRMaterialsIridescence.EXTENSION_NAME = NAME$b;
var {
  R: R$3,
  G: G$3,
  B: B$2,
  A: A$2
} = TextureChannel;
var PBRSpecularGlossiness = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS;
    this.propertyType = "PBRSpecularGlossiness";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      diffuseFactor: [1, 1, 1, 1],
      diffuseTexture: null,
      diffuseTextureInfo: new TextureInfo(this.graph, "diffuseTextureInfo"),
      specularFactor: [1, 1, 1],
      glossinessFactor: 1,
      specularGlossinessTexture: null,
      specularGlossinessTextureInfo: new TextureInfo(this.graph, "specularGlossinessTextureInfo")
    });
  }
  /**********************************************************************************************
   * Diffuse.
   */
  /** Diffuse; Linear-sRGB components. See {@link PBRSpecularGlossiness.getDiffuseTexture getDiffuseTexture}. */
  getDiffuseFactor() {
    return this.get("diffuseFactor");
  }
  /** Diffuse; Linear-sRGB components. See {@link PBRSpecularGlossiness.getDiffuseTexture getDiffuseTexture}. */
  setDiffuseFactor(factor) {
    return this.set("diffuseFactor", factor);
  }
  /**
   * Diffuse texture; sRGB. Alternative to baseColorTexture, used within the
   * spec/gloss PBR workflow.
   */
  getDiffuseTexture() {
    return this.getRef("diffuseTexture");
  }
  /**
   * Settings affecting the material's use of its diffuse texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getDiffuseTextureInfo() {
    return this.getRef("diffuseTexture") ? this.getRef("diffuseTextureInfo") : null;
  }
  /** Sets diffuse texture. See {@link PBRSpecularGlossiness.getDiffuseTexture getDiffuseTexture}. */
  setDiffuseTexture(texture) {
    return this.setRef("diffuseTexture", texture, {
      channels: R$3 | G$3 | B$2 | A$2,
      isColor: true
    });
  }
  /**********************************************************************************************
   * Specular.
   */
  /** Specular; linear multiplier. */
  getSpecularFactor() {
    return this.get("specularFactor");
  }
  /** Specular; linear multiplier. */
  setSpecularFactor(factor) {
    return this.set("specularFactor", factor);
  }
  /**********************************************************************************************
   * Glossiness.
   */
  /** Glossiness; linear multiplier. */
  getGlossinessFactor() {
    return this.get("glossinessFactor");
  }
  /** Glossiness; linear multiplier. */
  setGlossinessFactor(factor) {
    return this.set("glossinessFactor", factor);
  }
  /**********************************************************************************************
   * Specular/Glossiness.
   */
  /** Spec/gloss texture; linear multiplier. */
  getSpecularGlossinessTexture() {
    return this.getRef("specularGlossinessTexture");
  }
  /**
   * Settings affecting the material's use of its spec/gloss texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getSpecularGlossinessTextureInfo() {
    return this.getRef("specularGlossinessTexture") ? this.getRef("specularGlossinessTextureInfo") : null;
  }
  /** Spec/gloss texture; linear multiplier. */
  setSpecularGlossinessTexture(texture) {
    return this.setRef("specularGlossinessTexture", texture, {
      channels: R$3 | G$3 | B$2 | A$2
    });
  }
};
PBRSpecularGlossiness.EXTENSION_NAME = KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS;
var NAME$a = KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS;
var KHRMaterialsPBRSpecularGlossiness = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$a;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new PBRSpecularGlossiness property for use on a {@link Material}. */
  createPBRSpecularGlossiness() {
    return new PBRSpecularGlossiness(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$a]) {
        const specGloss = this.createPBRSpecularGlossiness();
        context.materials[materialIndex].setExtension(NAME$a, specGloss);
        const specGlossDef = materialDef.extensions[NAME$a];
        if (specGlossDef.diffuseFactor !== void 0) {
          specGloss.setDiffuseFactor(specGlossDef.diffuseFactor);
        }
        if (specGlossDef.specularFactor !== void 0) {
          specGloss.setSpecularFactor(specGlossDef.specularFactor);
        }
        if (specGlossDef.glossinessFactor !== void 0) {
          specGloss.setGlossinessFactor(specGlossDef.glossinessFactor);
        }
        if (specGlossDef.diffuseTexture !== void 0) {
          const textureInfoDef = specGlossDef.diffuseTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          specGloss.setDiffuseTexture(texture);
          context.setTextureInfo(specGloss.getDiffuseTextureInfo(), textureInfoDef);
        }
        if (specGlossDef.specularGlossinessTexture !== void 0) {
          const textureInfoDef = specGlossDef.specularGlossinessTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          specGloss.setSpecularGlossinessTexture(texture);
          context.setTextureInfo(specGloss.getSpecularGlossinessTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const specGloss = material.getExtension(NAME$a);
      if (specGloss) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const specGlossDef = materialDef.extensions[NAME$a] = {
          diffuseFactor: specGloss.getDiffuseFactor(),
          specularFactor: specGloss.getSpecularFactor(),
          glossinessFactor: specGloss.getGlossinessFactor()
        };
        if (specGloss.getDiffuseTexture()) {
          const texture = specGloss.getDiffuseTexture();
          const textureInfo = specGloss.getDiffuseTextureInfo();
          specGlossDef.diffuseTexture = context.createTextureInfoDef(texture, textureInfo);
        }
        if (specGloss.getSpecularGlossinessTexture()) {
          const texture = specGloss.getSpecularGlossinessTexture();
          const textureInfo = specGloss.getSpecularGlossinessTextureInfo();
          specGlossDef.specularGlossinessTexture = context.createTextureInfoDef(texture, textureInfo);
        }
      }
    });
    return this;
  }
};
KHRMaterialsPBRSpecularGlossiness.EXTENSION_NAME = NAME$a;
var {
  R: R$2,
  G: G$2,
  B: B$1,
  A: A$1
} = TextureChannel;
var Sheen = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_SHEEN;
    this.propertyType = "Sheen";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      sheenColorFactor: [0, 0, 0],
      sheenColorTexture: null,
      sheenColorTextureInfo: new TextureInfo(this.graph, "sheenColorTextureInfo"),
      sheenRoughnessFactor: 0,
      sheenRoughnessTexture: null,
      sheenRoughnessTextureInfo: new TextureInfo(this.graph, "sheenRoughnessTextureInfo")
    });
  }
  /**********************************************************************************************
   * Sheen color.
   */
  /** Sheen; linear multiplier. */
  getSheenColorFactor() {
    return this.get("sheenColorFactor");
  }
  /** Sheen; linear multiplier. */
  setSheenColorFactor(factor) {
    return this.set("sheenColorFactor", factor);
  }
  /**
   * Sheen color texture, in sRGB colorspace.
   */
  getSheenColorTexture() {
    return this.getRef("sheenColorTexture");
  }
  /**
   * Settings affecting the material's use of its sheen color texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getSheenColorTextureInfo() {
    return this.getRef("sheenColorTexture") ? this.getRef("sheenColorTextureInfo") : null;
  }
  /** Sets sheen color texture. See {@link Sheen.getSheenColorTexture getSheenColorTexture}. */
  setSheenColorTexture(texture) {
    return this.setRef("sheenColorTexture", texture, {
      channels: R$2 | G$2 | B$1,
      isColor: true
    });
  }
  /**********************************************************************************************
   * Sheen roughness.
   */
  /** Sheen roughness; linear multiplier. See {@link Sheen.getSheenRoughnessTexture getSheenRoughnessTexture}. */
  getSheenRoughnessFactor() {
    return this.get("sheenRoughnessFactor");
  }
  /** Sheen roughness; linear multiplier. See {@link Sheen.getSheenRoughnessTexture getSheenRoughnessTexture}. */
  setSheenRoughnessFactor(factor) {
    return this.set("sheenRoughnessFactor", factor);
  }
  /**
   * Sheen roughness texture; linear multiplier. The `a` channel of this texture specifies
   * roughness, independent of the base layer's roughness.
   */
  getSheenRoughnessTexture() {
    return this.getRef("sheenRoughnessTexture");
  }
  /**
   * Settings affecting the material's use of its sheen roughness texture. If no texture is
   * attached, {@link TextureInfo} is `null`.
   */
  getSheenRoughnessTextureInfo() {
    return this.getRef("sheenRoughnessTexture") ? this.getRef("sheenRoughnessTextureInfo") : null;
  }
  /**
   * Sets sheen roughness texture.  The `a` channel of this texture specifies
   * roughness, independent of the base layer's roughness.
   */
  setSheenRoughnessTexture(texture) {
    return this.setRef("sheenRoughnessTexture", texture, {
      channels: A$1
    });
  }
};
Sheen.EXTENSION_NAME = KHR_MATERIALS_SHEEN;
var NAME$9 = KHR_MATERIALS_SHEEN;
var KHRMaterialsSheen = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$9;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Sheen property for use on a {@link Material}. */
  createSheen() {
    return new Sheen(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$9]) {
        const sheen = this.createSheen();
        context.materials[materialIndex].setExtension(NAME$9, sheen);
        const sheenDef = materialDef.extensions[NAME$9];
        if (sheenDef.sheenColorFactor !== void 0) {
          sheen.setSheenColorFactor(sheenDef.sheenColorFactor);
        }
        if (sheenDef.sheenRoughnessFactor !== void 0) {
          sheen.setSheenRoughnessFactor(sheenDef.sheenRoughnessFactor);
        }
        if (sheenDef.sheenColorTexture !== void 0) {
          const textureInfoDef = sheenDef.sheenColorTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          sheen.setSheenColorTexture(texture);
          context.setTextureInfo(sheen.getSheenColorTextureInfo(), textureInfoDef);
        }
        if (sheenDef.sheenRoughnessTexture !== void 0) {
          const textureInfoDef = sheenDef.sheenRoughnessTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          sheen.setSheenRoughnessTexture(texture);
          context.setTextureInfo(sheen.getSheenRoughnessTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const sheen = material.getExtension(NAME$9);
      if (sheen) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const sheenDef = materialDef.extensions[NAME$9] = {
          sheenColorFactor: sheen.getSheenColorFactor(),
          sheenRoughnessFactor: sheen.getSheenRoughnessFactor()
        };
        if (sheen.getSheenColorTexture()) {
          const texture = sheen.getSheenColorTexture();
          const textureInfo = sheen.getSheenColorTextureInfo();
          sheenDef.sheenColorTexture = context.createTextureInfoDef(texture, textureInfo);
        }
        if (sheen.getSheenRoughnessTexture()) {
          const texture = sheen.getSheenRoughnessTexture();
          const textureInfo = sheen.getSheenRoughnessTextureInfo();
          sheenDef.sheenRoughnessTexture = context.createTextureInfoDef(texture, textureInfo);
        }
      }
    });
    return this;
  }
};
KHRMaterialsSheen.EXTENSION_NAME = NAME$9;
var {
  R: R$1,
  G: G$1,
  B,
  A
} = TextureChannel;
var Specular = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_SPECULAR;
    this.propertyType = "Specular";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      specularFactor: 1,
      specularTexture: null,
      specularTextureInfo: new TextureInfo(this.graph, "specularTextureInfo"),
      specularColorFactor: [1, 1, 1],
      specularColorTexture: null,
      specularColorTextureInfo: new TextureInfo(this.graph, "specularColorTextureInfo")
    });
  }
  /**********************************************************************************************
   * Specular.
   */
  /** Specular; linear multiplier. See {@link Specular.getSpecularTexture getSpecularTexture}. */
  getSpecularFactor() {
    return this.get("specularFactor");
  }
  /** Specular; linear multiplier. See {@link Specular.getSpecularTexture getSpecularTexture}. */
  setSpecularFactor(factor) {
    return this.set("specularFactor", factor);
  }
  /** Specular color; Linear-sRGB components. See {@link Specular.getSpecularTexture getSpecularTexture}. */
  getSpecularColorFactor() {
    return this.get("specularColorFactor");
  }
  /** Specular color; Linear-sRGB components. See {@link Specular.getSpecularTexture getSpecularTexture}. */
  setSpecularColorFactor(factor) {
    return this.set("specularColorFactor", factor);
  }
  /**
   * Specular texture; linear multiplier. Configures the strength of the specular reflection in
   * the dielectric BRDF. A value of zero disables the specular reflection, resulting in a pure
   * diffuse material.
   *
   * Only the alpha (A) channel is used for specular strength, but this texture may optionally
   * be packed with specular color (RGB) into a single texture.
   */
  getSpecularTexture() {
    return this.getRef("specularTexture");
  }
  /**
   * Settings affecting the material's use of its specular texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getSpecularTextureInfo() {
    return this.getRef("specularTexture") ? this.getRef("specularTextureInfo") : null;
  }
  /** Sets specular texture. See {@link Specular.getSpecularTexture getSpecularTexture}. */
  setSpecularTexture(texture) {
    return this.setRef("specularTexture", texture, {
      channels: A
    });
  }
  /**
   * Specular color texture; linear multiplier. Defines the F0 color of the specular reflection
   * (RGB channels, encoded in sRGB) in the the dielectric BRDF.
   *
   * Only RGB channels are used here, but this texture may optionally be packed with a specular
   * factor (A) into a single texture.
   */
  getSpecularColorTexture() {
    return this.getRef("specularColorTexture");
  }
  /**
   * Settings affecting the material's use of its specular color texture. If no texture is
   * attached, {@link TextureInfo} is `null`.
   */
  getSpecularColorTextureInfo() {
    return this.getRef("specularColorTexture") ? this.getRef("specularColorTextureInfo") : null;
  }
  /** Sets specular color texture. See {@link Specular.getSpecularColorTexture getSpecularColorTexture}. */
  setSpecularColorTexture(texture) {
    return this.setRef("specularColorTexture", texture, {
      channels: R$1 | G$1 | B,
      isColor: true
    });
  }
};
Specular.EXTENSION_NAME = KHR_MATERIALS_SPECULAR;
var NAME$8 = KHR_MATERIALS_SPECULAR;
var KHRMaterialsSpecular = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$8;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Specular property for use on a {@link Material}. */
  createSpecular() {
    return new Specular(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$8]) {
        const specular = this.createSpecular();
        context.materials[materialIndex].setExtension(NAME$8, specular);
        const specularDef = materialDef.extensions[NAME$8];
        if (specularDef.specularFactor !== void 0) {
          specular.setSpecularFactor(specularDef.specularFactor);
        }
        if (specularDef.specularColorFactor !== void 0) {
          specular.setSpecularColorFactor(specularDef.specularColorFactor);
        }
        if (specularDef.specularTexture !== void 0) {
          const textureInfoDef = specularDef.specularTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          specular.setSpecularTexture(texture);
          context.setTextureInfo(specular.getSpecularTextureInfo(), textureInfoDef);
        }
        if (specularDef.specularColorTexture !== void 0) {
          const textureInfoDef = specularDef.specularColorTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          specular.setSpecularColorTexture(texture);
          context.setTextureInfo(specular.getSpecularColorTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const specular = material.getExtension(NAME$8);
      if (specular) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const specularDef = materialDef.extensions[NAME$8] = {};
        if (specular.getSpecularFactor() !== 1) {
          specularDef.specularFactor = specular.getSpecularFactor();
        }
        if (!MathUtils.eq(specular.getSpecularColorFactor(), [1, 1, 1])) {
          specularDef.specularColorFactor = specular.getSpecularColorFactor();
        }
        if (specular.getSpecularTexture()) {
          const texture = specular.getSpecularTexture();
          const textureInfo = specular.getSpecularTextureInfo();
          specularDef.specularTexture = context.createTextureInfoDef(texture, textureInfo);
        }
        if (specular.getSpecularColorTexture()) {
          const texture = specular.getSpecularColorTexture();
          const textureInfo = specular.getSpecularColorTextureInfo();
          specularDef.specularColorTexture = context.createTextureInfoDef(texture, textureInfo);
        }
      }
    });
    return this;
  }
};
KHRMaterialsSpecular.EXTENSION_NAME = NAME$8;
var {
  R
} = TextureChannel;
var Transmission = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_TRANSMISSION;
    this.propertyType = "Transmission";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      transmissionFactor: 0,
      transmissionTexture: null,
      transmissionTextureInfo: new TextureInfo(this.graph, "transmissionTextureInfo")
    });
  }
  /**********************************************************************************************
   * Transmission.
   */
  /** Transmission; linear multiplier. See {@link Transmission.getTransmissionTexture getTransmissionTexture}. */
  getTransmissionFactor() {
    return this.get("transmissionFactor");
  }
  /** Transmission; linear multiplier. See {@link Transmission.getTransmissionTexture getTransmissionTexture}. */
  setTransmissionFactor(factor) {
    return this.set("transmissionFactor", factor);
  }
  /**
   * Transmission texture; linear multiplier. The `r` channel of this texture specifies
   * transmission [0-1] of the material's surface. By default this is a thin transparency
   * effect, but volume effects (refraction, subsurface scattering) may be introduced with the
   * addition of the `KHR_materials_volume` extension.
   */
  getTransmissionTexture() {
    return this.getRef("transmissionTexture");
  }
  /**
   * Settings affecting the material's use of its transmission texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getTransmissionTextureInfo() {
    return this.getRef("transmissionTexture") ? this.getRef("transmissionTextureInfo") : null;
  }
  /** Sets transmission texture. See {@link Transmission.getTransmissionTexture getTransmissionTexture}. */
  setTransmissionTexture(texture) {
    return this.setRef("transmissionTexture", texture, {
      channels: R
    });
  }
};
Transmission.EXTENSION_NAME = KHR_MATERIALS_TRANSMISSION;
var NAME$7 = KHR_MATERIALS_TRANSMISSION;
var KHRMaterialsTransmission = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$7;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Transmission property for use on a {@link Material}. */
  createTransmission() {
    return new Transmission(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$7]) {
        const transmission = this.createTransmission();
        context.materials[materialIndex].setExtension(NAME$7, transmission);
        const transmissionDef = materialDef.extensions[NAME$7];
        if (transmissionDef.transmissionFactor !== void 0) {
          transmission.setTransmissionFactor(transmissionDef.transmissionFactor);
        }
        if (transmissionDef.transmissionTexture !== void 0) {
          const textureInfoDef = transmissionDef.transmissionTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          transmission.setTransmissionTexture(texture);
          context.setTextureInfo(transmission.getTransmissionTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const transmission = material.getExtension(NAME$7);
      if (transmission) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const transmissionDef = materialDef.extensions[NAME$7] = {
          transmissionFactor: transmission.getTransmissionFactor()
        };
        if (transmission.getTransmissionTexture()) {
          const texture = transmission.getTransmissionTexture();
          const textureInfo = transmission.getTransmissionTextureInfo();
          transmissionDef.transmissionTexture = context.createTextureInfoDef(texture, textureInfo);
        }
      }
    });
    return this;
  }
};
KHRMaterialsTransmission.EXTENSION_NAME = NAME$7;
var Unlit = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_UNLIT;
    this.propertyType = "Unlit";
    this.parentTypes = [PropertyType.MATERIAL];
  }
};
Unlit.EXTENSION_NAME = KHR_MATERIALS_UNLIT;
var NAME$6 = KHR_MATERIALS_UNLIT;
var KHRMaterialsUnlit = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$6;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Unlit property for use on a {@link Material}. */
  createUnlit() {
    return new Unlit(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const materialDefs = context.jsonDoc.json.materials || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$6]) {
        context.materials[materialIndex].setExtension(NAME$6, this.createUnlit());
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      if (material.getExtension(NAME$6)) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[NAME$6] = {};
      }
    });
    return this;
  }
};
KHRMaterialsUnlit.EXTENSION_NAME = NAME$6;
var Mapping = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_VARIANTS;
    this.propertyType = "Mapping";
    this.parentTypes = ["MappingList"];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      material: null,
      variants: new RefSet()
    });
  }
  /** The {@link Material} designated for this {@link Primitive}, under the given variants. */
  getMaterial() {
    return this.getRef("material");
  }
  /** The {@link Material} designated for this {@link Primitive}, under the given variants. */
  setMaterial(material) {
    return this.setRef("material", material);
  }
  /** Adds a {@link Variant} to this mapping. */
  addVariant(variant) {
    return this.addRef("variants", variant);
  }
  /** Removes a {@link Variant} from this mapping. */
  removeVariant(variant) {
    return this.removeRef("variants", variant);
  }
  /** Lists {@link Variant}s in this mapping. */
  listVariants() {
    return this.listRefs("variants");
  }
};
Mapping.EXTENSION_NAME = KHR_MATERIALS_VARIANTS;
var MappingList = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_VARIANTS;
    this.propertyType = "MappingList";
    this.parentTypes = [PropertyType.PRIMITIVE];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      mappings: new RefSet()
    });
  }
  /** Adds a {@link Mapping} to this mapping. */
  addMapping(mapping) {
    return this.addRef("mappings", mapping);
  }
  /** Removes a {@link Mapping} from the list for this {@link Primitive}. */
  removeMapping(mapping) {
    return this.removeRef("mappings", mapping);
  }
  /** Lists {@link Mapping}s in this {@link Primitive}. */
  listMappings() {
    return this.listRefs("mappings");
  }
};
MappingList.EXTENSION_NAME = KHR_MATERIALS_VARIANTS;
var Variant = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_VARIANTS;
    this.propertyType = "Variant";
    this.parentTypes = ["MappingList"];
  }
};
Variant.EXTENSION_NAME = KHR_MATERIALS_VARIANTS;
var NAME$5 = KHR_MATERIALS_VARIANTS;
var KHRMaterialsVariants = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$5;
  }
  /** Creates a new MappingList property. */
  createMappingList() {
    return new MappingList(this.document.getGraph());
  }
  /** Creates a new Variant property. */
  createVariant(name = "") {
    return new Variant(this.document.getGraph(), name);
  }
  /** Creates a new Mapping property. */
  createMapping() {
    return new Mapping(this.document.getGraph());
  }
  /** Lists all Variants on the current Document. */
  listVariants() {
    return Array.from(this.properties).filter((prop) => prop instanceof Variant);
  }
  /** @hidden */
  read(context) {
    const jsonDoc = context.jsonDoc;
    if (!jsonDoc.json.extensions || !jsonDoc.json.extensions[NAME$5]) return this;
    const variantsRootDef = jsonDoc.json.extensions[NAME$5];
    const variantDefs = variantsRootDef.variants || [];
    const variants = variantDefs.map((variantDef) => this.createVariant().setName(variantDef.name || ""));
    const meshDefs = jsonDoc.json.meshes || [];
    meshDefs.forEach((meshDef, meshIndex) => {
      const mesh = context.meshes[meshIndex];
      const primDefs = meshDef.primitives || [];
      primDefs.forEach((primDef, primIndex) => {
        if (!primDef.extensions || !primDef.extensions[NAME$5]) {
          return;
        }
        const mappingList = this.createMappingList();
        const variantPrimDef = primDef.extensions[NAME$5];
        for (const mappingDef of variantPrimDef.mappings) {
          const mapping = this.createMapping();
          if (mappingDef.material !== void 0) {
            mapping.setMaterial(context.materials[mappingDef.material]);
          }
          for (const variantIndex of mappingDef.variants || []) {
            mapping.addVariant(variants[variantIndex]);
          }
          mappingList.addMapping(mapping);
        }
        mesh.listPrimitives()[primIndex].setExtension(NAME$5, mappingList);
      });
    });
    return this;
  }
  /** @hidden */
  write(context) {
    const jsonDoc = context.jsonDoc;
    const variants = this.listVariants();
    if (!variants.length) return this;
    const variantDefs = [];
    const variantIndexMap = /* @__PURE__ */ new Map();
    for (const variant of variants) {
      variantIndexMap.set(variant, variantDefs.length);
      variantDefs.push(context.createPropertyDef(variant));
    }
    for (const mesh of this.document.getRoot().listMeshes()) {
      const meshIndex = context.meshIndexMap.get(mesh);
      mesh.listPrimitives().forEach((prim, primIndex) => {
        const mappingList = prim.getExtension(NAME$5);
        if (!mappingList) return;
        const primDef = context.jsonDoc.json.meshes[meshIndex].primitives[primIndex];
        const mappingDefs = mappingList.listMappings().map((mapping) => {
          const mappingDef = context.createPropertyDef(mapping);
          const material = mapping.getMaterial();
          if (material) {
            mappingDef.material = context.materialIndexMap.get(material);
          }
          mappingDef.variants = mapping.listVariants().map((variant) => variantIndexMap.get(variant));
          return mappingDef;
        });
        primDef.extensions = primDef.extensions || {};
        primDef.extensions[NAME$5] = {
          mappings: mappingDefs
        };
      });
    }
    jsonDoc.json.extensions = jsonDoc.json.extensions || {};
    jsonDoc.json.extensions[NAME$5] = {
      variants: variantDefs
    };
    return this;
  }
};
KHRMaterialsVariants.EXTENSION_NAME = NAME$5;
var {
  G
} = TextureChannel;
var Volume = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_MATERIALS_VOLUME;
    this.propertyType = "Volume";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      thicknessFactor: 0,
      thicknessTexture: null,
      thicknessTextureInfo: new TextureInfo(this.graph, "thicknessTexture"),
      attenuationDistance: Infinity,
      attenuationColor: [1, 1, 1]
    });
  }
  /**********************************************************************************************
   * Thickness.
   */
  /**
   * Thickness of the volume beneath the surface in meters in the local coordinate system of the
   * node. If the value is 0 the material is thin-walled. Otherwise the material is a volume
   * boundary. The doubleSided property has no effect on volume boundaries.
   */
  getThicknessFactor() {
    return this.get("thicknessFactor");
  }
  /**
   * Thickness of the volume beneath the surface in meters in the local coordinate system of the
   * node. If the value is 0 the material is thin-walled. Otherwise the material is a volume
   * boundary. The doubleSided property has no effect on volume boundaries.
   */
  setThicknessFactor(factor) {
    return this.set("thicknessFactor", factor);
  }
  /**
   * Texture that defines the thickness, stored in the G channel. This will be multiplied by
   * thicknessFactor.
   */
  getThicknessTexture() {
    return this.getRef("thicknessTexture");
  }
  /**
   * Settings affecting the material's use of its thickness texture. If no texture is attached,
   * {@link TextureInfo} is `null`.
   */
  getThicknessTextureInfo() {
    return this.getRef("thicknessTexture") ? this.getRef("thicknessTextureInfo") : null;
  }
  /**
   * Texture that defines the thickness, stored in the G channel. This will be multiplied by
   * thicknessFactor.
   */
  setThicknessTexture(texture) {
    return this.setRef("thicknessTexture", texture, {
      channels: G
    });
  }
  /**********************************************************************************************
   * Attenuation.
   */
  /**
   * Density of the medium given as the average distance in meters that light travels in the
   * medium before interacting with a particle.
   */
  getAttenuationDistance() {
    return this.get("attenuationDistance");
  }
  /**
   * Density of the medium given as the average distance in meters that light travels in the
   * medium before interacting with a particle.
   */
  setAttenuationDistance(distance) {
    return this.set("attenuationDistance", distance);
  }
  /**
   * Color (linear) that white light turns into due to absorption when reaching the attenuation
   * distance.
   */
  getAttenuationColor() {
    return this.get("attenuationColor");
  }
  /**
   * Color (linear) that white light turns into due to absorption when reaching the attenuation
   * distance.
   */
  setAttenuationColor(color) {
    return this.set("attenuationColor", color);
  }
};
Volume.EXTENSION_NAME = KHR_MATERIALS_VOLUME;
var NAME$4 = KHR_MATERIALS_VOLUME;
var KHRMaterialsVolume = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$4;
    this.prereadTypes = [PropertyType.MESH];
    this.prewriteTypes = [PropertyType.MESH];
  }
  /** Creates a new Volume property for use on a {@link Material}. */
  createVolume() {
    return new Volume(this.document.getGraph());
  }
  /** @hidden */
  read(_context) {
    return this;
  }
  /** @hidden */
  write(_context) {
    return this;
  }
  /** @hidden */
  preread(context) {
    const jsonDoc = context.jsonDoc;
    const materialDefs = jsonDoc.json.materials || [];
    const textureDefs = jsonDoc.json.textures || [];
    materialDefs.forEach((materialDef, materialIndex) => {
      if (materialDef.extensions && materialDef.extensions[NAME$4]) {
        const volume = this.createVolume();
        context.materials[materialIndex].setExtension(NAME$4, volume);
        const volumeDef = materialDef.extensions[NAME$4];
        if (volumeDef.thicknessFactor !== void 0) {
          volume.setThicknessFactor(volumeDef.thicknessFactor);
        }
        if (volumeDef.attenuationDistance !== void 0) {
          volume.setAttenuationDistance(volumeDef.attenuationDistance);
        }
        if (volumeDef.attenuationColor !== void 0) {
          volume.setAttenuationColor(volumeDef.attenuationColor);
        }
        if (volumeDef.thicknessTexture !== void 0) {
          const textureInfoDef = volumeDef.thicknessTexture;
          const texture = context.textures[textureDefs[textureInfoDef.index].source];
          volume.setThicknessTexture(texture);
          context.setTextureInfo(volume.getThicknessTextureInfo(), textureInfoDef);
        }
      }
    });
    return this;
  }
  /** @hidden */
  prewrite(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listMaterials().forEach((material) => {
      const volume = material.getExtension(NAME$4);
      if (volume) {
        const materialIndex = context.materialIndexMap.get(material);
        const materialDef = jsonDoc.json.materials[materialIndex];
        materialDef.extensions = materialDef.extensions || {};
        const volumeDef = materialDef.extensions[NAME$4] = {};
        if (volume.getThicknessFactor() > 0) {
          volumeDef.thicknessFactor = volume.getThicknessFactor();
        }
        if (Number.isFinite(volume.getAttenuationDistance())) {
          volumeDef.attenuationDistance = volume.getAttenuationDistance();
        }
        if (!MathUtils.eq(volume.getAttenuationColor(), [1, 1, 1])) {
          volumeDef.attenuationColor = volume.getAttenuationColor();
        }
        if (volume.getThicknessTexture()) {
          const texture = volume.getThicknessTexture();
          const textureInfo = volume.getThicknessTextureInfo();
          volumeDef.thicknessTexture = context.createTextureInfoDef(texture, textureInfo);
        }
      }
    });
    return this;
  }
};
KHRMaterialsVolume.EXTENSION_NAME = NAME$4;
var NAME$3 = KHR_MESH_QUANTIZATION;
var KHRMeshQuantization = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$3;
  }
  /** @hidden */
  read(_) {
    return this;
  }
  /** @hidden */
  write(_) {
    return this;
  }
};
KHRMeshQuantization.EXTENSION_NAME = NAME$3;
var NAME$2 = KHR_TEXTURE_BASISU;
var KTX2ImageUtils = class {
  match(array) {
    return array[0] === 171 && array[1] === 75 && array[2] === 84 && array[3] === 88 && array[4] === 32 && array[5] === 50 && array[6] === 48 && array[7] === 187 && array[8] === 13 && array[9] === 10 && array[10] === 26 && array[11] === 10;
  }
  getSize(array) {
    const container = read(array);
    return [container.pixelWidth, container.pixelHeight];
  }
  getChannels(array) {
    const container = read(array);
    const dfd = container.dataFormatDescriptor[0];
    if (dfd.colorModel === KHR_DF_MODEL_ETC1S) {
      return dfd.samples.length === 2 && (dfd.samples[1].channelType & 15) === 15 ? 4 : 3;
    } else if (dfd.colorModel === KHR_DF_MODEL_UASTC) {
      return (dfd.samples[0].channelType & 15) === 3 ? 4 : 3;
    }
    throw new Error(`Unexpected KTX2 colorModel, "${dfd.colorModel}".`);
  }
  getVRAMByteLength(array) {
    const container = read(array);
    const hasAlpha = this.getChannels(array) > 3;
    let uncompressedBytes = 0;
    for (let i = 0; i < container.levels.length; i++) {
      const level = container.levels[i];
      if (level.uncompressedByteLength) {
        uncompressedBytes += level.uncompressedByteLength;
      } else {
        const levelWidth = Math.max(1, Math.floor(container.pixelWidth / Math.pow(2, i)));
        const levelHeight = Math.max(1, Math.floor(container.pixelHeight / Math.pow(2, i)));
        const blockSize = hasAlpha ? 16 : 8;
        uncompressedBytes += levelWidth / 4 * (levelHeight / 4) * blockSize;
      }
    }
    return uncompressedBytes;
  }
};
var KHRTextureBasisu = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$2;
    this.prereadTypes = [PropertyType.TEXTURE];
  }
  /** @hidden */
  static register() {
    ImageUtils.registerFormat("image/ktx2", new KTX2ImageUtils());
  }
  /** @hidden */
  preread(context) {
    context.jsonDoc.json.textures.forEach((textureDef) => {
      if (textureDef.extensions && textureDef.extensions[NAME$2]) {
        const basisuDef = textureDef.extensions[NAME$2];
        textureDef.source = basisuDef.source;
      }
    });
    return this;
  }
  /** @hidden */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  read(context) {
    return this;
  }
  /** @hidden */
  write(context) {
    const jsonDoc = context.jsonDoc;
    this.document.getRoot().listTextures().forEach((texture) => {
      if (texture.getMimeType() === "image/ktx2") {
        const imageIndex = context.imageIndexMap.get(texture);
        jsonDoc.json.textures.forEach((textureDef) => {
          if (textureDef.source === imageIndex) {
            textureDef.extensions = textureDef.extensions || {};
            textureDef.extensions[NAME$2] = {
              source: textureDef.source
            };
            delete textureDef.source;
          }
        });
      }
    });
    return this;
  }
};
KHRTextureBasisu.EXTENSION_NAME = NAME$2;
var Transform = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_TEXTURE_TRANSFORM;
    this.propertyType = "Transform";
    this.parentTypes = [PropertyType.TEXTURE_INFO];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      offset: [0, 0],
      rotation: 0,
      scale: [1, 1],
      texCoord: null
    });
  }
  getOffset() {
    return this.get("offset");
  }
  setOffset(offset) {
    return this.set("offset", offset);
  }
  getRotation() {
    return this.get("rotation");
  }
  setRotation(rotation) {
    return this.set("rotation", rotation);
  }
  getScale() {
    return this.get("scale");
  }
  setScale(scale) {
    return this.set("scale", scale);
  }
  getTexCoord() {
    return this.get("texCoord");
  }
  setTexCoord(texCoord) {
    return this.set("texCoord", texCoord);
  }
};
Transform.EXTENSION_NAME = KHR_TEXTURE_TRANSFORM;
var NAME$1 = KHR_TEXTURE_TRANSFORM;
var KHRTextureTransform = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME$1;
  }
  /** Creates a new Transform property for use on a {@link TextureInfo}. */
  createTransform() {
    return new Transform(this.document.getGraph());
  }
  /** @hidden */
  read(context) {
    for (const [textureInfo, textureInfoDef] of Array.from(context.textureInfos.entries())) {
      if (!textureInfoDef.extensions || !textureInfoDef.extensions[NAME$1]) continue;
      const transform = this.createTransform();
      const transformDef = textureInfoDef.extensions[NAME$1];
      if (transformDef.offset !== void 0) transform.setOffset(transformDef.offset);
      if (transformDef.rotation !== void 0) transform.setRotation(transformDef.rotation);
      if (transformDef.scale !== void 0) transform.setScale(transformDef.scale);
      if (transformDef.texCoord !== void 0) transform.setTexCoord(transformDef.texCoord);
      textureInfo.setExtension(NAME$1, transform);
    }
    return this;
  }
  /** @hidden */
  write(context) {
    const textureInfoEntries = Array.from(context.textureInfoDefMap.entries());
    for (const [textureInfo, textureInfoDef] of textureInfoEntries) {
      const transform = textureInfo.getExtension(NAME$1);
      if (!transform) continue;
      textureInfoDef.extensions = textureInfoDef.extensions || {};
      const transformDef = {};
      const eq = MathUtils.eq;
      if (!eq(transform.getOffset(), [0, 0])) transformDef.offset = transform.getOffset();
      if (transform.getRotation() !== 0) transformDef.rotation = transform.getRotation();
      if (!eq(transform.getScale(), [1, 1])) transformDef.scale = transform.getScale();
      if (transform.getTexCoord() != null) transformDef.texCoord = transform.getTexCoord();
      textureInfoDef.extensions[NAME$1] = transformDef;
    }
    return this;
  }
};
KHRTextureTransform.EXTENSION_NAME = NAME$1;
var PARENT_TYPES = [PropertyType.ROOT, PropertyType.SCENE, PropertyType.NODE, PropertyType.MESH, PropertyType.MATERIAL, PropertyType.TEXTURE, PropertyType.ANIMATION];
var Packet = class extends ExtensionProperty {
  init() {
    this.extensionName = KHR_XMP_JSON_LD;
    this.propertyType = "Packet";
    this.parentTypes = PARENT_TYPES;
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      context: {},
      properties: {}
    });
  }
  /**********************************************************************************************
   * Context.
   */
  /**
   * Returns the XMP context definition URL for the given term.
   * See: https://json-ld.org/spec/latest/json-ld/#the-context
   * @param term Case-sensitive term. Usually a concise, lowercase, alphanumeric identifier.
   */
  getContext() {
    return this.get("context");
  }
  /**
   * Sets the XMP context definition URL for the given term.
   * See: https://json-ld.org/spec/latest/json-ld/#the-context
   *
   * Example:
   *
   * ```typescript
   * packet.setContext({
   *   dc: 'http://purl.org/dc/elements/1.1/',
   *   model3d: 'https://schema.khronos.org/model3d/xsd/1.0/',
   * });
   * ```
   *
   * @param term Case-sensitive term. Usually a concise, lowercase, alphanumeric identifier.
   * @param definition URI for XMP namespace.
   */
  setContext(context) {
    return this.set("context", _extends({}, context));
  }
  /**********************************************************************************************
   * Properties.
   */
  /**
   * Lists properties defined in this packet.
   *
   * Example:
   *
   * ```typescript
   * packet.listProperties(); // → ['dc:Language', 'dc:Creator', 'xmp:CreateDate']
   * ```
   */
  listProperties() {
    return Object.keys(this.get("properties"));
  }
  /**
   * Returns the value of a property, as a literal or JSONLD object.
   *
   * Example:
   *
   * ```typescript
   * packet.getProperty('dc:Creator'); // → {"@list": ["Acme, Inc."]}
   * packet.getProperty('dc:Title'); // → {"@type": "rdf:Alt", "rdf:_1": {"@language": "en-US", "@value": "Lamp"}}
   * packet.getProperty('xmp:CreateDate'); // → "2022-01-01"
   * ```
   */
  getProperty(name) {
    const properties = this.get("properties");
    return name in properties ? properties[name] : null;
  }
  /**
   * Sets the value of a property, as a literal or JSONLD object.
   *
   * Example:
   *
   * ```typescript
   * packet.setProperty('dc:Creator', {'@list': ['Acme, Inc.']});
   * packet.setProperty('dc:Title', {
   * 	'@type': 'rdf:Alt',
   * 	'rdf:_1': {'@language': 'en-US', '@value': 'Lamp'}
   * });
   * packet.setProperty('model3d:preferredSurfaces', {'@list': ['vertical']});
   * ```
   */
  setProperty(name, value) {
    this._assertContext(name);
    const properties = _extends({}, this.get("properties"));
    if (value) {
      properties[name] = value;
    } else {
      delete properties[name];
    }
    return this.set("properties", properties);
  }
  /**********************************************************************************************
   * Serialize / Deserialize.
   */
  /**
   * Serializes the packet context and properties to a JSONLD object.
   */
  toJSONLD() {
    const context = copyJSON(this.get("context"));
    const properties = copyJSON(this.get("properties"));
    return _extends({
      "@context": context
    }, properties);
  }
  /**
   * Deserializes a JSONLD packet, then overwrites existing context and properties with
   * the new values.
   */
  fromJSONLD(jsonld) {
    jsonld = copyJSON(jsonld);
    const context = jsonld["@context"];
    if (context) this.set("context", context);
    delete jsonld["@context"];
    return this.set("properties", jsonld);
  }
  /**********************************************************************************************
   * Validation.
   */
  /** @hidden */
  _assertContext(name) {
    const prefix = name.split(":")[0];
    if (!(prefix in this.get("context"))) {
      throw new Error(`${KHR_XMP_JSON_LD}: Missing context for term, "${name}".`);
    }
  }
};
Packet.EXTENSION_NAME = KHR_XMP_JSON_LD;
function copyJSON(object) {
  return JSON.parse(JSON.stringify(object));
}
var NAME = KHR_XMP_JSON_LD;
var KHRXMP = class extends Extension {
  constructor(...args) {
    super(...args);
    this.extensionName = NAME;
  }
  /** Creates a new XMP packet, to be linked with a {@link Document} or {@link Property Properties}. */
  createPacket() {
    return new Packet(this.document.getGraph());
  }
  /** Lists XMP packets currently defined in a {@link Document}. */
  listPackets() {
    return Array.from(this.properties);
  }
  /** @hidden */
  read(context) {
    var _context$jsonDoc$json;
    const extensionDef = (_context$jsonDoc$json = context.jsonDoc.json.extensions) == null ? void 0 : _context$jsonDoc$json[NAME];
    if (!extensionDef || !extensionDef.packets) return this;
    const json = context.jsonDoc.json;
    const root = this.document.getRoot();
    const packets = extensionDef.packets.map((packetDef) => this.createPacket().fromJSONLD(packetDef));
    const defLists = [[json.asset], json.scenes, json.nodes, json.meshes, json.materials, json.images, json.animations];
    const propertyLists = [[root], root.listScenes(), root.listNodes(), root.listMeshes(), root.listMaterials(), root.listTextures(), root.listAnimations()];
    for (let i = 0; i < defLists.length; i++) {
      const defs = defLists[i] || [];
      for (let j = 0; j < defs.length; j++) {
        const def = defs[j];
        if (def.extensions && def.extensions[NAME]) {
          const xmpDef = def.extensions[NAME];
          propertyLists[i][j].setExtension(NAME, packets[xmpDef.packet]);
        }
      }
    }
    return this;
  }
  /** @hidden */
  write(context) {
    const {
      json
    } = context.jsonDoc;
    const packetDefs = [];
    for (const packet of this.properties) {
      packetDefs.push(packet.toJSONLD());
      for (const parent of packet.listParents()) {
        let parentDef;
        switch (parent.propertyType) {
          case PropertyType.ROOT:
            parentDef = json.asset;
            break;
          case PropertyType.SCENE:
            parentDef = json.scenes[context.sceneIndexMap.get(parent)];
            break;
          case PropertyType.NODE:
            parentDef = json.nodes[context.nodeIndexMap.get(parent)];
            break;
          case PropertyType.MESH:
            parentDef = json.meshes[context.meshIndexMap.get(parent)];
            break;
          case PropertyType.MATERIAL:
            parentDef = json.materials[context.materialIndexMap.get(parent)];
            break;
          case PropertyType.TEXTURE:
            parentDef = json.images[context.imageIndexMap.get(parent)];
            break;
          case PropertyType.ANIMATION:
            parentDef = json.animations[context.animationIndexMap.get(parent)];
            break;
          default:
            parentDef = null;
            this.document.getLogger().warn(`[${NAME}]: Unsupported parent property, "${parent.propertyType}"`);
            break;
        }
        if (!parentDef) continue;
        parentDef.extensions = parentDef.extensions || {};
        parentDef.extensions[NAME] = {
          packet: packetDefs.length - 1
        };
      }
    }
    if (packetDefs.length > 0) {
      json.extensions = json.extensions || {};
      json.extensions[NAME] = {
        packets: packetDefs
      };
    }
    return this;
  }
};
KHRXMP.EXTENSION_NAME = NAME;
var KHRONOS_EXTENSIONS = [KHRDracoMeshCompression, KHRLightsPunctual, KHRMaterialsAnisotropy, KHRMaterialsClearcoat, KHRMaterialsDiffuseTransmission, KHRMaterialsDispersion, KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsIridescence, KHRMaterialsPBRSpecularGlossiness, KHRMaterialsSpecular, KHRMaterialsSheen, KHRMaterialsTransmission, KHRMaterialsUnlit, KHRMaterialsVariants, KHRMaterialsVolume, KHRMeshQuantization, KHRTextureBasisu, KHRTextureTransform, KHRXMP];
var ALL_EXTENSIONS = [EXTMeshGPUInstancing, EXTMeshoptCompression, EXTTextureAVIF, EXTTextureWebP, ...KHRONOS_EXTENSIONS];
export {
  ALL_EXTENSIONS,
  Anisotropy,
  Clearcoat,
  DiffuseTransmission,
  Dispersion,
  EXTMeshGPUInstancing,
  EXTMeshoptCompression,
  EXTTextureAVIF,
  EXTTextureWebP,
  EmissiveStrength,
  INSTANCE_ATTRIBUTE,
  IOR,
  InstancedMesh,
  Iridescence,
  KHRDracoMeshCompression,
  KHRLightsPunctual,
  KHRMaterialsAnisotropy,
  KHRMaterialsClearcoat,
  KHRMaterialsDiffuseTransmission,
  KHRMaterialsDispersion,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsIridescence,
  KHRMaterialsPBRSpecularGlossiness,
  KHRMaterialsSheen,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVariants,
  KHRMaterialsVolume,
  KHRMeshQuantization,
  KHRONOS_EXTENSIONS,
  KHRTextureBasisu,
  KHRTextureTransform,
  KHRXMP,
  Light,
  Mapping,
  MappingList,
  PBRSpecularGlossiness,
  Packet,
  Sheen,
  Specular,
  Transform,
  Transmission,
  Unlit,
  Variant,
  Volume
};
