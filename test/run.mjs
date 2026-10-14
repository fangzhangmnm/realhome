// 跑全部测：`node test/run.mjs`。新测文件在这里 import 一行即可。
import "./sw-strategy.test.mjs";
import "./force-reset-scope.test.mjs";
import "./page-title.test.mjs";
import { run } from "./runner.mjs";
run();
