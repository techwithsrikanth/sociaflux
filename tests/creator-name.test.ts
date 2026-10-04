import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prettifyHandleName } from "../src/lib/ai/provider";

describe("prettifyHandleName", () => {
  it("turns an underscore handle into a readable name", () => {
    assert.equal(prettifyHandleName("rukmini_vasanth"), "Rukmini Vasanth");
  });

  it("handles dots and hyphens", () => {
    assert.equal(prettifyHandleName("maya.skin-notes"), "Maya Skin Notes");
  });

  it("strips a leading @", () => {
    assert.equal(prettifyHandleName("@leograntfit"), "Leograntfit");
  });

  it("leaves a real display name untouched", () => {
    assert.equal(prettifyHandleName("National Geographic"), "National Geographic");
    assert.equal(prettifyHandleName("Rukmini Vasanth"), "Rukmini Vasanth");
  });

  it("does not mangle a correctly cased single word", () => {
    assert.equal(prettifyHandleName("Nike"), "Nike");
  });

  it("title-cases an all-lowercase single word", () => {
    assert.equal(prettifyHandleName("natgeo"), "Natgeo");
  });

  it("returns the input when there is nothing to clean", () => {
    assert.equal(prettifyHandleName(""), "");
    assert.equal(prettifyHandleName("@"), "@");
  });
});
