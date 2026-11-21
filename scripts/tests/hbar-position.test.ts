import assert from "node:assert/strict";
import test from "node:test";
import { hbarBottom } from "../../src/editor/hbar-position";

test("floating scrollbar avoids an overlapping status bar", () => {
  const status = { left: 400, right: 800, top: 700, bottom: 750 };
  assert.equal(hbarBottom(100, 600, 720, 12, status), 700);
  assert.equal(hbarBottom(100, 400, 720, 12, status), 720);
  assert.equal(hbarBottom(100, 600, 700, 12, status), 700);
  assert.equal(hbarBottom(100, 600, 720, 12, null), 720);
});
