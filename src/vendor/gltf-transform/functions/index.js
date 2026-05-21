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

// node_modules/iota-array/iota.js
var require_iota = __commonJS({
  "node_modules/iota-array/iota.js"(exports, module) {
    "use strict";
    function iota(n2) {
      var result = new Array(n2);
      for (var i = 0; i < n2; ++i) {
        result[i] = i;
      }
      return result;
    }
    module.exports = iota;
  }
});

// node_modules/is-buffer/index.js
var require_is_buffer = __commonJS({
  "node_modules/is-buffer/index.js"(exports, module) {
    module.exports = function(obj) {
      return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer);
    };
    function isBuffer(obj) {
      return !!obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj);
    }
    function isSlowBuffer(obj) {
      return typeof obj.readFloatLE === "function" && typeof obj.slice === "function" && isBuffer(obj.slice(0, 0));
    }
  }
});

// node_modules/ndarray/ndarray.js
var require_ndarray = __commonJS({
  "node_modules/ndarray/ndarray.js"(exports, module) {
    var iota = require_iota();
    var isBuffer = require_is_buffer();
    var hasTypedArrays = typeof Float64Array !== "undefined";
    function compare1st(a2, b) {
      return a2[0] - b[0];
    }
    function order() {
      var stride = this.stride;
      var terms = new Array(stride.length);
      var i;
      for (i = 0; i < terms.length; ++i) {
        terms[i] = [Math.abs(stride[i]), i];
      }
      terms.sort(compare1st);
      var result = new Array(terms.length);
      for (i = 0; i < result.length; ++i) {
        result[i] = terms[i][1];
      }
      return result;
    }
    function compileConstructor(dtype, dimension) {
      var className = ["View", dimension, "d", dtype].join("");
      if (dimension < 0) {
        className = "View_Nil" + dtype;
      }
      var useGetters = dtype === "generic";
      if (dimension === -1) {
        var code = "function " + className + "(a){this.data=a;};var proto=" + className + ".prototype;proto.dtype='" + dtype + "';proto.index=function(){return -1};proto.size=0;proto.dimension=-1;proto.shape=proto.stride=proto.order=[];proto.lo=proto.hi=proto.transpose=proto.step=function(){return new " + className + "(this.data);};proto.get=proto.set=function(){};proto.pick=function(){return null};return function construct_" + className + "(a){return new " + className + "(a);}";
        var procedure = new Function(code);
        return procedure();
      } else if (dimension === 0) {
        var code = "function " + className + "(a,d) {this.data = a;this.offset = d};var proto=" + className + ".prototype;proto.dtype='" + dtype + "';proto.index=function(){return this.offset};proto.dimension=0;proto.size=1;proto.shape=proto.stride=proto.order=[];proto.lo=proto.hi=proto.transpose=proto.step=function " + className + "_copy() {return new " + className + "(this.data,this.offset)};proto.pick=function " + className + "_pick(){return TrivialArray(this.data);};proto.valueOf=proto.get=function " + className + "_get(){return " + (useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]") + "};proto.set=function " + className + "_set(v){return " + (useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v") + "};return function construct_" + className + "(a,b,c,d){return new " + className + "(a,d)}";
        var procedure = new Function("TrivialArray", code);
        return procedure(CACHED_CONSTRUCTORS[dtype][0]);
      }
      var code = ["'use strict'"];
      var indices = iota(dimension);
      var args = indices.map(function(i2) {
        return "i" + i2;
      });
      var index_str = "this.offset+" + indices.map(function(i2) {
        return "this.stride[" + i2 + "]*i" + i2;
      }).join("+");
      var shapeArg = indices.map(function(i2) {
        return "b" + i2;
      }).join(",");
      var strideArg = indices.map(function(i2) {
        return "c" + i2;
      }).join(",");
      code.push(
        "function " + className + "(a," + shapeArg + "," + strideArg + ",d){this.data=a",
        "this.shape=[" + shapeArg + "]",
        "this.stride=[" + strideArg + "]",
        "this.offset=d|0}",
        "var proto=" + className + ".prototype",
        "proto.dtype='" + dtype + "'",
        "proto.dimension=" + dimension
      );
      code.push(
        "Object.defineProperty(proto,'size',{get:function " + className + "_size(){return " + indices.map(function(i2) {
          return "this.shape[" + i2 + "]";
        }).join("*"),
        "}})"
      );
      if (dimension === 1) {
        code.push("proto.order=[0]");
      } else {
        code.push("Object.defineProperty(proto,'order',{get:");
        if (dimension < 4) {
          code.push("function " + className + "_order(){");
          if (dimension === 2) {
            code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})");
          } else if (dimension === 3) {
            code.push(
              "var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);if(s0>s1){if(s1>s2){return [2,1,0];}else if(s0>s2){return [1,2,0];}else{return [1,0,2];}}else if(s0>s2){return [2,0,1];}else if(s2>s1){return [0,1,2];}else{return [0,2,1];}}})"
            );
          }
        } else {
          code.push("ORDER})");
        }
      }
      code.push(
        "proto.set=function " + className + "_set(" + args.join(",") + ",v){"
      );
      if (useGetters) {
        code.push("return this.data.set(" + index_str + ",v)}");
      } else {
        code.push("return this.data[" + index_str + "]=v}");
      }
      code.push("proto.get=function " + className + "_get(" + args.join(",") + "){");
      if (useGetters) {
        code.push("return this.data.get(" + index_str + ")}");
      } else {
        code.push("return this.data[" + index_str + "]}");
      }
      code.push(
        "proto.index=function " + className + "_index(",
        args.join(),
        "){return " + index_str + "}"
      );
      code.push("proto.hi=function " + className + "_hi(" + args.join(",") + "){return new " + className + "(this.data," + indices.map(function(i2) {
        return ["(typeof i", i2, "!=='number'||i", i2, "<0)?this.shape[", i2, "]:i", i2, "|0"].join("");
      }).join(",") + "," + indices.map(function(i2) {
        return "this.stride[" + i2 + "]";
      }).join(",") + ",this.offset)}");
      var a_vars = indices.map(function(i2) {
        return "a" + i2 + "=this.shape[" + i2 + "]";
      });
      var c_vars = indices.map(function(i2) {
        return "c" + i2 + "=this.stride[" + i2 + "]";
      });
      code.push("proto.lo=function " + className + "_lo(" + args.join(",") + "){var b=this.offset,d=0," + a_vars.join(",") + "," + c_vars.join(","));
      for (var i = 0; i < dimension; ++i) {
        code.push(
          "if(typeof i" + i + "==='number'&&i" + i + ">=0){d=i" + i + "|0;b+=c" + i + "*d;a" + i + "-=d}"
        );
      }
      code.push("return new " + className + "(this.data," + indices.map(function(i2) {
        return "a" + i2;
      }).join(",") + "," + indices.map(function(i2) {
        return "c" + i2;
      }).join(",") + ",b)}");
      code.push("proto.step=function " + className + "_step(" + args.join(",") + "){var " + indices.map(function(i2) {
        return "a" + i2 + "=this.shape[" + i2 + "]";
      }).join(",") + "," + indices.map(function(i2) {
        return "b" + i2 + "=this.stride[" + i2 + "]";
      }).join(",") + ",c=this.offset,d=0,ceil=Math.ceil");
      for (var i = 0; i < dimension; ++i) {
        code.push(
          "if(typeof i" + i + "==='number'){d=i" + i + "|0;if(d<0){c+=b" + i + "*(a" + i + "-1);a" + i + "=ceil(-a" + i + "/d)}else{a" + i + "=ceil(a" + i + "/d)}b" + i + "*=d}"
        );
      }
      code.push("return new " + className + "(this.data," + indices.map(function(i2) {
        return "a" + i2;
      }).join(",") + "," + indices.map(function(i2) {
        return "b" + i2;
      }).join(",") + ",c)}");
      var tShape = new Array(dimension);
      var tStride = new Array(dimension);
      for (var i = 0; i < dimension; ++i) {
        tShape[i] = "a[i" + i + "]";
        tStride[i] = "b[i" + i + "]";
      }
      code.push(
        "proto.transpose=function " + className + "_transpose(" + args + "){" + args.map(function(n2, idx) {
          return n2 + "=(" + n2 + "===undefined?" + idx + ":" + n2 + "|0)";
        }).join(";"),
        "var a=this.shape,b=this.stride;return new " + className + "(this.data," + tShape.join(",") + "," + tStride.join(",") + ",this.offset)}"
      );
      code.push("proto.pick=function " + className + "_pick(" + args + "){var a=[],b=[],c=this.offset");
      for (var i = 0; i < dimension; ++i) {
        code.push("if(typeof i" + i + "==='number'&&i" + i + ">=0){c=(c+this.stride[" + i + "]*i" + i + ")|0}else{a.push(this.shape[" + i + "]);b.push(this.stride[" + i + "])}");
      }
      code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}");
      code.push("return function construct_" + className + "(data,shape,stride,offset){return new " + className + "(data," + indices.map(function(i2) {
        return "shape[" + i2 + "]";
      }).join(",") + "," + indices.map(function(i2) {
        return "stride[" + i2 + "]";
      }).join(",") + ",offset)}");
      var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"));
      return procedure(CACHED_CONSTRUCTORS[dtype], order);
    }
    function arrayDType(data) {
      if (isBuffer(data)) {
        return "buffer";
      }
      if (hasTypedArrays) {
        switch (Object.prototype.toString.call(data)) {
          case "[object Float64Array]":
            return "float64";
          case "[object Float32Array]":
            return "float32";
          case "[object Int8Array]":
            return "int8";
          case "[object Int16Array]":
            return "int16";
          case "[object Int32Array]":
            return "int32";
          case "[object Uint8Array]":
            return "uint8";
          case "[object Uint16Array]":
            return "uint16";
          case "[object Uint32Array]":
            return "uint32";
          case "[object Uint8ClampedArray]":
            return "uint8_clamped";
          case "[object BigInt64Array]":
            return "bigint64";
          case "[object BigUint64Array]":
            return "biguint64";
        }
      }
      if (Array.isArray(data)) {
        return "array";
      }
      return "generic";
    }
    var CACHED_CONSTRUCTORS = {
      "float32": [],
      "float64": [],
      "int8": [],
      "int16": [],
      "int32": [],
      "uint8": [],
      "uint16": [],
      "uint32": [],
      "array": [],
      "uint8_clamped": [],
      "bigint64": [],
      "biguint64": [],
      "buffer": [],
      "generic": []
    };
    function wrappedNDArrayCtor(data, shape, stride, offset) {
      if (data === void 0) {
        var ctor = CACHED_CONSTRUCTORS.array[0];
        return ctor([]);
      } else if (typeof data === "number") {
        data = [data];
      }
      if (shape === void 0) {
        shape = [data.length];
      }
      var d = shape.length;
      if (stride === void 0) {
        stride = new Array(d);
        for (var i = d - 1, sz = 1; i >= 0; --i) {
          stride[i] = sz;
          sz *= shape[i];
        }
      }
      if (offset === void 0) {
        offset = 0;
        for (var i = 0; i < d; ++i) {
          if (stride[i] < 0) {
            offset -= (shape[i] - 1) * stride[i];
          }
        }
      }
      var dtype = arrayDType(data);
      var ctor_list = CACHED_CONSTRUCTORS[dtype];
      while (ctor_list.length <= d + 1) {
        ctor_list.push(compileConstructor(dtype, ctor_list.length - 1));
      }
      var ctor = ctor_list[d + 1];
      return ctor(data, shape, stride, offset);
    }
    module.exports = wrappedNDArrayCtor;
  }
});

// node_modules/uniq/uniq.js
var require_uniq = __commonJS({
  "node_modules/uniq/uniq.js"(exports, module) {
    "use strict";
    function unique_pred(list, compare) {
      var ptr = 1, len2 = list.length, a2 = list[0], b = list[0];
      for (var i = 1; i < len2; ++i) {
        b = a2;
        a2 = list[i];
        if (compare(a2, b)) {
          if (i === ptr) {
            ptr++;
            continue;
          }
          list[ptr++] = a2;
        }
      }
      list.length = ptr;
      return list;
    }
    function unique_eq(list) {
      var ptr = 1, len2 = list.length, a2 = list[0], b = list[0];
      for (var i = 1; i < len2; ++i, b = a2) {
        b = a2;
        a2 = list[i];
        if (a2 !== b) {
          if (i === ptr) {
            ptr++;
            continue;
          }
          list[ptr++] = a2;
        }
      }
      list.length = ptr;
      return list;
    }
    function unique(list, compare, sorted) {
      if (list.length === 0) {
        return list;
      }
      if (compare) {
        if (!sorted) {
          list.sort(compare);
        }
        return unique_pred(list, compare);
      }
      if (!sorted) {
        list.sort();
      }
      return unique_eq(list);
    }
    module.exports = unique;
  }
});

// node_modules/cwise-compiler/lib/compile.js
var require_compile = __commonJS({
  "node_modules/cwise-compiler/lib/compile.js"(exports, module) {
    "use strict";
    var uniq = require_uniq();
    function innerFill(order, proc, body) {
      var dimension = order.length, nargs = proc.arrayArgs.length, has_index = proc.indexArgs.length > 0, code = [], vars = [], idx = 0, pidx = 0, i, j;
      for (i = 0; i < dimension; ++i) {
        vars.push(["i", i, "=0"].join(""));
      }
      for (j = 0; j < nargs; ++j) {
        for (i = 0; i < dimension; ++i) {
          pidx = idx;
          idx = order[i];
          if (i === 0) {
            vars.push(["d", j, "s", i, "=t", j, "p", idx].join(""));
          } else {
            vars.push(["d", j, "s", i, "=(t", j, "p", idx, "-s", pidx, "*t", j, "p", pidx, ")"].join(""));
          }
        }
      }
      if (vars.length > 0) {
        code.push("var " + vars.join(","));
      }
      for (i = dimension - 1; i >= 0; --i) {
        idx = order[i];
        code.push(["for(i", i, "=0;i", i, "<s", idx, ";++i", i, "){"].join(""));
      }
      code.push(body);
      for (i = 0; i < dimension; ++i) {
        pidx = idx;
        idx = order[i];
        for (j = 0; j < nargs; ++j) {
          code.push(["p", j, "+=d", j, "s", i].join(""));
        }
        if (has_index) {
          if (i > 0) {
            code.push(["index[", pidx, "]-=s", pidx].join(""));
          }
          code.push(["++index[", idx, "]"].join(""));
        }
        code.push("}");
      }
      return code.join("\n");
    }
    function outerFill(matched, order, proc, body) {
      var dimension = order.length, nargs = proc.arrayArgs.length, blockSize = proc.blockSize, has_index = proc.indexArgs.length > 0, code = [];
      for (var i = 0; i < nargs; ++i) {
        code.push(["var offset", i, "=p", i].join(""));
      }
      for (var i = matched; i < dimension; ++i) {
        code.push(["for(var j" + i + "=SS[", order[i], "]|0;j", i, ">0;){"].join(""));
        code.push(["if(j", i, "<", blockSize, "){"].join(""));
        code.push(["s", order[i], "=j", i].join(""));
        code.push(["j", i, "=0"].join(""));
        code.push(["}else{s", order[i], "=", blockSize].join(""));
        code.push(["j", i, "-=", blockSize, "}"].join(""));
        if (has_index) {
          code.push(["index[", order[i], "]=j", i].join(""));
        }
      }
      for (var i = 0; i < nargs; ++i) {
        var indexStr = ["offset" + i];
        for (var j = matched; j < dimension; ++j) {
          indexStr.push(["j", j, "*t", i, "p", order[j]].join(""));
        }
        code.push(["p", i, "=(", indexStr.join("+"), ")"].join(""));
      }
      code.push(innerFill(order, proc, body));
      for (var i = matched; i < dimension; ++i) {
        code.push("}");
      }
      return code.join("\n");
    }
    function countMatches(orders) {
      var matched = 0, dimension = orders[0].length;
      while (matched < dimension) {
        for (var j = 1; j < orders.length; ++j) {
          if (orders[j][matched] !== orders[0][matched]) {
            return matched;
          }
        }
        ++matched;
      }
      return matched;
    }
    function processBlock(block, proc, dtypes) {
      var code = block.body;
      var pre = [];
      var post = [];
      for (var i = 0; i < block.args.length; ++i) {
        var carg = block.args[i];
        if (carg.count <= 0) {
          continue;
        }
        var re = new RegExp(carg.name, "g");
        var ptrStr = "";
        var arrNum = proc.arrayArgs.indexOf(i);
        switch (proc.argTypes[i]) {
          case "offset":
            var offArgIndex = proc.offsetArgIndex.indexOf(i);
            var offArg = proc.offsetArgs[offArgIndex];
            arrNum = offArg.array;
            ptrStr = "+q" + offArgIndex;
          // Adds offset to the "pointer" in the array
          case "array":
            ptrStr = "p" + arrNum + ptrStr;
            var localStr = "l" + i;
            var arrStr = "a" + arrNum;
            if (proc.arrayBlockIndices[arrNum] === 0) {
              if (carg.count === 1) {
                if (dtypes[arrNum] === "generic") {
                  if (carg.lvalue) {
                    pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join(""));
                    code = code.replace(re, localStr);
                    post.push([arrStr, ".set(", ptrStr, ",", localStr, ")"].join(""));
                  } else {
                    code = code.replace(re, [arrStr, ".get(", ptrStr, ")"].join(""));
                  }
                } else {
                  code = code.replace(re, [arrStr, "[", ptrStr, "]"].join(""));
                }
              } else if (dtypes[arrNum] === "generic") {
                pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join(""));
                code = code.replace(re, localStr);
                if (carg.lvalue) {
                  post.push([arrStr, ".set(", ptrStr, ",", localStr, ")"].join(""));
                }
              } else {
                pre.push(["var ", localStr, "=", arrStr, "[", ptrStr, "]"].join(""));
                code = code.replace(re, localStr);
                if (carg.lvalue) {
                  post.push([arrStr, "[", ptrStr, "]=", localStr].join(""));
                }
              }
            } else {
              var reStrArr = [carg.name], ptrStrArr = [ptrStr];
              for (var j = 0; j < Math.abs(proc.arrayBlockIndices[arrNum]); j++) {
                reStrArr.push("\\s*\\[([^\\]]+)\\]");
                ptrStrArr.push("$" + (j + 1) + "*t" + arrNum + "b" + j);
              }
              re = new RegExp(reStrArr.join(""), "g");
              ptrStr = ptrStrArr.join("+");
              if (dtypes[arrNum] === "generic") {
                throw new Error("cwise: Generic arrays not supported in combination with blocks!");
              } else {
                code = code.replace(re, [arrStr, "[", ptrStr, "]"].join(""));
              }
            }
            break;
          case "scalar":
            code = code.replace(re, "Y" + proc.scalarArgs.indexOf(i));
            break;
          case "index":
            code = code.replace(re, "index");
            break;
          case "shape":
            code = code.replace(re, "shape");
            break;
        }
      }
      return [pre.join("\n"), code, post.join("\n")].join("\n").trim();
    }
    function typeSummary(dtypes) {
      var summary = new Array(dtypes.length);
      var allEqual = true;
      for (var i = 0; i < dtypes.length; ++i) {
        var t2 = dtypes[i];
        var digits = t2.match(/\d+/);
        if (!digits) {
          digits = "";
        } else {
          digits = digits[0];
        }
        if (t2.charAt(0) === 0) {
          summary[i] = "u" + t2.charAt(1) + digits;
        } else {
          summary[i] = t2.charAt(0) + digits;
        }
        if (i > 0) {
          allEqual = allEqual && summary[i] === summary[i - 1];
        }
      }
      if (allEqual) {
        return summary[0];
      }
      return summary.join("");
    }
    function generateCWiseOp(proc, typesig) {
      var dimension = typesig[1].length - Math.abs(proc.arrayBlockIndices[0]) | 0;
      var orders = new Array(proc.arrayArgs.length);
      var dtypes = new Array(proc.arrayArgs.length);
      for (var i = 0; i < proc.arrayArgs.length; ++i) {
        dtypes[i] = typesig[2 * i];
        orders[i] = typesig[2 * i + 1];
      }
      var blockBegin = [], blockEnd = [];
      var loopBegin = [], loopEnd = [];
      var loopOrders = [];
      for (var i = 0; i < proc.arrayArgs.length; ++i) {
        if (proc.arrayBlockIndices[i] < 0) {
          loopBegin.push(0);
          loopEnd.push(dimension);
          blockBegin.push(dimension);
          blockEnd.push(dimension + proc.arrayBlockIndices[i]);
        } else {
          loopBegin.push(proc.arrayBlockIndices[i]);
          loopEnd.push(proc.arrayBlockIndices[i] + dimension);
          blockBegin.push(0);
          blockEnd.push(proc.arrayBlockIndices[i]);
        }
        var newOrder = [];
        for (var j = 0; j < orders[i].length; j++) {
          if (loopBegin[i] <= orders[i][j] && orders[i][j] < loopEnd[i]) {
            newOrder.push(orders[i][j] - loopBegin[i]);
          }
        }
        loopOrders.push(newOrder);
      }
      var arglist = ["SS"];
      var code = ["'use strict'"];
      var vars = [];
      for (var j = 0; j < dimension; ++j) {
        vars.push(["s", j, "=SS[", j, "]"].join(""));
      }
      for (var i = 0; i < proc.arrayArgs.length; ++i) {
        arglist.push("a" + i);
        arglist.push("t" + i);
        arglist.push("p" + i);
        for (var j = 0; j < dimension; ++j) {
          vars.push(["t", i, "p", j, "=t", i, "[", loopBegin[i] + j, "]"].join(""));
        }
        for (var j = 0; j < Math.abs(proc.arrayBlockIndices[i]); ++j) {
          vars.push(["t", i, "b", j, "=t", i, "[", blockBegin[i] + j, "]"].join(""));
        }
      }
      for (var i = 0; i < proc.scalarArgs.length; ++i) {
        arglist.push("Y" + i);
      }
      if (proc.shapeArgs.length > 0) {
        vars.push("shape=SS.slice(0)");
      }
      if (proc.indexArgs.length > 0) {
        var zeros = new Array(dimension);
        for (var i = 0; i < dimension; ++i) {
          zeros[i] = "0";
        }
        vars.push(["index=[", zeros.join(","), "]"].join(""));
      }
      for (var i = 0; i < proc.offsetArgs.length; ++i) {
        var off_arg = proc.offsetArgs[i];
        var init_string = [];
        for (var j = 0; j < off_arg.offset.length; ++j) {
          if (off_arg.offset[j] === 0) {
            continue;
          } else if (off_arg.offset[j] === 1) {
            init_string.push(["t", off_arg.array, "p", j].join(""));
          } else {
            init_string.push([off_arg.offset[j], "*t", off_arg.array, "p", j].join(""));
          }
        }
        if (init_string.length === 0) {
          vars.push("q" + i + "=0");
        } else {
          vars.push(["q", i, "=", init_string.join("+")].join(""));
        }
      }
      var thisVars = uniq([].concat(proc.pre.thisVars).concat(proc.body.thisVars).concat(proc.post.thisVars));
      vars = vars.concat(thisVars);
      if (vars.length > 0) {
        code.push("var " + vars.join(","));
      }
      for (var i = 0; i < proc.arrayArgs.length; ++i) {
        code.push("p" + i + "|=0");
      }
      if (proc.pre.body.length > 3) {
        code.push(processBlock(proc.pre, proc, dtypes));
      }
      var body = processBlock(proc.body, proc, dtypes);
      var matched = countMatches(loopOrders);
      if (matched < dimension) {
        code.push(outerFill(matched, loopOrders[0], proc, body));
      } else {
        code.push(innerFill(loopOrders[0], proc, body));
      }
      if (proc.post.body.length > 3) {
        code.push(processBlock(proc.post, proc, dtypes));
      }
      if (proc.debug) {
        console.log("-----Generated cwise routine for ", typesig, ":\n" + code.join("\n") + "\n----------");
      }
      var loopName = [proc.funcName || "unnamed", "_cwise_loop_", orders[0].join("s"), "m", matched, typeSummary(dtypes)].join("");
      var f = new Function(["function ", loopName, "(", arglist.join(","), "){", code.join("\n"), "} return ", loopName].join(""));
      return f();
    }
    module.exports = generateCWiseOp;
  }
});

// node_modules/cwise-compiler/lib/thunk.js
var require_thunk = __commonJS({
  "node_modules/cwise-compiler/lib/thunk.js"(exports, module) {
    "use strict";
    var compile = require_compile();
    function createThunk(proc) {
      var code = ["'use strict'", "var CACHED={}"];
      var vars = [];
      var thunkName = proc.funcName + "_cwise_thunk";
      code.push(["return function ", thunkName, "(", proc.shimArgs.join(","), "){"].join(""));
      var typesig = [];
      var string_typesig = [];
      var proc_args = [[
        "array",
        proc.arrayArgs[0],
        ".shape.slice(",
        // Slice shape so that we only retain the shape over which we iterate (which gets passed to the cwise operator as SS).
        Math.max(0, proc.arrayBlockIndices[0]),
        proc.arrayBlockIndices[0] < 0 ? "," + proc.arrayBlockIndices[0] + ")" : ")"
      ].join("")];
      var shapeLengthConditions = [], shapeConditions = [];
      for (var i = 0; i < proc.arrayArgs.length; ++i) {
        var j = proc.arrayArgs[i];
        vars.push([
          "t",
          j,
          "=array",
          j,
          ".dtype,",
          "r",
          j,
          "=array",
          j,
          ".order"
        ].join(""));
        typesig.push("t" + j);
        typesig.push("r" + j);
        string_typesig.push("t" + j);
        string_typesig.push("r" + j + ".join()");
        proc_args.push("array" + j + ".data");
        proc_args.push("array" + j + ".stride");
        proc_args.push("array" + j + ".offset|0");
        if (i > 0) {
          shapeLengthConditions.push("array" + proc.arrayArgs[0] + ".shape.length===array" + j + ".shape.length+" + (Math.abs(proc.arrayBlockIndices[0]) - Math.abs(proc.arrayBlockIndices[i])));
          shapeConditions.push("array" + proc.arrayArgs[0] + ".shape[shapeIndex+" + Math.max(0, proc.arrayBlockIndices[0]) + "]===array" + j + ".shape[shapeIndex+" + Math.max(0, proc.arrayBlockIndices[i]) + "]");
        }
      }
      if (proc.arrayArgs.length > 1) {
        code.push("if (!(" + shapeLengthConditions.join(" && ") + ")) throw new Error('cwise: Arrays do not all have the same dimensionality!')");
        code.push("for(var shapeIndex=array" + proc.arrayArgs[0] + ".shape.length-" + Math.abs(proc.arrayBlockIndices[0]) + "; shapeIndex-->0;) {");
        code.push("if (!(" + shapeConditions.join(" && ") + ")) throw new Error('cwise: Arrays do not all have the same shape!')");
        code.push("}");
      }
      for (var i = 0; i < proc.scalarArgs.length; ++i) {
        proc_args.push("scalar" + proc.scalarArgs[i]);
      }
      vars.push(["type=[", string_typesig.join(","), "].join()"].join(""));
      vars.push("proc=CACHED[type]");
      code.push("var " + vars.join(","));
      code.push([
        "if(!proc){",
        "CACHED[type]=proc=compile([",
        typesig.join(","),
        "])}",
        "return proc(",
        proc_args.join(","),
        ")}"
      ].join(""));
      if (proc.debug) {
        console.log("-----Generated thunk:\n" + code.join("\n") + "\n----------");
      }
      var thunk = new Function("compile", code.join("\n"));
      return thunk(compile.bind(void 0, proc));
    }
    module.exports = createThunk;
  }
});

// node_modules/cwise-compiler/compiler.js
var require_compiler = __commonJS({
  "node_modules/cwise-compiler/compiler.js"(exports, module) {
    "use strict";
    var createThunk = require_thunk();
    function Procedure() {
      this.argTypes = [];
      this.shimArgs = [];
      this.arrayArgs = [];
      this.arrayBlockIndices = [];
      this.scalarArgs = [];
      this.offsetArgs = [];
      this.offsetArgIndex = [];
      this.indexArgs = [];
      this.shapeArgs = [];
      this.funcName = "";
      this.pre = null;
      this.body = null;
      this.post = null;
      this.debug = false;
    }
    function compileCwise(user_args) {
      var proc = new Procedure();
      proc.pre = user_args.pre;
      proc.body = user_args.body;
      proc.post = user_args.post;
      var proc_args = user_args.args.slice(0);
      proc.argTypes = proc_args;
      for (var i = 0; i < proc_args.length; ++i) {
        var arg_type = proc_args[i];
        if (arg_type === "array" || typeof arg_type === "object" && arg_type.blockIndices) {
          proc.argTypes[i] = "array";
          proc.arrayArgs.push(i);
          proc.arrayBlockIndices.push(arg_type.blockIndices ? arg_type.blockIndices : 0);
          proc.shimArgs.push("array" + i);
          if (i < proc.pre.args.length && proc.pre.args[i].count > 0) {
            throw new Error("cwise: pre() block may not reference array args");
          }
          if (i < proc.post.args.length && proc.post.args[i].count > 0) {
            throw new Error("cwise: post() block may not reference array args");
          }
        } else if (arg_type === "scalar") {
          proc.scalarArgs.push(i);
          proc.shimArgs.push("scalar" + i);
        } else if (arg_type === "index") {
          proc.indexArgs.push(i);
          if (i < proc.pre.args.length && proc.pre.args[i].count > 0) {
            throw new Error("cwise: pre() block may not reference array index");
          }
          if (i < proc.body.args.length && proc.body.args[i].lvalue) {
            throw new Error("cwise: body() block may not write to array index");
          }
          if (i < proc.post.args.length && proc.post.args[i].count > 0) {
            throw new Error("cwise: post() block may not reference array index");
          }
        } else if (arg_type === "shape") {
          proc.shapeArgs.push(i);
          if (i < proc.pre.args.length && proc.pre.args[i].lvalue) {
            throw new Error("cwise: pre() block may not write to array shape");
          }
          if (i < proc.body.args.length && proc.body.args[i].lvalue) {
            throw new Error("cwise: body() block may not write to array shape");
          }
          if (i < proc.post.args.length && proc.post.args[i].lvalue) {
            throw new Error("cwise: post() block may not write to array shape");
          }
        } else if (typeof arg_type === "object" && arg_type.offset) {
          proc.argTypes[i] = "offset";
          proc.offsetArgs.push({ array: arg_type.array, offset: arg_type.offset });
          proc.offsetArgIndex.push(i);
        } else {
          throw new Error("cwise: Unknown argument type " + proc_args[i]);
        }
      }
      if (proc.arrayArgs.length <= 0) {
        throw new Error("cwise: No array arguments specified");
      }
      if (proc.pre.args.length > proc_args.length) {
        throw new Error("cwise: Too many arguments in pre() block");
      }
      if (proc.body.args.length > proc_args.length) {
        throw new Error("cwise: Too many arguments in body() block");
      }
      if (proc.post.args.length > proc_args.length) {
        throw new Error("cwise: Too many arguments in post() block");
      }
      proc.debug = !!user_args.printCode || !!user_args.debug;
      proc.funcName = user_args.funcName || "cwise";
      proc.blockSize = user_args.blockSize || 64;
      return createThunk(proc);
    }
    module.exports = compileCwise;
  }
});

// node_modules/ndarray-ops/ndarray-ops.js
var require_ndarray_ops = __commonJS({
  "node_modules/ndarray-ops/ndarray-ops.js"(exports) {
    "use strict";
    var compile = require_compiler();
    var EmptyProc = {
      body: "",
      args: [],
      thisVars: [],
      localVars: []
    };
    function fixup(x) {
      if (!x) {
        return EmptyProc;
      }
      for (var i = 0; i < x.args.length; ++i) {
        var a2 = x.args[i];
        if (i === 0) {
          x.args[i] = { name: a2, lvalue: true, rvalue: !!x.rvalue, count: x.count || 1 };
        } else {
          x.args[i] = { name: a2, lvalue: false, rvalue: true, count: 1 };
        }
      }
      if (!x.thisVars) {
        x.thisVars = [];
      }
      if (!x.localVars) {
        x.localVars = [];
      }
      return x;
    }
    function pcompile(user_args) {
      return compile({
        args: user_args.args,
        pre: fixup(user_args.pre),
        body: fixup(user_args.body),
        post: fixup(user_args.proc),
        funcName: user_args.funcName
      });
    }
    function makeOp(user_args) {
      var args = [];
      for (var i = 0; i < user_args.args.length; ++i) {
        args.push("a" + i);
      }
      var wrapper = new Function("P", [
        "return function ",
        user_args.funcName,
        "_ndarrayops(",
        args.join(","),
        ") {P(",
        args.join(","),
        ");return a0}"
      ].join(""));
      return wrapper(pcompile(user_args));
    }
    var assign_ops = {
      add: "+",
      sub: "-",
      mul: "*",
      div: "/",
      mod: "%",
      band: "&",
      bor: "|",
      bxor: "^",
      lshift: "<<",
      rshift: ">>",
      rrshift: ">>>"
    };
    (function() {
      for (var id in assign_ops) {
        var op = assign_ops[id];
        exports[id] = makeOp({
          args: ["array", "array", "array"],
          body: {
            args: ["a", "b", "c"],
            body: "a=b" + op + "c"
          },
          funcName: id
        });
        exports[id + "eq"] = makeOp({
          args: ["array", "array"],
          body: {
            args: ["a", "b"],
            body: "a" + op + "=b"
          },
          rvalue: true,
          funcName: id + "eq"
        });
        exports[id + "s"] = makeOp({
          args: ["array", "array", "scalar"],
          body: {
            args: ["a", "b", "s"],
            body: "a=b" + op + "s"
          },
          funcName: id + "s"
        });
        exports[id + "seq"] = makeOp({
          args: ["array", "scalar"],
          body: {
            args: ["a", "s"],
            body: "a" + op + "=s"
          },
          rvalue: true,
          funcName: id + "seq"
        });
      }
    })();
    var unary_ops = {
      not: "!",
      bnot: "~",
      neg: "-",
      recip: "1.0/"
    };
    (function() {
      for (var id in unary_ops) {
        var op = unary_ops[id];
        exports[id] = makeOp({
          args: ["array", "array"],
          body: {
            args: ["a", "b"],
            body: "a=" + op + "b"
          },
          funcName: id
        });
        exports[id + "eq"] = makeOp({
          args: ["array"],
          body: {
            args: ["a"],
            body: "a=" + op + "a"
          },
          rvalue: true,
          count: 2,
          funcName: id + "eq"
        });
      }
    })();
    var binary_ops = {
      and: "&&",
      or: "||",
      eq: "===",
      neq: "!==",
      lt: "<",
      gt: ">",
      leq: "<=",
      geq: ">="
    };
    (function() {
      for (var id in binary_ops) {
        var op = binary_ops[id];
        exports[id] = makeOp({
          args: ["array", "array", "array"],
          body: {
            args: ["a", "b", "c"],
            body: "a=b" + op + "c"
          },
          funcName: id
        });
        exports[id + "s"] = makeOp({
          args: ["array", "array", "scalar"],
          body: {
            args: ["a", "b", "s"],
            body: "a=b" + op + "s"
          },
          funcName: id + "s"
        });
        exports[id + "eq"] = makeOp({
          args: ["array", "array"],
          body: {
            args: ["a", "b"],
            body: "a=a" + op + "b"
          },
          rvalue: true,
          count: 2,
          funcName: id + "eq"
        });
        exports[id + "seq"] = makeOp({
          args: ["array", "scalar"],
          body: {
            args: ["a", "s"],
            body: "a=a" + op + "s"
          },
          rvalue: true,
          count: 2,
          funcName: id + "seq"
        });
      }
    })();
    var math_unary = [
      "abs",
      "acos",
      "asin",
      "atan",
      "ceil",
      "cos",
      "exp",
      "floor",
      "log",
      "round",
      "sin",
      "sqrt",
      "tan"
    ];
    (function() {
      for (var i = 0; i < math_unary.length; ++i) {
        var f = math_unary[i];
        exports[f] = makeOp({
          args: ["array", "array"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b"], body: "a=this_f(b)", thisVars: ["this_f"] },
          funcName: f
        });
        exports[f + "eq"] = makeOp({
          args: ["array"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a"], body: "a=this_f(a)", thisVars: ["this_f"] },
          rvalue: true,
          count: 2,
          funcName: f + "eq"
        });
      }
    })();
    var math_comm = [
      "max",
      "min",
      "atan2",
      "pow"
    ];
    (function() {
      for (var i = 0; i < math_comm.length; ++i) {
        var f = math_comm[i];
        exports[f] = makeOp({
          args: ["array", "array", "array"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b", "c"], body: "a=this_f(b,c)", thisVars: ["this_f"] },
          funcName: f
        });
        exports[f + "s"] = makeOp({
          args: ["array", "array", "scalar"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b", "c"], body: "a=this_f(b,c)", thisVars: ["this_f"] },
          funcName: f + "s"
        });
        exports[f + "eq"] = makeOp({
          args: ["array", "array"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b"], body: "a=this_f(a,b)", thisVars: ["this_f"] },
          rvalue: true,
          count: 2,
          funcName: f + "eq"
        });
        exports[f + "seq"] = makeOp({
          args: ["array", "scalar"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b"], body: "a=this_f(a,b)", thisVars: ["this_f"] },
          rvalue: true,
          count: 2,
          funcName: f + "seq"
        });
      }
    })();
    var math_noncomm = [
      "atan2",
      "pow"
    ];
    (function() {
      for (var i = 0; i < math_noncomm.length; ++i) {
        var f = math_noncomm[i];
        exports[f + "op"] = makeOp({
          args: ["array", "array", "array"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b", "c"], body: "a=this_f(c,b)", thisVars: ["this_f"] },
          funcName: f + "op"
        });
        exports[f + "ops"] = makeOp({
          args: ["array", "array", "scalar"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b", "c"], body: "a=this_f(c,b)", thisVars: ["this_f"] },
          funcName: f + "ops"
        });
        exports[f + "opeq"] = makeOp({
          args: ["array", "array"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b"], body: "a=this_f(b,a)", thisVars: ["this_f"] },
          rvalue: true,
          count: 2,
          funcName: f + "opeq"
        });
        exports[f + "opseq"] = makeOp({
          args: ["array", "scalar"],
          pre: { args: [], body: "this_f=Math." + f, thisVars: ["this_f"] },
          body: { args: ["a", "b"], body: "a=this_f(b,a)", thisVars: ["this_f"] },
          rvalue: true,
          count: 2,
          funcName: f + "opseq"
        });
      }
    })();
    exports.any = compile({
      args: ["array"],
      pre: EmptyProc,
      body: { args: [{ name: "a", lvalue: false, rvalue: true, count: 1 }], body: "if(a){return true}", localVars: [], thisVars: [] },
      post: { args: [], localVars: [], thisVars: [], body: "return false" },
      funcName: "any"
    });
    exports.all = compile({
      args: ["array"],
      pre: EmptyProc,
      body: { args: [{ name: "x", lvalue: false, rvalue: true, count: 1 }], body: "if(!x){return false}", localVars: [], thisVars: [] },
      post: { args: [], localVars: [], thisVars: [], body: "return true" },
      funcName: "all"
    });
    exports.sum = compile({
      args: ["array"],
      pre: { args: [], localVars: [], thisVars: ["this_s"], body: "this_s=0" },
      body: { args: [{ name: "a", lvalue: false, rvalue: true, count: 1 }], body: "this_s+=a", localVars: [], thisVars: ["this_s"] },
      post: { args: [], localVars: [], thisVars: ["this_s"], body: "return this_s" },
      funcName: "sum"
    });
    exports.prod = compile({
      args: ["array"],
      pre: { args: [], localVars: [], thisVars: ["this_s"], body: "this_s=1" },
      body: { args: [{ name: "a", lvalue: false, rvalue: true, count: 1 }], body: "this_s*=a", localVars: [], thisVars: ["this_s"] },
      post: { args: [], localVars: [], thisVars: ["this_s"], body: "return this_s" },
      funcName: "prod"
    });
    exports.norm2squared = compile({
      args: ["array"],
      pre: { args: [], localVars: [], thisVars: ["this_s"], body: "this_s=0" },
      body: { args: [{ name: "a", lvalue: false, rvalue: true, count: 2 }], body: "this_s+=a*a", localVars: [], thisVars: ["this_s"] },
      post: { args: [], localVars: [], thisVars: ["this_s"], body: "return this_s" },
      funcName: "norm2squared"
    });
    exports.norm2 = compile({
      args: ["array"],
      pre: { args: [], localVars: [], thisVars: ["this_s"], body: "this_s=0" },
      body: { args: [{ name: "a", lvalue: false, rvalue: true, count: 2 }], body: "this_s+=a*a", localVars: [], thisVars: ["this_s"] },
      post: { args: [], localVars: [], thisVars: ["this_s"], body: "return Math.sqrt(this_s)" },
      funcName: "norm2"
    });
    exports.norminf = compile({
      args: ["array"],
      pre: { args: [], localVars: [], thisVars: ["this_s"], body: "this_s=0" },
      body: { args: [{ name: "a", lvalue: false, rvalue: true, count: 4 }], body: "if(-a>this_s){this_s=-a}else if(a>this_s){this_s=a}", localVars: [], thisVars: ["this_s"] },
      post: { args: [], localVars: [], thisVars: ["this_s"], body: "return this_s" },
      funcName: "norminf"
    });
    exports.norm1 = compile({
      args: ["array"],
      pre: { args: [], localVars: [], thisVars: ["this_s"], body: "this_s=0" },
      body: { args: [{ name: "a", lvalue: false, rvalue: true, count: 3 }], body: "this_s+=a<0?-a:a", localVars: [], thisVars: ["this_s"] },
      post: { args: [], localVars: [], thisVars: ["this_s"], body: "return this_s" },
      funcName: "norm1"
    });
    exports.sup = compile({
      args: ["array"],
      pre: {
        body: "this_h=-Infinity",
        args: [],
        thisVars: ["this_h"],
        localVars: []
      },
      body: {
        body: "if(_inline_1_arg0_>this_h)this_h=_inline_1_arg0_",
        args: [{ "name": "_inline_1_arg0_", "lvalue": false, "rvalue": true, "count": 2 }],
        thisVars: ["this_h"],
        localVars: []
      },
      post: {
        body: "return this_h",
        args: [],
        thisVars: ["this_h"],
        localVars: []
      }
    });
    exports.inf = compile({
      args: ["array"],
      pre: {
        body: "this_h=Infinity",
        args: [],
        thisVars: ["this_h"],
        localVars: []
      },
      body: {
        body: "if(_inline_1_arg0_<this_h)this_h=_inline_1_arg0_",
        args: [{ "name": "_inline_1_arg0_", "lvalue": false, "rvalue": true, "count": 2 }],
        thisVars: ["this_h"],
        localVars: []
      },
      post: {
        body: "return this_h",
        args: [],
        thisVars: ["this_h"],
        localVars: []
      }
    });
    exports.argmin = compile({
      args: ["index", "array", "shape"],
      pre: {
        body: "{this_v=Infinity;this_i=_inline_0_arg2_.slice(0)}",
        args: [
          { name: "_inline_0_arg0_", lvalue: false, rvalue: false, count: 0 },
          { name: "_inline_0_arg1_", lvalue: false, rvalue: false, count: 0 },
          { name: "_inline_0_arg2_", lvalue: false, rvalue: true, count: 1 }
        ],
        thisVars: ["this_i", "this_v"],
        localVars: []
      },
      body: {
        body: "{if(_inline_1_arg1_<this_v){this_v=_inline_1_arg1_;for(var _inline_1_k=0;_inline_1_k<_inline_1_arg0_.length;++_inline_1_k){this_i[_inline_1_k]=_inline_1_arg0_[_inline_1_k]}}}",
        args: [
          { name: "_inline_1_arg0_", lvalue: false, rvalue: true, count: 2 },
          { name: "_inline_1_arg1_", lvalue: false, rvalue: true, count: 2 }
        ],
        thisVars: ["this_i", "this_v"],
        localVars: ["_inline_1_k"]
      },
      post: {
        body: "{return this_i}",
        args: [],
        thisVars: ["this_i"],
        localVars: []
      }
    });
    exports.argmax = compile({
      args: ["index", "array", "shape"],
      pre: {
        body: "{this_v=-Infinity;this_i=_inline_0_arg2_.slice(0)}",
        args: [
          { name: "_inline_0_arg0_", lvalue: false, rvalue: false, count: 0 },
          { name: "_inline_0_arg1_", lvalue: false, rvalue: false, count: 0 },
          { name: "_inline_0_arg2_", lvalue: false, rvalue: true, count: 1 }
        ],
        thisVars: ["this_i", "this_v"],
        localVars: []
      },
      body: {
        body: "{if(_inline_1_arg1_>this_v){this_v=_inline_1_arg1_;for(var _inline_1_k=0;_inline_1_k<_inline_1_arg0_.length;++_inline_1_k){this_i[_inline_1_k]=_inline_1_arg0_[_inline_1_k]}}}",
        args: [
          { name: "_inline_1_arg0_", lvalue: false, rvalue: true, count: 2 },
          { name: "_inline_1_arg1_", lvalue: false, rvalue: true, count: 2 }
        ],
        thisVars: ["this_i", "this_v"],
        localVars: ["_inline_1_k"]
      },
      post: {
        body: "{return this_i}",
        args: [],
        thisVars: ["this_i"],
        localVars: []
      }
    });
    exports.random = makeOp({
      args: ["array"],
      pre: { args: [], body: "this_f=Math.random", thisVars: ["this_f"] },
      body: { args: ["a"], body: "a=this_f()", thisVars: ["this_f"] },
      funcName: "random"
    });
    exports.assign = makeOp({
      args: ["array", "array"],
      body: { args: ["a", "b"], body: "a=b" },
      funcName: "assign"
    });
    exports.assigns = makeOp({
      args: ["array", "scalar"],
      body: { args: ["a", "b"], body: "a=b" },
      funcName: "assigns"
    });
    exports.equals = compile({
      args: ["array", "array"],
      pre: EmptyProc,
      body: {
        args: [
          { name: "x", lvalue: false, rvalue: true, count: 1 },
          { name: "y", lvalue: false, rvalue: true, count: 1 }
        ],
        body: "if(x!==y){return false}",
        localVars: [],
        thisVars: []
      },
      post: { args: [], localVars: [], thisVars: [], body: "return true" },
      funcName: "equals"
    });
  }
});

// node_modules/@gltf-transform/functions/dist/functions.modern.js
import { Primitive, PropertyType, Document, getBounds as getBounds$1, Scene, BufferUtils, Root, TextureInfo, Texture, ExtensionProperty, AnimationChannel, Material, ColorUtils, MathUtils, Accessor, Mesh, ComponentTypeToTypedArray, ImageUtils, TextureChannel, Node, PrimitiveTarget, AnimationSampler, FileUtils, uuid } from "@gltf-transform/core";

// node_modules/@gltf-transform/functions/node_modules/ndarray-pixels/dist/ndarray-pixels-browser.modern.js
var import_ndarray = __toESM(require_ndarray(), 1);
var import_ndarray_ops = __toESM(require_ndarray_ops(), 1);
function getPixelsInternal(buffer, mimeType) {
  if (!(buffer instanceof Uint8Array)) {
    throw new Error("[ndarray-pixels] Input must be Uint8Array or Buffer.");
  }
  const blob = new Blob([buffer], {
    type: mimeType
  });
  const path = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
      URL.revokeObjectURL(path);
      const canvas = new OffscreenCanvas(img.width, img.height);
      const context = canvas.getContext("2d");
      context.drawImage(img, 0, 0);
      const pixels = context.getImageData(0, 0, img.width, img.height);
      resolve((0, import_ndarray.default)(new Uint8Array(pixels.data), [img.width, img.height, 4], [4, 4 * img.width, 1], 0));
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(path);
      reject(err);
    };
    img.src = path;
  });
}
function putPixelData(array, data, frame = -1) {
  if (array.shape.length === 4) {
    return putPixelData(array.pick(frame), data, 0);
  } else if (array.shape.length === 3) {
    if (array.shape[2] === 3) {
      import_ndarray_ops.default.assign((0, import_ndarray.default)(data, [array.shape[0], array.shape[1], 3], [4, 4 * array.shape[0], 1]), array);
      import_ndarray_ops.default.assigns((0, import_ndarray.default)(data, [array.shape[0] * array.shape[1]], [4], 3), 255);
    } else if (array.shape[2] === 4) {
      import_ndarray_ops.default.assign((0, import_ndarray.default)(data, [array.shape[0], array.shape[1], 4], [4, array.shape[0] * 4, 1]), array);
    } else if (array.shape[2] === 1) {
      import_ndarray_ops.default.assign((0, import_ndarray.default)(data, [array.shape[0], array.shape[1], 3], [4, 4 * array.shape[0], 1]), (0, import_ndarray.default)(array.data, [array.shape[0], array.shape[1], 3], [array.stride[0], array.stride[1], 0], array.offset));
      import_ndarray_ops.default.assigns((0, import_ndarray.default)(data, [array.shape[0] * array.shape[1]], [4], 3), 255);
    } else {
      throw new Error("[ndarray-pixels] Incompatible array shape.");
    }
  } else if (array.shape.length === 2) {
    import_ndarray_ops.default.assign((0, import_ndarray.default)(data, [array.shape[0], array.shape[1], 3], [4, 4 * array.shape[0], 1]), (0, import_ndarray.default)(array.data, [array.shape[0], array.shape[1], 3], [array.stride[0], array.stride[1], 0], array.offset));
    import_ndarray_ops.default.assigns((0, import_ndarray.default)(data, [array.shape[0] * array.shape[1]], [4], 3), 255);
  } else {
    throw new Error("[ndarray-pixels] Incompatible array shape.");
  }
  return data;
}
async function savePixelsInternal(pixels, options) {
  const canvas = new OffscreenCanvas(pixels.shape[0], pixels.shape[1]);
  const context = canvas.getContext("2d");
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  putPixelData(pixels, imageData.data);
  context.putImageData(imageData, 0, 0);
  return streamCanvas(canvas, options);
}
async function streamCanvas(canvas, options) {
  const blob = await canvas.convertToBlob(options);
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}
async function getPixels(data, mimeType) {
  return getPixelsInternal(data, mimeType);
}
async function savePixels(pixels, typeOrOptions) {
  let options;
  if (typeof typeOrOptions === "string") {
    options = {
      type: typeOrOptions,
      quality: void 0
    };
  } else {
    options = {
      type: typeOrOptions.type,
      quality: typeOrOptions.quality
    };
  }
  return savePixelsInternal(pixels, options);
}

// node_modules/@gltf-transform/functions/dist/functions.modern.js
import { KHRMeshQuantization, KHRDracoMeshCompression, EXTMeshGPUInstancing, EXTMeshoptCompression, KHRMaterialsIOR, KHRMaterialsSpecular, KHRMaterialsPBRSpecularGlossiness, EXTTextureWebP, EXTTextureAVIF, KHRMaterialsUnlit } from "@gltf-transform/extensions";

// node_modules/@gltf-transform/functions/node_modules/ktx-parse/dist/ktx-parse.modern.js
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
  _nextUint8Array(len2) {
    const value = new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + this._offset, len2);
    this._offset += len2;
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

// node_modules/@gltf-transform/functions/dist/functions.modern.js
var import_ndarray3 = __toESM(require_ndarray(), 1);

// node_modules/ndarray-lanczos/dist/ndarray-lanczos.modern.js
var import_ndarray2 = __toESM(require_ndarray(), 1);
var e = (t2, e2) => {
  if (t2 <= -e2 || t2 >= e2) return 0;
  if (t2 > -11920929e-14 && t2 < 11920929e-14) return 1;
  const n2 = t2 * Math.PI;
  return Math.sin(n2) / n2 * Math.sin(n2 / e2) / (n2 / e2);
};
var n = (t2, n2, r2, a2, o2, s2, c2, h) => {
  const l = 2 ** h - 1, i = (t3) => Math.round(t3 * l), p = o2 ? 2 : 3, u = 1 / r2, f = Math.min(1, r2), d = p / f, _ = new c2((Math.floor(2 * (d + 1)) + 2) * n2);
  let y = 0;
  for (let r3 = 0; r3 < n2; r3++) {
    const o3 = (r3 + 0.5) * u + a2, h2 = Math.max(0, Math.floor(o3 - d)), l2 = Math.min(t2 - 1, Math.ceil(o3 + d)), A = l2 - h2 + 1, E = new s2(A), M = new c2(A);
    let g = 0, L = 0;
    for (let t3 = h2; t3 <= l2; t3++) {
      const n3 = e((t3 + 0.5 - o3) * f, p);
      g += n3, E[L] = n3, L++;
    }
    let N = 0;
    for (let t3 = 0; t3 < E.length; t3++) {
      const e2 = E[t3] / g;
      N += e2, M[t3] = i(e2);
    }
    M[n2 >> 1] += i(1 - N);
    let S = 0;
    for (; S < M.length && 0 === M[S]; ) S++;
    let w = M.length - 1;
    for (; w > 0 && 0 === M[w]; ) w--;
    const m = w - S + 1;
    _[y++] = h2 + S, _[y++] = m, _.set(M.subarray(S, w + 1), y), y += m;
  }
  return _;
};
var r = (t2, e2, n2, r2) => {
  const [a2, o2] = t2.shape, [s2] = e2.shape, c2 = 2 ** (8 * e2.data.BYTES_PER_ELEMENT) - 1, h = (t3) => t3 < 0 ? 0 : t3 > c2 ? c2 : t3, l = 2 ** (r2 - 1), i = 2 * l;
  for (let r3 = 0; r3 < o2; r3++) {
    const a3 = r3;
    let o3 = 0;
    for (let c3 = 0; c3 < s2; c3++) {
      let s3 = n2[o3++], p = 0, u = 0, f = 0, d = 0;
      for (let e3 = n2[o3++]; e3 > 0; e3--) {
        const e4 = n2[o3++];
        p += e4 * t2.get(s3, r3, 0), u += e4 * t2.get(s3, r3, 1), f += e4 * t2.get(s3, r3, 2), d += e4 * t2.get(s3, r3, 3), s3++;
      }
      e2.set(c3, a3, 0, h((p + l) / i)), e2.set(c3, a3, 1, h((u + l) / i)), e2.set(c3, a3, 2, h((f + l) / i)), e2.set(c3, a3, 3, h((d + l) / i));
    }
  }
};
var a;
function o(e2, o2, s2) {
  if (3 !== e2.shape.length || 3 !== o2.shape.length) throw new TypeError("Input and output must have exactly 3 dimensions (width, height and colorspace)");
  const [c2, h] = e2.shape, [l, i] = o2.shape, p = l / c2, u = i / h;
  let f, d;
  switch (o2.dtype) {
    case "uint8_clamped":
    case "uint8":
      f = Float32Array, d = Int16Array;
      break;
    case "uint16":
    case "uint32":
      f = Float64Array, d = Int32Array;
      break;
    default:
      throw TypeError(`Unsupported data type ${o2.dtype}`);
  }
  const _ = 7 * d.BYTES_PER_ELEMENT, y = n(c2, l, p, 0, s2 === a.LANCZOS_2, f, d, _), A = n(h, i, u, 0, s2 === a.LANCZOS_2, f, d, _), E = (0, import_ndarray2.default)(new (0, o2.data.constructor)(l * h * 4), [h, l, 4]), M = E.transpose(1, 0), g = o2.transpose(1, 0);
  r(e2, M, y, _), r(E, g, A, _);
}
function s(t2, e2) {
  o(t2, e2, a.LANCZOS_3);
}
function c(t2, e2) {
  o(t2, e2, a.LANCZOS_2);
}
!(function(t2) {
  t2[t2.LANCZOS_3 = 3] = "LANCZOS_3", t2[t2.LANCZOS_2 = 2] = "LANCZOS_2";
})(a || (a = {}));

// node_modules/@gltf-transform/functions/dist/functions.modern.js
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
var {
  POINTS: POINTS$1,
  LINES: LINES$2,
  LINE_STRIP: LINE_STRIP$3,
  LINE_LOOP: LINE_LOOP$3,
  TRIANGLES: TRIANGLES$2,
  TRIANGLE_STRIP: TRIANGLE_STRIP$3,
  TRIANGLE_FAN: TRIANGLE_FAN$3
} = Primitive.Mode;
function createTransform(name, fn) {
  Object.defineProperty(fn, "name", {
    value: name
  });
  return fn;
}
function isTransformPending(context, initial, pending) {
  if (!context) return false;
  const initialIndex = context.stack.lastIndexOf(initial);
  const pendingIndex = context.stack.lastIndexOf(pending);
  return initialIndex < pendingIndex;
}
function assignDefaults(defaults, options) {
  const result = _extends({}, defaults);
  for (const key in options) {
    if (options[key] !== void 0) {
      result[key] = options[key];
    }
  }
  return result;
}
async function rewriteTexture(source, target, fn) {
  if (!source) return null;
  const srcImage = source.getImage();
  if (!srcImage) return null;
  const pixels = await getPixels(srcImage, source.getMimeType());
  for (let i = 0; i < pixels.shape[0]; ++i) {
    for (let j = 0; j < pixels.shape[1]; ++j) {
      fn(pixels, i, j);
    }
  }
  const dstImage = await savePixels(pixels, "image/png");
  return target.setImage(dstImage).setMimeType("image/png");
}
function getGLPrimitiveCount(prim) {
  const indices = prim.getIndices();
  const position = prim.getAttribute("POSITION");
  switch (prim.getMode()) {
    case Primitive.Mode.POINTS:
      return indices ? indices.getCount() : position.getCount();
    case Primitive.Mode.LINES:
      return indices ? indices.getCount() / 2 : position.getCount() / 2;
    case Primitive.Mode.LINE_LOOP:
      return indices ? indices.getCount() : position.getCount();
    case Primitive.Mode.LINE_STRIP:
      return indices ? indices.getCount() - 1 : position.getCount() - 1;
    case Primitive.Mode.TRIANGLES:
      return indices ? indices.getCount() / 3 : position.getCount() / 3;
    case Primitive.Mode.TRIANGLE_STRIP:
    case Primitive.Mode.TRIANGLE_FAN:
      return indices ? indices.getCount() - 2 : position.getCount() - 2;
    default:
      throw new Error("Unexpected mode: " + prim.getMode());
  }
}
var SetMap = class {
  constructor() {
    this._map = /* @__PURE__ */ new Map();
  }
  get size() {
    return this._map.size;
  }
  has(k) {
    return this._map.has(k);
  }
  add(k, v) {
    let entry = this._map.get(k);
    if (!entry) {
      entry = /* @__PURE__ */ new Set();
      this._map.set(k, entry);
    }
    entry.add(v);
    return this;
  }
  get(k) {
    return this._map.get(k) || /* @__PURE__ */ new Set();
  }
  keys() {
    return this._map.keys();
  }
};
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1e3;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
function formatLong(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function formatDelta(a2, b, decimals = 2) {
  const prefix = a2 > b ? "\u2013" : "+";
  const suffix = "%";
  return prefix + (Math.abs(a2 - b) / a2 * 100).toFixed(decimals) + suffix;
}
function formatDeltaOp(a2, b) {
  return `${formatLong(a2)} \u2192 ${formatLong(b)} (${formatDelta(a2, b)})`;
}
function deepListAttributes(prim) {
  const accessors = [];
  for (const attribute of prim.listAttributes()) {
    accessors.push(attribute);
  }
  for (const target of prim.listTargets()) {
    for (const attribute of target.listAttributes()) {
      accessors.push(attribute);
    }
  }
  return Array.from(new Set(accessors));
}
function deepSwapAttribute(prim, src, dst) {
  prim.swap(src, dst);
  for (const target of prim.listTargets()) {
    target.swap(src, dst);
  }
}
function shallowEqualsArray(a2, b) {
  if (a2 == null && b == null) return true;
  if (a2 == null || b == null) return false;
  if (a2.length !== b.length) return false;
  for (let i = 0; i < a2.length; i++) {
    if (a2[i] !== b[i]) return false;
  }
  return true;
}
function shallowCloneAccessor(document, accessor) {
  return document.createAccessor(accessor.getName()).setArray(accessor.getArray()).setType(accessor.getType()).setBuffer(accessor.getBuffer()).setNormalized(accessor.getNormalized()).setSparse(accessor.getSparse());
}
function createIndices(count, maxIndex = count) {
  const array = createIndicesEmpty(count, maxIndex);
  for (let i = 0; i < array.length; i++) array[i] = i;
  return array;
}
function createIndicesEmpty(count, maxIndex = count) {
  return maxIndex <= 65534 ? new Uint16Array(count) : new Uint32Array(count);
}
function isUsed(prop) {
  return prop.listParents().some((parent) => parent.propertyType !== PropertyType.ROOT);
}
function isEmptyObject(object) {
  for (const key in object) return false;
  return true;
}
function createPrimGroupKey(prim) {
  const document = Document.fromGraph(prim.getGraph());
  const material = prim.getMaterial();
  const materialIndex = document.getRoot().listMaterials().indexOf(material);
  const mode = BASIC_MODE_MAPPING[prim.getMode()];
  const indices = !!prim.getIndices();
  const attributes = prim.listSemantics().sort().map((semantic) => {
    const attribute = prim.getAttribute(semantic);
    const elementSize = attribute.getElementSize();
    const componentType = attribute.getComponentType();
    return `${semantic}:${elementSize}:${componentType}`;
  }).join("+");
  const targets = prim.listTargets().map((target) => {
    return target.listSemantics().sort().map((semantic) => {
      const attribute = prim.getAttribute(semantic);
      const elementSize = attribute.getElementSize();
      const componentType = attribute.getComponentType();
      return `${semantic}:${elementSize}:${componentType}`;
    }).join("+");
  }).join("~");
  return `${materialIndex}|${mode}|${indices}|${attributes}|${targets}`;
}
function fitWithin(size, limit) {
  const [maxWidth, maxHeight] = limit;
  const [srcWidth, srcHeight] = size;
  if (srcWidth <= maxWidth && srcHeight <= maxHeight) return size;
  let dstWidth = srcWidth;
  let dstHeight = srcHeight;
  if (dstWidth > maxWidth) {
    dstHeight = Math.floor(dstHeight * (maxWidth / dstWidth));
    dstWidth = maxWidth;
  }
  if (dstHeight > maxHeight) {
    dstWidth = Math.floor(dstWidth * (maxHeight / dstHeight));
    dstHeight = maxHeight;
  }
  return [dstWidth, dstHeight];
}
function fitPowerOfTwo(size, method) {
  if (isPowerOfTwo(size[0]) && isPowerOfTwo(size[1])) {
    return size;
  }
  switch (method) {
    case "nearest-pot":
      return size.map(nearestPowerOfTwo);
    case "ceil-pot":
      return size.map(ceilPowerOfTwo$1);
    case "floor-pot":
      return size.map(floorPowerOfTwo);
  }
}
function isPowerOfTwo(value) {
  if (value <= 2) return true;
  return (value & value - 1) === 0 && value !== 0;
}
function nearestPowerOfTwo(value) {
  if (value <= 4) return 4;
  const lo = floorPowerOfTwo(value);
  const hi = ceilPowerOfTwo$1(value);
  if (hi - value > value - lo) return lo;
  return hi;
}
function floorPowerOfTwo(value) {
  return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
}
function ceilPowerOfTwo$1(value) {
  return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}
var BASIC_MODE_MAPPING = {
  [POINTS$1]: POINTS$1,
  [LINES$2]: LINES$2,
  [LINE_STRIP$3]: LINES$2,
  [LINE_LOOP$3]: LINES$2,
  [TRIANGLES$2]: TRIANGLES$2,
  [TRIANGLE_STRIP$3]: TRIANGLES$2,
  [TRIANGLE_FAN$3]: TRIANGLES$2
};
var NAME$o = "center";
var CENTER_DEFAULTS = {
  pivot: "center"
};
function center(_options = CENTER_DEFAULTS) {
  const options = assignDefaults(CENTER_DEFAULTS, _options);
  return createTransform(NAME$o, (doc) => {
    const logger = doc.getLogger();
    const root = doc.getRoot();
    const isAnimated = root.listAnimations().length > 0 || root.listSkins().length > 0;
    doc.getRoot().listScenes().forEach((scene, index) => {
      logger.debug(`${NAME$o}: Scene ${index + 1} / ${root.listScenes().length}.`);
      let pivot;
      if (typeof options.pivot === "string") {
        const bbox = getBounds$1(scene);
        pivot = [(bbox.max[0] - bbox.min[0]) / 2 + bbox.min[0], (bbox.max[1] - bbox.min[1]) / 2 + bbox.min[1], (bbox.max[2] - bbox.min[2]) / 2 + bbox.min[2]];
        if (options.pivot === "above") pivot[1] = bbox.max[1];
        if (options.pivot === "below") pivot[1] = bbox.min[1];
      } else {
        pivot = options.pivot;
      }
      logger.debug(`${NAME$o}: Pivot "${pivot.join(", ")}".`);
      const offset = [-1 * pivot[0], -1 * pivot[1], -1 * pivot[2]];
      if (isAnimated) {
        logger.debug(`${NAME$o}: Model contains animation or skin. Adding a wrapper node.`);
        const offsetNode = doc.createNode("Pivot").setTranslation(offset);
        scene.listChildren().forEach((child) => offsetNode.addChild(child));
        scene.addChild(offsetNode);
      } else {
        logger.debug(`${NAME$o}: Skipping wrapper, offsetting all root nodes.`);
        scene.listChildren().forEach((child) => {
          const t2 = child.getTranslation();
          child.setTranslation([t2[0] + offset[0], t2[1] + offset[1], t2[2] + offset[2]]);
        });
      }
    });
    logger.debug(`${NAME$o}: Complete.`);
  });
}
function listNodeScenes(node) {
  const visited = /* @__PURE__ */ new Set();
  let child = node;
  let parent;
  while (parent = child.getParentNode()) {
    if (visited.has(parent)) {
      throw new Error("Circular dependency in scene graph.");
    }
    visited.add(parent);
    child = parent;
  }
  return child.listParents().filter((parent2) => parent2 instanceof Scene);
}
function clearNodeParent(node) {
  const scenes = listNodeScenes(node);
  const parent = node.getParentNode();
  if (!parent) return node;
  node.setMatrix(node.getWorldMatrix());
  parent.removeChild(node);
  for (const scene of scenes) scene.addChild(node);
  return node;
}
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function() {
  var y = 0, i = arguments.length;
  while (i--) {
    y += arguments[i] * arguments[i];
  }
  return Math.sqrt(y);
};
function invert$1(out, a2) {
  var a00 = a2[0], a01 = a2[1], a02 = a2[2], a03 = a2[3];
  var a10 = a2[4], a11 = a2[5], a12 = a2[6], a13 = a2[7];
  var a20 = a2[8], a21 = a2[9], a22 = a2[10], a23 = a2[11];
  var a30 = a2[12], a31 = a2[13], a32 = a2[14], a33 = a2[15];
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
  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
function determinant(a2) {
  var a00 = a2[0], a01 = a2[1], a02 = a2[2], a03 = a2[3];
  var a10 = a2[4], a11 = a2[5], a12 = a2[6], a13 = a2[7];
  var a20 = a2[8], a21 = a2[9], a22 = a2[10], a23 = a2[11];
  var a30 = a2[12], a31 = a2[13], a32 = a2[14], a33 = a2[15];
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
function multiply$2(out, a2, b) {
  var a00 = a2[0], a01 = a2[1], a02 = a2[2], a03 = a2[3];
  var a10 = a2[4], a11 = a2[5], a12 = a2[6], a13 = a2[7];
  var a20 = a2[8], a21 = a2[9], a22 = a2[10], a23 = a2[11];
  var a30 = a2[12], a31 = a2[13], a32 = a2[14], a33 = a2[15];
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
function fromScaling(out, v) {
  out[0] = v[0];
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = v[1];
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = v[2];
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function fromRotationTranslationScale(out, q, v, s2) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  var x2 = x + x;
  var y2 = y + y;
  var z2 = z + z;
  var xx = x * x2;
  var xy = x * y2;
  var xz = x * z2;
  var yy = y * y2;
  var yz = y * z2;
  var zz = z * z2;
  var wx = w * x2;
  var wy = w * y2;
  var wz = w * z2;
  var sx = s2[0];
  var sy = s2[1];
  var sz = s2[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}
function create$2() {
  var out = new ARRAY_TYPE(9);
  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }
  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}
function fromMat4(out, a2) {
  out[0] = a2[0];
  out[1] = a2[1];
  out[2] = a2[2];
  out[3] = a2[4];
  out[4] = a2[5];
  out[5] = a2[6];
  out[6] = a2[8];
  out[7] = a2[9];
  out[8] = a2[10];
  return out;
}
function transpose(out, a2) {
  if (out === a2) {
    var a01 = a2[1], a02 = a2[2], a12 = a2[5];
    out[1] = a2[3];
    out[2] = a2[6];
    out[3] = a01;
    out[5] = a2[7];
    out[6] = a02;
    out[7] = a12;
  } else {
    out[0] = a2[0];
    out[1] = a2[3];
    out[2] = a2[6];
    out[3] = a2[1];
    out[4] = a2[4];
    out[5] = a2[7];
    out[6] = a2[2];
    out[7] = a2[5];
    out[8] = a2[8];
  }
  return out;
}
function invert(out, a2) {
  var a00 = a2[0], a01 = a2[1], a02 = a2[2];
  var a10 = a2[3], a11 = a2[4], a12 = a2[5];
  var a20 = a2[6], a21 = a2[7], a22 = a2[8];
  var b01 = a22 * a11 - a12 * a21;
  var b11 = -a22 * a10 + a12 * a20;
  var b21 = a21 * a10 - a11 * a20;
  var det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = b01 * det;
  out[1] = (-a22 * a01 + a02 * a21) * det;
  out[2] = (a12 * a01 - a02 * a11) * det;
  out[3] = b11 * det;
  out[4] = (a22 * a00 - a02 * a20) * det;
  out[5] = (-a12 * a00 + a02 * a10) * det;
  out[6] = b21 * det;
  out[7] = (-a21 * a00 + a01 * a20) * det;
  out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}
function create$1() {
  var out = new ARRAY_TYPE(3);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  return out;
}
function multiply$1(out, a2, b) {
  out[0] = a2[0] * b[0];
  out[1] = a2[1] * b[1];
  out[2] = a2[2] * b[2];
  return out;
}
function min(out, a2, b) {
  out[0] = Math.min(a2[0], b[0]);
  out[1] = Math.min(a2[1], b[1]);
  out[2] = Math.min(a2[2], b[2]);
  return out;
}
function max(out, a2, b) {
  out[0] = Math.max(a2[0], b[0]);
  out[1] = Math.max(a2[1], b[1]);
  out[2] = Math.max(a2[2], b[2]);
  return out;
}
function scale$1(out, a2, b) {
  out[0] = a2[0] * b;
  out[1] = a2[1] * b;
  out[2] = a2[2] * b;
  return out;
}
function normalize(out, a2) {
  var x = a2[0];
  var y = a2[1];
  var z = a2[2];
  var len2 = x * x + y * y + z * z;
  if (len2 > 0) {
    len2 = 1 / Math.sqrt(len2);
  }
  out[0] = a2[0] * len2;
  out[1] = a2[1] * len2;
  out[2] = a2[2] * len2;
  return out;
}
function transformMat4(out, a2, m) {
  var x = a2[0], y = a2[1], z = a2[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
function transformMat3(out, a2, m) {
  var x = a2[0], y = a2[1], z = a2[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}
var mul$1 = multiply$1;
(function() {
  var vec = create$1();
  return function(a2, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 3;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a2.length);
    } else {
      l = a2.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a2[i];
      vec[1] = a2[i + 1];
      vec[2] = a2[i + 2];
      fn(vec, vec, arg);
      a2[i] = vec[0];
      a2[i + 1] = vec[1];
      a2[i + 2] = vec[2];
    }
    return a2;
  };
})();
var NAME$n = "dedup";
var DEDUP_DEFAULTS = {
  keepUniqueNames: false,
  propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE, PropertyType.MATERIAL, PropertyType.SKIN]
};
function dedup(_options = DEDUP_DEFAULTS) {
  const options = assignDefaults(DEDUP_DEFAULTS, _options);
  const propertyTypes = new Set(options.propertyTypes);
  for (const propertyType of options.propertyTypes) {
    if (!DEDUP_DEFAULTS.propertyTypes.includes(propertyType)) {
      throw new Error(`${NAME$n}: Unsupported deduplication on type "${propertyType}".`);
    }
  }
  return createTransform(NAME$n, (document) => {
    const logger = document.getLogger();
    if (propertyTypes.has(PropertyType.ACCESSOR)) dedupAccessors(document);
    if (propertyTypes.has(PropertyType.TEXTURE)) dedupImages(document, options);
    if (propertyTypes.has(PropertyType.MATERIAL)) dedupMaterials(document, options);
    if (propertyTypes.has(PropertyType.MESH)) dedupMeshes(document, options);
    if (propertyTypes.has(PropertyType.SKIN)) dedupSkins(document, options);
    logger.debug(`${NAME$n}: Complete.`);
  });
}
function dedupAccessors(document) {
  const logger = document.getLogger();
  const indicesMap = /* @__PURE__ */ new Map();
  const attributeMap = /* @__PURE__ */ new Map();
  const inputMap = /* @__PURE__ */ new Map();
  const outputMap = /* @__PURE__ */ new Map();
  const meshes = document.getRoot().listMeshes();
  meshes.forEach((mesh) => {
    mesh.listPrimitives().forEach((primitive) => {
      primitive.listAttributes().forEach((accessor) => hashAccessor(accessor, attributeMap));
      hashAccessor(primitive.getIndices(), indicesMap);
    });
  });
  for (const animation of document.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      hashAccessor(sampler.getInput(), inputMap);
      hashAccessor(sampler.getOutput(), outputMap);
    }
  }
  function hashAccessor(accessor, group) {
    if (!accessor) return;
    const hash = [accessor.getCount(), accessor.getType(), accessor.getComponentType(), accessor.getNormalized(), accessor.getSparse()].join(":");
    let hashSet = group.get(hash);
    if (!hashSet) group.set(hash, hashSet = /* @__PURE__ */ new Set());
    hashSet.add(accessor);
  }
  function detectDuplicates(accessors, duplicates2) {
    for (let i = 0; i < accessors.length; i++) {
      const a2 = accessors[i];
      const aData = BufferUtils.toView(a2.getArray());
      if (duplicates2.has(a2)) continue;
      for (let j = i + 1; j < accessors.length; j++) {
        const b = accessors[j];
        if (duplicates2.has(b)) continue;
        if (BufferUtils.equals(aData, BufferUtils.toView(b.getArray()))) {
          duplicates2.set(b, a2);
        }
      }
    }
  }
  let total = 0;
  const duplicates = /* @__PURE__ */ new Map();
  for (const group of [attributeMap, indicesMap, inputMap, outputMap]) {
    for (const hashGroup of group.values()) {
      total += hashGroup.size;
      detectDuplicates(Array.from(hashGroup), duplicates);
    }
  }
  logger.debug(`${NAME$n}: Merged ${duplicates.size} of ${total} accessors.`);
  meshes.forEach((mesh) => {
    mesh.listPrimitives().forEach((primitive) => {
      primitive.listAttributes().forEach((accessor) => {
        if (duplicates.has(accessor)) {
          primitive.swap(accessor, duplicates.get(accessor));
        }
      });
      const indices = primitive.getIndices();
      if (indices && duplicates.has(indices)) {
        primitive.swap(indices, duplicates.get(indices));
      }
    });
  });
  for (const animation of document.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      const input = sampler.getInput();
      const output = sampler.getOutput();
      if (input && duplicates.has(input)) {
        sampler.swap(input, duplicates.get(input));
      }
      if (output && duplicates.has(output)) {
        sampler.swap(output, duplicates.get(output));
      }
    }
  }
  Array.from(duplicates.keys()).forEach((accessor) => accessor.dispose());
}
function dedupMeshes(document, options) {
  const logger = document.getLogger();
  const root = document.getRoot();
  const refs = /* @__PURE__ */ new Map();
  root.listAccessors().forEach((accessor, index) => refs.set(accessor, index));
  root.listMaterials().forEach((material, index) => refs.set(material, index));
  const numMeshes = root.listMeshes().length;
  const uniqueMeshes = /* @__PURE__ */ new Map();
  for (const src of root.listMeshes()) {
    const srcKeyItems = [];
    for (const prim of src.listPrimitives()) {
      srcKeyItems.push(createPrimitiveKey(prim, refs));
    }
    let meshKey = "";
    if (options.keepUniqueNames) meshKey += src.getName() + ";";
    meshKey += srcKeyItems.join(";");
    if (uniqueMeshes.has(meshKey)) {
      const targetMesh = uniqueMeshes.get(meshKey);
      src.listParents().forEach((parent) => {
        if (parent.propertyType !== PropertyType.ROOT) {
          parent.swap(src, targetMesh);
        }
      });
      src.dispose();
    } else {
      uniqueMeshes.set(meshKey, src);
    }
  }
  logger.debug(`${NAME$n}: Merged ${numMeshes - uniqueMeshes.size} of ${numMeshes} meshes.`);
}
function dedupImages(document, options) {
  const logger = document.getLogger();
  const root = document.getRoot();
  const textures = root.listTextures();
  const duplicates = /* @__PURE__ */ new Map();
  for (let i = 0; i < textures.length; i++) {
    const a2 = textures[i];
    const aData = a2.getImage();
    if (duplicates.has(a2)) continue;
    for (let j = i + 1; j < textures.length; j++) {
      const b = textures[j];
      const bData = b.getImage();
      if (duplicates.has(b)) continue;
      if (a2.getMimeType() !== b.getMimeType()) continue;
      if (options.keepUniqueNames && a2.getName() !== b.getName()) continue;
      const aSize = a2.getSize();
      const bSize = b.getSize();
      if (!aSize || !bSize) continue;
      if (aSize[0] !== bSize[0]) continue;
      if (aSize[1] !== bSize[1]) continue;
      if (!aData || !bData) continue;
      if (BufferUtils.equals(aData, bData)) {
        duplicates.set(b, a2);
      }
    }
  }
  logger.debug(`${NAME$n}: Merged ${duplicates.size} of ${root.listTextures().length} textures.`);
  Array.from(duplicates.entries()).forEach(([src, dst]) => {
    src.listParents().forEach((property) => {
      if (!(property instanceof Root)) property.swap(src, dst);
    });
    src.dispose();
  });
}
function dedupMaterials(document, options) {
  const logger = document.getLogger();
  const root = document.getRoot();
  const materials = root.listMaterials();
  const duplicates = /* @__PURE__ */ new Map();
  const modifierCache = /* @__PURE__ */ new Map();
  const skip = /* @__PURE__ */ new Set();
  if (!options.keepUniqueNames) {
    skip.add("name");
  }
  for (let i = 0; i < materials.length; i++) {
    const a2 = materials[i];
    if (duplicates.has(a2)) continue;
    if (hasModifier(a2, modifierCache)) continue;
    for (let j = i + 1; j < materials.length; j++) {
      const b = materials[j];
      if (duplicates.has(b)) continue;
      if (hasModifier(b, modifierCache)) continue;
      if (a2.equals(b, skip)) {
        duplicates.set(b, a2);
      }
    }
  }
  logger.debug(`${NAME$n}: Merged ${duplicates.size} of ${materials.length} materials.`);
  Array.from(duplicates.entries()).forEach(([src, dst]) => {
    src.listParents().forEach((property) => {
      if (!(property instanceof Root)) property.swap(src, dst);
    });
    src.dispose();
  });
}
function dedupSkins(document, options) {
  const logger = document.getLogger();
  const root = document.getRoot();
  const skins = root.listSkins();
  const duplicates = /* @__PURE__ */ new Map();
  const skip = /* @__PURE__ */ new Set(["joints"]);
  if (!options.keepUniqueNames) {
    skip.add("name");
  }
  for (let i = 0; i < skins.length; i++) {
    const a2 = skins[i];
    if (duplicates.has(a2)) continue;
    for (let j = i + 1; j < skins.length; j++) {
      const b = skins[j];
      if (duplicates.has(b)) continue;
      if (a2.equals(b, skip) && shallowEqualsArray(a2.listJoints(), b.listJoints())) {
        duplicates.set(b, a2);
      }
    }
  }
  logger.debug(`${NAME$n}: Merged ${duplicates.size} of ${skins.length} skins.`);
  Array.from(duplicates.entries()).forEach(([src, dst]) => {
    src.listParents().forEach((property) => {
      if (!(property instanceof Root)) property.swap(src, dst);
    });
    src.dispose();
  });
}
function createPrimitiveKey(prim, refs) {
  const primKeyItems = [];
  for (const semantic of prim.listSemantics()) {
    const attribute = prim.getAttribute(semantic);
    primKeyItems.push(semantic + ":" + refs.get(attribute));
  }
  if (prim instanceof Primitive) {
    const indices = prim.getIndices();
    if (indices) {
      primKeyItems.push("indices:" + refs.get(indices));
    }
    const material = prim.getMaterial();
    if (material) {
      primKeyItems.push("material:" + refs.get(material));
    }
    primKeyItems.push("mode:" + prim.getMode());
    for (const target of prim.listTargets()) {
      primKeyItems.push("target:" + createPrimitiveKey(target, refs));
    }
  }
  return primKeyItems.join(",");
}
function hasModifier(prop, cache) {
  if (cache.has(prop)) return cache.get(prop);
  const graph = prop.getGraph();
  const visitedNodes = /* @__PURE__ */ new Set();
  const edgeQueue = graph.listParentEdges(prop);
  while (edgeQueue.length > 0) {
    const edge = edgeQueue.pop();
    if (edge.getAttributes().modifyChild === true) {
      cache.set(prop, true);
      return true;
    }
    const child = edge.getChild();
    if (visitedNodes.has(child)) continue;
    for (const childEdge of graph.listChildEdges(child)) {
      edgeQueue.push(childEdge);
    }
  }
  cache.set(prop, false);
  return false;
}
function create() {
  var out = new ARRAY_TYPE(4);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }
  return out;
}
function add(out, a2, b) {
  out[0] = a2[0] + b[0];
  out[1] = a2[1] + b[1];
  out[2] = a2[2] + b[2];
  out[3] = a2[3] + b[3];
  return out;
}
function subtract(out, a2, b) {
  out[0] = a2[0] - b[0];
  out[1] = a2[1] - b[1];
  out[2] = a2[2] - b[2];
  out[3] = a2[3] - b[3];
  return out;
}
function multiply(out, a2, b) {
  out[0] = a2[0] * b[0];
  out[1] = a2[1] * b[1];
  out[2] = a2[2] * b[2];
  out[3] = a2[3] * b[3];
  return out;
}
function scale(out, a2, b) {
  out[0] = a2[0] * b;
  out[1] = a2[1] * b;
  out[2] = a2[2] * b;
  out[3] = a2[3] * b;
  return out;
}
function length(a2) {
  var x = a2[0];
  var y = a2[1];
  var z = a2[2];
  var w = a2[3];
  return Math.hypot(x, y, z, w);
}
var sub = subtract;
var mul = multiply;
var len = length;
(function() {
  var vec = create();
  return function(a2, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 4;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a2.length);
    } else {
      l = a2.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a2[i];
      vec[1] = a2[i + 1];
      vec[2] = a2[i + 2];
      vec[3] = a2[i + 3];
      fn(vec, vec, arg);
      a2[i] = vec[0];
      a2[i + 1] = vec[1];
      a2[i + 2] = vec[2];
      a2[i + 3] = vec[3];
    }
    return a2;
  };
})();
var SRGB_PATTERN = /color|emissive|diffuse/i;
function getTextureColorSpace(texture) {
  const graph = texture.getGraph();
  const edges = graph.listParentEdges(texture);
  const isSRGB = edges.some((edge) => {
    return edge.getAttributes().isColor || SRGB_PATTERN.test(edge.getName());
  });
  return isSRGB ? "srgb" : null;
}
function listTextureInfo(texture) {
  const graph = texture.getGraph();
  const results = /* @__PURE__ */ new Set();
  for (const textureEdge of graph.listParentEdges(texture)) {
    const parent = textureEdge.getParent();
    const name = textureEdge.getName() + "Info";
    for (const edge of graph.listChildEdges(parent)) {
      const child = edge.getChild();
      if (child instanceof TextureInfo && edge.getName() === name) {
        results.add(child);
      }
    }
  }
  return Array.from(results);
}
function listTextureInfoByMaterial(material) {
  const graph = material.getGraph();
  const visited = /* @__PURE__ */ new Set();
  const results = /* @__PURE__ */ new Set();
  function traverse(prop) {
    const textureInfoNames = /* @__PURE__ */ new Set();
    for (const edge of graph.listChildEdges(prop)) {
      if (edge.getChild() instanceof Texture) {
        textureInfoNames.add(edge.getName() + "Info");
      }
    }
    for (const edge of graph.listChildEdges(prop)) {
      const child = edge.getChild();
      if (visited.has(child)) continue;
      visited.add(child);
      if (child instanceof TextureInfo && textureInfoNames.has(edge.getName())) {
        results.add(child);
      } else if (child instanceof ExtensionProperty) {
        traverse(child);
      }
    }
  }
  traverse(material);
  return Array.from(results);
}
function listTextureSlots(texture) {
  const document = Document.fromGraph(texture.getGraph());
  const root = document.getRoot();
  const slots = texture.getGraph().listParentEdges(texture).filter((edge) => edge.getParent() !== root).map((edge) => edge.getName());
  return Array.from(new Set(slots));
}
var NAME$m = "prune";
var EPS = 3 / 255;
var PRUNE_DEFAULTS = {
  propertyTypes: [PropertyType.NODE, PropertyType.SKIN, PropertyType.MESH, PropertyType.CAMERA, PropertyType.PRIMITIVE, PropertyType.PRIMITIVE_TARGET, PropertyType.ANIMATION, PropertyType.MATERIAL, PropertyType.TEXTURE, PropertyType.ACCESSOR, PropertyType.BUFFER],
  keepLeaves: false,
  keepAttributes: false,
  keepIndices: false,
  keepSolidTextures: false,
  keepExtras: false
};
function prune(_options = PRUNE_DEFAULTS) {
  const options = assignDefaults(PRUNE_DEFAULTS, _options);
  const propertyTypes = new Set(options.propertyTypes);
  const keepExtras = options.keepExtras;
  return createTransform(NAME$m, async (document) => {
    const logger = document.getLogger();
    const root = document.getRoot();
    const graph = document.getGraph();
    const counter = new DisposeCounter();
    const onDispose = (event) => counter.dispose(event.target);
    graph.addEventListener("node:dispose", onDispose);
    if (propertyTypes.has(PropertyType.MESH)) {
      for (const mesh of root.listMeshes()) {
        if (mesh.listPrimitives().length > 0) continue;
        mesh.dispose();
      }
    }
    if (propertyTypes.has(PropertyType.NODE)) {
      if (!options.keepLeaves) {
        for (const scene of root.listScenes()) {
          nodeTreeShake(graph, scene, keepExtras);
        }
      }
      for (const node of root.listNodes()) {
        treeShake(node, keepExtras);
      }
    }
    if (propertyTypes.has(PropertyType.SKIN)) {
      for (const skin of root.listSkins()) {
        treeShake(skin, keepExtras);
      }
    }
    if (propertyTypes.has(PropertyType.MESH)) {
      for (const mesh of root.listMeshes()) {
        treeShake(mesh, keepExtras);
      }
    }
    if (propertyTypes.has(PropertyType.CAMERA)) {
      for (const camera of root.listCameras()) {
        treeShake(camera, keepExtras);
      }
    }
    if (propertyTypes.has(PropertyType.PRIMITIVE)) {
      indirectTreeShake(graph, PropertyType.PRIMITIVE, keepExtras);
    }
    if (propertyTypes.has(PropertyType.PRIMITIVE_TARGET)) {
      indirectTreeShake(graph, PropertyType.PRIMITIVE_TARGET, keepExtras);
    }
    if (!options.keepAttributes && propertyTypes.has(PropertyType.ACCESSOR)) {
      const materialPrims = /* @__PURE__ */ new Map();
      for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          const material = prim.getMaterial();
          if (!material) continue;
          const required = listRequiredSemantics(document, prim, material);
          const unused = listUnusedSemantics(prim, required);
          pruneAttributes(prim, unused);
          prim.listTargets().forEach((target) => pruneAttributes(target, unused));
          materialPrims.has(material) ? materialPrims.get(material).add(prim) : materialPrims.set(material, /* @__PURE__ */ new Set([prim]));
        }
      }
      for (const [material, prims] of materialPrims) {
        shiftTexCoords(material, Array.from(prims));
      }
    }
    if (!options.keepIndices && propertyTypes.has(PropertyType.ACCESSOR)) {
      for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          pruneIndices(prim);
        }
      }
    }
    if (propertyTypes.has(PropertyType.ANIMATION)) {
      for (const anim of root.listAnimations()) {
        for (const channel of anim.listChannels()) {
          if (!channel.getTargetNode()) {
            channel.dispose();
          }
        }
        if (!anim.listChannels().length) {
          const samplers = anim.listSamplers();
          treeShake(anim, keepExtras);
          samplers.forEach((sampler) => treeShake(sampler, keepExtras));
        } else {
          anim.listSamplers().forEach((sampler) => treeShake(sampler, keepExtras));
        }
      }
    }
    if (propertyTypes.has(PropertyType.MATERIAL)) {
      root.listMaterials().forEach((material) => treeShake(material, keepExtras));
    }
    if (propertyTypes.has(PropertyType.TEXTURE)) {
      root.listTextures().forEach((texture) => treeShake(texture, keepExtras));
      if (!options.keepSolidTextures) {
        await pruneSolidTextures(document);
      }
    }
    if (propertyTypes.has(PropertyType.ACCESSOR)) {
      root.listAccessors().forEach((accessor) => treeShake(accessor, keepExtras));
    }
    if (propertyTypes.has(PropertyType.BUFFER)) {
      root.listBuffers().forEach((buffer) => treeShake(buffer, keepExtras));
    }
    graph.removeEventListener("node:dispose", onDispose);
    if (!counter.empty()) {
      const str = counter.entries().map(([type, count]) => `${type} (${count})`).join(", ");
      logger.info(`${NAME$m}: Removed types... ${str}`);
    } else {
      logger.info(`${NAME$m}: No unused properties found.`);
    }
    logger.debug(`${NAME$m}: Complete.`);
  });
}
var DisposeCounter = class {
  constructor() {
    this.disposed = {};
  }
  empty() {
    for (const key in this.disposed) return false;
    return true;
  }
  entries() {
    return Object.entries(this.disposed);
  }
  /** Records properties disposed by type. */
  dispose(prop) {
    this.disposed[prop.propertyType] = this.disposed[prop.propertyType] || 0;
    this.disposed[prop.propertyType]++;
  }
};
function treeShake(prop, keepExtras) {
  const parents = prop.listParents().filter((p) => !(p instanceof Root || p instanceof AnimationChannel));
  const needsExtras = keepExtras && !isEmptyObject(prop.getExtras());
  if (!parents.length && !needsExtras) {
    prop.dispose();
  }
}
function indirectTreeShake(graph, propertyType, keepExtras) {
  for (const edge of graph.listEdges()) {
    const parent = edge.getParent();
    if (parent.propertyType === propertyType) {
      treeShake(parent, keepExtras);
    }
  }
}
function nodeTreeShake(graph, prop, keepExtras) {
  prop.listChildren().forEach((child) => nodeTreeShake(graph, child, keepExtras));
  if (prop instanceof Scene) return;
  const isUsed2 = graph.listParentEdges(prop).some((e2) => {
    const ptype = e2.getParent().propertyType;
    return ptype !== PropertyType.ROOT && ptype !== PropertyType.SCENE && ptype !== PropertyType.NODE;
  });
  const isEmpty = graph.listChildren(prop).length === 0;
  const needsExtras = keepExtras && !isEmptyObject(prop.getExtras());
  if (isEmpty && !isUsed2 && !needsExtras) {
    prop.dispose();
  }
}
function pruneAttributes(prim, unused) {
  for (const semantic of unused) {
    prim.setAttribute(semantic, null);
  }
}
function pruneIndices(prim) {
  const indices = prim.getIndices();
  const indicesArray = indices && indices.getArray();
  const attribute = prim.listAttributes()[0];
  if (!indicesArray || !attribute) {
    return;
  }
  if (indices.getCount() !== attribute.getCount()) {
    return;
  }
  for (let i = 0, il = indicesArray.length; i < il; i++) {
    if (i !== indicesArray[i]) {
      return;
    }
  }
  prim.setIndices(null);
}
function listUnusedSemantics(prim, required) {
  const unused = [];
  for (const semantic of prim.listSemantics()) {
    if (semantic === "NORMAL" && !required.has(semantic)) {
      unused.push(semantic);
    } else if (semantic === "TANGENT" && !required.has(semantic)) {
      unused.push(semantic);
    } else if (semantic.startsWith("TEXCOORD_") && !required.has(semantic)) {
      unused.push(semantic);
    } else if (semantic.startsWith("COLOR_") && semantic !== "COLOR_0") {
      unused.push(semantic);
    }
  }
  return unused;
}
function listRequiredSemantics(document, prim, material, semantics = /* @__PURE__ */ new Set()) {
  const graph = document.getGraph();
  const edges = graph.listChildEdges(material);
  const textureNames = /* @__PURE__ */ new Set();
  for (const edge of edges) {
    if (edge.getChild() instanceof Texture) {
      textureNames.add(edge.getName());
    }
  }
  for (const edge of edges) {
    const name = edge.getName();
    const child = edge.getChild();
    if (child instanceof TextureInfo) {
      if (textureNames.has(name.replace(/Info$/, ""))) {
        semantics.add(`TEXCOORD_${child.getTexCoord()}`);
      }
    }
    if (child instanceof Texture && name.match(/normalTexture/i)) {
      semantics.add("TANGENT");
    }
    if (child instanceof ExtensionProperty) {
      listRequiredSemantics(document, prim, child, semantics);
    }
  }
  const isLit = material instanceof Material && !material.getExtension("KHR_materials_unlit");
  const isPoints = prim.getMode() === Primitive.Mode.POINTS;
  if (isLit && !isPoints) {
    semantics.add("NORMAL");
  }
  return semantics;
}
function shiftTexCoords(material, prims) {
  const textureInfoList = listTextureInfoByMaterial(material);
  const texCoordSet = new Set(textureInfoList.map((info) => info.getTexCoord()));
  const texCoordList = Array.from(texCoordSet).sort();
  const texCoordMap = new Map(texCoordList.map((texCoord, index) => [texCoord, index]));
  const semanticMap = new Map(texCoordList.map((texCoord, index) => [`TEXCOORD_${texCoord}`, `TEXCOORD_${index}`]));
  for (const textureInfo of textureInfoList) {
    const texCoord = textureInfo.getTexCoord();
    textureInfo.setTexCoord(texCoordMap.get(texCoord));
  }
  for (const prim of prims) {
    const semantics = prim.listSemantics().filter((semantic) => semantic.startsWith("TEXCOORD_")).sort();
    updatePrim(prim, semantics);
    prim.listTargets().forEach((target) => updatePrim(target, semantics));
  }
  function updatePrim(prim, srcSemantics) {
    for (const srcSemantic of srcSemantics) {
      const uv = prim.getAttribute(srcSemantic);
      if (!uv) continue;
      const dstSemantic = semanticMap.get(srcSemantic);
      if (dstSemantic === srcSemantic) continue;
      prim.setAttribute(dstSemantic, uv);
      prim.setAttribute(srcSemantic, null);
    }
  }
}
async function pruneSolidTextures(document) {
  const root = document.getRoot();
  const graph = document.getGraph();
  const logger = document.getLogger();
  const textures = root.listTextures();
  const pending = textures.map(async (texture) => {
    var _texture$getSize;
    const factor = await getTextureFactor(texture);
    if (!factor) return;
    if (getTextureColorSpace(texture) === "srgb") {
      ColorUtils.convertSRGBToLinear(factor, factor);
    }
    const name = texture.getName() || texture.getURI();
    const size = (_texture$getSize = texture.getSize()) == null ? void 0 : _texture$getSize.join("x");
    const slots = listTextureSlots(texture);
    for (const edge of graph.listParentEdges(texture)) {
      const parent = edge.getParent();
      if (parent !== root && applyMaterialFactor(parent, factor, edge.getName(), logger)) {
        edge.dispose();
      }
    }
    if (texture.listParents().length === 1) {
      texture.dispose();
      logger.debug(`${NAME$m}: Removed solid-color texture "${name}" (${size}px ${slots.join(", ")})`);
    }
  });
  await Promise.all(pending);
}
function applyMaterialFactor(material, factor, slot, logger) {
  if (material instanceof Material) {
    switch (slot) {
      case "baseColorTexture":
        material.setBaseColorFactor(mul(factor, factor, material.getBaseColorFactor()));
        return true;
      case "emissiveTexture":
        material.setEmissiveFactor(mul$1([0, 0, 0], factor.slice(0, 3), material.getEmissiveFactor()));
        return true;
      case "occlusionTexture":
        return Math.abs(factor[0] - 1) <= EPS;
      case "metallicRoughnessTexture":
        material.setRoughnessFactor(factor[1] * material.getRoughnessFactor());
        material.setMetallicFactor(factor[2] * material.getMetallicFactor());
        return true;
      case "normalTexture":
        return len(sub(create(), factor, [0.5, 0.5, 1, 1])) <= EPS;
    }
  }
  logger.warn(`${NAME$m}: Detected single-color ${slot} texture. Pruning ${slot} not yet supported.`);
  return false;
}
async function getTextureFactor(texture) {
  const pixels = await maybeGetPixels(texture);
  if (!pixels) return null;
  const min2 = [Infinity, Infinity, Infinity, Infinity];
  const max2 = [-Infinity, -Infinity, -Infinity, -Infinity];
  const target = [0, 0, 0, 0];
  const [width, height] = pixels.shape;
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      for (let k = 0; k < 4; k++) {
        min2[k] = Math.min(min2[k], pixels.get(i, j, k));
        max2[k] = Math.max(max2[k], pixels.get(i, j, k));
      }
    }
    if (len(sub(target, max2, min2)) / 255 > EPS) {
      return null;
    }
  }
  return scale(target, add(target, max2, min2), 0.5 / 255);
}
async function maybeGetPixels(texture) {
  try {
    return await getPixels(texture.getImage(), texture.getMimeType());
  } catch (e2) {
    return null;
  }
}
var EMPTY_U32$1 = 2 ** 32 - 1;
var VertexStream = class {
  constructor(prim) {
    this.attributes = [];
    this.u8 = void 0;
    this.u32 = void 0;
    let byteStride = 0;
    for (const attribute of deepListAttributes(prim)) {
      byteStride += this._initAttribute(attribute);
    }
    this.u8 = new Uint8Array(byteStride);
    this.u32 = new Uint32Array(this.u8.buffer);
  }
  _initAttribute(attribute) {
    const array = attribute.getArray();
    const u8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const byteStride = attribute.getElementSize() * attribute.getComponentSize();
    const paddedByteStride = BufferUtils.padNumber(byteStride);
    this.attributes.push({
      u8,
      byteStride,
      paddedByteStride
    });
    return paddedByteStride;
  }
  hash(index) {
    let byteOffset = 0;
    for (const {
      u8,
      byteStride,
      paddedByteStride
    } of this.attributes) {
      for (let i = 0; i < paddedByteStride; i++) {
        if (i < byteStride) {
          this.u8[byteOffset + i] = u8[index * byteStride + i];
        } else {
          this.u8[byteOffset + i] = 0;
        }
      }
      byteOffset += paddedByteStride;
    }
    return murmurHash2(0, this.u32);
  }
  equal(a2, b) {
    for (const {
      u8,
      byteStride
    } of this.attributes) {
      for (let j = 0; j < byteStride; j++) {
        if (u8[a2 * byteStride + j] !== u8[b * byteStride + j]) {
          return false;
        }
      }
    }
    return true;
  }
};
function murmurHash2(h, key) {
  const m = 1540483477;
  const r2 = 24;
  for (let i = 0, il = key.length; i < il; i++) {
    let k = key[i];
    k = Math.imul(k, m) >>> 0;
    k = (k ^ k >> r2) >>> 0;
    k = Math.imul(k, m) >>> 0;
    h = Math.imul(h, m) >>> 0;
    h = (h ^ k) >>> 0;
  }
  return h;
}
function hashLookup(table, buckets, stream, key, empty = EMPTY_U32$1) {
  const hashmod = buckets - 1;
  const hashval = stream.hash(key);
  let bucket = hashval & hashmod;
  for (let probe = 0; probe <= hashmod; probe++) {
    const item = table[bucket];
    if (item === empty || stream.equal(item, key)) {
      return bucket;
    }
    bucket = bucket + probe + 1 & hashmod;
  }
  throw new Error("Hash table full.");
}
var VertexCountMethod;
(function(VertexCountMethod2) {
  VertexCountMethod2["RENDER"] = "render";
  VertexCountMethod2["RENDER_CACHED"] = "render-cached";
  VertexCountMethod2["UPLOAD"] = "upload";
  VertexCountMethod2["UPLOAD_NAIVE"] = "upload-naive";
  VertexCountMethod2["DISTINCT"] = "distinct";
  VertexCountMethod2["DISTINCT_POSITION"] = "distinct-position";
  VertexCountMethod2["UNUSED"] = "unused";
})(VertexCountMethod || (VertexCountMethod = {}));
function getSceneVertexCount(scene, method) {
  return _getSubtreeVertexCount(scene, method);
}
function getNodeVertexCount(node, method) {
  return _getSubtreeVertexCount(node, method);
}
function _getSubtreeVertexCount(node, method) {
  const instancedMeshes = [];
  const nonInstancedMeshes = [];
  const meshes = [];
  node.traverse((node2) => {
    const mesh = node2.getMesh();
    const batch = node2.getExtension("EXT_mesh_gpu_instancing");
    if (batch && mesh) {
      meshes.push(mesh);
      instancedMeshes.push([batch.listAttributes()[0].getCount(), mesh]);
    } else if (mesh) {
      meshes.push(mesh);
      nonInstancedMeshes.push(mesh);
    }
  });
  const prims = meshes.flatMap((mesh) => mesh.listPrimitives());
  const positions = prims.map((prim) => prim.getAttribute("POSITION"));
  const uniquePositions = Array.from(new Set(positions));
  const uniqueMeshes = Array.from(new Set(meshes));
  const uniquePrims = Array.from(new Set(uniqueMeshes.flatMap((mesh) => mesh.listPrimitives())));
  switch (method) {
    case VertexCountMethod.RENDER:
    case VertexCountMethod.RENDER_CACHED:
      return _sum(nonInstancedMeshes.map((mesh) => getMeshVertexCount(mesh, method))) + _sum(instancedMeshes.map(([batch, mesh]) => batch * getMeshVertexCount(mesh, method)));
    case VertexCountMethod.UPLOAD_NAIVE:
      return _sum(uniqueMeshes.map((mesh) => getMeshVertexCount(mesh, method)));
    case VertexCountMethod.UPLOAD:
      return _sum(uniquePositions.map((attribute) => attribute.getCount()));
    case VertexCountMethod.DISTINCT:
    case VertexCountMethod.DISTINCT_POSITION:
      return _assertNotImplemented(method);
    case VertexCountMethod.UNUSED:
      return _sumUnused(uniquePrims);
    default:
      return _assertUnreachable(method);
  }
}
function getMeshVertexCount(mesh, method) {
  const prims = mesh.listPrimitives();
  const uniquePrims = Array.from(new Set(prims));
  const uniquePositions = Array.from(new Set(uniquePrims.map((prim) => prim.getAttribute("POSITION"))));
  switch (method) {
    case VertexCountMethod.RENDER:
    case VertexCountMethod.RENDER_CACHED:
    case VertexCountMethod.UPLOAD_NAIVE:
      return _sum(prims.map((prim) => getPrimitiveVertexCount(prim, method)));
    case VertexCountMethod.UPLOAD:
      return _sum(uniquePositions.map((attribute) => attribute.getCount()));
    case VertexCountMethod.DISTINCT:
    case VertexCountMethod.DISTINCT_POSITION:
      return _assertNotImplemented(method);
    case VertexCountMethod.UNUSED:
      return _sumUnused(uniquePrims);
    default:
      return _assertUnreachable(method);
  }
}
function getPrimitiveVertexCount(prim, method) {
  const position = prim.getAttribute("POSITION");
  const indices = prim.getIndices();
  switch (method) {
    case VertexCountMethod.RENDER:
      return indices ? indices.getCount() : position.getCount();
    case VertexCountMethod.RENDER_CACHED:
      return indices ? new Set(indices.getArray()).size : position.getCount();
    case VertexCountMethod.UPLOAD_NAIVE:
    case VertexCountMethod.UPLOAD:
      return position.getCount();
    case VertexCountMethod.DISTINCT:
    case VertexCountMethod.DISTINCT_POSITION:
      return _assertNotImplemented(method);
    case VertexCountMethod.UNUSED:
      return indices ? position.getCount() - new Set(indices.getArray()).size : 0;
    default:
      return _assertUnreachable(method);
  }
}
function _sum(values) {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }
  return total;
}
function _sumUnused(prims) {
  const attributeIndexMap = /* @__PURE__ */ new Map();
  for (const prim of prims) {
    const position = prim.getAttribute("POSITION");
    const indices = prim.getIndices();
    const indicesSet = attributeIndexMap.get(position) || /* @__PURE__ */ new Set();
    indicesSet.add(indices);
    attributeIndexMap.set(position, indicesSet);
  }
  let unused = 0;
  for (const [position, indicesSet] of attributeIndexMap) {
    if (indicesSet.has(null)) continue;
    const usedIndices = new Uint8Array(position.getCount());
    for (const indices of indicesSet) {
      const indicesArray = indices.getArray();
      for (let i = 0, il = indicesArray.length; i < il; i++) {
        usedIndices[indicesArray[i]] = 1;
      }
    }
    for (let i = 0, il = position.getCount(); i < il; i++) {
      if (usedIndices[i] === 0) unused++;
    }
  }
  return unused;
}
function _assertNotImplemented(x) {
  throw new Error(`Not implemented: ${x}`);
}
function _assertUnreachable(x) {
  throw new Error(`Unexpected value: ${x}`);
}
function compactPrimitive(prim, remap2, dstVertexCount) {
  const document = Document.fromGraph(prim.getGraph());
  if (!remap2 || !dstVertexCount) {
    [remap2, dstVertexCount] = createCompactPlan(prim);
  }
  const srcIndices = prim.getIndices();
  const srcIndicesArray = srcIndices ? srcIndices.getArray() : null;
  const srcIndicesCount = getPrimitiveVertexCount(prim, VertexCountMethod.RENDER);
  const dstIndices = document.createAccessor();
  const dstIndicesCount = srcIndicesCount;
  const dstIndicesArray = createIndicesEmpty(dstIndicesCount, dstVertexCount);
  for (let i = 0; i < dstIndicesCount; i++) {
    dstIndicesArray[i] = remap2[srcIndicesArray ? srcIndicesArray[i] : i];
  }
  prim.setIndices(dstIndices.setArray(dstIndicesArray));
  const srcAttributesPrev = deepListAttributes(prim);
  for (const srcAttribute of prim.listAttributes()) {
    const dstAttribute = shallowCloneAccessor(document, srcAttribute);
    compactAttribute(srcAttribute, srcIndices, remap2, dstAttribute, dstVertexCount);
    prim.swap(srcAttribute, dstAttribute);
  }
  for (const target of prim.listTargets()) {
    for (const srcAttribute of target.listAttributes()) {
      const dstAttribute = shallowCloneAccessor(document, srcAttribute);
      compactAttribute(srcAttribute, srcIndices, remap2, dstAttribute, dstVertexCount);
      target.swap(srcAttribute, dstAttribute);
    }
  }
  if (srcIndices && srcIndices.listParents().length === 1) {
    srcIndices.dispose();
  }
  for (const srcAttribute of srcAttributesPrev) {
    if (srcAttribute.listParents().length === 1) {
      srcAttribute.dispose();
    }
  }
  return prim;
}
function compactAttribute(srcAttribute, srcIndices, remap2, dstAttribute, dstVertexCount) {
  const elementSize = srcAttribute.getElementSize();
  const srcArray = srcAttribute.getArray();
  const srcIndicesArray = srcIndices ? srcIndices.getArray() : null;
  const srcIndicesCount = srcIndices ? srcIndices.getCount() : srcAttribute.getCount();
  const dstArray = new srcArray.constructor(dstVertexCount * elementSize);
  const dstDone = new Uint8Array(dstVertexCount);
  for (let i = 0; i < srcIndicesCount; i++) {
    const srcIndex = srcIndicesArray ? srcIndicesArray[i] : i;
    const dstIndex = remap2[srcIndex];
    if (dstDone[dstIndex]) continue;
    for (let j = 0; j < elementSize; j++) {
      dstArray[dstIndex * elementSize + j] = srcArray[srcIndex * elementSize + j];
    }
    dstDone[dstIndex] = 1;
  }
  return dstAttribute.setArray(dstArray);
}
function createCompactPlan(prim) {
  const srcVertexCount = getPrimitiveVertexCount(prim, VertexCountMethod.UPLOAD);
  const indices = prim.getIndices();
  const indicesArray = indices ? indices.getArray() : null;
  if (!indices || !indicesArray) {
    return [createIndices(srcVertexCount, 1e6), srcVertexCount];
  }
  const remap2 = new Uint32Array(srcVertexCount).fill(EMPTY_U32$1);
  let dstVertexCount = 0;
  for (let i = 0; i < indicesArray.length; i++) {
    const srcIndex = indicesArray[i];
    if (remap2[srcIndex] === EMPTY_U32$1) {
      remap2[srcIndex] = dstVertexCount++;
    }
  }
  return [remap2, dstVertexCount];
}
var NAME$l = "weld";
var WELD_DEFAULTS = {
  overwrite: true,
  cleanup: true
};
function weld(_options = WELD_DEFAULTS) {
  const options = assignDefaults(WELD_DEFAULTS, _options);
  return createTransform(NAME$l, async (doc) => {
    const logger = doc.getLogger();
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        weldPrimitive(prim, options);
        if (getPrimitiveVertexCount(prim, VertexCountMethod.RENDER) === 0) {
          prim.dispose();
        }
      }
      if (mesh.listPrimitives().length === 0) mesh.dispose();
    }
    if (options.cleanup) {
      await doc.transform(prune({
        propertyTypes: [PropertyType.ACCESSOR, PropertyType.NODE],
        keepAttributes: true,
        keepIndices: true,
        keepLeaves: false
      }), dedup({
        propertyTypes: [PropertyType.ACCESSOR]
      }));
    }
    logger.debug(`${NAME$l}: Complete.`);
  });
}
function weldPrimitive(prim, _options = WELD_DEFAULTS) {
  const graph = prim.getGraph();
  const document = Document.fromGraph(graph);
  const logger = document.getLogger();
  const options = _extends({}, WELD_DEFAULTS, _options);
  if (prim.getIndices() && !options.overwrite) return;
  if (prim.getMode() === Primitive.Mode.POINTS) return;
  const srcVertexCount = prim.getAttribute("POSITION").getCount();
  const srcIndices = prim.getIndices();
  const srcIndicesArray = srcIndices == null ? void 0 : srcIndices.getArray();
  const srcIndicesCount = srcIndices ? srcIndices.getCount() : srcVertexCount;
  const stream = new VertexStream(prim);
  const tableSize = ceilPowerOfTwo$1(srcVertexCount + srcVertexCount / 4);
  const table = new Uint32Array(tableSize).fill(EMPTY_U32$1);
  const writeMap = new Uint32Array(srcVertexCount).fill(EMPTY_U32$1);
  let dstVertexCount = 0;
  for (let i = 0; i < srcIndicesCount; i++) {
    const srcIndex = srcIndicesArray ? srcIndicesArray[i] : i;
    if (writeMap[srcIndex] !== EMPTY_U32$1) continue;
    const hashIndex = hashLookup(table, tableSize, stream, srcIndex, EMPTY_U32$1);
    const dstIndex = table[hashIndex];
    if (dstIndex === EMPTY_U32$1) {
      table[hashIndex] = srcIndex;
      writeMap[srcIndex] = dstVertexCount++;
    } else {
      writeMap[srcIndex] = writeMap[dstIndex];
    }
  }
  logger.debug(`${NAME$l}: ${formatDeltaOp(srcVertexCount, dstVertexCount)} vertices.`);
  compactPrimitive(prim, writeMap, dstVertexCount);
}
var {
  FLOAT
} = Accessor.ComponentType;
function transformPrimitive(prim, matrix) {
  const position = prim.getAttribute("POSITION");
  if (position) {
    applyMatrix(matrix, position);
  }
  const normal = prim.getAttribute("NORMAL");
  if (normal) {
    applyNormalMatrix(matrix, normal);
  }
  const tangent = prim.getAttribute("TANGENT");
  if (tangent) {
    applyTangentMatrix(matrix, tangent);
  }
  for (const target of prim.listTargets()) {
    const _position = target.getAttribute("POSITION");
    if (_position) {
      applyMatrix(matrix, _position);
    }
    const _normal = target.getAttribute("NORMAL");
    if (_normal) {
      applyNormalMatrix(matrix, _normal);
    }
    const _tangent = target.getAttribute("TANGENT");
    if (_tangent) {
      applyTangentMatrix(matrix, _tangent);
    }
  }
  if (determinant(matrix) < 0) {
    reversePrimitiveWindingOrder(prim);
  }
}
function applyMatrix(matrix, attribute) {
  const componentType = attribute.getComponentType();
  const normalized = attribute.getNormalized();
  const srcArray = attribute.getArray();
  const dstArray = componentType === FLOAT ? srcArray : new Float32Array(srcArray.length);
  const vector = create$1();
  for (let i = 0, il = attribute.getCount(); i < il; i++) {
    if (normalized) {
      vector[0] = MathUtils.decodeNormalizedInt(srcArray[i * 3], componentType);
      vector[1] = MathUtils.decodeNormalizedInt(srcArray[i * 3 + 1], componentType);
      vector[2] = MathUtils.decodeNormalizedInt(srcArray[i * 3 + 2], componentType);
    } else {
      vector[0] = srcArray[i * 3];
      vector[1] = srcArray[i * 3 + 1];
      vector[2] = srcArray[i * 3 + 2];
    }
    transformMat4(vector, vector, matrix);
    dstArray[i * 3] = vector[0];
    dstArray[i * 3 + 1] = vector[1];
    dstArray[i * 3 + 2] = vector[2];
  }
  attribute.setArray(dstArray).setNormalized(false);
}
function applyNormalMatrix(matrix, attribute) {
  const array = attribute.getArray();
  const normalized = attribute.getNormalized();
  const componentType = attribute.getComponentType();
  const normalMatrix = create$2();
  fromMat4(normalMatrix, matrix);
  invert(normalMatrix, normalMatrix);
  transpose(normalMatrix, normalMatrix);
  const vector = create$1();
  for (let i = 0, il = attribute.getCount(); i < il; i++) {
    if (normalized) {
      vector[0] = MathUtils.decodeNormalizedInt(array[i * 3], componentType);
      vector[1] = MathUtils.decodeNormalizedInt(array[i * 3 + 1], componentType);
      vector[2] = MathUtils.decodeNormalizedInt(array[i * 3 + 2], componentType);
    } else {
      vector[0] = array[i * 3];
      vector[1] = array[i * 3 + 1];
      vector[2] = array[i * 3 + 2];
    }
    transformMat3(vector, vector, normalMatrix);
    normalize(vector, vector);
    if (normalized) {
      array[i * 3] = MathUtils.decodeNormalizedInt(vector[0], componentType);
      array[i * 3 + 1] = MathUtils.decodeNormalizedInt(vector[1], componentType);
      array[i * 3 + 2] = MathUtils.decodeNormalizedInt(vector[2], componentType);
    } else {
      array[i * 3] = vector[0];
      array[i * 3 + 1] = vector[1];
      array[i * 3 + 2] = vector[2];
    }
  }
}
function applyTangentMatrix(matrix, attribute) {
  const array = attribute.getArray();
  const normalized = attribute.getNormalized();
  const componentType = attribute.getComponentType();
  const v3 = create$1();
  for (let i = 0, il = attribute.getCount(); i < il; i++) {
    if (normalized) {
      v3[0] = MathUtils.decodeNormalizedInt(array[i * 4], componentType);
      v3[1] = MathUtils.decodeNormalizedInt(array[i * 4 + 1], componentType);
      v3[2] = MathUtils.decodeNormalizedInt(array[i * 4 + 2], componentType);
    } else {
      v3[0] = array[i * 4];
      v3[1] = array[i * 4 + 1];
      v3[2] = array[i * 4 + 2];
    }
    v3[0] = matrix[0] * v3[0] + matrix[4] * v3[1] + matrix[8] * v3[2];
    v3[1] = matrix[1] * v3[0] + matrix[5] * v3[1] + matrix[9] * v3[2];
    v3[2] = matrix[2] * v3[0] + matrix[6] * v3[1] + matrix[10] * v3[2];
    normalize(v3, v3);
    if (normalized) {
      array[i * 4] = MathUtils.decodeNormalizedInt(v3[0], componentType);
      array[i * 4 + 1] = MathUtils.decodeNormalizedInt(v3[1], componentType);
      array[i * 4 + 2] = MathUtils.decodeNormalizedInt(v3[2], componentType);
    } else {
      array[i * 4] = v3[0];
      array[i * 4 + 1] = v3[1];
      array[i * 4 + 2] = v3[2];
    }
  }
}
function reversePrimitiveWindingOrder(prim) {
  if (prim.getMode() !== Primitive.Mode.TRIANGLES) return;
  if (!prim.getIndices()) weldPrimitive(prim);
  const indices = prim.getIndices();
  for (let i = 0, il = indices.getCount(); i < il; i += 3) {
    const a2 = indices.getScalar(i);
    const c2 = indices.getScalar(i + 2);
    indices.setScalar(i, c2);
    indices.setScalar(i + 2, a2);
  }
}
function transformMesh(mesh, matrix) {
  for (const srcPrim of mesh.listPrimitives()) {
    const dstPrim = shallowClonePrimitive(srcPrim, mesh);
    if (srcPrim !== dstPrim) {
      mesh.removePrimitive(srcPrim).addPrimitive(dstPrim);
    }
  }
  for (const prim of mesh.listPrimitives()) {
    compactPrimitive(prim);
    transformPrimitive(prim, matrix);
  }
}
function shallowClonePrimitive(prim, parentMesh) {
  const isSharedPrimitive = prim.listParents().some((parent) => parent instanceof Mesh && parent !== parentMesh);
  if (isSharedPrimitive) {
    prim = prim.clone();
  }
  for (const target of prim.listTargets()) {
    const isSharedTarget = target.listParents().some((parent) => parent instanceof Primitive && parent !== prim);
    if (isSharedTarget) {
      prim.removeTarget(target).addTarget(target.clone());
    }
  }
  return prim;
}
var IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function clearNodeTransform(node) {
  const mesh = node.getMesh();
  const localMatrix = node.getMatrix();
  if (mesh && !MathUtils.eq(localMatrix, IDENTITY)) {
    transformMesh(mesh, localMatrix);
  }
  for (const child of node.listChildren()) {
    const matrix = child.getMatrix();
    multiply$2(matrix, matrix, localMatrix);
    child.setMatrix(matrix);
  }
  return node.setMatrix(IDENTITY);
}
var {
  LINES: LINES$1,
  LINE_STRIP: LINE_STRIP$2,
  LINE_LOOP: LINE_LOOP$2,
  TRIANGLES: TRIANGLES$1,
  TRIANGLE_STRIP: TRIANGLE_STRIP$2,
  TRIANGLE_FAN: TRIANGLE_FAN$2
} = Primitive.Mode;
function convertPrimitiveToLines(prim) {
  const graph = prim.getGraph();
  const document = Document.fromGraph(graph);
  if (!prim.getIndices()) {
    weldPrimitive(prim);
  }
  const srcIndices = prim.getIndices();
  const srcIndicesArray = srcIndices.getArray();
  const dstGLPrimitiveCount = getGLPrimitiveCount(prim);
  const IndicesArray = ComponentTypeToTypedArray[srcIndices.getComponentType()];
  const dstIndicesArray = new IndicesArray(dstGLPrimitiveCount * 2);
  const srcMode = prim.getMode();
  if (srcMode === LINE_STRIP$2) {
    for (let i = 0; i < dstGLPrimitiveCount; i++) {
      dstIndicesArray[i * 2] = srcIndicesArray[i];
      dstIndicesArray[i * 2 + 1] = srcIndicesArray[i + 1];
    }
  } else if (srcMode === LINE_LOOP$2) {
    for (let i = 0; i < dstGLPrimitiveCount; i++) {
      if (i < dstGLPrimitiveCount - 1) {
        dstIndicesArray[i * 2] = srcIndicesArray[i];
        dstIndicesArray[i * 2 + 1] = srcIndicesArray[i + 1];
      } else {
        dstIndicesArray[i * 2] = srcIndicesArray[i];
        dstIndicesArray[i * 2 + 1] = srcIndicesArray[0];
      }
    }
  } else {
    throw new Error("Only LINE_STRIP and LINE_LOOP may be converted to LINES.");
  }
  prim.setMode(LINES$1);
  const root = document.getRoot();
  if (srcIndices.listParents().some((parent) => parent !== root && parent !== prim)) {
    prim.setIndices(shallowCloneAccessor(document, srcIndices).setArray(dstIndicesArray));
  } else {
    srcIndices.setArray(dstIndicesArray);
  }
}
function convertPrimitiveToTriangles(prim) {
  const graph = prim.getGraph();
  const document = Document.fromGraph(graph);
  if (!prim.getIndices()) {
    weldPrimitive(prim);
  }
  const srcIndices = prim.getIndices();
  const srcIndicesArray = srcIndices.getArray();
  const dstGLPrimitiveCount = getGLPrimitiveCount(prim);
  const IndicesArray = ComponentTypeToTypedArray[srcIndices.getComponentType()];
  const dstIndicesArray = new IndicesArray(dstGLPrimitiveCount * 3);
  const srcMode = prim.getMode();
  if (srcMode === TRIANGLE_STRIP$2) {
    for (let i = 0, il = srcIndicesArray.length; i < il - 2; i++) {
      if (i % 2) {
        dstIndicesArray[i * 3] = srcIndicesArray[i + 1];
        dstIndicesArray[i * 3 + 1] = srcIndicesArray[i];
        dstIndicesArray[i * 3 + 2] = srcIndicesArray[i + 2];
      } else {
        dstIndicesArray[i * 3] = srcIndicesArray[i];
        dstIndicesArray[i * 3 + 1] = srcIndicesArray[i + 1];
        dstIndicesArray[i * 3 + 2] = srcIndicesArray[i + 2];
      }
    }
  } else if (srcMode === TRIANGLE_FAN$2) {
    for (let i = 0; i < dstGLPrimitiveCount; i++) {
      dstIndicesArray[i * 3] = srcIndicesArray[0];
      dstIndicesArray[i * 3 + 1] = srcIndicesArray[i + 1];
      dstIndicesArray[i * 3 + 2] = srcIndicesArray[i + 2];
    }
  } else {
    throw new Error("Only TRIANGLE_STRIP and TRIANGLE_FAN may be converted to TRIANGLES.");
  }
  prim.setMode(TRIANGLES$1);
  const root = document.getRoot();
  if (srcIndices.listParents().some((parent) => parent !== root && parent !== prim)) {
    prim.setIndices(shallowCloneAccessor(document, srcIndices).setArray(dstIndicesArray));
  } else {
    srcIndices.setArray(dstIndicesArray);
  }
}
var NAME$k = "dequantize";
var DEQUANTIZE_DEFAULTS = {
  pattern: /^((?!JOINTS_).)*$/
};
function dequantize(_options = DEQUANTIZE_DEFAULTS) {
  const options = assignDefaults(DEQUANTIZE_DEFAULTS, _options);
  return createTransform(NAME$k, (doc) => {
    const logger = doc.getLogger();
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        dequantizePrimitive(prim, options);
      }
    }
    doc.createExtension(KHRMeshQuantization).dispose();
    logger.debug(`${NAME$k}: Complete.`);
  });
}
function dequantizePrimitive(prim, _options = DEQUANTIZE_DEFAULTS) {
  const options = assignDefaults(DEQUANTIZE_DEFAULTS, _options);
  for (const semantic of prim.listSemantics()) {
    if (options.pattern.test(semantic)) {
      dequantizeAttribute(prim.getAttribute(semantic));
    }
  }
  for (const target of prim.listTargets()) {
    for (const semantic of target.listSemantics()) {
      if (options.pattern.test(semantic)) {
        dequantizeAttribute(target.getAttribute(semantic));
      }
    }
  }
}
function dequantizeAttribute(attribute) {
  const srcArray = attribute.getArray();
  if (!srcArray) return;
  const dstArray = dequantizeAttributeArray(srcArray, attribute.getComponentType(), attribute.getNormalized());
  attribute.setArray(dstArray).setNormalized(false);
}
function dequantizeAttributeArray(srcArray, componentType, normalized) {
  const dstArray = new Float32Array(srcArray.length);
  for (let i = 0, il = srcArray.length; i < il; i++) {
    if (normalized) {
      dstArray[i] = MathUtils.decodeNormalizedInt(srcArray[i], componentType);
    } else {
      dstArray[i] = srcArray[i];
    }
  }
  return dstArray;
}
var {
  TEXTURE_INFO,
  ROOT: ROOT$1
} = PropertyType;
var NO_TRANSFER_TYPES = /* @__PURE__ */ new Set([TEXTURE_INFO, ROOT$1]);
function cloneDocument(source) {
  const target = new Document().setLogger(source.getLogger());
  const resolve = createDefaultPropertyResolver(target, source);
  mergeDocuments(target, source, resolve);
  target.getRoot().copy(source.getRoot(), resolve);
  return target;
}
function mergeDocuments(target, source, resolve) {
  resolve || (resolve = createDefaultPropertyResolver(target, source));
  for (const sourceExtension of source.getRoot().listExtensionsUsed()) {
    const targetExtension = target.createExtension(sourceExtension.constructor);
    if (sourceExtension.isRequired()) targetExtension.setRequired(true);
  }
  return _copyToDocument(target, source, listNonRootProperties(source), resolve);
}
function moveToDocument(target, source, sourceProperties, resolve) {
  const targetProperties = copyToDocument(target, source, sourceProperties, resolve);
  for (const property of sourceProperties) {
    property.dispose();
  }
  return targetProperties;
}
function copyToDocument(target, source, sourceProperties, resolve) {
  const sourcePropertyDependencies = /* @__PURE__ */ new Set();
  for (const property of sourceProperties) {
    if (NO_TRANSFER_TYPES.has(property.propertyType)) {
      throw new Error(`Type "${property.propertyType}" cannot be transferred.`);
    }
    listPropertyDependencies(property, sourcePropertyDependencies);
  }
  return _copyToDocument(target, source, Array.from(sourcePropertyDependencies), resolve);
}
function _copyToDocument(target, source, sourceProperties, resolve) {
  resolve || (resolve = createDefaultPropertyResolver(target, source));
  const propertyMap = /* @__PURE__ */ new Map();
  for (const sourceProp of sourceProperties) {
    if (!propertyMap.has(sourceProp) && sourceProp.propertyType !== TEXTURE_INFO) {
      propertyMap.set(sourceProp, resolve(sourceProp));
    }
  }
  for (const [sourceProp, targetProp] of propertyMap.entries()) {
    targetProp.copy(sourceProp, resolve);
  }
  return propertyMap;
}
function createDefaultPropertyResolver(target, source) {
  const propertyMap = /* @__PURE__ */ new Map([[source.getRoot(), target.getRoot()]]);
  return (sourceProp) => {
    if (sourceProp.propertyType === TEXTURE_INFO) return sourceProp;
    let targetProp = propertyMap.get(sourceProp);
    if (!targetProp) {
      const PropertyClass = sourceProp.constructor;
      targetProp = new PropertyClass(target.getGraph());
      propertyMap.set(sourceProp, targetProp);
    }
    return targetProp;
  };
}
function listPropertyDependencies(parent, visited) {
  const graph = parent.getGraph();
  const queue = [parent];
  let next = void 0;
  while (next = queue.pop()) {
    visited.add(next);
    for (const child of graph.listChildren(next)) {
      if (!visited.has(child)) {
        queue.push(child);
      }
    }
  }
  return visited;
}
function listNonRootProperties(document) {
  const visited = /* @__PURE__ */ new Set();
  for (const edge of document.getGraph().listEdges()) {
    visited.add(edge.getChild());
  }
  return Array.from(visited);
}
var NAME$j = "draco";
var DRACO_DEFAULTS = {
  method: "edgebreaker",
  encodeSpeed: 5,
  decodeSpeed: 5,
  quantizePosition: 14,
  quantizeNormal: 10,
  quantizeColor: 8,
  quantizeTexcoord: 12,
  quantizeGeneric: 12,
  quantizationVolume: "mesh"
};
function draco(_options = DRACO_DEFAULTS) {
  const options = assignDefaults(DRACO_DEFAULTS, _options);
  return createTransform(NAME$j, async (document) => {
    await document.transform(weld());
    document.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
      method: options.method === "edgebreaker" ? KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER : KHRDracoMeshCompression.EncoderMethod.SEQUENTIAL,
      encodeSpeed: options.encodeSpeed,
      decodeSpeed: options.decodeSpeed,
      quantizationBits: {
        POSITION: options.quantizePosition,
        NORMAL: options.quantizeNormal,
        COLOR: options.quantizeColor,
        TEX_COORD: options.quantizeTexcoord,
        GENERIC: options.quantizeGeneric
      },
      quantizationVolume: options.quantizationVolume
    });
  });
}
var NAME$i = "flatten";
var FLATTEN_DEFAULTS = {
  cleanup: true
};
function flatten(_options = FLATTEN_DEFAULTS) {
  const options = assignDefaults(FLATTEN_DEFAULTS, _options);
  return createTransform(NAME$i, async (document) => {
    const root = document.getRoot();
    const logger = document.getLogger();
    const joints = /* @__PURE__ */ new Set();
    for (const skin of root.listSkins()) {
      for (const joint of skin.listJoints()) {
        joints.add(joint);
      }
    }
    const animated = /* @__PURE__ */ new Set();
    for (const animation of root.listAnimations()) {
      for (const channel of animation.listChannels()) {
        const node = channel.getTargetNode();
        if (node && channel.getTargetPath() !== "weights") {
          animated.add(node);
        }
      }
    }
    const hasJointParent = /* @__PURE__ */ new Set();
    const hasAnimatedParent = /* @__PURE__ */ new Set();
    for (const scene of root.listScenes()) {
      scene.traverse((node) => {
        const parent = node.getParentNode();
        if (!parent) return;
        if (joints.has(parent) || hasJointParent.has(parent)) {
          hasJointParent.add(node);
        }
        if (animated.has(parent) || hasAnimatedParent.has(parent)) {
          hasAnimatedParent.add(node);
        }
      });
    }
    for (const scene of root.listScenes()) {
      scene.traverse((node) => {
        if (animated.has(node)) return;
        if (hasJointParent.has(node)) return;
        if (hasAnimatedParent.has(node)) return;
        clearNodeParent(node);
      });
    }
    if (animated.size) {
      logger.debug(`${NAME$i}: Flattening node hierarchies with TRS animation not yet supported.`);
    }
    if (options.cleanup) {
      await document.transform(prune({
        propertyTypes: [PropertyType.NODE],
        keepLeaves: false
      }));
    }
    logger.debug(`${NAME$i}: Complete.`);
  });
}
function getBounds(node) {
  return getBounds$1(node);
}
function inspect(doc) {
  return {
    scenes: listScenes(doc),
    meshes: listMeshes(doc),
    materials: listMaterials(doc),
    textures: listTextures(doc),
    animations: listAnimations(doc)
  };
}
function listScenes(doc) {
  const scenes = doc.getRoot().listScenes().map((scene) => {
    const root = scene.listChildren()[0];
    const sceneBounds = getBounds$1(scene);
    return {
      name: scene.getName(),
      rootName: root ? root.getName() : "",
      bboxMin: toPrecision(sceneBounds.min),
      bboxMax: toPrecision(sceneBounds.max),
      renderVertexCount: getSceneVertexCount(scene, VertexCountMethod.RENDER),
      uploadVertexCount: getSceneVertexCount(scene, VertexCountMethod.UPLOAD),
      uploadNaiveVertexCount: getSceneVertexCount(scene, VertexCountMethod.UPLOAD_NAIVE)
    };
  });
  return {
    properties: scenes
  };
}
function listMeshes(doc) {
  const meshes = doc.getRoot().listMeshes().map((mesh) => {
    const instances = mesh.listParents().filter((parent) => parent.propertyType !== PropertyType.ROOT).length;
    let glPrimitives = 0;
    const semantics = /* @__PURE__ */ new Set();
    const meshIndices = /* @__PURE__ */ new Set();
    const meshAccessors = /* @__PURE__ */ new Set();
    mesh.listPrimitives().forEach((prim) => {
      for (const semantic of prim.listSemantics()) {
        const attr = prim.getAttribute(semantic);
        semantics.add(semantic + ":" + accessorToTypeLabel(attr));
        meshAccessors.add(attr);
      }
      for (const targ of prim.listTargets()) {
        targ.listAttributes().forEach((attr) => meshAccessors.add(attr));
      }
      const indices = prim.getIndices();
      if (indices) {
        meshIndices.add(accessorToTypeLabel(indices));
        meshAccessors.add(indices);
      }
      glPrimitives += getGLPrimitiveCount(prim);
    });
    let size = 0;
    Array.from(meshAccessors).forEach((a2) => size += a2.getArray().byteLength);
    const modes = mesh.listPrimitives().map((prim) => MeshPrimitiveModeLabels[prim.getMode()]);
    return {
      name: mesh.getName(),
      mode: Array.from(new Set(modes)),
      meshPrimitives: mesh.listPrimitives().length,
      glPrimitives,
      vertices: getMeshVertexCount(mesh, VertexCountMethod.UPLOAD),
      indices: Array.from(meshIndices).sort(),
      attributes: Array.from(semantics).sort(),
      instances,
      size
    };
  });
  return {
    properties: meshes
  };
}
function listMaterials(doc) {
  const materials = doc.getRoot().listMaterials().map((material) => {
    const instances = material.listParents().filter((parent) => parent.propertyType !== PropertyType.ROOT).length;
    const extensions = new Set(material.listExtensions());
    const slots = doc.getGraph().listEdges().filter((ref) => {
      const child = ref.getChild();
      const parent = ref.getParent();
      if (child instanceof Texture && parent === material) {
        return true;
      }
      if (child instanceof Texture && parent instanceof ExtensionProperty && extensions.has(parent)) {
        return true;
      }
      return false;
    }).map((ref) => ref.getName());
    return {
      name: material.getName(),
      instances,
      textures: slots,
      alphaMode: material.getAlphaMode(),
      doubleSided: material.getDoubleSided()
    };
  });
  return {
    properties: materials
  };
}
function listTextures(doc) {
  const textures = doc.getRoot().listTextures().map((texture) => {
    const instances = texture.listParents().filter((parent) => parent.propertyType !== PropertyType.ROOT).length;
    const slots = doc.getGraph().listParentEdges(texture).filter((edge) => edge.getParent().propertyType !== PropertyType.ROOT).map((edge) => edge.getName());
    const resolution = ImageUtils.getSize(texture.getImage(), texture.getMimeType());
    let compression = "";
    if (texture.getMimeType() === "image/ktx2") {
      const container = read(texture.getImage());
      const dfd = container.dataFormatDescriptor[0];
      if (dfd.colorModel === KHR_DF_MODEL_ETC1S) {
        compression = "ETC1S";
      } else if (dfd.colorModel === KHR_DF_MODEL_UASTC) {
        compression = "UASTC";
      }
    }
    return {
      name: texture.getName(),
      uri: texture.getURI(),
      slots: Array.from(new Set(slots)),
      instances,
      mimeType: texture.getMimeType(),
      compression,
      resolution: resolution ? resolution.join("x") : "",
      size: texture.getImage().byteLength,
      gpuSize: ImageUtils.getVRAMByteLength(texture.getImage(), texture.getMimeType())
    };
  });
  return {
    properties: textures
  };
}
function listAnimations(doc) {
  const animations = doc.getRoot().listAnimations().map((anim) => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    anim.listSamplers().forEach((sampler) => {
      const input = sampler.getInput();
      if (!input) return;
      minTime = Math.min(minTime, input.getMin([])[0]);
      maxTime = Math.max(maxTime, input.getMax([])[0]);
    });
    let size = 0;
    let keyframes = 0;
    const accessors = /* @__PURE__ */ new Set();
    anim.listSamplers().forEach((sampler) => {
      const input = sampler.getInput();
      const output = sampler.getOutput();
      if (!input) return;
      keyframes += input.getCount();
      accessors.add(input);
      if (!output) return;
      accessors.add(output);
    });
    Array.from(accessors).forEach((accessor) => {
      size += accessor.getArray().byteLength;
    });
    return {
      name: anim.getName(),
      channels: anim.listChannels().length,
      samplers: anim.listSamplers().length,
      duration: Math.round((maxTime - minTime) * 1e3) / 1e3,
      keyframes,
      size
    };
  });
  return {
    properties: animations
  };
}
var MeshPrimitiveModeLabels = ["POINTS", "LINES", "LINE_LOOP", "LINE_STRIP", "TRIANGLES", "TRIANGLE_STRIP", "TRIANGLE_FAN"];
var NumericTypeLabels = {
  Float32Array: "f32",
  Uint32Array: "u32",
  Uint16Array: "u16",
  Uint8Array: "u8",
  Int32Array: "i32",
  Int16Array: "i16",
  Int8Array: "i8"
};
function toPrecision(v) {
  for (let i = 0; i < v.length; i++) {
    if (v[i].toFixed) v[i] = Number(v[i].toFixed(5));
  }
  return v;
}
function accessorToTypeLabel(accessor) {
  const array = accessor.getArray();
  const base = NumericTypeLabels[array.constructor.name] || "?";
  const suffix = accessor.getNormalized() ? "_norm" : "";
  return base + suffix;
}
var NAME$h = "instance";
var INSTANCE_DEFAULTS = {
  min: 5
};
function instance(_options = INSTANCE_DEFAULTS) {
  const options = assignDefaults(INSTANCE_DEFAULTS, _options);
  return createTransform(NAME$h, (doc) => {
    const logger = doc.getLogger();
    const root = doc.getRoot();
    if (root.listAnimations().length) {
      logger.warn(`${NAME$h}: Instancing is not currently supported for animated models.`);
      logger.debug(`${NAME$h}: Complete.`);
      return;
    }
    const batchExtension = doc.createExtension(EXTMeshGPUInstancing);
    let numBatches = 0;
    let numInstances = 0;
    for (const scene of root.listScenes()) {
      const meshInstances = /* @__PURE__ */ new Map();
      scene.traverse((node) => {
        const mesh = node.getMesh();
        if (!mesh) return;
        meshInstances.set(mesh, (meshInstances.get(mesh) || /* @__PURE__ */ new Set()).add(node));
      });
      const modifiedNodes = [];
      for (const mesh of Array.from(meshInstances.keys())) {
        const nodes = Array.from(meshInstances.get(mesh));
        if (nodes.length < options.min) continue;
        if (nodes.some((node) => node.getSkin())) continue;
        if (mesh.listPrimitives().some(hasVolume) && nodes.some(hasScale)) continue;
        const batch = createBatch(doc, batchExtension, mesh, nodes.length);
        const batchTranslation = batch.getAttribute("TRANSLATION");
        const batchRotation = batch.getAttribute("ROTATION");
        const batchScale = batch.getAttribute("SCALE");
        const batchNode = doc.createNode().setMesh(mesh).setExtension("EXT_mesh_gpu_instancing", batch);
        scene.addChild(batchNode);
        let needsTranslation = false;
        let needsRotation = false;
        let needsScale = false;
        for (let i = 0; i < nodes.length; i++) {
          let t2, r2, s2;
          const node = nodes[i];
          batchTranslation.setElement(i, t2 = node.getWorldTranslation());
          batchRotation.setElement(i, r2 = node.getWorldRotation());
          batchScale.setElement(i, s2 = node.getWorldScale());
          if (!MathUtils.eq(t2, [0, 0, 0])) needsTranslation = true;
          if (!MathUtils.eq(r2, [0, 0, 0, 1])) needsRotation = true;
          if (!MathUtils.eq(s2, [1, 1, 1])) needsScale = true;
        }
        if (!needsTranslation) batchTranslation.dispose();
        if (!needsRotation) batchRotation.dispose();
        if (!needsScale) batchScale.dispose();
        if (!needsTranslation && !needsRotation && !needsScale) {
          batchNode.dispose();
          batch.dispose();
          continue;
        }
        for (const node of nodes) {
          node.setMesh(null);
          modifiedNodes.push(node);
        }
        numBatches++;
        numInstances += nodes.length;
      }
      pruneUnusedNodes(modifiedNodes, logger);
    }
    if (numBatches > 0) {
      logger.info(`${NAME$h}: Created ${numBatches} batches, with ${numInstances} total instances.`);
    } else {
      logger.info(`${NAME$h}: No meshes with >=${options.min} parent nodes were found.`);
    }
    if (batchExtension.listProperties().length === 0) {
      batchExtension.dispose();
    }
    logger.debug(`${NAME$h}: Complete.`);
  });
}
function pruneUnusedNodes(nodes, logger) {
  let node;
  let unusedNodes = 0;
  while (node = nodes.pop()) {
    if (node.listChildren().length || node.getCamera() || node.getMesh() || node.getSkin() || node.listExtensions().length) {
      continue;
    }
    const nodeParent = node.getParentNode();
    if (nodeParent) nodes.push(nodeParent);
    node.dispose();
    unusedNodes++;
  }
  logger.debug(`${NAME$h}: Removed ${unusedNodes} unused nodes.`);
}
function hasVolume(prim) {
  const material = prim.getMaterial();
  return !!(material && material.getExtension("KHR_materials_volume"));
}
function hasScale(node) {
  const scale2 = node.getWorldScale();
  return !MathUtils.eq(scale2, [1, 1, 1]);
}
function createBatch(doc, batchExtension, mesh, count) {
  const buffer = mesh.listPrimitives()[0].getAttribute("POSITION").getBuffer();
  const batchTranslation = doc.createAccessor().setType("VEC3").setArray(new Float32Array(3 * count)).setBuffer(buffer);
  const batchRotation = doc.createAccessor().setType("VEC4").setArray(new Float32Array(4 * count)).setBuffer(buffer);
  const batchScale = doc.createAccessor().setType("VEC3").setArray(new Float32Array(3 * count)).setBuffer(buffer);
  return batchExtension.createInstancedMesh().setAttribute("TRANSLATION", batchTranslation).setAttribute("ROTATION", batchRotation).setAttribute("SCALE", batchScale);
}
var JOIN_PRIMITIVE_DEFAULTS = {
  skipValidation: false
};
var EMPTY_U32 = 2 ** 32 - 1;
var {
  LINE_STRIP: LINE_STRIP$1,
  LINE_LOOP: LINE_LOOP$1,
  TRIANGLE_STRIP: TRIANGLE_STRIP$1,
  TRIANGLE_FAN: TRIANGLE_FAN$1
} = Primitive.Mode;
function joinPrimitives(prims, _options = {}) {
  const options = assignDefaults(JOIN_PRIMITIVE_DEFAULTS, _options);
  const templatePrim = prims[0];
  const document = Document.fromGraph(templatePrim.getGraph());
  if (!options.skipValidation && new Set(prims.map(createPrimGroupKey)).size > 1) {
    throw new Error("Requires >=2 Primitives, sharing the same Material and Mode, with compatible vertex attributes and indices.");
  }
  for (const prim of prims) {
    switch (prim.getMode()) {
      case LINE_STRIP$1:
      case LINE_LOOP$1:
        convertPrimitiveToLines(prim);
        break;
      case TRIANGLE_STRIP$1:
      case TRIANGLE_FAN$1:
        convertPrimitiveToTriangles(prim);
        break;
    }
  }
  const primRemaps = [];
  const primVertexCounts = new Uint32Array(prims.length);
  let dstVertexCount = 0;
  let dstIndicesCount = 0;
  for (let primIndex = 0; primIndex < prims.length; primIndex++) {
    const srcPrim = prims[primIndex];
    const srcIndices = srcPrim.getIndices();
    const srcVertexCount = srcPrim.getAttribute("POSITION").getCount();
    const srcIndicesArray = srcIndices ? srcIndices.getArray() : null;
    const srcIndicesCount = srcIndices ? srcIndices.getCount() : srcVertexCount;
    const remap2 = new Uint32Array(srcVertexCount).fill(EMPTY_U32);
    for (let i = 0; i < srcIndicesCount; i++) {
      const index = srcIndicesArray ? srcIndicesArray[i] : i;
      if (remap2[index] === EMPTY_U32) {
        remap2[index] = dstVertexCount++;
        primVertexCounts[primIndex]++;
      }
    }
    primRemaps.push(remap2);
    dstIndicesCount += srcIndicesCount;
  }
  const dstPrim = document.createPrimitive().setMode(templatePrim.getMode()).setMaterial(templatePrim.getMaterial());
  for (const semantic of templatePrim.listSemantics()) {
    const tplAttribute = templatePrim.getAttribute(semantic);
    const AttributeArray = ComponentTypeToTypedArray[tplAttribute.getComponentType()];
    const dstAttribute = shallowCloneAccessor(document, tplAttribute).setArray(new AttributeArray(dstVertexCount * tplAttribute.getElementSize()));
    dstPrim.setAttribute(semantic, dstAttribute);
  }
  const tplIndices = templatePrim.getIndices();
  const dstIndices = tplIndices ? shallowCloneAccessor(document, tplIndices).setArray(createIndicesEmpty(dstIndicesCount, dstVertexCount)) : null;
  dstPrim.setIndices(dstIndices);
  let dstIndicesOffset = 0;
  for (let primIndex = 0; primIndex < primRemaps.length; primIndex++) {
    const srcPrim = prims[primIndex];
    const srcIndices = srcPrim.getIndices();
    const srcIndicesCount = srcIndices ? srcIndices.getCount() : -1;
    const remap2 = primRemaps[primIndex];
    if (srcIndices && dstIndices) {
      remapIndices(srcIndices, remap2, dstIndices, dstIndicesOffset);
      dstIndicesOffset += srcIndicesCount;
    }
    for (const semantic of dstPrim.listSemantics()) {
      const srcAttribute = srcPrim.getAttribute(semantic);
      const dstAttribute = dstPrim.getAttribute(semantic);
      remapAttribute(srcAttribute, srcIndices, remap2, dstAttribute);
    }
  }
  return dstPrim;
}
function remapAttribute(srcAttribute, srcIndices, remap2, dstAttribute) {
  const elementSize = srcAttribute.getElementSize();
  const srcIndicesArray = srcIndices ? srcIndices.getArray() : null;
  const srcVertexCount = srcAttribute.getCount();
  const srcArray = srcAttribute.getArray();
  const dstArray = dstAttribute.getArray();
  const done = new Uint8Array(srcAttribute.getCount());
  for (let i = 0, il = srcIndices ? srcIndices.getCount() : srcVertexCount; i < il; i++) {
    const srcIndex = srcIndicesArray ? srcIndicesArray[i] : i;
    const dstIndex = remap2[srcIndex];
    if (done[dstIndex]) continue;
    for (let j = 0; j < elementSize; j++) {
      dstArray[dstIndex * elementSize + j] = srcArray[srcIndex * elementSize + j];
    }
    done[dstIndex] = 1;
  }
}
function remapIndices(srcIndices, remap2, dstIndices, dstOffset) {
  const srcCount = srcIndices.getCount();
  const srcArray = srcIndices.getArray();
  const dstArray = dstIndices.getArray();
  for (let i = 0; i < srcCount; i++) {
    const srcIndex = srcArray[i];
    const dstIndex = remap2[srcIndex];
    dstArray[dstOffset + i] = dstIndex;
  }
}
var NAME$g = "join";
var {
  ROOT,
  NODE,
  MESH,
  PRIMITIVE,
  ACCESSOR
} = PropertyType;
var _matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var JOIN_DEFAULTS = {
  keepMeshes: false,
  keepNamed: false,
  cleanup: true
};
function join(_options = JOIN_DEFAULTS) {
  const options = assignDefaults(JOIN_DEFAULTS, _options);
  return createTransform(NAME$g, async (document) => {
    const root = document.getRoot();
    const logger = document.getLogger();
    for (const scene of root.listScenes()) {
      _joinLevel(document, scene, options);
      scene.traverse((node) => _joinLevel(document, node, options));
    }
    if (options.cleanup) {
      await document.transform(prune({
        propertyTypes: [NODE, MESH, PRIMITIVE, ACCESSOR],
        keepAttributes: true,
        keepIndices: true,
        keepLeaves: false
      }));
    }
    logger.debug(`${NAME$g}: Complete.`);
  });
}
function _joinLevel(document, parent, options) {
  const logger = document.getLogger();
  const groups = {};
  const children = parent.listChildren();
  for (let nodeIndex = 0; nodeIndex < children.length; nodeIndex++) {
    const node = children[nodeIndex];
    const isAnimated = node.listParents().some((p) => p instanceof AnimationChannel);
    if (isAnimated) continue;
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (node.getExtension("EXT_mesh_gpu_instancing")) continue;
    if (node.getSkin()) continue;
    for (const prim of mesh.listPrimitives()) {
      if (prim.listTargets().length > 0) continue;
      const material = prim.getMaterial();
      if (material && material.getExtension("KHR_materials_volume")) continue;
      compactPrimitive(prim);
      dequantizeTransformableAttributes(prim);
      let key = createPrimGroupKey(prim);
      const isNamed = mesh.getName() || node.getName();
      if (options.keepMeshes || options.keepNamed && isNamed) {
        key += `|${nodeIndex}`;
      }
      if (!(key in groups)) {
        groups[key] = {
          prims: [],
          primMeshes: [],
          primNodes: [],
          dstNode: node,
          dstMesh: void 0
        };
      }
      const group = groups[key];
      group.prims.push(prim);
      group.primNodes.push(node);
    }
  }
  const joinGroups = Object.values(groups).filter(({
    prims
  }) => prims.length > 1);
  const srcNodes = new Set(joinGroups.flatMap((group) => group.primNodes));
  for (const node of srcNodes) {
    const mesh = node.getMesh();
    const isSharedMesh = mesh.listParents().some((parent2) => {
      return parent2.propertyType !== ROOT && node !== parent2;
    });
    if (isSharedMesh) {
      node.setMesh(mesh.clone());
    }
  }
  for (const group of joinGroups) {
    const {
      dstNode,
      primNodes
    } = group;
    group.dstMesh = dstNode.getMesh();
    group.primMeshes = primNodes.map((node) => node.getMesh());
  }
  for (const group of joinGroups) {
    const {
      prims,
      primNodes,
      primMeshes,
      dstNode,
      dstMesh
    } = group;
    const dstMatrix = dstNode.getMatrix();
    for (let i = 0; i < prims.length; i++) {
      const primNode = primNodes[i];
      const primMesh = primMeshes[i];
      let prim = prims[i];
      primMesh.removePrimitive(prim);
      if (isUsed(prim)) {
        prim = prims[i] = _deepClonePrimitive(prims[i]);
      }
      if (primNode !== dstNode) {
        multiply$2(_matrix, invert$1(_matrix, dstMatrix), primNode.getMatrix());
        transformPrimitive(prim, _matrix);
      }
    }
    const dstPrim = joinPrimitives(prims);
    const dstVertexCount = dstPrim.listAttributes()[0].getCount();
    dstMesh.addPrimitive(dstPrim);
    logger.debug(`${NAME$g}: Joined Primitives (${prims.length}) containing ${formatLong(dstVertexCount)} vertices under Node "${dstNode.getName()}".`);
  }
}
function _deepClonePrimitive(src) {
  const dst = src.clone();
  for (const semantic of dst.listSemantics()) {
    dst.setAttribute(semantic, dst.getAttribute(semantic).clone());
  }
  const indices = dst.getIndices();
  if (indices) dst.setIndices(indices.clone());
  return dst;
}
function dequantizeTransformableAttributes(prim) {
  for (const semantic of ["POSITION", "NORMAL", "TANGENT"]) {
    const attribute = prim.getAttribute(semantic);
    if (attribute) dequantizeAttribute(attribute);
  }
}
function listTextureChannels(texture) {
  const mask = getTextureChannelMask(texture);
  const channels = [];
  if (mask & TextureChannel.R) channels.push(TextureChannel.R);
  if (mask & TextureChannel.G) channels.push(TextureChannel.G);
  if (mask & TextureChannel.B) channels.push(TextureChannel.B);
  if (mask & TextureChannel.A) channels.push(TextureChannel.A);
  return channels;
}
function getTextureChannelMask(texture) {
  const document = Document.fromGraph(texture.getGraph());
  let mask = 0;
  for (const edge of document.getGraph().listParentEdges(texture)) {
    const parent = edge.getParent();
    let {
      channels
    } = edge.getAttributes();
    if (channels && edge.getName() === "baseColorTexture" && parent instanceof Material && parent.getAlphaMode() === Material.AlphaMode.OPAQUE) {
      channels &= ~TextureChannel.A;
    }
    if (channels) {
      mask |= channels;
      continue;
    }
    if (parent.propertyType !== PropertyType.ROOT) {
      document.getLogger().warn(`Missing attribute ".channels" on edge, "${edge.getName()}".`);
    }
  }
  return mask;
}
var NAME$f = "reorder";
var REORDER_DEFAULTS = {
  target: "size",
  cleanup: true
};
function reorder(_options) {
  const options = assignDefaults(REORDER_DEFAULTS, _options);
  const encoder = options.encoder;
  if (!encoder) {
    throw new Error(`${NAME$f}: encoder dependency required \u2014 install "meshoptimizer".`);
  }
  return createTransform(NAME$f, async (document) => {
    const logger = document.getLogger();
    await encoder.ready;
    const plan = createLayoutPlan(document);
    for (const srcIndices of plan.indicesToAttributes.keys()) {
      let indicesArray = srcIndices.getArray();
      if (!(indicesArray instanceof Uint32Array)) {
        indicesArray = new Uint32Array(indicesArray);
      } else {
        indicesArray = indicesArray.slice();
      }
      const [remap2, unique] = encoder.reorderMesh(indicesArray, plan.indicesToMode.get(srcIndices) === Primitive.Mode.TRIANGLES, options.target === "size");
      const dstIndices = shallowCloneAccessor(document, srcIndices);
      dstIndices.setArray(unique <= 65534 ? new Uint16Array(indicesArray) : indicesArray);
      for (const srcAttribute of plan.indicesToAttributes.get(srcIndices)) {
        const dstAttribute = shallowCloneAccessor(document, srcAttribute);
        compactAttribute(srcAttribute, srcIndices, remap2, dstAttribute, unique);
        for (const prim of plan.indicesToPrimitives.get(srcIndices)) {
          if (prim.getIndices() === srcIndices) {
            prim.swap(srcIndices, dstIndices);
          }
          prim.swap(srcAttribute, dstAttribute);
          for (const target of prim.listTargets()) {
            target.swap(srcAttribute, dstAttribute);
          }
        }
      }
    }
    if (options.cleanup) {
      await document.transform(prune({
        propertyTypes: [PropertyType.ACCESSOR],
        keepAttributes: true,
        keepIndices: true
      }));
    }
    if (!plan.indicesToAttributes.size) {
      logger.warn(`${NAME$f}: No qualifying primitives found; may need to weld first.`);
    } else {
      logger.debug(`${NAME$f}: Complete.`);
    }
  });
}
function createLayoutPlan(document) {
  const indicesToMode = /* @__PURE__ */ new Map();
  const indicesToPrimitives = new SetMap();
  const indicesToAttributes = new SetMap();
  const attributesToPrimitives = new SetMap();
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (!indices) continue;
      indicesToMode.set(indices, prim.getMode());
      indicesToPrimitives.add(indices, prim);
      for (const attribute of deepListAttributes(prim)) {
        indicesToAttributes.add(indices, attribute);
        attributesToPrimitives.add(attribute, prim);
      }
    }
  }
  return {
    indicesToPrimitives,
    indicesToAttributes,
    indicesToMode,
    attributesToPrimitives
  };
}
function sortPrimitiveWeights(prim, limit = Infinity) {
  if (Number.isFinite(limit) && limit % 4 || limit <= 0) {
    throw new Error(`Limit must be positive multiple of four.`);
  }
  const vertexCount = prim.getAttribute("POSITION").getCount();
  const setCount = prim.listSemantics().filter((name) => name.startsWith("WEIGHTS_")).length;
  const indices = new Uint16Array(setCount * 4);
  const srcWeights = new Float32Array(setCount * 4);
  const dstWeights = new Float32Array(setCount * 4);
  const srcJoints = new Uint32Array(setCount * 4);
  const dstJoints = new Uint32Array(setCount * 4);
  for (let i = 0; i < vertexCount; i++) {
    getVertexArray(prim, i, "WEIGHTS", srcWeights);
    getVertexArray(prim, i, "JOINTS", srcJoints);
    for (let j = 0; j < setCount * 4; j++) indices[j] = j;
    indices.sort((a2, b) => srcWeights[a2] > srcWeights[b] ? -1 : 1);
    for (let j = 0; j < indices.length; j++) {
      dstWeights[j] = srcWeights[indices[j]];
      dstJoints[j] = srcJoints[indices[j]];
    }
    setVertexArray(prim, i, "WEIGHTS", dstWeights);
    setVertexArray(prim, i, "JOINTS", dstJoints);
  }
  for (let i = setCount; i * 4 > limit; i--) {
    const weights = prim.getAttribute(`WEIGHTS_${i - 1}`);
    const joints = prim.getAttribute(`JOINTS_${i - 1}`);
    prim.setAttribute(`WEIGHTS_${i - 1}`, null);
    prim.setAttribute(`JOINTS_${i - 1}`, null);
    if (weights.listParents().length === 1) weights.dispose();
    if (joints.listParents().length === 1) joints.dispose();
  }
  normalizePrimitiveWeights(prim);
}
function normalizePrimitiveWeights(prim) {
  if (!isNormalizeSafe(prim)) return;
  const vertexCount = prim.getAttribute("POSITION").getCount();
  const setCount = prim.listSemantics().filter((name) => name.startsWith("WEIGHTS_")).length;
  const templateAttribute = prim.getAttribute("WEIGHTS_0");
  const templateArray = templateAttribute.getArray();
  const componentType = templateAttribute.getComponentType();
  const normalized = templateAttribute.getNormalized();
  const normalizedComponentType = normalized ? componentType : void 0;
  const delta = normalized ? MathUtils.decodeNormalizedInt(1, componentType) : Number.EPSILON;
  const joints = new Uint32Array(setCount * 4).fill(0);
  const weights = templateArray.slice(0, setCount * 4).fill(0);
  for (let i = 0; i < vertexCount; i++) {
    getVertexArray(prim, i, "JOINTS", joints);
    getVertexArray(prim, i, "WEIGHTS", weights, normalizedComponentType);
    let weightsSum = sum(weights, normalizedComponentType);
    if (weightsSum === 0) continue;
    if (Math.abs(1 - weightsSum) > delta) {
      for (let j = 0; j < weights.length; j++) {
        if (normalized) {
          const intValue = MathUtils.encodeNormalizedInt(weights[j] / weightsSum, componentType);
          weights[j] = MathUtils.decodeNormalizedInt(intValue, componentType);
        } else {
          weights[j] /= weightsSum;
        }
      }
    }
    weightsSum = sum(weights, normalizedComponentType);
    if (normalized && weightsSum !== 1) {
      for (let j = weights.length - 1; j >= 0; j--) {
        if (weights[j] > 0) {
          weights[j] += MathUtils.encodeNormalizedInt(1 - weightsSum, componentType);
          break;
        }
      }
    }
    for (let j = weights.length - 1; j >= 0; j--) {
      if (weights[j] === 0) {
        joints[j] = 0;
      }
    }
    setVertexArray(prim, i, "JOINTS", joints);
    setVertexArray(prim, i, "WEIGHTS", weights, normalizedComponentType);
  }
}
function getVertexArray(prim, vertexIndex, prefix, target, normalizedComponentType) {
  let weights;
  const el = [0, 0, 0, 0];
  for (let i = 0; weights = prim.getAttribute(`${prefix}_${i}`); i++) {
    weights.getElement(vertexIndex, el);
    for (let j = 0; j < 4; j++) {
      if (normalizedComponentType) {
        target[i * 4 + j] = MathUtils.encodeNormalizedInt(el[j], normalizedComponentType);
      } else {
        target[i * 4 + j] = el[j];
      }
    }
  }
  return target;
}
function setVertexArray(prim, vertexIndex, prefix, values, normalizedComponentType) {
  let weights;
  const el = [0, 0, 0, 0];
  for (let i = 0; weights = prim.getAttribute(`${prefix}_${i}`); i++) {
    for (let j = 0; j < 4; j++) {
      if (normalizedComponentType) {
        el[j] = MathUtils.decodeNormalizedInt(values[i * 4 + j], normalizedComponentType);
      } else {
        el[j] = values[i * 4 + j];
      }
    }
    weights.setElement(vertexIndex, el);
  }
}
function sum(values, normalizedComponentType) {
  let sum2 = 0;
  for (let i = 0; i < values.length; i++) {
    if (normalizedComponentType) {
      sum2 += MathUtils.decodeNormalizedInt(values[i], normalizedComponentType);
    } else {
      sum2 += values[i];
    }
  }
  return sum2;
}
function isNormalizeSafe(prim) {
  const attributes = prim.listSemantics().filter((name) => name.startsWith("WEIGHTS_")).map((name) => prim.getAttribute(name));
  const normList = attributes.map((a2) => a2.getNormalized());
  const typeList = attributes.map((a2) => a2.getComponentType());
  return new Set(normList).size === 1 && new Set(typeList).size === 1;
}
var NAME$e = "quantize";
var SIGNED_INT = [Int8Array, Int16Array, Int32Array];
var {
  TRANSLATION,
  ROTATION,
  SCALE,
  WEIGHTS
} = AnimationChannel.TargetPath;
var TRS_CHANNELS = [TRANSLATION, ROTATION, SCALE];
var QUANTIZE_DEFAULTS = {
  pattern: /.*/,
  quantizationVolume: "mesh",
  quantizePosition: 14,
  quantizeNormal: 10,
  quantizeTexcoord: 12,
  quantizeColor: 8,
  quantizeWeight: 8,
  quantizeGeneric: 12,
  normalizeWeights: true,
  cleanup: true
};
function quantize(_options = QUANTIZE_DEFAULTS) {
  const options = assignDefaults(QUANTIZE_DEFAULTS, _extends({
    patternTargets: _options.pattern || QUANTIZE_DEFAULTS.pattern
  }, _options));
  return createTransform(NAME$e, async (doc) => {
    const logger = doc.getLogger();
    const root = doc.getRoot();
    doc.createExtension(KHRMeshQuantization).setRequired(true);
    let nodeTransform = void 0;
    if (options.quantizationVolume === "scene") {
      nodeTransform = getNodeTransform(expandBounds(root.listMeshes().map(getPositionQuantizationVolume)));
    }
    for (const mesh of doc.getRoot().listMeshes()) {
      if (options.quantizationVolume === "mesh") {
        nodeTransform = getNodeTransform(getPositionQuantizationVolume(mesh));
      }
      if (nodeTransform && options.pattern.test("POSITION")) {
        transformMeshParents(doc, mesh, nodeTransform);
        transformMeshMaterials(mesh, 1 / nodeTransform.scale);
      }
      for (const prim of mesh.listPrimitives()) {
        const renderCount = getPrimitiveVertexCount(prim, VertexCountMethod.RENDER);
        const uploadCount = getPrimitiveVertexCount(prim, VertexCountMethod.UPLOAD);
        if (renderCount < uploadCount / 2) {
          compactPrimitive(prim);
        }
        quantizePrimitive(doc, prim, nodeTransform, options);
        for (const target of prim.listTargets()) {
          quantizePrimitive(doc, target, nodeTransform, options);
        }
      }
    }
    if (options.cleanup) {
      await doc.transform(prune({
        propertyTypes: [PropertyType.ACCESSOR, PropertyType.SKIN, PropertyType.MATERIAL],
        keepAttributes: true,
        keepIndices: true,
        keepLeaves: true,
        keepSolidTextures: true
      }), dedup({
        propertyTypes: [PropertyType.ACCESSOR, PropertyType.MATERIAL, PropertyType.SKIN],
        keepUniqueNames: true
      }));
    }
    logger.debug(`${NAME$e}: Complete.`);
  });
}
function quantizePrimitive(doc, prim, nodeTransform, options) {
  const isTarget = prim instanceof PrimitiveTarget;
  const logger = doc.getLogger();
  for (const semantic of prim.listSemantics()) {
    if (!isTarget && !options.pattern.test(semantic)) continue;
    if (isTarget && !options.patternTargets.test(semantic)) continue;
    const srcAttribute = prim.getAttribute(semantic);
    const {
      bits,
      ctor
    } = getQuantizationSettings(semantic, srcAttribute, logger, options);
    if (!ctor) continue;
    if (bits < 8 || bits > 16) throw new Error(`${NAME$e}: Requires bits = 8\u201316.`);
    if (srcAttribute.getComponentSize() <= bits / 8) continue;
    const dstAttribute = srcAttribute.clone();
    if (semantic === "POSITION") {
      const scale2 = nodeTransform.scale;
      const transform = [];
      prim instanceof Primitive ? invert$1(transform, fromTransform(nodeTransform)) : fromScaling(transform, [1 / scale2, 1 / scale2, 1 / scale2]);
      for (let i = 0, el = [0, 0, 0], il = dstAttribute.getCount(); i < il; i++) {
        dstAttribute.getElement(i, el);
        dstAttribute.setElement(i, transformMat4(el, el, transform));
      }
    }
    quantizeAttribute(dstAttribute, ctor, bits);
    prim.setAttribute(semantic, dstAttribute);
  }
  if (options.normalizeWeights && prim.getAttribute("WEIGHTS_0")) {
    sortPrimitiveWeights(prim, Infinity);
  }
  if (prim instanceof Primitive && prim.getIndices() && prim.listAttributes().length && prim.listAttributes()[0].getCount() < 65535) {
    const indices = prim.getIndices();
    indices.setArray(new Uint16Array(indices.getArray()));
  }
}
function getNodeTransform(volume) {
  const {
    min: min2,
    max: max2
  } = volume;
  const scale2 = Math.max(
    (max2[0] - min2[0]) / 2,
    // Divide because interval [-1,1] has length 2.
    (max2[1] - min2[1]) / 2,
    (max2[2] - min2[2]) / 2
  );
  const offset = [min2[0] + (max2[0] - min2[0]) / 2, min2[1] + (max2[1] - min2[1]) / 2, min2[2] + (max2[2] - min2[2]) / 2];
  return {
    offset,
    scale: scale2
  };
}
function transformMeshParents(doc, mesh, nodeTransform) {
  const transformMatrix = fromTransform(nodeTransform);
  for (const parent of mesh.listParents()) {
    if (!(parent instanceof Node)) continue;
    const animChannels = parent.listParents().filter((p) => p instanceof AnimationChannel);
    const isAnimated = animChannels.some((channel) => TRS_CHANNELS.includes(channel.getTargetPath()));
    const isParentNode = parent.listChildren().length > 0;
    const skin = parent.getSkin();
    if (skin) {
      parent.setSkin(transformSkin(skin, nodeTransform));
      continue;
    }
    const batch = parent.getExtension("EXT_mesh_gpu_instancing");
    if (batch) {
      parent.setExtension("EXT_mesh_gpu_instancing", transformBatch(batch, nodeTransform));
      continue;
    }
    let targetNode;
    if (isParentNode || isAnimated) {
      targetNode = doc.createNode("").setMesh(mesh);
      parent.addChild(targetNode).setMesh(null);
      animChannels.filter((channel) => channel.getTargetPath() === WEIGHTS).forEach((channel) => channel.setTargetNode(targetNode));
    } else {
      targetNode = parent;
    }
    const nodeMatrix = targetNode.getMatrix();
    multiply$2(nodeMatrix, nodeMatrix, transformMatrix);
    targetNode.setMatrix(nodeMatrix);
  }
}
function transformSkin(skin, nodeTransform) {
  skin = skin.clone();
  const transformMatrix = fromTransform(nodeTransform);
  const inverseBindMatrices = skin.getInverseBindMatrices().clone();
  const ibm = [];
  for (let i = 0, count = inverseBindMatrices.getCount(); i < count; i++) {
    inverseBindMatrices.getElement(i, ibm);
    multiply$2(ibm, ibm, transformMatrix);
    inverseBindMatrices.setElement(i, ibm);
  }
  return skin.setInverseBindMatrices(inverseBindMatrices);
}
function transformBatch(batch, nodeTransform) {
  var _batch$getAttribute, _batch$getAttribute2, _batch$getAttribute3;
  if (!batch.getAttribute("TRANSLATION") && !batch.getAttribute("ROTATION") && !batch.getAttribute("SCALE")) {
    return batch;
  }
  batch = batch.clone();
  const instanceTranslation = (_batch$getAttribute = batch.getAttribute("TRANSLATION")) == null ? void 0 : _batch$getAttribute.clone();
  const instanceRotation = (_batch$getAttribute2 = batch.getAttribute("ROTATION")) == null ? void 0 : _batch$getAttribute2.clone();
  const instanceScale = (_batch$getAttribute3 = batch.getAttribute("SCALE")) == null ? void 0 : _batch$getAttribute3.clone();
  const tpl = instanceTranslation || instanceRotation || instanceScale;
  const T_IDENTITY = [0, 0, 0];
  const R_IDENTITY = [0, 0, 0, 1];
  const S_IDENTITY = [1, 1, 1];
  const t2 = [0, 0, 0];
  const r2 = [0, 0, 0, 1];
  const s2 = [1, 1, 1];
  const instanceMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const transformMatrix = fromTransform(nodeTransform);
  for (let i = 0, count = tpl.getCount(); i < count; i++) {
    MathUtils.compose(instanceTranslation ? instanceTranslation.getElement(i, t2) : T_IDENTITY, instanceRotation ? instanceRotation.getElement(i, r2) : R_IDENTITY, instanceScale ? instanceScale.getElement(i, s2) : S_IDENTITY, instanceMatrix);
    multiply$2(instanceMatrix, instanceMatrix, transformMatrix);
    MathUtils.decompose(instanceMatrix, t2, r2, s2);
    if (instanceTranslation) instanceTranslation.setElement(i, t2);
    if (instanceRotation) instanceRotation.setElement(i, r2);
    if (instanceScale) instanceScale.setElement(i, s2);
  }
  if (instanceTranslation) batch.setAttribute("TRANSLATION", instanceTranslation);
  if (instanceRotation) batch.setAttribute("ROTATION", instanceRotation);
  if (instanceScale) batch.setAttribute("SCALE", instanceScale);
  return batch;
}
function transformMeshMaterials(mesh, scale2) {
  for (const prim of mesh.listPrimitives()) {
    let material = prim.getMaterial();
    if (!material) continue;
    let volume = material.getExtension("KHR_materials_volume");
    if (!volume || volume.getThicknessFactor() <= 0) continue;
    volume = volume.clone().setThicknessFactor(volume.getThicknessFactor() * scale2);
    material = material.clone().setExtension("KHR_materials_volume", volume);
    prim.setMaterial(material);
  }
}
function quantizeAttribute(attribute, ctor, bits) {
  const dstArray = new ctor(attribute.getArray().length);
  const signBits = SIGNED_INT.includes(ctor) ? 1 : 0;
  const quantBits = bits - signBits;
  const storageBits = ctor.BYTES_PER_ELEMENT * 8 - signBits;
  const scale2 = Math.pow(2, quantBits) - 1;
  const lo = storageBits - quantBits;
  const hi = 2 * quantBits - storageBits;
  const range = [signBits > 0 ? -1 : 0, 1];
  for (let i = 0, di = 0, el = []; i < attribute.getCount(); i++) {
    attribute.getElement(i, el);
    for (let j = 0; j < el.length; j++) {
      let value = clamp(el[j], range);
      value = Math.round(Math.abs(value) * scale2);
      value = value << lo | value >> hi;
      dstArray[di++] = value * Math.sign(el[j]);
    }
  }
  attribute.setArray(dstArray).setNormalized(true).setSparse(false);
}
function getQuantizationSettings(semantic, attribute, logger, options) {
  const min2 = attribute.getMinNormalized([]);
  const max2 = attribute.getMaxNormalized([]);
  let bits;
  let ctor;
  if (semantic === "POSITION") {
    bits = options.quantizePosition;
    ctor = bits <= 8 ? Int8Array : Int16Array;
  } else if (semantic === "NORMAL" || semantic === "TANGENT") {
    bits = options.quantizeNormal;
    ctor = bits <= 8 ? Int8Array : Int16Array;
  } else if (semantic.startsWith("COLOR_")) {
    bits = options.quantizeColor;
    ctor = bits <= 8 ? Uint8Array : Uint16Array;
  } else if (semantic.startsWith("TEXCOORD_")) {
    if (min2.some((v) => v < 0) || max2.some((v) => v > 1)) {
      logger.warn(`${NAME$e}: Skipping ${semantic}; out of [0,1] range.`);
      return {
        bits: -1
      };
    }
    bits = options.quantizeTexcoord;
    ctor = bits <= 8 ? Uint8Array : Uint16Array;
  } else if (semantic.startsWith("JOINTS_")) {
    bits = Math.max(...attribute.getMax([])) <= 255 ? 8 : 16;
    ctor = bits <= 8 ? Uint8Array : Uint16Array;
    if (attribute.getComponentSize() > bits / 8) {
      attribute.setArray(new ctor(attribute.getArray()));
    }
    return {
      bits: -1
    };
  } else if (semantic.startsWith("WEIGHTS_")) {
    if (min2.some((v) => v < 0) || max2.some((v) => v > 1)) {
      logger.warn(`${NAME$e}: Skipping ${semantic}; out of [0,1] range.`);
      return {
        bits: -1
      };
    }
    bits = options.quantizeWeight;
    ctor = bits <= 8 ? Uint8Array : Uint16Array;
  } else if (semantic.startsWith("_")) {
    if (min2.some((v) => v < -1) || max2.some((v) => v > 1)) {
      logger.warn(`${NAME$e}: Skipping ${semantic}; out of [-1,1] range.`);
      return {
        bits: -1
      };
    }
    bits = options.quantizeGeneric;
    ctor = min2.some((v) => v < 0) ? ctor = bits <= 8 ? Int8Array : Int16Array : ctor = bits <= 8 ? Uint8Array : Uint16Array;
  } else {
    throw new Error(`${NAME$e}: Unexpected semantic, "${semantic}".`);
  }
  return {
    bits,
    ctor
  };
}
function getPositionQuantizationVolume(mesh) {
  const positions = [];
  const relativePositions = [];
  for (const prim of mesh.listPrimitives()) {
    const attribute = prim.getAttribute("POSITION");
    if (attribute) positions.push(attribute);
    for (const target of prim.listTargets()) {
      const _attribute = target.getAttribute("POSITION");
      if (_attribute) relativePositions.push(_attribute);
    }
  }
  if (positions.length === 0) {
    throw new Error(`${NAME$e}: Missing "POSITION" attribute.`);
  }
  const bbox = flatBounds(positions, 3);
  if (relativePositions.length > 0) {
    const {
      min: relMin,
      max: relMax
    } = flatBounds(relativePositions, 3);
    min(bbox.min, bbox.min, min(relMin, scale$1(relMin, relMin, 2), [0, 0, 0]));
    max(bbox.max, bbox.max, max(relMax, scale$1(relMax, relMax, 2), [0, 0, 0]));
  }
  return bbox;
}
function flatBounds(accessors, elementSize) {
  const min2 = new Array(elementSize).fill(Infinity);
  const max2 = new Array(elementSize).fill(-Infinity);
  const tmpMin = [];
  const tmpMax = [];
  for (const accessor of accessors) {
    accessor.getMinNormalized(tmpMin);
    accessor.getMaxNormalized(tmpMax);
    for (let i = 0; i < elementSize; i++) {
      min2[i] = Math.min(min2[i], tmpMin[i]);
      max2[i] = Math.max(max2[i], tmpMax[i]);
    }
  }
  return {
    min: min2,
    max: max2
  };
}
function expandBounds(bboxes) {
  const result = bboxes[0];
  for (const bbox of bboxes) {
    min(result.min, result.min, bbox.min);
    max(result.max, result.max, bbox.max);
  }
  return result;
}
function fromTransform(transform) {
  return fromRotationTranslationScale([], [0, 0, 0, 1], transform.offset, [transform.scale, transform.scale, transform.scale]);
}
function clamp(value, range) {
  return Math.min(Math.max(value, range[0]), range[1]);
}
var MESHOPT_DEFAULTS = _extends({
  level: "high"
}, QUANTIZE_DEFAULTS);
var NAME$d = "meshopt";
function meshopt(_options) {
  const options = assignDefaults(MESHOPT_DEFAULTS, _options);
  const encoder = options.encoder;
  if (!encoder) {
    throw new Error(`${NAME$d}: encoder dependency required \u2014 install "meshoptimizer".`);
  }
  return createTransform(NAME$d, async (document) => {
    let pattern;
    let patternTargets;
    let quantizeNormal = options.quantizeNormal;
    if (options.level === "medium") {
      pattern = /.*/;
      patternTargets = /.*/;
    } else {
      pattern = /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR)(_\d+)?$/;
      patternTargets = /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR|NORMAL|TANGENT)(_\d+)?$/;
      quantizeNormal = Math.min(quantizeNormal, 8);
    }
    await document.transform(reorder({
      encoder,
      target: "size"
    }), quantize(_extends({}, options, {
      pattern,
      patternTargets,
      quantizeNormal
    })));
    document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
      method: options.level === "medium" ? EXTMeshoptCompression.EncoderMethod.QUANTIZE : EXTMeshoptCompression.EncoderMethod.FILTER
    });
  });
}
var NAME$c = "metalRough";
var METALROUGH_DEFAULTS = {};
function metalRough(_options = METALROUGH_DEFAULTS) {
  return createTransform(NAME$c, async (doc) => {
    const logger = doc.getLogger();
    const extensionsUsed = doc.getRoot().listExtensionsUsed().map((ext) => ext.extensionName);
    if (!extensionsUsed.includes("KHR_materials_pbrSpecularGlossiness")) {
      logger.warn(`${NAME$c}: KHR_materials_pbrSpecularGlossiness not found on document.`);
      return;
    }
    const iorExtension = doc.createExtension(KHRMaterialsIOR);
    const specExtension = doc.createExtension(KHRMaterialsSpecular);
    const specGlossExtension = doc.createExtension(KHRMaterialsPBRSpecularGlossiness);
    const inputTextures = /* @__PURE__ */ new Set();
    for (const material of doc.getRoot().listMaterials()) {
      const specGloss = material.getExtension("KHR_materials_pbrSpecularGlossiness");
      if (!specGloss) continue;
      const specular = specExtension.createSpecular().setSpecularFactor(1).setSpecularColorFactor(specGloss.getSpecularFactor());
      inputTextures.add(specGloss.getSpecularGlossinessTexture());
      inputTextures.add(material.getBaseColorTexture());
      inputTextures.add(material.getMetallicRoughnessTexture());
      material.setBaseColorFactor(specGloss.getDiffuseFactor()).setMetallicFactor(0).setRoughnessFactor(1).setExtension("KHR_materials_ior", iorExtension.createIOR().setIOR(1e3)).setExtension("KHR_materials_specular", specular);
      const diffuseTexture = specGloss.getDiffuseTexture();
      if (diffuseTexture) {
        material.setBaseColorTexture(diffuseTexture);
        material.getBaseColorTextureInfo().copy(specGloss.getDiffuseTextureInfo());
      }
      const sgTexture = specGloss.getSpecularGlossinessTexture();
      if (sgTexture) {
        const sgTextureInfo = specGloss.getSpecularGlossinessTextureInfo();
        const specularTexture = doc.createTexture();
        await rewriteTexture(sgTexture, specularTexture, (pixels, i, j) => {
          pixels.set(i, j, 3, 255);
        });
        specular.setSpecularTexture(specularTexture);
        specular.setSpecularColorTexture(specularTexture);
        specular.getSpecularTextureInfo().copy(sgTextureInfo);
        specular.getSpecularColorTextureInfo().copy(sgTextureInfo);
        const glossinessFactor = specGloss.getGlossinessFactor();
        const metalRoughTexture = doc.createTexture();
        await rewriteTexture(sgTexture, metalRoughTexture, (pixels, i, j) => {
          const roughness = 255 - Math.round(pixels.get(i, j, 3) * glossinessFactor);
          pixels.set(i, j, 0, 0);
          pixels.set(i, j, 1, roughness);
          pixels.set(i, j, 2, 0);
          pixels.set(i, j, 3, 255);
        });
        material.setMetallicRoughnessTexture(metalRoughTexture);
        material.getMetallicRoughnessTextureInfo().copy(sgTextureInfo);
      } else {
        specular.setSpecularColorFactor(specGloss.getSpecularFactor());
        material.setRoughnessFactor(1 - specGloss.getGlossinessFactor());
      }
      material.setExtension("KHR_materials_pbrSpecularGlossiness", null);
    }
    specGlossExtension.dispose();
    for (const tex of inputTextures) {
      if (tex && tex.listParents().length === 1) tex.dispose();
    }
    logger.debug(`${NAME$c}: Complete.`);
  });
}
var NAME$b = "unweld";
var UNWELD_DEFAULTS = {};
function unweld(_options = UNWELD_DEFAULTS) {
  return createTransform(NAME$b, (doc) => {
    const logger = doc.getLogger();
    const visited = /* @__PURE__ */ new Map();
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        unweldPrimitive(prim, visited);
      }
    }
    logger.debug(`${NAME$b}: Complete.`);
  });
}
function unweldPrimitive(prim, visited = /* @__PURE__ */ new Map()) {
  const indices = prim.getIndices();
  if (!indices) return;
  const graph = prim.getGraph();
  const document = Document.fromGraph(graph);
  const logger = document.getLogger();
  const srcVertexCount = prim.getAttribute("POSITION").getCount();
  for (const srcAttribute of prim.listAttributes()) {
    prim.swap(srcAttribute, unweldAttribute(document, srcAttribute, indices, visited));
    if (srcAttribute.listParents().length === 1) srcAttribute.dispose();
  }
  for (const target of prim.listTargets()) {
    for (const srcAttribute of target.listAttributes()) {
      target.swap(srcAttribute, unweldAttribute(document, srcAttribute, indices, visited));
      if (srcAttribute.listParents().length === 1) srcAttribute.dispose();
    }
  }
  const dstVertexCount = prim.getAttribute("POSITION").getCount();
  logger.debug(`${NAME$b}: ${formatDeltaOp(srcVertexCount, dstVertexCount)} vertices.`);
  prim.setIndices(null);
  if (indices.listParents().length === 1) indices.dispose();
}
function unweldAttribute(document, srcAttribute, indices, visited) {
  if (visited.has(srcAttribute) && visited.get(srcAttribute).has(indices)) {
    return visited.get(srcAttribute).get(indices);
  }
  const srcArray = srcAttribute.getArray();
  const TypedArray = srcArray.constructor;
  const dstArray = new TypedArray(indices.getCount() * srcAttribute.getElementSize());
  const indicesArray = indices.getArray();
  const elementSize = srcAttribute.getElementSize();
  for (let i = 0, il = indices.getCount(); i < il; i++) {
    for (let j = 0; j < elementSize; j++) {
      dstArray[i * elementSize + j] = srcArray[indicesArray[i] * elementSize + j];
    }
  }
  if (!visited.has(srcAttribute)) visited.set(srcAttribute, /* @__PURE__ */ new Map());
  const dstAttribute = shallowCloneAccessor(document, srcAttribute).setArray(dstArray);
  visited.get(srcAttribute).set(indices, dstAttribute);
  return dstAttribute;
}
var NAME$a = "normals";
var NORMALS_DEFAULTS = {
  overwrite: false
};
function normals(_options = NORMALS_DEFAULTS) {
  const options = assignDefaults(NORMALS_DEFAULTS, _options);
  return createTransform(NAME$a, async (document) => {
    const logger = document.getLogger();
    let modified = 0;
    await document.transform(unweld());
    for (const mesh of document.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute("POSITION");
        let normal = prim.getAttribute("NORMAL");
        if (options.overwrite && normal) {
          normal.dispose();
        } else if (normal) {
          logger.debug(`${NAME$a}: Skipping primitive: NORMAL found.`);
          continue;
        }
        normal = document.createAccessor().setArray(new Float32Array(position.getCount() * 3)).setType("VEC3");
        const a2 = [0, 0, 0];
        const b = [0, 0, 0];
        const c2 = [0, 0, 0];
        for (let i = 0; i < position.getCount(); i += 3) {
          position.getElement(i + 0, a2);
          position.getElement(i + 1, b);
          position.getElement(i + 2, c2);
          const faceNormal = computeNormal(a2, b, c2);
          normal.setElement(i + 0, faceNormal);
          normal.setElement(i + 1, faceNormal);
          normal.setElement(i + 2, faceNormal);
        }
        prim.setAttribute("NORMAL", normal);
        modified++;
      }
    }
    if (!modified) {
      logger.warn(`${NAME$a}: No qualifying primitives found. See debug output.`);
    } else {
      logger.debug(`${NAME$a}: Complete.`);
    }
  });
}
function computeNormal(a2, b, c2) {
  const A = [b[0] - a2[0], b[1] - a2[1], b[2] - a2[2]];
  const B = [c2[0] - a2[0], c2[1] - a2[1], c2[2] - a2[2]];
  const n2 = [
    A[1] * B[2] - A[2] * B[1],
    //
    A[2] * B[0] - A[0] * B[2],
    A[0] * B[1] - A[1] * B[0]
  ];
  return normalize([0, 0, 0], n2);
}
var NAME$9 = "palette";
var PALETTE_DEFAULTS = {
  blockSize: 4,
  min: 5,
  cleanup: true
};
function palette(_options = PALETTE_DEFAULTS) {
  const options = assignDefaults(PALETTE_DEFAULTS, _options);
  const blockSize = Math.max(options.blockSize, 1);
  const min2 = Math.max(options.min, 1);
  return createTransform(NAME$9, async (document) => {
    const logger = document.getLogger();
    const root = document.getRoot();
    await document.transform(prune({
      propertyTypes: [PropertyType.ACCESSOR],
      keepAttributes: false,
      keepIndices: true,
      keepLeaves: true
    }));
    const prims = /* @__PURE__ */ new Set();
    const materials = /* @__PURE__ */ new Set();
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const material = prim.getMaterial();
        if (!material || !!prim.getAttribute("TEXCOORD_0")) continue;
        prims.add(prim);
        materials.add(material);
      }
    }
    const materialKeys = /* @__PURE__ */ new Set();
    const materialKeyMap = /* @__PURE__ */ new Map();
    const materialProps = {
      baseColor: /* @__PURE__ */ new Set(),
      emissive: /* @__PURE__ */ new Set(),
      metallicRoughness: /* @__PURE__ */ new Set()
    };
    for (const material of materials) {
      const baseColor = encodeRGBA(material.getBaseColorFactor().slice());
      const emissive = encodeRGBA([...material.getEmissiveFactor(), 1]);
      const roughness = encodeFloat(material.getRoughnessFactor());
      const metallic = encodeFloat(material.getMetallicFactor());
      const key = `baseColor:${baseColor},emissive:${emissive},metallicRoughness:${metallic}${roughness}`;
      materialProps.baseColor.add(baseColor);
      materialProps.emissive.add(emissive);
      materialProps.metallicRoughness.add(metallic + "+" + roughness);
      materialKeys.add(key);
      materialKeyMap.set(material, key);
    }
    const keyCount = materialKeys.size;
    if (keyCount < min2) {
      logger.debug(`${NAME$9}: Found <${min2} unique material properties. Exiting.`);
      return;
    }
    const w = ceilPowerOfTwo(keyCount * blockSize);
    const h = ceilPowerOfTwo(blockSize);
    const padWidth = w - keyCount * blockSize;
    const paletteTexturePixels = {
      baseColor: null,
      emissive: null,
      metallicRoughness: null
    };
    const skipProps = /* @__PURE__ */ new Set(["name", "extras"]);
    const skip = (...props) => props.forEach((prop) => skipProps.add(prop));
    let baseColorTexture = null;
    let emissiveTexture = null;
    let metallicRoughnessTexture = null;
    if (materialProps.baseColor.size >= min2) {
      const name = "PaletteBaseColor";
      baseColorTexture = document.createTexture(name).setURI(`${name}.png`);
      paletteTexturePixels.baseColor = (0, import_ndarray3.default)(new Uint8Array(w * h * 4), [w, h, 4]);
      skip("baseColorFactor", "baseColorTexture", "baseColorTextureInfo");
    }
    if (materialProps.emissive.size >= min2) {
      const name = "PaletteEmissive";
      emissiveTexture = document.createTexture(name).setURI(`${name}.png`);
      paletteTexturePixels.emissive = (0, import_ndarray3.default)(new Uint8Array(w * h * 4), [w, h, 4]);
      skip("emissiveFactor", "emissiveTexture", "emissiveTextureInfo");
    }
    if (materialProps.metallicRoughness.size >= min2) {
      const name = "PaletteMetallicRoughness";
      metallicRoughnessTexture = document.createTexture(name).setURI(`${name}.png`);
      paletteTexturePixels.metallicRoughness = (0, import_ndarray3.default)(new Uint8Array(w * h * 4), [w, h, 4]);
      skip("metallicFactor", "roughnessFactor", "metallicRoughnessTexture", "metallicRoughnessTextureInfo");
    }
    if (!(baseColorTexture || emissiveTexture || metallicRoughnessTexture)) {
      logger.debug(`${NAME$9}: No material property has >=${min2} unique values. Exiting.`);
      return;
    }
    const visitedKeys = /* @__PURE__ */ new Set();
    const materialIndices = /* @__PURE__ */ new Map();
    const paletteMaterials = [];
    let nextIndex = 0;
    for (const material of materials) {
      const key = materialKeyMap.get(material);
      if (visitedKeys.has(key)) continue;
      const index = nextIndex++;
      if (paletteTexturePixels.baseColor) {
        const pixels = paletteTexturePixels.baseColor;
        const baseColor = [...material.getBaseColorFactor()];
        ColorUtils.convertLinearToSRGB(baseColor, baseColor);
        writeBlock(pixels, index, baseColor, blockSize);
      }
      if (paletteTexturePixels.emissive) {
        const pixels = paletteTexturePixels.emissive;
        const emissive = [...material.getEmissiveFactor(), 1];
        ColorUtils.convertLinearToSRGB(emissive, emissive);
        writeBlock(pixels, index, emissive, blockSize);
      }
      if (paletteTexturePixels.metallicRoughness) {
        const pixels = paletteTexturePixels.metallicRoughness;
        const metallic = material.getMetallicFactor();
        const roughness = material.getRoughnessFactor();
        writeBlock(pixels, index, [0, roughness, metallic, 1], blockSize);
      }
      visitedKeys.add(key);
      materialIndices.set(key, index);
    }
    const mimeType = "image/png";
    if (baseColorTexture) {
      const image = await savePixels(paletteTexturePixels.baseColor, mimeType);
      baseColorTexture.setImage(image).setMimeType(mimeType);
    }
    if (emissiveTexture) {
      const image = await savePixels(paletteTexturePixels.emissive, mimeType);
      emissiveTexture.setImage(image).setMimeType(mimeType);
    }
    if (metallicRoughnessTexture) {
      const image = await savePixels(paletteTexturePixels.metallicRoughness, mimeType);
      metallicRoughnessTexture.setImage(image).setMimeType(mimeType);
    }
    let nextPaletteMaterialIndex = 1;
    for (const prim of prims) {
      const srcMaterial = prim.getMaterial();
      const key = materialKeyMap.get(srcMaterial);
      const blockIndex = materialIndices.get(key);
      const baseUV = (blockIndex + 0.5) / keyCount;
      const padUV = baseUV * (w - padWidth) / w;
      const position = prim.getAttribute("POSITION");
      const buffer = position.getBuffer();
      const array = new Float32Array(position.getCount() * 2).fill(padUV);
      const uv = document.createAccessor().setType("VEC2").setArray(array).setBuffer(buffer);
      let dstMaterial;
      for (const material of paletteMaterials) {
        if (material.equals(srcMaterial, skipProps)) {
          dstMaterial = material;
        }
      }
      if (!dstMaterial) {
        const suffix = (nextPaletteMaterialIndex++).toString().padStart(3, "0");
        dstMaterial = srcMaterial.clone().setName(`PaletteMaterial${suffix}`);
        if (baseColorTexture) {
          dstMaterial.setBaseColorFactor([1, 1, 1, 1]).setBaseColorTexture(baseColorTexture).getBaseColorTextureInfo().setMinFilter(TextureInfo.MinFilter.NEAREST).setMagFilter(TextureInfo.MagFilter.NEAREST);
        }
        if (emissiveTexture) {
          dstMaterial.setEmissiveFactor([1, 1, 1]).setEmissiveTexture(emissiveTexture).getEmissiveTextureInfo().setMinFilter(TextureInfo.MinFilter.NEAREST).setMagFilter(TextureInfo.MagFilter.NEAREST);
        }
        if (metallicRoughnessTexture) {
          dstMaterial.setMetallicFactor(1).setRoughnessFactor(1).setMetallicRoughnessTexture(metallicRoughnessTexture).getMetallicRoughnessTextureInfo().setMinFilter(TextureInfo.MinFilter.NEAREST).setMagFilter(TextureInfo.MagFilter.NEAREST);
        }
        paletteMaterials.push(dstMaterial);
      }
      prim.setMaterial(dstMaterial).setAttribute("TEXCOORD_0", uv);
    }
    if (options.cleanup) {
      await document.transform(prune({
        propertyTypes: [PropertyType.MATERIAL]
      }));
    }
    logger.debug(`${NAME$9}: Complete.`);
  });
}
function encodeFloat(value) {
  const hex = Math.round(value * 255).toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}
function encodeRGBA(value) {
  ColorUtils.convertLinearToSRGB(value, value);
  return value.map(encodeFloat).join("");
}
function ceilPowerOfTwo(value) {
  return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}
function writeBlock(pixels, index, value, blockSize) {
  for (let i = 0; i < blockSize; i++) {
    for (let j = 0; j < blockSize; j++) {
      pixels.set(index * blockSize + i, j, 0, value[0] * 255);
      pixels.set(index * blockSize + i, j, 1, value[1] * 255);
      pixels.set(index * blockSize + i, j, 2, value[2] * 255);
      pixels.set(index * blockSize + i, j, 3, value[3] * 255);
    }
  }
}
var NAME$8 = "partition";
var PARTITION_DEFAULTS = {
  animations: true,
  meshes: true
};
function partition(_options = PARTITION_DEFAULTS) {
  const options = assignDefaults(PARTITION_DEFAULTS, _options);
  return createTransform(NAME$8, async (doc) => {
    const logger = doc.getLogger();
    if (options.meshes !== false) partitionMeshes(doc, logger, options);
    if (options.animations !== false) partitionAnimations(doc, logger, options);
    if (!options.meshes && !options.animations) {
      logger.warn(`${NAME$8}: Select animations or meshes to create a partition.`);
    }
    await doc.transform(prune({
      propertyTypes: [PropertyType.BUFFER]
    }));
    logger.debug(`${NAME$8}: Complete.`);
  });
}
function partitionMeshes(doc, logger, options) {
  const existingURIs = new Set(doc.getRoot().listBuffers().map((b) => b.getURI()));
  doc.getRoot().listMeshes().forEach((mesh, meshIndex) => {
    if (Array.isArray(options.meshes) && !options.meshes.includes(mesh.getName())) {
      logger.debug(`${NAME$8}: Skipping mesh #${meshIndex} with name "${mesh.getName()}".`);
      return;
    }
    logger.debug(`${NAME$8}: Creating buffer for mesh "${mesh.getName()}".`);
    const buffer = doc.createBuffer(mesh.getName()).setURI(createBufferURI(mesh.getName() || "mesh", existingURIs));
    mesh.listPrimitives().forEach((primitive) => {
      const indices = primitive.getIndices();
      if (indices) indices.setBuffer(buffer);
      primitive.listAttributes().forEach((attribute) => attribute.setBuffer(buffer));
      primitive.listTargets().forEach((primTarget) => {
        primTarget.listAttributes().forEach((attribute) => attribute.setBuffer(buffer));
      });
    });
  });
}
function partitionAnimations(doc, logger, options) {
  const existingURIs = new Set(doc.getRoot().listBuffers().map((b) => b.getURI()));
  doc.getRoot().listAnimations().forEach((anim, animIndex) => {
    if (Array.isArray(options.animations) && !options.animations.includes(anim.getName())) {
      logger.debug(`${NAME$8}: Skipping animation #${animIndex} with name "${anim.getName()}".`);
      return;
    }
    logger.debug(`${NAME$8}: Creating buffer for animation "${anim.getName()}".`);
    const buffer = doc.createBuffer(anim.getName()).setURI(createBufferURI(anim.getName() || "animation", existingURIs));
    anim.listSamplers().forEach((sampler) => {
      const input = sampler.getInput();
      const output = sampler.getOutput();
      if (input) input.setBuffer(buffer);
      if (output) output.setBuffer(buffer);
    });
  });
}
var SANITIZE_BASENAME_RE = /[^\w0–9-]+/g;
function createBufferURI(basename, existing) {
  basename = basename.replace(SANITIZE_BASENAME_RE, "");
  let uri = `${basename}.bin`;
  let i = 1;
  while (existing.has(uri)) uri = `${basename}_${i++}.bin`;
  existing.add(uri);
  return uri;
}
var InterpolationInternal;
(function(InterpolationInternal2) {
  InterpolationInternal2[InterpolationInternal2["STEP"] = 0] = "STEP";
  InterpolationInternal2[InterpolationInternal2["LERP"] = 1] = "LERP";
  InterpolationInternal2[InterpolationInternal2["SLERP"] = 2] = "SLERP";
})(InterpolationInternal || (InterpolationInternal = {}));
var EPSILON = 1e-6;
function resampleDebug(input, output, interpolation, tolerance = 1e-4) {
  const elementSize = output.length / input.length;
  const tmp = new Array(elementSize).fill(0);
  const value = new Array(elementSize).fill(0);
  const valueNext = new Array(elementSize).fill(0);
  const valuePrev = new Array(elementSize).fill(0);
  const lastIndex = input.length - 1;
  let writeIndex = 1;
  for (let i = 1; i < lastIndex; ++i) {
    const timePrev = input[writeIndex - 1];
    const time = input[i];
    const timeNext = input[i + 1];
    const t2 = (time - timePrev) / (timeNext - timePrev);
    let keep = false;
    if (time !== timeNext && (i !== 1 || time !== input[0])) {
      getElement(output, writeIndex - 1, valuePrev);
      getElement(output, i, value);
      getElement(output, i + 1, valueNext);
      if (interpolation === "slerp") {
        const sample = slerp(tmp, valuePrev, valueNext, t2);
        const angle = getAngle(valuePrev, value) + getAngle(value, valueNext);
        keep = !eq(value, sample, tolerance) || angle + Number.EPSILON >= Math.PI;
      } else if (interpolation === "lerp") {
        const sample = vlerp(tmp, valuePrev, valueNext, t2);
        keep = !eq(value, sample, tolerance);
      } else if (interpolation === "step") {
        keep = !eq(value, valuePrev) || !eq(value, valueNext);
      }
    }
    if (keep) {
      if (i !== writeIndex) {
        input[writeIndex] = input[i];
        setElement(output, writeIndex, getElement(output, i, tmp));
      }
      writeIndex++;
    }
  }
  if (lastIndex > 0) {
    input[writeIndex] = input[lastIndex];
    setElement(output, writeIndex, getElement(output, lastIndex, tmp));
    writeIndex++;
  }
  return writeIndex;
}
function getElement(array, index, target) {
  for (let i = 0, elementSize = target.length; i < elementSize; i++) {
    target[i] = array[index * elementSize + i];
  }
  return target;
}
function setElement(array, index, value) {
  for (let i = 0, elementSize = value.length; i < elementSize; i++) {
    array[index * elementSize + i] = value[i];
  }
}
function eq(a2, b, tolerance = 0) {
  if (a2.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a2.length; i++) {
    if (Math.abs(a2[i] - b[i]) > tolerance) {
      return false;
    }
  }
  return true;
}
function lerp(v0, v1, t2) {
  return v0 * (1 - t2) + v1 * t2;
}
function vlerp(out, a2, b, t2) {
  for (let i = 0; i < a2.length; i++) out[i] = lerp(a2[i], b[i], t2);
  return out;
}
function slerp(out, a2, b, t2) {
  let ax = a2[0], ay = a2[1], az = a2[2], aw = a2[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let omega, cosom, sinom, scale0, scale1;
  cosom = ax * bx + ay * by + az * bz + aw * bw;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (1 - cosom > EPSILON) {
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t2) * omega) / sinom;
    scale1 = Math.sin(t2 * omega) / sinom;
  } else {
    scale0 = 1 - t2;
    scale1 = t2;
  }
  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
function getAngle(a2, b) {
  const dotproduct = dot(a2, b);
  return Math.acos(2 * dotproduct * dotproduct - 1);
}
function dot(a2, b) {
  return a2[0] * b[0] + a2[1] * b[1] + a2[2] * b[2] + a2[3] * b[3];
}
var NAME$7 = "resample";
var EMPTY_ARRAY = new Float32Array(0);
var RESAMPLE_DEFAULTS = {
  ready: Promise.resolve(),
  resample: resampleDebug,
  tolerance: 1e-4,
  cleanup: true
};
function resample(_options = RESAMPLE_DEFAULTS) {
  const options = assignDefaults(RESAMPLE_DEFAULTS, _options);
  return createTransform(NAME$7, async (document) => {
    const accessorsVisited = /* @__PURE__ */ new Set();
    const srcAccessorCount = document.getRoot().listAccessors().length;
    const logger = document.getLogger();
    const ready = options.ready;
    const resample2 = options.resample;
    await ready;
    for (const animation of document.getRoot().listAnimations()) {
      const samplerTargetPaths = /* @__PURE__ */ new Map();
      for (const channel of animation.listChannels()) {
        samplerTargetPaths.set(channel.getSampler(), channel.getTargetPath());
      }
      for (const sampler of animation.listSamplers()) {
        const samplerInterpolation = sampler.getInterpolation();
        if (samplerInterpolation === "STEP" || samplerInterpolation === "LINEAR") {
          const input = sampler.getInput();
          const output = sampler.getOutput();
          accessorsVisited.add(input);
          accessorsVisited.add(output);
          const tmpTimes = toFloat32Array(input.getArray(), input.getComponentType(), input.getNormalized());
          const tmpValues = toFloat32Array(output.getArray(), output.getComponentType(), output.getNormalized());
          const elementSize = tmpValues.length / tmpTimes.length;
          const srcCount = tmpTimes.length;
          let dstCount;
          if (samplerInterpolation === "STEP") {
            dstCount = resample2(tmpTimes, tmpValues, "step", options.tolerance);
          } else if (samplerTargetPaths.get(sampler) === "rotation") {
            dstCount = resample2(tmpTimes, tmpValues, "slerp", options.tolerance);
          } else {
            dstCount = resample2(tmpTimes, tmpValues, "lerp", options.tolerance);
          }
          if (dstCount < srcCount) {
            const srcTimes = input.getArray();
            const srcValues = output.getArray();
            const dstTimes = fromFloat32Array(new Float32Array(tmpTimes.buffer, tmpTimes.byteOffset, dstCount), input.getComponentType(), input.getNormalized());
            const dstValues = fromFloat32Array(new Float32Array(tmpValues.buffer, tmpValues.byteOffset, dstCount * elementSize), output.getComponentType(), output.getNormalized());
            input.setArray(EMPTY_ARRAY);
            output.setArray(EMPTY_ARRAY);
            sampler.setInput(input.clone().setArray(dstTimes));
            sampler.setOutput(output.clone().setArray(dstValues));
            input.setArray(srcTimes);
            output.setArray(srcValues);
          }
        }
      }
    }
    for (const accessor of Array.from(accessorsVisited.values())) {
      const used = accessor.listParents().some((p) => !(p instanceof Root));
      if (!used) accessor.dispose();
    }
    const dstAccessorCount = document.getRoot().listAccessors().length;
    if (dstAccessorCount > srcAccessorCount && options.cleanup) {
      await document.transform(dedup({
        propertyTypes: [PropertyType.ACCESSOR]
      }));
    }
    logger.debug(`${NAME$7}: Complete.`);
  });
}
function toFloat32Array(srcArray, componentType, normalized) {
  if (srcArray instanceof Float32Array) return srcArray.slice();
  const dstArray = new Float32Array(srcArray);
  if (!normalized) return dstArray;
  for (let i = 0; i < dstArray.length; i++) {
    dstArray[i] = MathUtils.decodeNormalizedInt(dstArray[i], componentType);
  }
  return dstArray;
}
function fromFloat32Array(srcArray, componentType, normalized) {
  if (componentType === Accessor.ComponentType.FLOAT) return srcArray.slice();
  const TypedArray = ComponentTypeToTypedArray[componentType];
  const dstArray = new TypedArray(srcArray.length);
  for (let i = 0; i < dstArray.length; i++) {
    dstArray[i] = normalized ? MathUtils.encodeNormalizedInt(srcArray[i], componentType) : srcArray[i];
  }
  return dstArray;
}
var NAME$6 = "sequence";
var SEQUENCE_DEFAULTS = {
  name: "",
  fps: 10,
  pattern: /.*/,
  sort: true
};
function sequence(_options = SEQUENCE_DEFAULTS) {
  const options = assignDefaults(SEQUENCE_DEFAULTS, _options);
  return createTransform(NAME$6, (doc) => {
    const logger = doc.getLogger();
    const root = doc.getRoot();
    const fps = options.fps;
    const sequenceNodes = root.listNodes().filter((node) => node.getName().match(options.pattern));
    if (options.sort) {
      sequenceNodes.sort((a2, b) => a2.getName() > b.getName() ? 1 : -1);
    }
    const anim = doc.createAnimation(options.name);
    const animBuffer = root.listBuffers()[0];
    sequenceNodes.forEach((node, i) => {
      let inputArray;
      let outputArray;
      if (i === 0) {
        inputArray = [i / fps, (i + 1) / fps];
        outputArray = [1, 1, 1, 0, 0, 0];
      } else if (i === sequenceNodes.length - 1) {
        inputArray = [(i - 1) / fps, i / fps];
        outputArray = [0, 0, 0, 1, 1, 1];
      } else {
        inputArray = [(i - 1) / fps, i / fps, (i + 1) / fps];
        outputArray = [0, 0, 0, 1, 1, 1, 0, 0, 0];
      }
      const input = doc.createAccessor().setArray(new Float32Array(inputArray)).setBuffer(animBuffer);
      const output = doc.createAccessor().setArray(new Float32Array(outputArray)).setBuffer(animBuffer).setType(Accessor.Type.VEC3);
      const sampler = doc.createAnimationSampler().setInterpolation(AnimationSampler.Interpolation.STEP).setInput(input).setOutput(output);
      const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath(AnimationChannel.TargetPath.SCALE).setSampler(sampler);
      anim.addSampler(sampler).addChannel(channel);
    });
    logger.debug(`${NAME$6}: Complete.`);
  });
}
var NAME$5 = "simplify";
var {
  POINTS,
  LINES,
  LINE_STRIP,
  LINE_LOOP,
  TRIANGLES,
  TRIANGLE_STRIP,
  TRIANGLE_FAN
} = Primitive.Mode;
var SIMPLIFY_DEFAULTS = {
  ratio: 0,
  error: 1e-4,
  lockBorder: false,
  cleanup: true
};
function simplify(_options) {
  const options = assignDefaults(SIMPLIFY_DEFAULTS, _options);
  const simplifier = options.simplifier;
  if (!simplifier) {
    throw new Error(`${NAME$5}: simplifier dependency required \u2014 install "meshoptimizer".`);
  }
  return createTransform(NAME$5, async (document) => {
    const logger = document.getLogger();
    await simplifier.ready;
    await document.transform(weld({
      overwrite: false,
      cleanup: options.cleanup
    }));
    let numUnsupported = 0;
    for (const mesh of document.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const mode = prim.getMode();
        if (mode === TRIANGLES || mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) {
          simplifyPrimitive(prim, options);
          if (getPrimitiveVertexCount(prim, VertexCountMethod.RENDER) === 0) {
            prim.dispose();
          }
        } else if (prim.getMode() === POINTS && !!simplifier.simplifyPoints) {
          simplifyPrimitive(prim, options);
          if (getPrimitiveVertexCount(prim, VertexCountMethod.RENDER) === 0) {
            prim.dispose();
          }
        } else {
          numUnsupported++;
        }
      }
      if (mesh.listPrimitives().length === 0) mesh.dispose();
    }
    if (numUnsupported > 0) {
      logger.warn(`${NAME$5}: Skipping simplification of ${numUnsupported} primitives: Unsupported draw mode.`);
    }
    if (options.cleanup) {
      await document.transform(prune({
        propertyTypes: [PropertyType.ACCESSOR, PropertyType.NODE],
        keepAttributes: true,
        keepIndices: true,
        keepLeaves: false
      }), dedup({
        propertyTypes: [PropertyType.ACCESSOR]
      }));
    }
    logger.debug(`${NAME$5}: Complete.`);
  });
}
function simplifyPrimitive(prim, _options) {
  const options = _extends({}, SIMPLIFY_DEFAULTS, _options);
  const simplifier = options.simplifier;
  const graph = prim.getGraph();
  const document = Document.fromGraph(graph);
  const logger = document.getLogger();
  switch (prim.getMode()) {
    case POINTS:
      return _simplifyPoints(document, prim, options);
    case LINES:
    case LINE_STRIP:
    case LINE_LOOP:
      logger.warn(`${NAME$5}: Skipping primitive simplification: Unsupported draw mode.`);
      return prim;
    case TRIANGLE_STRIP:
    case TRIANGLE_FAN:
      convertPrimitiveToTriangles(prim);
      break;
  }
  const srcVertexCount = getPrimitiveVertexCount(prim, VertexCountMethod.UPLOAD);
  const srcIndexCount = getPrimitiveVertexCount(prim, VertexCountMethod.RENDER);
  if (srcIndexCount < srcVertexCount / 2) {
    compactPrimitive(prim);
  }
  const position = prim.getAttribute("POSITION");
  const srcIndices = prim.getIndices();
  let positionArray = position.getArray();
  let indicesArray = srcIndices.getArray();
  if (!(positionArray instanceof Float32Array)) {
    positionArray = dequantizeAttributeArray(positionArray, position.getComponentType(), position.getNormalized());
  }
  if (!(indicesArray instanceof Uint32Array)) {
    indicesArray = new Uint32Array(indicesArray);
  }
  const targetCount = Math.floor(options.ratio * srcIndexCount / 3) * 3;
  const flags = options.lockBorder ? ["LockBorder"] : [];
  const [dstIndicesArray, error] = simplifier.simplify(indicesArray, positionArray, 3, targetCount, options.error, flags);
  prim.setIndices(shallowCloneAccessor(document, srcIndices).setArray(dstIndicesArray));
  if (srcIndices.listParents().length === 1) srcIndices.dispose();
  compactPrimitive(prim);
  const dstVertexCount = getPrimitiveVertexCount(prim, VertexCountMethod.UPLOAD);
  if (dstVertexCount <= 65534) {
    prim.getIndices().setArray(new Uint16Array(prim.getIndices().getArray()));
  }
  logger.debug(`${NAME$5}: ${formatDeltaOp(srcVertexCount, dstVertexCount)} vertices, error: ${error.toFixed(4)}.`);
  return prim;
}
function _simplifyPoints(document, prim, options) {
  const simplifier = options.simplifier;
  const logger = document.getLogger();
  const indices = prim.getIndices();
  if (indices) unweldPrimitive(prim);
  const position = prim.getAttribute("POSITION");
  const color = prim.getAttribute("COLOR_0");
  const srcVertexCount = position.getCount();
  let positionArray = position.getArray();
  let colorArray = color ? color.getArray() : void 0;
  const colorStride = color ? color.getComponentSize() : void 0;
  if (!(positionArray instanceof Float32Array)) {
    positionArray = dequantizeAttributeArray(positionArray, position.getComponentType(), position.getNormalized());
  }
  if (colorArray && !(colorArray instanceof Float32Array)) {
    colorArray = dequantizeAttributeArray(colorArray, position.getComponentType(), position.getNormalized());
  }
  simplifier.useExperimentalFeatures = true;
  const targetCount = Math.floor(options.ratio * srcVertexCount);
  const dstIndicesArray = simplifier.simplifyPoints(positionArray, 3, targetCount, colorArray, colorStride);
  simplifier.useExperimentalFeatures = false;
  const [remap2, unique] = simplifier.compactMesh(dstIndicesArray);
  logger.debug(`${NAME$5}: ${formatDeltaOp(position.getCount(), unique)} vertices.`);
  for (const srcAttribute of deepListAttributes(prim)) {
    const dstAttribute = shallowCloneAccessor(document, srcAttribute);
    compactAttribute(srcAttribute, null, remap2, dstAttribute, unique);
    deepSwapAttribute(prim, srcAttribute, dstAttribute);
    if (srcAttribute.listParents().length === 1) srcAttribute.dispose();
  }
  return prim;
}
var NAME$4 = "sparse";
var SPARSE_DEFAULTS = {
  ratio: 1 / 3
};
function sparse(_options = SPARSE_DEFAULTS) {
  const options = assignDefaults(SPARSE_DEFAULTS, _options);
  const ratio = options.ratio;
  if (ratio < 0 || ratio > 1) {
    throw new Error(`${NAME$4}: Ratio must be between 0 and 1.`);
  }
  return createTransform(NAME$4, (document) => {
    const root = document.getRoot();
    const logger = document.getLogger();
    let modifiedCount = 0;
    for (const accessor of root.listAccessors()) {
      const count = accessor.getCount();
      const base = Array(accessor.getElementSize()).fill(0);
      const el = Array(accessor.getElementSize()).fill(0);
      let nonZeroCount = 0;
      for (let i = 0; i < count; i++) {
        accessor.getElement(i, el);
        if (!MathUtils.eq(el, base, 0)) nonZeroCount++;
        if (nonZeroCount / count >= ratio) break;
      }
      const sparse2 = nonZeroCount / count < ratio;
      if (sparse2 !== accessor.getSparse()) {
        accessor.setSparse(sparse2);
        modifiedCount++;
      }
    }
    logger.debug(`${NAME$4}: Updated ${modifiedCount} accessors.`);
    logger.debug(`${NAME$4}: Complete.`);
  });
}
var NAME$3 = "textureCompress";
var TEXTURE_COMPRESS_SUPPORTED_FORMATS = ["jpeg", "png", "webp", "avif"];
var SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
var TextureResizeFilter;
(function(TextureResizeFilter2) {
  TextureResizeFilter2["LANCZOS3"] = "lanczos3";
  TextureResizeFilter2["LANCZOS2"] = "lanczos2";
})(TextureResizeFilter || (TextureResizeFilter = {}));
var TEXTURE_COMPRESS_DEFAULTS = {
  resizeFilter: TextureResizeFilter.LANCZOS3,
  pattern: void 0,
  formats: void 0,
  slots: void 0,
  quality: void 0,
  effort: void 0,
  lossless: false,
  nearLossless: false,
  limitInputPixels: true
};
function textureCompress(_options) {
  const options = assignDefaults(TEXTURE_COMPRESS_DEFAULTS, _options);
  const targetFormat = options.targetFormat;
  const patternRe = options.pattern;
  const formatsRe = options.formats;
  const slotsRe = options.slots;
  return createTransform(NAME$3, async (document) => {
    const logger = document.getLogger();
    const textures = document.getRoot().listTextures();
    await Promise.all(textures.map(async (texture, textureIndex) => {
      const slots = listTextureSlots(texture);
      const channels = getTextureChannelMask(texture);
      const textureLabel = texture.getURI() || texture.getName() || `${textureIndex + 1}/${document.getRoot().listTextures().length}`;
      const prefix = `${NAME$3}(${textureLabel})`;
      if (!SUPPORTED_MIME_TYPES.includes(texture.getMimeType())) {
        logger.debug(`${prefix}: Skipping, unsupported texture type "${texture.getMimeType()}".`);
        return;
      } else if (patternRe && !patternRe.test(texture.getName()) && !patternRe.test(texture.getURI())) {
        logger.debug(`${prefix}: Skipping, excluded by "pattern" parameter.`);
        return;
      } else if (formatsRe && !formatsRe.test(texture.getMimeType())) {
        logger.debug(`${prefix}: Skipping, "${texture.getMimeType()}" excluded by "formats" parameter.`);
        return;
      } else if (slotsRe && slots.length && !slots.some((slot) => slotsRe.test(slot))) {
        logger.debug(`${prefix}: Skipping, [${slots.join(", ")}] excluded by "slots" parameter.`);
        return;
      } else if (options.targetFormat === "jpeg" && channels & TextureChannel.A) {
        logger.warn(`${prefix}: Skipping, [${slots.join(", ")}] requires alpha channel.`);
        return;
      }
      const srcFormat = getFormat(texture);
      const dstFormat = targetFormat || srcFormat;
      logger.debug(`${prefix}: Format = ${srcFormat} \u2192 ${dstFormat}`);
      logger.debug(`${prefix}: Slots = [${slots.join(", ")}]`);
      const srcImage = texture.getImage();
      const srcByteLength = srcImage.byteLength;
      await compressTexture(texture, options);
      const dstImage = texture.getImage();
      const dstByteLength = dstImage.byteLength;
      const flag = srcImage === dstImage ? " (SKIPPED" : "";
      logger.debug(`${prefix}: Size = ${formatBytes(srcByteLength)} \u2192 ${formatBytes(dstByteLength)}${flag}`);
    }));
    const webpExtension = document.createExtension(EXTTextureWebP);
    if (textures.some((texture) => texture.getMimeType() === "image/webp")) {
      webpExtension.setRequired(true);
    } else {
      webpExtension.dispose();
    }
    const avifExtension = document.createExtension(EXTTextureAVIF);
    if (textures.some((texture) => texture.getMimeType() === "image/avif")) {
      avifExtension.setRequired(true);
    } else {
      avifExtension.dispose();
    }
    logger.debug(`${NAME$3}: Complete.`);
  });
}
async function compressTexture(texture, _options) {
  const options = _extends({}, TEXTURE_COMPRESS_DEFAULTS, _options);
  const encoder = options.encoder;
  const srcURI = texture.getURI();
  const srcFormat = getFormat(texture);
  const dstFormat = options.targetFormat || srcFormat;
  const srcMimeType = texture.getMimeType();
  const dstMimeType = `image/${dstFormat}`;
  const srcImage = texture.getImage();
  const dstImage = encoder ? await _encodeWithSharp(srcImage, srcMimeType, dstMimeType, options) : await _encodeWithNdarrayPixels(srcImage, srcMimeType, dstMimeType, options);
  const srcByteLength = srcImage.byteLength;
  const dstByteLength = dstImage.byteLength;
  if (srcMimeType === dstMimeType && dstByteLength >= srcByteLength && !options.resize) {
    return;
  } else if (srcMimeType === dstMimeType) {
    texture.setImage(dstImage);
  } else {
    const srcExtension = srcURI ? FileUtils.extension(srcURI) : ImageUtils.mimeTypeToExtension(srcMimeType);
    const dstExtension = ImageUtils.mimeTypeToExtension(dstMimeType);
    const dstURI = texture.getURI().replace(new RegExp(`\\.${srcExtension}$`), `.${dstExtension}`);
    texture.setImage(dstImage).setMimeType(dstMimeType).setURI(dstURI);
  }
}
async function _encodeWithSharp(srcImage, _srcMimeType, dstMimeType, options) {
  const encoder = options.encoder;
  let encoderOptions = {};
  const dstFormat = getFormatFromMimeType(dstMimeType);
  switch (dstFormat) {
    case "jpeg":
      encoderOptions = {
        quality: options.quality
      };
      break;
    case "png":
      encoderOptions = {
        quality: options.quality,
        effort: remap(options.effort, 100, 10)
      };
      break;
    case "webp":
      encoderOptions = {
        quality: options.quality,
        effort: remap(options.effort, 100, 6),
        lossless: options.lossless,
        nearLossless: options.nearLossless
      };
      break;
    case "avif":
      encoderOptions = {
        quality: options.quality,
        effort: remap(options.effort, 100, 9),
        lossless: options.lossless
      };
      break;
  }
  const limitInputPixels = options.limitInputPixels;
  const instance2 = encoder(srcImage, {
    limitInputPixels
  }).toFormat(dstFormat, encoderOptions);
  if (options.resize) {
    const srcSize = ImageUtils.getSize(srcImage, _srcMimeType);
    const dstSize = Array.isArray(options.resize) ? fitWithin(srcSize, options.resize) : fitPowerOfTwo(srcSize, options.resize);
    instance2.resize(dstSize[0], dstSize[1], {
      fit: "fill",
      kernel: options.resizeFilter
    });
  }
  return BufferUtils.toView(await instance2.toBuffer());
}
async function _encodeWithNdarrayPixels(srcImage, srcMimeType, dstMimeType, options) {
  const srcPixels = await getPixels(srcImage, srcMimeType);
  if (options.resize) {
    const [w, h] = srcPixels.shape;
    const dstSize = Array.isArray(options.resize) ? fitWithin([w, h], options.resize) : fitPowerOfTwo([w, h], options.resize);
    const dstPixels = (0, import_ndarray3.default)(new Uint8Array(dstSize[0] * dstSize[1] * 4), [...dstSize, 4]);
    options.resizeFilter === TextureResizeFilter.LANCZOS3 ? s(srcPixels, dstPixels) : c(srcPixels, dstPixels);
    return savePixels(dstPixels, dstMimeType);
  }
  return savePixels(srcPixels, dstMimeType);
}
function getFormat(texture) {
  return getFormatFromMimeType(texture.getMimeType());
}
function getFormatFromMimeType(mimeType) {
  const format = mimeType.split("/").pop();
  if (!format || !TEXTURE_COMPRESS_SUPPORTED_FORMATS.includes(format)) {
    throw new Error(`Unknown MIME type "${mimeType}".`);
  }
  return format;
}
function remap(value, srcMax, dstMax) {
  if (value == null) return void 0;
  return Math.round(value / srcMax * dstMax);
}
var NAME$2 = "tangents";
var TANGENTS_DEFAULTS = {
  overwrite: false
};
function tangents(_options = TANGENTS_DEFAULTS) {
  const options = assignDefaults(TANGENTS_DEFAULTS, _options);
  if (!options.generateTangents) {
    throw new Error(`${NAME$2}: generateTangents callback required \u2014 install "mikktspace".`);
  }
  return createTransform(NAME$2, (doc) => {
    const logger = doc.getLogger();
    const attributeIDs = /* @__PURE__ */ new Map();
    const tangentCache = /* @__PURE__ */ new Map();
    let modified = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      const meshName = mesh.getName();
      const meshPrimitives = mesh.listPrimitives();
      for (let i = 0; i < meshPrimitives.length; i++) {
        const prim = meshPrimitives[i];
        if (!filterPrimitive(prim, logger, meshName, i, options.overwrite)) continue;
        const texcoordSemantic = getNormalTexcoord(prim);
        const position = prim.getAttribute("POSITION").getArray();
        const normal = prim.getAttribute("NORMAL").getArray();
        const texcoord = prim.getAttribute(texcoordSemantic).getArray();
        const positionID = attributeIDs.get(position) || uuid();
        attributeIDs.set(position, positionID);
        const normalID = attributeIDs.get(normal) || uuid();
        attributeIDs.set(normal, normalID);
        const texcoordID = attributeIDs.get(texcoord) || uuid();
        attributeIDs.set(texcoord, texcoordID);
        const prevTangent = prim.getAttribute("TANGENT");
        if (prevTangent && prevTangent.listParents().length === 2) prevTangent.dispose();
        const attributeHash = `${positionID}|${normalID}|${texcoordID}`;
        let tangent = tangentCache.get(attributeHash);
        if (tangent) {
          logger.debug(`${NAME$2}: Found cache for primitive ${i} of mesh "${meshName}".`);
          prim.setAttribute("TANGENT", tangent);
          modified++;
          continue;
        }
        logger.debug(`${NAME$2}: Generating for primitive ${i} of mesh "${meshName}".`);
        const tangentBuffer = prim.getAttribute("POSITION").getBuffer();
        const tangentArray = options.generateTangents(position instanceof Float32Array ? position : new Float32Array(position), normal instanceof Float32Array ? normal : new Float32Array(normal), texcoord instanceof Float32Array ? texcoord : new Float32Array(texcoord));
        for (let _i = 3; _i < tangentArray.length; _i += 4) tangentArray[_i] *= -1;
        tangent = doc.createAccessor().setBuffer(tangentBuffer).setArray(tangentArray).setType("VEC4");
        prim.setAttribute("TANGENT", tangent);
        tangentCache.set(attributeHash, tangent);
        modified++;
      }
    }
    if (!modified) {
      logger.warn(`${NAME$2}: No qualifying primitives found. See debug output.`);
    } else {
      logger.debug(`${NAME$2}: Complete.`);
    }
  });
}
function getNormalTexcoord(prim) {
  const material = prim.getMaterial();
  if (!material) return "TEXCOORD_0";
  const normalTextureInfo = material.getNormalTextureInfo();
  if (!normalTextureInfo) return "TEXCOORD_0";
  const texcoord = normalTextureInfo.getTexCoord();
  const semantic = `TEXCOORD_${texcoord}`;
  if (prim.getAttribute(semantic)) return semantic;
  return "TEXCOORD_0";
}
function filterPrimitive(prim, logger, meshName, i, overwrite) {
  if (prim.getMode() !== Primitive.Mode.TRIANGLES || !prim.getAttribute("POSITION") || !prim.getAttribute("NORMAL") || !prim.getAttribute("TEXCOORD_0")) {
    logger.debug(`${NAME$2}: Skipping primitive ${i} of mesh "${meshName}": primitives must have attributes=[POSITION, NORMAL, TEXCOORD_0] and mode=TRIANGLES.`);
    return false;
  }
  if (prim.getAttribute("TANGENT") && !overwrite) {
    logger.debug(`${NAME$2}: Skipping primitive ${i} of mesh "${meshName}": TANGENT found.`);
    return false;
  }
  if (prim.getIndices()) {
    logger.warn(`${NAME$2}: Skipping primitive ${i} of mesh "${meshName}": primitives must be unwelded.`);
    return false;
  }
  return true;
}
function unlit() {
  return (doc) => {
    const unlitExtension = doc.createExtension(KHRMaterialsUnlit);
    const unlit2 = unlitExtension.createUnlit();
    doc.getRoot().listMaterials().forEach((material) => {
      material.setExtension("KHR_materials_unlit", unlit2);
    });
  };
}
var NAME$1 = "unpartition";
var UNPARTITION_DEFAULTS = {};
function unpartition(_options = UNPARTITION_DEFAULTS) {
  return createTransform(NAME$1, async (document) => {
    const logger = document.getLogger();
    const buffer = document.getRoot().listBuffers()[0];
    document.getRoot().listAccessors().forEach((a2) => a2.setBuffer(buffer));
    document.getRoot().listBuffers().forEach((b, index) => index > 0 ? b.dispose() : null);
    logger.debug(`${NAME$1}: Complete.`);
  });
}
var NAME = "vertexColorSpace";
function vertexColorSpace(options) {
  return createTransform(NAME, (doc) => {
    const logger = doc.getLogger();
    const inputColorSpace = (options.inputColorSpace || "").toLowerCase();
    if (inputColorSpace === "srgb-linear") {
      logger.info(`${NAME}: Vertex colors already linear. Skipping conversion.`);
      return;
    }
    if (inputColorSpace !== "srgb") {
      logger.error(`${NAME}: Unknown input color space "${inputColorSpace}" \u2013 should be "srgb" or "srgb-linear". Skipping conversion.`);
      return;
    }
    const converted = /* @__PURE__ */ new Set();
    function sRGBToLinear(c2) {
      return c2 < 0.04045 ? c2 * 0.0773993808 : Math.pow(c2 * 0.9478672986 + 0.0521327014, 2.4);
    }
    function updatePrimitive(primitive) {
      const color = [0, 0, 0];
      let attribute;
      for (let i = 0; attribute = primitive.getAttribute(`COLOR_${i}`); i++) {
        if (converted.has(attribute)) continue;
        for (let j = 0; j < attribute.getCount(); j++) {
          attribute.getElement(j, color);
          color[0] = sRGBToLinear(color[0]);
          color[1] = sRGBToLinear(color[1]);
          color[2] = sRGBToLinear(color[2]);
          attribute.setElement(j, color);
        }
        converted.add(attribute);
      }
    }
    doc.getRoot().listMeshes().forEach((mesh) => mesh.listPrimitives().forEach(updatePrimitive));
    logger.debug(`${NAME}: Complete.`);
  });
}
export {
  DRACO_DEFAULTS,
  FLATTEN_DEFAULTS,
  INSTANCE_DEFAULTS,
  JOIN_DEFAULTS,
  MESHOPT_DEFAULTS,
  PALETTE_DEFAULTS,
  PRUNE_DEFAULTS,
  QUANTIZE_DEFAULTS,
  SIMPLIFY_DEFAULTS,
  TEXTURE_COMPRESS_DEFAULTS,
  TEXTURE_COMPRESS_SUPPORTED_FORMATS,
  TextureResizeFilter,
  VertexCountMethod,
  WELD_DEFAULTS,
  assignDefaults,
  center,
  clearNodeParent,
  clearNodeTransform,
  cloneDocument,
  compactAttribute,
  compactPrimitive,
  compressTexture,
  convertPrimitiveToLines,
  convertPrimitiveToTriangles,
  copyToDocument,
  createDefaultPropertyResolver,
  createTransform,
  dedup,
  dequantize,
  dequantizePrimitive,
  draco,
  fitPowerOfTwo,
  fitWithin,
  flatten,
  getBounds,
  getGLPrimitiveCount,
  getMeshVertexCount,
  getNodeVertexCount,
  getPrimitiveVertexCount,
  getSceneVertexCount,
  getTextureChannelMask,
  getTextureColorSpace,
  inspect,
  instance,
  isTransformPending,
  join,
  joinPrimitives,
  listNodeScenes,
  listTextureChannels,
  listTextureInfo,
  listTextureInfoByMaterial,
  listTextureSlots,
  mergeDocuments,
  meshopt,
  metalRough,
  moveToDocument,
  normals,
  palette,
  partition,
  prune,
  quantize,
  reorder,
  resample,
  sequence,
  simplify,
  simplifyPrimitive,
  sortPrimitiveWeights,
  sparse,
  tangents,
  textureCompress,
  transformMesh,
  transformPrimitive,
  unlit,
  unpartition,
  unweld,
  unweldPrimitive,
  vertexColorSpace,
  weld,
  weldPrimitive
};
/*! Bundled license information:

is-buffer/index.js:
  (*!
   * Determine if an object is a Buffer
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/
